import { WEAPONS, ARMOR, ECONOMY, clamp } from './shared.js';

export function initializeEconomy(player) {
  player.credits = ECONOMY.initial;
  player.inventory = { primary: null, sidearm: 'pistol' };
  player.armor = 0;
  player.armorMax = 0;
  player.buyLedger = {};
}

export function prepareRoundEquipment(player) {
  // Só sobreviventes conservam armas e armadura. Créditos nunca são perdidos na morte.
  if (!player.alive) {
    player.inventory = { primary: null, sidearm: 'pistol' };
    player.armor = 0;
    player.armorMax = 0;
  }
  player.buyLedger = {};
  player.mag = Object.fromEntries(Object.entries(WEAPONS).map(([id, gun]) => [id, gun.magazine]));
  player.reserve = Object.fromEntries(Object.entries(WEAPONS).map(([id, gun]) => [id, gun.reserve]));
  player.weapon = player.inventory.primary || player.inventory.sidearm;
}

export function ownsWeapon(player, id) {
  return id === player.inventory?.primary || id === player.inventory?.sidearm;
}

export function itemSlot(itemId) {
  if (itemId === 'armorLight' || itemId === 'armorHeavy') return 'armor';
  return WEAPONS[itemId]?.slot ?? null;
}

export function purchase(player, itemId, phase) {
  if (phase !== 'prepare' || !player.alive) return { ok: false, message: 'Compras disponíveis apenas antes do round.' };
  const slot = itemSlot(itemId);
  if (!slot || itemId === 'pistol') return { ok: false, message: 'Equipamento inválido.' };
  const armorType = itemId === 'armorLight' ? 'light' : itemId === 'armorHeavy' ? 'heavy' : null;
  const item = armorType ? ARMOR[armorType] : WEAPONS[itemId];
  const priorBuy = player.buyLedger[slot];
  const previous = slot === 'armor' ? { armor: player.armor, armorMax: player.armorMax } : player.inventory[slot];
  const previousBeforePhase = priorBuy ? priorBuy.before : previous;
  if (priorBuy?.item === itemId) return { ok: false, message: 'Você já comprou esse equipamento.' };
  if (slot !== 'armor' && !priorBuy && previous === itemId) return { ok: false, message: 'Você já possui esta arma.' };
  if (slot === 'armor' && !priorBuy && player.armor >= item.points) return { ok: false, message: 'Você já possui proteção equivalente ou melhor.' };
  const refundable = priorBuy?.cost ?? 0;
  if (player.credits + refundable < item.price) return { ok: false, message: `Créditos insuficientes: faltam ${item.price - player.credits - refundable}.` };
  player.credits = clamp(player.credits + refundable - item.price, 0, ECONOMY.max);
  player.buyLedger[slot] = { item: itemId, cost: item.price, before: previousBeforePhase };
  if (slot === 'armor') {
    player.armorMax = item.points;
    player.armor = item.points;
  } else {
    player.inventory[slot] = itemId;
    player.mag[itemId] = item.magazine;
    player.reserve[itemId] = item.reserve;
    // Equipa a arma recém-comprada.
    player.weapon = itemId;
    player.reloadEnd = 0;
    player.reloadWeapon = null;
  }
  return { ok: true, message: `${item.name} comprado por ¤ ${item.price}.`, slot };
}

export function refund(player, slot, phase) {
  if (phase !== 'prepare' || !player.alive) return { ok: false, message: 'Reembolso apenas durante as compras.' };
  if (!['primary', 'sidearm', 'armor'].includes(slot)) return { ok: false, message: 'Categoria inválida.' };
  const entry = player.buyLedger?.[slot];
  if (!entry) return { ok: false, message: 'Nenhuma compra reembolsável nesta categoria.' };
  player.credits = Math.min(ECONOMY.max, player.credits + entry.cost);
  if (slot === 'armor') {
    player.armor = entry.before.armor;
    player.armorMax = entry.before.armorMax;
  } else {
    player.inventory[slot] = entry.before;
    if (!ownsWeapon(player, player.weapon)) player.weapon = player.inventory.primary || player.inventory.sidearm;
  }
  delete player.buyLedger[slot];
  return { ok: true, message: `Reembolso de ¤ ${entry.cost} realizado.`, slot };
}

export function addCredits(player, amount) {
  player.credits = clamp(player.credits + amount, 0, ECONOMY.max);
}

export function roundIncome(room, winningTeam) {
  room.lossStreak ??= { attackers: 0, defenders: 0 };
  const payouts = {};
  for (const team of ['attackers', 'defenders']) {
    if (team === winningTeam) {
      room.lossStreak[team] = 0;
      payouts[team] = ECONOMY.win;
    } else {
      room.lossStreak[team] += 1;
      payouts[team] = Math.min(ECONOMY.lossMax, ECONOMY.lossBase + (room.lossStreak[team] - 1) * ECONOMY.lossStep);
    }
  }
  for (const player of room.players.values()) addCredits(player, payouts[player.team]);
  return payouts;
}

export function applyArmorDamage(player, damage) {
  const armorAbsorb = Math.min(player.armor || 0, Math.ceil(damage * .45));
  player.armor = (player.armor || 0) - armorAbsorb;
  const healthDamage = damage - armorAbsorb;
  player.health = Math.max(0, player.health - healthDamage);
  return { armorAbsorb, healthDamage, killed: player.health === 0 };
}
