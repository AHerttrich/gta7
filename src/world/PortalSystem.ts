import * as THREE from 'three';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';

export interface DragonBall {
  id: number;
  group: THREE.Group;
  light: THREE.PointLight;
  x: number;
  y: number;
  z: number;
  baseY: number;
  isCollected: boolean;
}

export interface FloatingPlatform {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  isBoostPad?: boolean;
}

export class PortalSystem {
  public group: THREE.Group;
  public otherWorldGroup: THREE.Group;
  public currentDimension: 'NORMAL_WORLD' | 'OTHER_WORLD' = 'NORMAL_WORLD';

  // City Portal coordinates (Western seaside pier / cliff overlooking ocean)
  public readonly cityPortalPos = { x: -185, y: 0.5, z: 132 };
  // Other World Portal coordinates (Central Sanctuary Platform)
  public readonly otherWorldPortalPos = { x: 2500, y: 400.5, z: 2500 };

  // Portal visual meshes
  public cityPortalRing!: THREE.Mesh;
  public cityPortalVortex!: THREE.Mesh;
  public cityPortalBeam!: THREE.Mesh;
  public cityPortalLight!: THREE.PointLight;

  public otherWorldPortalRing!: THREE.Mesh;
  public otherWorldPortalVortex!: THREE.Mesh;
  public otherWorldPortalLight!: THREE.PointLight;

  // Other World Platforms
  public platforms: FloatingPlatform[] = [];
  // 7 Collectable Dragon Balls
  public dragonBalls: DragonBall[] = [];
  public collectedBallsCount: number = 0;

  public warpCooldown: number = 0;
  public scene: THREE.Scene;
  public economy: EconomySystem;
  public sound: SoundManager;
  private animTimer: number = 0;

  constructor(scene: THREE.Scene, economy: EconomySystem, sound: SoundManager) {
    this.scene = scene;
    this.economy = economy;
    this.sound = sound;

    this.group = new THREE.Group();
    this.otherWorldGroup = new THREE.Group();
    this.scene.add(this.group, this.otherWorldGroup);

    this.buildCityPortal();
    this.buildOtherWorld();
    this.spawnDragonBalls();
  }

