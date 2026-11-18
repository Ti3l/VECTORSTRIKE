import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME, SITE, spreadFor, spreadDirection, canPickupBomb, collides } from '../src/shared.js';

test('rifle parado tem mais precisão do que correndo', () => {
  assert.ok(spreadFor('rifle', {}) < spreadFor('rifle', {forward: true}));
  assert.ok(spreadFor('rifle', {forward: true}) < spreadFor('rifle', {forward: true, sprint: true}));
});
test('agachado aumenta a precisão; rajada adiciona recuo', () => {
  assert.ok(spreadFor('pistol', {crouch: true}) < spreadFor('pistol', {}));
  assert.ok(spreadFor('rifle', {}, 8) > spreadFor('rifle', {}, 0));
});
test('dispersão zero mantém a mira original', () => {
  const d = spreadDirection(Math.PI / 4, .1, 0, 1, -1);
  const base = spreadDirection(Math.PI / 4, .1, 0, 0, 0);
  for(const axis of ['x','y','z']) assert.ok(Math.abs(d[axis] - base[axis]) < 1e-9);
});
test('bomba pode ser recuperada somente por atacante vivo próximo', () => {
  const bomb = {state:'dropped', x:SITE.x, z:SITE.z};
  assert.equal(canPickupBomb({alive:true,team:'attackers',x:SITE.x+1,z:SITE.z},bomb),true);
  assert.equal(canPickupBomb({alive:true,team:'defenders',x:SITE.x,z:SITE.z},bomb),false);
  assert.equal(canPickupBomb({alive:false,team:'attackers',x:SITE.x,z:SITE.z},bomb),false);
  assert.equal(canPickupBomb({alive:true,team:'attackers',x:SITE.x+GAME.pickupRadius+.1,z:SITE.z},bomb),false);
  assert.equal(canPickupBomb({alive:true,team:'attackers',x:SITE.x,z:SITE.z},{state:'carried',x:SITE.x,z:SITE.z}),false);
});
test('site de plantio permanece navegável e raio de coleta configurado',()=>{
  assert.equal(collides(SITE.x,SITE.z),false);
  assert.ok(GAME.pickupRadius>0 && GAME.pickupMs>0);
});
