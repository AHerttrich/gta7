import * as THREE from 'three';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';
import { HUD } from '../ui/HUD';
import { Player } from '../character/Player';
import { Car } from '../vehicles/Car';

export type AlienType = 'GRUNT' | 'UFO';
export type AlienState = 'PATROL' | 'CHASE' | 'ATTACK' | 'LEAP';

export interface AlienEntity {
  id: number;
  type: AlienType;
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  baseY: number;
  spawnX: number;
  spawnZ: number;
  vy: number;
  isGrounded: boolean;
  health: number;
  maxHealth: number;
  speed: number;
  state: AlienState;
  aggroDistance: number;
  attackCooldown: number;
  plasmaCooldown: number;
  leapCooldown: number;
  isAlive: boolean;
  patrolAngle: number;
  patrolRadius: number;
  respawnTimer: number;
  coreLight?: THREE.PointLight;
  legs?: THREE.Mesh[];
  rimDisc?: THREE.Mesh;
}

export interface PlasmaBolt {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  damage: number;
}

export interface AlienParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export class AlienSystem {
  public group: THREE.Group;
  public aliens: AlienEntity[] = [];
  public plasmaBolts: PlasmaBolt[] = [];
  public particles: AlienParticle[] = [];

  private scene: THREE.Scene;
  private economy: EconomySystem;
  private sound: SoundManager;

  private animTimer: number = 0;
  private hasTriggeredAlarm: boolean = false;

