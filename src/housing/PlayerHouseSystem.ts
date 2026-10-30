import * as THREE from 'three';
import { Player } from '../character/Player';
import { Car } from '../vehicles/Car';
import { HUD } from '../ui/HUD';
import { SoundManager } from '../audio/SoundManager';
import { EconomySystem } from '../economy/EconomySystem';
import { GameCamera } from '../engine/Camera';

export interface OutfitDefinition {
  id: string;
  name: string;
  torso: number;
  legs: number;
  description: string;
}

export class PlayerHouseSystem {
  // World coordinates of Villa Estate on block [1, 1]
  public static readonly VILLA_POS = { x: -176, y: 0.2, z: -172 };
  public static readonly PARKING_POS = { x: -187, y: 0.2, z: -162 };
  public static readonly PARKING_RADIUS = 6.0;
  public static readonly INTERIOR_SPAWN = { x: 5600, y: 100.0, z: 3992, heading: 0 };

  public owned: boolean = true;
  public vaultBalance: number = 2500;
  public passiveIncomeAccumulator: number = 0;
  public petBuffTimer: number = 0;
  public currentOutfitIndex: number = 0;
  public gpsActive: boolean = false;
  private parkingRepairTimer: number = 0;

  public static readonly OUTFITS: OutfitDefinition[] = [
    {
      id: 'streetwear',
      name: 'Standard Cyber-Streetwear',
      torso: 0x1f2937,
      legs: 0x1e3a8a,
      description: 'Klassische Lederjacke & Denim-Jeans',
    },
    {
      id: 'cyber_ninja',
      name: 'Cyber-Ninja Stealth',
      torso: 0x111827,
      legs: 0x06b6d4,
      description: 'Mattschwarzer Nanosuit & Cyan-Akzente',
    },
    {
      id: 'vice_neon',
      name: 'Vice Neon Deluxe',
      torso: 0xec4899,
      legs: 0x06b6d4,
      description: 'Magenta Seidenhemd & Retro-Cyan',
    },
    {
      id: 'gold_syndicate',
      name: 'Gold Syndikat Boss',
      torso: 0xf59e0b,
      legs: 0x0f172a,
      description: 'Massiver Goldbrokat & Obsidian-Hose',
    },
    {
      id: 'midnight_racer',
      name: 'Midnight Street Racer',
      torso: 0xdc2626,
      legs: 0x1e3a8a,
      description: 'Rennsport-Leder in Karminrot',
    },
  ];

  public update(
    dt: number,
    player: Player,
    car: Car | null,
    mode: 'ON_FOOT' | 'IN_CAR' | 'IN_HELI' | 'IN_TANK' | 'IN_BOAT',
    hud: HUD,
    sound: SoundManager,
  ): void {
    // 1. Passive Crypto Mining Vault Income: +$1,500 every 60s
    this.passiveIncomeAccumulator += dt;
    if (this.passiveIncomeAccumulator >= 60.0) {
      this.passiveIncomeAccumulator = 0;
      this.vaultBalance = Math.min(100000, this.vaultBalance + 1500);
    }

    // 2. Pet Speed Buff Timer
    if (this.petBuffTimer > 0) {
      this.petBuffTimer -= dt;
      if (this.petBuffTimer <= 0) {
        this.petBuffTimer = 0;
        player.speedMultiplier = 1.0;
        hud.showNotification('🐕 Bolts Geschwindigkeits-Boost ist abgeklungen.');
      }
    }

    // 3. Driveway Parking Spot Auto-Repair & Nitro Recharge
    if (mode === 'IN_CAR' && car) {
      const dist = Math.hypot(
        car.physics.x - PlayerHouseSystem.PARKING_POS.x,
        car.physics.z - PlayerHouseSystem.PARKING_POS.z,
      );

      if (dist <= PlayerHouseSystem.PARKING_RADIUS) {
        const needsRepair = car.health < 100;
        const needsNitro = car.physics.nitro < 100;

        if (needsRepair || needsNitro) {
          this.parkingRepairTimer += dt;
          car.health = Math.min(100, car.health + 45 * dt);
          car.physics.nitro = Math.min(100, car.physics.nitro + 60 * dt);

          if (this.parkingRepairTimer >= 2.0) {
            this.parkingRepairTimer = 0;
            sound.playHoverEngage();
            hud.showNotification(
              '🅿️ Villa-Parkplatz: Fahrzeug repariert & Nitro voll geladen! 🔧⚡',
            );
          }
        }
      } else {
        this.parkingRepairTimer = 0;
      }
    }
  }

