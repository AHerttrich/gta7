import * as THREE from 'three';
import { Player } from '../character/Player';
import { GameCamera } from '../engine/Camera';
import { HUD } from '../ui/HUD';
import { SoundManager } from '../audio/SoundManager';
import { WeaponSystem } from '../combat/WeaponSystem';
import { PoliceSystem } from '../police/PoliceSystem';
import { EconomySystem } from '../economy/EconomySystem';
import { Input } from '../engine/Input';
import { Car } from '../vehicles/Car';

export interface InteriorDoor {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  // Exterior coordinates in the city
  exteriorX: number;
  exteriorZ: number;
  exteriorHeading: number;
  doorGroup: THREE.Group;
  // Interior space coordinates
  interiorSpawn: { x: number; y: number; z: number; heading: number };
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    floorY: number;
    ceilingY: number;
  };
}

export interface InteriorInteractable {
  id: string;
  name: string;
  prompt: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  onInteract: (context: {
    player: Player;
    hud: HUD;
    sound: SoundManager;
    weapons: WeaponSystem;
    police: PoliceSystem;
    economy: EconomySystem;
  }) => void;
}

export class InteriorSystem {
  public group: THREE.Group;
  public doors: InteriorDoor[] = [];
  public currentInteriorId: string | null = null;
  public interactables: Map<string, InteriorInteractable[]> = new Map();

  private scene: THREE.Scene;
  private animTimer: number = 0;

