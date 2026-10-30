import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface StaticBatchOptions {
  /** World-space XZ cell size used to chunk merged meshes so frustum culling still works. */
  cellSize: number;
  /** Return true to keep a mesh out of batching (e.g. it is animated or referenced elsewhere). */
  exclude?: (mesh: THREE.Mesh) => boolean;
}

export interface StaticBatchResult {
  meshesBefore: number;
  meshesAfter: number;
  batches: number;
}

const TEXTURE_SLOTS = [
  'map',
  'emissiveMap',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'alphaMap',
  'aoMap',
  'lightMap',
  'bumpMap',
  'displacementMap',
  'envMap',
] as const;

/**
 * Builds a key that is identical for materials which render identically, so equivalent
 * material instances (created per building / per prop) can share one draw call.
 * Materials with features this key does not model are keyed by identity (never merged
 * with a different instance).
 */
function materialKey(mat: THREE.Material): string {
  const m = mat as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
  const hasCustomShader = mat.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile;
  const hasUserData = Object.keys(mat.userData).length > 0;
  if (hasCustomShader || hasUserData) return `id:${mat.uuid}`;

  const parts: (string | number | boolean | undefined)[] = [
    mat.type,
    m.color?.getHex(),
    m.emissive?.getHex(),
    m.emissiveIntensity,
    m.roughness,
    m.metalness,
    m.flatShading,
    m.wireframe,
    m.fog,
    mat.side,
    mat.opacity,
    mat.transparent,
    mat.alphaTest,
    mat.blending,
    mat.depthTest,
    mat.depthWrite,
    mat.colorWrite,
    mat.toneMapped,
    mat.vertexColors,
    mat.polygonOffset,
    mat.polygonOffsetFactor,
    mat.polygonOffsetUnits,
    mat.visible,
  ];
  for (const slot of TEXTURE_SLOTS) {
    const tex = (m as unknown as Record<string, THREE.Texture | null | undefined>)[slot];
    parts.push(tex ? tex.uuid : '');
  }
  return parts.join('|');
}

function attributeSignature(geo: THREE.BufferGeometry): string {
  const names = Object.keys(geo.attributes).sort();
  const sig = names.map((n) => {
    const a = geo.attributes[n] as THREE.BufferAttribute;
    return `${n}:${a.itemSize}:${a.normalized}`;
  });
  return `${geo.index ? 'i' : 'n'}|${sig.join(',')}`;
}

function isEffectivelyVisible(obj: THREE.Object3D, root: THREE.Object3D): boolean {
  let o: THREE.Object3D | null = obj;
  while (o && o !== root) {
    if (!o.visible) return false;
    o = o.parent;
  }
  return true;
}

/**
 * Merges static, opaque meshes below `root` that share an equivalent material into one mesh
 * per (material, spatial cell). Dramatically reduces draw calls for static scenery while
 * keeping visuals identical. Transparent, instanced, multi-material, hidden or mirrored meshes
 * are left untouched.
 *
 * Only call this on content that never moves, animates, or is mutated after construction.
 */
export function batchStaticMeshes(
  root: THREE.Object3D,
  options: StaticBatchOptions,
): StaticBatchResult {
  root.updateWorldMatrix(true, true);
  const invRoot = root.matrixWorld.clone().invert();

  let meshesBefore = 0;
  const groups = new Map<string, THREE.Mesh[]>();
  const geometryUsers = new Map<THREE.BufferGeometry, number>();
  const materialUsers = new Map<THREE.Material, number>();
  const box = new THREE.Box3();
  const center = new THREE.Vector3();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshesBefore++;
    geometryUsers.set(mesh.geometry, (geometryUsers.get(mesh.geometry) ?? 0) + 1);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) materialUsers.set(m, (materialUsers.get(m) ?? 0) + 1);

    if (
      (mesh as THREE.InstancedMesh).isInstancedMesh ||
      (mesh as THREE.SkinnedMesh).isSkinnedMesh ||
      Array.isArray(mesh.material) ||
      mesh.material.transparent ||
      !mesh.geometry.attributes.position ||
      mesh.morphTargetInfluences ||
      mesh.matrixWorld.determinant() <= 0 ||
      !isEffectivelyVisible(mesh, root) ||
      options.exclude?.(mesh)
    ) {
      return;
    }

    box.setFromObject(mesh);
    box.getCenter(center);
    const cx = Math.floor(center.x / options.cellSize);
    const cz = Math.floor(center.z / options.cellSize);
    const key = [
      materialKey(mesh.material),
      mesh.castShadow,
      mesh.receiveShadow,
      mesh.renderOrder,
      attributeSignature(mesh.geometry),
      cx,
      cz,
    ].join('#');

    let list = groups.get(key);
    if (!list) {
      list = [];
      groups.set(key, list);
    }
    list.push(mesh);
  });

  let batches = 0;
  let removed = 0;
  const rel = new THREE.Matrix4();

  for (const list of groups.values()) {
    if (list.length < 2) continue;

    const geos: THREE.BufferGeometry[] = [];
    for (const mesh of list) {
      rel.multiplyMatrices(invRoot, mesh.matrixWorld);
      const g = mesh.geometry.clone();
      g.applyMatrix4(rel);
      // Multi-material groups are irrelevant for single-material meshes and break merging.
      g.clearGroups();
      geos.push(g);
    }

    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();

    const first = list[0];
    const batch = new THREE.Mesh(merged, first.material);
    batch.name = 'static_batch';
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    batch.renderOrder = first.renderOrder;
    batch.matrixAutoUpdate = false;
    batch.updateMatrix();
    root.add(batch);
    materialUsers.set(
      first.material as THREE.Material,
      (materialUsers.get(first.material as THREE.Material) ?? 0) + 1,
    );
    batches++;

    for (const mesh of list) {
      mesh.removeFromParent();
      removed++;
      const gUsers = (geometryUsers.get(mesh.geometry) ?? 1) - 1;
      geometryUsers.set(mesh.geometry, gUsers);
      if (gUsers <= 0 && !mesh.geometry.userData.shared) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material;
      const mUsers = (materialUsers.get(mat) ?? 1) - 1;
      materialUsers.set(mat, mUsers);
      if (mUsers <= 0 && !mat.userData.shared) mat.dispose();
    }
  }

  pruneEmptyNodes(root);

  // Everything left below root is static: freeze local matrices to skip per-frame recomposition.
  root.traverse((obj) => {
    if (obj === root) return;
    obj.updateMatrix();
    obj.matrixAutoUpdate = false;
  });

  return { meshesBefore, meshesAfter: meshesBefore - removed + batches, batches };
}

/** Removes plain group/Object3D nodes left without children after batching. */
function pruneEmptyNodes(root: THREE.Object3D): void {
  const empties: THREE.Object3D[] = [];
  const visit = (node: THREE.Object3D): boolean => {
    let hasContent = false;
    for (const child of [...node.children]) {
      if (visit(child)) hasContent = true;
    }
    const isContainer = node.type === 'Group' || node.type === 'Object3D';
    if (node !== root && isContainer && !hasContent) {
      empties.push(node);
      return false;
    }
    return hasContent || !isContainer || node === root;
  };
  visit(root);
  for (const e of empties) e.removeFromParent();
}
