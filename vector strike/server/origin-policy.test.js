import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAllowedOrigins, isAllowedOrigin } from './origin-policy.js';
test('sem ALLOWED_ORIGINS permite ambiente local',()=>{
  assert.equal(isAllowedOrigin(undefined, parseAllowedOrigins('')),true);
});
test('origem permitida é exata',()=>{
  const allowed=parseAllowedOrigins('https://game.vercel.app, https://fps.meudominio.com');
  assert.equal(isAllowedOrigin('https://game.vercel.app',allowed),true);
  assert.equal(isAllowedOrigin('https://fps.meudominio.com',allowed),true);
  assert.equal(isAllowedOrigin('https://intruso.vercel.app',allowed),false);
  assert.equal(isAllowedOrigin(undefined,allowed),false);
});