  // Animated Nightclub Meshes
  private danceFloorTiles: THREE.Mesh[] = [];
  private djBars: THREE.Mesh[] = [];
  private hackerLeds: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.registerDoors();
    this.buildAllInteriors();
  }

  /**
   * 1. Register street-level entrance doors across city districts
   */
  private registerDoors(): void {
    const doorConfigs = [
      {
        id: 'penthouse',
        name: 'Luxus-Penthouse Suite',
        subtitle: 'Wohnen, Erholen & Schlafen',
        icon: '🏠',
        exteriorX: -88,
        exteriorZ: -56,
        exteriorHeading: 0,
        doorColor: 0xfacc15, // Golden cyber
        interiorSpawn: { x: 4000, y: 100.0, z: 3992, heading: 0 },
        bounds: {
          minX: 3986,
          maxX: 4014,
          minZ: 3988,
          maxZ: 4012,
          floorY: 100.0,
          ceilingY: 105.0,
        },
      },
      {
        id: 'gun_store',
        name: 'Ammu-Nation Waffenladen & Schießstand',
        subtitle: 'Munition, Waffen & Schießtraining',
        icon: '🔫',
        exteriorX: 56,
        exteriorZ: -88,
        exteriorHeading: -Math.PI / 2,
        doorColor: 0xef4444, // Red
        interiorSpawn: { x: 4100, y: 100.0, z: 3988, heading: 0 },
        bounds: {
          minX: 4088,
          maxX: 4112,
          minZ: 3984,
          maxZ: 4016,
          floorY: 100.0,
          ceilingY: 105.0,
        },
      },
      {
        id: 'nightclub',
        name: 'Club "Neon Dreams"',
        subtitle: 'Cyber-Disco, DJ & VIP-Lounge',
        icon: '🍸',
        exteriorX: 88,
        exteriorZ: 56,
        exteriorHeading: Math.PI,
        doorColor: 0xec4899, // Neon Pink
        interiorSpawn: { x: 4200, y: 100.0, z: 3988, heading: 0 },
        bounds: {
          minX: 4186,
          maxX: 4214,
          minZ: 3986,
          maxZ: 4214,
          floorY: 100.0,
          ceilingY: 105.5,
        },
      },
      {
        id: 'hacker_loft',
        name: 'Hacker-Safehouse & Syndikat-Loft',
        subtitle: 'Polizeidatenbank-Hack & Waffenwerkbank',
        icon: '💻',
        exteriorX: -144,
        exteriorZ: 0,
        exteriorHeading: Math.PI / 2,
        doorColor: 0x10b981, // Emerald green
        interiorSpawn: { x: 4300, y: 100.0, z: 3990, heading: 0 },
        bounds: {
          minX: 4288,
          maxX: 4312,
          minZ: 3988,
          maxZ: 4012,
          floorY: 100.0,
          ceilingY: 104.8,
        },
      },
      {
        id: 'city_bank',
        name: 'Cyber City Bank & Tresorraum',
        subtitle: 'Schalterhalle & Goldtresor',
        icon: '🏦',
        exteriorX: 0,
        exteriorZ: 56,
        exteriorHeading: Math.PI,
        doorColor: 0x3b82f6, // Royal blue
        interiorSpawn: { x: 4400, y: 100.0, z: 3988, heading: 0 },
        bounds: {
          minX: 4386,
          maxX: 4414,
          minZ: 3986,
          maxZ: 4014,
          floorY: 100.0,
          ceilingY: 105.0,
        },
      },
    ];

    doorConfigs.forEach((cfg) => {
      const doorGroup = new THREE.Group();
      doorGroup.position.set(cfg.exteriorX, 0, cfg.exteriorZ);
      doorGroup.rotation.y = cfg.exteriorHeading;

      // 1. Double Door Portal Frame
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.4,
        metalness: 0.8,
      });
      const neonMat = new THREE.MeshBasicMaterial({ color: cfg.doorColor });

      const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 0.4), frameMat);
      frameL.position.set(-1.8, 1.6, 0);
      const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 0.4), frameMat);
      frameR.position.set(1.8, 1.6, 0);
      const frameTop = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.4, 0.5), frameMat);
      frameTop.position.set(0, 3.2, 0);

      // Glass Doors
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.6,
        roughness: 0.1,
      });
      const doorPanelL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.9, 0.1), glassMat);
      doorPanelL.position.set(-0.8, 1.5, 0);
      const doorPanelR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.9, 0.1), glassMat);
      doorPanelR.position.set(0.8, 1.5, 0);

      // Overhead Illuminated Neon Signboard
      const signBoard = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 0.25), neonMat);
      signBoard.position.set(0, 3.65, 0.1);

      // Pulsing Cyber Doormat / Ground Marker on Sidewalk
      const doormatGeo = new THREE.RingGeometry(1.2, 2.0, 16);
      doormatGeo.rotateX(-Math.PI / 2);
      const doormat = new THREE.Mesh(doormatGeo, neonMat);
      doormat.position.set(0, 0.04, 1.2);

      doorGroup.add(frameL, frameR, frameTop, doorPanelL, doorPanelR, signBoard, doormat);
      this.group.add(doorGroup);

      this.doors.push({
        id: cfg.id,
        name: cfg.name,
        subtitle: cfg.subtitle,
        icon: cfg.icon,
        exteriorX: cfg.exteriorX,
        exteriorZ: cfg.exteriorZ,
        exteriorHeading: cfg.exteriorHeading,
        doorGroup,
        interiorSpawn: cfg.interiorSpawn,
        bounds: cfg.bounds,
      });
    });
  }

  /**
   * 2. Build detailed 3D architectural spaces for all 5 interiors
   */
  private buildAllInteriors(): void {
    this.buildPenthouse();
    this.buildGunStore();
    this.buildNightclub();
    this.buildHackerLoft();
    this.buildCityBank();
  }

  private buildPenthouse(): void {
    const cx = 4000;
    const cy = 100.0;
    const cz = 4000;
    const pentGroup = new THREE.Group();

    // Floor: Polished dark marble with golden cyber seams
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.3, 24),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.6 }),
    );
    floor.position.set(cx, cy - 0.15, cz);
    pentGroup.add(floor);

    // Ceiling with recessed gold ambient lighting
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.3, 24),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
    );
    ceiling.position.set(cx, cy + 4.8, cz);
    pentGroup.add(ceiling);

    // Outer Walls (North, East, West)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(28, 4.8, 0.4), wallMat);
    wallN.position.set(cx, cy + 2.4, cz - 12);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 24), wallMat);
    wallE.position.set(cx + 14, cy + 2.4, cz);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 24), wallMat);
    wallW.position.set(cx - 14, cy + 2.4, cz);

    // South Panoramic Glass Skyline Window Wall
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
      roughness: 0.1,
    });
    const windowWall = new THREE.Mesh(new THREE.BoxGeometry(28, 4.8, 0.2), glassMat);
    windowWall.position.set(cx, cy + 2.4, cz + 12);
    pentGroup.add(wallN, wallE, wallW, windowWall);

    // Living Room: Large Leather Sectional Couch
    const couchMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const sofaMain = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 2.4), couchMat);
    sofaMain.position.set(cx - 4, cy + 0.4, cz + 4);
    const sofaL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 4.5), couchMat);
    sofaL.position.set(cx - 7, cy + 0.4, cz + 1.2);

    // Glass Coffee Table
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.5, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7 }),
    );
    table.position.set(cx - 3.5, cy + 0.25, cz + 1.2);

    // Huge 100-Inch Wall OLED TV Screen
    const tvFrame = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 3.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x020617 }),
    );
    tvFrame.position.set(cx - 4, cy + 2.5, cz - 11.8);
    const tvScreen = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 2.9, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x0284c7 }),
    );
    tvScreen.position.set(cx - 4, cy + 2.5, cz - 11.7);
    pentGroup.add(sofaMain, sofaL, table, tvFrame, tvScreen);

    // Kitchenette & Bar Island with Stools
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.1, 7.0),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.2 }),
    );
    bar.position.set(cx + 4, cy + 0.55, cz - 4);
    pentGroup.add(bar);

    // Master Bedroom: King-size Bed with ambient headboard
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.8, 5.0),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 }),
    );
    bed.position.set(cx + 8, cy + 0.4, cz + 6);
    const headboard = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 2.0, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.4 }),
    );
    headboard.position.set(cx + 8, cy + 1.0, cz + 8.6);
    pentGroup.add(bed, headboard);

    // Exit Door inside the Penthouse
    const exitDoor = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 3.0, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xfacc15 }),
    );
    exitDoor.position.set(cx, cy + 1.5, cz - 11.9);
    pentGroup.add(exitDoor);

    this.group.add(pentGroup);

    // Interactables in Penthouse
    this.interactables.set('penthouse', [
      {
        id: 'penthouse_bed',
        name: 'King-Size Bett',
        prompt: 'Drücke [E] um zu schlafen & dich voll zu erholen (100 HP) 🛏️',
        x: cx + 8,
        y: cy,
        z: cz + 6,
        radius: 2.8,
        onInteract: ({ player, hud, sound }): void => {
          player.health = 100;
          sound.playCheckpointChime();
          hud.showNotification('✨ Du hast dich ausgeruht! Gesundheit auf 100% wiederhergestellt!');
        },
      },
      {
        id: 'penthouse_bar',
        name: 'Cyber-Minibar',
        prompt: 'Drücke [E] um einen erfrischenden Cyber-Cocktail zu trinken 🍸',
        x: cx + 4,
        y: cy,
        z: cz - 4,
        radius: 2.5,
        onInteract: ({ player, hud, sound }): void => {
          player.health = Math.min(100, player.health + 25);
          sound.playHoverEngage();
          hud.showNotification('🍹 Cyber-Cocktail getrunken! +25 HP & Vitalitäts-Boost!');
        },
      },
    ]);
  }

  private buildGunStore(): void {
    const cx = 4100;
    const cy = 100.0;
    const cz = 4000;
    const gunGroup = new THREE.Group();

    // Floor & Ceiling
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(24, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 }),
    );
    floor.position.set(cx, cy - 0.15, cz);
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(24, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }),
    );
    ceiling.position.set(cx, cy + 4.5, cz);
    gunGroup.add(floor, ceiling);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(24, 4.5, 0.4), wallMat);
    wallN.position.set(cx, cy + 2.25, cz - 16);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(24, 4.5, 0.4), wallMat);
    wallS.position.set(cx, cy + 2.25, cz + 16);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.5, 32), wallMat);
    wallE.position.set(cx + 12, cy + 2.25, cz);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.5, 32), wallMat);
    wallW.position.set(cx - 12, cy + 2.25, cz);
    gunGroup.add(wallN, wallS, wallE, wallW);

    // Retail Counter
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1.1, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 }),
    );
    counter.position.set(cx - 4, cy + 0.55, cz - 6);

    // Weapon Rack Wall Display behind counter
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const rack = new THREE.Mesh(new THREE.BoxGeometry(10, 2.5, 0.3), rackMat);
    rack.position.set(cx - 4, cy + 2.5, cz - 15.7);

    // Display guns on rack
    const gunColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.4, 0.2),
        new THREE.MeshStandardMaterial({ color: gunColors[i], metalness: 0.8 }),
      );
      g.position.set(cx - 7 + i * 2, cy + 2.5, cz - 15.5);
      gunGroup.add(g);
    }

    // Shooting Range Partition Wall with Archway
    const partitionL = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 0.4), wallMat);
    partitionL.position.set(cx - 8, cy + 2.25, cz + 2);
    const partitionR = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 0.4), wallMat);
    partitionR.position.set(cx + 8, cy + 2.25, cz + 2);

    // 3 Shooting Targets down the lane
    for (let i = -1; i <= 1; i++) {
      const targetStand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 2.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x64748b }),
      );
      targetStand.position.set(cx + i * 4, cy + 1.0, cz + 13);
      const targetBullseye = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 0.1, 16),
        new THREE.MeshBasicMaterial({ color: 0xef4444 }),
      );
      targetBullseye.rotation.x = Math.PI / 2;
      targetBullseye.position.set(cx + i * 4, cy + 2.0, cz + 13);
      gunGroup.add(targetStand, targetBullseye);
    }

    gunGroup.add(counter, rack, partitionL, partitionR);
    this.group.add(gunGroup);

    // Interactables in Gun Store
    this.interactables.set('gun_store', [
      {
        id: 'gun_counter',
        name: 'Waffenschalter',
        prompt: 'Drücke [E] um das gesamte Waffenarsenal & Vollmunition aufzufüllen ($500) 🔫',
        x: cx - 4,
        y: cy,
        z: cz - 6,
        radius: 2.8,
        onInteract: ({ economy, hud, sound }): void => {
          if (economy.spendCash(500)) {
            economy.weapons.forEach((w) => {
              w.unlocked = true;
              w.ammo = w.maxAmmo;
            });
            sound.playSprayPaint();
            hud.showNotification(
              '🔫 Alle Waffen freigeschaltet & Vollmunition aufgestockt! (-$500)',
            );
          } else {
            hud.showNotification('❌ Nicht genug Geld! Du benötigst $500 für das Arsenal.');
          }
        },
      },
      {
        id: 'shooting_range',
        name: 'Schießstand-Training',
        prompt: 'Drücke [E] für Schießtraining (+Präzisions-Belohnung $250) 🎯',
        x: cx,
        y: cy,
        z: cz + 6,
        radius: 3.5,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(250);
          sound.playGunshot();
          hud.showNotification(
            '🎯 Volltreffer auf der Zielscheibe! +$250 Schießstand-Prämie erhalten!',
          );
        },
      },
    ]);
  }

  private buildNightclub(): void {
    const cx = 4200;
    const cy = 100.0;
    const cz = 4000;
    const clubGroup = new THREE.Group();

    // Floor & Dark Ceiling
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.3, 28),
      new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.1 }),
    );
    floor.position.set(cx, cy - 0.15, cz);
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.3, 28),
      new THREE.MeshStandardMaterial({ color: 0x09090b }),
    );
    ceiling.position.set(cx, cy + 5.2, cz);
    clubGroup.add(floor, ceiling);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(28, 5.2, 0.4), wallMat);
    wallN.position.set(cx, cy + 2.6, cz - 14);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(28, 5.2, 0.4), wallMat);
    wallS.position.set(cx, cy + 2.6, cz + 14);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 28), wallMat);
    wallE.position.set(cx + 14, cy + 2.6, cz);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 28), wallMat);
    wallW.position.set(cx - 14, cy + 2.6, cz);
    clubGroup.add(wallN, wallS, wallE, wallW);

    // 12x12 Animated LED Dance Floor
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 0.1, 2.2),
          new THREE.MeshBasicMaterial({ color: 0xec4899 }),
        );
        tile.position.set(cx + x * 2.4, cy + 0.05, cz + z * 2.4);
        clubGroup.add(tile);
        this.danceFloorTiles.push(tile);
      }
    }

    // Elevated DJ Stage
    const djStage = new THREE.Mesh(
      new THREE.BoxGeometry(8, 1.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x27272a }),
    );
    djStage.position.set(cx, cy + 0.6, cz + 10);
    const djDeck = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.9, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x3f3f46 }),
    );
    djDeck.position.set(cx, cy + 1.65, cz + 9.5);
    clubGroup.add(djStage, djDeck);

    // Animated Neon Equalizer Bars on DJ stage
    for (let i = -4; i <= 4; i++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 1.5, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
      );
      bar.position.set(cx + i * 0.6, cy + 2.2, cz + 11.5);
      clubGroup.add(bar);
      this.djBars.push(bar);
    }

    // VIP Lounge curved booths & bar
    const barCounter = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.2, 9),
      new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.3 }),
    );
    barCounter.position.set(cx + 10, cy + 0.6, cz - 4);
    clubGroup.add(barCounter);

    this.group.add(clubGroup);

    // Interactables in Nightclub
    this.interactables.set('nightclub', [
      {
        id: 'club_dance',
        name: 'Tanzfläche',
        prompt: 'Drücke [E] um auf der Tanzfläche zu tanzen (Beats & Style-Prämie $150) 💃🕺',
        x: cx,
        y: cy,
        z: cz,
        radius: 5.0,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(150);
          sound.playCheckpointChime();
          hud.showNotification('🎶 Du rockst die Tanzfläche im Club Neon Dreams! +$150 erhalten!');
        },
      },
      {
        id: 'club_bar',
        name: 'VIP-Bar',
        prompt: 'Drücke [E] um VIP-Champagner zu bestellen ($100) 🥂',
        x: cx + 10,
        y: cy,
        z: cz - 4,
        radius: 2.5,
        onInteract: ({ player, economy, hud, sound }): void => {
          if (economy.spendCash(100)) {
            player.health = 100;
            sound.playBlowOffValve();
            hud.showNotification('🍾 Edlen Champagner an der VIP-Bar genossen! Gesundheit 100%!');
          } else {
            hud.showNotification('❌ Zu wenig Geld für VIP-Champagner ($100 benötigt).');
          }
        },
      },
    ]);
  }

  private buildHackerLoft(): void {
    const cx = 4300;
    const cy = 100.0;
    const cz = 4000;
    const loftGroup = new THREE.Group();

    // Floor & Ceiling
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(24, 0.3, 22),
      new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.8 }),
    );
    floor.position.set(cx, cy - 0.15, cz);
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(24, 0.3, 22),
      new THREE.MeshStandardMaterial({ color: 0x1c1917 }),
    );
    ceiling.position.set(cx, cy + 4.8, cz);
    loftGroup.add(floor, ceiling);

    // Brick Walls
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(24, 4.8, 0.4), brickMat);
    wallN.position.set(cx, cy + 2.4, cz - 11);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(24, 4.8, 0.4), brickMat);
    wallS.position.set(cx, cy + 2.4, cz + 11);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 22), brickMat);
    wallE.position.set(cx + 12, cy + 2.4, cz);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 22), brickMat);
    wallW.position.set(cx - 12, cy + 2.4, cz);
    loftGroup.add(wallN, wallS, wallE, wallW);

    // Multi-Monitor Hacker Station
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.8, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x09090b }),
    );
    desk.position.set(cx, cy + 0.4, cz + 8);
    loftGroup.add(desk);

    // 3 Curved Matrix Monitors
    const monMat = new THREE.MeshBasicMaterial({ color: 0x10b981 }); // Glowing Matrix Green
    for (let i = -1; i <= 1; i++) {
      const mon = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.1), monMat);
      mon.position.set(cx + i * 1.8, cy + 1.4, cz + 8.6);
      mon.rotation.y = -i * 0.25;
      loftGroup.add(mon);
    }

    // Server Racks with Blinking Lights
    for (let i = 0; i < 3; i++) {
      const rack = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 3.6, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9 }),
      );
      rack.position.set(cx - 8, cy + 1.8, cz - 6 + i * 2.2);

      const led = new THREE.PointLight(0x10b981, 2, 4);
      led.position.set(cx - 7.2, cy + 2.5, cz - 6 + i * 2.2);
      loftGroup.add(rack, led);
      this.hackerLeds.push(led);
    }

    this.group.add(loftGroup);

    // Interactables in Hacker Loft
    this.interactables.set('hacker_loft', [
      {
        id: 'hacker_terminal',
        name: 'Hacker-Terminal',
        prompt: 'Drücke [E] um die Polizeidatenbank zu hacken (Fahndung auf 0 löschen) 💻',
        x: cx,
        y: cy,
        z: cz + 8,
        radius: 2.8,
        onInteract: ({ police, hud, sound }): void => {
          police.setWantedLevel(0);
          sound.playBlowOffValve();
          hud.showNotification(
            '💻 HACK ERFOLGREICH! Polizeiakte gelöscht - 0 Fahndungssterne! Alle Cops ziehen ab!',
          );
        },
      },
    ]);
  }

  private buildCityBank(): void {
    const cx = 4400;
    const cy = 100.0;
    const cz = 4000;
    const bankGroup = new THREE.Group();

    // Floor: White & Black Luxury Marble Tiles
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.3, 26),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.4 }),
    );
    floor.position.set(cx, cy - 0.15, cz);
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.3, 26),
      new THREE.MeshStandardMaterial({ color: 0x1e293b }),
    );
    ceiling.position.set(cx, cy + 4.8, cz);
    bankGroup.add(floor, ceiling);

    // Marble Bank Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(26, 4.8, 0.4), wallMat);
    wallN.position.set(cx, cy + 2.4, cz - 13);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(26, 4.8, 0.4), wallMat);
    wallS.position.set(cx, cy + 2.4, cz + 13);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 26), wallMat);
    wallE.position.set(cx + 13, cy + 2.4, cz);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 26), wallMat);
    wallW.position.set(cx - 13, cy + 2.4, cz);
    bankGroup.add(wallN, wallS, wallE, wallW);

    // Teller Desks
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1.2, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 }),
    );
    desk.position.set(cx - 4, cy + 0.6, cz - 4);
    bankGroup.add(desk);

    // Heavy Circular Vault Door
    const vaultDoor = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 0.5, 24),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.1 }),
    );
    vaultDoor.rotation.z = Math.PI / 2;
    vaultDoor.position.set(cx + 5, cy + 2.2, cz + 10);
    bankGroup.add(vaultDoor);

    // Stacks of Gold Bullion Bars on Pallets inside vault
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.95,
      roughness: 0.2,
      emissive: 0xca8a04,
      emissiveIntensity: 0.3,
    });
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const goldBar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 1.4), goldMat);
        goldBar.position.set(cx + 8 + i * 1.0, cy + 0.3, cz + 8 + j * 1.6);
        bankGroup.add(goldBar);
      }
    }

    this.group.add(bankGroup);

    // Interactables in City Bank
    this.interactables.set('city_bank', [
      {
        id: 'bank_gold',
        name: 'Goldtresor',
        prompt: 'Drücke [E] um Goldbarren aus dem Tresorraum zu plündern (+$3.000) 💰',
        x: cx + 9,
        y: cy,
        z: cz + 9,
        radius: 3.2,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(3000);
          sound.playCheckpointChime();
          hud.showNotification('💰 GOLDBARREN GEPLÜNDERT! +$3.000 fette Beute eingesackt!');
        },
      },
    ]);
  }

  /**
   * Enter a building interior
   */
  public enterInterior(
    id: string,
    player: Player,
    camera: GameCamera,
    hud: HUD,
    sound: SoundManager,
  ): boolean {
    const door = this.doors.find((d) => d.id === id);
    if (!door) return false;

    this.currentInteriorId = id;
    player.setPosition(door.interiorSpawn.x, door.interiorSpawn.y, door.interiorSpawn.z);
    player.rotationY = door.interiorSpawn.heading;
    camera.reset(player.group.position, door.interiorSpawn.heading);

    sound.playHoverEngage();
    hud.showNotification(`${door.icon} ${door.name} betreten! (${door.subtitle})`);
    return true;
  }

  /**
   * Exit the current interior back to the city street
   */
  public exitInterior(player: Player, camera: GameCamera, hud: HUD, sound: SoundManager): boolean {
    if (!this.currentInteriorId) return false;

    const door = this.doors.find((d) => d.id === this.currentInteriorId);
    if (!door) return false;

    this.currentInteriorId = null;
    player.setPosition(door.exteriorX, 0.25, door.exteriorZ + 2.0);
    player.rotationY = door.exteriorHeading;
    camera.reset(player.group.position, door.exteriorHeading);

    sound.playHoverEngage();
    hud.showNotification('🚪 Gebäude verlassen - zurück auf den Straßen von GTA 7!');
    return true;
  }

  /**
   * Main per-frame update loop
   */
  public update(
    dt: number,
    player: Player,
    hud: HUD,
    input: Input,
    sound: SoundManager,
    weapons: WeaponSystem,
    police: PoliceSystem,
    economy: EconomySystem,
    camera: GameCamera,
    car?: Car,
  ): void {
    this.animTimer += dt;

    // Animate Club Neon Dreams LED Dance Floor and DJ Equalizer
    if (this.danceFloorTiles.length > 0) {
      const colors = [0xec4899, 0x00f0ff, 0xfacc15, 0xa855f7, 0x10b981];
      this.danceFloorTiles.forEach((tile, idx) => {
        const cIdx = Math.floor((this.animTimer * 4 + idx) % colors.length);
        (tile.material as THREE.MeshBasicMaterial).color.setHex(colors[cIdx]);
      });
      this.djBars.forEach((bar, idx) => {
        const scaleY = 0.5 + Math.abs(Math.sin(this.animTimer * 8 + idx * 0.8)) * 1.5;
        bar.scale.set(1, scaleY, 1);
      });
    }

    // Animate Hacker Server LEDs
    this.hackerLeds.forEach((led, idx) => {
      led.intensity = Math.sin(this.animTimer * 12 + idx) > 0 ? 3 : 0.5;
    });

    // -------------------------------------------------------------
    // A. Player is INSIDE an Interior
    // -------------------------------------------------------------
    if (this.currentInteriorId) {
      const room = this.doors.find((d) => d.id === this.currentInteriorId);
      if (!room) return;

      // 1. Enforce solid floor & room wall boundaries
      if (player.y < room.bounds.floorY) {
        player.y = room.bounds.floorY;
        player.vy = 0;
        player.setPosition(player.x, player.y, player.z);
      }
      player.x = Math.max(room.bounds.minX + 0.6, Math.min(room.bounds.maxX - 0.6, player.x));
      player.z = Math.max(room.bounds.minZ + 0.6, Math.min(room.bounds.maxZ - 0.6, player.z));
      player.setPosition(player.x, player.y, player.z);

      // 2. Check Exit Door inside room (near interiorSpawn)
      const distToExit = Math.hypot(
        player.x - room.interiorSpawn.x,
        player.z - room.interiorSpawn.z,
      );
      if (distToExit < 2.5) {
        hud.setPrompt(`Drücke [E] um ${room.name} zu verlassen 🚪`);
        if (input.actionInteract) {
          this.exitInterior(player, camera, hud, sound);
          return;
        }
      }

      // 3. Check Interactables inside this room
      const list = this.interactables.get(this.currentInteriorId) || [];
      for (const item of list) {
        const d = Math.hypot(player.x - item.x, player.z - item.z);
        if (d < item.radius) {
          hud.setPrompt(item.prompt);
          if (input.actionInteract) {
            item.onInteract({ player, hud, sound, weapons, police, economy });
          }
          break;
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // B. Player is OUTSIDE in the City near Entrance Doors
    // -------------------------------------------------------------
    const checkX = car ? car.physics.x : player.x;
    const checkZ = car ? car.physics.z : player.z;

    for (const door of this.doors) {
      const dist = Math.hypot(checkX - door.exteriorX, checkZ - door.exteriorZ);
      if (dist < 3.2) {
        if (car) {
          hud.setPrompt(`Drücke [E] um auszusteigen & ${door.name} zu betreten ${door.icon}`);
        } else {
          hud.setPrompt(`Drücke [E] um ${door.name} zu betreten ${door.icon}`);
        }

        if (input.actionInteract) {
          this.enterInterior(door.id, player, camera, hud, sound);
        }
        break;
      }
    }
  }
}
