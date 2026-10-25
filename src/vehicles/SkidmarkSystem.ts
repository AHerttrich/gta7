import * as THREE from 'three';

interface Skidmark {
  meshL: THREE.Mesh;
  meshR: THREE.Mesh;
  opacity: number;
  life: number;
  active: boolean;
}

export class SkidmarkSystem {
  public group: THREE.Group;
  private skidmarks: Skidmark[] = [];
  private maxSkidmarks: number = 60;
  private currentIndex: number = 0;

  private lastEmissionX: number = 0;
  private lastEmissionZ: number = 0;

  // Tire smoke particles during burnout / drift
  public smokeParticles: THREE.Points;
  private smokePositions: Float32Array;
  private smokeMaterial: THREE.PointsMaterial;
  private maxSmoke: number = 40;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const quadGeo = new THREE.PlaneGeometry(0.35, 1.2);
    quadGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < this.maxSkidmarks; i++) {
      const matL = new THREE.MeshBasicMaterial({
        color: 0x111620,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const matR = new THREE.MeshBasicMaterial({
        color: 0x111620,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });

      const meshL = new THREE.Mesh(quadGeo, matL);
      const meshR = new THREE.Mesh(quadGeo, matR);
      meshL.visible = false;
      meshR.visible = false;

      this.group.add(meshL);
      this.group.add(meshR);

      this.skidmarks.push({
        meshL,
        meshR,
        opacity: 0,
        life: 0,
        active: false,
      });
    }

    // Tire smoke particle system
    const smokeGeo = new THREE.BufferGeometry();
    this.smokePositions = new Float32Array(this.maxSmoke * 3);
    for (let i = 0; i < this.maxSmoke * 3; i++) {
      this.smokePositions[i] = 0;
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(this.smokePositions, 3));

    this.smokeMaterial = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 1.2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.smokeParticles = new THREE.Points(smokeGeo, this.smokeMaterial);
    scene.add(this.smokeParticles);
  }

  public update(
    dt: number,
    carX: number,
    carZ: number,
    heading: number,
    speed: number,
    isDrifting: boolean,
    isBurnout: boolean,
    isAirborne: boolean,
  ): void {
    // 1. Age and fade existing skidmarks
    for (const sm of this.skidmarks) {
      if (!sm.active) continue;
      sm.life -= dt;
      if (sm.life <= 0) {
        sm.active = false;
        sm.meshL.visible = false;
        sm.meshR.visible = false;
      } else {
        sm.opacity = Math.max(0, sm.life / 8.0) * 0.65;
        (sm.meshL.material as THREE.MeshBasicMaterial).opacity = sm.opacity;
        (sm.meshR.material as THREE.MeshBasicMaterial).opacity = sm.opacity;
      }
    }

    // 2. Check if new skidmarks should be laid down
    const shouldSkid =
      !isAirborne &&
      (isDrifting || (isBurnout && Math.abs(speed) > 1.0) || (Math.abs(speed) > 16.0 && isBurnout));

    if (shouldSkid) {
      const dist = Math.hypot(carX - this.lastEmissionX, carZ - this.lastEmissionZ);
      if (dist >= 0.75) {
        this.lastEmissionX = carX;
        this.lastEmissionZ = carZ;

        const normalX = Math.cos(heading);
        const normalZ = -Math.sin(heading);
        const trackHalfWidth = 0.85;
        const rearOffset = 1.35; // rear axle position

        const rearCenterX = carX - Math.sin(heading) * rearOffset;
        const rearCenterZ = carZ - Math.cos(heading) * rearOffset;

        const leftX = rearCenterX - normalX * trackHalfWidth;
        const leftZ = rearCenterZ - normalZ * trackHalfWidth;
        const rightX = rearCenterX + normalX * trackHalfWidth;
        const rightZ = rearCenterZ + normalZ * trackHalfWidth;

        const sm = this.skidmarks[this.currentIndex];
        sm.active = true;
        sm.life = 8.0;
        sm.opacity = 0.65;

        sm.meshL.position.set(leftX, 0.025, leftZ);
        sm.meshL.rotation.y = heading;
        sm.meshL.visible = true;
        (sm.meshL.material as THREE.MeshBasicMaterial).opacity = 0.65;

        sm.meshR.position.set(rightX, 0.025, rightZ);
        sm.meshR.rotation.y = heading;
        sm.meshR.visible = true;
        (sm.meshR.material as THREE.MeshBasicMaterial).opacity = 0.65;

        this.currentIndex = (this.currentIndex + 1) % this.maxSkidmarks;
      }

      // Tire smoke animation
      this.smokeMaterial.opacity = THREE.MathUtils.lerp(this.smokeMaterial.opacity, 0.6, 0.2);
      const rearX = carX - Math.sin(heading) * 1.35;
      const rearZ = carZ - Math.cos(heading) * 1.35;

      for (let i = 0; i < this.maxSmoke; i++) {
        const idx = i * 3;
        this.smokePositions[idx + 1] += dt * 1.8;
        if (this.smokePositions[idx + 1] > 2.0 || Math.random() < 0.1) {
          this.smokePositions[idx] = rearX + (Math.random() - 0.5) * 1.6;
          this.smokePositions[idx + 1] = 0.2 + Math.random() * 0.3;
          this.smokePositions[idx + 2] = rearZ + (Math.random() - 0.5) * 1.6;
        }
      }
      this.smokeParticles.geometry.attributes.position.needsUpdate = true;
    } else {
      this.smokeMaterial.opacity = THREE.MathUtils.lerp(this.smokeMaterial.opacity, 0.0, 0.15);
    }
  }

  public clear(): void {
    for (const sm of this.skidmarks) {
      sm.active = false;
      sm.meshL.visible = false;
      sm.meshR.visible = false;
    }
  }
}