  /**
   * Cycle to next wardrobe outfit and apply colors to player model
   */
  public cycleOutfit(player: Player, hud: HUD, sound: SoundManager): OutfitDefinition {
    this.currentOutfitIndex = (this.currentOutfitIndex + 1) % PlayerHouseSystem.OUTFITS.length;
    const outfit = PlayerHouseSystem.OUTFITS[this.currentOutfitIndex];
    player.setOutfit(outfit.torso, outfit.legs);
    sound.playHoverEngage();
    hud.showNotification(`👔 Kleiderschrank: ${outfit.name} angezogen! (${outfit.description})`);
    return outfit;
  }

  /**
   * Plunder passive income from crypto vault
   */
  public claimVault(economy: EconomySystem, hud: HUD, sound: SoundManager): number {
    const amount = this.vaultBalance;
    if (amount <= 0) {
      hud.showNotification('🔒 Tresor ist leer. Das Mining-Node generiert neues Passiv-Einkommen!');
      return 0;
    }
    this.vaultBalance = 0;
    economy.addCash(amount);
    sound.playFanfare();
    hud.showNotification(
      `💰 Tresor geplündert! +$${amount.toLocaleString()} passives Einkommen erhalten!`,
    );
    return amount;
  }

  /**
   * Pet Bolt the Cyber-Dog for speed boost
   */
  public petBolt(player: Player, hud: HUD, sound: SoundManager): void {
    player.speedMultiplier = 1.25;
    this.petBuffTimer = 60; // 60s sprint buff
    sound.playBlowOffValve();
    hud.showNotification(
      '🐕 Du streichelst Bolt! Er wedelt mit der Antenne: "Wuff!" (+25% Sprint-Tempo für 60s)!',
    );
  }

  /**
   * Hotkey [H] handler: Sets GPS or fast travels to own mansion
   */
  public handleHomeKey(
    player: Player,
    car: Car | null,
    mode: 'ON_FOOT' | 'IN_CAR' | 'IN_HELI' | 'IN_TANK' | 'IN_BOAT',
    hud: HUD,
    sound: SoundManager,
    camera?: GameCamera,
  ): void {
    if (!this.gpsActive) {
      this.gpsActive = true;
      sound.playCheckpointChime();
      hud.showNotification(
        '👑 GPS Navigation zu deinem Haus aktiviert! Folge der goldenen Krone auf dem Radar. [H] erneut drücken für Schnellreise!',
      );
    } else {
      // Fast travel directly to villa estate
      this.gpsActive = false;
      if (mode === 'IN_CAR' && car) {
        car.physics.x = PlayerHouseSystem.PARKING_POS.x;
        car.physics.z = PlayerHouseSystem.PARKING_POS.z;
        car.physics.y = 0.5;
        car.physics.speed = 0;
        car.physics.heading = 0;
        car.group.position.set(car.physics.x, car.physics.y, car.physics.z);
        car.group.rotation.y = 0;
        hud.showNotification('🏠 Willkommen zu Hause! Wagen in deiner Villa-Einfahrt geparkt.');
      } else {
        player.setPosition(
          PlayerHouseSystem.VILLA_POS.x,
          0.25,
          PlayerHouseSystem.VILLA_POS.z + 2.0,
        );
        hud.showNotification('🏠 Willkommen zu Hause! Du stehst vor deiner Luxus-Villa.');
      }

      if (camera) {
        const targetX = mode === 'IN_CAR' && car ? car.physics.x : PlayerHouseSystem.VILLA_POS.x;
        const targetZ = mode === 'IN_CAR' && car ? car.physics.z : PlayerHouseSystem.VILLA_POS.z;
        camera.reset(new THREE.Vector3(targetX, 0.5, targetZ), 0);
      }

      sound.playCheckpointChime();
    }
  }
}
