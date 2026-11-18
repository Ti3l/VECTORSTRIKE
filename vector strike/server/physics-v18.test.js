import test from 'node:test';
import assert from 'node:assert/strict';
import {OPEN_BUILDINGS, CRATES, ROOFS, JUMP, collides, stepPlayerMotion, rayBox} from '../src/shared.js';

const EPS=.04;
const begin=(x,z)=>({x,z,y:0,vy:0,grounded:true,jumpHeld:false});
const tick=(state,controls={},dt=.02)=>stepPlayerMotion(state,controls,0,dt);

test('seis casas com interior livre, entradas abertas e paredes sólidas',()=>{
  assert.equal(OPEN_BUILDINGS.length,6);
  for (const b of OPEN_BUILDINGS){
    assert.equal(collides(b.x,b.z),false,`interior ocupado: ${b.name}`);
    if(b.door==='both-x'){
      assert.equal(collides(b.x+b.w/2-.14,b.z),false,`porta bloqueada: ${b.name}`);
      assert.equal(collides(b.x+b.w/2-.14,b.z+b.d/2-.8),true,`parede atravessável: ${b.name}`);
    } else {
      const front=b.z+(b.door==='south'?1:-1)*(b.d/2-.14);
      assert.equal(collides(b.x,front),false,`porta bloqueada: ${b.name}`);
      assert.equal(collides(b.x+b.w/2-.75,front),true,`parede atravessável: ${b.name}`);
    }
  }
});

test('espaço faz pular, gravidade faz cair e segurar tecla não cria pulo infinito',()=>{
  let p=begin(34,3),highest=0,jumpEvents=0,previousVy=0;
  for(let i=0;i<110;i++){
    p=tick(p,{jump:true});highest=Math.max(highest,p.y);
    if(p.vy>0&&previousVy<=0)jumpEvents++;
    previousVy=p.vy;
  }
  assert.ok(highest>1.25&&highest<1.8,`altura inesperada ${highest}`);
  assert.equal(jumpEvents,1);
  assert.equal(p.y,0);
  assert.equal(p.grounded,true);
  assert.ok(JUMP.speed>0&&JUMP.gravity>0);
});

test('salto horizontal permite aterrisar sobre caixas com colisão vertical',()=>{
  let p=begin(-11.9,-2.12);
  for(let i=0;i<55;i++)p=tick(p,{jump:i<18,back:i<20});
  assert.ok(Math.abs(p.y-1.26)<EPS,`aterrissou na altura ${p.y}`);
  assert.equal(p.grounded,true);
  assert.ok(!collides(p.x,p.z,.43,p.y), 'jogador dentro da caixa');
  assert.ok(collides(p.x,p.z,.43,0), 'a caixa ainda deve bloquear caminhada no chão');
});

test('andar para fora da caixa faz cair no piso, nunca flutuar',()=>{
  let p=begin(-11.9,-2.12);
  for(let i=0;i<55;i++)p=tick(p,{jump:i<18,back:i<20});
  for(let i=0;i<65;i++)p=tick(p,{back:true});
  assert.equal(p.y,0);
  assert.equal(p.grounded,true);
});

test('telhados bloqueiam balas sem bloquear movimento no térreo',()=>{
  assert.equal(ROOFS.length,OPEN_BUILDINGS.length);
  for(const r of ROOFS){
    assert.equal(collides(r.x,r.z),false);
    const hit=rayBox({x:r.x,y:r.y+3,z:r.z},{x:0,y:-1,z:0},r,10);
    assert.ok(hit!==null && hit<4);
  }
});

test('há caixas de apoio para escalada e obstáculos altos seguem sólidos',()=>{
  assert.ok(CRATES.filter(c=>c.type==='crate'&&c.h<=1.3).length>=7);
  assert.ok(CRATES.filter(c=>c.type==='crate'&&c.h>2).length>=2);
});

test('duas etapas de salto alcançam uma caixa alta a partir da de apoio',()=>{
  let p={x:13.9,z:-22.5,y:1.2,vy:0,grounded:true,jumpHeld:false};
  for(let i=0;i<60;i++)p=tick(p,{jump:i<18,forward:i<26});
  assert.ok(Math.abs(p.y-2.4)<.04,`altura final ${p.y}`);
  assert.equal(p.grounded,true);
});

test('bots conseguem entrar pelas portas das seis construções',async()=>{
  const {findBotPath}=await import('../src/bots.js');
  for(const b of OPEN_BUILDINGS){
    const outside=b.door==='south'?{x:b.x,z:b.z+b.d/2+2}
      :b.door==='north'?{x:b.x,z:b.z-b.d/2-2}
      :{x:b.x-b.w/2-2,z:b.z};
    assert.ok(findBotPath(outside,b).length>0,`bot sem acesso: ${b.name}`);
  }
});
