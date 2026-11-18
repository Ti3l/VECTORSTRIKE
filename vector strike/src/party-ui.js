// Apresentação dos seis slots do lobby — sem inventar jogadores nem estatísticas.
export function partyCardsHTML(state, selfId, escapeHTML = value => String(value)) {
  const members = state?.members || [];
  const ownerId = state?.ownerId;
  return Array.from({ length: 6 }, (_, index) => {
    const player = members[index];
    const slot = String(index + 1).padStart(2, '0');
    if (!player) return `<button type="button" class="party-banner party-banner-empty" data-focus-invite="true" aria-label="Convidar jogador para a vaga ${index + 1}">
        <span class="party-banner-index">${slot}</span><span class="party-slot-plus">+</span><span class="party-slot-title">CONVIDAR</span><span class="party-slot-description">VAGA DISPONÍVEL</span></button>`;
    const own = player.id === selfId, leader = player.id === ownerId;
    const team = player.team === 'defenders' ? 'defenders' : 'attackers';
    const name = escapeHTML(player.name);
    const initial = escapeHTML(String(player.name).trim().slice(0,1).toUpperCase());
    return `<div class="party-banner party-banner-filled ${leader?'is-leader':''} ${own?'is-self':''} team-${team}" aria-label="${name}, ${player.ready?'pronto':'aguardando'}">
      <div class="party-banner-top"><span>${slot}</span><span>${leader?'◆ LÍDER':own?'VOCÊ':'OPERADOR'}</span></div>
      <div class="party-banner-art" aria-hidden="true"><div class="party-banner-geometry"><span></span><span></span><span></span></div><div class="party-banner-initial">${initial}</div><div class="party-banner-signal">V/S</div></div>
      <div class="party-banner-meta"><span class="party-banner-ready ${player.ready?'ready':''}">${player.ready?'● PRONTO':'○ AGUARDANDO'}</span><strong title="${name}">${name}</strong><span class="party-banner-team">${team==='attackers'?'ATACANTES':'DEFENSORES'}</span></div>
      <div class="party-banner-footer"><span>${leader?'◈ COMANDO':'VECTOR STRIKE'}</span><span>◆</span></div></div>`;
  }).join('');
}
