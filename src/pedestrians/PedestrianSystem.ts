import * as THREE from 'three';
import { CITY_CONFIG } from '../utils/Constants';
import { City } from '../city/City';

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
  turnTimer?: number;
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
      turnTimer: 4.0 + Math.random() * 6.0,
    });
  }

  /**
   * Respawns a pedestrian safely onto a downtown or central sidewalk
   * if they were blasted out of the map or fell into water/void.
   */
  public respawnPedestrian(ped: Pedestrian): void {
    const { GRID_SIZE, BLOCK_SIZE, ROAD_WIDTH } = CITY_CONFIG;
    const step = BLOCK_SIZE + ROAD_WIDTH;
    const halfSize = (GRID_SIZE * step) / 2;

    // Respawn on central city blocks (indices 1 to GRID_SIZE - 2)
    const minIdx = 1;
    const maxIdx = Math.max(1, GRID_SIZE - 2);
    const blockI = Math.floor(Math.random() * (maxIdx - minIdx + 1)) + minIdx;
    const blockJ = Math.floor(Math.random() * (maxIdx - minIdx + 1)) + minIdx;

    const blockCenterX = -halfSize + blockI * step + step / 2;
    const blockCenterZ = -halfSize + blockJ * step + step / 2;

    const rim = (BLOCK_SIZE / 2) * 0.95;
    const side = Math.floor(Math.random() * 4);

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

    ped.x = x;
    ped.y = 0.25;
    ped.z = z;
    ped.vx = 0;
    ped.vy = 0;
    ped.vz = 0;
    ped.rotVx = 0;
    ped.rotVy = 0;
    ped.rotVz = 0;
    ped.state = 'WALKING';
    ped.direction = dir;
    ped.rotationY = rotY;
    ped.isPanicking = false;
    ped.panicTimer = 0;
    ped.groundTimer = 0;
    ped.turnTimer = 4.0 + Math.random() * 6.0;

    ped.group.position.set(x, 0.25, z);
    ped.group.rotation.set(0, rotY, 0);
    ped.leftArm.rotation.set(0, 0, 0);
    ped.rightArm.rotation.set(0, 0, 0);
    ped.leftLeg.rotation.set(0, 0, 0);
    ped.rightLeg.rotation.set(0, 0, 0);
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

  public update(dt: number, carX: number, carZ: number, carSpeed: number, city?: City): void {
    const MAP_LIMIT = 214.0;
    const EMERGENCY_LIMIT = 225.0;

    for (const ped of this.pedestrians) {
      // 0. Emergency rescue watchdog (fell into void, water, or catapulted into space)
      if (
        Math.abs(ped.x) > EMERGENCY_LIMIT ||
        Math.abs(ped.z) > EMERGENCY_LIMIT ||
        ped.y < -1.5 ||
        Number.isNaN(ped.x) ||
        Number.isNaN(ped.z) ||
        Number.isNaN(ped.y)
      ) {
        this.respawnPedestrian(ped);
        continue;
      }

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
          ped.turnTimer = 4.0 + Math.random() * 4.0;

          // If landed inside building footprint, eject safely onto sidewalk
          if (city) {
            const fixed = city.resolveBuildingIntersection(ped.x, ped.z, 0.45, 0.25);
            if (fixed.corrected) {
              ped.x = fixed.x;
              ped.z = fixed.z;
            }
          }
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
      } else {
        // Natural corner turning along sidewalks when patrolling
        if (ped.turnTimer === undefined) {
          ped.turnTimer = 4.0 + Math.random() * 6.0;
        }
        ped.turnTimer -= dt;
        if (ped.turnTimer <= 0) {
          const turn = (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2);
          ped.rotationY = (ped.rotationY + turn) % (Math.PI * 2);
          ped.group.rotation.y = ped.rotationY;
          ped.turnTimer = 5.0 + Math.random() * 6.0;
        }
      }

      const speed = ped.isPanicking ? ped.speed * 2.8 : ped.speed;
      const nextX = ped.x + Math.sin(ped.rotationY) * speed * dt;
      const nextZ = ped.z + Math.cos(ped.rotationY) * speed * dt;

      // Building collision check
      let canMove = true;
      if (city) {
        const col = city.checkCollision(nextX, nextZ, 0.45, 0.25);
        if (col.collided) {
          canMove = false;
          // Turn to parallel sidewalk along building wall
          if (col.normalX !== 0) {
            ped.rotationY = Math.random() < 0.5 ? 0 : Math.PI;
          } else if (col.normalZ !== 0) {
            ped.rotationY = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            ped.rotationY = (ped.rotationY + Math.PI / 2) % (Math.PI * 2);
          }
          ped.group.rotation.y = ped.rotationY;
          ped.turnTimer = 4.0 + Math.random() * 4.0;
        }
      }

      if (canMove) {
        ped.x = nextX;
        ped.z = nextZ;
      }

      // Map boundary containment: do not allow pedestrians to walk off the map
      let hitBoundary = false;
      if (ped.x >= MAP_LIMIT) {
        ped.x = MAP_LIMIT;
        const choices = [-Math.PI / 2, Math.PI, 0];
        ped.rotationY = choices[Math.floor(Math.random() * choices.length)];
        hitBoundary = true;
      } else if (ped.x <= -MAP_LIMIT) {
        ped.x = -MAP_LIMIT;
        const choices = [Math.PI / 2, Math.PI, 0];
        ped.rotationY = choices[Math.floor(Math.random() * choices.length)];
        hitBoundary = true;
      }

      if (ped.z >= MAP_LIMIT) {
        ped.z = MAP_LIMIT;
        const choices = [Math.PI, Math.PI / 2, -Math.PI / 2];
        ped.rotationY = choices[Math.floor(Math.random() * choices.length)];
        hitBoundary = true;
      } else if (ped.z <= -MAP_LIMIT) {
        ped.z = -MAP_LIMIT;
        const choices = [0, Math.PI / 2, -Math.PI / 2];
        ped.rotationY = choices[Math.floor(Math.random() * choices.length)];
        hitBoundary = true;
      }

      if (hitBoundary) {
        ped.group.rotation.y = ped.rotationY;
        ped.turnTimer = 4.0 + Math.random() * 4.0;
      }

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