  // Shared reusable geometries and materials for optimal performance
  private boltGeo: THREE.SphereGeometry;
  private boltMat: THREE.MeshBasicMaterial;
  private particleGeo: THREE.DodecahedronGeometry;
  private particleMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, economy: EconomySystem, sound: SoundManager) {
    this.scene = scene;
    this.economy = economy;
    this.sound = sound;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.boltGeo = new THREE.SphereGeometry(0.35, 8, 8);
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

    this.particleGeo = new THREE.DodecahedronGeometry(0.25);
    this.particleMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });

    this.spawnAlienInvasion();
  }

  /**
   * Spawns Alien Grunts & Scout UFOs at strategic Moon landmarks
   */
  private spawnAlienInvasion(): void {
    const alienSpawns: Array<{
      type: AlienType;
      x: number;
      y: number;
      z: number;
      speed: number;
      health: number;
      aggroDist: number;
      patrolRadius: number;
    }> = [
      // 1 & 2: Tycho Crater Rim Grunts (South Mega Crater)
      {
        type: 'GRUNT',
        x: 2480,
        y: 400.5,
        z: 2660,
        speed: 7.5,
        health: 70,
        aggroDist: 48,
        patrolRadius: 20,
      },
      {
        type: 'GRUNT',
        x: 2520,
        y: 400.5,
        z: 2700,
        speed: 8.0,
        health: 70,
        aggroDist: 48,
        patrolRadius: 22,
      },
      // 3: Tycho Scout Flying Saucer hovering over Tycho Basin
      {
        type: 'UFO',
        x: 2500,
        y: 418.0,
        z: 2680,
        speed: 13.0,
        health: 160,
        aggroDist: 65,
        patrolRadius: 40,
      },

      // 4 & 5: Copernicus Crater Grunts (West Impact Crater)
      {
        type: 'GRUNT',
        x: 2375,
        y: 400.5,
        z: 2470,
        speed: 7.0,
        health: 65,
        aggroDist: 45,
        patrolRadius: 18,
      },
      {
        type: 'GRUNT',
        x: 2340,
        y: 400.5,
        z: 2530,
        speed: 8.2,
        health: 65,
        aggroDist: 45,
        patrolRadius: 20,
      },
      // 6: Copernicus Patroller UFO
      {
        type: 'UFO',
        x: 2360,
        y: 417.0,
        z: 2500,
        speed: 12.0,
        health: 150,
        aggroDist: 60,
        patrolRadius: 35,
      },

      // 7 & 8: Ambush Grunts behind Apollo 11 Tranquility Base
      {
        type: 'GRUNT',
        x: 2405,
        y: 400.5,
        z: 2415,
        speed: 7.8,
        health: 75,
        aggroDist: 42,
        patrolRadius: 15,
      },
      {
        type: 'GRUNT',
        x: 2435,
        y: 400.5,
        z: 2445,
        speed: 7.2,
        health: 70,
        aggroDist: 42,
        patrolRadius: 16,
      },

      // 9: Monolith Guardian Grunt
      {
        type: 'GRUNT',
        x: 2610,
        y: 400.5,
        z: 2370,
        speed: 8.5,
        health: 80,
        aggroDist: 50,
        patrolRadius: 18,
      },
      // 10: Monolith Mothership Scout UFO
      {
        type: 'UFO',
        x: 2625,
        y: 420.0,
        z: 2385,
        speed: 14.0,
        health: 180,
        aggroDist: 70,
        patrolRadius: 38,
      },
    ];

    alienSpawns.forEach((cfg, idx) => {
      let alienGroup: THREE.Group;
      let coreLight: THREE.PointLight | undefined;
      let legs: THREE.Mesh[] | undefined;
      let rimDisc: THREE.Mesh | undefined;

      if (cfg.type === 'GRUNT') {
        const gruntRes = this.createGruntMesh();
        alienGroup = gruntRes.group;
        coreLight = gruntRes.coreLight;
        legs = gruntRes.legs;
      } else {
        const ufoRes = this.createUfoMesh();
        alienGroup = ufoRes.group;
        coreLight = ufoRes.coreLight;
        rimDisc = ufoRes.rimDisc;
      }

      alienGroup.position.set(cfg.x, cfg.y, cfg.z);
      this.group.add(alienGroup);

      this.aliens.push({
        id: idx + 1,
        type: cfg.type,
        group: alienGroup,
        x: cfg.x,
        y: cfg.y,
        z: cfg.z,
        baseY: cfg.y,
        spawnX: cfg.x,
        spawnZ: cfg.z,
        vy: 0,
        isGrounded: true,
        health: cfg.health,
        maxHealth: cfg.health,
        speed: cfg.speed,
        state: 'PATROL',
        aggroDistance: cfg.aggroDist,
        attackCooldown: 0,
        plasmaCooldown: Math.random() * 2.0,
        leapCooldown: 2.0 + Math.random() * 3.0,
        isAlive: true,
        patrolAngle: Math.random() * Math.PI * 2,
        patrolRadius: cfg.patrolRadius,
        respawnTimer: 0,
        coreLight,
        legs,
        rimDisc,
      });
    });
  }

  /**
   * 3D Xenomorph / Alien Grunt Mesh Builder
   */
  private createGruntMesh(): {
    group: THREE.Group;
    coreLight: THREE.PointLight;
    legs: THREE.Mesh[];
  } {
    const group = new THREE.Group();

    // Biomechanical dark-green material with subtle sheen
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.35,
      metalness: 0.65,
    });
    const spineMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b,
      roughness: 0.25,
      metalness: 0.8,
    });

    // 1. Torso & Ribbed Spine
    const torsoGeo = new THREE.CylinderGeometry(0.3, 0.2, 1.1, 8);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.y = 1.25;
    group.add(torso);

    // Rib Rings
    for (let r = 0; r < 3; r++) {
      const ribGeo = new THREE.TorusGeometry(0.32, 0.04, 6, 12);
      const rib = new THREE.Mesh(ribGeo, spineMat);
      rib.rotation.x = Math.PI / 2;
      rib.position.y = 1.05 + r * 0.22;
      group.add(rib);
    }

    // 2. Elongated Xenomorph Cranium Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.85, 0.1);

    const skullGeo = new THREE.SphereGeometry(0.32, 12, 12);
    skullGeo.scale(0.8, 0.75, 1.8);
    const skull = new THREE.Mesh(skullGeo, spineMat);
    skull.rotation.x = -0.22;
    headGroup.add(skull);

    // Glowing Crimson Eyes / Optical Sensor Nodes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeMat);
    eyeL.position.set(-0.16, 0.08, 0.45);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeMat);
    eyeR.position.set(0.16, 0.08, 0.45);
    headGroup.add(eyeL, eyeR);

    // Lower Jaw / Mandibles
    const jawGeo = new THREE.ConeGeometry(0.14, 0.3, 6);
    jawGeo.rotateX(-Math.PI / 2);
    const jaw = new THREE.Mesh(jawGeo, bodyMat);
    jaw.position.set(0, -0.15, 0.38);
    headGroup.add(jaw);

    group.add(headGroup);

    // 3. Clawed Arms
    const armGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.75, 6);
    const armL = new THREE.Mesh(armGeo, bodyMat);
    armL.position.set(-0.42, 1.25, 0.15);
    armL.rotation.set(0.4, 0, -0.4);

    const armR = new THREE.Mesh(armGeo, bodyMat);
    armR.position.set(0.42, 1.25, 0.15);
    armR.rotation.set(0.4, 0, 0.4);

    // Claws
    const clawMat = new THREE.MeshBasicMaterial({ color: 0xa3e635 });
    const clawL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), clawMat);
    clawL.position.set(-0.55, 0.9, 0.35);
    clawL.rotation.x = Math.PI / 2;

    const clawR = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), clawMat);
    clawR.position.set(0.55, 0.9, 0.35);
    clawR.rotation.x = Math.PI / 2;
    group.add(armL, armR, clawL, clawR);

    // 4. Digitigrade Legs
    const legGeo = new THREE.CylinderGeometry(0.09, 0.07, 0.95, 6);
    const legL = new THREE.Mesh(legGeo, bodyMat);
    legL.position.set(-0.24, 0.48, 0);

    const legR = new THREE.Mesh(legGeo, bodyMat);
    legR.position.set(0.24, 0.48, 0);
    group.add(legL, legR);

    // 5. Bioluminescent Chest Core Light
    const coreLight = new THREE.PointLight(0x22c55e, 2.2, 7);
    coreLight.position.set(0, 1.3, 0.15);
    group.add(coreLight);

    return { group, coreLight, legs: [legL, legR] };
  }

  /**
   * 3D Alien Scout UFO / Flying Saucer Builder
   */
  private createUfoMesh(): {
    group: THREE.Group;
    coreLight: THREE.PointLight;
    rimDisc: THREE.Mesh;
  } {
    const group = new THREE.Group();

    // Metallic Hull
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.95,
      roughness: 0.2,
    });
    const saucerGeo = new THREE.CylinderGeometry(3.6, 1.6, 0.8, 24);
    const rimDisc = new THREE.Mesh(saucerGeo, hullMat);
    group.add(rimDisc);

    // Glowing Neon Cyan Rim Ring
    const rimRingGeo = new THREE.TorusGeometry(3.65, 0.16, 12, 32);
    rimRingGeo.rotateX(Math.PI / 2);
    const rimRingMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const rimRing = new THREE.Mesh(rimRingGeo, rimRingMat);
    group.add(rimRing);

    // Cockpit Glass Bio-Dome
    const domeGeo = new THREE.SphereGeometry(1.4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      metalness: 0.9,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0.35;
    group.add(dome);

    // Alien Brain / Pilot Core inside dome
    const brainGeo = new THREE.SphereGeometry(0.55, 8, 8);
    const brainMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
    const brain = new THREE.Mesh(brainGeo, brainMat);
    brain.position.y = 0.65;
    group.add(brain);

    // Ventral Plasma Cannon Emitter underneath
    const cannonGeo = new THREE.CylinderGeometry(0.7, 1.2, 0.4, 16);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    const cannon = new THREE.Mesh(cannonGeo, cannonMat);
    cannon.position.y = -0.55;
    group.add(cannon);

    // Emitter Lens (Glowing green plasma port)
    const lensGeo = new THREE.CircleGeometry(0.65, 16);
    lensGeo.rotateX(Math.PI / 2);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.y = -0.76;
    group.add(lens);

    // Flashing Perimeter Beacon Bulbs
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const bulbGeo = new THREE.SphereGeometry(0.12, 6, 6);
      const bulbMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xef4444 : 0x22c55e,
      });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(Math.cos(angle) * 3.4, 0, Math.sin(angle) * 3.4);
      group.add(bulb);
    }

    // Ventral Plasma Spotlight
    const coreLight = new THREE.PointLight(0x10b981, 3.5, 22);
    coreLight.position.set(0, -1.0, 0);
    group.add(coreLight);

    return { group, coreLight, rimDisc };
  }

  /**
   * Main Frame Update Loop
   */
  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    playerMode: string,
    player: Player,
    car: Car,
    hud: HUD,
  ): void {
    this.animTimer += dt;

    let anyAggro = false;

    // 1. Update Aliens
    for (const alien of this.aliens) {
      if (!alien.isAlive) {
        // Handle Respawn Timer
        alien.respawnTimer -= dt;
        if (alien.respawnTimer <= 0) {
          this.respawnAlien(alien);
        }
        continue;
      }

      // Distance to Player (3D & 2D)
      const dx = playerX - alien.x;
      const dz = playerZ - alien.z;
      const dist2D = Math.hypot(dx, dz);
      const dy = playerY - alien.y;
      const dist3D = Math.hypot(dx, dy, dz);

      // Decrement Cooldowns
      if (alien.attackCooldown > 0) alien.attackCooldown -= dt;
      if (alien.plasmaCooldown > 0) alien.plasmaCooldown -= dt;
      if (alien.leapCooldown > 0) alien.leapCooldown -= dt;

      // Aggro Detection
      if (dist2D < alien.aggroDistance) {
        alien.state = 'CHASE';
        anyAggro = true;

        if (!this.hasTriggeredAlarm) {
          this.hasTriggeredAlarm = true;
          this.sound.playAlienScreech();
          hud.showNotification(
            '⚠️ ALIEN-ALARM: Außerirdische Lebensformen auf dem Mond greifen an!',
          );
        }
      } else if (alien.state === 'CHASE' && dist2D > alien.aggroDistance * 1.6) {
        alien.state = 'PATROL';
      }

      // Execute AI Behavior based on Type
      if (alien.type === 'GRUNT') {
        this.updateGruntAI(
          dt,
          alien,
          playerX,
          playerY,
          playerZ,
          dist2D,
          dist3D,
          playerMode,
          player,
          car,
          hud,
        );
      } else {
        this.updateUfoAI(dt, alien, playerX, playerY, playerZ, dist2D, dist3D);
      }
    }

    if (!anyAggro) {
      this.hasTriggeredAlarm = false;
    }

    // 2. Update Plasma Projectiles
    this.updatePlasmaBolts(dt, playerX, playerY, playerZ, playerMode, player, car, hud);

    // 3. Update Death Particle Effects
    this.updateParticles(dt);
  }

  /**
   * Xenomorph Grunt Low-Gravity AI & Leap Combat
   */
  private updateGruntAI(
    dt: number,
    alien: AlienEntity,
    playerX: number,
    playerY: number,
    playerZ: number,
    dist2D: number,
    _dist3D: number,
    playerMode: string,
    player: Player,
    car: Car,
    hud: HUD,
  ): void {
    const dx = playerX - alien.x;
    const dz = playerZ - alien.z;

    if (alien.state === 'CHASE' || alien.state === 'LEAP') {
      // Rotate towards player
      alien.group.rotation.y = Math.atan2(dx, dz);

      // Float / leap towards player
      if (dist2D > 1.8) {
        const nx = dx / dist2D;
        const nz = dz / dist2D;
        const moveSpeed = alien.speed * (alien.isGrounded ? 1.0 : 1.35);
        alien.x += nx * moveSpeed * dt;
        alien.z += nz * moveSpeed * dt;
      }

      // Moon Low-Gravity Leap (1/6g lunar physics)
      if (alien.isGrounded && dist2D > 6.0 && dist2D < 32.0 && alien.leapCooldown <= 0) {
        alien.vy = 5.6 + Math.random() * 2.2;
        alien.isGrounded = false;
        alien.leapCooldown = 3.5 + Math.random() * 2.5;
        alien.state = 'LEAP';
        this.sound.playAlienScreech();
      }

      // Melee Claw Attack
      if (dist2D < 2.6 && Math.abs(alien.y - playerY) < 2.5 && alien.attackCooldown <= 0) {
        alien.attackCooldown = 1.25;
        this.sound.playAlienScreech();

        if (playerMode === 'IN_CAR') {
          car.takeDamage(12);
          hud.showNotification('💥 KRALLEN-TREFFER! Xenomorph greift DeLorean an (-12 HP)!');
        } else {
          player.takeDamage(14);
          hud.showNotification('💥 KRALLEN-TREFFER! Xenomorph schlitzt dich auf (-14 HP)!');
        }
      }

      // Acid Plasma Spit (Ranged Attack)
      if (dist2D >= 6.0 && dist2D <= 28.0 && alien.plasmaCooldown <= 0) {
        alien.plasmaCooldown = 2.8 + Math.random() * 1.5;
        this.firePlasmaBolt(alien.x, alien.y + 1.6, alien.z, playerX, playerY + 0.8, playerZ, 14);
      }
    } else {
      // Idle / Patrol around spawn area
      alien.patrolAngle += dt * 0.6;
      const targetX = alien.spawnX + Math.cos(alien.patrolAngle) * alien.patrolRadius;
      const targetZ = alien.spawnZ + Math.sin(alien.patrolAngle) * alien.patrolRadius;
      const pdx = targetX - alien.x;
      const pdz = targetZ - alien.z;
      const pdist = Math.hypot(pdx, pdz);

      if (pdist > 0.5) {
        alien.x += (pdx / pdist) * (alien.speed * 0.45) * dt;
        alien.z += (pdz / pdist) * (alien.speed * 0.45) * dt;
        alien.group.rotation.y = Math.atan2(pdx, pdz);
      }
    }

    // Lunar Gravity Physics
    alien.vy -= 6.5 * dt; // 1/6 g moon gravity
    alien.y += alien.vy * dt;

    const groundLevel = 400.5;
    if (alien.y <= groundLevel) {
      alien.y = groundLevel;
      alien.vy = 0;
      alien.isGrounded = true;
      if (alien.state === 'LEAP') alien.state = 'CHASE';
    }

    // Animate leg swings
    if (alien.legs && alien.legs.length >= 2) {
      const legSwing = Math.sin(this.animTimer * 9.0) * 0.35;
      alien.legs[0].rotation.x = alien.isGrounded ? legSwing : -0.4;
      alien.legs[1].rotation.x = alien.isGrounded ? -legSwing : 0.4;
    }

    // Core light pulsing
    if (alien.coreLight) {
      alien.coreLight.intensity = 2.0 + Math.sin(this.animTimer * 6.0) * 0.8;
    }

    alien.group.position.set(alien.x, alien.y, alien.z);
  }

  /**
   * Scout Flying Saucer (UFO) AI & Ventral Plasma Bombardment
   */
  private updateUfoAI(
    dt: number,
    alien: AlienEntity,
    playerX: number,
    playerY: number,
    playerZ: number,
    dist2D: number,
    _dist3D: number,
  ): void {
    // Continuous saucer disc rotation
    if (alien.rimDisc) {
      alien.rimDisc.rotation.y += dt * 3.5;
    }

    // Vertical floating hover bobbing
    alien.y = alien.baseY + Math.sin(this.animTimer * 2.2 + alien.id) * 1.6;

    const dx = playerX - alien.x;
    const dz = playerZ - alien.z;

    if (alien.state === 'CHASE') {
      // Glide smoothly towards player, circling at high altitude
      if (dist2D > 14.0) {
        alien.x += (dx / dist2D) * alien.speed * dt;
        alien.z += (dz / dist2D) * alien.speed * dt;
      }

      // Fire ventral plasma cannon towards player
      if (dist2D < 55.0 && alien.plasmaCooldown <= 0) {
        alien.plasmaCooldown = 2.4 + Math.random() * 1.4;
        this.firePlasmaBolt(alien.x, alien.y - 0.7, alien.z, playerX, playerY + 0.5, playerZ, 16);
      }
    } else {
      // Circular patrol orbit above crater landmark
      alien.patrolAngle += dt * 0.35;
      alien.x = alien.spawnX + Math.cos(alien.patrolAngle) * alien.patrolRadius;
      alien.z = alien.spawnZ + Math.sin(alien.patrolAngle) * alien.patrolRadius;
    }

    // Pulsing ventral tractor beam light
    if (alien.coreLight) {
      alien.coreLight.intensity = 3.5 + Math.sin(this.animTimer * 8.0) * 1.5;
    }

    alien.group.position.set(alien.x, alien.y, alien.z);
  }

  /**
   * Spawns a high-energy plasma energy bolt fired by aliens
   */
  public firePlasmaBolt(
    fromX: number,
    fromY: number,
    fromZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    damage: number = 14,
  ): void {
    const dx = targetX - fromX;
    const dy = targetY - fromY;
    const dz = targetZ - fromZ;
    const dist = Math.hypot(dx, dy, dz);

    if (dist < 0.001) return;

    const speed = 28.0; // Plasma speed m/s
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;
    const vz = (dz / dist) * speed;

    const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
    mesh.position.set(fromX, fromY, fromZ);
    this.group.add(mesh);

    const light = new THREE.PointLight(0x22c55e, 4.0, 10);
    light.position.set(fromX, fromY, fromZ);
    this.group.add(light);

    this.sound.playPlasmaShot();

    this.plasmaBolts.push({
      mesh,
      light,
      x: fromX,
      y: fromY,
      z: fromZ,
      vx,
      vy,
      vz,
      life: 2.5,
      damage,
    });
  }

  /**
   * Updates plasma bolts and handles collision with player or vehicle
   */
  private updatePlasmaBolts(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    playerMode: string,
    player: Player,
    car: Car,
    hud: HUD,
  ): void {
    for (let i = this.plasmaBolts.length - 1; i >= 0; i--) {
      const bolt = this.plasmaBolts[i];
      bolt.life -= dt;

      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.z += bolt.vz * dt;

      bolt.mesh.position.set(bolt.x, bolt.y, bolt.z);
      bolt.light.position.set(bolt.x, bolt.y, bolt.z);

      let hasHit = false;

      // Check collision with Player or Car
      const hitDist = Math.hypot(bolt.x - playerX, bolt.y - (playerY + 0.8), bolt.z - playerZ);

      if (hitDist < (playerMode === 'IN_CAR' ? 2.8 : 1.6)) {
        hasHit = true;
        this.sound.playCrash(15);

        if (playerMode === 'IN_CAR') {
          car.takeDamage(bolt.damage);
          hud.showNotification('⚡ ALIEN-PLASMA! DeLorean getroffen (-12 HP)!');
        } else {
          player.takeDamage(bolt.damage);
          hud.showNotification('⚡ ALIEN-PLASMA! Direkttreffer (-14 HP)!');
        }

        this.spawnBurst(bolt.x, bolt.y, bolt.z, 0x22c55e, 5);
      }

      if (hasHit || bolt.life <= 0 || bolt.y < 400.0) {
        this.group.remove(bolt.mesh);
        this.group.remove(bolt.light);
        this.plasmaBolts.splice(i, 1);
      }
    }
  }

  /**
   * Player weapons (Pistol, SMG, Shotgun, Rocket, Melee, Tank) damaging Aliens
   */
  public takeWeaponDamage(
    x: number,
    y: number,
    z: number,
    damage: number,
    radius: number = 2.0,
  ): boolean {
    let hitAny = false;

    for (const alien of this.aliens) {
      if (!alien.isAlive) continue;

      const d2D = Math.hypot(x - alien.x, z - alien.z);
      const dy = Math.abs(y - alien.y);

      if (d2D < radius + 1.8 && dy < 6.0) {
        alien.health -= damage;
        alien.state = 'CHASE';
        hitAny = true;

        this.spawnBurst(alien.x, alien.y + 1.2, alien.z, 0x10b981, 4);

        if (alien.health <= 0) {
          this.killAlien(alien);
        }
      }
    }

    return hitAny;
  }

  /**
   * DeLorean / Tank running down or ramming Aliens at high speed
   */
  public checkCarRamming(carX: number, carY: number, carZ: number, speed: number): boolean {
    if (Math.abs(speed) < 4.0) return false;

    let hit = false;
    for (const alien of this.aliens) {
      if (!alien.isAlive || alien.type === 'UFO') continue;

      const d2D = Math.hypot(carX - alien.x, carZ - alien.z);
      const dy = Math.abs(carY - alien.y);

      if (d2D < 2.8 && dy < 2.5) {
        hit = true;
        const damage = Math.round(Math.abs(speed) * 3.2);
        alien.health -= damage;
        alien.state = 'CHASE';
        this.sound.playCrash(22);

        this.spawnBurst(alien.x, alien.y + 0.8, alien.z, 0x22c55e, 8);

        if (alien.health <= 0) {
          this.killAlien(alien);
        }
      }
    }

    return hit;
  }

  /**
   * Handles alien defeat, audio, cash bounty and particle burst
   */
  private killAlien(alien: AlienEntity): void {
    alien.isAlive = false;
    alien.group.visible = false;
    alien.respawnTimer = 75.0; // Respawns after 75 seconds

    this.sound.playAlienDeath();

    const isUfo = alien.type === 'UFO';
    const reward = isUfo ? 1500 : 750;
    this.economy.addCash(reward);

    this.spawnBurst(alien.x, alien.y + 1.2, alien.z, isUfo ? 0x06b6d4 : 0x22c55e, 14);
  }

  /**
   * Respawns an alien at its original spawn point
   */
  private respawnAlien(alien: AlienEntity): void {
    alien.isAlive = true;
    alien.group.visible = true;
    alien.health = alien.maxHealth;
    alien.x = alien.spawnX;
    alien.y = alien.baseY;
    alien.z = alien.spawnZ;
    alien.vy = 0;
    alien.isGrounded = true;
    alien.state = 'PATROL';
    alien.group.position.set(alien.x, alien.y, alien.z);
  }

  /**
   * Particle burst effect on hit or explosion
   */
  private spawnBurst(x: number, y: number, z: number, _color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, this.particleMat);
      mesh.position.set(x, y, z);
      this.group.add(mesh);

      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 6 + 1.5,
        vz: (Math.random() - 0.5) * 8,
        life: 0.8,
        maxLife: 0.8,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      // Lunar 1/6g gravity on particles
      p.vy -= 6.5 * dt;

      const scale = Math.max(0.01, p.life / p.maxLife);
      p.mesh.scale.set(scale, scale, scale);

      if (p.life <= 0) {
        this.group.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Returns positions of all alive aliens for minimap / radar rendering
   */
  public getLivingAlienBlips(): { x: number; z: number; isUfo: boolean }[] {
    return this.aliens
      .filter((a) => a.isAlive)
      .map((a) => ({ x: a.x, z: a.z, isUfo: a.type === 'UFO' }));
  }

  /**
   * Sets visibility of alien models and projectiles based on current dimension
   */
  public setDimensionVisibility(isMoon: boolean): void {
    this.group.visible = isMoon;
  }
}
