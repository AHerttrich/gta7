import * as THREE from 'three';

interface SkidmarkPair {
  life: number;
  active: boolean;
}

export class SkidmarkSystem {
  public group: THREE.Group;
  private instancedMesh: THREE.InstancedMesh;
  private pairs: SkidmarkPair[] = [];
  private maxPairs: number = 60;
  private currentIndex: number = 0;
  private dummy: THREE.Object3D = new THREE.Object3D();

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

    const sharedMat = new THREE.MeshBasicMaterial({
      color: 0x111620,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });

    this.instancedMesh = new THREE.InstancedMesh(quadGeo, sharedMat, this.maxPairs * 2);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();

    for (let i = 0; i < this.maxPairs * 2; i++) {
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.instancedMesh);

    for (let i = 0; i < this.maxPairs; i++) {
      this.pairs.push({
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
    let matrixChanged = false;

    // 1. Age and fade existing skidmarks
    for (let i = 0; i < this.maxPairs; i++) {
      const pair = this.pairs[i];
      if (!pair.active) continue;
      pair.life -= dt;
      if (pair.life <= 0) {
        pair.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i * 2, this.dummy.matrix);
        this.instancedMesh.setMatrixAt(i * 2 + 1, this.dummy.matrix);
        matrixChanged = true;
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

        const pair = this.pairs[this.currentIndex];
        pair.active = true;
        pair.life = 8.0;

        this.dummy.position.set(leftX, 0.025, leftZ);
        this.dummy.rotation.set(0, heading, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(this.currentIndex * 2, this.dummy.matrix);

        this.dummy.position.set(rightX, 0.025, rightZ);
        this.dummy.rotation.set(0, heading, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(this.currentIndex * 2 + 1, this.dummy.matrix);

        matrixChanged = true;
        this.currentIndex = (this.currentIndex + 1) % this.maxPairs;
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

    if (matrixChanged) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public clear(): void {
    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.maxPairs; i++) {
      this.pairs[i].active = false;
      this.pairs[i].life = 0;
      this.instancedMesh.setMatrixAt(i * 2, this.dummy.matrix);
      this.instancedMesh.setMatrixAt(i * 2 + 1, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
}
