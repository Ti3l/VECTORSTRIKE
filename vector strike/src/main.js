import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installMapAssets } from './map-assets.js';
import './style.css';
import { partyCardsHTML } from './party-ui.js';
import { ARENA, CRATES, ROOFS, OPEN_BUILDINGS, DOOR_WIDTH, GAME, SITE, SITES, siteAt, MAP_NAME, WEAPONS, ARMOR, stepPlayerMotion, distance2, spreadFor } from './shared.js';
import { MODEL_FILES, visualGunLength } from './weapon-models.js';
import { getAimMode, getWeaponPose, getAimFov, approachAim } from './viewmodel.js';
import { updateLatencySamples, latencySummary } from './net-stats.js';
import { resolveWebSocketUrl, isVercelWithoutBackend } from './ws-endpoint.js';

const $ = id => document.getElementById(id);
const dom = {
  viewport: $('viewport'), menu: $('menu-overlay'), pause: $('pause-overlay'), nickname: $('nickname'),
  roomCode: $('room-code'), menuError: $('menu-error'), minimap: $('minimap'),
  notification: $('notification'), killfeed: $('killfeed'), scoreA: $('score-a'), scoreD: $('score-d'),
  timer: $('timer'), phaseLabel: $('phase-label'), roundLabel: $('round-label'),
  health: $('health-number'), healthFill: $('health-fill'), ammo: $('ammo-number'), reserve: $('reserve-number'),
  weapon: $('weapon-label'), reload: $('reload-label'), role: $('role-pill'),
  crosshair: $('crosshair'), scope: $('scope-view'), hitmarker: $('hitmarker'), interaction: $('interaction'),
  buy: $('buy-overlay'), buyTimer: $('buy-timer'), buyCredits: $('buy-credits'),
  money: $('credits-hud'), armor: $('armor-number'),
  damageFlash: $('damage-flash'), netStats: $('net-stats'), spectate: $('spectator-banner'), spectateName: $('spectate-name'),
  interactionText: $('interaction-text'), interactionProgress: $('interaction-progress'),
  objectiveTitle: $('objective-title'), objectiveDesc: $('objective-desc'), death: $('death-banner'),
  roundBanner: $('round-banner'), roundTitle: $('round-title'), roundEyebrow: $('round-eyebrow'),
  roundSubtitle: $('round-subtitle'), scoreboard: $('scoreboard'), scoreboardContent: $('scoreboard-content'),
};
const safe = text => String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const TEAM = { attackers: { title: 'ATACANTES', color: '#ff9c72' }, defenders: { title: 'DEFENSORES', color: '#62d9ef' } };
const self = { id: null, room: '', mode: 'private', team: 'attackers', pos: new THREE.Vector3(-18, 1.58, 0), yaw: -Math.PI / 2, pitch: 0, weapon: 'pistol', alive: false, health: 100, feet:0, vy:0, grounded:true, jumpHeld:false };
let socket = null, latest = null, lastRound = -1, receivedAt = 0;
let lobbyState = null, onlineUsers = [], lobbyUserId = null, currentInvite = null, partyAutoJoin = false, socialConnected = false;
let favoriteNames = new Set();
try { favoriteNames = new Set(JSON.parse(localStorage.getItem('vector-strike-favorites') || '[]')); } catch { /* sem favoritos locais */ }
let aimProgress = 0;
let active = false, isFiring = false, isAiming = false, semiNeedsRelease = false, lastFire = 0, weaponRecoil = 0, screenShake = 0, viewKick = 0;
let buyOpen = false, previousPhase = null, selectedShopItem = 'rifle', lastMuzzle = 0;
let spectateId = null, stepAt = 0, bombBeepAt = 0, inspectUntil = 0, switchUntil = 0, lastPing = 0, ping = 0, jitter = 0, latencySamples = [], frames = 0, fps = 0, fpsLast = 0;
const defaultSettings = { sensitivity: 1, volume: .65, graphics: 'standard', crosshair: 'mint', fps: false };
let settings = { ...defaultSettings };
try { settings = { ...settings, ...JSON.parse(localStorage.getItem('vector-strike-settings') || '{}') }; } catch { /* opções locais opcionais */ }
settings.sensitivity = THREE.MathUtils.clamp(Number(settings.sensitivity) || 1,.35,2.5);
settings.volume = THREE.MathUtils.clamp(Number(settings.volume) || 0,0,1);
if (!['low','standard','high'].includes(settings.graphics)) settings.graphics='standard';
if (!['mint','white','orange'].includes(settings.crosshair)) settings.crosshair='mint';
settings.fps=!!settings.fps;
let bannerWas = '', noteTimeout = null, audioContext = null;
const held = new Set();
const remote = new Map();
const tracers = [];
const blastEffects = [];
const tmpVec = new THREE.Vector3();
let previousTime = performance.now();
let inputSentAt = 0;
let canvasPointerLocked = false;
const playerSpotColors = { attackers: new THREE.Color('#ff9b72'), defenders: new THREE.Color('#55d9ee') };

// ---------- Loja tática (dados e transações autoritativos do servidor) ----------
const currency = amount => `¤ ${Math.max(0,Number(amount)||0).toLocaleString('pt-BR')}`;
const shopGroups = [
  ['01 / SUBMETRALHADORAS', ['mpa','smg','mpsd']],
  ['02 / RIFLES E ASSALTO', ['rifle','mk14','m21']],
  ['03 / PRECISÃO E ESPECIAIS', ['chassis','sniper','rpg','shotgun']],
  ['04 / ARMAS SECUNDÁRIAS', ['pistol','p226','sr1mp','heavyPistol','magnum']],
  ['05 / PROTEÇÃO', ['armorLight','armorHeavy']],
];
function shopItem(id) {
  const armor = id === 'armorLight' || id === 'armorHeavy';
  const item = armor ? ARMOR[id === 'armorLight'?'light':'heavy'] : WEAPONS[id];
  return { ...item, id, slot: armor ? 'armor' : item.slot, armor };
}
const weaponPreviews = new Map();
function weaponVisual(id) {
  const preview = weaponPreviews.get(id);
  return preview ? `<img src="${preview}" alt="Modelo 3D de ${safe(WEAPONS[id]?.name || id)}" loading="lazy">` : weaponSilhouette(id);
}
function weaponSilhouette(id) {
  const armor=id.startsWith('armor');
  if(armor) return `<svg viewBox="0 0 220 75" aria-hidden="true"><path d="M65 12 L110 3 L155 12 L166 49 L110 70 L54 49 Z" fill="#254651" stroke="#86d7c9" stroke-width="2"/><path d="M83 25 L110 19 L137 25 L142 44 L110 56 L78 44 Z" fill="${id==='armorHeavy'?'#91b4c2':'#4e8b89'}"/><path d="M107 27 H114 V47 H107 Z M100 36 H121 V40 H100 Z" fill="#122b35"/></svg>`;
  const isSide=WEAPONS[id]?.slot==='sidearm';
  const big=id==='sniper',pump=id==='shotgun',smg=id==='smg',heavy=id==='heavyPistol';
  const tint=WEAPONS[id]?.tint||'#83d8c9';
  if(isSide)return `<svg viewBox="0 0 220 75" aria-hidden="true"><g transform="translate(36 14)"><path d="M27 14 H143 V29 H84 L66 60 H43 L54 31 H27 Z" fill="#253d49" stroke="${tint}" stroke-width="2"/><path d="M37 9 H156 V21 H37 Z" fill="#71909a"/><path d="M103 29 L100 41 H78 L83 29" fill="#a3b2b4"/><path d="M131 21 H164 V27 H131 Z" fill="#526d78"/><path d="M46 37 L67 38 L61 55 H43 Z" fill="#102c37"/>${heavy?'<path d="M50 6 H139 V9 H50" stroke="#e6ad76" stroke-width="4"/>':''}</g></svg>`;
  return `<svg viewBox="0 0 220 75" aria-hidden="true"><g><path d="M24 31 L49 25 L63 30 L82 30 L82 43 L48 43 L31 53 L22 50 Z" fill="#35505c" stroke="${tint}" stroke-width="1.4"/><path d="M65 24 H${big?156:smg?136:147} V43 H65 Z" fill="#354f5c"/><path d="M82 28 H${big?147:smg?125:135} V38 H82 Z" fill="#657d86"/><path d="M102 43 L118 43 L112 67 L100 67 Z" fill="#2b414a"/><path d="M72 44 L84 44 L75 61 L64 61 Z" fill="#1c333b"/><rect x="${big?148:smg?130:pump?139:138}" y="29" width="${big?51:smg?46:44}" height="6" fill="#879ca2"/><rect x="${big?197:smg?173:180}" y="27" width="15" height="10" fill="#19323b"/><path d="M83 20 H${big?155:smg?131:142}" stroke="${tint}" stroke-width="4"/>${big?'<rect x="92" y="12" width="56" height="13" rx="6" fill="#213943" stroke="#b9a1e1" stroke-width="2"/><path d="M115 12 V6 H123 V12" stroke="#b9a1e1" stroke-width="3"/>':''}${pump?'<path d="M137 43 H188 V49 H137 Z" fill="#bf9879"/>':''}</g></svg>`;
}
function buildShop() {
  $('shop-list').innerHTML=shopGroups.map(([heading,ids])=>`<div class="buy-section-head">${heading}</div><div class="buy-grid">${ids.map(id=>{
    const item=shopItem(id);
    return `<button class="shop-card" data-buy-id="${id}" type="button" aria-label="Comprar ${safe(item.name)}"><span class="shop-tag">${safe(item.category|| (item.armor?'ESCUDO':'PISTOLA'))}</span><div class="shop-silhouette" data-weapon-visual="${id}">${weaponVisual(id)}</div><h3>${safe(item.name.toUpperCase())}</h3><div class="shop-card-bottom"><b>${item.price===0?'GRÁTIS':currency(item.price)}</b><span data-status>SELECIONAR</span></div></button>`;
  }).join('')}</div>`).join('');
}
function shopDetail(id) {
  const item=shopItem(id);
  const stats=item.armor?[['PROTEÇÃO',item.points,50],['ABSORÇÃO',45,100]]:[['DANO',item.damage,170],['CABEÇA',item.headDamage,220],['CADÊNCIA',Math.round(60000/item.fireMs),790],['CAPACIDADE',item.magazine,30],...(item.blastRadius?[['ÁREA (M)',item.blastRadius,5]]:[])];
  $('shop-detail').innerHTML=`<span class="tiny-overline">DETALHES DO EQUIPAMENTO</span><h3>${safe(item.name.toUpperCase())}</h3><p>${safe(item.subtitle||'Equipamento tático')}</p><div class="buy-detail-visual" data-detail-weapon="${id}">${weaponVisual(id)}</div><div class="buy-detail-price">${item.price===0?'EQUIPAMENTO INICIAL':currency(item.price)}</div><div>${stats.map(([label,value,max])=>`<div class="buy-stat"><label>${label}</label><div class="bar"><i style="width:${Math.min(100,100*value/max)}%"></i></div><span>${value}</span></div>`).join('')}</div><div class="buy-detail-note">${item.armor?'Escudos absorvem parte do dano e permanecem após o round caso você sobreviva.':'Recuo, precisão, alcance e cadência variam conforme a arma. Mantenha a mira estável e administre o dinheiro da equipe.'}</div>`;
}
function refreshShop(me) {
  if(!me || !buyOpen)return;
  dom.buyCredits.textContent=currency(me.credits);
  $('buy-round').textContent=String(latest.round).padStart(2,'0');
  $('buy-owned-primary').textContent=me.inventory.primary?WEAPONS[me.inventory.primary].name:'SEM ARMA';
  $('buy-owned-sidearm').textContent=WEAPONS[me.inventory.sidearm]?.name||'P320';
  $('buy-owned-armor').textContent=me.armorMax?`${me.armor} / ${me.armorMax} DE ESCUDO`:'SEM COLETE';
  for(const b of document.querySelectorAll('[data-refund-slot]'))b.classList.toggle('hidden',!Object.hasOwn(me.bought||{},b.dataset.refundSlot));
  for(const card of document.querySelectorAll('[data-buy-id]')){
    const id=card.dataset.buyId,item=shopItem(id);
    const owned=item.armor ? (me.armor>=item.points) : (me.inventory[item.slot]===id);
    const available=me.credits+(me.bought?.[item.slot]||0)>=item.price;
    card.disabled=owned||!available||id==='pistol';
    card.classList.toggle('is-owned',owned);
    card.classList.toggle('is-locked',!available&&!owned);
    card.classList.toggle('is-selected',selectedShopItem===id);
    card.querySelector('[data-status]').textContent=owned?'EQUIPADO':id==='pistol'?'PADRÃO':!available?'SEM CRÉDITOS':'COMPRAR';
  }
}
function setBuyOpen(open,requestLock=false) {
  if(open && (!active || latest?.phase!=='prepare' || !self.alive))return;
  buyOpen=open;
  dom.buy.classList.toggle('hidden',!open);
  document.body.classList.toggle('shopping',open);
  if(open){
    isFiring=false;isAiming=false;semiNeedsRelease=false;held.clear();
    dom.pause.classList.add('hidden');
    if(document.pointerLockElement)document.exitPointerLock();
    refreshShop(latest?.players.find(p=>p.id===self.id));
  }else{
    if(requestLock){renderer.domElement.requestPointerLock().catch(()=>showPause());}
    else showPause();
  }
}
buildShop();shopDetail(selectedShopItem);
$('shop-list').addEventListener('mouseover',e=>{
  const card=e.target.closest('[data-buy-id]');
  if(card&&card.dataset.buyId!==selectedShopItem){selectedShopItem=card.dataset.buyId;shopDetail(selectedShopItem);refreshShop(latest?.players.find(p=>p.id===self.id));}
});
$('shop-list').addEventListener('click',e=>{
  const card=e.target.closest('[data-buy-id]');
  if(card&&!card.disabled){selectedShopItem=card.dataset.buyId;transmit({type:'buy',item:selectedShopItem});sound(570,.08,'sine',.02);}
});
dom.buy.addEventListener('click',e=>{
  const b=e.target.closest('[data-refund-slot]');
  if(b)transmit({type:'refund',slot:b.dataset.refundSlot});
});
$('close-buy').addEventListener('click',()=>setBuyOpen(false,true));
$('buy-quick').addEventListener('click',()=>setBuyOpen(true));
$('pause-buy').addEventListener('click',()=>setBuyOpen(true));

