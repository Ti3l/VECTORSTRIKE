import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeName,nameKey,selectTeam,canStartParty,publicPartyState} from '../src/lobby.js';
const player = (id, team, ready=false) => ({id,name:`Jogador ${id}`,team,ready});
const room = players => ({code:'A4X9Q',ownerId:'1',phase:'lobby',players:new Map(players.map(p=>[p.id,p]))});
test('nomes são limpos e comparados sem distinção de caixa',()=>{
  assert.equal(normalizeName('  Ana <teste> '),'Ana teste');
  assert.equal(nameKey('JoÃO'),nameKey('joão'));
  assert.ok(normalizeName('X'.repeat(100)).length<=17);
});
test('convites equilibram os times',()=>{
  assert.equal(selectTeam([]),'attackers');
  assert.equal(selectTeam([player('1','attackers')]),'defenders');
  assert.equal(selectTeam([player('1','attackers'),player('2','defenders')]),'attackers');
});
test('não inicia grupo sozinho ou sem pronto',()=>{
  assert.equal(canStartParty(room([player('1','attackers')])).ok,false);
  assert.equal(canStartParty(room([player('1','attackers',true),player('2','defenders')])).ok,false);
});
test('não inicia grupo sem duas equipes',()=>{
  assert.equal(canStartParty(room([player('1','attackers',true),player('2','attackers',true)])).ok,false);
});
test('inicia grupo se todos prontos e com equipes equilibradas',()=>{
  assert.equal(canStartParty(room([player('1','attackers',true),player('2','defenders',true)])).ok,true);
});
test('o estado do lobby não divulga conexões ou propriedades privadas',()=>{
  const p=player('1','attackers',true);p.ws={secret:'não expor'};const snapshot=publicPartyState(room([p]));
  assert.equal(snapshot.members[0].ws,undefined);
  assert.equal(snapshot.ownerId,'1');
});
test('grupo com partida em andamento não pode reiniciar pelo lobby',()=>{
  const r=room([player('1','attackers',true),player('2','defenders',true)]);r.phase='live';
  assert.equal(canStartParty(r).ok,false);
});
