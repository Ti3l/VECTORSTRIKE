import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WEAPONS, explosionDamage } from '../src/shared.js';
import { MODEL_FILES } from '../src/weapon-models.js';
import { initializeEconomy, prepareRoundEquipment, purchase, refund, ownsWeapon } from '../src/economy.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('todos os 14 arquivos GLB estão presentes e possuem cabeçalho correto', () => {
  assert.equal(Object.keys(MODEL_FILES).length, 14);
  assert.equal(new Set(Object.values(MODEL_FILES)).size, 14);
  for (const [id, url] of Object.entries(MODEL_FILES)) {
    assert.ok(WEAPONS[id], `Falta cadastro da arma ${id}`);
    const file = path.resolve(root, 'public', url.slice(1));
    assert.ok(fs.existsSync(file), file);
    const data = fs.readFileSync(file);
    assert.equal(data.subarray(0,4).toString(), 'glTF', file);
    assert.equal(data.readUInt32LE(8), data.length, `${id}: tamanho GLB`);
  }
});

test('loja e troca funcionam para todas as armas importadas', () => {
  const p = { alive: false, team: 'attackers', health: 100, mag: {}, reserve: {}, reloadEnd: 0, reloadWeapon: null };
  initializeEconomy(p);prepareRoundEquipment(p);p.alive = true;
  for (const weapon of Object.keys(MODEL_FILES)) {
    if (weapon === 'pistol') continue;
    p.credits = 9000;
    const result = purchase(p, weapon, 'prepare');
    assert.equal(result.ok,true,weapon);
    assert.equal(ownsWeapon(p,weapon),true,weapon);
    assert.equal(p.mag[weapon],WEAPONS[weapon].magazine,weapon);
    assert.equal(refund(p,WEAPONS[weapon].slot,'prepare').ok,true,weapon);
  }
});

test('explosão RPG causa dano com queda radial e fora do raio não causa dano', () => {
  assert.equal(explosionDamage(0,3.25,118),118);
  assert.ok(explosionDamage(1.5,3.25,118)<118);
  assert.ok(explosionDamage(3.25,3.25,118)>0);
  assert.equal(explosionDamage(3.26,3.25,118),0);
  assert.equal(explosionDamage(-1,0,118),0);
});
