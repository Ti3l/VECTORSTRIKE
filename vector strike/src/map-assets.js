// Assets do pacote FPS_Lite_FBX.zip enviado pelo usuário. FBX 7400 + atlas de cor.
// Apenas visual: física, tiros, bots e colisões usam CRATES em shared.js.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const BASE = '/map/fps-lite/';
const FILES = [
  'Building_01', 'Jug_01', 'Jug_02', 'Stairs_01',
  'Wall_01', 'Wall_02', 'Wall_03', 'WallPart_01',
  'WoodPlank_01', 'WoodPlank_02', 'WoodPlank_03', 'Box_01', 'Brick_01',
];
const manager = new THREE.LoadingManager();
manager.setURLModifier(url => /FPSLite_Texture_01\.png/i.test(url) ? BASE + 'FPSLite_Texture_01.png' : url);
const loader = new FBXLoader(manager);
const textureLoader = new THREE.TextureLoader(manager);
const modelCache = new Map();
const atlas = textureLoader.load(BASE + 'FPSLite_Texture_01.png');
atlas.colorSpace = THREE.SRGBColorSpace;

export const MAP_ASSET_FILES = Object.freeze(FILES);
function loadModel(name) {
  if (!FILES.includes(name)) return Promise.reject(new Error(`Modelo não cadastrado: ${name}`));
  if (!modelCache.has(name)) {
    modelCache.set(name, new Promise((resolve, reject) => {
      loader.load(BASE + name + '.fbx', object => {
        const material = new THREE.MeshStandardMaterial({
          map: atlas, side: THREE.DoubleSide, roughness: .86, metalness: .08,
        });
        object.traverse(child => {
          if (!child.isMesh) return;
          child.material = material;
          child.castShadow = true;
          child.receiveShadow = true;
        });
        resolve(object);
      }, undefined, reject);
    }));
  }
  return modelCache.get(name);
}
function placeModel(prototype, item, terrain) {
  const clone = prototype.clone(true);
  // FBX de várias dimensões: encaixe por bounding-box, independente de unidade de exportação.
  clone.updateMatrixWorld(true);
  const original = new THREE.Box3().setFromObject(clone);
  const size = original.getSize(new THREE.Vector3());
  if (!(size.x > 1e-5 && size.y > 1e-5 && size.z > 1e-5)) return null;
  const stretch = new THREE.Vector3(
    THREE.MathUtils.clamp(item.w / size.x, .00001, 4000),
    THREE.MathUtils.clamp(item.h / size.y, .00001, 4000),
    THREE.MathUtils.clamp(item.d / size.z, .00001, 4000),
  );
  clone.scale.multiply(stretch);
  clone.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(clone);
  const center = fitted.getCenter(new THREE.Vector3());
  clone.position.add(new THREE.Vector3(item.x - center.x, (item.y ?? 0) + item.h/2 - center.y, item.z - center.z));
  terrain.add(clone);
  return clone;
}
export function installMapAssets(terrain, covers) {
  // Permite renderização imediata dos sólidos geométricos antes dos FBX carregarem.
  for (const { cover, fallback } of covers) {
    if (!cover.asset) continue;
    loadModel(cover.asset).then(model => {
      const instance = placeModel(model, cover, terrain);
      if (instance) fallback.visible = false;
    }).catch(error => console.warn('[Mapa] Fallback geométrico:', cover.asset, error.message));
  }
  // Assets complementares sobre blocos sólidos, sem modificar colisão/linha de tiro.
  // Os objetos pequenos ficam no topo das estruturas: não criam obstáculos invisíveis.
  const details = [
    {asset:'Jug_01',x:-26.8,z:-23.7,y:3.6,w:.76,h:1.2,d:.76},
    {asset:'Jug_02',x:-25.5,z:-23.2,y:3.6,w:.72,h:.95,d:.72},
    {asset:'WoodPlank_01',x:-4,z:-8.4,y:4.16,w:3.9,h:.20,d:1.25},
    {asset:'WoodPlank_02',x:-4,z:8.4,y:4.16,w:4.1,h:.20,d:1.25},
    {asset:'WoodPlank_03',x:2,z:23,y:3.5,w:3.4,h:.20,d:1.2},
    {asset:'Brick_01',x:-12,z:21.5,y:3.7,w:1.3,h:.65,d:.9},
    {asset:'Stairs_01',x:2,z:-23,y:3.5,w:2.5,h:1.4,d:2},
    {asset:'WallPart_01',x:-26,z:23,y:3.6,w:3.3,h:1.1,d:.7},
  ];
  for (const item of details) {
    loadModel(item.asset).then(model => placeModel(model, item, terrain))
      .catch(error => console.warn('[Mapa] Detalhe indisponível:', item.asset, error.message));
  }
}
