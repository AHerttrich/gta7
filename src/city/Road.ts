import * as THREE from 'three';

export class Road {
  public static createRoadMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: 0x161a23, // Deep sleek dark asphalt
      roughness: 0.7,
      metalness: 0.25,
    });
  }

  public static createSidewalkMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: 0x64748b, // Concrete curb
      roughness: 0.85,
      metalness: 0.1,
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

  public static createCrosswalk(x: number, z: number, isHorizontal: boolean = true): THREE.Group {
    const group = new THREE.Group();
    const stripeCount = 6;
    const stripeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
    });

    for (let s = 0; s < stripeCount; s++) {
      const offset = (s - (stripeCount - 1) / 2) * 1.8;
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 4.5), stripeMat);
      stripe.rotateX(-Math.PI / 2);
      if (isHorizontal) {
        stripe.position.set(x + offset, 0.03, z);
      } else {
        stripe.position.set(x, 0.03, z + offset);
        stripe.rotateZ(Math.PI / 2);
      }
      group.add(stripe);
    }
    return group;
  }

  public static createStreetLamp(x: number, z: number, rotY: number = 0): THREE.Group {
    const group = new THREE.Group();

    // Metallic Pole
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 6.5, 8);
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.2,
    });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 3.25;
    pole.castShadow = true;
    group.add(pole);

    // Curved Top Arm
    const armGeo = new THREE.BoxGeometry(0.12, 0.12, 1.8);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(0, 6.4, 0.8);
    group.add(arm);

    // Glowing Lantern Fixture
    const lampGeo = new THREE.BoxGeometry(0.35, 0.15, 0.6);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfffaed });
    const lantern = new THREE.Mesh(lampGeo, lampMat);
    lantern.position.set(0, 6.25, 1.6);
    group.add(lantern);

    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    return group;
  }

  public static createPalmTree(x: number, z: number): THREE.Group {
    const group = new THREE.Group();

    // Curved Segmented Trunk
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    for (let i = 0; i < 6; i++) {
      const segGeo = new THREE.CylinderGeometry(0.24 - i * 0.02, 0.28 - i * 0.02, 1.2, 7);
      const seg = new THREE.Mesh(segGeo, trunkMat);
      seg.position.set(Math.sin(i * 0.25) * 0.2, 0.6 + i * 1.05, 0);
      seg.rotation.z = -i * 0.04;
      seg.castShadow = true;
      group.add(seg);
    }

    // Lush Palm Fronds
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });

    for (let f = 0; f < 7; f++) {
      const angle = (f / 7) * Math.PI * 2;
      const frondGeo = new THREE.ConeGeometry(0.8, 3.2, 4);
      frondGeo.rotateX(Math.PI / 2.6);
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.set(0, 6.8, 0);
      frond.rotation.y = angle;
      frond.castShadow = true;
      group.add(frond);
    }

    group.position.set(x, 0, z);
    return group;
  }
}
