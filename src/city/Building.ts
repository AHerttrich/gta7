import * as THREE from 'three';

export interface BuildingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

export class Building {
  public static createBuilding(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    accentColor: number = 0x00d4ff,
  ): { mesh: THREE.Group; bounds: BuildingBox } {
    const group = new THREE.Group();

    // Main tower block
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1b2234,
      roughness: 0.6,
      metalness: 0.3,
    });

    const mainMesh = new THREE.Mesh(geo, mat);
    mainMesh.position.set(x, height / 2, z);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    group.add(mainMesh);

    // Neon edge strip along roof
    const neonGeo = new THREE.BoxGeometry(width + 0.2, 0.4, depth + 0.2);
    const neonMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const neonRoof = new THREE.Mesh(neonGeo, neonMat);
    neonRoof.position.set(x, height + 0.2, z);
    group.add(neonRoof);

    // Rooftop AC unit
    const acGeo = new THREE.BoxGeometry(width * 0.3, 1.8, depth * 0.3);
    const acMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const acMesh = new THREE.Mesh(acGeo, acMat);
    acMesh.position.set(x + width * 0.2, height + 0.9, z - depth * 0.2);
    acMesh.castShadow = true;
    group.add(acMesh);

    return {
      mesh: group,
      bounds: {
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2,
        height,
      },
    };
  }

  // Stunt jump ramp generator!
  public static createRamp(
    x: number,
    z: number,
    width: number,
    length: number,
    height: number,
    rotY: number = 0,
  ): { mesh: THREE.Group; bounds: BuildingBox } {
    const group = new THREE.Group();

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(length, 0);
    shape.lineTo(length, height);
    shape.closePath();

    const extrudeSettings = { depth: width, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Hazard Yellow/Orange
      roughness: 0.5,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, height / 2, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    return {
      mesh: group,
      bounds: {
        minX: x - width,
        maxX: x + width,
        minZ: z - length,
        maxZ: z + length,
        height,
      },
    };
  }
}
