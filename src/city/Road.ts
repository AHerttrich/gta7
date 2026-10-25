import * as THREE from 'three';

export class Road {
  public static createRoadMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: 0x1f242e,
      roughness: 0.85,
      metalness: 0.1,
    });
  }

  public static createSidewalkMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: 0x6e788c,
      roughness: 0.9,
    });
  }

  public static createLaneDashes(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    isCenter: boolean = false,
  ): THREE.Mesh {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const angle = Math.atan2(x2 - x1, z2 - z1);

    const geo = new THREE.PlaneGeometry(isCenter ? 0.35 : 0.25, length);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: isCenter ? 0xffbf00 : 0xffffff,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
    mesh.rotation.y = angle;
    return mesh;
  }
}
