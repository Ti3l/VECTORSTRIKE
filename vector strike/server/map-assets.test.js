import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARENA, MAP_NAME, CRATES, SPAWNS, SITES, siteAt, collides } from '../src/shared.js';
import { findBotPath } from '../src/bots.js';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public/map/fps-lite');
const filenames=['Building_01','Jug_01','Jug_02','Stairs_01','Wall_01','Wall_02','Wall_03',
  'WallPart_01','WoodPlank_01','WoodPlank_02','WoodPlank_03','Box_01','Brick_01'];

test('todos os 13 FBX e atlas enviados estão incluídos no projeto',()=>{
  for(const name of filenames){
    const filepath=path.join(dir,`${name}.fbx`);
    assert.ok(fs.existsSync(filepath),`${name} ausente`);
    assert.ok(fs.readFileSync(filepath).subarray(0,18).toString().startsWith('Kaydara FBX Binary'));
  }
  assert.ok(fs.statSync(path.join(dir,'FPSLite_Texture_01.png')).size > 0);
});
test('coberturas usam modelos originais reconhecidos',()=>{
  assert.equal(MAP_NAME,'COMPLEXO ÍRIS');
  assert.ok(CRATES.length>=20);
  for(const box of CRATES)if(box.asset)assert.ok(filenames.includes(box.asset));
  assert.ok(CRATES.some(box=>box.type==='interior-wall'&&!box.asset));
});
test('ambos sites são acessíveis dos dois respawns e comportam plantio',()=>{
  for(const site of Object.values(SITES)){
    assert.equal(siteAt(site)?.id,site.id);
    assert.equal(collides(site.x,site.z),false);
    for(const team of Object.values(SPAWNS)) for(const spawn of team){
      const route=findBotPath(spawn,site);
      assert.ok(route.length>0,`site ${site.id} inacessível de ${spawn.x}, ${spawn.z}`);
      assert.ok(route.every(point=>!collides(point.x,point.z)), 'rota atravessou cobertura');
    }
  }
  assert.ok(ARENA.halfWidth*2>70 && ARENA.halfDepth*2>50);
});
