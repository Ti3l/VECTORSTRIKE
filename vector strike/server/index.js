import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ARENA, CRATES, ROOFS, GAME, SITE, SITES, siteAt, SPAWNS, WEAPONS, ECONOMY,
  clamp, collides, distance2, stepPlayerMotion, rayBox, raySphere, spreadFor, spreadDirection, canPickupBomb, explosionDamage,
} from '../src/shared.js';
import { initializeEconomy, prepareRoundEquipment, ownsWeapon, purchase, refund, addCredits, roundIncome, applyArmorDamage } from '../src/economy.js';
import { BOT_MAX, trainingOptions, prepareBot, updateBot } from '../src/bots.js';
import { normalizeName, nameKey, selectTeam, canStartParty, publicPartyState } from '../src/lobby.js';
import { canSendSnapshot, SNAPSHOT_INTERVAL_MS } from '../src/net-stats.js';
import { parseAllowedOrigins, isAllowedOrigin } from './origin-policy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 3001);
// Para testes publicados por Tunnel, aceitamos conexoes apenas do proprio computador.
// Em hospedagens como Render, o padrao 0.0.0.0 segue obrigatorio.
const HOST = process.env.HOST || '0.0.0.0';
// Restrinja acesso por origem quando ALLOWED_ORIGINS estiver configurado.
// Ex.: https://seu-jogo.vercel.app,https://www.seudominio.com
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
const rooms = new Map();
const invites = new Map(); // token -> convite temporário validado pelo servidor
let nextId = 1;
const now = () => Date.now();

