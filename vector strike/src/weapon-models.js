// Modelos 3D originais fornecidos para o projeto. Todos os caminhos ficam em public/models.
// Sem dependência do servidor, para que a física e os danos continuem autoritativos.
export const FIREARM_MODELS = Object.freeze({
  pistol: 'p320',
  p226: 'p226',
  sr1mp: 'sr1mp',
  heavyPistol: 'revolver',
  magnum: 'revolver_magnum',
  smg: 'mpx',
  mpa: 'mpa',
  mpsd: 'mpsd',
  rifle: 'mdr',
  mk14: 'mk14',
  m21: 'm21',
  sniper: 'srsa1',
  chassis: 'chassis',
  rpg: 'rpg',
});

export const MODEL_FILES = Object.freeze(Object.fromEntries(
  Object.entries(FIREARM_MODELS).map(([id, filename]) => [id, `/models/${filename}.glb`])
));

// Comprimento aproximado da arma na mão em unidades do jogo.
export function visualGunLength(id, slot = 'primary') {
  if (id === 'rpg') return 1.16;
  if (['sniper', 'chassis', 'm21'].includes(id)) return 1.17;
  if (['rifle', 'mk14'].includes(id)) return .98;
  if (['smg', 'mpa', 'mpsd'].includes(id)) return .82;
  return slot === 'sidearm' ? .49 : .98;
}
