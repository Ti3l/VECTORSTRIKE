// Endereco do servidor multiplayer. Durante o desenvolvimento, o Vite usa /ws local.
// Na Vercel, VITE_WS_URL aponta para o servico que executa server/index.js.
export function resolveWebSocketUrl(configured, pageHref) {
  const base = new URL(pageHref);
  const value = String(configured || '').trim();
  const socket = new URL(value || '/ws', base);
  if (socket.protocol === 'https:') socket.protocol = 'wss:';
  if (socket.protocol === 'http:') socket.protocol = 'ws:';
  if (socket.protocol !== 'ws:' && socket.protocol !== 'wss:') {
    throw new Error('A URL do servidor precisa usar HTTPS, WSS, HTTP ou WS.');
  }
  if (base.protocol === 'https:' && socket.protocol !== 'wss:') {
    throw new Error('Em um site HTTPS, configure um servidor WSS/HTTPS.');
  }
  // A raiz do backend encaminha a conexao ao endpoint /ws.
  if (socket.pathname === '/' || !socket.pathname) socket.pathname = '/ws';
  socket.search = '';
  socket.hash = '';
  return socket.toString();
}

export function isVercelWithoutBackend(hostname, configured, production = true) {
  return production && !String(configured || '').trim() &&
    /(?:^|\.)vercel\.app$/i.test(String(hostname));
}