// ---------- Renderizador e cenário geométrico original ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color('#213b4d');
scene.fog = new THREE.FogExp2('#244050', .0065);
const camera = new THREE.PerspectiveCamera(76, 1, 0.06, 210);
camera.rotation.order = 'YXZ';
scene.add(camera);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
dom.viewport.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight('#a2e6e9', '#1d2025', 2.15));
const sun = new THREE.DirectionalLight('#d9f7ff', 2.4);
sun.position.set(-12, 22, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
sun.shadow.camera.left = -48; sun.shadow.camera.right = 48;
sun.shadow.camera.top = 43; sun.shadow.camera.bottom = -43;
sun.shadow.bias = -.0003;
scene.add(sun);
const terrain = new THREE.Group();
scene.add(terrain);
const mat = (color, metalness = 0, roughness = .7, emissive = '#000000', emissiveIntensity = 0) => new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity });
const mFloor = mat('#435967', .14, .92);
const mLine = mat('#82969a', .24, .65);
const mWall = mat('#293d4d', .21, .7);
const mPanel = mat('#365667', .43, .5);
const mContainer = mat('#355460', .42, .65);
const mCrate = mat('#6e6b5c', .09, .87);
const mMetal = mat('#101d28', .66, .4);
const mNeon = mat('#4de7cc', .0, .27, '#38ffdd', 1.65);
const mOrange = mat('#e3a568', .11, .65, '#fc8834', .15);
function box(w, h, d, x, y, z, material, parent = terrain, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  mesh.castShadow = cast;
  parent.add(mesh);
  return mesh;
}
function line(points, color = '#78a9b0', opacity = .35) {
  const geo = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
  const mesh = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  terrain.add(mesh);
  return mesh;
}
function makeGroundLabel(text, fg, bg = 'rgba(8,25,30,.6)') {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = fg; ctx.lineWidth = 5; ctx.strokeRect(8, 8, 496, 144);
  ctx.fillStyle = fg; ctx.font = '900 72px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 87);
  const texture = new THREE.CanvasTexture(cv);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function makeSign(text, x, y, z, w = 5, h = 1.6, rotationY = 0) {
  const texture = makeGroundLabel(text, '#a5fce7');
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  panel.position.set(x, y, z); panel.rotation.y = rotationY;
  terrain.add(panel);
}
// Piso procedural: concreto com variações de cor, juntas e desgaste.
// Repetição por metro evita o aspecto liso/esticado da V1.7.
function groundMaterial(base, width, depth, scale=8) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  const c=canvas.getContext('2d');c.fillStyle=base;c.fillRect(0,0,512,512);
  let seed=73419;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<11500;i++){
    const x=random()*512,y=random()*512,r=random()*2.7+.25;
    c.fillStyle=random()>.46?'rgba(229,245,238,.035)':'rgba(3,15,24,.055)';
    c.fillRect(x,y,r,r);
  }
  c.lineWidth=2;c.strokeStyle='rgba(8,23,30,.14)';
  for(let i=0;i<=512;i+=128){c.beginPath();c.moveTo(i,0);c.lineTo(i,512);c.stroke();c.beginPath();c.moveTo(0,i);c.lineTo(512,i);c.stroke();}
  for(let i=0;i<28;i++){
    const x=random()*512,y=random()*512;
    c.fillStyle='rgba(23,34,35,.10)';c.beginPath();c.ellipse(x,y,random()*18+6,random()*7+2,random()*3,0,Math.PI*2);c.fill();
  }
  for(let i=0;i<19;i++){
    const x=random()*512,y=random()*512;
    c.strokeStyle='rgba(14,31,36,.13)';c.lineWidth=random()+.4;
    c.beginPath();c.moveTo(x,y);c.lineTo(x+12,y+4);c.lineTo(x+20,y+11);c.stroke();
  }
  const tex=new THREE.CanvasTexture(canvas);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(width/scale,depth/scale);
  tex.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
  return new THREE.MeshStandardMaterial({map:tex,roughness:.96,metalness:.02,color:'#e2eeeb'});
}
function buildOpenBuildings(concrete) {
  for (const b of OPEN_BUILDINGS) {
    // Interior acessível. As paredes são desenhadas no loop dos sólidos CRATES.
    box(b.w-.38,.055,b.d-.38,b.x,.023,b.z,concrete,terrain,false);
    box(b.w+.14,.18,b.d+.14,b.x,b.h-.11,b.z,mat('#24343f',.32,.74));
    // Teste de colisão do teto/telhado é ROOFS no servidor.
    box(b.w+.28,.14,b.d+.28,b.x,b.h+.07,b.z,mat('#182b38',.32,.76));
    for(const sign of [-1,1]){
      box(b.w+.16,.12,.15,b.x,b.h+.19,b.z+sign*b.d/2,mat('#789aa2',.35,.55),terrain,false);
    }
    // Pequenas luminárias e mobiliário decorativo encostado nas paredes,
    // elevados do caminho central, sem bloquear entradas.
    const lamp=new THREE.PointLight('#a7edcb',.75,7.5);
    lamp.position.set(b.x,b.h-.7,b.z);terrain.add(lamp);
    box(.7,.07,.24,b.x,b.h-.31,b.z,mat('#b6f0d1',.14,.36,'#82edd2',.5),terrain,false);
    const isX=b.door==='both-x';
    const entryDoor=b.door==='south'?b.z+b.d/2:b.door==='north'?b.z-b.d/2:b.z;
    if(!isX){
      for(const s of [-1,1])box(.13,2.56,.15,b.x+s*(DOOR_WIDTH/2+.07),1.28,entryDoor,mat('#a9bfc3',.43,.5),terrain,false);
      box(DOOR_WIDTH+.3,.1,.22,b.x,2.6,entryDoor,mat('#88bbb8',.4,.48),terrain,false);
    }else{
      for(const s of [-1,1])for(const e of [-1,1])box(.15,2.56,.13,b.x+e*b.w/2,1.28,b.z+s*(DOOR_WIDTH/2+.07),mat('#91adb3',.36,.5),terrain,false);
    }
    // Faixas na parede externa funcionam como janelas fechadas, sem sugerir
    // passagem por onde há colisão (portas continuam livres).
    const wallZ=b.z+(b.door==='south'?-1:1)*(b.d/2+.018);
    for(const s of [-1,1]){
      const glass=box(.92,.6,.03,b.x+s*(b.w/2-1.2),2.15,wallZ,mat('#143b4a',.26,.3,'#124353',.14),terrain,false);
      glass.castShadow=false;
    }
  }
}
function buildMap() {
  const W = ARENA.halfWidth * 2, D = ARENA.halfDepth * 2;
  const baseGround=groundMaterial('#62767b',W,D,9);
  const routeMaterial=groundMaterial('#58696c',W-3,10.7,9);
  const tarmac=groundMaterial('#455a61',W-3,7.4,9);
  const roof = mat('#496271', .21, .76);
  const highlightA = mat('#dca669', .08, .72);
  const highlightB = mat('#69c7d4', .08, .72);
  box(W, .5, D, 0, -.25, 0, baseGround, terrain, false);
  // Três pistas de aproximação independentes: A ao norte, meio e B ao sul.
  for (const [z, depth] of [[-19.8,10.7],[0,7.4],[19.8,10.7]]) {
    box(W - 3, .025, depth, 0, .013, z, z === 0 ? tarmac : routeMaterial, terrain, false);
    for (let x=-36; x<=35; x+=7) {
      box(2.5,.032,.10,x,.043,z+depth/2-.7,mLine,terrain,false);
    }
  }
  // Perímetro: recinto aberto de treinamento industrial, sem frestas no limite físico.
  for (const [x,z,w,d] of [[0,-ARENA.halfDepth,W,1],[0,ARENA.halfDepth,W,1],[-ARENA.halfWidth,0,1,D],[ARENA.halfWidth,0,1,D]]) {
    box(w,ARENA.wallHeight,d,x,ARENA.wallHeight/2,z,mWall);
    box(w,.25,d,x,ARENA.wallHeight+.11,z,mPanel,terrain,false);
  }
  const spacing=8;
  for (let x=-36; x<=36; x+=spacing) for(const z of [-ARENA.halfDepth+.58,ARENA.halfDepth-.58]) {
    box(.16,5.4,.21,x,3.2,z,mMetal,terrain,false);
    box(2.5,.12,.23,x,6.1,z,roof,terrain,false);
  }
  for (let z=-25;z<=25;z+=8) for(const x of [-ARENA.halfWidth+.58,ARENA.halfWidth-.58]) {
    box(.21,5.4,.16,x,3.2,z,mMetal,terrain,false);
    box(.22,.12,2.5,x,6.1,z,roof,terrain,false);
  }
  // Cada sólido criado aqui corresponde ao MESMO CRATES do servidor.
  const covers=[];
  for (const c of CRATES) {
    const material=c.type==='crate'?mCrate:c.type==='interior-wall'?mContainer:mPanel;
    const bottom=c.y??0;
    const fallback=box(c.w,c.h,c.d,c.x,bottom+c.h/2,c.z,material);
    fallback.userData.cover=true;
    if(c.asset)covers.push({cover:c,fallback});
    if(c.type==='interior-wall'){
      // A geometria visual e a de colisão compartilham as mesmas dimensões.
      if(c.part==='lintel')box(c.w+.04,.075,c.d+.04,c.x,bottom+c.h-.018,c.z,mMetal,terrain,false);
      continue;
    }
    box(c.w+.07,.10,c.d+.07,c.x,bottom+c.h+.04,c.z,mMetal,terrain,false);
    if(c.type==='crate'){
      // Cantoneiras e réguas destacam a superfície que agora pode ser escalada.
      for(const v of [-1,1])box(.09,c.h,.09,c.x+v*(c.w/2-.1),c.h/2,c.z-c.d/2-.07,mMetal,terrain,false);
      for(const v of [-1,1])box(c.w,.035,.05,c.x,c.h+.10,c.z+v*(c.d/2-.15),mOrange,terrain,false);
    }
  }
  buildOpenBuildings(baseGround);
  // Cada site tem marcação de solo, letras, sinalização própria e pontos visuais.
  for (const site of Object.values(SITES)) {
    const isA=site.id==='A';
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(site.radius-.12,site.radius,72),
      new THREE.MeshBasicMaterial({color:isA?'#edc28a':'#7be7e0',side:THREE.DoubleSide,transparent:true,opacity:.84,depthWrite:false})
    );
    ring.rotation.x=-Math.PI/2;ring.position.set(site.x,.057,site.z);terrain.add(ring);
    for(let angle=0; angle<Math.PI*2; angle+=Math.PI/2){
      const marker = new THREE.Mesh(new THREE.RingGeometry(.25,.38,20),
        new THREE.MeshBasicMaterial({color:isA?'#ffc280':'#80e6df',side:THREE.DoubleSide}));
      marker.rotation.x=-Math.PI/2;
      marker.position.set(site.x+Math.cos(angle)*site.radius,.065,site.z+Math.sin(angle)*site.radius);
      terrain.add(marker);
    }
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(5.2,1.6),
      new THREE.MeshBasicMaterial({map:makeGroundLabel(`SITE ${site.id}`,isA?'#f9cb88':'#8bf8ef'),transparent:true,depthWrite:false}));
    decal.rotation.x=-Math.PI/2;decal.position.set(site.x,.064,site.z);terrain.add(decal);
    const zMarker = isA ? -ARENA.halfDepth+.55 : ARENA.halfDepth-.55;
    makeSign(`SITE ${site.id} // ${site.label}`,site.x,4.9,zMarker,8.3,1.5,isA?0:Math.PI);
    const signal = new THREE.PointLight(isA?'#efc18a':'#72dcdf',2.4,10);
    signal.position.set(site.x,4.5,site.z);terrain.add(signal);
  }
  // Sinalização de corredor; orientação em ambos os sentidos.
  makeSign('MEIO // INTERLIGAÇÃO',-3,4.6,-30.45,9.6,1.5);
  makeSign('MEIO // INTERLIGAÇÃO',-3,4.6,30.45,9.6,1.5,Math.PI);
  makeSign('ATAQUE',-34,4.5,-30.45,5.4,1.55);
  makeSign('DEFESA',34,4.5,30.45,5.4,1.55,Math.PI);
  // Portões, sinalizadores e barras laterais, todos acima da altura dos jogadores.
  for (const x of [-32,32]) {
    for(const z of [-26,0,26]) {
      box(.23,4.7,.23,x,2.35,z,mMetal,terrain,false);
      box(.7,.14,.7,x,4.7,z,x<0?mOrange:mNeon,terrain,false);
    }
    const circle = new THREE.Mesh(new THREE.RingGeometry(1.4,1.48,50),
      new THREE.MeshBasicMaterial({color:x<0?'#f4a57b':'#71e2e5',transparent:true,opacity:.9,side:THREE.DoubleSide}));
    circle.rotation.x=-Math.PI/2;circle.position.set(x,.056,0);terrain.add(circle);
  }
  installMapAssets(terrain,covers);
}

