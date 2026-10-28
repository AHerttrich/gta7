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
import { CITY_CONFIG } from '../utils/Constants';

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
  archetypeId: string;
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

export interface InteriorResident {
  id: string;
  name: string;
  role: string;
  icon: string;
  archetypeId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  group: THREE.Group;
  torsoMesh: THREE.Mesh;
  headMesh: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  isSitting?: boolean;
  isDancing?: boolean;
  dialogues: string[];
  dialogueIndex: number;
}

export class InteriorSystem {
  public group: THREE.Group;
  public doors: InteriorDoor[] = [];
  public currentInteriorId: string | null = null;
  public activeDoor: InteriorDoor | null = null;
  public interactables: Map<string, InteriorInteractable[]> = new Map();
  public residents: InteriorResident[] = [];

  private scene: THREE.Scene;
  private animTimer: number = 0;

  // Animated Nightclub Meshes
  private danceFloorTiles: THREE.Mesh[] = [];
  private djBars: THREE.Mesh[] = [];
  private hackerLeds: THREE.PointLight[] = [];
  private houseOutfitIndex: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.registerDoors();
    this.buildAllInteriors();
  }

  /**
   * Helper to build a 3D entrance portal door frame at street level
   */
  private createDoorGroup(x: number, z: number, heading: number, doorColor: number): THREE.Group {
    const doorGroup = new THREE.Group();
    doorGroup.position.set(x, 0, z);
    doorGroup.rotation.y = heading;

    // 1. Double Door Portal Frame
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.8,
    });
    const neonMat = new THREE.MeshBasicMaterial({ color: doorColor });

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
    return doorGroup;
  }

  /**
   * 1. Register street-level entrance doors across EVERY building in the city
   */
  private registerDoors(): void {
    // A. Handcrafted 5 Landmark Showcase Buildings
    const showcaseConfigs = [
      {
        id: 'penthouse',
        name: 'Luxus-Penthouse Suite',
        subtitle: 'Wohnen, Erholen & Schlafen',
        icon: '🏠',
        exteriorX: -88,
        exteriorZ: -56,
        exteriorHeading: 0,
        doorColor: 0xfacc15,
        archetypeId: 'penthouse',
        interiorSpawn: { x: 4000, y: 100.0, z: 3992, heading: 0 },
        bounds: { minX: 3986, maxX: 4014, minZ: 3988, maxZ: 4012, floorY: 100.0, ceilingY: 105.0 },
      },
      {
        id: 'gun_store',
        name: 'Ammu-Nation Waffenladen & Schießstand',
        subtitle: 'Munition, Waffen & Schießtraining',
        icon: '🔫',
        exteriorX: 56,
        exteriorZ: -88,
        exteriorHeading: -Math.PI / 2,
        doorColor: 0xef4444,
        archetypeId: 'gun_store',
        interiorSpawn: { x: 4100, y: 100.0, z: 3988, heading: 0 },
        bounds: { minX: 4088, maxX: 4112, minZ: 3984, maxZ: 4016, floorY: 100.0, ceilingY: 105.0 },
      },
      {
        id: 'nightclub',
        name: 'Club "Neon Dreams"',
        subtitle: 'Cyber-Disco, DJ & VIP-Lounge',
        icon: '🍸',
        exteriorX: 88,
        exteriorZ: 56,
        exteriorHeading: Math.PI,
        doorColor: 0xec4899,
        archetypeId: 'nightclub',
        interiorSpawn: { x: 4200, y: 100.0, z: 3988, heading: 0 },
        bounds: { minX: 4186, maxX: 4214, minZ: 3986, maxZ: 4214, floorY: 100.0, ceilingY: 105.5 },
      },
      {
        id: 'hacker_loft',
        name: 'Hacker-Safehouse & Syndikat-Loft',
        subtitle: 'Polizeidatenbank-Hack & Waffenwerkbank',
        icon: '💻',
        exteriorX: -144,
        exteriorZ: 0,
        exteriorHeading: Math.PI / 2,
        doorColor: 0x10b981,
        archetypeId: 'hacker_loft',
        interiorSpawn: { x: 4300, y: 100.0, z: 3990, heading: 0 },
        bounds: { minX: 4288, maxX: 4312, minZ: 3988, maxZ: 4012, floorY: 100.0, ceilingY: 104.8 },
      },
      {
        id: 'city_bank',
        name: 'Cyber City Bank & Tresorraum',
        subtitle: 'Schalterhalle & Goldtresor',
        icon: '🏦',
        exteriorX: 0,
        exteriorZ: 56,
        exteriorHeading: Math.PI,
        doorColor: 0x3b82f6,
        archetypeId: 'city_bank',
        interiorSpawn: { x: 4400, y: 100.0, z: 3988, heading: 0 },
        bounds: { minX: 4386, maxX: 4414, minZ: 3986, maxZ: 4014, floorY: 100.0, ceilingY: 105.0 },
      },
    ];

    showcaseConfigs.forEach((cfg) => {
      const doorGroup = this.createDoorGroup(
        cfg.exteriorX,
        cfg.exteriorZ,
        cfg.exteriorHeading,
        cfg.doorColor,
      );
      this.doors.push({
        ...cfg,
        doorGroup,
      });
    });

    // B. Register Doors for Every Other Building in the 7x7 Grid
    const { GRID_SIZE, BLOCK_SIZE, ROAD_WIDTH } = CITY_CONFIG;
    const step = BLOCK_SIZE + ROAD_WIDTH; // 88.0
    const totalSize = GRID_SIZE * step;
    const halfSize = totalSize / 2;

    const districtStyles = [
      [
        'CYBER_TOWER',
        'RESIDENTIAL_BLOCK',
        'LUXURY_RESORT',
        'RESIDENTIAL_BLOCK',
        'CLASSIC_BRICK_LOFT',
        'ROUND_TOWER',
        'CYBER_TOWER',
      ],
      [
        'RESIDENTIAL_BLOCK',
        'COMMERCIAL_HQ',
        'TWIN_TOWERS',
        'ROUND_TOWER',
        'LUXURY_RESORT',
        'COMMERCIAL_HQ',
        'RESIDENTIAL_BLOCK',
      ],
      [
        'PAGODA_NEON_TOWER',
        'ROUND_TOWER',
        'CYBER_TOWER',
        'TWIN_TOWERS',
        'LUXURY_RESORT',
        'PAGODA_NEON_TOWER',
        'ROUND_TOWER',
      ],
      [
        'RESIDENTIAL_BLOCK',
        'COMMERCIAL_HQ',
        'CYBER_TOWER',
        'CYBER_TOWER',
        'COMMERCIAL_HQ',
        'RESIDENTIAL_BLOCK',
        'TWIN_TOWERS',
      ],
      [
        'CLASSIC_BRICK_LOFT',
        'PAGODA_NEON_TOWER',
        'LUXURY_RESORT',
        'RESIDENTIAL_BLOCK',
        'CLASSIC_BRICK_LOFT',
        'ROUND_TOWER',
        'LUXURY_RESORT',
      ],
      [
        'TWIN_TOWERS',
        'COMMERCIAL_HQ',
        'ROUND_TOWER',
        'CYBER_TOWER',
        'TWIN_TOWERS',
        'COMMERCIAL_HQ',
        'PAGODA_NEON_TOWER',
      ],
      [
        'CYBER_TOWER',
        'RESIDENTIAL_BLOCK',
        'COMMERCIAL_HQ',
        'LUXURY_RESORT',
        'CLASSIC_BRICK_LOFT',
        'RESIDENTIAL_BLOCK',
        'CYBER_TOWER',
      ],
    ];

    const archetypeCenters: Record<string, number> = {
      corp_hq: 4500,
      neon_arcade: 4600,
      cyber_loft: 4700,
      martial_dojo: 4800,
      tuner_garage: 4900,
      noodle_bar: 5000,
      ripperdoc: 5100,
      art_gallery: 5200,
      lighthouse_cabin: 5300,
      airport_lounge: 5400,
      stadium_lounge: 5500,
      penthouse: 4000,
    };

    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        // Skip already registered showcase blocks
        if (i === 2 && j === 2) continue; // Penthouse
        if (i === 4 && j === 2) continue; // Gun Store
        if (i === 4 && j === 4) continue; // Nightclub
        if (i === 1 && j === 3) continue; // Hacker Loft
        if (i === 3 && j === 4) continue; // City Bank
        if (i === 3 && j === 3) continue; // Grand Central Cyber Park

        const blockCenterX = -halfSize + i * step + step / 2;
        const blockCenterZ = -halfSize + j * step + step / 2;

        if (i === 1 && j === 1) {
          // Player's Own Luxury Villa Estate ("Dein Eigenes Haus") at Block [1, 1]
          const villaDoorGroup = this.createDoorGroup(-176, -172, 0, 0xf59e0b);
          this.doors.push({
            id: 'player_villa',
            name: '👑 Dein Eigenes Haus (Villa de GTA 7)',
            subtitle: 'Luxus-Villa, Safe, Kleiderschrank & Cyber-Hund Bolt',
            icon: '👑',
            exteriorX: -176,
            exteriorZ: -172,
            exteriorHeading: 0,
            doorGroup: villaDoorGroup,
            archetypeId: 'player_house',
            interiorSpawn: { x: 5600, y: 100.0, z: 3992, heading: 0 },
            bounds: {
              minX: 5580,
              maxX: 5620,
              minZ: 3980,
              maxZ: 4020,
              floorY: 100.0,
              ceilingY: 106.0,
            },
          });
          continue;
        }

        if (i === 5 && j === 3) {
          // Airport Terminal Door
          const airGroup = this.createDoorGroup(176, -18, 0, 0x0284c7);
          this.doors.push({
            id: 'airport_ops',
            name: 'Flughafen VIP-Terminal & Flight Ops',
            subtitle: 'Flugradar, Abflugtafel & Duty-Free',
            icon: '✈️',
            exteriorX: 176,
            exteriorZ: -18,
            exteriorHeading: 0,
            doorGroup: airGroup,
            archetypeId: 'airport_lounge',
            interiorSpawn: { x: 5400, y: 100.0, z: 3992, heading: 0 },
            bounds: {
              minX: 5386,
              maxX: 5414,
              minZ: 3986,
              maxZ: 4014,
              floorY: 100.0,
              ceilingY: 105.0,
            },
          });
          continue;
        }

        if (i === 2 && j === 5) {
          // Stunt Mega Stadium Skybox Door
          const stadGroup = this.createDoorGroup(-88, 150, 0, 0xf59e0b);
          this.doors.push({
            id: 'stadium_vip',
            name: 'Stunt-Stadion VIP-Skybox',
            subtitle: 'Stadion-Ausblick, Trophäen & Energy',
            icon: '🛹',
            exteriorX: -88,
            exteriorZ: 150,
            exteriorHeading: 0,
            doorGroup: stadGroup,
            archetypeId: 'stadium_lounge',
            interiorSpawn: { x: 5500, y: 100.0, z: 3992, heading: 0 },
            bounds: {
              minX: 5486,
              maxX: 5514,
              minZ: 3986,
              maxZ: 4014,
              floorY: 100.0,
              ceilingY: 105.0,
            },
          });
          continue;
        }

        // Standard City Block Building
        const style = districtStyles[i % districtStyles.length][j % districtStyles[0].length];

        let archetypeId = 'cyber_loft';
        let name = `Gebäude [${i},${j}]`;
        let subtitle = 'Eintreten & Erholen';
        let icon = '🏢';
        let doorColor = 0x00f0ff;

        if (style === 'COMMERCIAL_HQ') {
          archetypeId = 'corp_hq';
          name = `🏢 OmniTech Konzernzentrale #${i}${j}`;
          subtitle = 'Vorstandsetage, Trading & Espresso';
          icon = '🏢';
          doorColor = 0x00f0ff;
        } else if (style === 'CYBER_TOWER') {
          archetypeId = (i + j) % 2 === 0 ? 'cyber_loft' : 'ripperdoc';
          name =
            archetypeId === 'cyber_loft'
              ? `🏙️ Cyber Tower Loft #${i}${j}`
              : `💉 Cyberware Ripperdoc-Klinik #${i}${j}`;
          subtitle =
            archetypeId === 'cyber_loft'
              ? 'Skyline-Apartment & Gaming-Station'
              : 'Chirurgie, Implantate & Bio-Heilung';
          icon = archetypeId === 'cyber_loft' ? '🏙️' : '💉';
          doorColor = 0x8b5cf6;
        } else if (style === 'RESIDENTIAL_BLOCK') {
          archetypeId = (i + j) % 2 === 0 ? 'cyber_loft' : 'noodle_bar';
          name =
            archetypeId === 'cyber_loft'
              ? `🏘️ Cyber-Residenz Block #${i}${j}`
              : `🍜 Neon Ramen Bistro #${i}${j}`;
          subtitle =
            archetypeId === 'cyber_loft'
              ? 'Wohnung, Küche & Erholung'
              : 'Dampfende Nudeln, Tee & Glückskatze';
          icon = archetypeId === 'cyber_loft' ? '🏘️' : '🍜';
          doorColor = 0xf59e0b;
        } else if (style === 'LUXURY_RESORT') {
          archetypeId = (i + j) % 2 === 0 ? 'penthouse' : 'neon_arcade';
          name =
            archetypeId === 'penthouse'
              ? `🏨 Vice Grand Resort & Spa #${i}${j}`
              : `🎰 Neon Arcade Casino #${i}${j}`;
          subtitle =
            archetypeId === 'penthouse'
              ? 'VIP-Suite, Erholung & Minibar'
              : 'Retro-Automaten, Flipper & Glücksrad';
          icon = archetypeId === 'penthouse' ? '🏨' : '🎰';
          doorColor = 0xfacc15;
        } else if (style === 'CLASSIC_BRICK_LOFT') {
          archetypeId = 'tuner_garage';
          name = `🔧 Street-Tuner Werkstatt #${i}${j}`;
          subtitle = 'Tuning, Werkbank & Nitro-Nachfüllung';
          icon = '🔧';
          doorColor = 0xef4444;
        } else if (style === 'ROUND_TOWER') {
          archetypeId = 'martial_dojo';
          name = `🥋 Drachen-Dojo & Kampfsport #${i}${j}`;
          subtitle = 'Tatami-Matten, Boxsack & Meditation';
          icon = '🥋';
          doorColor = 0x10b981;
        } else if (style === 'PAGODA_NEON_TOWER') {
          archetypeId = 'noodle_bar';
          name = `🍜 Pagoden Nudelbar #${i}${j}`;
          subtitle = 'Asiatische Spezialitäten & Glücksbringer';
          icon = '🍜';
          doorColor = 0xf43f5e;
        } else if (style === 'TWIN_TOWERS') {
          archetypeId = (i + j) % 2 === 0 ? 'neon_arcade' : 'art_gallery';
          name =
            archetypeId === 'neon_arcade'
              ? `🕹️ Twin Peaks Cyber-Arcade #${i}${j}`
              : `🎨 Cyber Museum & Kunstgalerie #${i}${j}`;
          subtitle =
            archetypeId === 'neon_arcade'
              ? 'Highscore-Jagd & Retro-Gaming'
              : 'Lichtskulpturen & Audiotour';
          icon = archetypeId === 'neon_arcade' ? '🕹️' : '🎨';
          doorColor = 0x06b6d4;
        }

        // Sidewalk door placement: alternating North, South, East, West facades
        const side = (i * 3 + j * 5) % 4;
        let extX = blockCenterX;
        let extZ = blockCenterZ - 26.5;
        let extHeading = Math.PI;

        if (side === 1) {
          extX = blockCenterX;
          extZ = blockCenterZ + 26.5;
          extHeading = 0;
        } else if (side === 2) {
          extX = blockCenterX + 26.5;
          extZ = blockCenterZ;
          extHeading = Math.PI / 2;
        } else if (side === 3) {
          extX = blockCenterX - 26.5;
          extZ = blockCenterZ;
          extHeading = -Math.PI / 2;
        }

        const cx = archetypeCenters[archetypeId] || 4700;
        const dGroup = this.createDoorGroup(extX, extZ, extHeading, doorColor);

        this.doors.push({
          id: `building_${i}_${j}`,
          name,
          subtitle,
          icon,
          exteriorX: extX,
          exteriorZ: extZ,
          exteriorHeading: extHeading,
          doorGroup: dGroup,
          archetypeId,
          interiorSpawn: { x: cx, y: 100.0, z: 3992, heading: 0 },
          bounds: {
            minX: cx - 14,
            maxX: cx + 14,
            minZ: 3986,
            maxZ: 4014,
            floorY: 100.0,
            ceilingY: 105.0,
          },
        });
      }
    }

    // C. Island Lighthouse Keeper's Cottage
    const lightGroup = this.createDoorGroup(-338, -6, Math.PI / 2, 0x10b981);
    this.doors.push({
      id: 'lighthouse_cottage',
      name: '🏡 Leuchtturmwärter-Hütte',
      subtitle: 'Kaminfeuer, Ozean-Fernrohr & Logbuch',
      icon: '🏡',
      exteriorX: -338,
      exteriorZ: -6,
      exteriorHeading: Math.PI / 2,
      doorGroup: lightGroup,
      archetypeId: 'lighthouse_cabin',
      interiorSpawn: { x: 5300, y: 100.0, z: 3992, heading: 0 },
      bounds: { minX: 5286, maxX: 5314, minZ: 3986, maxZ: 4014, floorY: 100.0, ceilingY: 105.0 },
    });
  }

  /**
   * Helper to create a standard 3D room shell (Floor, Ceiling, Walls, Exit Door & Lighting)
   */
  private createRoomShell(
    cx: number,
    cy: number,
    cz: number,
    floorColor: number,
    wallColor: number,
    ambientColor: number,
  ): { group: THREE.Group; exitDoor: THREE.Mesh } {
    const group = new THREE.Group();

    // Floor & Ceiling
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.3, 28),
      new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.3, metalness: 0.4 }),
    );
    floor.position.set(cx, cy - 0.15, cz);

    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.3, 28),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 }),
    );
    ceiling.position.set(cx, cy + 4.8, cz);
    group.add(floor, ceiling);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.7 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(28, 4.8, 0.4), wallMat);
    wallN.position.set(cx, cy + 2.4, cz - 14);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(28, 4.8, 0.4), wallMat);
    wallS.position.set(cx, cy + 2.4, cz + 14);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 28), wallMat);
    wallE.position.set(cx + 14, cy + 2.4, cz);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 28), wallMat);
    wallW.position.set(cx - 14, cy + 2.4, cz);
    group.add(wallN, wallS, wallE, wallW);

    // Exit Door
    const exitDoor = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3.2, 0.2),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xd97706,
        emissiveIntensity: 0.4,
      }),
    );
    exitDoor.position.set(cx, cy + 1.6, cz - 13.8);
    group.add(exitDoor);

    // Ceiling Chandelier / Ambient Light
    const light = new THREE.PointLight(ambientColor, 3.0, 24);
    light.position.set(cx, cy + 4.2, cz);
    group.add(light);

    return { group, exitDoor };
  }

  /**
   * Helper to instantiate a 3D animated human resident / occupant inside an interior
   */
  private createInteriorResident(options: {
    id: string;
    name: string;
    role: string;
    icon: string;
    archetypeId: string;
    x: number;
    y: number;
    z: number;
    rotationY: number;
    shirtColor: number;
    pantsColor: number;
    hairColor?: number;
    isSitting?: boolean;
    isDancing?: boolean;
    dialogues: string[];
    bonusAction?: (ctx: {
      player: Player;
      hud: HUD;
      sound: SoundManager;
      economy: EconomySystem;
    }) => void;
  }): { resident: InteriorResident; interactable: InteriorInteractable } {
    const pedGroup = new THREE.Group();

    const shirtMat = new THREE.MeshStandardMaterial({
      color: options.shirtColor,
      roughness: 0.65,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: options.pantsColor,
      roughness: 0.75,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf5d0b0,
      roughness: 0.8,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: options.hairColor ?? 0x334155,
      roughness: 0.8,
    });

    const isSit = !!options.isSitting;

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.75, 0.35);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = isSit ? 0.82 : 1.15;
    torso.castShadow = true;
    pedGroup.add(torso);

    // Head
    const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = isSit ? 1.42 : 1.75;
    head.castShadow = true;
    pedGroup.add(head);

    // Hair / Cap
    const hairGeo = new THREE.BoxGeometry(0.38, 0.14, 0.38);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = isSit ? 1.58 : 1.91;
    pedGroup.add(hair);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.14, 0.65, 0.16);
    const leftArm = new THREE.Mesh(armGeo, shirtMat);
    const rightArm = new THREE.Mesh(armGeo, shirtMat);

    if (isSit) {
      leftArm.position.set(-0.38, 0.82, 0.12);
      leftArm.rotation.x = 0.5;
      rightArm.position.set(0.38, 0.82, 0.12);
      rightArm.rotation.x = 0.5;
    } else if (options.isDancing) {
      leftArm.position.set(-0.38, 1.25, 0);
      leftArm.rotation.z = 0.5;
      rightArm.position.set(0.38, 1.25, 0);
      rightArm.rotation.z = -0.5;
    } else {
      leftArm.position.set(-0.38, 1.15, 0);
      rightArm.position.set(0.38, 1.15, 0);
    }
    pedGroup.add(leftArm, rightArm);

    // Legs
    let leftLeg: THREE.Mesh;
    let rightLeg: THREE.Mesh;

    if (isSit) {
      const thighL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.45), pantsMat);
      thighL.position.set(-0.14, 0.48, 0.2);
      const thighR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.45), pantsMat);
      thighR.position.set(0.14, 0.48, 0.2);

      const calfL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.44, 0.22), pantsMat);
      calfL.position.set(-0.14, 0.22, 0.4);
      const calfR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.44, 0.22), pantsMat);
      calfR.position.set(0.14, 0.22, 0.4);

      pedGroup.add(thighL, thighR, calfL, calfR);
      leftLeg = thighL;
      rightLeg = thighR;
    } else {
      const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);
      leftLeg = new THREE.Mesh(legGeo, pantsMat);
      leftLeg.position.set(-0.14, 0.38, 0);
      rightLeg = new THREE.Mesh(legGeo, pantsMat);
      rightLeg.position.set(0.14, 0.38, 0);

      pedGroup.add(leftLeg, rightLeg);
    }

    pedGroup.position.set(options.x, options.y, options.z);
    pedGroup.rotation.y = options.rotationY;
    this.group.add(pedGroup);

    const resident: InteriorResident = {
      id: options.id,
      name: options.name,
      role: options.role,
      icon: options.icon,
      archetypeId: options.archetypeId,
      x: options.x,
      y: options.y,
      z: options.z,
      rotationY: options.rotationY,
      group: pedGroup,
      torsoMesh: torso,
      headMesh: head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      isSitting: isSit,
      isDancing: !!options.isDancing,
      dialogues: options.dialogues,
      dialogueIndex: 0,
    };

    this.residents.push(resident);

    const interactable: InteriorInteractable = {
      id: `talk_${options.id}`,
      name: `${options.icon} ${options.name}`,
      prompt: `Drücke [E] um mit ${options.name} (${options.role}) zu sprechen 💬`,
      x: options.x,
      y: options.y,
      z: options.z,
      radius: 2.8,
      onInteract: ({ player, hud, sound, economy }): void => {
        const text = options.dialogues[resident.dialogueIndex];
        resident.dialogueIndex = (resident.dialogueIndex + 1) % options.dialogues.length;
        sound.playHoverEngage();
        hud.showNotification(`${options.icon} ${options.name} (${options.role}): "${text}"`);
        if (options.bonusAction) {
          options.bonusAction({ player, hud, sound, economy });
        }
      },
    };

    return { resident, interactable };
  }

  /**
   * 2. Build detailed 3D architectural spaces for all 16 interior archetypes
   */
  private buildAllInteriors(): void {
    // 5 Original Showcase Interiors
    this.buildPenthouse();
    this.buildGunStore();
    this.buildNightclub();
    this.buildHackerLoft();
    this.buildCityBank();

    // 11 Extended Archetype Interiors
    this.buildCorpHQ();
    this.buildNeonArcade();
    this.buildCyberLoft();
    this.buildMartialDojo();
    this.buildTunerGarage();
    this.buildNoodleBar();
    this.buildRipperdoc();
    this.buildArtGallery();
    this.buildLighthouseCabin();
    this.buildAirportLounge();
    this.buildStadiumLounge();
    this.buildPlayerHouse();
  }

  private buildPenthouse(): void {
    const cx = 4000;
    const cy = 100.0;
    const cz = 4000;
    const pentGroup = new THREE.Group();

    // Floor & Ceiling
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.3, 24),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.6 }),
    );
    floor.position.set(cx, cy - 0.15, cz);
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.3, 24),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
    );
    ceiling.position.set(cx, cy + 4.8, cz);
    pentGroup.add(floor, ceiling);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(28, 4.8, 0.4), wallMat);
    wallN.position.set(cx, cy + 2.4, cz - 12);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 24), wallMat);
    wallE.position.set(cx + 14, cy + 2.4, cz);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 24), wallMat);
    wallW.position.set(cx - 14, cy + 2.4, cz);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
      roughness: 0.1,
    });
    const windowWall = new THREE.Mesh(new THREE.BoxGeometry(28, 4.8, 0.2), glassMat);
    windowWall.position.set(cx, cy + 2.4, cz + 12);
    pentGroup.add(wallN, wallE, wallW, windowWall);

    // Furniture
    const couchMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const sofaMain = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 2.4), couchMat);
    sofaMain.position.set(cx - 4, cy + 0.4, cz + 4);
    const sofaL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 4.5), couchMat);
    sofaL.position.set(cx - 7, cy + 0.4, cz + 1.2);

    const table = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.5, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7 }),
    );
    table.position.set(cx - 4, cy + 0.25, cz + 1.5);

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(7.0, 1.1, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.2 }),
    );
    bar.position.set(cx + 4, cy + 0.55, cz - 4);

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

    const exitDoor = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 3.0, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xfacc15 }),
    );
    exitDoor.position.set(cx, cy + 1.5, cz - 11.9);
    pentGroup.add(sofaMain, sofaL, table, bar, bed, headboard, exitDoor);

    this.group.add(pentGroup);

    // Penthouse Residents: Viktor Vance & Chloe
    const viktor = this.createInteriorResident({
      id: 'penthouse_viktor',
      name: 'Viktor Vance',
      role: 'Suite-Eigentümer & Tycoon',
      icon: '🍸',
      archetypeId: 'penthouse',
      x: cx - 4,
      y: cy,
      z: cz + 3.8,
      rotationY: Math.PI,
      shirtColor: 0xca8a04,
      pantsColor: 0x1e293b,
      hairColor: 0x1e1b18,
      isSitting: true,
      dialogues: [
        'Willkommen in der Vice-Suite! Ganz oben über den Wolken schmeckt der Champagner am besten.',
        'Eleganz und Macht – das ist das Lebensmotto in GTA 7.',
        'Ein Toast auf unseren gemeinsamen Erfolg! Hier, nimm einen Schluck (+30 HP)!',
      ],
      bonusAction: ({ player, sound }): void => {
        player.health = Math.min(100, player.health + 30);
        sound.playHoverEngage();
      },
    });

    const chloe = this.createInteriorResident({
      id: 'penthouse_chloe',
      name: 'Chloe',
      role: 'VIP-Gästin',
      icon: '✨',
      archetypeId: 'penthouse',
      x: cx + 4.5,
      y: cy,
      z: cz - 2.8,
      rotationY: -Math.PI / 2,
      shirtColor: 0xec4899,
      pantsColor: 0x0f172a,
      hairColor: 0xfacc15,
      dialogues: [
        'Die Aussicht von hier oben auf die beleuchtete Skyline ist einfach atemberaubend!',
        'Viktors Partys sind legendär in ganz Vice City.',
      ],
    });

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
      viktor.interactable,
      chloe.interactable,
    ]);
  }

  private buildGunStore(): void {
    const cx = 4100;
    const cy = 100.0;
    const cz = 4000;
    const gunGroup = new THREE.Group();

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

    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1.1, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 }),
    );
    counter.position.set(cx - 4, cy + 0.55, cz - 6);

    const rackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const rack = new THREE.Mesh(new THREE.BoxGeometry(10, 2.5, 0.3), rackMat);
    rack.position.set(cx - 4, cy + 2.5, cz - 15.7);

    const gunColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.4, 0.2),
        new THREE.MeshStandardMaterial({ color: gunColors[i], metalness: 0.8 }),
      );
      g.position.set(cx - 7 + i * 2, cy + 2.5, cz - 15.5);
      gunGroup.add(g);
    }

    const exitDoor = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xef4444 }),
    );
    exitDoor.position.set(cx, cy + 1.6, cz - 15.8);
    gunGroup.add(counter, rack, exitDoor);

    this.group.add(gunGroup);

    // Ammu-Nation Residents: Sgt. Mac & Rusty
    const mac = this.createInteriorResident({
      id: 'gun_mac',
      name: 'Sgt. Mac',
      role: 'Büchsenmacher',
      icon: '🔫',
      archetypeId: 'gun_store',
      x: cx - 4,
      y: cy,
      z: cz - 4.5,
      rotationY: 0,
      shirtColor: 0x15803d,
      pantsColor: 0x334155,
      hairColor: 0x94a3b8,
      dialogues: [
        'Willkommen bei Ammu-Nation! Bei mir gibt es keine Ladehemmung, nur beste Qualität.',
        'Prüfe immer deine Sicherung, bevor du auf die Straße gehst!',
        'Die Raketenwerfer im Hinterzimmer sind frisch reingekommen.',
      ],
    });

    const rusty = this.createInteriorResident({
      id: 'gun_rusty',
      name: 'Rusty',
      role: 'Stammkunde & Schütze',
      icon: '🎯',
      archetypeId: 'gun_store',
      x: cx + 4,
      y: cy,
      z: cz + 4.5,
      rotationY: Math.PI / 2,
      shirtColor: 0xd97706,
      pantsColor: 0x1e3a8a,
      hairColor: 0x78350f,
      dialogues: [
        '10 von 10 Treffern! Gegen die Straßengangs hilft nur Präzision.',
        'Ammu-Nation hat die besten Zielfernrohre der Stadt.',
      ],
    });

    this.interactables.set('gun_store', [
      {
        id: 'gun_counter',
        name: 'Waffen-Verkaufstheke',
        prompt: 'Drücke [E] um Munition aufzufüllen & Waffen zu kaufen (500$) 🔫',
        x: cx - 4,
        y: cy,
        z: cz - 6,
        radius: 3.0,
        onInteract: ({ economy, hud, sound }): void => {
          if (economy.cash >= 500) {
            economy.addCash(-500);
            economy.weapons.forEach((w) => {
              w.unlocked = true;
              w.ammo = w.maxAmmo;
            });
            sound.playGunshot();
            hud.showNotification(
              '🔫 AMMU-NATION: Alle Waffen freigeschaltet & Munition maximiert!',
            );
          } else {
            hud.showNotification('❌ Nicht genug Geld! 500$ erforderlich.');
          }
        },
      },
      {
        id: 'shooting_range',
        name: 'Schießstand',
        prompt: 'Drücke [E] für Schießtraining & Präzisions-Prämie (+$250) 🎯',
        x: cx,
        y: cy,
        z: cz + 6,
        radius: 3.5,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(250);
          sound.playGunshot();
          hud.showNotification(
            '🎯 SCHIESSTRAINING: Volltreffer ins Schwarze! +$250 Schießstand-Prämie!',
          );
        },
      },
      mac.interactable,
      rusty.interactable,
    ]);
  }

  private buildNightclub(): void {
    const cx = 4200;
    const cy = 100.0;
    const cz = 4000;
    const clubGroup = new THREE.Group();

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.3, 28),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2 }),
    );
    floor.position.set(cx, cy - 0.15, cz);

    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.3, 28),
      new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95 }),
    );
    ceiling.position.set(cx, cy + 5.5, cz);
    clubGroup.add(floor, ceiling);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(28, 5.5, 0.4), wallMat);
    wallN.position.set(cx, cy + 2.75, cz - 14);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(28, 5.5, 0.4), wallMat);
    wallS.position.set(cx, cy + 2.75, cz + 14);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.5, 28), wallMat);
    wallE.position.set(cx + 14, cy + 2.75, cz);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.5, 28), wallMat);
    wallW.position.set(cx - 14, cy + 2.75, cz);
    clubGroup.add(wallN, wallS, wallE, wallW);

    // Illuminated Dancefloor
    const tileSize = 2.4;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const tileMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(tileSize - 0.2, 0.1, tileSize - 0.2),
          tileMat,
        );
        tile.position.set(cx + dx * tileSize, cy + 0.05, cz + dz * tileSize);
        clubGroup.add(tile);
        this.danceFloorTiles.push(tile);
      }
    }

    // DJ Booth
    const djBooth = new THREE.Mesh(
      new THREE.BoxGeometry(6, 1.3, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9 }),
    );
    djBooth.position.set(cx, cy + 0.65, cz + 11);
    clubGroup.add(djBooth);

    const exitDoor = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xec4899 }),
    );
    exitDoor.position.set(cx, cy + 1.6, cz - 13.8);
    clubGroup.add(exitDoor);

    this.group.add(clubGroup);

    // Club Neon Dreams Residents: Jax, DJ Pulse, Nova, Rico
    const jax = this.createInteriorResident({
      id: 'club_jax',
      name: 'Jax',
      role: 'Chef-Barkeeper',
      icon: '🍹',
      archetypeId: 'nightclub',
      x: cx - 8,
      y: cy,
      z: cz - 4,
      rotationY: 0,
      shirtColor: 0x06b6d4,
      pantsColor: 0x0f172a,
      hairColor: 0x18181b,
      dialogues: [
        'Was darf es sein? Ein Neon Sunrise oder Liquid Cyber?',
        'Die Nacht ist jung und der Bass hämmert genau richtig!',
        'Hier, ein Spezial-Cocktail auf Kosten des Clubs! (+25 HP)',
      ],
      bonusAction: ({ player, sound }): void => {
        player.health = Math.min(100, player.health + 25);
        sound.playHoverEngage();
      },
    });

    const djPulse = this.createInteriorResident({
      id: 'club_dj_pulse',
      name: 'DJ Pulse',
      role: 'Headliner DJ',
      icon: '🎧',
      archetypeId: 'nightclub',
      x: cx,
      y: cy,
      z: cz + 12,
      rotationY: Math.PI,
      shirtColor: 0xa855f7,
      pantsColor: 0x18181b,
      hairColor: 0x00f0ff,
      dialogues: [
        'Drop the Bass! Neon Dreams tanzt bis zum Morgengrauen!',
        'Dieser Synthwave-Track bringt die Menge zum Kochen!',
      ],
    });

    const nova = this.createInteriorResident({
      id: 'club_nova',
      name: 'Nova',
      role: 'Cyber-Tänzerin',
      icon: '💃',
      archetypeId: 'nightclub',
      x: cx - 2,
      y: cy,
      z: cz + 1,
      rotationY: 0.3,
      shirtColor: 0xec4899,
      pantsColor: 0x8b5cf6,
      hairColor: 0x38bdf8,
      isDancing: true,
      dialogues: [
        'Der Rhythmus geht direkt ins Blut! Tanz mit uns!',
        'Bester Club der ganzen Metropole!',
      ],
    });

    const rico = this.createInteriorResident({
      id: 'club_rico',
      name: 'Rico',
      role: 'Clubber',
      icon: '🕺',
      archetypeId: 'nightclub',
      x: cx + 2,
      y: cy,
      z: cz + 2,
      rotationY: -0.4,
      shirtColor: 0xfacc15,
      pantsColor: 0x1e1b4b,
      hairColor: 0x1e1b18,
      isDancing: true,
      dialogues: [
        'Die Lichteffekte hier sind absolut irre!',
        'Yeah! GTA 7 Nightlife ist unschlagbar!',
      ],
    });

    this.interactables.set('nightclub', [
      {
        id: 'club_dj',
        name: 'DJ-Pult',
        prompt: 'Drücke [E] um den Synthwave-Beat zu droppen 🎧',
        x: cx,
        y: cy,
        z: cz + 10.5,
        radius: 2.8,
        onInteract: ({ hud, sound }): void => {
          sound.playCheckpointChime();
          hud.showNotification('🎵 BEAT-DROP: Neon Dreams vibriert im Cyber-Bass!');
        },
      },
      {
        id: 'club_dance',
        name: 'LED-Tanzfläche',
        prompt: 'Drücke [E] um auf der Tanzfläche zu tanzen 💃 (+150$ Style)',
        x: cx,
        y: cy,
        z: cz,
        radius: 3.5,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(150);
          sound.playFanfare();
          hud.showNotification('✨ Du rockst die Tanzfläche! +150$ Style-Bonus!');
        },
      },
      jax.interactable,
      djPulse.interactable,
      nova.interactable,
      rico.interactable,
    ]);
  }

  private buildHackerLoft(): void {
    const cx = 4300;
    const cy = 100.0;
    const cz = 4000;
    const { group, exitDoor } = this.createRoomShell(cx, cy, cz, 0x0f172a, 0x1e293b, 0x10b981);

    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.9, 3.5),
      new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8 }),
    );
    desk.position.set(cx, cy + 0.45, cz + 8);

    const monitorMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    for (let i = -2; i <= 2; i++) {
      const mon = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.1), monitorMat);
      mon.position.set(cx + i * 1.6, cy + 1.6, cz + 9.5);
      mon.rotation.y = -i * 0.15;
      group.add(mon);
    }

    exitDoor.material = new THREE.MeshStandardMaterial({ color: 0x10b981 });
    group.add(desk);
    this.group.add(group);

    // Hacker Loft Residents: ZeroCool & Boris
    const zeroCool = this.createInteriorResident({
      id: 'hacker_zerocool',
      name: 'ZeroCool',
      role: 'Meister-Netrunner',
      icon: '💻',
      archetypeId: 'hacker_loft',
      x: cx - 2,
      y: cy,
      z: cz + 6.8,
      rotationY: Math.PI,
      shirtColor: 0x10b981,
      pantsColor: 0x020617,
      hairColor: 0x00f0ff,
      isSitting: true,
      dialogues: [
        'Ich bin fast im Zentralrechner... ein Tastendruck und die Polizeiakten sind gelöscht.',
        'Informationen sind die wahre Währung dieser Stadt.',
        'Pass auf dich auf, die Syndikate scannen alle offenen Frequenzen.',
      ],
    });

    const boris = this.createInteriorResident({
      id: 'hacker_boris',
      name: 'Boris',
      role: 'Syndikat-Waffenschmied',
      icon: '🔧',
      archetypeId: 'hacker_loft',
      x: cx + 7,
      y: cy,
      z: cz - 4,
      rotationY: -Math.PI / 2,
      shirtColor: 0x334155,
      pantsColor: 0x1e293b,
      hairColor: 0x64748b,
      dialogues: [
        'Ich modifiziere die Raketenantriebe. Mehr Schub, weniger Rückstoß!',
        'Gute Waffen wollen gepflegt sein. Immer schön nachölen.',
      ],
    });

    this.interactables.set('hacker_loft', [
      {
        id: 'hacker_terminal',
        name: 'Cyberdeck Polizei-Hack',
        prompt: 'Drücke [E] um Polizeiakten zu hacken & Fahndung zu löschen 💻',
        x: cx,
        y: cy,
        z: cz + 8,
        radius: 3.0,
        onInteract: ({ police, hud, sound }): void => {
          police.setWantedLevel(0);
          sound.playCheckpointChime();
          hud.showNotification('💻 POLIZEI-DATABASE GEHACKT: 0 Fahndungssterne! Akte gelöscht!');
        },
      },
      {
        id: 'darknet_mining',
        name: 'Darknet Server-Farm',
        prompt: 'Drücke [E] um Krypto-Mining Ertrag abzuheben (+250$) 🪙',
        x: cx - 8,
        y: cy,
        z: cz,
        radius: 3.0,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(250);
          sound.playFanfare();
          hud.showNotification('🪙 KRYPTO-MINING ERFOLG: +250$ auf dein Wallet überwiesen!');
        },
      },
      zeroCool.interactable,
      boris.interactable,
    ]);
  }

  private buildCityBank(): void {
    const cx = 4400;
    const cy = 100.0;
    const cz = 4000;
    const { group, exitDoor } = this.createRoomShell(cx, cy, cz, 0x1e293b, 0x334155, 0x3b82f6);

    const vaultMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.95 });
    const vaultDoor = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.8, 24), vaultMat);
    vaultDoor.rotation.x = Math.PI / 2;
    vaultDoor.position.set(cx + 8, cy + 2.5, cz + 8);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.95,
      roughness: 0.2,
    });
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const goldBar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 1.4), goldMat);
        goldBar.position.set(cx + 7 + i * 1.0, cy + 0.3, cz + 7 + j * 1.6);
        group.add(goldBar);
      }
    }

    exitDoor.material = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
    group.add(vaultDoor);
    this.group.add(group);

    // City Bank Residents: Frau Sommer & Wachtmeister Braun
    const sommer = this.createInteriorResident({
      id: 'bank_sommer',
      name: 'Frau Sommer',
      role: 'Kundenberaterin',
      icon: '🏦',
      archetypeId: 'city_bank',
      x: cx,
      y: cy,
      z: cz - 4,
      rotationY: 0,
      shirtColor: 0x3b82f6,
      pantsColor: 0x1e293b,
      hairColor: 0xd97706,
      isSitting: true,
      dialogues: [
        'Guten Tag! Willkommen bei der Cyber City Bank. Ihr Vermögen ist bei uns versichert.',
        'Für Tresorkunden bieten wir modernste biometrische Schließfächer.',
      ],
    });

    const guard = this.createInteriorResident({
      id: 'bank_guard',
      name: 'Wachtmeister Braun',
      role: 'Sicherheitsbeamter',
      icon: '👮',
      archetypeId: 'city_bank',
      x: cx - 8,
      y: cy,
      z: cz + 6,
      rotationY: Math.PI / 4,
      shirtColor: 0x1e3a8a,
      pantsColor: 0x0f172a,
      hairColor: 0x475569,
      dialogues: [
        'Keine verdächtigen Bewegungen in der Schalterhalle!',
        'Der Tresorraum wird rund um die Uhr per Laser überwacht.',
      ],
    });

    this.interactables.set('city_bank', [
      {
        id: 'bank_gold',
        name: 'Goldtresor',
        prompt: 'Drücke [E] um Goldbarren aus dem Tresorraum zu plündern (+$3.000) 💰',
        x: cx + 8,
        y: cy,
        z: cz + 8,
        radius: 3.2,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(3000);
          sound.playCheckpointChime();
          hud.showNotification('💰 GOLDBARREN GEPLÜNDERT! +$3.000 fette Beute eingesackt!');
        },
      },
      sommer.interactable,
      guard.interactable,
    ]);
  }

  private buildCorpHQ(): void {
    const cx = 4500;
    const cy = 100.0;
    const cz = 4000;
    const { group, exitDoor } = this.createRoomShell(cx, cy, cz, 0x0f172a, 0x1e293b, 0x00f0ff);

    // Boardroom Table
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.2,
      metalness: 0.8,
    });
    const table = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.8, 16), tableMat);
    table.position.set(cx, cy + 0.4, cz + 4);

    // Spinning Holographic Globe
    const globeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 12), globeMat);
    globe.position.set(cx, cy + 2.4, cz + 4);

    exitDoor.material = new THREE.MeshStandardMaterial({ color: 0x00f0ff });
    group.add(table, globe);
    this.group.add(group);

    // OmniTech Corp Residents: Dr. Henderson & Sarah
    const henderson = this.createInteriorResident({
      id: 'corp_henderson',
      name: 'Dr. Henderson',
      role: 'OmniTech CEO',
      icon: '👔',
      archetypeId: 'corp_hq',
      x: cx,
      y: cy,
      z: cz + 4.2,
      rotationY: Math.PI,
      shirtColor: 0x0f172a,
      pantsColor: 0x1e293b,
      hairColor: 0xe2e8f0,
      dialogues: [
        'OmniTech treibt den Puls dieser Stadt an. Fusionstechnologie für jedermann!',
        'Hervorragende Zahlen im letzten Quartal! Nehmen Sie diesen Bonus von $200!',
        'Investieren Sie in die Zukunft von GTA 7!',
      ],
      bonusAction: ({ economy, sound }): void => {
        economy.addCash(200);
        sound.playFanfare();
      },
    });

    const sarah = this.createInteriorResident({
      id: 'corp_sarah',
      name: 'Sarah',
      role: 'Chefanalystin',
      icon: '📈',
      archetypeId: 'corp_hq',
      x: cx + 7,
      y: cy,
      z: cz - 4,
      rotationY: -Math.PI / 2,
      shirtColor: 0x0284c7,
      pantsColor: 0x0f172a,
      hairColor: 0x78350f,
      dialogues: [
        'Die Krypto-Indizes zeigen steil nach oben.',
        'Die Energieversorgung der City-Bezirke läuft stabil.',
      ],
    });

    this.interactables.set('corp_hq', [
      {
        id: 'corp_trading',
        name: 'Trading Terminal',
        prompt: 'Drücke [E] um Börsen-Dividende abzuheben (+350$) 📈',
        x: cx,
        y: cy,
        z: cz + 4,
        radius: 3.0,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(350);
          sound.playFanfare();
          hud.showNotification('📈 TRADING-DIVIDENDE: +350$ Gewinnausschüttung der Konzerne!');
        },
      },
      {
        id: 'corp_espresso',
        name: 'Chef-Espressobar',
        prompt: 'Drücke [E] um starken Espresso zu trinken (+25 HP) ☕',
        x: cx - 8,
        y: cy,
        z: cz - 4,
        radius: 2.5,
        onInteract: ({ player, hud, sound }): void => {
          player.health = Math.min(100, player.health + 25);
          sound.playHoverEngage();
          hud.showNotification('☕ EXEKUTIV-ESPRESSO: Wach & voller Energie (+25 HP)!');
        },
      },
      henderson.interactable,
      sarah.interactable,
    ]);
  }

  private buildNeonArcade(): void {
    const cx = 4600;
    const cy = 100.0;
    const cz = 4000;
    const { group, exitDoor } = this.createRoomShell(cx, cy, cz, 0x18181b, 0x09090b, 0xfacc15);

    // 4 Retro Arcade Cabinets
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.6 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    for (let i = -2; i <= 1; i++) {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 1.4), cabMat);
      cab.position.set(cx + i * 3.0 + 1.5, cy + 1.6, cz + 8);
      const scr = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.1), screenMat);
      scr.position.set(cx + i * 3.0 + 1.5, cy + 2.0, cz + 7.25);
      group.add(cab, scr);
    }

    exitDoor.material = new THREE.MeshStandardMaterial({ color: 0xfacc15 });
    this.group.add(group);

    // Neon Arcade Residents: Timmy & Opa Frank
    const timmy = this.createInteriorResident({
      id: 'arcade_timmy',
      name: 'Timmy',
      role: 'Arcade-Champion',
      icon: '🕹️',
      archetypeId: 'neon_arcade',
      x: cx - 6,
      y: cy,
      z: cz + 2,
      rotationY: Math.PI / 2,
      shirtColor: 0xef4444,
      pantsColor: 0x1e3a8a,
      hairColor: 0xd97706,
      dialogues: [
        'Nur noch 100 Punkte bis zum ewigen Highscore bei Galaxy Defender!',
        'Der Trick am Flipper: Niemals beide Tasten gleichzeitig drücken!',
      ],
    });

    const opaFrank = this.createInteriorResident({
      id: 'arcade_frank',
      name: 'Opa Frank',
      role: 'Arcade-Betreiber',
      icon: '🎰',
      archetypeId: 'neon_arcade',
      x: cx + 7,
      y: cy,
      z: cz - 4,
      rotationY: -Math.PI / 2,
      shirtColor: 0x059669,
      pantsColor: 0x334155,
      hairColor: 0x94a3b8,
      dialogues: [
        'Früher hatten wir nur Pixelgrafik, aber der Spielspaß war gigantisch!',
        'Viel Glück am Flipper und den Retro-Automaten, mein Junge!',
      ],
    });

    this.interactables.set('neon_arcade', [
      {
        id: 'arcade_play',
        name: 'Arcade-Automat',
        prompt: 'Drücke [E] um Retro-Klassiker zu spielen & Highscore zu knacken (+250$) 🕹️',
        x: cx,
        y: cy,
        z: cz + 7.5,
        radius: 3.5,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(250);
          sound.playFanfare();
          hud.showNotification('🕹️ HIGHSCORE GEKNACKT! Retro-Gaming Prämie: +250$!');
        },
      },
      {
        id: 'arcade_wheel',
        name: 'Glücksrad',
        prompt: 'Drücke [E] um am Cyber-Glücksrad zu drehen (+500$) 🎡',
        x: cx - 8,
        y: cy,
        z: cz - 2,
        radius: 3.0,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(500);
          sound.playCheckpointChime();
          hud.showNotification('🎡 GLÜCKSRAD: JACKPOT! +500$ Gewinn ausgezahlt!');
        },
      },
      timmy.interactable,
      opaFrank.interactable,
    ]);
  }

  private buildCyberLoft(): void {
    const cx = 4700;
    const cy = 100.0;
    const cz = 4000;
    const { group } = this.createRoomShell(cx, cy, cz, 0x1e1b4b, 0x312e81, 0x8b5cf6);

    const couch = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.8, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x4338ca }),
    );
    couch.position.set(cx, cy + 0.4, cz + 4);

    const tv = new THREE.Mesh(
      new THREE.BoxGeometry(6, 3.2, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4 }),
    );
    tv.position.set(cx, cy + 2.5, cz + 13.5);

    group.add(couch, tv);
    this.group.add(group);

    // Residential House / Cyber Loft Residents: Mia & Leon
    const mia = this.createInteriorResident({
      id: 'loft_mia',
      name: 'Mia',
      role: 'Mieterin & Cyber-Designerin',
      icon: '🛋️',
      archetypeId: 'cyber_loft',
      x: cx,
      y: cy,
      z: cz + 3.8,
      rotationY: Math.PI,
      shirtColor: 0xec4899,
      pantsColor: 0x1e293b,
      hairColor: 0x06b6d4,
      isSitting: true,
      dialogues: [
        'Hey Nachbar! Schön, dass du mal hallo sagst in unserer Wohnung!',
        'Die Miete in diesem Wohnblock ist hoch, aber der Ausblick vom Sofa ist unbezahlbar.',
        'Ich habe gerade frische Kekse gebacken – nimm dir ruhig einen! (+25 HP)',
      ],
      bonusAction: ({ player, sound }): void => {
        player.health = Math.min(100, player.health + 25);
        sound.playHoverEngage();
      },
    });

    const leon = this.createInteriorResident({
      id: 'loft_leon',
      name: 'Leon',
      role: 'Mitbewohner & Krypto-Trader',
      icon: '💻',
      archetypeId: 'cyber_loft',
      x: cx + 7,
      y: cy,
      z: cz + 6,
      rotationY: -Math.PI / 2,
      shirtColor: 0x10b981,
      pantsColor: 0x0f172a,
      hairColor: 0x78350f,
      isSitting: true,
      dialogues: [
        'Hi! Ich teile mir die Wohnung mit Mia. Zusammen wohnen spart eine Menge Cash!',
        'Mein Mining-Rig im Zimmer läuft Tag und Nacht.',
        'Hier, ein kleiner Krypto-Zuschuss für deine Miete: +$100!',
      ],
      bonusAction: ({ economy, sound }): void => {
        economy.addCash(100);
        sound.playFanfare();
      },
    });

    this.interactables.set('cyber_loft', [
      {
        id: 'loft_fridge',
        name: 'Kühlschrank',
        prompt: 'Drücke [E] um Pizza & Energy-Drink zu nehmen (+35 HP) 🍕',
        x: cx - 8,
        y: cy,
        z: cz - 6,
        radius: 2.8,
        onInteract: ({ player, hud, sound }): void => {
          player.health = Math.min(100, player.health + 35);
          sound.playHoverEngage();
          hud.showNotification('🍕 KÜHLSCHRANK: Cyber-Pizza gegessen (+35 HP)!');
        },
      },
      {
        id: 'loft_mining',
        name: 'Gaming Battle-Station',
        prompt: 'Drücke [E] um Krypto-Mining Ertrag abzuholen (+200$) 💻',
        x: cx + 8,
        y: cy,
        z: cz + 6,
        radius: 2.8,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(200);
          sound.playFanfare();
          hud.showNotification('💻 MINING RIG: +200$ Ertrag abgeholt!');
        },
      },
      mia.interactable,
      leon.interactable,
    ]);
  }

  private buildMartialDojo(): void {
    const cx = 4800;
    const cy = 100.0;
    const cz = 4000;
    const { group } = this.createRoomShell(cx, cy, cz, 0x451a03, 0x78350f, 0x10b981);

    // Punching Bags
    const bagMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
    for (let i = -1; i <= 1; i++) {
      const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.4, 12), bagMat);
      bag.position.set(cx + i * 4, cy + 2.2, cz + 6);
      group.add(bag);
    }

    // Meditation Brass Gong
    const gong = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.2, 24),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9 }),
    );
    gong.rotation.x = Math.PI / 2;
    gong.position.set(cx, cy + 2.5, cz - 10);
    group.add(gong);

    this.group.add(group);

    // Martial Dojo Residents: Master Kenji & Yuki
    const masterKenji = this.createInteriorResident({
      id: 'dojo_kenji',
      name: 'Master Kenji',
      role: 'Großmeister & Sensei',
      icon: '🥋',
      archetypeId: 'martial_dojo',
      x: cx,
      y: cy,
      z: cz - 6,
      rotationY: 0,
      shirtColor: 0xf8fafc,
      pantsColor: 0xf8fafc,
      hairColor: 0x94a3b8,
      isSitting: true,
      dialogues: [
        'Atme ein, finde die Stille in dir. Die größte Stärke liegt in der Selbstbeherrschung.',
        'Ein Krieger kämpft nicht aus Zorn, sondern aus Verantwortung.',
        'Deine Lebensenergie wurde harmonisiert! (+30 HP)',
      ],
      bonusAction: ({ player, sound }): void => {
        player.health = Math.min(100, player.health + 30);
        sound.playHoverEngage();
      },
    });

    const yuki = this.createInteriorResident({
      id: 'dojo_yuki',
      name: 'Yuki',
      role: 'Schwarzgurt-Schülerin',
      icon: '🥊',
      archetypeId: 'martial_dojo',
      x: cx - 6,
      y: cy,
      z: cz + 6,
      rotationY: 0,
      shirtColor: 0xf8fafc,
      pantsColor: 0x1e1b18,
      hairColor: 0x18181b,
      dialogues: [
        'Kiai! Tägliches Training schärft Reflexe und Geist.',
        'Sensei Kenjis Lehren haben mir geholfen, jede Herausforderung zu meistern.',
      ],
    });

    this.interactables.set('martial_dojo', [
      {
        id: 'dojo_workout',
        name: 'Boxsack',
        prompt: 'Drücke [E] um am Boxsack zu trainieren (Kampfkraft & Workout) 🥊',
        x: cx,
        y: cy,
        z: cz + 6,
        radius: 3.0,
        onInteract: ({ hud, sound }): void => {
          sound.playCrash(12);
          hud.showNotification('🥊 WORKOUT: Schläge & Tritte trainiert! Nahkampf gestärkt!');
        },
      },
      {
        id: 'dojo_gong',
        name: 'Meditations-Gong',
        prompt: 'Drücke [E] um den Zen-Gong zu schlagen (+40 HP) 🔔',
        x: cx,
        y: cy,
        z: cz - 10,
        radius: 3.0,
        onInteract: ({ player, hud, sound }): void => {
          player.health = Math.min(100, player.health + 40);
          sound.playCheckpointChime();
          hud.showNotification('🔔 ZEN-GONG: Tiefe Meditation! Geist & Körper geheilt (+40 HP)!');
        },
      },
      masterKenji.interactable,
      yuki.interactable,
    ]);
  }

  private buildTunerGarage(): void {
    const cx = 4900;
    const cy = 100.0;
    const cz = 4000;
    const { group } = this.createRoomShell(cx, cy, cz, 0x1e293b, 0x334155, 0xef4444);

    // Car Lift Hydraulic Posts
    const postMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8 });
    const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.2, 8), postMat);
    post1.position.set(cx - 3, cy + 2.1, cz + 2);
    const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.2, 8), postMat);
    post2.position.set(cx + 3, cy + 2.1, cz + 2);
    group.add(post1, post2);

    this.group.add(group);

    // Tuner Garage Residents: Torsten & Sami
    const torsten = this.createInteriorResident({
      id: 'garage_torsten',
      name: 'Torsten',
      role: 'Chefmechaniker',
      icon: '🔧',
      archetypeId: 'tuner_garage',
      x: cx - 4,
      y: cy,
      z: cz + 2,
      rotationY: Math.PI / 2,
      shirtColor: 0xd97706,
      pantsColor: 0x1e293b,
      hairColor: 0x78350f,
      dialogues: [
        'Ein sauber abgestimmter Motor klingt besser als jede Symphonie!',
        'Wenn deine Bremsen quietschen, bist du hier genau an der richtigen Adresse.',
      ],
    });

    const sami = this.createInteriorResident({
      id: 'garage_sami',
      name: 'Sami',
      role: 'Nitro-Spezialistin',
      icon: '⚡',
      archetypeId: 'tuner_garage',
      x: cx + 7,
      y: cy,
      z: cz - 4,
      rotationY: -Math.PI / 2,
      shirtColor: 0x0284c7,
      pantsColor: 0x0f172a,
      hairColor: 0xec4899,
      dialogues: [
        'Nitro-Einspritzungen sind meine Leidenschaft. Schneller beschleunigt niemand in GTA 7!',
        'Halt dein Auto immer gut in Schuss, dann lässt du jeden Cop stehen.',
      ],
    });

    this.interactables.set('tuner_garage', [
      {
        id: 'tuner_nitro',
        name: 'Nitro-Station',
        prompt: 'Drücke [E] um Werkstatt-Panzerung & Reparaturset zu holen 🔧',
        x: cx,
        y: cy,
        z: cz + 2,
        radius: 3.5,
        onInteract: ({ player, hud, sound }): void => {
          player.health = 100;
          sound.playHoverEngage();
          hud.showNotification(
            '🔧 WERKSTATT: DeLorean-Reparaturset & volle Regeneration (100 HP)!',
          );
        },
      },
      torsten.interactable,
      sami.interactable,
    ]);
  }

  private buildNoodleBar(): void {
    const cx = 5000;
    const cy = 100.0;
    const cz = 4000;
    const { group } = this.createRoomShell(cx, cy, cz, 0x451a03, 0x292524, 0xf43f5e);

    // Noodle Counter
    const barMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(10, 1.1, 2.0), barMat);
    counter.position.set(cx, cy + 0.55, cz + 4);
    group.add(counter);

    this.group.add(group);

    // Noodle Bar Residents: Chef Toshi & Marco
    const toshi = this.createInteriorResident({
      id: 'noodle_toshi',
      name: 'Chef Toshi',
      role: 'Ramen-Meister',
      icon: '🍜',
      archetypeId: 'noodle_bar',
      x: cx,
      y: cy,
      z: cz + 2.5,
      rotationY: Math.PI,
      shirtColor: 0xf8fafc,
      pantsColor: 0x1e293b,
      hairColor: 0x18181b,
      dialogues: [
        'Irasshaimase! Willkommen! Heiße Ramen-Suppe stärkt müde Krieger!',
        'Hier, eine frische Schüssel Spezial-Miso-Ramen für dich! (+35 HP)',
        'Wer fleißig isst, hat genug Kraft für die Straße!',
      ],
      bonusAction: ({ player, sound }): void => {
        player.health = Math.min(100, player.health + 35);
        sound.playHoverEngage();
      },
    });

    const marco = this.createInteriorResident({
      id: 'noodle_marco',
      name: 'Marco',
      role: 'Stammgast',
      icon: '🥢',
      archetypeId: 'noodle_bar',
      x: cx + 3,
      y: cy,
      z: cz + 5.5,
      rotationY: 0,
      shirtColor: 0x3b82f6,
      pantsColor: 0x1e3a8a,
      hairColor: 0x94a3b8,
      isSitting: true,
      dialogues: [
        'Die Brühe hier ist die beste in der ganzen Stadt. Ich esse fast jeden Abend bei Toshi!',
        'Schlürfen gehört beim Ramen-Essen einfach zum guten Ton.',
      ],
    });

    this.interactables.set('noodle_bar', [
      {
        id: 'noodle_ramen',
        name: 'Ramen-Küche',
        prompt: 'Drücke [E] um frische Tonkotsu-Ramen zu essen (+45 HP) 🍜',
        x: cx,
        y: cy,
        z: cz + 4,
        radius: 3.0,
        onInteract: ({ player, hud, sound }): void => {
          player.health = Math.min(100, player.health + 45);
          sound.playHoverEngage();
          hud.showNotification('🍜 RAMEN: Dampfende Tonkotsu-Ramen genossen (+45 HP)!');
        },
      },
      {
        id: 'noodle_cat',
        name: 'Glückskatze',
        prompt: 'Drücke [E] um Maneki-Neko zu streicheln (+333$ Glück) 🐱',
        x: cx + 4,
        y: cy,
        z: cz + 4,
        radius: 2.5,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(333);
          sound.playFanfare();
          hud.showNotification('🐱 MANEKI-NEKO: Miau! +333$ Glücksgeld eingesackt!');
        },
      },
      toshi.interactable,
      marco.interactable,
    ]);
  }

  private buildRipperdoc(): void {
    const cx = 5100;
    const cy = 100.0;
    const cz = 4000;
    const { group } = this.createRoomShell(cx, cy, cz, 0xf8fafc, 0xe2e8f0, 0x06b6d4);

    // Surgical Bed
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7 });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 6.0), bedMat);
    bed.position.set(cx, cy + 0.45, cz + 4);
    group.add(bed);

    this.group.add(group);

    // Ripperdoc Residents: Dr. Watson & Zack
    const watson = this.createInteriorResident({
      id: 'ripper_watson',
      name: 'Dr. Watson',
      role: 'Ripperdoc & Neurochirurg',
      icon: '💉',
      archetypeId: 'ripperdoc',
      x: cx - 3.5,
      y: cy,
      z: cz + 2,
      rotationY: Math.PI / 2,
      shirtColor: 0x06b6d4,
      pantsColor: 0x1e293b,
      hairColor: 0x64748b,
      dialogues: [
        'Deine biologischen Messwerte sind stabil. Keine Anzeichen von Cyberpsychose.',
        'Hier, eine Dosis Bio-Stimulans zur Zellerneuerung! (+40 HP)',
        'Immer schön deine Implantat-Firmware updaten!',
      ],
      bonusAction: ({ player, sound }): void => {
        player.health = Math.min(100, player.health + 40);
        sound.playHoverEngage();
      },
    });

    const zack = this.createInteriorResident({
      id: 'ripper_zack',
      name: 'Zack',
      role: 'Patient mit Titan-Arm',
      icon: '🦾',
      archetypeId: 'ripperdoc',
      x: cx + 5,
      y: cy,
      z: cz + 2,
      rotationY: -Math.PI / 2,
      shirtColor: 0x475569,
      pantsColor: 0x0f172a,
      hairColor: 0xf59e0b,
      isSitting: true,
      dialogues: [
        'Doc Watson hat mir diesen Titan-Cyberarm eingebaut. Fühlt sich an wie neu!',
        'Gute Ripperdocs sind Gold wert in dieser rauen Stadt.',
      ],
    });

    this.interactables.set('ripperdoc', [
      {
        id: 'ripper_medbed',
        name: 'Bio-Regenerationsbett',
        prompt: 'Drücke [E] für Cyber-Chirurgie & Bio-Regeneration (100 HP) 💉',
        x: cx,
        y: cy,
        z: cz + 4,
        radius: 3.0,
        onInteract: ({ player, hud, sound }): void => {
          player.health = 100;
          sound.playCheckpointChime();
          hud.showNotification(
            '💉 RIPPERDOC: Alle Vitalfunktionen & Cyberware voll optimiert (100 HP)!',
          );
        },
      },
      watson.interactable,
      zack.interactable,
    ]);
  }

  private buildArtGallery(): void {
    const cx = 5200;
    const cy = 100.0;
    const cz = 4000;
    const { group } = this.createRoomShell(cx, cy, cz, 0x09090b, 0x18181b, 0xa855f7);

    // Neon Abstract Pedestals
    for (let i = -1; i <= 1; i++) {
      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xf1f5f9 }),
      );
      ped.position.set(cx + i * 5, cy + 0.7, cz + 4);

      const sculp = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.7),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0xec4899 : 0x00f0ff, wireframe: true }),
      );
      sculp.position.set(cx + i * 5, cy + 2.1, cz + 4);
      group.add(ped, sculp);
    }

    this.group.add(group);

    // Art Gallery Residents: Monsieur Laurent & Valerie
    const laurent = this.createInteriorResident({
      id: 'art_laurent',
      name: 'Monsieur Laurent',
      role: 'Galerie-Kurator',
      icon: '🎨',
      archetypeId: 'art_gallery',
      x: cx,
      y: cy,
      z: cz + 1.5,
      rotationY: 0,
      shirtColor: 0x7c3aed,
      pantsColor: 0x1e1b4b,
      hairColor: 0x94a3b8,
      dialogues: [
        'Betrachten Sie die Farbharmonie der Hologramme. Ein Meisterwerk digitaler Ästhetik!',
        'Kunst gibt unserem Leben Sinn, selbst inmitten von Wolkenkratzern und Turbomotoren.',
      ],
    });

    const valerie = this.createInteriorResident({
      id: 'art_valerie',
      name: 'Valerie',
      role: 'Kunstsammlerin',
      icon: '🖼️',
      archetypeId: 'art_gallery',
      x: cx - 6,
      y: cy,
      z: cz - 4,
      rotationY: Math.PI / 3,
      shirtColor: 0xf43f5e,
      pantsColor: 0x0f172a,
      hairColor: 0xfacc15,
      dialogues: [
        'Die Lichtbrechung dieser kybernetischen Skulptur fasziniert mich seit Stunden.',
        'Ich überlege, dieses Kunstwerk für mein Penthouse zu erwerben.',
      ],
    });

    this.interactables.set('art_gallery', [
      {
        id: 'art_tour',
        name: 'Audioguide',
        prompt: 'Drücke [E] um den Galerie-Audioguide anzuhören (+150$) 🎨',
        x: cx,
        y: cy,
        z: cz + 4,
        radius: 3.5,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(150);
          sound.playFanfare();
          hud.showNotification('🎨 KUNSTGALERIE: Geistig inspiriert! +150$ Bildungsprämie!');
        },
      },
      laurent.interactable,
      valerie.interactable,
    ]);
  }

  private buildLighthouseCabin(): void {
    const cx = 5300;
    const cy = 100.0;
    const cz = 4000;
    const { group } = this.createRoomShell(cx, cy, cz, 0x451a03, 0x292524, 0xf59e0b);

    // Stone Fireplace
    const fireplace = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 3.2, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 }),
    );
    fireplace.position.set(cx, cy + 1.6, cz + 12);

    const fireLight = new THREE.PointLight(0xf97316, 4.0, 15);
    fireLight.position.set(cx, cy + 1.2, cz + 11.2);
    group.add(fireplace, fireLight);

    this.group.add(group);

    // Lighthouse Resident: Kapitän Blaubart Hansen
    const blaubart = this.createInteriorResident({
      id: 'cabin_blaubart',
      name: 'Kapitän Blaubart',
      role: 'Leuchtturmwärter & Seebär',
      icon: '⚓',
      archetypeId: 'lighthouse_cabin',
      x: cx + 4,
      y: cy,
      z: cz + 7,
      rotationY: -Math.PI / 3,
      shirtColor: 0x1e3a8a,
      pantsColor: 0x1e293b,
      hairColor: 0xe2e8f0,
      isSitting: true,
      dialogues: [
        'Ahoi, mein Junge! Setz dich an den warmen Kamin.',
        'Das Meer da draußen ist wild und tief. Dieses Leuchtfeuer hat schon manchem Schiff das Leben gerettet.',
        'Hier, ein Schluck heißer Seemannstee gegen die Kälte! (+30 HP)',
      ],
      bonusAction: ({ player, sound }): void => {
        player.health = Math.min(100, player.health + 30);
        sound.playHoverEngage();
      },
    });

    this.interactables.set('lighthouse_cabin', [
      {
        id: 'cabin_fire',
        name: 'Kaminfeuer',
        prompt: 'Drücke [E] um dich am Kamin aufzuwärmen (+40 HP) 🔥',
        x: cx,
        y: cy,
        z: cz + 11,
        radius: 3.0,
        onInteract: ({ player, hud, sound }): void => {
          player.health = Math.min(100, player.health + 40);
          sound.playHoverEngage();
          hud.showNotification('🔥 KAMIN: Am warmen Kaminfeuer ausgeruht (+40 HP)!');
        },
      },
      {
        id: 'cabin_log',
        name: 'Kapitäns-Logbuch',
        prompt: 'Drücke [E] um altes Logbuch zu lesen (+200$ Schatz) 📜',
        x: cx - 6,
        y: cy,
        z: cz + 4,
        radius: 2.8,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(200);
          sound.playFanfare();
          hud.showNotification('📜 LOGBUCH: Alte Seekarte entdeckt! +200$ Strandgut-Fund!');
        },
      },
      blaubart.interactable,
    ]);
  }

  private buildAirportLounge(): void {
    const cx = 5400;
    const cy = 100.0;
    const cz = 4000;
    const { group } = this.createRoomShell(cx, cy, cz, 0x1e3a8a, 0x1e293b, 0x38bdf8);

    // Flight Departures Board
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(10, 2.8, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    );
    board.position.set(cx, cy + 3.0, cz + 13.5);
    group.add(board);

    this.group.add(group);

    // Airport Residents: Kapitän Schneider & Baroness von Stein
    const schneider = this.createInteriorResident({
      id: 'air_schneider',
      name: 'Kapitän Schneider',
      role: 'Flugkapitän',
      icon: '✈️',
      archetypeId: 'airport_lounge',
      x: cx - 4,
      y: cy,
      z: cz + 2,
      rotationY: Math.PI / 2,
      shirtColor: 0xf8fafc,
      pantsColor: 0x0f172a,
      hairColor: 0x475569,
      dialogues: [
        'Flug GTA-707 nach Vice City ist bereit zum Boarding. Gute Reise!',
        'Die Wetterlage über der Bucht ist wolkenlos und stabil.',
      ],
    });

    const baroness = this.createInteriorResident({
      id: 'air_baroness',
      name: 'Baroness von Stein',
      role: 'First-Class Passagierin',
      icon: '🧳',
      archetypeId: 'airport_lounge',
      x: cx + 6,
      y: cy,
      z: cz + 4,
      rotationY: -Math.PI / 2,
      shirtColor: 0xca8a04,
      pantsColor: 0x1e293b,
      hairColor: 0xd97706,
      isSitting: true,
      dialogues: [
        'Ein Privatjet ist der einzig standesgemäße Weg zu reisen.',
        'Der Champagner in dieser Lounge ist exquisit.',
      ],
    });

    this.interactables.set('airport_lounge', [
      {
        id: 'airport_dutyfree',
        name: 'Duty-Free Kiosk',
        prompt: 'Drücke [E] für Duty-Free Snacks (+30 HP, +100$) 🍫',
        x: cx,
        y: cy,
        z: cz + 4,
        radius: 3.5,
        onInteract: ({ player, economy, hud, sound }): void => {
          player.health = Math.min(100, player.health + 30);
          economy.addCash(100);
          sound.playHoverEngage();
          hud.showNotification('🍫 DUTY-FREE: Snacks & Reisedividende (+30 HP & +100$)!');
        },
      },
      schneider.interactable,
      baroness.interactable,
    ]);
  }

  private buildStadiumLounge(): void {
    const cx = 5500;
    const cy = 100.0;
    const cz = 4000;
    const { group } = this.createRoomShell(cx, cy, cz, 0x0f172a, 0x1e293b, 0xf59e0b);

    // Trophy Cabinet
    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(8, 3.0, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xca8a04, metalness: 0.9 }),
    );
    cabinet.position.set(cx, cy + 1.5, cz + 13.0);
    group.add(cabinet);

    this.group.add(group);

    // Stadium Residents: Rick Rocket & Laura
    const rickRocket = this.createInteriorResident({
      id: 'stad_rick',
      name: 'Rick Rocket',
      role: 'Stunt-Kommentator',
      icon: '🎙️',
      archetypeId: 'stadium_lounge',
      x: cx,
      y: cy,
      z: cz + 6,
      rotationY: 0,
      shirtColor: 0xf59e0b,
      pantsColor: 0x1e1b18,
      hairColor: 0x18181b,
      dialogues: [
        'BOOOM! Die Menge tobt nach diesem 360-Grad Megasprung im Stadion!',
        'Als Stunt-Legende verdienst du Respekt! Hier ist dein Fan-Bonus: +$150!',
      ],
      bonusAction: ({ economy, sound }): void => {
        economy.addCash(150);
        sound.playFanfare();
      },
    });

    const laura = this.createInteriorResident({
      id: 'stad_laura',
      name: 'Laura',
      role: 'Stunt-Fan',
      icon: '📣',
      archetypeId: 'stadium_lounge',
      x: cx - 5,
      y: cy,
      z: cz + 6,
      rotationY: 0.2,
      shirtColor: 0x38bdf8,
      pantsColor: 0x1e3a8a,
      hairColor: 0xec4899,
      dialogues: [
        'Die Loopings und Feuerringe da unten sind der pure Adrenalinkick!',
        'Ich verpasse keinen einzigen Stunt-Wettbewerb in dieser Arena!',
      ],
    });

    this.interactables.set('stadium_lounge', [
      {
        id: 'stadium_trophy',
        name: 'Stunt-Trophäen',
        prompt: 'Drücke [E] um Stunt-Trophäen zu bewundern (+300$ Ruhm) 🏆',
        x: cx,
        y: cy,
        z: cz + 12,
        radius: 3.5,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(300);
          sound.playFanfare();
          hud.showNotification('🏆 STADION-VIP: Stunt-Legende! +300$ Ruhmes-Prämie!');
        },
      },
      rickRocket.interactable,
      laura.interactable,
    ]);
  }

  private buildPlayerHouse(): void {
    const cx = 5600;
    const cy = 100.0;
    const cz = 4000;
    const houseGroup = new THREE.Group();

    // 1. Luxury Architectural Room Shell (36m x 32m x 5.2m)
    // Black polished marble floor with gold metallic reflections
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(36, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.15, metalness: 0.75 }),
    );
    floor.position.set(cx, cy - 0.15, cz);

    // Modern acoustic coffered ceiling
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(36, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 }),
    );
    ceiling.position.set(cx, cy + 5.2, cz);
    houseGroup.add(floor, ceiling);

    // Luxury Slate and Walnut Acoustic Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(36, 5.2, 0.4), wallMat);
    wallN.position.set(cx, cy + 2.6, cz - 16);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(36, 5.2, 0.4), wallMat);
    wallS.position.set(cx, cy + 2.6, cz + 16);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 32), wallMat);
    wallE.position.set(cx + 18, cy + 2.6, cz);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 32), wallMat);
    wallW.position.set(cx - 18, cy + 2.6, cz);
    houseGroup.add(wallN, wallS, wallE, wallW);

    // Front Exit Door
    const exitDoor = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3.2, 0.2),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.4,
      }),
    );
    exitDoor.position.set(cx, cy + 1.6, cz - 15.8);
    houseGroup.add(exitDoor);

    // Central Warm Crystal Chandelier
    const chandelier = new THREE.PointLight(0xfef08a, 3.5, 32);
    chandelier.position.set(cx, cy + 4.8, cz);
    houseGroup.add(chandelier);

    // 2. Master Bedroom Suite (cx + 10, cz + 8)
    const bedFrame = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.7, 6.2),
      new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.5 }),
    );
    bedFrame.position.set(cx + 10, cy + 0.35, cz + 8);

    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.5, 5.8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
    );
    mattress.position.set(cx + 10, cy + 0.8, cz + 8);

    const headboard = new THREE.Mesh(
      new THREE.BoxGeometry(5.4, 2.6, 0.4),
      new THREE.MeshStandardMaterial({
        color: 0xca8a04,
        emissive: 0x78350f,
        emissiveIntensity: 0.3,
      }),
    );
    headboard.position.set(cx + 10, cy + 1.5, cz + 11.0);

    const pillowL = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.25, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc }),
    );
    pillowL.position.set(cx + 8.5, cy + 1.15, cz + 10.0);
    const pillowR = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.25, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc }),
    );
    pillowR.position.set(cx + 11.5, cy + 1.15, cz + 10.0);

    houseGroup.add(bedFrame, mattress, headboard, pillowL, pillowR);

    // 3. Walk-in Wardrobe & Dressing Mirror (cx + 12, cz - 6)
    const wardrobe = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 3.6, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }),
    );
    wardrobe.position.set(cx + 12, cy + 1.8, cz - 6);

    const mirror = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2.8, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.05, metalness: 0.95 }),
    );
    mirror.position.set(cx + 12, cy + 1.8, cz - 5.35);

    houseGroup.add(wardrobe, mirror);

    // 4. Personal Armory & Ammo Bench (cx + 10, cz + 1)
    const armoryRack = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 3.0, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.8 }),
    );
    armoryRack.position.set(cx + 10, cy + 1.5, cz + 1);

    const gunMat1 = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const gunMat2 = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const g1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 0.15), gunMat1);
    g1.position.set(cx + 9.2, cy + 1.8, cz + 1.45);
    const g2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 0.15), gunMat2);
    g2.position.set(cx + 10.8, cy + 1.8, cz + 1.45);
    houseGroup.add(armoryRack, g1, g2);

    // 5. Kitchen & Gourmet Minibar (cx - 10, cz - 6)
    const kitchenIsland = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 1.1, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.2 }),
    );
    kitchenIsland.position.set(cx - 10, cy + 0.55, cz - 6);

    const stool1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.75, 12),
      new THREE.MeshStandardMaterial({ color: 0xca8a04 }),
    );
    stool1.position.set(cx - 10, cy + 0.38, cz - 4.5);
    const stool2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.75, 12),
      new THREE.MeshStandardMaterial({ color: 0xca8a04 }),
    );
    stool2.position.set(cx - 8.5, cy + 0.38, cz - 4.5);

    const pizzaBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.1, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xd97706 }),
    );
    pizzaBox.position.set(cx - 10, cy + 1.15, cz - 6);

    houseGroup.add(kitchenIsland, stool1, stool2, pizzaBox);

    // 6. High-Security Crypto Vault & Mining Rack (cx - 12, cz + 8)
    const vaultDoor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 1.7, 0.35, 24),
      new THREE.MeshStandardMaterial({ color: 0xca8a04, metalness: 0.95, roughness: 0.2 }),
    );
    vaultDoor.rotation.x = Math.PI / 2;
    vaultDoor.position.set(cx - 12, cy + 1.7, cz + 8);

    const vaultServer = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3.6, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 }),
    );
    vaultServer.position.set(cx - 15, cy + 1.8, cz + 8);

    const miningLed = new THREE.PointLight(0x00f0ff, 2.0, 6);
    miningLed.position.set(cx - 14.5, cy + 2.5, cz + 8);

    houseGroup.add(vaultDoor, vaultServer, miningLed);

    // 7. Cyber-Dog Pet "Bolt" (cx, cz + 4)
    const dogBed = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.5, 0.22, 16),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 }),
    );
    dogBed.position.set(cx, cy + 0.11, cz + 4);

    const dogGroup = new THREE.Group();
    const dogMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.85,
      roughness: 0.25,
    });
    const dogEyeMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

    const dogTorso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.85), dogMat);
    dogTorso.position.y = 0.55;

    const dogHead = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.4), dogMat);
    dogHead.position.set(0, 0.85, 0.45);

    const dogVisor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.05), dogEyeMat);
    dogVisor.position.set(0, 0.88, 0.66);

    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), dogMat);
    earL.position.set(-0.12, 1.05, 0.45);
    const earR = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), dogMat);
    earR.position.set(0.12, 1.05, 0.45);

    const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    const legFL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), legMat);
    legFL.position.set(-0.2, 0.2, 0.3);
    const legFR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), legMat);
    legFR.position.set(0.2, 0.2, 0.3);
    const legBL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), legMat);
    legBL.position.set(-0.2, 0.2, -0.3);
    const legBR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), legMat);
    legBR.position.set(0.2, 0.2, -0.3);

    const tail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    );
    tail.rotation.x = Math.PI / 4;
    tail.position.set(0, 0.7, -0.5);

    dogGroup.add(dogTorso, dogHead, dogVisor, earL, earR, legFL, legFR, legBL, legBR, tail);
    dogGroup.position.set(cx, cy, cz + 4);

    houseGroup.add(dogBed, dogGroup);

    // 8. Home Theater & HiFi Radio (cx - 4, cz + 10)
    const tvScreen = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 2.6, 0.12),
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.35,
      }),
    );
    tvScreen.position.set(cx - 4, cy + 2.2, cz + 15.6);

    const sofa = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.6, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
    );
    sofa.position.set(cx - 4, cy + 0.3, cz + 11.5);

    houseGroup.add(tvScreen, sofa);

    // 9. Smart Home Upgrade Terminal (cx - 4, cz - 12)
    const terminalPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 }),
    );
    terminalPillar.position.set(cx - 4, cy + 0.6, cz - 12);

    const terminalHolo = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.6, 16),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide }),
    );
    terminalHolo.rotation.x = -Math.PI / 3;
    terminalHolo.position.set(cx - 4, cy + 1.3, cz - 12);

    houseGroup.add(terminalPillar, terminalHolo);

    this.group.add(houseGroup);

    // Villa Residents & Staff: Alfred the Butler, Dave (Buddy), and Elena (Security Chief)
    const alfred = this.createInteriorResident({
      id: 'house_alfred',
      name: 'Alfred',
      role: 'Persönlicher Butler & Concierge',
      icon: '🎩',
      archetypeId: 'player_house',
      x: cx - 6,
      y: cy,
      z: cz - 10,
      rotationY: 0,
      shirtColor: 0x0f172a,
      pantsColor: 0x020617,
      hairColor: 0x94a3b8,
      dialogues: [
        'Willkommen zu Hause, Sir! Alle Annehmlichkeiten des Anwesens stehen zu Ihrer Verfügung.',
        'Die Limousine in der Einfahrt wird automatisch gewartet und mit Nitro befüllt.',
        'Darf ich Ihnen ein Glas feinsten Champagners servieren? (+35 HP Vitalität)',
      ],
      bonusAction: ({ player, sound }): void => {
        player.health = Math.min(100, player.health + 35);
        sound.playHoverEngage();
      },
    });

    const dave = this.createInteriorResident({
      id: 'house_dave',
      name: 'Dave',
      role: 'Bester Kumpel & Co-Pilot',
      icon: '🎮',
      archetypeId: 'player_house',
      x: cx - 4,
      y: cy,
      z: cz + 11.2,
      rotationY: Math.PI,
      shirtColor: 0x0284c7,
      pantsColor: 0x1e293b,
      hairColor: 0xd97706,
      isSitting: true,
      dialogues: [
        'Bro! Deine Villa ist der pure Wahnsinn! Der Pool draußen ist der Hammer!',
        'Ich chille hier auf der Couch und schaue GTA 7 Action-TV mit bestem Dolby-Sound!',
        'Hier, nimm 100$ für deinen nächsten Drift durch die Stadt!',
      ],
      bonusAction: ({ economy, sound }): void => {
        economy.addCash(100);
        sound.playFanfare();
      },
    });

    const elena = this.createInteriorResident({
      id: 'house_elena',
      name: 'Elena',
      role: 'Sicherheitschefin der Villa',
      icon: '🛡️',
      archetypeId: 'player_house',
      x: cx + 7,
      y: cy,
      z: cz + 1,
      rotationY: -Math.PI / 2,
      shirtColor: 0x334155,
      pantsColor: 0x0f172a,
      hairColor: 0x1e1b4b,
      dialogues: [
        'Perimeter-Check: Laserzäune und Kameras laufen auf 100%. Die Villa ist absolut sicher.',
        'Bolt hat vorhin kurz gewedelt – der Hund liebt dich wirklich!',
        'Die Waffenkammer ist frisch aufmunitioniert, Boss.',
      ],
    });

    // Register All Interior Interactables for 'player_house' (stations + residents)
    this.interactables.set('player_house', [
      {
        id: 'house_bed',
        name: '👑 King-Size Luxusbett',
        prompt: 'Drücke [E] zum Schlafen & Erholen (100% HP & 0 Fahndungssterne) 🛏️',
        x: cx + 10,
        y: cy,
        z: cz + 8,
        radius: 3.2,
        onInteract: ({ player, police, hud, sound }): void => {
          player.health = 100;
          police.setWantedLevel(0);
          sound.playCheckpointChime();
          hud.showNotification(
            '🛏️ Ausgeruht! Gesundheit auf 100% wiederhergestellt & alle Fahndungssterne gelöscht!',
          );
        },
      },
      {
        id: 'house_wardrobe',
        name: '👔 Begehbarer Kleiderschrank & Cyber-Outfits',
        prompt: 'Drücke [E] um dein Outfit & Style zu wechseln 👔',
        x: cx + 12,
        y: cy,
        z: cz - 6,
        radius: 2.8,
        onInteract: ({ player, hud, sound }): void => {
          const outfits = [
            {
              name: 'Standard Cyber-Streetwear',
              torso: 0x1f2937,
              legs: 0x1e3a8a,
              desc: 'Klassische Lederjacke',
            },
            {
              name: 'Cyber-Ninja Stealth',
              torso: 0x111827,
              legs: 0x06b6d4,
              desc: 'Mattschwarzer Nanosuit',
            },
            {
              name: 'Vice Neon Deluxe',
              torso: 0xec4899,
              legs: 0x06b6d4,
              desc: 'Magenta Seidenhemd',
            },
            {
              name: 'Gold Syndikat Boss',
              torso: 0xf59e0b,
              legs: 0x0f172a,
              desc: 'Goldbrokat & Obsidian-Hose',
            },
            {
              name: 'Midnight Street Racer',
              torso: 0xdc2626,
              legs: 0x1e3a8a,
              desc: 'Rennsport-Leder',
            },
          ];
          this.houseOutfitIndex = ((this.houseOutfitIndex || 0) + 1) % outfits.length;
          const o = outfits[this.houseOutfitIndex];
          player.setOutfit(o.torso, o.legs);
          sound.playHoverEngage();
          hud.showNotification(`👔 Kleiderschrank: Outfit gewechselt zu "${o.name}"! (${o.desc})`);
        },
      },
      {
        id: 'house_armory',
        name: '🛡️ Private Waffenkammer & Ausrüstung',
        prompt: 'Drücke [E] für kostenlose Vollmunition & Maximale Panzerung 🛡️',
        x: cx + 10,
        y: cy,
        z: cz + 1,
        radius: 2.8,
        onInteract: ({ economy, player, hud, sound }): void => {
          economy.weapons.forEach((w) => {
            w.unlocked = true;
            w.ammo = w.maxAmmo;
          });
          player.health = 100;
          sound.playGunshot();
          hud.showNotification(
            '🛡️ Private Waffenkammer: Alle Waffen ausgerüstet, maximale Munition & volle Gesundheit!',
          );
        },
      },
      {
        id: 'house_kitchen',
        name: '🍕 Gourmet-Küche & Cyber-Energy Bar',
        prompt: 'Drücke [E] um frische Pizza & Cyber-Energy zu genießen (+40 HP) 🍕⚡',
        x: cx - 10,
        y: cy,
        z: cz - 6,
        radius: 2.8,
        onInteract: ({ player, hud, sound }): void => {
          player.health = Math.min(100, player.health + 40);
          sound.playHoverEngage();
          hud.showNotification(
            '🍕 Lecker! Frische Steinofenpizza & Cyber-Energy Drink (+40 HP Vitalität)!',
          );
        },
      },
      {
        id: 'house_vault',
        name: '💰 Villa-Tresor & Krypto-Mining Node',
        prompt: 'Drücke [E] um passives Einkommen aus dem Tresor abzuholen (+$1.500) 💰',
        x: cx - 12,
        y: cy,
        z: cz + 8,
        radius: 2.8,
        onInteract: ({ economy, hud, sound }): void => {
          economy.addCash(1500);
          sound.playFanfare();
          hud.showNotification(
            '💰 Tresor geöffnet! +$1.500 passives Einkommen aus deinem Krypto-Mining-Node eingesammelt!',
          );
        },
      },
      {
        id: 'house_pet',
        name: '🐕 Cyber-Hund "Bolt"',
        prompt: 'Drücke [E] um deinen Hund Bolt zu streicheln (+25% Speed Boost) 🐕✨',
        x: cx,
        y: cy,
        z: cz + 4,
        radius: 2.6,
        onInteract: ({ player, hud, sound }): void => {
          player.speedMultiplier = 1.25;
          sound.playBlowOffValve();
          hud.showNotification(
            '🐕 Bolt freut sich und bellt: "Wuff!" Er wedelt mit der Antenne (+25% Speed Boost)!',
          );
        },
      },
      {
        id: 'house_tv',
        name: '📺 85" Holographisches Heimkino & HiFi Radio',
        prompt: 'Drücke [E] um Fernseher & HiFi-Radio einzuschalten 📺🎶',
        x: cx - 4,
        y: cy,
        z: cz + 10,
        radius: 2.8,
        onInteract: ({ hud, sound }): void => {
          sound.playFanfare();
          hud.showNotification(
            '📺 85" OLED TV: GTA 7 Action-Kanal & Vice Radio laufen in bestem Dolby Atmos!',
          );
        },
      },
      {
        id: 'house_terminal',
        name: '🖥️ Smart-Home Steuerkonsole',
        prompt: 'Drücke [E] um den Status deines Hauses abzurufen 🖥️👑',
        x: cx - 4,
        y: cy,
        z: cz - 12,
        radius: 2.5,
        onInteract: ({ hud, sound }): void => {
          sound.playHoverEngage();
          hud.showNotification(
            '👑 Villa de GTA 7: Status PERFEKT | Schutzschilde AKTIV | Helipad BEREIT | Auto-Reparatur ONLINE!',
          );
        },
      },
      alfred.interactable,
      dave.interactable,
      elena.interactable,
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

    this.activeDoor = door;
    this.currentInteriorId = door.archetypeId || door.id;
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
    const door = this.activeDoor || this.doors.find((d) => d.id === this.currentInteriorId);
    if (!door) return false;

    const doorName = door.name;
    this.currentInteriorId = null;
    this.activeDoor = null;

    let exitX = door.exteriorX;
    let exitZ = door.exteriorZ + 2.0;

    const isShowcase =
      door.id === 'gun_store' ||
      door.id === 'penthouse' ||
      door.id === 'nightclub' ||
      door.id === 'hacker_loft' ||
      door.id === 'city_bank';

    if (!isShowcase) {
      if (Math.abs(door.exteriorHeading - Math.PI) < 0.1) {
        exitZ = door.exteriorZ - 2.0;
      } else if (Math.abs(door.exteriorHeading - Math.PI / 2) < 0.1) {
        exitX = door.exteriorX + 2.0;
        exitZ = door.exteriorZ;
      } else if (Math.abs(door.exteriorHeading - -Math.PI / 2) < 0.1) {
        exitX = door.exteriorX - 2.0;
        exitZ = door.exteriorZ;
      }
    }

    player.setPosition(exitX, 0.25, exitZ);
    player.rotationY = door.exteriorHeading;
    camera.reset(player.group.position, door.exteriorHeading);

    sound.playHoverEngage();
    hud.showNotification(`🚪 ${doorName} verlassen - zurück auf den Straßen von GTA 7!`);
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
      const activeArchetype = this.currentInteriorId;
      const room =
        this.activeDoor ||
        this.doors.find((d) => (d.archetypeId || d.id) === activeArchetype) ||
        this.doors[0];

      // 1. Enforce solid floor & room wall boundaries
      if (player.y < room.bounds.floorY) {
        player.y = room.bounds.floorY;
        player.vy = 0;
        player.setPosition(player.x, player.y, player.z);
      }
      player.x = Math.max(room.bounds.minX + 0.6, Math.min(room.bounds.maxX - 0.6, player.x));
      player.z = Math.max(room.bounds.minZ + 0.6, Math.min(room.bounds.maxZ - 0.6, player.z));
      player.setPosition(player.x, player.y, player.z);

      // Animate Interior Residents (Breathing, Dancing & facing player)
      for (const res of this.residents) {
        if (res.archetypeId === activeArchetype) {
          if (res.isDancing) {
            const bob = Math.sin(this.animTimer * 8 + res.x) * 0.06;
            res.group.position.y = res.y + bob;
            res.leftArm.rotation.x = Math.sin(this.animTimer * 6) * 0.6;
            res.rightArm.rotation.x = -Math.sin(this.animTimer * 6) * 0.6;
          } else {
            const breathe = Math.sin(this.animTimer * 2.5 + res.x) * 0.02;
            res.torsoMesh.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe * 0.5);
          }

          // Face player when close (if standing)
          const dx = player.x - res.x;
          const dz = player.z - res.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 4.5 && !res.isSitting) {
            const targetRot = Math.atan2(dx, dz);
            res.group.rotation.y = THREE.MathUtils.lerp(res.group.rotation.y, targetRot, 0.08);
          }
        }
      }

      // 2. Check Exit Door inside room (near interiorSpawn)
      const distToExit = Math.hypot(
        player.x - room.interiorSpawn.x,
        player.z - (room.interiorSpawn.z - 4.0),
      );
      const distToSpawn = Math.hypot(
        player.x - room.interiorSpawn.x,
        player.z - room.interiorSpawn.z,
      );

      if (distToExit < 3.2 || distToSpawn < 2.5) {
        const displayName = this.activeDoor ? this.activeDoor.name : room.name;
        hud.setPrompt(`Drücke [E] um ${displayName} zu verlassen 🚪`);
        if (input.actionInteract) {
          this.exitInterior(player, camera, hud, sound);
          return;
        }
      }

      // 3. Check Interactables inside this room
      const list = this.interactables.get(activeArchetype) || [];
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
      if (dist < 3.6) {
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
