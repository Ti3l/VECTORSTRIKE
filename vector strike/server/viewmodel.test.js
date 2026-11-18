import test from 'node:test';
import assert from 'node:assert/strict';
import { getAimMode, getWeaponPose, getAimFov, approachAim, weaponPoseType } from '../src/viewmodel.js';
import { WEAPONS } from '../src/shared.js';

for (const [id, weapon] of Object.entries(WEAPONS)) {
  test(`${id}: pose e comportamento da mira`, () => {
    const mode = getAimMode(id, weapon.slot);
    const hip = getWeaponPose(id, weapon.slot, 0);
    const ads = getWeaponPose(id, weapon.slot, 1);
    const half = getWeaponPose(id, weapon.slot, .5);
    for (const pose of [hip,ads,half]) {
      assert.deepEqual(Object.keys(pose),['x','y','z','rx','ry','rz']);
      assert.ok(Object.values(pose).every(Number.isFinite));
    }
    assert.ok(hip.x >= .76, 'arma no quadrante direito sem ADS');
    assert.ok(hip.y <= -.54, 'modelo baixo sem ADS');
    assert.ok(hip.ry >= .38, 'cano aponta na diagonal para dentro da tela');
    assert.ok(hip.rx >= .15, 'cano levemente levantado em relação à empunhadura');
    assert.equal(getAimFov(id,weapon.slot,false),76);
    if (mode === 'none') {
      assert.deepEqual(ads,hip,'pistolas/especiais nunca centralizam ao segurar direito');
      assert.equal(getAimFov(id,weapon.slot,true),76);
    } else if (mode === 'scope') {
      assert.deepEqual(ads,hip,'a sniper usa sobreposição de luneta sem mostrar a arma no centro');
      assert.equal(getAimFov(id,weapon.slot,true),38);
    } else {
      assert.ok(ads.x >= .60,'ADS preserva o modelo no lado direito da tela');
      assert.ok(ads.y <= -.54,'o modelo fica abaixo da mira mesmo em ADS');
      assert.ok(ads.ry >= .30,'cano permanece em diagonal mesmo durante o ADS');
      assert.ok(half.x > ads.x && half.x < hip.x);
      assert.equal(getAimFov(id,weapon.slot,true),['smg','mpa','mpsd'].includes(id)?69:68);
    }
  });
}

test('tipos: pistola não mira, fuzil usa ADS e sniper usa luneta',()=>{
  assert.equal(getAimMode('pistol','sidearm'),'none');
  assert.equal(getAimMode('p226','sidearm'),'none');
  assert.equal(getAimMode('heavyPistol','sidearm'),'none');
  assert.equal(getAimMode('rifle','primary'),'ads');
  assert.equal(getAimMode('smg','primary'),'ads');
  assert.equal(getAimMode('sniper','primary'),'scope');
  assert.equal(getAimMode('chassis','primary'),'scope');
  assert.equal(getAimMode('shotgun','primary'),'none');
  assert.equal(getAimMode('rpg','primary'),'none');
  assert.equal(weaponPoseType('pistol','sidearm'),'pistol');
  assert.equal(weaponPoseType('sniper','primary'),'scoped');
  assert.equal(weaponPoseType('magnum','sidearm'),'revolver');
  assert.equal(weaponPoseType('smg','primary'),'smg');
  assert.equal(weaponPoseType('shotgun','primary'),'shotgun');
  assert.equal(weaponPoseType('rpg','primary'),'launcher');
});

test('transição de mira suave e reversível',()=>{
  const first=approachAim(0,true,.016);
  assert.ok(first>0&&first<1);
  const next=approachAim(first,true,.016);
  assert.ok(next>first);
  assert.ok(approachAim(next,false,.016)<next);
  assert.equal(approachAim(0,true,0),0);
});

// Regressão V1.3.3: o cano deve se afastar da direita para o centro, sem
// trazer a empunhadura à linha da mira (problema visto na V1.3.1).
test('pistola, rifle e sniper: vista lateral consistente com FPS tático',()=>{
  for (const [id,slot] of [['pistol','sidearm'],['heavyPistol','sidearm'],['rifle','primary'],['smg','primary'],['sniper','primary']]) {
    const hip=getWeaponPose(id,slot,0);
    const barrelOffsetZ = slot==='sidearm' ? -.45 : -.90;
    const frontX=hip.x + Math.sin(hip.ry)*barrelOffsetZ;
    const frontY=hip.y - Math.sin(hip.rx)*barrelOffsetZ*Math.cos(hip.ry);
    assert.ok(frontX < hip.x-.15,`${id}: cano à esquerda do corpo da arma`);
    assert.ok(frontY > hip.y+.05,`${id}: cano mais alto que a empunhadura`);
    assert.ok(hip.x > .75,`${id}: empunhadura no lado direito da câmera`);
  }
  const hip=getWeaponPose('rifle','primary',0);
  const ads=getWeaponPose('rifle','primary',1);
  assert.ok(ads.x>.60 && hip.x-ads.x<.2, 'rifle não volta ao centro no botão direito');
  assert.deepEqual(getWeaponPose('pistol','sidearm',1), getWeaponPose('pistol','sidearm',0));
});