buildMap();
// Dispositivo tático no chão: aparece ao plantar ou deixar a bomba cair.
const bombMesh=new THREE.Group();scene.add(bombMesh);bombMesh.visible=false;
const bombBase=new THREE.Mesh(new THREE.BoxGeometry(.51,.24,.38),mat('#3b5055',.65,.43));bombMesh.add(bombBase);
const bombLed=new THREE.Mesh(new THREE.BoxGeometry(.29,.065,.27),new THREE.MeshStandardMaterial({color:'#ffab58',emissive:'#ff623b',emissiveIntensity:1.2}));bombLed.position.y=.16;bombMesh.add(bombLed);
const bombHandle=new THREE.Mesh(new THREE.BoxGeometry(.10,.17,.42),mMetal);bombHandle.position.set(-.22,.11,0);bombMesh.add(bombHandle);
const bombLight=new THREE.PointLight('#ff8442',1.9,3.5);bombLight.position.y=.3;bombMesh.add(bombLight);
bombMesh.userData.planted=false;

// Arsenal V1.3: modelos GLB de verdade, com fallback geométrico para a escopeta
// e para casos em que a GPU / rede falhe ao carregar um arquivo.
const gun = new THREE.Group(); camera.add(gun);
const gunModelRoot = new THREE.Group(); gun.add(gunModelRoot);
let currentGunToken = 0;
const gunParts = [];
const mGun = mat('#17232b', .62, .36);
const mGunSteel = mat('#4c6470', .73, .32);
const mGunRubber = mat('#121e27', .08, .87);
const mGunGold = mat('#d0a66d', .75, .33);
function gunBox(w,h,d,x,y,z,material,rx=0,ry=0,rz=0) {
  const mesh = box(w,h,d,x,y,z,material,gun,false);
  mesh.rotation.set(rx,ry,rz);gunParts.push(mesh);return mesh;
}
function gunTube(radius,length,x,y,z,material,segments=12) {
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,segments),material);
  mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);gun.add(mesh);gunParts.push(mesh);return mesh;
}
const muzzleVisual=new THREE.Group();gun.add(muzzleVisual);
const muzzleCone=new THREE.Mesh(new THREE.ConeGeometry(.16,.5,6),new THREE.MeshBasicMaterial({color:'#ffe3a1',transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));
muzzleCone.rotation.x=-Math.PI/2;muzzleCone.position.z=-.2;muzzleVisual.add(muzzleCone);
const muzzleCore=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:'#fff7d3',transparent:true,opacity:.95}));muzzleVisual.add(muzzleCore);
muzzleVisual.visible=false;

const gltfLoader = new GLTFLoader();
const firearmPromises = new Map();
function getFirearmModel(id) {
  if(!MODEL_FILES[id])return Promise.resolve(null);
  if(!firearmPromises.has(id)){
    firearmPromises.set(id, gltfLoader.loadAsync(MODEL_FILES[id]).then(gltf=>{
      gltf.scene.traverse(obj=>{
        if(obj.isMesh){ obj.castShadow=true; obj.receiveShadow=true; }
      });
      return gltf.scene;
    }).catch(err=>{
      console.warn(`Não foi possível carregar ${MODEL_FILES[id]}:`,err);
      return null;
    }));
  }
  return firearmPromises.get(id);
}
function fitFirearm(model, length, centerZ=-.2, heightOffset=0) {
  // Os GLBs deste pacote têm cerca de 0,10–0,29 unidades e apontam para -Z.
  // A normalização usa medidas reais do modelo, não escalas fixas por arquivo.
  const bb=new THREE.Box3().setFromObject(model);
  const size=bb.getSize(new THREE.Vector3()),center=bb.getCenter(new THREE.Vector3());
  const scale=length/Math.max(.001,size.z);
  model.scale.setScalar(scale);
  model.position.set(-center.x*scale,-center.y*scale+heightOffset,-center.z*scale+centerZ);
  const wrapper=new THREE.Group();wrapper.add(model);return wrapper;
}

