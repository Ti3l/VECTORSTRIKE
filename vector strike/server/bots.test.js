import test from 'node:test';
import assert from 'node:assert/strict';
import { SPAWNS, SITE, SITES, WEAPONS, collides } from '../src/shared.js';
import { BOT_MAX, BOT_DIFFICULTIES, BOT_WEAPON, trainingOptions, findBotPath, lineOfSight, botAngles, prepareBot, updateBot } from '../src/bots.js';

test('treino restringe quantidade e dificuldade recebidas do navegador', () => {
  assert.deepEqual(trainingOptions({}), { botCount: 2, difficulty: 'normal' });
  assert.deepEqual(trainingOptions({ botCount: 99, difficulty: 'godmode' }), { botCount: BOT_MAX, difficulty: 'normal' });
  assert.deepEqual(trainingOptions({ botCount: -15, difficulty: 'easy' }), { botCount: 1, difficulty: 'easy' });
  assert.equal(Object.keys(BOT_DIFFICULTIES).length, 3);
});

test('bots calculam rota que respeita as caixas do cenário', () => {
  for(const origin of SPAWNS.defenders){
    for(const target of [SPAWNS.attackers[0], ...Object.values(SITES)]) {
      const path=findBotPath(origin,target);
      assert.ok(path.length>1,'rota deve ter passos');
      assert.ok(path.every(p=>!collides(p.x,p.z)), 'nenhum passo pode estar dentro de uma caixa');
      assert.ok(Math.hypot(path.at(-1).x-target.x,path.at(-1).z-target.z)<1.5);
    }
  }
});

test('bots não enxergam através de cobertura sólida', () => {
  assert.equal(lineOfSight({x:-26,y:1.3,z:-27},{x:-26,y:1.3,z:-19}),false);
  assert.equal(lineOfSight({x:2,y:1.3,z:-16},{x:7,y:1.3,z:-16}),true);
});

test('ângulo de pontaria mira o inimigo sem inverter direção', () => {
  const {yaw,pitch}=botAngles({x:10,y:1,z:0},{x:0,y:1,z:0});
  assert.ok(Math.abs(yaw-Math.PI/2)<.00001);
  assert.equal(pitch,0);
});

function setup(){
  const enemy={id:'you',team:'attackers',x:-18,z:-7,alive:true,input:{}};
  const bot={id:'bot-1',isBot:true,team:'defenders',x:18,z:10,alive:true,input:{},inventory:{primary:'rifle'},weapon:BOT_WEAPON,mag:{rifle:WEAPONS.rifle.magazine},reserve:{rifle:WEAPONS.rifle.reserve},reloadEnd:0};
  prepareBot(bot);
  const room={phase:'live',difficulty:'normal',bomb:{state:'carried'},players:new Map([[enemy.id,enemy],[bot.id,bot]])};
  return {enemy,bot,room};
}

test('IA percorre o mapa e começa a atacar alvos em visão direta',()=>{
  const {bot,room}=setup();
  let shots=0;
  for(let i=0;i<380;i++){
    updateBot(bot,room,.05,1000+i*50,()=>{shots++;},()=>{});
    assert.equal(collides(bot.x,bot.z),false);
  }
  assert.ok(bot.x<SPAWNS.defenders[0].x-17,'bot deveria atravessar parte do mapa em direção ao inimigo');
  assert.ok(shots>2,'bot deveria disparar assim que chegar perto');
});

test('bots não atiram fora do round, nem antes da reação inicial',()=>{
  const {bot,room,enemy}=setup();
  bot.x=-12;bot.z=-7;enemy.x=-16;enemy.z=-7;
  let shots=0;
  room.phase='prepare';
  for(let i=0;i<20;i++)updateBot(bot,room,.05,i*50,()=>{shots++},()=>{});
  assert.equal(shots,0);
  room.phase='live';
  updateBot(bot,room,.05,1000,()=>{shots++},()=>{});
  assert.equal(shots,0,'sem tiros instantâneos antes do tempo de reação');
});

test('bot vai até a bomba e interage quando precisa desarmar',()=>{
  const {bot,room}=setup();
  bot.x=SITE.x+1;bot.z=SITE.z;
  room.bomb={state:'planted',x:SITE.x,z:SITE.z};
  updateBot(bot,room,.05,1000,()=>{},()=>{});
  assert.equal(bot.input.interact,true);
});
