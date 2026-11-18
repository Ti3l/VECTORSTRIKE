import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { partyCardsHTML } from '../src/party-ui.js';

const escapeHTML = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const state = { ownerId:'a', members:[
 {id:'a',name:'Líder',team:'attackers',ready:true},
 {id:'b',name:'Mara',team:'defenders',ready:false},
]};

test('painel apresenta sempre seis vagas sem inventar jogadores',()=>{
 const markup = partyCardsHTML(state,'a',escapeHTML);
 assert.equal((markup.match(/class="party-banner /g)||[]).length,6);
 assert.equal((markup.match(/data-focus-invite="true"/g)||[]).length,4);
 assert.match(markup,/Líder/);assert.match(markup,/Mara/);
 assert.match(markup,/is-leader/);assert.match(markup,/is-self/);
 assert.match(markup,/AGUARDANDO/);assert.match(markup,/PRONTO/);
});
test('nomes de usuário são escapados antes de entrar no HTML',()=>{
 const html=partyCardsHTML({ownerId:'x',members:[{id:'x',name:'<img src=x onerror=alert(1)>',team:'attackers',ready:true}]},'x',escapeHTML);
 assert.ok(!html.includes('<img'));
 assert.ok(html.includes('&lt;img'));
});
test('IDs essenciais existem uma única vez no HTML',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for (const id of ['party-hub','party-members','party-start','party-ready','party-team','party-invites','online-users','friend-search','invite-by-name','copy-party-link','party-leave','disconnect-lobby','nickname','menu-error','party-stage-count','party-me-name']) {
   const count=(html.match(new RegExp('id="'+id+'"','g'))||[]).length;
   assert.equal(count,1,`${id} deve existir uma vez, visto ${count}`);
 }
});
