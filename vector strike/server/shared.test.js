import test from 'node:test';
import assert from 'node:assert/strict';
import { collides, movePlayer, forwardDirection, rayBox, raySphere, SITE, SITES, SPAWNS, ARENA, siteAt, CRATES } from '../src/shared.js';

test('movimento frontal e colisão nas bordas', () => {
  const p = movePlayer({ x: 0, z: -15 }, { forward: true }, 0, .1);
  assert.ok(p.z < -15);
  assert.equal(collides(25, 0), true);
  assert.equal(collides(0, -15), false);
});
test('colisão nos objetos de cobertura', () => {
  const crate = CRATES[0];
  assert.equal(collides(crate.x, crate.z), true);
});
test('direção frontal da câmera e raio em caixas', () => {
  const direction = forwardDirection(0, 0);
  assert.ok(Math.abs(direction.z + 1) < .0001);
  const d = rayBox({ x: 0, y: 1, z: 5 }, direction, { x: 0, z: 0, w: 2, d: 2, h: 3 });
  assert.equal(d, 4);
});
test('raio detecta cabeça e respeita direção', () => {
  assert.equal(raySphere({ x: 0, y: 1, z: 5 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 }, .5), 4.5);
  assert.equal(raySphere({ x: 0, y: 1, z: 5 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 }, .5), null);
});
test('site de bomba está fora de cobertura sólida', () => {
  assert.equal(collides(SITE.x, SITE.z), false);
});

test('mapa V1.7 é ampliado e possui dois sites jogáveis', () => {
  assert.ok(ARENA.halfWidth*ARENA.halfDepth*4 > 4000);
  for (const site of Object.values(SITES)) {
    assert.equal(collides(site.x,site.z),false);
    assert.equal(siteAt({x:site.x,z:site.z})?.id,site.id);
  }
  assert.equal(siteAt({x:0,z:0}),null);
  for (const points of Object.values(SPAWNS)) for(const spawn of points) assert.equal(collides(spawn.x,spawn.z),false);
});
