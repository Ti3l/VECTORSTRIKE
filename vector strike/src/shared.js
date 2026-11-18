// MAPA V1.8 — COMPLEXO ÍRIS. Medidas idênticas no cliente e no servidor.
// Pátio industrial com três rotas (Norte / Meio / Sul) e dois locais de bomba.
export const MAP_NAME = 'COMPLEXO ÍRIS';
export const ARENA = { halfWidth: 40, halfDepth: 31, wallHeight: 7.5 };
export const SPAWNS = {
  attackers: [
    { x: -34.5, z: -18 }, { x: -34.5, z: -6 },
    { x: -34.5, z: 6 }, { x: -34.5, z: 18 },
  ],
  defenders: [
    { x: 34.5, z: -18 }, { x: 34.5, z: -6 },
    { x: 34.5, z: 6 }, { x: 34.5, z: 18 },
  ],
};
// O alias SITE mantém compatibilidade com modos antigos. Novos rounds aceitam A ou B.
export const SITES = Object.freeze({
  A: Object.freeze({ id: 'A', x: 23, z: -17, radius: 5.5, label: 'PÁTIO NORTE' }),
  B: Object.freeze({ id: 'B', x: 23, z: 17, radius: 5.5, label: 'PÁTIO SUL' }),
});
export const SITE = SITES.A;
// Cada cobertura colide com o jogador, bloqueia tiros e participa do pathfinding dos bots.
// asset é o modelo FBX original usado como revestimento visual da mesma caixa de colisão.
// As construções são CASCAS ocas: colisões em paredes com vãos de porta,
// sem blocos invisíveis no interior. O mesmo layout é usado pelo cliente.
export const OPEN_BUILDINGS = [
  { x:-26,z:-23,w:7,d:4,h:3.6,door:'south',name:'Oficina Norte' },
  { x:2,z:-23,w:6.5,d:4.4,h:3.5,door:'south',name:'Depósito A' },
  { x:-26,z:23,w:7,d:4,h:3.6,door:'north',name:'Oficina Sul' },
  { x:2,z:23,w:6.5,d:4.4,h:3.5,door:'north',name:'Depósito B' },
  { x:-4,z:-8.4,w:9.4,d:6.2,h:4.1,door:'both-x',name:'Passagem Norte' },
  { x:-4,z:8.4,w:9.4,d:6.2,h:4.1,door:'both-x',name:'Passagem Sul' },
];
const WALL_WIDTH=.32;
export const DOOR_WIDTH=3.3;
function buildingWalls(b, index) {
  const pieces=[];
  const add=(x,z,w,d,y=0,h=b.h,part='wall')=>pieces.push({x,z,w,d,y,h,type:'interior-wall',building:index,part});
  const north=b.door==='north', south=b.door==='south';
  for(const sign of [-1,1]){
    const z=b.z+sign*(b.d/2-WALL_WIDTH/2);
    const doorway=(sign<0&&north)||(sign>0&&south);
    if(doorway){
      const segment=(b.w-DOOR_WIDTH)/2;
      for(const sx of [-1,1])add(b.x+sx*(DOOR_WIDTH/2+segment/2),z,segment,WALL_WIDTH);
      add(b.x,z,DOOR_WIDTH,WALL_WIDTH,2.55,b.h-2.55,'lintel');
    }else add(b.x,z,b.w,WALL_WIDTH);
  }
  for(const sign of [-1,1]){
    const x=b.x+sign*(b.w/2-WALL_WIDTH/2);
    if(b.door==='both-x'){
      const segment=(b.d-DOOR_WIDTH)/2;
      for(const sz of [-1,1])add(x,b.z+sz*(DOOR_WIDTH/2+segment/2),WALL_WIDTH,segment);
      add(x,b.z,WALL_WIDTH,DOOR_WIDTH,2.55,b.h-2.55,'lintel');
    }else add(x,b.z,WALL_WIDTH,b.d-2*WALL_WIDTH);
  }
  return pieces;
}
export const ROOFS = OPEN_BUILDINGS.map((b,index)=>({x:b.x,z:b.z,w:b.w,d:b.d,y:b.h-.24,h:.24,type:'roof',building:index}));
export const CRATES = [
  // Coberturas originais do FPS_Lite, mantendo seus modelos FBX.
  { x:-13,z:-21,w:5.8,d:5.2,h:3.7,type:'wall',asset:'Wall_01' },
  { x:14,z:-25.6,w:4.4,d:3.6,h:2.4,type:'crate',asset:'Box_01' },
  { x:31.8,z:-26.5,w:3.8,d:3.3,h:2.4,type:'crate',asset:'Box_01' },
  { x:-12,z:21.5,w:5.8,d:5.2,h:3.7,type:'wall',asset:'Wall_02' },
  { x:14,z:25.6,w:4.4,d:3.6,h:2.4,type:'crate',asset:'Box_01' },
  { x:31.8,z:26.5,w:3.8,d:3.3,h:2.4,type:'crate',asset:'Box_01' },
  { x:-21,z:-8.5,w:4.8,d:5.5,h:3.2,type:'wall',asset:'Wall_03' },
  { x:-21,z:8.5,w:4.8,d:5.5,h:3.2,type:'wall',asset:'WallPart_01' },
  { x:10,z:-8.1,w:5.2,d:7.8,h:4.2,type:'wall',asset:'Wall_01' },
  { x:10,z:8.1,w:5.2,d:7.8,h:4.2,type:'wall',asset:'Wall_02' },
  { x:-29.2,z:0,w:3.2,d:3.6,h:1.14,type:'crate',asset:'Box_01' },
  { x:-11.9,z:0,w:2.5,d:2.7,h:1.26,type:'crate',asset:'Box_01' },
  { x:1,z:0,w:2.4,d:2.4,h:1.3,type:'crate',asset:'Box_01' },
  { x:23,z:0,w:3.8,d:4.5,h:3.5,type:'wall',asset:'Wall_03' },
  { x:18,z:-13.1,w:2.4,d:2.2,h:1.15,type:'crate',asset:'Box_01' },
  { x:18,z:13.1,w:2.4,d:2.2,h:1.15,type:'crate',asset:'Box_01' },
  { x:28.4,z:-18.7,w:2.1,d:2.6,h:1.25,type:'crate',asset:'Box_01' },
  { x:28.4,z:18.7,w:2.1,d:2.6,h:1.25,type:'crate',asset:'Box_01' },
  // Caixas de subida: primeiras plataformas baixas, seguidas de coberturas altas.
  { x:13.9,z:-22.95,w:2.6,d:1.4,h:1.2,type:'crate',asset:'Box_01' },
  { x:13.9,z:22.95,w:2.6,d:1.4,h:1.2,type:'crate',asset:'Box_01' },
  { x:29.1,z:-23.65,w:2,d:1.5,h:1.12,type:'crate',asset:'Box_01' },
  { x:29.1,z:23.65,w:2,d:1.5,h:1.12,type:'crate',asset:'Box_01' },
  { x:-11.9,z:-3.5,w:1.8,d:1.55,h:.75,type:'crate',asset:'Box_01' },
  { x:1,z:3.45,w:1.8,d:1.55,h:.68,type:'crate',asset:'Box_01' },
  // Cobertura interna leve, deixa o eixo central das portas desobstruído.
  ...OPEN_BUILDINGS.map(b=>({x:b.x+b.w*.23,z:b.z+(b.door==='south'?-1:1)*b.d*.25,w:1.18,d:1.0,h:.72,type:'crate',asset:'Box_01',interior:true})),
  ...OPEN_BUILDINGS.flatMap(buildingWalls),
];
export const JUMP = Object.freeze({speed:7.45, gravity:17.2, height:1.76});
export const SOLIDS = Object.freeze([...CRATES,...ROOFS]);
export const PLATFORMS = Object.freeze([...CRATES.filter(b=>b.type==='crate'),...ROOFS]);
export function siteAt(position, inset = .5) {
  return Object.values(SITES).find(site => distance2(position, site) <= site.radius - inset) ?? null;
}
// Catálogo original de armas. Preços e valores são exclusivos do VECTOR STRIKE.
export const WEAPONS = {
  pistol: { name: 'P320', subtitle: 'Pistola padrão', slot: 'sidearm', price: 0, category: 'GRÁTIS', damage: 32, headDamage: 90, magazine: 12, reserve: 36, fireMs: 250, reloadMs: 1300, range: 65, spread: .004, movementSpread: .018, sprintSpread: .026, crouchMultiplier: .65, recoil: .024, automatic: false, tint: '#a8cbd0' },
  heavyPistol: { name: 'Revolver .38', subtitle: 'Pistola pesada', slot: 'sidearm', price: 500, category: 'SECUNDÁRIA', damage: 57, headDamage: 150, magazine: 8, reserve: 24, fireMs: 410, reloadMs: 1750, range: 75, spread: .006, movementSpread: .021, sprintSpread: .031, crouchMultiplier: .62, recoil: .037, automatic: false, tint: '#e2b37e' },
  smg: { name: 'MPX', subtitle: 'Submetralhadora', slot: 'primary', price: 1200, category: 'ECO', damage: 20, headDamage: 54, magazine: 30, reserve: 90, fireMs: 85, reloadMs: 1650, range: 50, spread: .011, movementSpread: .019, sprintSpread: .032, crouchMultiplier: .64, recoil: .013, automatic: true, tint: '#75d9d6' },
  shotgun: { name: 'Breach 8', subtitle: 'Escopeta de curto alcance', slot: 'primary', price: 1600, category: 'CURTO ALCANCE', damage: 15, headDamage: 22, pellets: 8, magazine: 6, reserve: 24, fireMs: 780, reloadMs: 2450, range: 21, spread: .065, movementSpread: .022, sprintSpread: .028, crouchMultiplier: .7, recoil: .052, automatic: false, tint: '#e5ad7c' },
  rifle: { name: 'MDR', subtitle: 'Fuzil de assalto', slot: 'primary', price: 2800, category: 'PRECISÃO', damage: 33, headDamage: 158, magazine: 25, reserve: 75, fireMs: 124, reloadMs: 1950, range: 88, spread: .007, movementSpread: .023, sprintSpread: .035, crouchMultiplier: .55, recoil: .018, automatic: true, tint: '#85ebd1' },
  sniper: { name: 'SRSA1', subtitle: 'Rifle de precisão', slot: 'primary', price: 4600, category: 'LONGO ALCANCE', damage: 170, headDamage: 220, magazine: 5, reserve: 15, fireMs: 1500, reloadMs: 2850, range: 120, spread: .001, movementSpread: .075, sprintSpread: .075, crouchMultiplier: .5, recoil: .065, automatic: false, tint: '#cbb7ff' },
  // Novas armas equipadas com os modelos .glb do pacote Low Poly Firearms Bundle.
  p226: { name: 'P226', subtitle: 'Pistola semiautomática equilibrada', slot: 'sidearm', price: 400, category: 'PISTOLA', damage: 35, headDamage: 95, magazine: 15, reserve: 45, fireMs: 235, reloadMs: 1400, range: 68, spread: .0045, movementSpread: .018, sprintSpread: .028, crouchMultiplier: .65, recoil: .023, automatic: false, tint: '#93c9df' },
  sr1mp: { name: 'SR1MP', subtitle: 'Pistola tática de alto impacto', slot: 'sidearm', price: 650, category: 'PISTOLA', damage: 41, headDamage: 105, magazine: 12, reserve: 36, fireMs: 290, reloadMs: 1500, range: 72, spread: .005, movementSpread: .02, sprintSpread: .027, crouchMultiplier: .65, recoil: .031, automatic: false, tint: '#b0c5d9' },
  magnum: { name: 'Magnum', subtitle: 'Revólver de alto calibre', slot: 'sidearm', price: 900, category: 'REVÓLVER', damage: 70, headDamage: 165, magazine: 6, reserve: 18, fireMs: 600, reloadMs: 2100, range: 77, spread: .007, movementSpread: .024, sprintSpread: .035, crouchMultiplier: .6, recoil: .049, automatic: false, tint: '#dcb08a' },
  mpa: { name: 'MPA', subtitle: 'SMG leve, excelente em rush', slot: 'primary', price: 1000, category: 'SMG', damage: 18, headDamage: 50, magazine: 28, reserve: 84, fireMs: 77, reloadMs: 1600, range: 45, spread: .013, movementSpread: .017, sprintSpread: .03, crouchMultiplier: .67, recoil: .013, automatic: true, tint: '#8dcee6' },
  mpsd: { name: 'MPSD', subtitle: 'SMG com supressor integrado', slot: 'primary', price: 1650, category: 'SMG', damage: 23, headDamage: 59, magazine: 30, reserve: 90, fireMs: 95, reloadMs: 1700, range: 58, spread: .009, movementSpread: .017, sprintSpread: .026, crouchMultiplier: .62, recoil: .012, automatic: true, tint: '#85ccbc' },
  mk14: { name: 'MK14', subtitle: 'Rifle semiautomático preciso', slot: 'primary', price: 2650, category: 'RIFLE', damage: 43, headDamage: 125, magazine: 20, reserve: 60, fireMs: 245, reloadMs: 2200, range: 96, spread: .004, movementSpread: .029, sprintSpread: .045, crouchMultiplier: .56, recoil: .033, automatic: false, tint: '#b1d2b0' },
  m21: { name: 'M21 EBR', subtitle: 'Rifle de precisão semiautomático', slot: 'primary', price: 3500, category: 'DMR', damage: 60, headDamage: 150, magazine: 12, reserve: 36, fireMs: 400, reloadMs: 2500, range: 113, spread: .003, movementSpread: .035, sprintSpread: .055, crouchMultiplier: .52, recoil: .044, automatic: false, tint: '#c7c8a7' },
  chassis: { name: 'PR Chassis', subtitle: 'Rifle de precisão de ferrolho', slot: 'primary', price: 4150, category: 'SNIPER', damage: 145, headDamage: 205, magazine: 6, reserve: 18, fireMs: 1450, reloadMs: 2800, range: 120, spread: .0015, movementSpread: .07, sprintSpread: .07, crouchMultiplier: .52, recoil: .062, automatic: false, tint: '#d5b8e3' },
  rpg: { name: 'RPG Launcher', subtitle: 'Lançador explosivo especial (área)', slot: 'primary', price: 6200, category: 'ESPECIAL', damage: 118, headDamage: 118, blastRadius: 3.25, magazine: 1, reserve: 2, fireMs: 1250, reloadMs: 3500, range: 65, spread: .012, movementSpread: .04, sprintSpread: .06, crouchMultiplier: .7, recoil: .085, automatic: false, tint: '#ffc27d' },
};
export const ARMOR = {
  light: { name: 'Colete leve', price: 400, points: 25, subtitle: 'Absorve parte do dano' },
  heavy: { name: 'Colete reforçado', price: 1000, points: 50, subtitle: 'Máxima proteção disponível' },
};
export const ECONOMY = {
  initial: 800, max: 9000, kill: 200, plant: 300, defuse: 300,
  win: 3000, lossBase: 1900, lossStep: 500, lossMax: 2900,
};
export const GAME = {
  maxPlayers: 6,
  minPlayers: 2,
  scoreToWin: 5,
  prepareMs: 30000,
  roundMs: 90000,
  plantMs: 3200,
  defuseMs: 5000,
  bombMs: 35000,
  pickupMs: 500,
  pickupRadius: 1.9,
  roundEndMs: 5600,
  matchEndMs: 10500,
  playerRadius: 0.43,
};

