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
  isSlope?: boolean;
  slopeStartHeight?: number;
  slopeEndHeight?: number;
  slopeStartZ?: number;
  slopeEndZ?: number;
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

  // Moon Structures & Entities
  public earthGroup!: THREE.Group;
  public apolloGroup!: THREE.Group;
  public baseAlphaGroup!: THREE.Group;
  public monolithGroup!: THREE.Group;
  public satelliteDishMesh!: THREE.Mesh;

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
    this.otherWorldGroup.visible = false;
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
   * 2. The Moon (Mondwelt): Lunar Regolith, Apollo 11, Moon Base Alpha & Earth in the Sky
   */
  private buildOtherWorld(): void {
    const ox = this.otherWorldPortalPos.x;
    const oy = this.otherWorldPortalPos.y;
    const oz = this.otherWorldPortalPos.z;

    // A. Vast Lunar Regolith Plain & Elevated Stunt Highway Ramps
    this.buildLunarTerrain(ox, oy, oz);

    // B. Planet Earth suspended in the lunar sky
    this.buildEarthInSky(ox, oy, oz);

    // C. Apollo 11 Landing Site ("Tranquility Base")
    this.buildApolloLandingSite(ox, oy, oz);

    // D. Moon Base Alpha: Geodesic Bio-Dome, Habitats, Solar Farm & Deep Space Dish
    this.buildMoonBaseAlpha(ox, oy, oz);

    // E. Tycho & Copernicus Craters, Alien Monolith & Lunar Boulders
    this.buildCratersAndMonolith(ox, oy, oz);

    // F. Cosmic Starfield and Space Dust
    this.buildCosmicDeco(ox, oy, oz);
  }

  private buildLunarTerrain(ox: number, oy: number, oz: number): void {
    // 1. Central Lunar Launchpad (Return Portal Platform to Earth/GTA 7 City)
    this.createPlatform(ox - 50, ox + 50, oz - 50, oz + 50, 400.0, 0x1e293b, 0x00f0ff);

    // Central Return Portal
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

    // 2. High-Speed Lunar Rover Highway (Snake Way) with Neon Booster Pads
    this.createPlatform(ox - 8, ox + 8, oz + 50, oz + 170, 400.0, 0x0f172a, 0xfacc15, true);

    // 3. Tycho Mega Jump Ramp: Slanted launch ramp towards Tycho Ridge
    this.createPlatform(
      ox - 9,
      ox + 9,
      oz + 170,
      oz + 205,
      412.0,
      0x3b82f6,
      0x00f0ff,
      true,
      true,
      400.0,
      412.0,
      oz + 170,
      oz + 205,
    );

    // 4. Tycho South Landing Ridge
    this.createPlatform(ox - 40, ox + 40, oz + 235, oz + 315, 420.0, 0x312e81, 0xec4899);

    // 5. North Polar Ridge
    this.createPlatform(ox - 6, ox + 6, oz - 100, oz - 50, 400.0, 0x0f172a, 0x38bdf8);
    this.createPlatform(ox - 40, ox + 40, oz - 180, oz - 100, 402.0, 0x1e1b4b, 0x38bdf8);

    // 6. East Lunar Runway & Stunt Loop
    this.createPlatform(ox + 50, ox + 220, oz - 8, oz + 8, 405.0, 0x0f172a, 0x10b981, true);
    this.createPlatform(ox + 200, ox + 265, oz - 35, oz + 35, 405.0, 0x1e293b, 0x10b981);

    // 7. West Dragon Altar & Copernicus Peak
    this.createPlatform(ox - 100, ox - 50, oz - 6, oz + 6, 400.0, 0x0f172a, 0xf97316);
    this.createPlatform(ox - 180, ox - 100, oz - 35, oz + 35, 408.0, 0x431407, 0xf97316);

    // 8. Northeast Alien Monolith Ridge (moved clear of Apollo 11 Tranquility Base)
    this.createPlatform(ox + 70, ox + 140, oz - 140, oz - 70, 415.0, 0x581c87, 0xc084fc);

    // 9. Vast Lunar Plain Ground Slab (560m x 560m Gray Regolith)
    const moonGroundGeo = new THREE.PlaneGeometry(560, 560);
    const moonGroundMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.95,
      metalness: 0.05,
    });
    const moonGround = new THREE.Mesh(moonGroundGeo, moonGroundMat);
    moonGround.rotation.x = -Math.PI / 2;
    moonGround.position.set(ox, oy - 0.1, oz);
    moonGround.receiveShadow = true;
    this.otherWorldGroup.add(moonGround);
  }

  private buildEarthInSky(ox: number, oy: number, oz: number): void {
    this.earthGroup = new THREE.Group();
    // Position high in the north-eastern lunar sky
    this.earthGroup.position.set(ox + 120, oy + 260, oz - 380);

    // Deep blue ocean sphere
    const oceanGeo = new THREE.SphereGeometry(32, 32, 32);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.3,
      metalness: 0.1,
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    this.earthGroup.add(oceanMesh);

    // Continent landmasses
    const continentMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.8,
      metalness: 0.05,
    });
    const desertMat = new THREE.MeshStandardMaterial({
      color: 0xca8a04,
      roughness: 0.9,
    });

    const continents = [
      { lat: 0.2, lon: 0.1, rad: 14, mat: continentMat },
      { lat: -0.2, lon: 0.3, rad: 11, mat: desertMat },
      { lat: 0.3, lon: -1.6, rad: 12, mat: continentMat },
      { lat: -0.3, lon: -1.2, rad: 10, mat: continentMat },
      { lat: -0.5, lon: 2.2, rad: 9, mat: desertMat },
      { lat: 0.85, lon: 0.0, rad: 7, mat: new THREE.MeshBasicMaterial({ color: 0xffffff }) },
      { lat: -0.85, lon: 0.0, rad: 8, mat: new THREE.MeshBasicMaterial({ color: 0xffffff }) },
    ];

    continents.forEach((c) => {
      const cGeo = new THREE.SphereGeometry(c.rad, 16, 16);
      const cMesh = new THREE.Mesh(cGeo, c.mat);
      const r = 26;
      cMesh.position.set(
        Math.cos(c.lat) * Math.sin(c.lon) * r,
        Math.sin(c.lat) * r,
        Math.cos(c.lat) * Math.cos(c.lon) * r,
      );
      this.earthGroup.add(cMesh);
    });

    // Swirling white cloud layer
    const cloudGeo = new THREE.SphereGeometry(32.8, 32, 32);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.38,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    this.earthGroup.add(cloudMesh);

    // Glowing cyan atmospheric halo
    const atmosGeo = new THREE.SphereGeometry(35.5, 32, 32);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    this.earthGroup.add(atmosMesh);

    // Earthshine PointLight
    const earthLight = new THREE.PointLight(0x60a5fa, 2.5, 900);
    this.earthGroup.add(earthLight);

    this.otherWorldGroup.add(this.earthGroup);
  }

  private buildApolloLandingSite(ox: number, oy: number, oz: number): void {
    const lx = ox - 80;
    const lz = oz - 70;
    this.apolloGroup = new THREE.Group();
    this.apolloGroup.position.set(lx, oy, lz);

    // A. Descent Stage (Gold foil octagonal body)
    const descentGeo = new THREE.CylinderGeometry(4.4, 4.8, 2.6, 8);
    const descentMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x854d0e,
      emissiveIntensity: 0.35,
    });
    const descentStage = new THREE.Mesh(descentGeo, descentMat);
    descentStage.position.y = 2.4;
    descentStage.castShadow = true;
    this.apolloGroup.add(descentStage);

    // 4 Landing Strut Legs with Footpads
    const legMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.8,
      roughness: 0.2,
    });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const legGroup = new THREE.Group();

      const strutGeo = new THREE.CylinderGeometry(0.14, 0.14, 5.5, 8);
      const strut = new THREE.Mesh(strutGeo, legMat);
      strut.position.set(Math.cos(angle) * 3.2, 1.4, Math.sin(angle) * 3.2);
      strut.rotation.z = Math.cos(angle) * 0.55;
      strut.rotation.x = -Math.sin(angle) * 0.55;
      legGroup.add(strut);

      const padGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.15, 16);
      const pad = new THREE.Mesh(padGeo, descentMat);
      pad.position.set(Math.cos(angle) * 5.2, 0.08, Math.sin(angle) * 5.2);
      legGroup.add(pad);

      this.apolloGroup.add(legGroup);
    }

    // Engine Bell
    const engineGeo = new THREE.ConeGeometry(1.4, 1.8, 16, 1, true);
    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      metalness: 0.9,
      roughness: 0.4,
    });
    const engineBell = new THREE.Mesh(engineGeo, engineMat);
    engineBell.position.y = 0.9;
    this.apolloGroup.add(engineBell);

    // B. Ascent Stage (Cabin, windows, radar, RCS)
    const ascentMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.7,
      roughness: 0.3,
    });
    const cabinGeo = new THREE.BoxGeometry(4.0, 2.6, 3.4);
    const cabin = new THREE.Mesh(cabinGeo, ascentMat);
    cabin.position.y = 4.8;
    this.apolloGroup.add(cabin);

    // Windows
    const winMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const winL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.1), winMat);
    winL.position.set(-1.0, 5.2, 1.72);
    const winR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.1), winMat);
    winR.position.set(1.0, 5.2, 1.72);
    this.apolloGroup.add(winL, winR);

    // Steerable Antenna
    const dishGeo = new THREE.CylinderGeometry(1.2, 0.2, 0.4, 16);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9 });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(1.5, 6.6, -0.8);
    dish.rotation.x = 0.6;
    this.apolloGroup.add(dish);

    // Egress ladder
    const ladderMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    for (let step = 0; step < 7; step++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), ladderMat);
      rung.position.set(0, 0.5 + step * 0.45, 4.4 - step * 0.2);
      this.apolloGroup.add(rung);
    }

    // C. Apollo 11 Flag
    const flagPoleGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8);
    const flagPole = new THREE.Mesh(flagPoleGeo, legMat);
    flagPole.position.set(6.5, 1.6, 2.5);
    this.apolloGroup.add(flagPole);

    const flagMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xef4444, side: THREE.DoubleSide }),
    );
    flagMesh.position.set(7.4, 2.5, 2.5);
    this.apolloGroup.add(flagMesh);

    const canton = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.55),
      new THREE.MeshBasicMaterial({ color: 0x1e3a8a, side: THREE.DoubleSide }),
    );
    canton.position.set(6.9, 2.78, 2.51);
    this.apolloGroup.add(canton);

    // Commemorative Plaque
    const plaqueGeo = new THREE.BoxGeometry(1.0, 0.08, 0.8);
    const plaqueMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9 });
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaque.position.set(0, 0.05, 5.8);
    this.apolloGroup.add(plaque);

    this.otherWorldGroup.add(this.apolloGroup);
  }

  private buildMoonBaseAlpha(ox: number, oy: number, oz: number): void {
    this.baseAlphaGroup = new THREE.Group();

    // A. Giant Geodesic Bio-Dome
    const domeX = ox;
    const domeZ = oz - 60;

    const domeGeo = new THREE.SphereGeometry(24, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.8,
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.set(domeX, oy, domeZ);
    this.baseAlphaGroup.add(domeMesh);

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    const domeWire = new THREE.Mesh(domeGeo, wireMat);
    domeWire.position.set(domeX, oy, domeZ);
    this.baseAlphaGroup.add(domeWire);

    // Inside Dome: Hydroponic lawn
    const lawnGeo = new THREE.CircleGeometry(23.5, 32);
    lawnGeo.rotateX(-Math.PI / 2);
    const lawnMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 });
    const lawn = new THREE.Mesh(lawnGeo, lawnMat);
    lawn.position.set(domeX, oy + 0.15, domeZ);
    this.baseAlphaGroup.add(lawn);

    // Hydroponic Cyber Trees & Bio-Plants
    for (let t = 0; t < 6; t++) {
      const tAngle = (t * Math.PI) / 3;
      const tx = domeX + Math.cos(tAngle) * 12;
      const tz = domeZ + Math.sin(tAngle) * 12;

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.45, 4.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x78350f }),
      );
      trunk.position.set(tx, oy + 2.25, tz);

      const foliage = new THREE.Mesh(
        new THREE.DodecahedronGeometry(2.2),
        new THREE.MeshStandardMaterial({
          color: 0x22c55e,
          emissive: 0x15803d,
          emissiveIntensity: 0.3,
        }),
      );
      foliage.position.set(tx, oy + 5.2, tz);
      this.baseAlphaGroup.add(trunk, foliage);
    }

    // Central Bio-Pond
    const pondGeo = new THREE.CylinderGeometry(4.0, 4.0, 0.4, 24);
    const pondMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.4,
      roughness: 0.1,
    });
    const pond = new THREE.Mesh(pondGeo, pondMat);
    pond.position.set(domeX, oy + 0.2, domeZ);
    this.baseAlphaGroup.add(pond);

    // B. Pressurized Habitat Modules & Corridors
    const habCoords = [
      { x: domeX - 35, z: domeZ },
      { x: domeX + 35, z: domeZ },
      { x: domeX, z: domeZ - 35 },
    ];
    habCoords.forEach((h) => {
      const habGeo = new THREE.CylinderGeometry(5.0, 5.0, 14.0, 16);
      habGeo.rotateZ(Math.PI / 2);
      const habMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        metalness: 0.85,
        roughness: 0.25,
      });
      const hab = new THREE.Mesh(habGeo, habMat);
      hab.position.set(h.x, oy + 3.0, h.z);
      this.baseAlphaGroup.add(hab);

      const tubeGeo = new THREE.CylinderGeometry(2.0, 2.0, 16.0, 12);
      tubeGeo.rotateZ(Math.PI / 2);
      const tubeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.position.set((domeX + h.x) / 2, oy + 2.0, (domeZ + h.z) / 2);
      this.baseAlphaGroup.add(tube);
    });

    // C. Giant Deep-Space Earth Communications Dish
    const dishTowerX = ox + 65;
    const dishTowerZ = oz - 20;

    const towerGeo = new THREE.CylinderGeometry(1.5, 3.2, 18, 6);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(dishTowerX, oy + 9.0, dishTowerZ);
    this.baseAlphaGroup.add(tower);

    const dishGeo = new THREE.CylinderGeometry(10.0, 1.2, 3.5, 24, 1, true);
    dishGeo.rotateX(Math.PI / 2 + 0.65);
    const dishMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.9,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });
    this.satelliteDishMesh = new THREE.Mesh(dishGeo, dishMat);
    this.satelliteDishMesh.position.set(dishTowerX, oy + 19.0, dishTowerZ);
    this.baseAlphaGroup.add(this.satelliteDishMesh);

    const beacon = new THREE.PointLight(0xef4444, 3.0, 25);
    beacon.position.set(dishTowerX, oy + 22.0, dishTowerZ - 3.5);
    this.baseAlphaGroup.add(beacon);

    // D. Lunar Solar Panel Array (3 rows)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const px = ox - 65 - c * 7.5;
        const pz = oz - 15 - r * 9.0;

        const panelGeo = new THREE.BoxGeometry(6.0, 0.15, 4.0);
        panelGeo.rotateX(0.5);
        const panelMat = new THREE.MeshStandardMaterial({
          color: 0x1e3a8a,
          roughness: 0.1,
          metalness: 0.95,
        });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.set(px, oy + 2.0, pz);

        const stand = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 2.5, 8),
          new THREE.MeshStandardMaterial({ color: 0x64748b }),
        );
        stand.position.set(px, oy + 1.25, pz);
        this.baseAlphaGroup.add(panel, stand);
      }
    }

    this.otherWorldGroup.add(this.baseAlphaGroup);
  }

  private buildCratersAndMonolith(ox: number, oy: number, oz: number): void {
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.95,
      metalness: 0.1,
    });

    // A. Tycho Crater (Giant Stunt Bowl at South oz + 180)
    const tychoX = ox;
    const tychoZ = oz + 180;
    const tychoRimGeo = new THREE.TorusGeometry(48, 4.5, 12, 36);
    tychoRimGeo.rotateX(Math.PI / 2);
    const tychoRim = new THREE.Mesh(tychoRimGeo, rimMat);
    tychoRim.position.set(tychoX, oy + 3.0, tychoZ);
    this.otherWorldGroup.add(tychoRim);

    // B. Copernicus Crater (Impact Crater at West ox - 140)
    const copX = ox - 140;
    const copZ = oz;
    const copRimGeo = new THREE.TorusGeometry(36, 3.8, 12, 32);
    copRimGeo.rotateX(Math.PI / 2);
    const copRim = new THREE.Mesh(copRimGeo, rimMat);
    copRim.position.set(copX, oy + 2.5, copZ);

    const peakGeo = new THREE.ConeGeometry(8.0, 12.0, 8);
    const peakMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const peak = new THREE.Mesh(peakGeo, peakMat);
    peak.position.set(copX, oy + 6.0, copZ);
    this.otherWorldGroup.add(copRim, peak);

    // C. Alien Monolith (2001: A Space Odyssey) at (ox + 120, oy, oz - 120)
    this.monolithGroup = new THREE.Group();
    this.monolithGroup.position.set(ox + 120, oy, oz - 120);

    const monoGeo = new THREE.BoxGeometry(2.0, 16.0, 8.0);
    const monoMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.05,
      metalness: 0.95,
    });
    const monolith = new THREE.Mesh(monoGeo, monoMat);
    monolith.position.y = 8.0;
    this.monolithGroup.add(monolith);

    const monoLight = new THREE.PointLight(0xa855f7, 4.0, 25);
    monoLight.position.set(0, 8.0, 0);
    this.monolithGroup.add(monoLight);

    this.otherWorldGroup.add(this.monolithGroup);

    // D. Scattered Lunar Boulders & Rocks
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    for (let i = 0; i < 45; i++) {
      const rx = ox + Math.sin(i * 1.7) * 220;
      const rz = oz + Math.cos(i * 2.3) * 220;
      const scale = 1.0 + (i % 5) * 0.8;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale), rockMat);
      rock.position.set(rx, oy + scale * 0.7, rz);
      rock.rotation.set(i, i * 0.5, i * 0.3);
      this.otherWorldGroup.add(rock);
    }
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
    isSlope: boolean = false,
    slopeStartHeight?: number,
    slopeEndHeight?: number,
    slopeStartZ?: number,
    slopeEndZ?: number,
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

    const rimGeo = new THREE.BoxGeometry(width + 0.6, 0.4, depth + 0.6);
    const rimMat = new THREE.MeshBasicMaterial({
      color: rimColor,
      wireframe: false,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);

    if (isSlope) {
      const startH = slopeStartHeight ?? 400.0;
      const endH = slopeEndHeight ?? height;
      const rise = endH - startH;
      const slantAngle = Math.atan2(rise, depth);
      slab.position.set(centerX, (startH + endH) / 2 - thickness / 2, centerZ);
      slab.rotation.x = -slantAngle;
      rim.position.set(centerX, (startH + endH) / 2 + 0.1, centerZ);
      rim.rotation.x = -slantAngle;
    } else {
      slab.position.set(centerX, height - thickness / 2, centerZ);
      rim.position.set(centerX, height + 0.1, centerZ);
    }

    slab.receiveShadow = true;
    this.otherWorldGroup.add(slab);
    this.otherWorldGroup.add(rim);

    // Register platform collision box
    this.platforms.push({
      minX,
      maxX,
      minZ,
      maxZ,
      height,
      isBoostPad,
      isSlope,
      slopeStartHeight,
      slopeEndHeight,
      slopeStartZ,
      slopeEndZ,
    });
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
   * 3. Spawn the 7 Collectable Dragon Balls (Golden Glowing Energy Orbs) across Moon Landmarks
   */
  private spawnDragonBalls(): void {
    const ox = this.otherWorldPortalPos.x;
    const oz = this.otherWorldPortalPos.z;

    const locations = [
      { id: 1, x: ox - 80, y: 406.5, z: oz - 70 }, // Apollo 11 Lunar Module
      { id: 2, x: ox, y: 418.5, z: oz - 60 }, // Peak of Geodesic Bio-Dome
      { id: 3, x: ox, y: 407.0, z: oz - 140 }, // North Polar Ridge
      { id: 4, x: ox + 65, y: 423.0, z: oz - 20 }, // Earth Satellite Dish Feedhorn
      { id: 5, x: ox, y: 432.0, z: oz + 205 }, // Mid-air over Tycho Mega Jump Ramp
      { id: 6, x: ox + 120, y: 409.0, z: oz - 120 }, // Next to Alien Monolith
      { id: 7, x: ox - 140, y: 413.0, z: oz }, // Copernicus Crater Rebound Peak
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
   * Collision check: Returns elevation and surface properties if entity is atop a Lunar surface / platform
   */
  public getOtherWorldElevation(
    x: number,
    z: number,
  ): { onPlatform: boolean; height: number; isBoostPad?: boolean } {
    for (const p of this.platforms) {
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
        if (p.isSlope && p.slopeStartZ !== undefined && p.slopeEndZ !== undefined) {
          const t = Math.max(0, Math.min(1, (z - p.slopeStartZ) / (p.slopeEndZ - p.slopeStartZ)));
          const h =
            (p.slopeStartHeight ?? 400.0) +
            t * ((p.slopeEndHeight ?? p.height) - (p.slopeStartHeight ?? 400.0));
          return { onPlatform: true, height: h, isBoostPad: p.isBoostPad };
        }
        return { onPlatform: true, height: p.height, isBoostPad: p.isBoostPad };
      }
    }
    // Main Lunar Regolith surface (covering the vast moon terrain)
    if (x >= 2220 && x <= 2780 && z >= 2220 && z <= 2780) {
      return { onPlatform: true, height: 400.0, isBoostPad: false };
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
        ball.light.visible = false;
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

    // Slowly rotate Planet Earth in the Lunar Sky!
    if (this.earthGroup) {
      this.earthGroup.rotation.y += dt * 0.04;
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