// Miniaturas da loja são renderizadas com os próprios GLBs, incluindo suas texturas.
let thumbnailRenderer=null;
function makeThumbnail(id,sceneModel){
  try{
    thumbnailRenderer??=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    thumbnailRenderer.setPixelRatio(1);
    thumbnailRenderer.setSize(360,140,false);
    thumbnailRenderer.outputColorSpace=THREE.SRGBColorSpace;
    thumbnailRenderer.toneMapping=THREE.ACESFilmicToneMapping;
    thumbnailRenderer.toneMappingExposure=1.7;
    const stage=new THREE.Scene();
    stage.add(new THREE.HemisphereLight('#cceeff','#273c49',3.3));
    const lamp=new THREE.DirectionalLight('#fff6df',4);lamp.position.set(-1,3,4);stage.add(lamp);
    const model=fitFirearm(sceneModel.clone(true),1.5,0,0);
    model.rotation.y=-Math.PI/2;
    stage.add(model);
    const thumbCam=new THREE.OrthographicCamera(-1.08,1.08,.42,-.42,.1,10);
    thumbCam.position.set(0,.38,3);thumbCam.lookAt(0,0,0);
    thumbnailRenderer.render(stage,thumbCam);
    return thumbnailRenderer.domElement.toDataURL('image/png');
  }catch(err){ console.warn('Prévia de arma indisponível',id,err);return null; }
}
async function preloadFirearmPreviews() {
  // Prefetch em sequência: deixa a primeira interação leve e reduz picos de VRAM.
  for(const id of Object.keys(MODEL_FILES)){
    const model=await getFirearmModel(id);
    if(!model)continue;
    const preview=makeThumbnail(id,model);
    if(!preview)continue;
    weaponPreviews.set(id,preview);
    for(const container of document.querySelectorAll(`[data-weapon-visual="${id}"]`)) container.innerHTML=weaponVisual(id);
    const detail=document.querySelector(`[data-detail-weapon="${id}"]`);
    if(detail)detail.innerHTML=weaponVisual(id);
  }
  thumbnailRenderer?.dispose(); thumbnailRenderer?.forceContextLoss(); thumbnailRenderer=null;
}
function buildGun(weapon) {
  for (const part of gunParts){gun.remove(part);part.geometry.dispose();}
  gunParts.length=0;
  if(gun.userData.accent)gun.userData.accent.dispose();
  const acc=mat(WEAPONS[weapon]?.tint||'#78e4cc',.46,.4,WEAPONS[weapon]?.tint||'#78e4cc',.15);
  gun.userData.accent=acc;
  const handgun=WEAPONS[weapon]?.slot==='sidearm';
  const compact=['smg','mpa','mpsd'].includes(weapon),pump=weapon==='shotgun',long=['sniper','chassis','m21'].includes(weapon),heavy=['heavyPistol','magnum'].includes(weapon);
  const muzzleZ=long?-1.63:pump?-1.14:handgun?(heavy?-.61:-.51):compact?-.79:-1.08;
  if(handgun){
    gunBox(heavy?.25:.20,.16,.42,0,.025,-.055,mGun);
    gunBox(heavy?.26:.23,.12,heavy?0:0,-.16,.13,mGunRubber,.22);
    gunBox(heavy?.26:.21,.43,0,.122,-.17,heavy?mGunSteel:mGun);
    gunBox(.15,.018,.16,0,-.115,-.155,mGunSteel);
    gunBox(.12,.04,.2,0,.21,-.17,acc);
    gunTube(heavy?.064:.048,heavy?.21:.16,0,.088,-.40,mGunSteel);
    gunBox(.06,.045,.05,0,.23,-.37,mGunRubber);
    if(heavy){gunBox(.24,.045,.28,0,.17,-.16,mGunGold);gunBox(.08,.04,.13,0,.19,-.22,acc);}
  }else{
    const length=long?.91:compact?.47:pump?.7:.76;
    gunBox(.235,.22,length,0,.02,-.19,mGun);
    gunBox(.21,.145,.36,0,.075,.28,mGunSteel);
    gunBox(.15,.18,.36,0,.04,.51,mGunRubber);
    gunBox(.29,.12,.11,0,-.003,.68,mGunRubber);
    gunBox(.13,.24,.17,0,-.21,.12,mGunRubber,.18);
    gunBox(.095,.18,.21,0,-.22,-.21,compact?mGunRubber:mGunSteel,-.18);
    gunBox(.19,.035,compact?.43:.65,0,.165,-.2,mGunSteel);
    for(let z=-.36;z<.1;z+=.14)gunBox(.20,.015,.038,0,.188,z,mGunRubber);
    gunTube(pump?.064:long?.043:.049,long?.91:compact?.42:pump?.70:.57,0,.067,muzzleZ+(long?.39:.23),mGunSteel);
    gunTube(pump?.075:.066,.06,0,.067,muzzleZ+.03,mGunRubber);
    gunBox(.22,.105,compact?.27:pump?.36:.44,0,.085,compact?-.55:pump?-.73:-.65,acc);
    gunBox(.085,.045,.06,0,.24,compact?-.58:-.58,mGunRubber);
    if(pump){
      gunTube(.042,.69,0,-.08,-.79,mGunGold);
      gunBox(.23,.16,.33,0,-.045,-.76,mGunRubber);
      gunBox(.13,.05,.35,0,-.13,-.65,acc);
    }
    if(long){
      gunBox(.16,.08,.19,0,.27,-.17,mGunSteel);
      gunTube(.122,.55,0,.36,-.18,mGunRubber);
      gunTube(.065,.64,0,.36,-.18,mGunSteel);
      gunBox(.12,.18,.07,0,.34,.06,mGunGold);
      gunBox(.28,.065,.08,0,.05,-.35,mGunRubber);
      gunBox(.11,.06,.13,0,-.12,.34,acc);
    }
    if(compact){
      gunBox(.16,.25,.15,0,-.17,-.44,mGunRubber,.13);
      gunBox(.14,.13,.1,.13,.11,-.22,acc);
    }
    if(!long&&!pump&&!compact){
      gunBox(.15,.09,.34,0,.275,-.13,mGunRubber);
      gunBox(.10,.035,.12,0,.31,-.08,acc);
      gunBox(.09,.09,.09,0,.28,-.48,mGunSteel);
    }
  }
  gunBox(.08,.045,.06,0,.065,muzzleZ,mGunSteel);
  muzzleVisual.position.set(0,.075,muzzleZ-.06);
  const initialPose=getWeaponPose(weapon,WEAPONS[weapon]?.slot,0);
  gun.position.set(initialPose.x,initialPose.y,initialPose.z);
  gun.rotation.set(initialPose.rx,initialPose.ry,initialPose.rz);
  aimProgress=0;
  isAiming=false;
  gun.userData.muzzleZ=muzzleZ;
  // Qualquer carregamento antigo será ignorado se o jogador trocar de arma.
  const token=++currentGunToken;
  gunModelRoot.clear();
  const file=MODEL_FILES[weapon];
  if(!file)return; // escopeta ainda usa a geometria original: não há escopeta no ZIP.
  getFirearmModel(weapon).then(source=>{
    if(token!==currentGunToken || !source)return;
    const clone=source.clone(true);
    const equipped=fitFirearm(clone,visualGunLength(weapon,WEAPONS[weapon].slot),-.19,.045);
    gunModelRoot.add(equipped);
    gunParts.forEach(piece=>{piece.visible=false;});
    gun.userData.muzzleZ=-.19-visualGunLength(weapon,WEAPONS[weapon].slot)/2-.06;
    muzzleVisual.position.set(0,.09,gun.userData.muzzleZ);
    flash.position.set(0,.09,gun.userData.muzzleZ-.12);
  });
}
buildGun('pistol');
const flash=new THREE.PointLight('#ffe2a3',0,5);flash.position.set(0,.09,-1.2);gun.add(flash);
// Mãos e antebraços provisórios acompanham a inclinação do modelo GLB.
// São malhas simples: mais tarde podem ser substituídas por mãos animadas.
const gloveMaterial = mat('#28383f',.19,.88);
const sleeveMaterial = mat('#314d5b',.13,.91);
function limbBetween(a, b, radius, material) {
  const direction = new THREE.Vector3().subVectors(b,a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius*.90,radius,direction.length(),7),material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  gun.add(mesh);
  return mesh;
}
const rightHand = new THREE.Group();gun.add(rightHand);
const gloveRight = new THREE.Mesh(new THREE.BoxGeometry(.16,.16,.27),gloveMaterial);
gloveRight.position.set(.08,-.24,.13);gloveRight.rotation.x=-.36;rightHand.add(gloveRight);
const forearmRight = limbBetween(new THREE.Vector3(.18,-.77,.66),new THREE.Vector3(.08,-.29,.23),.12,sleeveMaterial);
// O braço direito é a empunhadura principal, presente em todas as armas.
const leftHand = new THREE.Group();gun.add(leftHand);
const gloveLeft = new THREE.Mesh(new THREE.BoxGeometry(.17,.16,.29),gloveMaterial);
gloveLeft.position.set(-.07,-.19,-.45);gloveLeft.rotation.set(-.32,0,-.25);leftHand.add(gloveLeft);
const forearmLeft = limbBetween(new THREE.Vector3(.27,-.76,.02),new THREE.Vector3(-.065,-.27,-.40),.11,sleeveMaterial);

function nameSprite(label) {
  const cv=document.createElement('canvas'); cv.width=512;cv.height=90;
  const ctx=cv.getContext('2d');ctx.fillStyle='#061320d9';ctx.fillRect(0,0,512,90);
  ctx.font='800 40px Arial';ctx.fillStyle='#f1fffa';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label.slice(0,17),256,46);
  const texture = new THREE.CanvasTexture(cv);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:texture,depthTest:true,transparent:true }));
  sprite.position.y=2.26;sprite.scale.set(1.9,.35,1);return sprite;
}
function makeAvatar(player) {
  const group=new THREE.Group();scene.add(group);
  const tint=playerSpotColors[player.team];
  const bodyMat=new THREE.MeshStandardMaterial({color:tint,metalness:.36,roughness:.56});
  const dark=mat('#162833',.44,.64);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.34,.43,.83,8),bodyMat);body.position.y=.94;body.castShadow=true;group.add(body);
  const legs=new THREE.Mesh(new THREE.CylinderGeometry(.23,.28,.79,8),dark);legs.position.y=.41;legs.castShadow=true;group.add(legs);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.28,12,10),dark);head.position.y=1.61;head.castShadow=true;group.add(head);
  const visor=new THREE.Mesh(new THREE.BoxGeometry(.38,.12,.055),new THREE.MeshStandardMaterial({color:tint,emissive:tint,emissiveIntensity:.9}));visor.position.set(0,1.64,-.244);group.add(visor);
  const backpack=new THREE.Mesh(new THREE.BoxGeometry(.49,.63,.21),dark);backpack.position.set(0,1.02,.33);group.add(backpack);
  const weaponHolder=new THREE.Group();weaponHolder.position.set(.34,1.08,-.45);weaponHolder.rotation.x=-.12;group.add(weaponHolder);
  const fallback=new THREE.Mesh(new THREE.BoxGeometry(.13,.14,.7),dark);fallback.position.z=-.15;weaponHolder.add(fallback);
  const name=nameSprite(player.name);group.add(name);
  group.userData={playerId:player.id, weaponHolder, weaponFallback:fallback, weaponKey:null, loadToken:0};
  return group;
}
function updateAvatar(player) {
  let mesh=remote.get(player.id);
  if (!mesh) { mesh=makeAvatar(player);remote.set(player.id,mesh);mesh.position.set(player.x,player.y??0,player.z); }
  mesh.visible=!!player.alive && player.id!==spectateId;
  if(mesh.userData.weaponKey!==player.weapon){
    mesh.userData.weaponKey=player.weapon;
    const token=++mesh.userData.loadToken;
    const holder=mesh.userData.weaponHolder, fallback=mesh.userData.weaponFallback;
    holder.children.filter(child=>child!==fallback).forEach(child=>holder.remove(child));
    fallback.visible=true;
    fallback.scale.z=WEAPONS[player.weapon]?.slot==='sidearm'?.55:player.weapon==='sniper'?1.4:1;
    if(MODEL_FILES[player.weapon]) getFirearmModel(player.weapon).then(source=>{
      if(!source || token!==mesh.userData.loadToken)return;
      const instance=fitFirearm(source.clone(true),WEAPONS[player.weapon].slot==='sidearm'?.46:.88,-.14,.03);
      holder.add(instance);fallback.visible=false;
    });
  }
  mesh.userData.targetX=player.x;mesh.userData.targetY=player.y??0;mesh.userData.targetZ=player.z;mesh.userData.crouch=player.crouch;
  mesh.rotation.y=player.yaw;
}

function sound(frequency=400, duration=.05, wave='square', volume=.025) {
  if(settings.volume<=0)return;
  try {
    audioContext??=new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended') audioContext.resume();
    const oscillator=audioContext.createOscillator(), gain=audioContext.createGain();
    oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency,audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(50,frequency*.42),audioContext.currentTime+duration);
    gain.gain.setValueAtTime(volume * settings.volume,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+duration);
    oscillator.connect(gain).connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+duration);
  } catch { /* áudio opcional */ }
}
function emitTracer(message) {
  const start=new THREE.Vector3(message.x,message.y,message.z);
  const end=start.clone().add(new THREE.Vector3(message.dx,message.dy,message.dz).multiplyScalar(message.distance));
  const geometry=new THREE.BufferGeometry().setFromPoints([start,end]);
  const tracer=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:message.weapon==='rpg'?'#ffa14b':message.shooter===self.id?'#a9ffe0':'#f5be75',transparent:true,opacity:.9}));
  scene.add(tracer);tracers.push({object:tracer,remaining:.13});
  if(message.shooter!==self.id){
    const distance=Math.hypot(camera.position.x-message.x,camera.position.z-message.z);
    sound(message.weapon==='rifle'?98:145,.09,'sawtooth',Math.max(.004,.03/(1+distance*.14)));
  }
  if(message.hitId===self.id){screenShake=.07;sound(180,.18,'sawtooth',.045);}
  if(message.shooter===self.id&&message.hitId){
    dom.hitmarker.classList.remove('active');void dom.hitmarker.offsetWidth;dom.hitmarker.classList.add('active');
    sound(message.headshot?950:660,.065,'sine',.055);
  }
}

