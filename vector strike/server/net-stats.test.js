import test from 'node:test';
import assert from 'node:assert/strict';
import {canSendSnapshot, MAX_SNAPSHOT_BUFFER_BYTES, SNAPSHOT_INTERVAL_MS, updateLatencySamples, latencySummary} from '../src/net-stats.js';
test('snapshots a 20 por segundo na configuracao base',()=>assert.equal(SNAPSHOT_INTERVAL_MS,50));
test('snapshot pode ser enviado em socket livre',()=>assert.equal(canSendSnapshot({readyState:1,bufferedAmount:0}),true));
test('snapshots acumulados sao descartados sem encerrar a conexao',()=>{
  assert.equal(canSendSnapshot({readyState:1,bufferedAmount:MAX_SNAPSHOT_BUFFER_BYTES}),false);
  assert.equal(canSendSnapshot({readyState:3,bufferedAmount:0}),false);
});
test('ping exibe mediana real e variacao entre amostras',()=>{
  const list=[80,85,90,400,88].reduce((p,v)=>updateLatencySamples(p,v),[]);
  const result=latencySummary(list);
  assert.equal(result.ping,88);
  assert.ok(result.jitter>100);
});
test('amostras invalidas sao descartadas e buffer fica limitado',()=>{
  let h=[]; for(let i=0;i<20;i++)h=updateLatencySamples(h,70+i);
  assert.equal(h.length,7);
  assert.deepEqual(updateLatencySamples(h,-5),h);
  assert.deepEqual(updateLatencySamples(h,Infinity),h);
});
