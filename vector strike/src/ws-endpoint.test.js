import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWebSocketUrl, isVercelWithoutBackend } from './ws-endpoint.js';
test('local dev usa /ws no mesmo host e porta', () => {
  assert.equal(resolveWebSocketUrl('', 'http://localhost:5173/'), 'ws://localhost:5173/ws');
});
test('modo tunnel conserva origem segura', () => {
  assert.equal(resolveWebSocketUrl('', 'https://abc.trycloudflare.com/'), 'wss://abc.trycloudflare.com/ws');
});
test('Vercel e backend Render usam domínios diferentes', () => {
  assert.equal(resolveWebSocketUrl('https://vector.example.com', 'https://game.vercel.app/'), 'wss://vector.example.com/ws');
});
test('url wss explicita conserva /ws', () => {
  assert.equal(resolveWebSocketUrl('wss://vector.example.com/ws', 'https://game.vercel.app/'), 'wss://vector.example.com/ws');
});
test('bloqueia mixed content', () => {
  assert.throws(() => resolveWebSocketUrl('ws://localhost:3001', 'https://game.vercel.app/'), /WSS/);
});
test('bloqueia protocolos improprios', () => {
  assert.throws(() => resolveWebSocketUrl('file:///etc/passwd', 'https://game.vercel.app/'));
});
test('detecta Vercel sem variável de backend', () => {
  assert.equal(isVercelWithoutBackend('teste.vercel.app','',true),true);
  assert.equal(isVercelWithoutBackend('localhost','',true),false);
  assert.equal(isVercelWithoutBackend('teste.vercel.app','wss://backend/ws',true),false);
});
