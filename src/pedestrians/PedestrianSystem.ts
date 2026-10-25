import * as THREE from 'three';
import { CITY_CONFIG } from '../utils/Constants';

export interface Pedestrian {
  id: number;
  group: THREE.Group;
  x: number;
  z: number;
  speed: number;
  direction: 'N' | 'S' | 'E' | 'W';
  rotationY: number;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  animTimer: number;
  isPanicking: boolean;
  panicTimer: number;
}

export class PedestrianSystem {
  public pedestrians: Pedestrian[] = [];
  public group: THREE.Group;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.spawnPedestrians(24);
  }

  private spawnPedestrians(count: number): void {
    const { GRID_SIZE, BLOCK_SIZE, ROAD_WIDTH } = CITY_CONFIG;
    const step = BLOCK_SIZE + ROAD_WIDTH;
    const halfSize = (GRID_SIZE * step) / 2;

    const shirtColors = [
      0xef4444, // Red
      0x3b82f6, // Blue
      0x10b981, // Emerald
      0xf59e0b, // Amber
      0xec4899, // Pink
      0x64748b, // Slate
    ];

    for (let i = 0; i < count; i++) {
      const blockI = i % GRID_SIZE;
      const blockJ = Math.floor(i / GRID_SIZE) % GRID_SIZE;

      const blockCenterX = -halfSize + blockI * step + step / 2;
      const blockCenterZ = -halfSize + blockJ * step + step / 2;

      // Place along sidewalk rim of the block
      const rim = (BLOCK_SIZE / 2) * 0.95;
      const side = i % 4;

      let x = blockCenterX;
      let z = blockCenterZ;
      let dir: 'N' | 'S' | 'E' | 'W' = 'S';
      let rotY = 0;

      if (side === 0) {
        x += rim;
        z += (Math.random() - 0.5) * BLOCK_SIZE * 0.8;
        dir = 'S';
        rotY = 0;
      } else if (side === 1) {
        x -= rim;
        z += (Math.random() - 0.5) * BLOCK_SIZE * 0.8;
        dir = 'N';
        rotY = Math.PI;
      } else if (side === 2) {
        z += rim;
        x += (Math.random() - 0.5) * BLOCK_SIZE * 0.8;
        dir = 'E';
        rotY = Math.PI / 2;
      } else {
        z -= rim;
        x += (Math.random() - 0.5) * BLOCK_SIZE * 0.8;
        dir = 'W';
        rotY = -Math.PI / 2;
      }

      const shirtColor = shirtColors[i % shirtColors.length];
      this.createPedestrian(x, z, dir, rotY, shirtColor);
    }
  }

  private createPedestrian(
    x: number,
    z: number,
    direction: 'N' | 'S' | 'E' | 'W',
    rotationY: number,
    shirtColor: number,
  ): void {
    const pedGroup = new THREE.Group();

    // Torso / Shirt
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.75, 0.35);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: shirtColor,
      roughness: 0.7,
    });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    pedGroup.add(torso);

    // Head
    const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.8,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.75;
    head.castShadow = true;
    pedGroup.add(head);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.14, 0.38, 0);
    leftLeg.castShadow = true;

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.14, 0.38, 0);
    rightLeg.castShadow = true;

    pedGroup.add(leftLeg, rightLeg);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.14, 0.65, 0.16);
    const armMat = new THREE.MeshStandardMaterial({ color: shirtColor });

    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.38, 1.15, 0);
    leftArm.castShadow = true;

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.38, 1.15, 0);
    rightArm.castShadow = true;

    pedGroup.add(leftArm, rightArm);

    pedGroup.position.set(x, 0.25, z); // On sidewalk height
    pedGroup.rotation.y = rotationY;
    this.group.add(pedGroup);

    this.pedestrians.push({
      id: Math.floor(Math.random() * 1000000),
      group: pedGroup,
      x,
      z,
      speed: 2.2 + Math.random() * 1.2,
      direction,
      rotationY,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      animTimer: Math.random() * 10,
      isPanicking: false,
      panicTimer: 0,
    });
  }

  public scareNearby(x: number, z: number, radius: number = 14): void {
    for (const ped of this.pedestrians) {
      const dist = Math.hypot(x - ped.x, z - ped.z);
      if (dist < radius) {
        ped.isPanicking = true;
        ped.panicTimer = 3.5;
        // Turn away from threat
        ped.rotationY = Math.atan2(ped.x - x, ped.z - z);
        ped.group.rotation.y = ped.rotationY;
      }
    }
  }

  public update(dt: number, carX: number, carZ: number, carSpeed: number): void {
    for (const ped of this.pedestrians) {
      // Check if fast car is approaching
      const distToCar = Math.hypot(carX - ped.x, carZ - ped.z);
      if (distToCar < 8.0 && Math.abs(carSpeed) > 10.0) {
        ped.isPanicking = true;
        ped.panicTimer = 3.0;
        ped.rotationY = Math.atan2(ped.x - carX, ped.z - carZ);
        ped.group.rotation.y = ped.rotationY;
      }

      if (ped.isPanicking) {
        ped.panicTimer -= dt;
        if (ped.panicTimer <= 0) {
          ped.isPanicking = false;
        }
      }

      const speed = ped.isPanicking ? ped.speed * 2.8 : ped.speed;

      // Move along forward heading
      ped.x += Math.sin(ped.rotationY) * speed * dt;
      ped.z += Math.cos(ped.rotationY) * speed * dt;

      ped.group.position.set(ped.x, 0.25, ped.z);

      // Swing walking animation
      ped.animTimer += dt * (ped.isPanicking ? 18 : 8);
      const swing = Math.sin(ped.animTimer) * 0.6;
      ped.leftLeg.rotation.x = swing;
      ped.rightLeg.rotation.x = -swing;
      ped.leftArm.rotation.x = -swing * 0.8;
      ped.rightArm.rotation.x = swing * 0.8;
    }
  }
}