function emitExplosion(message) {
  const radius=Math.min(5,Number(message.radius)||3);
  const material=new THREE.MeshBasicMaterial({color:'#ffaf62',transparent:true,opacity:.68,depthWrite:false,blending:THREE.AdditiveBlending});
  const ball=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),material);
  ball.position.set(message.x,message.y,message.z);ball.scale.setScalar(.2);scene.add(ball);
  const light=new THREE.PointLight('#ff8b3d',9,radius*3);light.position.copy(ball.position);scene.add(light);
  blastEffects.push({ball,light,age:0,radius});
  sound(72,.24,'sawtooth',.11);
}

// ---------- Rede multiplayer ----------
function transmit(data) { if(socket?.readyState===WebSocket.OPEN) socket.send(JSON.stringify(data)); }
function setLobbyView(isLobby) {
  socialConnected=isLobby;
  $('lobby-entry').classList.toggle('hidden',isLobby);
  $('party-hub').classList.toggle('hidden',!isLobby);
  dom.nickname.disabled=isLobby;
  document.body.classList.toggle('social-lobby',isLobby);
  if(isLobby)dom.menuError.textContent='';
}
function renderParty() {
  if(!lobbyState)return;
  const members=lobbyState.members||[];
  const me=members.find(p=>p.id===lobbyUserId);
  const leader=lobbyState.ownerId===lobbyUserId;
  $('party-status').textContent=leader?'VOCÊ É O LÍDER DO GRUPO':'VOCÊ ESTÁ NO GRUPO';
  $('party-size').textContent=`${members.length} / 6`;
  $('party-members').innerHTML=partyCardsHTML(lobbyState,lobbyUserId,safe);
  $('party-stage-count').textContent=`${members.length} / 6`;
  $('party-me-name').textContent=me?.name||dom.nickname.value||'JOGADOR';
  $('party-me-avatar').textContent=(me?.name||'V').slice(0,1).toUpperCase();
  $('party-ready').textContent=me?.ready?'↩ CANCELAR PRONTO':'✓ MARCAR PRONTO';
  $('party-ready').classList.toggle('is-ready',!!me?.ready);
  $('party-team').textContent=me?.team==='attackers'?'⇄ IR PARA DEFESA':'⇄ IR PARA ATAQUE';
  $('party-ready').disabled=!me||lobbyState.phase!=='lobby';
  $('party-team').disabled=!me||lobbyState.phase!=='lobby';
  const enough=members.length>=2&&members.some(p=>p.team==='attackers')&&members.some(p=>p.team==='defenders');
  const ready=enough&&members.every(p=>p.ready);
  $('party-start').disabled=!leader||!ready||lobbyState.phase!=='lobby';
  $('party-requirements').textContent=!leader?'Aguarde o líder iniciar a partida.':members.length<2?'Convide pelo menos um amigo para começar.':!enough?'É necessário pelo menos um jogador em cada equipe.':!ready?'Todos precisam marcar PRONTO para iniciar.':'Grupo pronto! Clique em INICIAR PARTIDA.';
  $('return-party').classList.toggle('hidden',self.mode!=='party');
  $('return-party').textContent=leader?'↩ ENCERRAR PARTIDA E VOLTAR AO GRUPO':'↩ SAIR DA PARTIDA PARA O LOBBY';
  renderOnline();
}
function renderOnline() {
  const filter=$('friend-search').value.trim().toLocaleLowerCase('pt-BR');
  const members=lobbyState?.members||[];
  const listed=onlineUsers.filter(p=>p.id!==lobbyUserId);
  // Favoritos são apelidos guardados somente neste navegador, não contas autenticadas.
  const known=new Set(listed.map(p=>p.name.toLocaleLowerCase('pt-BR')));
  for(const name of favoriteNames)if(!known.has(name.toLocaleLowerCase('pt-BR')))listed.push({name,id:null,status:'offline'});
  const visible=listed.filter(p=>p.name.toLocaleLowerCase('pt-BR').includes(filter)).sort((a,b)=>{
    const fa=favoriteNames.has(a.name)?0:1,fb=favoriteNames.has(b.name)?0:1;
    return fa-fb||a.name.localeCompare(b.name,'pt-BR');
  });
  $('online-count').textContent=`${Math.max(0,onlineUsers.length-1)} ONLINE`;
  $('online-users').innerHTML=visible.length?visible.map(p=>{
    const same=members.some(m=>m.id===p.id),available=p.status==='lobby'&&!same&&members.length<6;
    const starred=favoriteNames.has(p.name);
    return `<div class="online-person ${p.status==='offline'?'is-offline':''}"><span class="online-dot"></span><span class="online-person-info"><b>${safe(p.name)}</b><small>${same?'NO SEU GRUPO':p.status==='lobby'?'NO LOBBY':p.status==='offline'?'FAVORITO OFFLINE':'EM PARTIDA'}</small></span><button class="favorite-btn ${starred?'starred':''}" type="button" data-favorite="${safe(p.name)}" aria-label="${starred?'Remover':'Adicionar'} favorito">${starred?'★':'☆'}</button><button type="button" data-invite="${safe(p.name)}" ${available?'':'disabled'}>${same?'NO GRUPO':available?'CONVIDAR':'INDISP.'}</button></div>`;
  }).join(''):'<div class="online-empty">Nenhum outro jogador encontrado. Peça para seus amigos abrirem o jogo no mesmo servidor.</div>';
}

function renderInvite() {
  const root=$('party-invites');
  root.classList.toggle('hidden',!currentInvite);
  if(!currentInvite){root.innerHTML='';return;}
  root.innerHTML=`<b>◈ CONVITE DE ${safe(currentInvite.from)}</b><p>${safe(currentInvite.from)} quer você no grupo (${currentInvite.count}/6 jogadores). Aceita entrar?</p><div><button type="button" data-respond="accept">ACEITAR</button><button type="button" data-respond="decline">RECUSAR</button></div>`;
}
function openSocialLobby(){
  active=false;latest=null;self.id=null;buyOpen=false;
  dom.buy.classList.add('hidden');dom.pause.classList.add('hidden');dom.scoreboard.classList.add('hidden');
  dom.menu.classList.remove('hidden');document.body.classList.remove('in-game');
  for(const avatar of remote.values())scene.remove(avatar);remote.clear();
  if(document.pointerLockElement)document.exitPointerLock();
  const url=new URL(location.href);url.searchParams.delete('room');url.searchParams.delete('party');history.replaceState(null,'',url);
  setLobbyView(true);renderParty();
}
function connect(room='', options={}) {
  establishConnection({type:'join',room,...options});
}
function connectLobby(){establishConnection({type:'hello'});}
function establishConnection(request) {
  if(socket && socket.readyState===WebSocket.OPEN)socket.close();
  const name=dom.nickname.value.trim().slice(0,17)||'Jogador';
  localStorage.setItem('vector-strike-name',name);
  dom.menuError.textContent='Conectando ao servidor…';
  for(const id of ['create-room','join-room','create-training','enable-lobby'])$(id).disabled=true;
  const configuredBackend=import.meta.env.VITE_WS_URL || '';
  if (isVercelWithoutBackend(location.hostname, configuredBackend, import.meta.env.PROD)) {
    dom.menuError.textContent='Servidor multiplayer não configurado na Vercel. Adicione VITE_WS_URL nas variáveis de ambiente e publique novamente.';
    for(const id of ['create-room','join-room','create-training','enable-lobby'])$(id).disabled=false;
    return;
  }
  let endpoint;
  try { endpoint=resolveWebSocketUrl(configuredBackend, location.href); }
  catch(error){
    dom.menuError.textContent=`Configuração de conexão inválida: ${error.message}`;
    for(const id of ['create-room','join-room','create-training','enable-lobby'])$(id).disabled=false;
    return;
  }
  const newSocket=new WebSocket(endpoint);
  socket=newSocket;
  newSocket.onopen=()=>{latencySamples=[];ping=0;jitter=0;transmit({...request,name});};
  newSocket.onerror=()=>{dom.menuError.textContent='Não foi possível conectar ao servidor multiplayer. Confirme VITE_WS_URL e se o serviço está online. Em plano gratuito, a primeira conexão pode demorar.';};
  newSocket.onclose=()=>{
    if(socket!==newSocket)return;
    for(const id of ['create-room','join-room','create-training','enable-lobby'])$(id).disabled=false;
    const wasActive=active,wasSocial=socialConnected;
    if(wasActive||wasSocial){
      active=false;self.id=null;buyOpen=false;latest=null;lobbyState=null;onlineUsers=[];lobbyUserId=null;currentInvite=null;
      dom.buy.classList.add('hidden');document.body.classList.remove('in-game');dom.menu.classList.remove('hidden');dom.pause.classList.add('hidden');
      setLobbyView(false);
      if(document.pointerLockElement)document.exitPointerLock();
      dom.menuError.textContent='A conexão foi encerrada. Entre novamente no lobby.';
    }
  };
  newSocket.onmessage=event=>{
    let message;try{message=JSON.parse(event.data);}catch{return;}
    if(message.type==='error'){dom.menuError.textContent=message.message;newSocket.close();return;}
    if(message.type==='partyError'){if(active)showNotification(message.message,2600);else dom.menuError.textContent=message.message;return;}
    if(message.type==='partyNotice'){if(active)showNotification(message.message,2300);else dom.menuError.textContent=message.message;return;}
    if(message.type==='lobbyWelcome'){
      lobbyUserId=message.id;socialConnected=true;setLobbyView(true);
      dom.menuError.textContent='';
      const queryParty=new URLSearchParams(location.search).get('party');
      if(queryParty&&!partyAutoJoin){partyAutoJoin=true;transmit({type:'partyJoinLink',room:queryParty});}
      renderParty();return;
    }
    if(message.type==='presence'){onlineUsers=message.online||[];renderOnline();return;}
    if(message.type==='partyState'){lobbyState=message;renderParty();return;}
    if(message.type==='partyInvite'){currentInvite=message;renderInvite();if(!active)dom.menuError.textContent=`Convite recebido de ${message.from}.`;return;}
    if(message.type==='partyReturned'){openSocialLobby();return;}
    if(message.type==='joined'){
      self.id=message.id;self.team=message.team;self.room=message.code;self.mode=message.mode||'private';active=true;lastRound=-1;previousPhase=null;buyOpen=false;dom.buy.classList.add('hidden');
      for(const avatar of remote.values())scene.remove(avatar);remote.clear();
      dom.menu.classList.add('hidden');document.body.classList.add('in-game');
      $('training-header').classList.toggle('hidden',self.mode!=='training');
      $('training-actions').classList.toggle('hidden',self.mode!=='training');
      $('training-start-buy').classList.toggle('hidden',self.mode!=='training');
      $('copy-room').classList.toggle('hidden',self.mode==='training'||self.mode==='party');
      $('return-party').classList.toggle('hidden',self.mode!=='party');
      $('room-head-label').textContent=self.mode==='party'?'GRUPO ONLINE':(self.mode==='training'?'TREINO ':'SALA ')+message.code;$('pause-room').textContent=self.mode==='party'?'AMIGOS':message.code;
      dom.role.textContent=TEAM[self.team].title;dom.role.style.color=TEAM[self.team].color;
      dom.menuError.textContent='';$('room-code').value=message.code;
      const url=new URL(location.href);
      if(self.mode==='party'){url.searchParams.delete('room');url.searchParams.set('party',message.code);}else{url.searchParams.delete('party');url.searchParams.set('room',message.code);}
      history.replaceState(null,'',url);
      showPause();showNotification(self.mode==='training'?`Treino criado! ${message.botCount} bot(s) • ${message.difficulty} • B abre a loja`:self.mode==='party'?'Partida do grupo iniciada!':'Sala '+message.code+' • Compartilhe o link com um amigo',4200);
      return;
    }
    if(message.type==='snapshot')handleSnapshot(message);
    if(message.type==='purchaseResult'){showNotification(message.message,1600);if(message.ok)sound(880,.11,'sine',.03);else sound(190,.12,'triangle',.028);}
    if(message.type==='pong'&&Number.isFinite(message.sent)){
      latencySamples=updateLatencySamples(latencySamples,performance.now()-message.sent);
      ({ping,jitter}=latencySummary(latencySamples));
    }
    if(message.type==='shot')emitTracer(message);
    if(message.type==='blast')emitExplosion(message);
    if(message.type==='event')handleEvent(message);
  };
}

