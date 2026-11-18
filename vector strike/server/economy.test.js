import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, ECONOMY } from '../src/shared.js';
import { initializeEconomy, prepareRoundEquipment, ownsWeapon, purchase, refund, roundIncome, applyArmorDamage, addCredits } from '../src/economy.js';

function player(team = 'attackers') {
  const p = { alive: false, team, health: 100, mag: {}, reserve: {}, reloadEnd: 0, reloadWeapon: null };
  initializeEconomy(p);
  prepareRoundEquipment(p);
  p.alive = true;
  return p;
}

test('pistola inicial grátis, sem rifle, e saldo de 800', () => {
  const p = player();
  assert.equal(p.credits, 800);
  assert.equal(p.weapon, 'pistol');
  assert.equal(ownsWeapon(p, 'rifle'), false);
  assert.equal(ownsWeapon(p, 'pistol'), true);
});
test('compra validada pelo servidor e não pode ocorrer em combate', () => {
  const p = player();
  assert.equal(purchase(p, 'rifle', 'prepare').ok, false);
  assert.equal(p.credits, 800);
  assert.equal(purchase(p, 'heavyPistol', 'live').ok, false);
  assert.equal(purchase(p, 'heavyPistol', 'prepare').ok, true);
  assert.equal(p.credits, 300);
  assert.equal(ownsWeapon(p, 'heavyPistol'), true);
  assert.equal(purchase(p, 'heavyPistol', 'prepare').ok, false);
  assert.equal(p.credits, 300);
  assert.equal(purchase(p, 'madeup', 'prepare').ok, false);
  assert.equal(purchase(p, 'pistol', 'prepare').ok, false);
});
test('reembolsar item comprado devolve arma anterior e o valor inteiro', () => {
  const p = player();
  purchase(p, 'heavyPistol', 'prepare');
  assert.equal(refund(p, 'sidearm', 'prepare').ok, true);
  assert.equal(p.credits, 800);
  assert.equal(p.inventory.sidearm, 'pistol');
  assert.equal(refund(p, 'sidearm', 'prepare').ok, false);
  assert.equal(refund(p, 'not-valid', 'prepare').ok, false);
});
test('substituir compra antes do round considera o crédito da arma devolvida', () => {
  const p = player();
  p.credits = 4000;
  assert.equal(purchase(p, 'rifle', 'prepare').ok, true);
  assert.equal(p.credits, 1200);
  assert.equal(purchase(p, 'shotgun', 'prepare').ok, true);
  assert.equal(p.credits, 2400);
  assert.equal(ownsWeapon(p, 'rifle'), false);
  assert.equal(ownsWeapon(p, 'shotgun'), true);
  assert.equal(refund(p, 'primary', 'prepare').ok, true);
  assert.equal(p.credits, 4000);
  assert.equal(p.inventory.primary, null);
});
test('armadura é comprada e é possível fazer upgrade usando saldo + reembolso', () => {
  const p = player();
  p.credits = 1100;
  assert.equal(purchase(p, 'armorLight', 'prepare').ok, true);
  assert.equal(p.armor, 25);
  assert.equal(p.credits, 700);
  assert.equal(purchase(p, 'armorHeavy', 'prepare').ok, true);
  assert.equal(p.credits, 100);
  assert.equal(p.armor, 50);
  assert.equal(refund(p, 'armor', 'prepare').ok, true);
  assert.equal(p.credits, 1100);
  assert.equal(p.armor, 0);
});
test('morte remove equipamento, sobrevivência conserva equipamento', () => {
  const p = player();
  p.credits = 5000;
  purchase(p, 'rifle', 'prepare');
  p.armor = 14;
  prepareRoundEquipment(p);
  assert.equal(p.inventory.primary, 'rifle');
  assert.equal(p.armor, 14);
  assert.equal(p.mag.rifle, WEAPONS.rifle.magazine);
  p.alive = false;
  prepareRoundEquipment(p);
  assert.equal(p.inventory.primary, null);
  assert.equal(p.weapon, 'pistol');
  assert.equal(p.armor, 0);
});
test('economia de vitória, derrotas consecutivas, limite de dinheiro e abates', () => {
  const a = player('attackers'), d = player('defenders');
  const room = { players: new Map([['a', a], ['d', d]]), lossStreak: {attackers:0,defenders:0} };
  roundIncome(room,'attackers');
  assert.equal(a.credits, 3800);
  assert.equal(d.credits, 2700);
  roundIncome(room,'attackers');
  assert.equal(d.credits, 5100);
  roundIncome(room,'attackers');
  assert.equal(d.credits, 8000);
  roundIncome(room,'defenders');
  assert.equal(d.credits, ECONOMY.max);
  assert.equal(room.lossStreak.defenders, 0);
  addCredits(a, ECONOMY.kill);
  assert.ok(a.credits <= ECONOMY.max);
});
test('dano de armadura reduz escudo, não zera dano e respeita a vida restante', () => {
  const p = player();
  p.armor = 25;
  const d = applyArmorDamage(p, 40);
  assert.equal(d.armorAbsorb, 18);
  assert.equal(d.healthDamage, 22);
  assert.equal(p.health, 78);
  assert.equal(p.armor, 7);
  assert.equal(applyArmorDamage(p, 200).killed, true);
  assert.equal(p.health, 0);
  assert.equal(p.armor, 0);
});
test('spam de compras não gera créditos extras', () => {
  const p = player(); p.credits = 4000;
  purchase(p, 'rifle', 'prepare');
  for(let i=0;i<30;i++){
    purchase(p, 'rifle', 'prepare');
    refund(p, 'primary', 'prepare');
    purchase(p, 'rifle', 'prepare');
  }
  assert.equal(p.credits, 1200);
  assert.equal(refund(p, 'primary', 'live').ok, false);
});