function send(ws, value) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value));
}
function broadcast(room, data) {
  for (const player of room.players.values()) if (!player.isBot) send(player.ws, data);
}
function code() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value;
  do { value = Array.from({ length: 5 }, () => alphabet[crypto.randomInt(alphabet.length)]).join(''); }
  while (rooms.has(value));
  return value;
}
function createRoom(mode = 'private', options = {}) {
  const room = {
    code: code(), players: new Map(), phase: 'waiting', round: 0,
    mode, ownerId: null, botCount: options.botCount ?? 0, difficulty: options.difficulty ?? 'normal',
    scores: { attackers: 0, defenders: 0 }, deadline: 0,
    winner: null, reason: '', bomb: { state: 'idle', carrier: null, x: SITE.x, z: SITE.z, deadline: 0 },
    lastBroadcast: 0, lossStreak: { attackers: 0, defenders: 0 },
  };
  rooms.set(room.code, room);
  return room;
}
function teamCount(room, team) {
  return [...room.players.values()].filter(p => p.team === team).length;
}
function enoughPlayers(room) {
  return room.players.size >= GAME.minPlayers && teamCount(room, 'attackers') > 0 && teamCount(room, 'defenders') > 0;
}
function spawn(player, room) {
  const teammates = [...room.players.values()].filter(p => p.team === player.team);
  const index = Math.max(0, teammates.indexOf(player)) % SPAWNS[player.team].length;
  const point = SPAWNS[player.team][index];
  player.x = point.x; player.z = point.z;
  player.y=0; player.vy=0; player.grounded=true; player.jumpHeld=false;
  player.yaw = player.team === 'attackers' ? -Math.PI / 2 : Math.PI / 2;
  player.pitch = 0;
  prepareRoundEquipment(player);
  if (player.isBot) prepareBot(player);
  player.alive = true; player.health = 100;
  player.reloadEnd = 0; player.reloadWeapon = null;
  player.nextShot = 0; player.lastFiredAt = 0; player.consecutiveShots = 0;
  player.input = {};
  player.useStarted = 0; player.useKind = null; player.useProgress = 0;
}
function roundStart(room, t) {
  if (!enoughPlayers(room)) { room.phase = 'waiting'; return; }
  room.round += 1;
  room.phase = 'prepare';
  room.deadline = t + (room.mode === 'training' ? 22000 : GAME.prepareMs);
  room.winner = null; room.reason = '';
  for (const p of room.players.values()) {
    // Créditos de treino: libere o arsenal inteiro sem interferir na economia multiplayer.
    if (room.mode === 'training' && !p.isBot) p.credits = ECONOMY.max;
    spawn(p, room);
  }
  const attacker = [...room.players.values()].find(p => p.team === 'attackers');
  room.bomb = { state: 'carried', carrier: attacker?.id ?? null, x: attacker?.x ?? SITE.x, z: attacker?.z ?? SITE.z, deadline: 0 };
  broadcast(room, { type: 'event', kind: 'round', text: `ROUND ${room.round} • PREPARAÇÃO` });
}
function resolveRound(room, team, reason, t) {
  if (room.phase !== 'live') return;
  room.phase = 'roundEnd';
  room.winner = team;
  room.reason = reason;
  room.scores[team] += 1;
  const income = roundIncome(room, team);
  room.deadline = t + GAME.roundEndMs;
  broadcast(room, { type: 'event', kind: 'result', winner: team, reason, income });
}
function evaluateEliminations(room, t) {
  if (room.phase !== 'live') return;
  const aliveA = [...room.players.values()].some(p => p.team === 'attackers' && p.alive);
  const aliveD = [...room.players.values()].some(p => p.team === 'defenders' && p.alive);
  if (!aliveD) resolveRound(room, 'attackers', 'Defensores eliminados', t);
  else if (!aliveA && room.bomb.state !== 'planted') resolveRound(room, 'defenders', 'Atacantes eliminados', t);
}
function updateInteractions(room, t) {
  for (const p of room.players.values()) {
    let kind = null;
    if (p.alive && room.phase === 'live' && p.input.interact) {
      if (p.team === 'attackers' && room.bomb.state === 'carried' && room.bomb.carrier === p.id) {
        const site = siteAt(p);
        if (site) kind = `plant:${site.id}`;
      }
      if (p.team === 'defenders' && room.bomb.state === 'planted' && distance2(p, room.bomb) <= 2.7) kind = 'defuse';
      if (canPickupBomb(p, room.bomb)) kind = 'pickup';
    }
    if (kind !== p.useKind) { p.useKind = kind; p.useStarted = kind ? t : 0; }
    const duration = kind?.startsWith('plant:') ? GAME.plantMs : kind === 'pickup' ? GAME.pickupMs : GAME.defuseMs;
    p.useProgress = kind ? clamp((t - p.useStarted) / duration, 0, 1) : 0;
    if (p.useProgress < 1) continue;
    p.useKind = null; p.useStarted = 0; p.useProgress = 0;
    if (kind?.startsWith('plant:')) {
      const plantedSite = kind.slice(6);
      room.bomb = { state: 'planted', carrier: null, site: plantedSite, x: p.x, z: p.z, deadline: t + GAME.bombMs };
      for (const ally of room.players.values()) if (ally.team === 'attackers') addCredits(ally, ECONOMY.plant);
      broadcast(room, { type: 'event', kind: 'plant', text: `${p.name} plantou no SITE ${plantedSite}! (+${ECONOMY.plant} para ataque)` });
    } else if (kind === 'pickup') {
      room.bomb = { state: 'carried', carrier: p.id, x: p.x, z: p.z, deadline: 0 };
      broadcast(room, { type: 'event', kind: 'pickup', text: `${p.name} recuperou a bomba` });
    } else if (kind === 'defuse') {
      room.bomb.state = 'defused';
      for (const ally of room.players.values()) if (ally.team === 'defenders') addCredits(ally, ECONOMY.defuse);
      resolveRound(room, 'defenders', 'Bomba desarmada', t);
    }
  }
}
function updateRoom(room, seconds, t) {
  if (room.phase === 'lobby') return; // o grupo só começa quando o líder autoriza
  if (!enoughPlayers(room)) {
    if (room.phase !== 'waiting') {
      room.phase = 'waiting'; room.deadline = 0;
      broadcast(room, { type: 'event', kind: 'info', text: 'Aguardando jogadores das duas equipes…' });
    }
  } else if (room.phase === 'waiting') roundStart(room, t);
  if (room.phase === 'prepare' && t >= room.deadline) {
    room.phase = 'live'; room.deadline = t + GAME.roundMs;
    broadcast(room, { type: 'event', kind: 'live', text: 'ROUND INICIADO' });
  }
  if (room.phase === 'roundEnd' && t >= room.deadline) {
    if (Math.max(...Object.values(room.scores)) >= GAME.scoreToWin) {
      room.phase = 'matchEnd'; room.deadline = t + GAME.matchEndMs;
      broadcast(room, { type: 'event', kind: 'match', winner: room.scores.attackers > room.scores.defenders ? 'attackers' : 'defenders' });
    } else roundStart(room, t);
  }
  if (room.phase === 'matchEnd' && t >= room.deadline) {
    room.scores = { attackers: 0, defenders: 0 }; room.round = 0;
    room.lossStreak = { attackers: 0, defenders: 0 };
    for (const p of room.players.values()) { initializeEconomy(p); p.alive = false; p.ready = false; }
    if (room.mode === 'party') {
      room.phase = 'lobby'; room.deadline = 0;
      for (const p of room.players.values()) send(p.ws, { type: 'partyReturned' });
      notifyParty(room); notifyPresence();
    } else roundStart(room, t);
  }
  for (const p of room.players.values()) {
    if (p.reloadEnd && t >= p.reloadEnd) {
      const w = p.reloadWeapon;
      if (w && p.alive) {
        const count = Math.min(WEAPONS[w].magazine - p.mag[w], p.reserve[w]);
        p.mag[w] += count; p.reserve[w] -= count;
      }
      p.reloadEnd = 0; p.reloadWeapon = null;
    }
    if (!p.alive || (room.phase !== 'live' && room.phase !== 'waiting')) continue;
    if (t - p.lastInput > 500) p.input = {};
    if(p.isBot)continue; // Bots usam o próprio motor de navegação horizontal.
    const newPos = stepPlayerMotion(p,p.input,p.yaw,seconds);
    p.x=newPos.x;p.z=newPos.z;p.y=newPos.y;
    p.vy=newPos.vy;p.grounded=newPos.grounded;p.jumpHeld=newPos.jumpHeld;
    if (room.bomb.state === 'carried' && room.bomb.carrier === p.id) { room.bomb.x = p.x; room.bomb.z = p.z; }
  }
  if (room.mode === 'training' && room.phase === 'live') {
    for (const bot of room.players.values()) {
      if (bot.isBot) updateBot(bot, room, seconds, t, onShoot, onReload);
    }
  }
  if (room.phase === 'live') {
    if (room.bomb.state === 'planted') {
      if (t >= room.bomb.deadline) {
        room.bomb.state = 'exploded';
        resolveRound(room, 'attackers', 'Bomba detonada', t);
      }
    } else if (t >= room.deadline) resolveRound(room, 'defenders', 'Tempo esgotado', t);
    updateInteractions(room, t);
    evaluateEliminations(room, t);
  }
  if (t - room.lastBroadcast >= SNAPSHOT_INTERVAL_MS) {
    room.lastBroadcast = t;
    const players = [...room.players.values()].map(p => ({
      id: p.id, name: p.name, team: p.team, isBot: !!p.isBot, x: p.x, y: p.y??0, z: p.z,
      yaw: p.yaw, pitch: p.pitch, alive: p.alive, health: p.health,
      kills: p.kills, deaths: p.deaths, weapon: p.weapon, mag: p.mag,
      reserve: p.reserve, reloading: !!p.reloadEnd,
      useKind: p.useKind, useProgress: p.useProgress,
      crouch: !!p.input.crouch, credits: p.credits, armor: p.armor, armorMax: p.armorMax,
      inventory: p.inventory, bought: Object.fromEntries(Object.entries(p.buyLedger || {}).map(([slot,entry]) => [slot, entry.cost])),
    }));
    const snapshot = {
      type: 'snapshot', serverTime: t, phase: room.phase, deadline: room.deadline,
      scores: room.scores, round: room.round, winner: room.winner, reason: room.reason, mode: room.mode, difficulty: room.difficulty,
      bomb: room.bomb, players,
    };
    // Serializa uma unica vez; descarta apenas snapshots obsoletos quando
    // a fila do socket estiver congestionada. Eventos e compras seguem intactos.
    const payload = JSON.stringify(snapshot);
    for (const player of room.players.values()) {
      if (player.isBot) continue;
      if (canSendSnapshot(player.ws, WebSocket.OPEN)) player.ws.send(payload);
    }
  }
}
function findLineHit(room, shooter, direction, origin, range) {
  const blockers = [
    ...CRATES, ...ROOFS,
    { x: 0, z: -ARENA.halfDepth, w: ARENA.halfWidth * 2, d: 1, h: ARENA.wallHeight },
    { x: 0, z: ARENA.halfDepth, w: ARENA.halfWidth * 2, d: 1, h: ARENA.wallHeight },
    { x: -ARENA.halfWidth, z: 0, w: 1, d: ARENA.halfDepth * 2, h: ARENA.wallHeight },
    { x: ARENA.halfWidth, z: 0, w: 1, d: ARENA.halfDepth * 2, h: ARENA.wallHeight },
  ];
  let closest = range;
  for (const box of blockers) {
    const hit = rayBox(origin, direction, box, closest);
    if (hit !== null && hit < closest) closest = hit;
  }
  let target = null, headshot = false;
  for (const p of room.players.values()) {
    if (!p.alive || p.team === shooter.team) continue;
    const head = raySphere(origin, direction, { x: p.x, y: (p.y??0)+(p.input.crouch ? 1.14 : 1.58), z: p.z }, .30);
    const body = raySphere(origin, direction, { x: p.x, y: (p.y??0)+(p.input.crouch ? .67 : .98), z: p.z }, .59);
    const hasHead = head !== null && head <= closest && (body === null || head <= body);
    const dist = hasHead ? head : body;
    if (dist !== null && dist < closest) { closest = dist; target = p; headshot = hasHead; }
  }
  return { target, distance: closest, headshot };
}
function onShoot(room, p, data, t) {
  if (!p.alive || room.phase !== 'live' || p.reloadEnd || t < p.nextShot || !ownsWeapon(p, p.weapon)) return;
  const w = WEAPONS[p.weapon];
  p.nextShot = t + w.fireMs;
  if (!p.mag[p.weapon]) {
    send(p.ws, { type: 'event', kind: 'empty', text: 'Sem munição — pressione R' });
    return;
  }
  p.mag[p.weapon]--;
  p.consecutiveShots = t - p.lastFiredAt <= 460 ? p.consecutiveShots + 1 : 0;
  p.lastFiredAt = t;
  // Posição, preço de armas, cadência, armadura e dano são validados pelo servidor.
  const yaw = Number.isFinite(data.yaw) ? clamp(data.yaw, -Math.PI * 500, Math.PI * 500) : p.yaw;
  const pitch = Number.isFinite(data.pitch) ? clamp(data.pitch, -1.53, 1.53) : p.pitch;
  p.yaw = yaw; p.pitch = pitch;
  const origin = { x: p.x, y:(p.y??0)+(p.input.crouch ? 1.12 : 1.57), z: p.z };
  const spread = spreadFor(p.weapon, p.input, p.consecutiveShots);
  const pelletCount = w.pellets || 1;
  let primaryHit = null;
  let tracerDistance = w.range;
  let tracerDirection = null;
  const victims = new Set();
  const hitTarget = (target, damage, headshot = false) => {
    if (!target?.alive || damage <= 0) return;
    if (!primaryHit) primaryHit = { id: target.id, headshot };
    const result = applyArmorDamage(target, damage);
    if (result.killed && !victims.has(target.id)) {
      victims.add(target.id);
      target.alive = false; target.deaths++; p.kills++;
      addCredits(p, ECONOMY.kill);
      target.input = {};
      if (room.bomb.state === 'carried' && room.bomb.carrier === target.id) {
        room.bomb = { state: 'dropped', carrier: null, x: target.x, z: target.z, deadline: 0 };
        broadcast(room, { type: 'event', kind: 'drop', text: 'Bomba caída! Recupere no chão.' });
      }
      broadcast(room, { type: 'event', kind: 'kill', killer: p.name, victim: target.name, headshot, reward: ECONOMY.kill });
    }
  };
  if (w.blastRadius) {
    // Projétil especial: trajetória, ponto de impacto e dano radial só no servidor.
    // O cálculo é instantâneo nesta versão (não existe física de foguete em voo).
    const direction = spreadDirection(yaw, pitch, spread, Math.random() * 2 - 1, Math.random() * 2 - 1);
    const hit = findLineHit(room, p, direction, origin, w.range);
    tracerDirection = direction;
    tracerDistance = hit.distance;
    const impact = {
      x: origin.x + direction.x * hit.distance,
      y: origin.y + direction.y * hit.distance,
      z: origin.z + direction.z * hit.distance,
    };
    // Um alvo protegido atrás de uma caixa não recebe o dano radial.
    const barriers = [...CRATES,...ROOFS,
      { x: 0, z: -ARENA.halfDepth, w: ARENA.halfWidth * 2, d: 1, h: ARENA.wallHeight },
      { x: 0, z: ARENA.halfDepth, w: ARENA.halfWidth * 2, d: 1, h: ARENA.wallHeight },
      { x: -ARENA.halfWidth, z: 0, w: 1, d: ARENA.halfDepth * 2, h: ARENA.wallHeight },
      { x: ARENA.halfWidth, z: 0, w: 1, d: ARENA.halfDepth * 2, h: ARENA.wallHeight },
    ];
    for (const target of room.players.values()) {
      if (!target.alive || target.team === p.team) continue;
      const center = { x: target.x, y: (target.y??0)+(target.input.crouch ? .90 : 1.18), z: target.z };
      const delta = { x: center.x - impact.x, y: center.y - impact.y, z: center.z - impact.z };
      const distance = Math.hypot(delta.x, delta.y, delta.z);
      if (distance >= w.blastRadius + .4) continue;
      // Alvo atingido diretamente pelo foguete é sempre visível para a explosão.
      if (hit.target !== target && distance > .001) {
        const ray = { x: delta.x / distance, y: delta.y / distance, z: delta.z / distance };
        const blocked = barriers.some(box => {
          const d = rayBox({ x: impact.x + ray.x * .08, y: impact.y + ray.y * .08, z: impact.z + ray.z * .08 },ray,box,distance - .15);
          return d !== null && d < distance - .2;
        });
        if (blocked) continue;
      }
      hitTarget(target, explosionDamage(Math.max(0,distance - .4), w.blastRadius, w.damage));
    }
    broadcast(room, { type: 'blast', x: impact.x, y: impact.y, z: impact.z, radius: w.blastRadius });
  } else {
    for (let pellet = 0; pellet < pelletCount; pellet++) {
      const direction = spreadDirection(yaw, pitch, spread, Math.random() * 2 - 1, Math.random() * 2 - 1);
      const hit = findLineHit(room, p, direction, origin, w.range);
      if (!tracerDirection) { tracerDirection = direction; tracerDistance = hit.distance; }
      if (hit.target) hitTarget(hit.target, hit.headshot ? w.headDamage : w.damage, hit.headshot);
    }
  }
  broadcast(room, { type: 'shot', shooter: p.id, x: origin.x, y: origin.y, z: origin.z,
    dx: tracerDirection.x, dy: tracerDirection.y, dz: tracerDirection.z, distance: tracerDistance,
    hitId: primaryHit?.id ?? null, headshot: primaryHit?.headshot ?? false,
    killed: victims.size > 0, weapon: p.weapon });
  if (victims.size) evaluateEliminations(room, t);
}
function onReload(p, t) {
  if (!p.alive || p.reloadEnd) return;
  const weapon = p.weapon;
  if (p.reserve[weapon] === 0 || p.mag[weapon] >= WEAPONS[weapon].magazine) return;
  p.reloadWeapon = weapon;
  p.reloadEnd = t + WEAPONS[weapon].reloadMs;
  send(p.ws, { type: 'event', kind: 'reload', text: 'Recarregando…' });
}
function disconnect(ws) {
  const room = ws.room;
  const player = ws.player;
  if (room && player && room.players.has(player.id)) {
    room.players.delete(player.id);
    if (room.mode === 'training') rooms.delete(room.code);
    else {
      broadcast(room, { type: 'event', kind: 'info', text: `${player.name} saiu da sala` });
      if (room.bomb.carrier === player.id && room.bomb.state === 'carried') {
        room.bomb = { state: 'dropped', carrier: null, x: player.x, z: player.z, deadline: 0 };
        broadcast(room, { type: 'event', kind: 'drop', text: 'Portador saiu — bomba caiu no chão' });
      }
      if (room.ownerId === player.id) room.ownerId = room.players.keys().next().value ?? null;
      if (room.players.size === 0) rooms.delete(room.code);
      else if (room.mode === 'party' && room.phase === 'lobby') notifyParty(room);
    }
  }
  ws.player = null; ws.room = null; ws.profile = null;
  for (const [token, invite] of invites) if (invite.to === player?.id || invite.from === player?.id) invites.delete(token);
  notifyPresence();
}
function createBot(room, i) {
  const p = {
    id: `bot-${room.code}-${i+1}`, ws: null, isBot: true, name: `BOT ${String(i+1).padStart(2, '0')}`,
    team: 'defenders', x: 0, z: 0, yaw: 0, pitch: 0, alive: false, health: 100,
    kills: 0, deaths: 0, weapon: 'rifle', mag: {}, reserve: {}, input: {},
    lastInput: now(), nextShot: 0, lastFiredAt: 0, consecutiveShots: 0,
    reloadEnd: 0, reloadWeapon: null, useKind: null, useStarted: 0, useProgress: 0,
  };
  initializeEconomy(p);
  room.players.set(p.id, p);
  return p;
}
function resetTraining(room, t) {
  if (room.mode !== 'training') return;
  room.scores = { attackers: 0, defenders: 0 };
  room.round = 0;
  room.lossStreak = { attackers: 0, defenders: 0 };
  for (const p of room.players.values()) {
    initializeEconomy(p);
    p.kills = 0; p.deaths = 0; p.alive = false; p.health = 0;
  }
  roundStart(room, t);
  broadcast(room, { type: 'event', kind: 'info', text: 'Treino reiniciado — armamentos e economia zerados.' });
}
// ---------- Lobby social: perfis temporários por conexão e convites ----------
function lobbyError(ws, message) { send(ws, { type: 'partyError', message }); }
function liveProfiles() {
  return [...wss.clients].filter(ws => ws.profile && ws.readyState === WebSocket.OPEN);
}
function notifyPresence() {
  const online = liveProfiles().map(ws => ({
    id: ws.profile.id, name: ws.profile.name,
    status: ws.room?.phase === 'lobby' ? 'lobby' : 'playing',
    partySize: ws.room?.mode === 'party' ? ws.room.players.size : 0,
  }));
  for (const ws of liveProfiles()) send(ws, { type: 'presence', online });
}
function notifyParty(room) {
  if (room.mode !== 'party') return;
  const state = publicPartyState(room);
  for (const p of room.players.values()) if (!p.isBot) send(p.ws, { type: 'partyState', ...state });
}
function makeLobbyPlayer(ws, room) {
  const player = {
    id: ws.profile.id, ws, name: ws.profile.name,
    team: selectTeam(room.players.values()), ready: false,
    x: 0, z: 0, yaw: 0, pitch: 0, alive: false, health: 100,
    kills: 0, deaths: 0, weapon: 'pistol', mag: {}, reserve: {}, input: {},
    lastInput: now(), nextShot: 0, lastFiredAt: 0, consecutiveShots: 0,
    reloadEnd: 0, reloadWeapon: null, useKind: null, useStarted: 0, useProgress: 0,
  };
  initializeEconomy(player);
  room.players.set(player.id, player); ws.room = room; ws.player = player;
  return player;
}
function createSoloParty(ws) {
  const room = createRoom('party'); room.phase = 'lobby';
  const player = makeLobbyPlayer(ws, room); room.ownerId = player.id;
  notifyParty(room); return room;
}
function registerLobby(ws, data) {
  if (ws.profile || ws.room) return lobbyError(ws, 'Você já está conectado a uma sala.');
  const name = normalizeName(data.name);
  if (name.length < 2) return lobbyError(ws, 'Escolha um nome com pelo menos 2 caracteres.');
  if (liveProfiles().some(other => nameKey(other.profile.name) === nameKey(name))) {
    return lobbyError(ws, 'Este nome já está online. Escolha outro codinome.');
  }
  ws.profile = { id: String(nextId++), name };
  createSoloParty(ws);
  send(ws, { type: 'lobbyWelcome', id: ws.profile.id, name });
  notifyParty(ws.room); notifyPresence();
}
function detachParty(ws) {
  const room = ws.room;
  if (!room || room.mode !== 'party' || !ws.player) return;
  const player = ws.player;
  room.players.delete(player.id);
  if (room.ownerId === player.id) room.ownerId = room.players.keys().next().value ?? null;
  if (room.players.size === 0) rooms.delete(room.code);
  else if (room.phase === 'lobby') notifyParty(room);
  ws.room = null; ws.player = null;
}
function transferToParty(ws, targetRoom) {
  if (!ws.profile || !targetRoom || targetRoom.mode !== 'party' || targetRoom.phase !== 'lobby') {
    return lobbyError(ws, 'Grupo não está mais disponível.');
  }
  if (targetRoom.players.size >= GAME.maxPlayers) return lobbyError(ws, 'Grupo cheio (limite de 6 jogadores).');
  if (ws.room === targetRoom) return lobbyError(ws, 'Você já está nesse grupo.');
  if (ws.room && ws.room.phase !== 'lobby') return lobbyError(ws, 'Saia da partida antes de trocar de grupo.');
  detachParty(ws);
  makeLobbyPlayer(ws, targetRoom);
  notifyParty(targetRoom); notifyPresence();
  send(ws, { type: 'partyNotice', message: 'Você entrou no grupo! Marque PRONTO quando estiver preparado.' });
}
function partyInvite(ws, data) {
  const room = ws.room;
  if (!ws.profile || room?.mode !== 'party' || room.phase !== 'lobby') return lobbyError(ws, 'Entre no lobby antes de convidar.');
  if (room.players.size >= GAME.maxPlayers) return lobbyError(ws, 'Seu grupo já está cheio.');
  const targetName = nameKey(data.name);
  const target = liveProfiles().find(other => nameKey(other.profile.name) === targetName);
  if (!target || target === ws) return lobbyError(ws, 'Jogador não encontrado online. Confira o nome.');
  if (target.room?.phase !== 'lobby') return lobbyError(ws, 'Esse jogador está em uma partida.');
  if (target.room === room) return lobbyError(ws, 'Esse jogador já está em seu grupo.');
  if (ws.lastInviteAt && now() - ws.lastInviteAt < 1800) return lobbyError(ws, 'Aguarde um instante entre convites.');
  ws.lastInviteAt = now();
  // Invalida convites antigos do mesmo remetente para o mesmo destinatário.
  for (const [token, invite] of invites) if (invite.from === ws.profile.id && invite.to === target.profile.id) invites.delete(token);
  const token = crypto.randomBytes(18).toString('hex');
  invites.set(token, { from: ws.profile.id, to: target.profile.id, room: room.code, expires: now() + 60000 });
  send(target, { type: 'partyInvite', token, from: ws.profile.name, count: room.players.size });
  send(ws, { type: 'partyNotice', message: `Convite enviado para ${target.profile.name}.` });
}
function partyRespond(ws, data) {
  const token = String(data.token || '').slice(0, 64);
  const invite = invites.get(token);
  if (!invite || invite.to !== ws.profile?.id) return lobbyError(ws, 'Convite inválido ou expirado.');
  invites.delete(token);
  if (invite.expires < now()) return lobbyError(ws, 'Convite expirou. Solicite outro convite.');
  if (data.accept !== true) return send(ws, { type: 'partyNotice', message: 'Convite recusado.' });
  const room = rooms.get(invite.room);
  if (!room?.players.has(invite.from)) return lobbyError(ws, 'O jogador que convidou não está mais nesse grupo.');
  transferToParty(ws, room);
}
function partyLinkJoin(ws, data) {
  const key = String(data.room || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 5);
  if (key.length !== 5) return lobbyError(ws, 'Link de convite inválido.');
  transferToParty(ws, rooms.get(key));
}
function partyAction(ws, data) {
  const room = ws.room, player = ws.player;
  if (!ws.profile || room?.mode !== 'party' || !player) return lobbyError(ws, 'Entre em um grupo antes de continuar.');
  if (data.type === 'partyBack') {
    if (room.phase !== 'lobby') return lobbyError(ws, 'Não é possível trocar grupos durante o combate.');
    detachParty(ws); createSoloParty(ws); notifyPresence(); return;
  }
  if (data.type === 'partyReturn') {
    if (room.phase === 'lobby') return;
    if (room.ownerId !== player.id) {
      // Participantes saem individualmente; o host pode reunir todos novamente.
      detachParty(ws); createSoloParty(ws); send(ws,{type:'partyReturned'}); notifyPresence();return;
    }
    room.phase = 'lobby'; room.round = 0; room.deadline = 0;
    room.scores = { attackers: 0, defenders: 0 }; room.lossStreak = { attackers: 0, defenders: 0 };
    for (const member of room.players.values()) {
      member.ready = false; member.alive = false; initializeEconomy(member);
      send(member.ws, { type: 'partyReturned' });
    }
    notifyParty(room); notifyPresence(); return;
  }
  if (room.phase !== 'lobby') return lobbyError(ws, 'A partida já começou.');
  if (data.type === 'partyReady') {
    player.ready = !!data.ready;
  } else if (data.type === 'partyTeam') {
    const team = data.team;
    if (!['attackers','defenders'].includes(team)) return;
    if (team !== player.team && teamCount(room, team) >= 3) return lobbyError(ws, 'Equipe cheia (máximo de 3).');
    player.team = team; player.ready = false;
  } else if (data.type === 'partyStart') {
    if (room.ownerId !== player.id) return lobbyError(ws, 'Somente o líder pode iniciar a partida.');
    const result = canStartParty(room, GAME.maxPlayers);
    if (!result.ok) return lobbyError(ws, result.reason);
    room.phase = 'waiting';
    for (const p of room.players.values()) {
      send(p.ws, { type: 'joined', id: p.id, code: room.code, team: p.team, name: p.name, mode: 'party' });
    }
    roundStart(room, now());
  }
  notifyParty(room);
  notifyPresence();
}
function join(ws, data) {
  if (ws.room || ws.profile) return send(ws, { type: 'error', message: 'Você já está em uma sala.' });
  const desiredCode = String(data.room || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 5);
  const requestedMode = data.mode === 'training' && !desiredCode ? 'training' : 'private';
  const options = trainingOptions(data);
  const room = desiredCode ? rooms.get(desiredCode) : createRoom(requestedMode, options);
  if (!room) return send(ws, { type: 'error', message: 'Sala não encontrada. Confira o código.' });
  if (room.mode === 'party') return send(ws, { type: 'error', message: 'Este grupo usa convites do lobby. Entre pelo link de amigos.' });
  if (room.mode === 'training' && desiredCode) return send(ws, { type: 'error', message: 'Esta é uma sala pessoal de treino. Crie sua própria sala com bots.' });
  if (room.players.size >= GAME.maxPlayers) return send(ws, { type: 'error', message: 'Esta sala está cheia (máximo de 6 jogadores).' });
  const rawName = String(data.name || 'Jogador').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 17);
  const p = {
    id: String(nextId++), ws, name: rawName || 'Jogador', team: teamCount(room, 'attackers') <= teamCount(room, 'defenders') ? 'attackers' : 'defenders',
    x: 0, z: 0, yaw: 0, pitch: 0, alive: false, health: 100,
    kills: 0, deaths: 0, weapon: 'rifle', mag: {}, reserve: {}, input: {},
    lastInput: now(), nextShot: 0, lastFiredAt: 0, consecutiveShots: 0, reloadEnd: 0, reloadWeapon: null,
    useKind: null, useStarted: 0, useProgress: 0,
  };
  initializeEconomy(p);
  room.players.set(p.id, p); ws.room = room; ws.player = p;
  if (room.mode === 'training') {
    room.ownerId = p.id;
    for (let i = 0; i < Math.min(room.botCount, BOT_MAX); i++) createBot(room, i);
  }
  spawn(p, room);
  // Ingressos durante uma partida aguardam a próxima rodada.
  if (room.phase !== 'waiting') { p.alive = false; p.health = 0; }
  send(ws, { type: 'joined', id: p.id, code: room.code, team: p.team, name: p.name, mode: room.mode, botCount: room.botCount, difficulty: room.difficulty });
  broadcast(room, { type: 'event', kind: 'info', text: `${p.name} entrou em ${p.team === 'attackers' ? 'ATACANTES' : 'DEFENSORES'}` });
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.fbx': 'application/octet-stream', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, rooms: rooms.size })); }
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  const requested = path.resolve(DIST, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
  if (!requested.startsWith(DIST + path.sep) || !fs.existsSync(requested) || !fs.statSync(requested).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Arquivo não encontrado. Para desenvolvimento, execute npm run dev.');
  }
  res.writeHead(200, {
    'content-type': mime[path.extname(requested)] ?? 'application/octet-stream',
    'cache-control': path.extname(requested) === '.html' ? 'no-store' : 'public, max-age=3600',
    'x-content-type-options': 'nosniff',
  });
  fs.createReadStream(requested).pipe(res);
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
// Verifica a origem antes de aceitar o upgrade WebSocket; sem CORS permissivo.
server.on('upgrade', (req, socket, head) => {
  let pathname;
  try { pathname = new URL(req.url || '/', 'http://localhost').pathname; }
  catch { socket.destroy(); return; }
  if (pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy(); return;
  }
  if (!isAllowedOrigin(req.headers.origin, allowedOrigins)) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy(); return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});
wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }
    if (!data || typeof data.type !== 'string') return;
    if (data.type === 'join') return join(ws, data);
    if (data.type === 'hello') return registerLobby(ws, data);
    if (data.type === 'ping') return send(ws, { type: 'pong', sent: Number.isFinite(data.sent) ? data.sent : 0 });
    if (data.type === 'partyInvite') return partyInvite(ws, data);
    if (data.type === 'partyRespond') return partyRespond(ws, data);
    if (data.type === 'partyJoinLink') return partyLinkJoin(ws, data);
    if (['partyReady','partyTeam','partyBack','partyStart','partyReturn'].includes(data.type)) return partyAction(ws, data);
    const p = ws.player, room = ws.room;
    if (!p || !room || room.phase === 'lobby') return;
    const t = now();
    if (data.type === 'input') {
      const i = data.input || {};
      p.input = { forward: !!i.forward, back: !!i.back, left: !!i.left, right: !!i.right, sprint: !!i.sprint, crouch: !!i.crouch, interact: !!i.interact, aim: !!i.aim, jump: !!i.jump };
      if (Number.isFinite(data.yaw)) p.yaw = clamp(data.yaw, -Math.PI * 500, Math.PI * 500);
      if (Number.isFinite(data.pitch)) p.pitch = clamp(data.pitch, -1.53, 1.53);
      p.lastInput = t;
    } else if (data.type === 'shoot') onShoot(room, p, data, t);
    else if (data.type === 'reload' && room.phase === 'live') onReload(p, t);
    else if (data.type === 'weapon') {
      if (p.alive && ownsWeapon(p, data.weapon)) {
        if (p.reloadEnd) { p.reloadEnd = 0; p.reloadWeapon = null; }
        p.weapon = data.weapon;
      }
    } else if (data.type === 'startTraining' && room.mode === 'training' && room.ownerId === p.id && room.phase === 'prepare') {
      room.phase = 'live'; room.deadline = t + GAME.roundMs;
      broadcast(room, { type: 'event', kind: 'live', text: 'TREINO INICIADO — ELIMINE OS BOTS' });
    } else if (data.type === 'resetTraining' && room.mode === 'training' && room.ownerId === p.id) {
      resetTraining(room, t);
    } else if (data.type === 'buy') {
      const result = purchase(p, data.item, room.phase);
      send(ws, { type: 'purchaseResult', ...result });
    } else if (data.type === 'refund') {
      const result = refund(p, data.slot, room.phase);
      send(ws, { type: 'purchaseResult', ...result });
    }
  });
  ws.on('close', () => disconnect(ws));
  ws.on('error', () => disconnect(ws));
});
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 30000).unref();
let lastTick = now();
setInterval(() => {
  const t = now(); const elapsed = Math.min((t - lastTick) / 1000, 0.1); lastTick = t;
  for (const room of rooms.values()) updateRoom(room, elapsed, t);
}, 50);
server.listen(PORT, HOST, () => console.log(`VECTOR STRIKE | servidor online em ${HOST}:${PORT} | /health`));
