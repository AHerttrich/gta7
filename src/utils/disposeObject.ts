import * as THREE from 'three';

/**
 * Traverses an Object3D hierarchy and safely disposes geometries and materials,
 * skipping any marked with `userData.shared = true`.
 */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry && !mesh.geometry.userData?.shared) {
      mesh.geometry.dispose();
    }

    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        for (const mat of mesh.material) {
          disposeMaterial(mat);
        }
      } else {
        disposeMaterial(mesh.material);
      }
    }
  });
}

function disposeMaterial(mat: THREE.Material): void {
  if (mat.userData?.shared) return;
  const standard = mat as THREE.MeshStandardMaterial;
  if (standard.map && !standard.map.userData?.shared) {
    standard.map.dispose();
  }
  mat.dispose();
}