function handleSnapshot(message){
  latest=message;receivedAt=performance.now();
  const me=message.players.find(p=>p.id===self.id);
  if(!me)return;
  if(message.round!==lastRound){
    lastRound=message.round;self.pos.set(me.x,1.58+(me.y??0),me.z);self.feet=me.y??0;self.vy=0;self.grounded=self.feet===0;self.jumpHeld=false;self.yaw=me.yaw;self.pitch=me.pitch;
    spectateId=null;stepAt=0;bombBeepAt=0;viewKick=0;
    isFiring=false;isAiming=false;semiNeedsRelease=false;buildGun(me.weapon);self.weapon=me.weapon;
  }
  if(me.health < self.health && message.round===lastRound && message.phase==='live' && self.alive){
    dom.damageFlash.classList.remove('active');void dom.damageFlash.offsetWidth;dom.damageFlash.classList.add('active');
    screenShake=Math.max(screenShake,.06);
  }
  self.alive=me.alive;self.health=me.health;
  if(message.phase==='prepare' && previousPhase!=='prepare' && me.alive) setBuyOpen(true);
  if(message.phase!=='prepare' && buyOpen) setBuyOpen(false);
  previousPhase=message.phase;
  $('training-start-pause').classList.toggle('hidden',self.mode!=='training' || message.phase!=='prepare');
  $('pause-buy').classList.toggle('hidden',message.phase!=='prepare' || !me.alive);
  $('buy-quick').classList.toggle('hidden',message.phase!=='prepare' || !me.alive);
  dom.money.textContent=currency(me.credits);dom.armor.textContent=me.armor;
  if(buyOpen)refreshShop(me);
  if(!me.alive) {
    const teammates=message.players.filter(p=>p.team===self.team&&p.alive&&p.id!==self.id);
    if(!teammates.some(p=>p.id===spectateId)) spectateId=teammates[0]?.id ?? null;
  } else spectateId=null;
  const watched=message.players.find(p=>p.id===spectateId && p.alive);
  dom.spectate.classList.toggle('hidden',!watched || message.phase==='roundEnd' || message.phase==='matchEnd');
  if(watched)dom.spectateName.textContent=watched.name;
  if(!self.alive || Math.hypot(me.x-self.pos.x,me.z-self.pos.z)>1.5){self.pos.x=me.x;self.pos.z=me.z;}
  // A altura do servidor é autoritativa; suaviza pequenas correções da predição local.
  const heightError=(me.y??0)-self.feet;
  if(!me.alive||Math.abs(heightError)>.55){self.feet=me.y??0;self.vy=0;self.grounded=self.feet<=.01;}
  else if(Math.abs(heightError)>.035)self.feet+=heightError*.10;
  else {self.pos.x+=(me.x-self.pos.x)*.16;self.pos.z+=(me.z-self.pos.z)*.16;}
  if(me.weapon!==self.weapon){self.weapon=me.weapon;buildGun(self.weapon);}
  dom.scoreA.textContent=message.scores.attackers;dom.scoreD.textContent=message.scores.defenders;
  dom.roundLabel.textContent='ROUND '+String(message.round).padStart(2,'0');
  dom.phaseLabel.textContent={waiting:'AGUARDANDO',prepare:'PREPARAÇÃO',live:message.bomb.state==='planted'?'BOMBA PLANTADA':'EM COMBATE',roundEnd:'FIM DO ROUND',matchEnd:'FIM DA PARTIDA'}[message.phase];
  const hudPlayer=watched||me;
  dom.health.textContent=hudPlayer.health;dom.healthFill.style.width=hudPlayer.health+'%';
  dom.healthFill.style.background=hudPlayer.health<=30?'#ff9474':'#66f2d4';
  dom.ammo.textContent=hudPlayer.mag[hudPlayer.weapon];dom.reserve.textContent=hudPlayer.reserve[hudPlayer.weapon];
  dom.weapon.textContent=WEAPONS[hudPlayer.weapon]?.name.toUpperCase() || 'PISTOLA';dom.reload.textContent=hudPlayer.reloading?'RECARREGANDO…':'';
  dom.death.classList.toggle('hidden',me.alive||message.phase==='waiting');
  dom.death.querySelector('small').textContent=watched?'Assista ao aliado • ← / → para trocar':'Aguarde o próximo round • TAB para ver o placar';
  const result=message.phase==='roundEnd'||message.phase==='matchEnd';
  dom.roundBanner.classList.toggle('hidden',!result);
  if(result){
    const ours=message.winner===self.team;
    dom.roundEyebrow.textContent=message.phase==='matchEnd'?'RESULTADO DA PARTIDA':'RESULTADO DO ROUND';
    dom.roundTitle.textContent=ours?'VITÓRIA':'DERROTA';dom.roundTitle.style.color=ours?'#7af4d2':'#ff9a80';
    dom.roundSubtitle.textContent=message.reason||(message.phase==='matchEnd'?'Placar final da partida':'');
  }
  for(const p of message.players)if(p.id!==self.id)updateAvatar(p);
  if(bombMesh) {
    bombMesh.visible=message.bomb.state==='dropped'||message.bomb.state==='planted';
    bombMesh.position.set(message.bomb.x,.28,message.bomb.z);
    bombMesh.userData.planted=message.bomb.state==='planted';
  }
  for(const [id,avatar] of remote)if(!message.players.some(p=>p.id===id)){scene.remove(avatar);remote.delete(id);}
  updateObjective(message,me);updateScoreboard(message);updateMinimap(message);
}
function canUseBombPickup(me,bomb) {return me.alive&&distance2(me,bomb)<=GAME.pickupRadius;}
function updateObjective(state,me) {
  const bomb=state.bomb;
  let title,description,kind=null;
  if(state.phase==='waiting'){title=state.mode==='training'?'PREPARANDO BOTS':'AGUARDANDO ADVERSÁRIO';description=state.mode==='training'?'Treino solo iniciará automaticamente.':'Compartilhe o código da sala. São necessários 2 jogadores.';}
  else if(state.phase==='prepare'){title=state.mode==='training'?'TREINO • PREPARAÇÃO':'FASE DE COMPRA';description=state.mode==='training'?'Compre suas armas com B ou clique COMEÇAR COMBATE AGORA':'Pressione B para escolher armas • seus créditos continuam entre rounds';}
  else if(state.phase==='live'){
    if(bomb.state==='dropped' && self.team==='attackers'){
      title='BOMBA CAÍDA';description='Recupere a bomba e avance até o site A ou B';
      if(canUseBombPickup(me,bomb))kind='MANTENHA E PARA RECUPERAR';
    }else if(bomb.state==='planted'){
      title=`BOMBA ATIVA • SITE ${bomb.site || '?'}`;description=self.team==='defenders'?'Encontre a bomba e mantenha E para desarmar':'Impeça os defensores de desarmar';
      if(self.team==='defenders'&&me.alive&&distance2(me,bomb)<2.7){kind='MANTENHA E PARA DESARMAR';}
    }else{
      title=self.team==='attackers'?'OBJETIVO: PLANTAR BOMBA':'OBJETIVO: DEFENDER A E B';
      description=self.team==='attackers'?(bomb.carrier===self.id?'Você carrega a bomba • escolha o site A ou B':'Proteja o portador da bomba'):'Defenda os dois sites e impeça a planta';
      if(self.team==='attackers'&&bomb.carrier===self.id&&me.alive&&siteAt(me))kind=`MANTENHA E PARA PLANTAR NO SITE ${siteAt(me).id}`;
    }
  }else{title='AGUARDE O PRÓXIMO ROUND';description='Use TAB para ver o placar';}
  dom.objectiveTitle.textContent=title;dom.objectiveDesc.textContent=description;
  dom.interaction.classList.toggle('hidden',!kind);
  if(kind){dom.interactionText.textContent=kind;dom.interactionProgress.style.width=((me.useKind?me.useProgress:0)*100).toFixed(0)+'%';}
}
function handleEvent(msg){
  if(msg.kind==='kill'){
    const element=document.createElement('div');element.className='killitem';
    element.innerHTML=`<strong>${safe(msg.killer)}</strong> &nbsp; ⌖ &nbsp; ${safe(msg.victim)} ${msg.headshot?'<em>✦ HS</em>':''}`;
    dom.killfeed.prepend(element);setTimeout(()=>element.remove(),4700);
  }else if(msg.kind==='plant'){showNotification(msg.text,3900);sound(700,.25,'sine',.04);}
  else if(msg.kind==='drop'){showNotification(msg.text,3800);sound(250,.22,'sawtooth',.05);}
  else if(msg.kind==='pickup'){showNotification(msg.text,2600);sound(750,.11,'sine',.05);}
  else if(msg.kind==='live'){showNotification('COMEÇOU! ELIMINE OS INIMIGOS',2300);sound(670,.12,'sine',.04);}
  else if(msg.kind==='result'){sound(msg.winner===self.team?680:150,.3,'sawtooth',.045);const amount=msg.income?.[self.team];if(amount)showNotification('RECOMPENSA DE ROUND '+currency(amount),3000);}
  else if(msg.text)showNotification(msg.text,2100);
}
function showNotification(message,duration=2200){
  dom.notification.textContent=message;dom.notification.classList.remove('hidden');
  if(noteTimeout)clearTimeout(noteTimeout);
  noteTimeout=setTimeout(()=>dom.notification.classList.add('hidden'),duration);
}
function updateScoreboard(s){
  let result='';
  for(const team of ['attackers','defenders']){
    result+=`<div class="score-team ${team}">${TEAM[team].title} • ${s.scores[team]} PONTOS</div><div class="score-row header"><span>JOGADOR</span><span>ELIM.</span><span>MORTES</span><span>HP</span><span>CRÉDITOS</span></div>`;
    for(const p of s.players.filter(p=>p.team===team).sort((a,b)=>b.kills-a.kills)){
      result+=`<div class="score-row ${p.id===self.id?'you':''}"><span>${safe(p.name)} ${p.isBot?'[BOT]':p.id===self.id?'✦':''}</span><span>${p.kills}</span><span>${p.deaths}</span><span>${p.alive?p.health:'—'}</span><span>${currency(p.credits)}</span></div>`;
    }
  }
  dom.scoreboardContent.innerHTML=result;
}
function updateMinimap(s) {
  const ctx=dom.minimap.getContext('2d'),w=220,h=180;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#13232e';ctx.fillRect(0,0,w,h);
  const scaleX=w/(ARENA.halfWidth*2),scaleZ=h/(ARENA.halfDepth*2);
  const sx=x=>(x+ARENA.halfWidth)*scaleX;
  const sz=z=>(z+ARENA.halfDepth)*scaleZ;
  ctx.strokeStyle='#42616d';ctx.lineWidth=.6;
  for(let gx=-ARENA.halfWidth;gx<=ARENA.halfWidth;gx+=8){ctx.beginPath();ctx.moveTo(sx(gx),0);ctx.lineTo(sx(gx),h);ctx.stroke();}
  for(let gz=-ARENA.halfDepth;gz<=ARENA.halfDepth;gz+=8){ctx.beginPath();ctx.moveTo(0,sz(gz));ctx.lineTo(w,sz(gz));ctx.stroke();}
  ctx.fillStyle='#57717c';
  for(const b of CRATES)ctx.fillRect(sx(b.x-b.w/2),sz(b.z-b.d/2),b.w*scaleX,b.d*scaleZ);
  for(const site of Object.values(SITES)){
    const px=sx(site.x),py=sz(site.z);
    ctx.strokeStyle=site.id==='A'?'#f3b876':'#65dadd';ctx.lineWidth=1.7;
    ctx.beginPath();ctx.ellipse(px,py,site.radius*scaleX,site.radius*scaleZ,0,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=site.id==='A'?'#f3c78e':'#9ceae6';ctx.font='800 12px Arial';
    ctx.fillText(site.id,px-4,py+4);
  }
  for(const p of s.players){
    if(!p.alive||(s.mode!=='training'&&p.team!==self.team&&p.id!==self.id))continue;
    const px=sx(p.x),py=sz(p.z);
    ctx.save();ctx.translate(px,py);ctx.rotate(-p.yaw);
    ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(-4,5);ctx.lineTo(4,5);ctx.closePath();
    ctx.fillStyle=p.id===self.id?'#f8fff4':p.team==='attackers'?'#ff9d73':'#69d9ea';ctx.fill();ctx.restore();
  }
  if(s.bomb.state==='planted' || (s.bomb.state==='dropped'&&self.team==='attackers')){
    ctx.fillStyle=s.bomb.state==='planted'?'#ffde91':'#ff9b7b';
    ctx.fillRect(sx(s.bomb.x)-4,sz(s.bomb.z)-4,8,8);
  }
}

// ---------- Mouse, teclado e HUD ----------
function showPause(){
  if(!active)return;
  const locked=document.pointerLockElement===renderer.domElement;
  canvasPointerLocked=locked;dom.pause.classList.toggle('hidden',locked||buyOpen||latest?.phase==='roundEnd'||latest?.phase==='matchEnd');
  if(!locked){isFiring=false;isAiming=false;held.clear();}
}
renderer.domElement.addEventListener('click',()=>{if(active&&!canvasPointerLocked&&!buyOpen)renderer.domElement.requestPointerLock();});
$('resume').addEventListener('click',()=>{renderer.domElement.requestPointerLock();sound(440,.09,'sine',.025);});
document.addEventListener('pointerlockchange',showPause);
document.addEventListener('mousemove',e=>{
  if(!canvasPointerLocked||!self.alive||latest?.phase==='roundEnd'||latest?.phase==='matchEnd')return;
  self.yaw-=e.movementX*.0022*settings.sensitivity;self.pitch=THREE.MathUtils.clamp(self.pitch-e.movementY*.0022*settings.sensitivity,-1.46,1.46);
});
document.addEventListener('mousedown',e=>{if(e.button===0&&canvasPointerLocked){if(!isFiring)semiNeedsRelease=false;isFiring=true;}if(e.button===2&&canvasPointerLocked)isAiming=true;});
document.addEventListener('mouseup',e=>{if(e.button===0){isFiring=false;semiNeedsRelease=false;}if(e.button===2)isAiming=false;});
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  const focusIsInput=e.target?.tagName==='INPUT';
  if(focusIsInput)return;
  if(['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  held.add(e.code);
  if(e.code==='Tab'&&active&&!buyOpen)dom.scoreboard.classList.remove('hidden');
  if(!active)return;
  if(e.code==='KeyK'&&!e.repeat&&self.mode==='training'){transmit({type:'resetTraining'});return;}
  if(e.code==='KeyB'&&!e.repeat && latest?.phase==='prepare' && self.alive){setBuyOpen(!buyOpen,true);return;}
  if(e.code==='Escape'&&buyOpen){setBuyOpen(false);return;}
  if(!canvasPointerLocked||buyOpen)return;
  if(e.code==='KeyR'&&!e.repeat){transmit({type:'reload'});sound(280,.11,'triangle',.023);}
  if(e.code==='Digit1'&&!e.repeat){const primary=latest?.players.find(p=>p.id===self.id)?.inventory?.primary;if(primary)transmit({type:'weapon',weapon:primary});}
  if(e.code==='Digit2'&&!e.repeat){const sidearm=latest?.players.find(p=>p.id===self.id)?.inventory?.sidearm||'pistol';transmit({type:'weapon',weapon:sidearm});switchUntil=performance.now()+340;sound(385,.07,'triangle',.025);}
  if(e.code==='Digit1'&&!e.repeat){switchUntil=performance.now()+340;sound(390,.07,'triangle',.025);}
  if(e.code==='KeyF'&&!e.repeat)inspectUntil=performance.now()+1150;
  if((e.code==='ArrowRight'||e.code==='ArrowLeft')&&!e.repeat&&!self.alive)cycleSpectator(e.code==='ArrowRight'?1:-1);
});
document.addEventListener('keyup',e=>{
  held.delete(e.code);
  if(e.code==='Tab')dom.scoreboard.classList.add('hidden');
});
window.addEventListener('blur',()=>{held.clear();isFiring=false;isAiming=false;dom.scoreboard.classList.add('hidden');});
function cycleSpectator(direction){
  const mates=latest?.players.filter(p=>p.team===self.team&&p.alive&&p.id!==self.id)||[];
  if(!mates.length){spectateId=null;return;}
  const n=mates.findIndex(p=>p.id===spectateId);spectateId=mates[(n+direction+mates.length)%mates.length].id;
}
function controls(){
  if(!canvasPointerLocked || buyOpen)return {};
  return {jump:held.has('Space'),forward:held.has('KeyW'),back:held.has('KeyS'),left:held.has('KeyA'),right:held.has('KeyD'),sprint:held.has('ShiftLeft')||held.has('ShiftRight'),crouch:held.has('ControlLeft')||held.has('KeyC'),interact:held.has('KeyE'),aim:isAiming && getAimMode(self.weapon, WEAPONS[self.weapon]?.slot) !== 'none'};
}
function fire(t){
  if(!canvasPointerLocked||!self.alive||latest?.phase!=='live'||!isFiring||buyOpen)return;
  if(!WEAPONS[self.weapon].automatic && semiNeedsRelease)return;
  const rate=WEAPONS[self.weapon].fireMs;
  if(t-lastFire<rate)return;
  lastFire=t;
  const me=latest?.players.find(p=>p.id===self.id);
  if(!me?.mag?.[self.weapon] || me.reloading)return;
  transmit({type:'shoot',yaw:self.yaw,pitch:self.pitch});
  if(!WEAPONS[self.weapon].automatic)semiNeedsRelease=true;
  const kick=WEAPONS[self.weapon].recoil/.018;
  weaponRecoil=Math.min(.36,weaponRecoil+.13*kick);viewKick=Math.min(.075,viewKick+.012*kick);
  lastMuzzle=t;
  self.pitch=THREE.MathUtils.clamp(self.pitch+.006,-1.46,1.46);
  screenShake=Math.max(screenShake,.013);flash.intensity=13;inspectUntil=0;
  const config=WEAPONS[self.weapon];
  const pitchTone=config.blastRadius?62:config.slot==='sidearm'?190:config.fireMs<110?250:config.fireMs>900?80:125;
  sound(pitchTone,config.blastRadius?.21:config.fireMs>900?.15:.08,'sawtooth',.042);
}
function displayClock(t){
  if(!latest)return;
  if(latest.phase==='waiting'){dom.timer.textContent='--:--';return;}
  const target=latest.phase==='live'&&latest.bomb.state==='planted'?latest.bomb.deadline:latest.deadline;
  const ms=Math.max(0,target-latest.serverTime-(t-receivedAt));
  const total=Math.ceil(ms/1000);
  if(latest.phase==='prepare') dom.buyTimer.textContent=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  dom.timer.textContent=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  dom.timer.style.color=ms<10000?'#ffab83':'#f2fdfa';
}
function tick(t){
  frames++;
  if(t-fpsLast>950){fps=Math.round(frames*1000/(t-fpsLast||1000));frames=0;fpsLast=t;}
  if(active&&t-lastPing>1500){lastPing=t;transmit({type:'ping',sent:t});}
  if(dom.netStats){
    dom.netStats.textContent=`PING ${ping} MS • VAR ${jitter} MS${settings.fps?'  •  '+fps+' FPS':''}`;
    dom.netStats.title='PING = ida e volta da rede (mediana); VAR = oscilação entre medições. O túnel e a internet ainda podem adicionar latência.';
  }
  const seconds=Math.min((t-previousTime)/1000,.075);previousTime=t;
  if(active&&latest){
    const aimMode=getAimMode(self.weapon,WEAPONS[self.weapon]?.slot);
    const wantsAds=isAiming&&aimMode!=='none'&&self.alive&&!buyOpen&&canvasPointerLocked;
    aimProgress=approachAim(aimProgress,wantsAds,seconds);
    const desiredFov=THREE.MathUtils.lerp(76,getAimFov(self.weapon,WEAPONS[self.weapon]?.slot,true),aimProgress);
    camera.fov+=(desiredFov-camera.fov)*Math.min(1,seconds*14);camera.updateProjectionMatrix();
    const i=controls();
    if(self.alive&&(latest.phase==='live'||latest.phase==='waiting')){
      const pos=stepPlayerMotion({x:self.pos.x,z:self.pos.z,y:self.feet,vy:self.vy,grounded:self.grounded,jumpHeld:self.jumpHeld},i,self.yaw,seconds);
      self.pos.x=pos.x;self.pos.z=pos.z;self.feet=pos.y;self.vy=pos.vy;self.grounded=pos.grounded;self.jumpHeld=pos.jumpHeld;
    }
    const velocity=Number(!!i.forward)+Number(!!i.back)+Number(!!i.left)+Number(!!i.right);
    const moving=velocity>0&&self.alive&&latest.phase==='live';
    const bob=moving&&self.grounded?Math.sin(t*.011*(i.sprint?1.7:1))*(i.crouch?.012:.027):0;
    dom.crosshair.style.setProperty('--spread',`${Math.round(6+spreadFor(self.weapon,i)*270+weaponRecoil*35)}px`);
    dom.crosshair.style.setProperty('--cross-color',settings.crosshair==='white'?'#f6fffc':settings.crosshair==='orange'?'#ffad73':'#61ffe0');
    const scoped=aimMode==='scope' && aimProgress>.63 && self.alive;
    dom.crosshair.classList.toggle('is-ads',aimMode==='ads' && aimProgress>.6);
    dom.crosshair.classList.toggle('is-scoped',scoped);
    dom.scope.classList.toggle('active',scoped);
    if(moving&&self.grounded&&canvasPointerLocked&&t>stepAt){
      sound(i.crouch?110:155, i.crouch?.035:.055,'triangle', i.crouch?.007:.017);
      stepAt=t+(i.crouch?520:i.sprint?245:350);
    }
    if(latest.bomb.state==='planted'&&t>bombBeepAt){
      const remaining=latest.bomb.deadline-latest.serverTime-(t-receivedAt);
      sound(840,.075,'sine',.022);bombBeepAt=t+(remaining<10000?290:remaining<20000?570:1050);
    }
    const height=i.crouch?1.12:1.58;
    self.pos.y+=(self.feet+height-self.pos.y)*Math.min(1,seconds*17);
    const watched=(!self.alive&&spectateId)?latest.players.find(p=>p.id===spectateId&&p.alive):null;
    const watchedMesh=watched?remote.get(watched.id):null;
    camera.position.set(watched?(watchedMesh?.position.x??watched.x):self.pos.x,watched?((watched.y??0)+(watched.crouch?1.14:1.58)):self.pos.y+bob,watched?(watchedMesh?.position.z??watched.z):self.pos.z);
    camera.rotation.set((watched?watched.pitch:self.pitch)+viewKick+(Math.random()-.5)*screenShake,(watched?watched.yaw:self.yaw)+(Math.random()-.5)*screenShake,0);
    gun.visible=self.alive && !scoped;rightHand.visible=gun.visible;forearmRight.visible=gun.visible;leftHand.visible=gun.visible && WEAPONS[self.weapon]?.slot==='primary';forearmLeft.visible=leftHand.visible;
    weaponRecoil*=Math.pow(.08,seconds*5);screenShake*=Math.pow(.03,seconds*7);viewKick*=Math.pow(.09,seconds*5);
    const inspecting=Math.max(0,(inspectUntil-t)/1150);
    const switching=Math.max(0,(switchUntil-t)/340);
    const me=latest.players.find(p=>p.id===self.id);
    const reloadDip=me?.reloading ? .22+.065*Math.sin(t*.008):0;
    // Apresentação FPS tática: a arma sempre começa em diagonal a partir da
    // parte inferior direita. A transição do rifle mantém o modelo lateral;
    // pistolas não usam mira de ferro e a luneta esconde o modelo ao concluir.
    const pose=getWeaponPose(self.weapon,WEAPONS[self.weapon]?.slot,aimProgress);
    const swayFactor=1-aimProgress*.85;
    gun.position.x=pose.x+Math.sin(t*.0012)*.002*swayFactor+(moving?Math.cos(t*.011)*.009*swayFactor:0);
    gun.position.y=pose.y+Math.abs(bob)*.22*swayFactor-weaponRecoil*.14-switching*.35-reloadDip;
    gun.position.z=pose.z-weaponRecoil*.10;
    gun.rotation.x=pose.rx+weaponRecoil*.39+Math.sin(inspecting*Math.PI)*.45+reloadDip*.7;
    gun.rotation.y=pose.ry+Math.sin(inspecting*Math.PI)*.60+reloadDip*.6;
    gun.rotation.z=pose.rz+reloadDip*.28;
    muzzleVisual.visible=t-lastMuzzle<65 && self.alive;
    flash.intensity*=Math.pow(.0001,seconds*8);
    if(t-inputSentAt>40){inputSentAt=t;transmit({type:'input',input:i,yaw:self.yaw,pitch:self.pitch});}
    fire(t);
    displayClock(t);
  }else{
    gun.visible=false;rightHand.visible=false;forearmRight.visible=false;leftHand.visible=false;forearmLeft.visible=false;
    dom.scope.classList.remove('active');dom.crosshair.classList.remove('is-scoped','is-ads');
    camera.fov+=(76-camera.fov)*Math.min(1,seconds*10);camera.updateProjectionMatrix();
    const orb=t*.00015;
    camera.position.set(Math.sin(orb)*8,7.8,Math.cos(orb)*8+4);
    camera.lookAt(1,1.5,0);
  }
  for(const avatar of remote.values()){
    avatar.position.x+=(avatar.userData.targetX-avatar.position.x)*Math.min(1,seconds*12);
    avatar.position.z+=(avatar.userData.targetZ-avatar.position.z)*Math.min(1,seconds*12);
    avatar.position.y+=((avatar.userData.targetY??0)-avatar.position.y)*Math.min(1,seconds*13);
    const targetY=avatar.userData.crouch?-.32:0;
    avatar.children[0].position.y+=(.94+targetY-avatar.children[0].position.y)*Math.min(1,seconds*12);
    avatar.children[2].position.y+=(1.61+targetY-avatar.children[2].position.y)*Math.min(1,seconds*12);
    avatar.children[3].position.y+=(1.64+targetY-avatar.children[3].position.y)*Math.min(1,seconds*12);
  }
  if(bombMesh?.visible){bombMesh.rotation.y+=seconds*(bombMesh.userData.planted?0:1.6);bombMesh.children[1].material.emissiveIntensity=.8+Math.sin(t*(bombMesh.userData.planted?.014:.004))*.5;}
  for(let i=tracers.length-1;i>=0;i--){
    const trace=tracers[i];trace.remaining-=seconds;
    trace.object.material.opacity=Math.max(0,trace.remaining/.13);
    if(trace.remaining<=0){scene.remove(trace.object);trace.object.geometry.dispose();trace.object.material.dispose();tracers.splice(i,1);}
  }
  for(let i=blastEffects.length-1;i>=0;i--){
    const effect=blastEffects[i];effect.age+=seconds;
    const progress=Math.min(1,effect.age/.42);
    effect.ball.scale.setScalar(.2+effect.radius*.92*progress);
    effect.ball.material.opacity=.65*(1-progress);
    effect.light.intensity=9*(1-progress);
    if(progress>=1){
      scene.remove(effect.ball,effect.light);
      effect.ball.geometry.dispose();effect.ball.material.dispose();
      blastEffects.splice(i,1);
    }
  }
  renderer.render(scene,camera);
}
renderer.setAnimationLoop(tick);
// Faz o cache dos modelos e cria miniaturas em PNG para a loja do round.
preloadFirearmPreviews();
window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});
camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();

