// Testa o servidor remoto SEM iniciar uma partida. Use:
// npm run deploy:check -- https://seu-backend.onrender.com https://seu-jogo.vercel.app
import { WebSocket } from 'ws';
import { resolveWebSocketUrl } from '../src/ws-endpoint.js';

const target = process.argv[2];
const origin = process.argv[3];
if (!target) {
  console.error('Uso: npm run deploy:check -- https://seu-backend.onrender.com [https://seu-jogo.vercel.app]');
  process.exitCode = 1;
} else {
  try {
    const health = new URL('/health', target);
    console.log('Verificando:', health.href);
    const response = await fetch(health, { signal: AbortSignal.timeout(70000) });
    if (!response.ok) throw new Error(`HTTP ${response.status} no /health`);
    const data = await response.json();
    if (data.ok !== true) throw new Error('A resposta de /health nao confirmou ok:true.');
    console.log(`HTTP OK; salas ativas: ${data.rooms ?? '?'}`);
    const socketUrl = resolveWebSocketUrl(target, health.href);
    const options = origin ? { headers: { Origin: origin } } : {};
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(socketUrl, options);
      const timeout = setTimeout(() => { ws.terminate(); reject(new Error('Tempo esgotado esperando resposta WebSocket.')); }, 20000);
      let completed = false;
      const fail = error => {
        if (completed) return;
        completed = true; clearTimeout(timeout); ws.terminate(); reject(error);
      };
      ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', name: 'Teste deploy' })));
      ws.on('message', raw => {
        try {
          const message = JSON.parse(String(raw));
          if (message.type === 'lobbyWelcome') {
            completed = true; clearTimeout(timeout);
            console.log('WebSocket OK; lobby multiplayer respondeu.');
            ws.close(); resolve();
          } else if (message.type === 'error') fail(new Error(message.message));
        } catch (error) { fail(error); }
      });
      ws.on('error', error => fail(error));
      ws.on('unexpected-response', (_, response) => fail(new Error(`WebSocket HTTP ${response.statusCode}; confira ALLOWED_ORIGINS.`)));
      ws.on('close', (code) => { if (!completed) fail(new Error(`Conexao encerrada antes do lobby (codigo ${code}).`)); });
    });
    console.log('\nServidor acessivel. Agora teste a interface da Vercel em dois navegadores.');
  } catch (error) {
    console.error('\nFALHA:', error.message);
    process.exitCode = 1;
  }
}
