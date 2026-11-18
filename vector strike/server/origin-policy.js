// Helper puro para testes e servidores com WebSocket.
export function parseAllowedOrigins(value) {
  return new Set(String(value || '').split(',').map(s => s.trim()).filter(Boolean));
}
export function isAllowedOrigin(origin, allowedOrigins) {
  return allowedOrigins.size === 0 || (typeof origin === 'string' && allowedOrigins.has(origin));
}