// ---------- Configurações locais (sem alterar as opções de outros jogadores) ----------
const sliders={sensitivity:$('setting-sensitivity'),volume:$('setting-volume')};
const settingsValue={sensitivity:$('sensitivity-value'),volume:$('volume-value')};
function applySettings(){
  sliders.sensitivity.value=String(settings.sensitivity);sliders.volume.value=String(settings.volume);
  $('setting-graphics').value=settings.graphics;
  $('setting-crosshair').value=settings.crosshair;
  $('setting-fps').checked=settings.fps;
  settingsValue.sensitivity.textContent=Number(settings.sensitivity).toFixed(2)+'×';
  settingsValue.volume.textContent=Math.round(settings.volume*100)+'%';
  const ratio=settings.graphics==='low'?1:settings.graphics==='high'?2:1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,ratio));
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.shadowMap.enabled=settings.graphics!=='low';
  renderer.setAnimationLoop(tick);
  localStorage.setItem('vector-strike-settings',JSON.stringify(settings));
}
sliders.sensitivity.addEventListener('input',e=>{settings.sensitivity=Number(e.target.value);applySettings();});
sliders.volume.addEventListener('input',e=>{settings.volume=Number(e.target.value);applySettings();});
$('setting-graphics').addEventListener('change',e=>{settings.graphics=e.target.value;applySettings();});
$('setting-crosshair').addEventListener('change',e=>{settings.crosshair=e.target.value;applySettings();});
$('setting-fps').addEventListener('change',e=>{settings.fps=e.target.checked;applySettings();});
applySettings();