  /**
   * 1. The City Dimensional Portal at the seaside boulevard
   */
  private buildCityPortal(): void {
    const { x, y, z } = this.cityPortalPos;
    const portalBase = new THREE.Group();
    portalBase.position.set(x, y, z);

    // Stone / Obsidian Plinth
    const plinthGeo = new THREE.CylinderGeometry(8.5, 9.5, 0.8, 12);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.6,
      metalness: 0.7,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = 0.4;
    plinth.receiveShadow = true;
    portalBase.add(plinth);

    // Neon Floor Runes
    const runeRingGeo = new THREE.RingGeometry(3.5, 5.0, 32);
    runeRingGeo.rotateX(-Math.PI / 2);
    const runeRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const runeRing = new THREE.Mesh(runeRingGeo, runeRingMat);
    runeRing.position.y = 0.82;
    portalBase.add(runeRing);

    // Twin Guardian Obelisks
    const obeliskGeo = new THREE.BoxGeometry(1.4, 9.0, 1.4);
    const obeliskMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.8,
    });

    const obeliskL = new THREE.Mesh(obeliskGeo, obeliskMat);
    obeliskL.position.set(-4.0, 4.5, 0);
    obeliskL.castShadow = true;

    const obeliskR = new THREE.Mesh(obeliskGeo, obeliskMat);
    obeliskR.position.set(4.0, 4.5, 0);
    obeliskR.castShadow = true;
    portalBase.add(obeliskL, obeliskR);

    // Rotating Dimensional Outer Ring
    const ringGeo = new THREE.TorusGeometry(4.2, 0.45, 16, 48);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      emissive: 0x6d28d9,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.9,
    });
    this.cityPortalRing = new THREE.Mesh(ringGeo, ringMat);
    this.cityPortalRing.position.set(0, 4.8, 0);
    portalBase.add(this.cityPortalRing);

    // Swirling Energy Vortex Disc
    const vortexGeo = new THREE.CircleGeometry(3.8, 32);
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    this.cityPortalVortex = new THREE.Mesh(vortexGeo, vortexMat);
    this.cityPortalVortex.position.set(0, 4.8, 0);
    portalBase.add(this.cityPortalVortex);

    // High Sky Beacon Beam (Visible from anywhere across the city!)
    const beamGeo = new THREE.CylinderGeometry(1.8, 2.5, 320, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.cityPortalBeam = new THREE.Mesh(beamGeo, beamMat);
    this.cityPortalBeam.position.set(0, 160, 0);
    portalBase.add(this.cityPortalBeam);

    // Dynamic Pulsing Point Light
    this.cityPortalLight = new THREE.PointLight(0xa855f7, 3.5, 35);
    this.cityPortalLight.position.set(0, 4.8, 0);
    portalBase.add(this.cityPortalLight);

    this.group.add(portalBase);
  }

  /**
   * 2. The Other World (Die Andere Welt): Floating Cosmic Sanctuary & Snake Way
   */
  private buildOtherWorld(): void {
    const ox = this.otherWorldPortalPos.x;
    const oy = this.otherWorldPortalPos.y;
    const oz = this.otherWorldPortalPos.z;

    // A. Central Sanctuary Platform (100m x 100m, Y=400)
    this.createPlatform(ox - 50, ox + 50, oz - 50, oz + 50, 400.0, 0x1e1b4b, 0xa855f7);

    // Central Return Portal (warps back to GTA 7 City)
    const returnBase = new THREE.Group();
    returnBase.position.set(ox, oy, oz);

    const retRingGeo = new THREE.TorusGeometry(4.2, 0.45, 16, 48);
    const retRingMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
      metalness: 0.9,
    });
    this.otherWorldPortalRing = new THREE.Mesh(retRingGeo, retRingMat);
    this.otherWorldPortalRing.position.set(0, 4.8, 0);
    returnBase.add(this.otherWorldPortalRing);

    const retVortexGeo = new THREE.CircleGeometry(3.8, 32);
    const retVortexMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    this.otherWorldPortalVortex = new THREE.Mesh(retVortexGeo, retVortexMat);
    this.otherWorldPortalVortex.position.set(0, 4.8, 0);
    returnBase.add(this.otherWorldPortalVortex);

    this.otherWorldPortalLight = new THREE.PointLight(0xf59e0b, 4.0, 35);
    this.otherWorldPortalLight.position.set(0, 4.8, 0);
    returnBase.add(this.otherWorldPortalLight);

    this.otherWorldGroup.add(returnBase);

    // B. Snake Way (Schlangenpfad): Floating High-Speed Cosmic Highway to the South
    this.createPlatform(ox - 8, ox + 8, oz + 50, oz + 170, 400.0, 0x0f172a, 0xfacc15, true);

    // C. Mega Jump Ramp: Slanted launch ramp towards the sky island
    this.createPlatform(ox - 9, ox + 9, oz + 170, oz + 205, 412.0, 0x3b82f6, 0x00f0ff, true);

    // D. South Sky Island: Floating landing target for mega jump
    this.createPlatform(ox - 40, ox + 40, oz + 235, oz + 315, 420.0, 0x312e81, 0xec4899);

    // E. North Temple Island: Sacred Ancient Shrine
    this.createPlatform(ox - 6, ox + 6, oz - 100, oz - 50, 400.0, 0x0f172a, 0x38bdf8);
    this.createPlatform(ox - 40, ox + 40, oz - 180, oz - 100, 402.0, 0x1e1b4b, 0x38bdf8);

    // F. East Cosmic Runway & Stunt Loop
    this.createPlatform(ox + 50, ox + 220, oz - 8, oz + 8, 405.0, 0x0f172a, 0x10b981, true);
    this.createPlatform(ox + 200, ox + 265, oz - 35, oz + 35, 405.0, 0x1e293b, 0x10b981);

    // G. West Dragon Altar: Sacred Peak
    this.createPlatform(ox - 100, ox - 50, oz - 6, oz + 6, 400.0, 0x0f172a, 0xf97316);
    this.createPlatform(ox - 180, ox - 100, oz - 35, oz + 35, 408.0, 0x431407, 0xf97316);

    // H. Northwest Crystal Island
    this.createPlatform(ox - 140, ox - 70, oz - 140, oz - 70, 415.0, 0x581c87, 0xc084fc);

    // Cosmic Asteroids & Floating Crystal Monoliths
    this.buildCosmicDeco(ox, oy, oz);
  }

  private createPlatform(
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    height: number,
    color: number,
    rimColor: number,
    isBoostPad: boolean = false,
  ): void {
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const thickness = 5.0;

    // Platform solid slab
    const slabGeo = new THREE.BoxGeometry(width, thickness, depth);
    const slabMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.6,
    });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.set(centerX, height - thickness / 2, centerZ);
    slab.receiveShadow = true;
    this.otherWorldGroup.add(slab);

    // Glowing Neon Rim
    const rimGeo = new THREE.BoxGeometry(width + 0.6, 0.4, depth + 0.6);
    const rimMat = new THREE.MeshBasicMaterial({
      color: rimColor,
      wireframe: false,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(centerX, height + 0.1, centerZ);
    this.otherWorldGroup.add(rim);

    // Register platform collision box
    this.platforms.push({ minX, maxX, minZ, maxZ, height, isBoostPad });
  }

  private buildCosmicDeco(ox: number, oy: number, oz: number): void {
    // Cosmic Nebula Starfield Particles swirling around the Other World
    const count = 900;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = ox + (Math.random() - 0.5) * 600;
      pos[i * 3 + 1] = oy + (Math.random() - 0.5) * 200;
      pos[i * 3 + 2] = oz + (Math.random() - 0.5) * 600;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe879f9,
      size: 1.8,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const cosmicStars = new THREE.Points(starGeo, starMat);
    this.otherWorldGroup.add(cosmicStars);

    // Floating Crystal Monoliths around main island
    const monolithAngles = [
      0,
      Math.PI / 3,
      (2 * Math.PI) / 3,
      Math.PI,
      (4 * Math.PI) / 3,
      (5 * Math.PI) / 3,
    ];
    monolithAngles.forEach((ang) => {
      const mx = ox + Math.cos(ang) * 44;
      const mz = oz + Math.sin(ang) * 44;
      const geo = new THREE.ConeGeometry(2.4, 18, 5);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.9,
      });
      const monolith = new THREE.Mesh(geo, mat);
      monolith.position.set(mx, oy + 9, mz);
      this.otherWorldGroup.add(monolith);
    });
  }

  /**
   * 3. Spawn the 7 Collectable Dragon Balls (Golden Glowing Energy Orbs)
   */
  private spawnDragonBalls(): void {
    const ox = this.otherWorldPortalPos.x;
    const oz = this.otherWorldPortalPos.z;

    const locations = [
      { id: 1, x: ox, y: 405.0, z: oz + 20 }, // Sanctuary Altar (1-Star Ball)
      { id: 2, x: ox, y: 407.0, z: oz - 140 }, // North Temple Island (2-Star Ball)
      { id: 3, x: ox + 230, y: 410.0, z: oz }, // East Cosmic Runway (3-Star Ball)
      { id: 4, x: ox - 140, y: 413.0, z: oz }, // West Dragon Altar (4-Star Ball - Goku's Grandpa Ball!)
      { id: 5, x: ox, y: 432.0, z: oz + 205 }, // Mid-air over Mega Jump Ramp (5-Star Ball)
      { id: 6, x: ox, y: 426.0, z: oz + 275 }, // South Sky Island (6-Star Ball)
      { id: 7, x: ox - 105, y: 420.0, z: oz - 105 }, // Northwest Crystal Island (7-Star Ball)
    ];

    locations.forEach((loc) => {
      const ballGroup = new THREE.Group();
      ballGroup.position.set(loc.x, loc.y, loc.z);

      // Golden crystal orb
      const orbGeo = new THREE.SphereGeometry(1.3, 24, 24);
      const orbMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.85,
        roughness: 0.1,
        metalness: 0.85,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      ballGroup.add(orb);

      // Red Dragon Star in core
      const starGeo = new THREE.OctahedronGeometry(0.55);
      const starMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const star = new THREE.Mesh(starGeo, starMat);
      ballGroup.add(star);

      // Warm Golden Aura PointLight
      const light = new THREE.PointLight(0xf59e0b, 2.8, 18);
      ballGroup.add(light);

      this.otherWorldGroup.add(ballGroup);

      this.dragonBalls.push({
        id: loc.id,
        group: ballGroup,
        light,
        x: loc.x,
        y: loc.y,
        z: loc.z,
        baseY: loc.y,
        isCollected: false,
      });
    });
  }

  /**
   * Collision check: Returns elevation and surface properties if entity is atop an Otherworld platform
   */
  public getOtherWorldElevation(
    x: number,
    z: number,
  ): { onPlatform: boolean; height: number; isBoostPad?: boolean } {
    for (const p of this.platforms) {
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
        return { onPlatform: true, height: p.height, isBoostPad: p.isBoostPad };
      }
    }
    return { onPlatform: false, height: -999 };
  }

  /**
   * Teleportation trigger check
   */
  public checkPortalTransition(
    x: number,
    _y: number,
    z: number,
  ): {
    shouldWarp: boolean;
    targetDimension: 'NORMAL_WORLD' | 'OTHER_WORLD';
    targetPos: { x: number; y: number; z: number };
  } {
    if (this.warpCooldown > 0) {
      return {
        shouldWarp: false,
        targetDimension: this.currentDimension,
        targetPos: { x, y: _y, z },
      };
    }

    if (this.currentDimension === 'NORMAL_WORLD') {
      const d = Math.hypot(x - this.cityPortalPos.x, z - this.cityPortalPos.z);
      if (d < 5.2) {
        return {
          shouldWarp: true,
          targetDimension: 'OTHER_WORLD',
          targetPos: {
            x: this.otherWorldPortalPos.x,
            y: this.otherWorldPortalPos.y + 1.2,
            z: this.otherWorldPortalPos.z + 5.0,
          },
        };
      }
    } else {
      const d = Math.hypot(x - this.otherWorldPortalPos.x, z - this.otherWorldPortalPos.z);
      if (d < 5.2) {
        return {
          shouldWarp: true,
          targetDimension: 'NORMAL_WORLD',
          targetPos: {
            x: this.cityPortalPos.x,
            y: this.cityPortalPos.y + 1.2,
            z: this.cityPortalPos.z + 5.0,
          },
        };
      }
    }

    return {
      shouldWarp: false,
      targetDimension: this.currentDimension,
      targetPos: { x, y: _y, z },
    };
  }

  /**
   * Dragon Ball Collection Check
   */
  public checkBallCollection(
    x: number,
    y: number,
    z: number,
  ): { collected: boolean; ballId: number; allCollected: boolean } {
    for (const ball of this.dragonBalls) {
      if (ball.isCollected) continue;

      const dist = Math.hypot(x - ball.x, y - ball.y, z - ball.z);
      if (dist < 4.2) {
        ball.isCollected = true;
        ball.group.visible = false;
        ball.light.intensity = 0;
        this.collectedBallsCount++;

        const allCollected = this.collectedBallsCount === this.dragonBalls.length;
        return { collected: true, ballId: ball.id, allCollected };
      }
    }

    return { collected: false, ballId: 0, allCollected: false };
  }

  /**
   * Update visual animations (swirling vortices, rotating rings, bobbing dragon balls)
   */
  public update(dt: number): void {
    if (this.warpCooldown > 0) {
      this.warpCooldown = Math.max(0, this.warpCooldown - dt);
    }

    this.animTimer += dt;

    // Rotate and pulse City Portal
    if (this.cityPortalRing) {
      this.cityPortalRing.rotation.z += dt * 1.5;
      this.cityPortalVortex.rotation.z -= dt * 2.2;
      const pulse = Math.sin(this.animTimer * 4) * 0.15;
      this.cityPortalVortex.scale.set(1.0 + pulse, 1.0 + pulse, 1.0);
      this.cityPortalLight.intensity = 3.5 + Math.sin(this.animTimer * 6) * 1.2;
    }

    // Rotate and pulse Otherworld Return Portal
    if (this.otherWorldPortalRing) {
      this.otherWorldPortalRing.rotation.z -= dt * 1.5;
      this.otherWorldPortalVortex.rotation.z += dt * 2.2;
      const pulse = Math.sin(this.animTimer * 4) * 0.15;
      this.otherWorldPortalVortex.scale.set(1.0 + pulse, 1.0 + pulse, 1.0);
      this.otherWorldPortalLight.intensity = 4.0 + Math.sin(this.animTimer * 6) * 1.2;
    }

    // Bobbing & Spinning Dragon Balls
    for (const ball of this.dragonBalls) {
      if (ball.isCollected) continue;
      ball.group.rotation.y += dt * 2.0;
      ball.group.rotation.x = Math.sin(this.animTimer * 2) * 0.2;
      ball.group.position.y = ball.baseY + Math.sin(this.animTimer * 3 + ball.id) * 0.6;
    }
  }
}
