// Ferramentas simples para evitar falsos picos na leitura do ping e
// impedir que snapshots obsoletos se acumulem em conexoes lentas.
export const SNAPSHOT_INTERVAL_MS = 50; // alvo de 20 snapshots/segundo
export const MAX_SNAPSHOT_BUFFER_BYTES = 192 * 1024;

export function canSendSnapshot(socket, openState = 1) {
  return !!socket && socket.readyState === openState &&
    Number.isFinite(socket.bufferedAmount) &&
    socket.bufferedAmount < MAX_SNAPSHOT_BUFFER_BYTES;
}

export function updateLatencySamples(history, ms, maxSamples = 7) {
  if (!Number.isFinite(ms) || ms < 0 || ms > 30000) return history.slice();
  return [...history, ms].slice(-maxSamples);
}

export function latencySummary(history) {
  if (!history.length) return { ping: 0, jitter: 0 };
  const ordered = [...history].sort((a,b)=>a-b);
  const mid = Math.floor(ordered.length / 2);
  const ping = ordered.length % 2 ? ordered[mid] : (ordered[mid-1]+ordered[mid])/2;
  let changeSum = 0;
  for(let i=1; i<history.length; i++) changeSum += Math.abs(history[i]-history[i-1]);
  return { ping: Math.round(ping), jitter: history.length<2 ? 0 : Math.round(changeSum/(history.length-1)) };
}
