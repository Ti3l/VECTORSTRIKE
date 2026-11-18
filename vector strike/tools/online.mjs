// VECTOR STRIKE V1.8.1 — link HTTPS temporario para jogar com amigos.
// Inicia o servidor de producao (site + WebSocket na mesma porta), sem expor o Vite dev.
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const viteEntry = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const serverEntry = fileURLToPath(new URL('../server/index.js', import.meta.url));
const cloudflared = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
const port = 3001;
const origin = `http://127.0.0.1:${port}`;
let server, tunnel, stopping = false;

function fail(message) { console.error(`\n[ERRO] ${message}\n`); process.exitCode = 1; }
function shutdown() {
  if (stopping) return;
  stopping = true;
  if (tunnel?.exitCode === null && !tunnel?.killed) tunnel.kill();
  if (server?.exitCode === null && !server?.killed) server.kill();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function build() {
  return new Promise((resolve, reject) => {
    console.log('\n[1/3] Compilando o site para compartilhamento...');
    const child = spawn(process.execPath, [viteEntry, 'build'], { cwd: root, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Build falhou (codigo ${code ?? '?'})`)));
  });
}
async function checkHealth() {
  try {
    const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch { return false; }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('VECTOR STRIKE V1.8.2 | MODO ONLINE COM AMIGOS');
  const version = spawnSync(cloudflared, ['--version'], { encoding: 'utf8', windowsHide: true });
  if (version.error || version.status !== 0) {
    throw new Error('cloudflared nao encontrado. Instale: winget install -e --id Cloudflare.cloudflared (e reabra o terminal).');
  }
  if (!existsSync(viteEntry)) throw new Error('Dependencias nao instaladas. Execute npm install.');
  if (await checkHealth()) throw new Error('Porta 3001 ja esta ocupada pelo jogo. Feche o npm run dev / npm start antigo e tente de novo.');
  await build();
  console.log('\n[2/3] Iniciando servidor do jogo e multiplayer...');
  server = spawn(process.execPath, [serverEntry], {
    cwd: root, stdio: 'inherit', shell: false,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    windowsHide: false,
  });
  server.on('error', (error) => { fail(`Nao foi possivel iniciar o servidor: ${error.message}`); shutdown(); });
  server.on('exit', (code) => { if (!stopping) { fail(`Servidor terminou (${code}).`); shutdown(); } });
  let alive = false;
  for (let i = 0; i < 40; i++) {
    if (server.exitCode !== null) break;
    if (await checkHealth()) { alive = true; break; }
    await sleep(250);
  }
  if (!alive) throw new Error('Servidor nao respondeu em http://127.0.0.1:3001/health. Confira o terminal.');
  console.log(`\n[3/3] Gerando link HTTPS...`);
  console.log('SEU PC: abra http://localhost:3001 (mesmo servidor, sem tunel).');
  console.log('Aguarde a URL https://...trycloudflare.com abaixo. Envie ESSA URL para sua amiga.');
  console.log('Mantenha esta janela aberta enquanto estiverem jogando.\n');
  tunnel = spawn(cloudflared, ['tunnel', '--url', origin], {
    cwd: root, shell: false, windowsHide: false, stdio: ['inherit', 'pipe', 'pipe'],
  });
  let shown = false;
  let buffer = '';
  const print = chunk => {
    const string = chunk.toString();
    process.stdout.write(string);
    buffer = (buffer + string).slice(-8192); // URL pode vir fragmentada entre pacotes
    if (!shown) {
      const found = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (found) {
        shown = true;
        console.log(`\n===========================================================`);
        console.log(`  LINK PARA COMPARTILHAR: ${found[0]}`);
        console.log(`  SUA AMIGA ABRE ESSE LINK. VOCE USA http://localhost:3001`);
        console.log(`  NAO ENVIE localhost:5173 NEM localhost:3001.`);
        console.log(`===========================================================\n`);
      }
    }
  };
  tunnel.stdout.on('data', print);
  tunnel.stderr.on('data', print);
  tunnel.on('error', err => { fail(`Cloudflare Tunnel: ${err.message}`); shutdown(); });
  tunnel.on('exit', (code) => {
    if (!stopping) { if(code) fail(`Tunel encerrado (codigo ${code})`); shutdown(); }
  });
}

main().catch(err => { fail(err.message); shutdown(); });