// ---------- Ações do lobby ----------
dom.nickname.value=localStorage.getItem('vector-strike-name')||'';
const queryCode=new URLSearchParams(location.search).get('room');
if(queryCode)dom.roomCode.value=queryCode.toUpperCase().slice(0,5);
$('enable-lobby').addEventListener('click',connectLobby);
$('party-ready').addEventListener('click',()=>{
  const me=lobbyState?.members.find(p=>p.id===lobbyUserId);
  if(me)transmit({type:'partyReady',ready:!me.ready});
});
$('party-team').addEventListener('click',()=>{
  const me=lobbyState?.members.find(p=>p.id===lobbyUserId);
  if(me)transmit({type:'partyTeam',team:me.team==='attackers'?'defenders':'attackers'});
});
$('party-start').addEventListener('click',()=>transmit({type:'partyStart'}));
$('party-members').addEventListener('click',event=>{
  if(!event.target.closest('[data-focus-invite]'))return;
  $('friend-search').focus();
  $('friend-search').scrollIntoView({behavior:'smooth',block:'nearest'});
});
$('party-leave').addEventListener('click',()=>{
  currentInvite=null;renderInvite();
  const url=new URL(location.href);url.searchParams.delete('party');history.replaceState(null,'',url);
  transmit({type:'partyBack'});
});
$('return-party').addEventListener('click',()=>transmit({type:'partyReturn'}));
$('disconnect-lobby').addEventListener('click',()=>{if(socket)socket.close();});
$('friend-search').addEventListener('input',renderOnline);
$('invite-by-name').addEventListener('click',()=>{
  const name=$('friend-search').value.trim();
  if(!name){dom.menuError.textContent='Digite o codinome do seu amigo.';return;}
  transmit({type:'partyInvite',name});
});
$('friend-search').addEventListener('keydown',e=>{if(e.key==='Enter')$('invite-by-name').click();});
$('online-users').addEventListener('click',e=>{
  const favorite=e.target.closest('[data-favorite]');
  if(favorite){
    const name=favorite.dataset.favorite;
    if(favoriteNames.has(name))favoriteNames.delete(name);else favoriteNames.add(name);
    localStorage.setItem('vector-strike-favorites',JSON.stringify([...favoriteNames].slice(0,100)));
    renderOnline();return;
  }
  const button=e.target.closest('[data-invite]');if(button)transmit({type:'partyInvite',name:button.dataset.invite});
});
$('party-invites').addEventListener('click',e=>{
  const button=e.target.closest('[data-respond]');if(!button||!currentInvite)return;
  transmit({type:'partyRespond',token:currentInvite.token,accept:button.dataset.respond==='accept'});
  currentInvite=null;renderInvite();
});
$('copy-party-link').addEventListener('click',async()=>{
  if(!lobbyState)return;
  const url=new URL(location.href);url.searchParams.delete('room');url.searchParams.set('party',lobbyState.room);
  try{await navigator.clipboard.writeText(url.href);dom.menuError.textContent='Link do grupo copiado! Envie para seus amigos.';}
  catch{dom.menuError.textContent='Copie o link na barra do navegador: '+url.href;}
});
$('create-room').addEventListener('click',()=>connect());
$('create-training').addEventListener('click',()=>connect('',{mode:'training',botCount:Number($('training-bot-count').value),difficulty:$('training-difficulty').value}));
function beginTraining(){if(self.mode==='training' && latest?.phase==='prepare'){transmit({type:'startTraining'});if(buyOpen)setBuyOpen(false,true);}}
$('training-start-buy').addEventListener('click',beginTraining);
$('training-start-pause').addEventListener('click',beginTraining);
$('training-reset').addEventListener('click',()=>{if(self.mode==='training')transmit({type:'resetTraining'});});
$('join-room').addEventListener('click',()=>{
  const code=dom.roomCode.value.toUpperCase().trim();
  if(code.length!==5){dom.menuError.textContent='Digite o código completo da sala (5 caracteres).';return;}
  connect(code);
});
dom.roomCode.addEventListener('keydown',e=>{if(e.key==='Enter')$('join-room').click();});
dom.nickname.addEventListener('keydown',e=>{if(e.key==='Enter')$('create-room').click();});
$('copy-room').addEventListener('click',async()=>{
  const url=new URL(location.href);url.searchParams.set('room',self.room);
  try {await navigator.clipboard.writeText(url.href);showNotification('LINK DA SALA COPIADO!',2000);}
  catch {showNotification('CÓDIGO DA SALA: '+self.room,3500);}
});