// Falloff linear simples para explosivos, usado exclusivamente pelo servidor.
export function explosionDamage(distance, radius, peakDamage) {
  if (!Number.isFinite(distance) || !Number.isFinite(radius) || radius <= 0 || distance > radius) return 0;
  return Math.max(0, Math.round(peakDamage * (1 - .7 * distance / radius)));
}

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const distance2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Colisão por volume do personagem. Feet/Y = altura dos pés, não dos olhos.
// O teste 2D legado continua válido (bots usam altura zero).
export function collides(x,z,radius=GAME.playerRadius,feet=0,height=JUMP.height) {
  if (Math.abs(x)>ARENA.halfWidth-.75-radius || Math.abs(z)>ARENA.halfDepth-.75-radius) return true;
  return SOLIDS.some(b=>{
    const bottom=b.y??0,top=bottom+b.h;
    if(feet>=top-.025 || feet+height<=bottom+.025)return false;
    const nearestX=clamp(x,b.x-b.w/2,b.x+b.w/2);
    const nearestZ=clamp(z,b.z-b.d/2,b.z+b.d/2);
    return (x-nearestX)**2+(z-nearestZ)**2 < radius**2;
  });
}
export function movePlayer(position,input,yaw,seconds){
  const forward=Number(!!input.forward)-Number(!!input.back);
  const strafe=Number(!!input.right)-Number(!!input.left);
  const magnitude=Math.hypot(forward,strafe);
  if(!magnitude)return {x:position.x,z:position.z};
  const speed=input.crouch?2.35:(input.sprint?6.35:4.6);
  const step=Math.min(seconds,.1)*speed/magnitude;
  const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*strafe)*step;
  const dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*strafe)*step;
  const feet=position.y??0;
  let x=position.x,z=position.z;
  if(!collides(x+dx,z,GAME.playerRadius,feet))x+=dx;
  if(!collides(x,z+dz,GAME.playerRadius,feet))z+=dz;
  return {x,z};
}
function overlappingPlatform(x,z,box,radius){
  const nearestX=clamp(x,box.x-box.w/2,box.x+box.w/2);
  const nearestZ=clamp(z,box.z-box.d/2,box.z+box.d/2);
  return (x-nearestX)**2+(z-nearestZ)**2 < radius**2;
}
// Física determinística e compartilhada entre cliente (predição) e servidor (autoridade).
export function stepPlayerMotion(state,input,yaw,seconds){
  const dt=clamp(seconds,0,.05),feet=state.y??0;
  let vy=state.vy??0,grounded=state.grounded??feet<=.001;
  const pressed=!!input.jump;
  if(pressed&&!state.jumpHeld&&grounded){vy=JUMP.speed;grounded=false;}
  if(!grounded)vy-=JUMP.gravity*dt;
  const moved=movePlayer({...state,y:feet},input,yaw,dt);
  let y=feet+(grounded?0:vy*dt);
  if(y<=0){y=0;vy=0;grounded=true;}
  // Só aterrissa em plataformas atravessadas de cima para baixo.
  if(vy<=0){
    for(const b of PLATFORMS){
      const top=(b.y??0)+b.h;
      if(feet>=top-.045&&y<=top&&overlappingPlatform(moved.x,moved.z,b,GAME.playerRadius)){
        y=top;vy=0;grounded=true;break;
      }
    }
  }
  // Saindo da borda de uma plataforma, o jogador passa a cair.
  if(grounded&&y>0&&!PLATFORMS.some(b=>Math.abs((b.y??0)+b.h-y)<.045 && overlappingPlatform(moved.x,moved.z,b,GAME.playerRadius))){grounded=false;}
  return {...moved,y,vy,grounded,jumpHeld:pressed};
}

