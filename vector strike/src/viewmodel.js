// VECTOR STRIKE 1.3.3 — poses em primeira pessoa inspiradas no enquadramento
// de jogos FPS táticos: empunhadura à direita e cano na diagonal para o centro.
// As coordenadas são relativas à câmera e independentes de WebGL/Three.js.
// +X = direita, -Y = baixo, -Z = à frente. Rotação Y positiva vira o
// cano (-Z) para a esquerda; rotação X positiva o levanta levemente.

const POSES = Object.freeze({
  pistol: {
    hip: { x: .79, y: -.55, z: -1.10, rx: .20, ry: .49, rz: -.055 },
    ads: { x: .79, y: -.55, z: -1.10, rx: .20, ry: .49, rz: -.055 },
    fov: 76,
  },
  revolver: {
    hip: { x: .85, y: -.59, z: -1.18, rx: .18, ry: .47, rz: -.06 },
    ads: { x: .85, y: -.59, z: -1.18, rx: .18, ry: .47, rz: -.06 },
    fov: 76,
  },
  smg: {
    hip: { x: .77, y: -.61, z: -1.21, rx: .21, ry: .45, rz: -.04 },
    ads: { x: .65, y: -.56, z: -1.26, rx: .15, ry: .32, rz: -.025 },
    fov: 69,
  },
  rifle: {
    hip: { x: .80, y: -.62, z: -1.23, rx: .22, ry: .46, rz: -.045 },
    ads: { x: .65, y: -.55, z: -1.30, rx: .16, ry: .32, rz: -.025 },
    fov: 68,
  },
  shotgun: {
    hip: { x: .79, y: -.63, z: -1.23, rx: .19, ry: .43, rz: -.035 },
    ads: { x: .79, y: -.63, z: -1.23, rx: .19, ry: .43, rz: -.035 },
    fov: 76,
  },
  scoped: {
    hip: { x: .83, y: -.63, z: -1.40, rx: .17, ry: .42, rz: -.035 },
    // Luneta é uma sobreposição na tela; o modelo some quando fica ativa.
    ads: { x: .83, y: -.63, z: -1.40, rx: .17, ry: .42, rz: -.035 },
    fov: 38,
  },
  launcher: {
    hip: { x: .89, y: -.65, z: -1.45, rx: .16, ry: .39, rz: -.03 },
    ads: { x: .89, y: -.65, z: -1.45, rx: .16, ry: .39, rz: -.03 },
    fov: 76,
  },
});

export function getAimMode(weapon, slot) {
  if (['sniper', 'chassis', 'm21'].includes(weapon)) return 'scope';
  if (slot === 'sidearm' || ['shotgun', 'rpg'].includes(weapon)) return 'none';
  return 'ads';
}

export function weaponPoseType(weapon, slot) {
  if (['sniper', 'chassis', 'm21'].includes(weapon)) return 'scoped';
  if (weapon === 'rpg') return 'launcher';
  if (weapon === 'shotgun') return 'shotgun';
  if (['heavyPistol', 'magnum'].includes(weapon)) return 'revolver';
  if (slot === 'sidearm') return 'pistol';
  if (['smg', 'mpa', 'mpsd'].includes(weapon)) return 'smg';
  return 'rifle';
}

export function getWeaponPose(weapon, slot, progress = 0) {
  const poses = POSES[weaponPoseType(weapon, slot)];
  const alpha = getAimMode(weapon, slot) === 'none' ? 0 : Math.max(0, Math.min(1, progress));
  const eased = alpha * alpha * (3 - 2 * alpha);
  const result = {};
  for (const key of ['x', 'y', 'z', 'rx', 'ry', 'rz']) {
    result[key] = poses.hip[key] + (poses.ads[key] - poses.hip[key]) * eased;
  }
  return result;
}

export function getAimFov(weapon, slot, aiming = false) {
  const mode = getAimMode(weapon, slot);
  return aiming && mode !== 'none' ? POSES[weaponPoseType(weapon, slot)].fov : 76;
}

export function approachAim(current, target, delta) {
  const desired = target ? 1 : 0;
  return current + (desired - current) * (1 - Math.exp(-Math.max(0, delta) * 12));
}
