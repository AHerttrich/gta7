import * as THREE from 'three';
import { CITY_CONFIG } from '../utils/Constants';

export type PedestrianState = 'WALKING' | 'AIRBORNE' | 'GROUNDED';

export interface Pedestrian {
  id: number;
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotVx: number;
  rotVy: number;
  rotVz: number;
  speed: number;
  direction: 'N' | 'S' | 'E' | 'W';
  rotationY: number;
  state: PedestrianState;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  animTimer: number;
  isPanicking: boolean;
  panicTimer: number;
  groundTimer: number;
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
      0x8b5cf6, // Purple
    ];

    for (let i = 0; i < count; i++) {
      const blockI = i % GRID_SIZE;
      const blockJ = Math.floor(i / GRID_SIZE) % GRID_SIZE;

      const blockCenterX = -halfSize + blockI * step + step / 2;
      const blockCenterZ = -halfSize + blockJ * step + step / 2;

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

    // Torso
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

    pedGroup.position.set(x, 0.25, z);
    pedGroup.rotation.y = rotationY;
    this.group.add(pedGroup);

    this.pedestrians.push({
      id: Math.floor(Math.random() * 1000000),
      group: pedGroup,
      x,
      y: 0.25,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      rotVx: 0,
      rotVy: 0,
      rotVz: 0,
      speed: 2.2 + Math.random() * 1.2,
      direction,
      rotationY,
      state: 'WALKING',
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      animTimer: Math.random() * 10,
      isPanicking: false,
      panicTimer: 0,
      groundTimer: 0,
    });
  }

  /**
   * Ragdoll ballistic physics launch when hit by car!
   */
  public launchPedestrian(ped: Pedestrian, impactSpeed: number, impactHeading: number): void {
    ped.state = 'AIRBORNE';
    ped.isPanicking = true;
    ped.panicTimer = 6.0;

    // Launch velocity: forward along car motion + vertical catapult
    const power = Math.max(12.0, impactSpeed * 1.2);
    const scatter = (Math.random() - 0.5) * 0.4;
    const finalHeading = impactHeading + scatter;

    ped.vx = Math.sin(finalHeading) * power;
    ped.vz = Math.cos(finalHeading) * power;
    // Upward launch velocity (catapult into air!)
    ped.vy = Math.min(22.0, 6.0 + impactSpeed * 0.45);

    // Wild tumbling angular velocities in air
    ped.rotVx = (Math.random() - 0.5) * 16.0;
    ped.rotVy = (Math.random() - 0.5) * 12.0;
    ped.rotVz = (Math.random() - 0.5) * 16.0;
  }

  public scareNearby(x: number, z: number, radius: number = 14): void {
    for (const ped of this.pedestrians) {
      if (ped.state !== 'WALKING') continue;
      const dist = Math.hypot(x - ped.x, z - ped.z);
      if (dist < radius) {
        ped.isPanicking = true;
        ped.panicTimer = 3.5;
        ped.rotationY = Math.atan2(ped.x - x, ped.z - z);
        ped.group.rotation.y = ped.rotationY;
      }
    }
  }

  public update(dt: number, carX: number, carZ: number, carSpeed: number): void {
    for (const ped of this.pedestrians) {
      // 1. AIRBORNE Ragdoll Physics (Flying through the air!)
      if (ped.state === 'AIRBORNE') {
        ped.vy -= 26.0 * dt; // Gravity
        ped.x += ped.vx * dt;
        ped.y += ped.vy * dt;
        ped.z += ped.vz * dt;

        // Tumbling spin in 3D
        ped.group.rotation.x += ped.rotVx * dt;
        ped.group.rotation.y += ped.rotVy * dt;
        ped.group.rotation.z += ped.rotVz * dt;

        // Limbs flailing in air
        ped.leftLeg.rotation.x = Math.sin(ped.y * 10) * 1.2;
        ped.rightLeg.rotation.x = -Math.sin(ped.y * 10) * 1.2;
        ped.leftArm.rotation.z = 1.2;
        ped.rightArm.rotation.z = -1.2;

        // Ground hit & Bounce
        if (ped.y <= 0.25) {
          ped.y = 0.25;
          ped.vy = -ped.vy * 0.4; // Bounce restitution
          ped.vx *= 0.65; // Ground friction
          ped.vz *= 0.65;
          ped.rotVx *= 0.5;
          ped.rotVz *= 0.5;

          // If kinetic energy is low, come to rest on the ground
          if (Math.abs(ped.vy) < 2.0 && Math.hypot(ped.vx, ped.vz) < 2.5) {
            ped.state = 'GROUNDED';
            ped.groundTimer = 4.0; // Stay down for 4 seconds
            ped.vx = 0;
            ped.vy = 0;
            ped.vz = 0;
            ped.rotVx = 0;
            ped.rotVz = 0;
            ped.group.rotation.x = Math.PI / 2; // Lie flat on back
          }
        }

        ped.group.position.set(ped.x, ped.y, ped.z);
        continue;
      }

      // 2. GROUNDED (Recovering after crash landing)
      if (ped.state === 'GROUNDED') {
        ped.groundTimer -= dt;
        if (ped.groundTimer <= 0) {
          // Get back up!
          ped.state = 'WALKING';
          ped.y = 0.25;
          ped.group.rotation.x = 0;
          ped.group.rotation.z = 0;
          ped.leftArm.rotation.z = 0;
          ped.rightArm.rotation.z = 0;
          ped.isPanicking = false;
        }
        ped.group.position.set(ped.x, ped.y, ped.z);
        continue;
      }

      // 3. NORMAL WALKING / PANICKING
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

      ped.x += Math.sin(ped.rotationY) * speed * dt;
      ped.z += Math.cos(ped.rotationY) * speed * dt;

      ped.group.position.set(ped.x, 0.25, ped.z);

      // Walking limb swing animation
      ped.animTimer += dt * (ped.isPanicking ? 18 : 8);
      const swing = Math.sin(ped.animTimer) * 0.6;
      ped.leftLeg.rotation.x = swing;
      ped.rightLeg.rotation.x = -swing;
      ped.leftArm.rotation.x = -swing * 0.8;
      ped.rightArm.rotation.x = swing * 0.8;
    }
  }
}