export function forwardDirection(yaw, pitch) {
  const c = Math.cos(pitch);
  return { x: -Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c };
}

// Distância até a primeira interseção com uma caixa alinhada aos eixos.
export function rayBox(origin, direction, box, maxDistance = Infinity) {
  let tmin = 0, tmax = maxDistance;
  const min = { x: box.x - box.w / 2, y: box.y ?? 0, z: box.z - box.d / 2 };
  const max = { x: box.x + box.w / 2, y: (box.y ?? 0) + box.h, z: box.z + box.d / 2 };
  for (const axis of ['x','y','z']) {
    if (Math.abs(direction[axis]) < 1e-9) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null;
    } else {
      let a = (min[axis] - origin[axis]) / direction[axis];
      let b = (max[axis] - origin[axis]) / direction[axis];
      if (a > b) [a,b] = [b,a];
      tmin = Math.max(tmin, a); tmax = Math.min(tmax, b);
      if (tmax < tmin) return null;
    }
  }
  return tmin;
}

export function raySphere(origin, direction, center, radius) {
  const ox = origin.x - center.x, oy = origin.y - center.y, oz = origin.z - center.z;
  const b = ox * direction.x + oy * direction.y + oz * direction.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const d = b*b - c;
  if (d < 0) return null;
  const t = -b - Math.sqrt(d);
  if (t >= 0) return t;
  const t2 = -b + Math.sqrt(d);
  return t2 >= 0 ? t2 : null;
}

// Dispersão calculada e aplicada pelo servidor — nunca depende do ângulo alterado pelo cliente.
// randomX e randomY são amostras em [-1,1], geradas no servidor para cada tiro.
export function spreadFor(weapon, input = {}, consecutiveShots = 0) {
  const w = WEAPONS[weapon];
  if (!w) return 0;
  const moving = !!(input.forward || input.back || input.left || input.right);
  let spread = w.spread + (moving ? w.movementSpread : 0) + (input.sprint && moving ? w.sprintSpread : 0);
  if (input.crouch && !input.sprint) spread *= w.crouchMultiplier;
  if (input.aim && !moving) spread *= .65;
  return spread + Math.min(consecutiveShots, 9) * w.recoil * .13;
}
export function spreadDirection(yaw, pitch, spread, randomX = 0, randomY = 0) {
  return forwardDirection(yaw + randomX * spread, clamp(pitch + randomY * spread, -1.53, 1.53));
}
export function canPickupBomb(player, bomb) {
  return player.alive && player.team === 'attackers' && bomb.state === 'dropped' && distance2(player, bomb) <= GAME.pickupRadius;
}
