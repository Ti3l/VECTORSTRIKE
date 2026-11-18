// Regras puras do lobby multiplayer. Nomes são temporários nesta versão;
// uma conta/autenticação permanente ficará para uma atualização posterior.
export function normalizeName(value) {
  return String(value ?? '').replace(/[<>\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, 17);
}
export function nameKey(value) { return normalizeName(value).toLocaleLowerCase('pt-BR'); }
export function selectTeam(players) {
  const count = team => [...players].filter(player => player.team === team).length;
  return count('attackers') <= count('defenders') ? 'attackers' : 'defenders';
}
export function canStartParty(room, maxPlayers = 6) {
  if (room.phase !== 'lobby') return { ok: false, reason: 'A partida já começou.' };
  const members = [...room.players.values()];
  if (members.length < 2) return { ok: false, reason: 'Convide pelo menos um amigo para começar.' };
  if (members.length > maxPlayers) return { ok: false, reason: 'Grupo acima do limite de jogadores.' };
  if (!members.some(p => p.team === 'attackers') || !members.some(p => p.team === 'defenders')) {
    return { ok: false, reason: 'É necessário um jogador em cada equipe.' };
  }
  if (members.some(p => !p.ready)) return { ok: false, reason: 'Aguardando todos marcarem PRONTO.' };
  return { ok: true, reason: 'Grupo pronto para iniciar!' };
}
export function publicPartyState(room) {
  return {
    room: room.code, ownerId: room.ownerId, phase: room.phase,
    members: [...room.players.values()].map(p => ({ id: p.id, name: p.name, team: p.team, ready: !!p.ready })),
  };
}
