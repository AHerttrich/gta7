import * as THREE from 'three';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';
import { eventBus } from '../utils/EventBus';
import { EVENTS } from '../utils/Constants';

export interface SlotResult {
  reels: [string, string, string];
  payout: number;
  isJackpot: boolean;
  message: string;
}

export interface WheelPrize {
  label: string;
  cash: number;
  ammoBonus?: boolean;
}

export class CasinoSystem {
  public group: THREE.Group;
  public casinoX: number = -44;
  public casinoZ: number = -245;
  public hasSpunDailyWheel: boolean = false;

  private scene: THREE.Scene;
  private economy: EconomySystem;
  private sound: SoundManager;

  constructor(scene: THREE.Scene, economy: EconomySystem, sound: SoundManager) {
    this.scene = scene;
    this.economy = economy;
    this.sound = sound;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.buildCasinoBuilding();
  }

  private buildCasinoBuilding(): void {
    const x = this.casinoX;
    const z = this.casinoZ;

    // 1. Grand Neo-Classical Marble Facade
    const facadeGeo = new THREE.BoxGeometry(32, 16, 26);
    const facadeMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b, // Deep Imperial Indigo
      roughness: 0.2,
      metalness: 0.6,
    });
    const mainBuilding = new THREE.Mesh(facadeGeo, facadeMat);
    mainBuilding.position.set(x, 8, z);
    mainBuilding.castShadow = true;
    mainBuilding.receiveShadow = true;
    this.group.add(mainBuilding);

    // 2. Golden Corinthian Entrance Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.8, 0.9, 12, 16);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.95,
      roughness: 0.15,
    });

    for (let px = -12; px <= 12; px += 8) {
      const pillar = new THREE.Mesh(pillarGeo, goldMat);
      pillar.position.set(x + px, 6, z - 13.5);
      pillar.castShadow = true;
      this.group.add(pillar);
    }

    // 3. Portico Pediment Roof Triangle
    const roofGeo = new THREE.ConeGeometry(18, 4.5, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeo, goldMat);
    roof.position.set(x, 18, z - 13.5);
    this.group.add(roof);

    // 4. Ultra-Bright Neon Hologram Sign: DIAMOND CASINO
    const signGeo = new THREE.BoxGeometry(22, 2.2, 0.5);
    const signMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(x, 15, z - 13.2);
    this.group.add(sign);

    const casinoLight = new THREE.PointLight(0xfacc15, 5, 30);
    casinoLight.position.set(x, 7, z - 16);
    this.group.add(casinoLight);

    // 5. Luxury Fountain in Forecourt
    const poolGeo = new THREE.CylinderGeometry(4.5, 4.5, 0.8, 24);
    const poolMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3 });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.set(x, 0.4, z - 24);
    this.group.add(pool);

    const waterGeo = new THREE.CylinderGeometry(4.2, 4.2, 0.6, 24);
    const waterMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(x, 0.5, z - 24);
    this.group.add(water);
  }

  public spinSlots(bet: number): SlotResult {
    if (bet <= 0 || !this.economy.spendCash(bet)) {
      return {
        reels: ['❌', '❌', '❌'],
        payout: 0,
        isJackpot: false,
        message: 'Nicht genug Bargeld für diesen Einsatz!',
      };
    }

    const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
    const r1 = symbols[Math.floor(Math.random() * symbols.length)];
    const r2 = symbols[Math.floor(Math.random() * symbols.length)];
    const r3 = symbols[Math.floor(Math.random() * symbols.length)];

    let multiplier = 0;
    let isJackpot = false;

    if (r1 === '7️⃣' && r2 === '7️⃣' && r3 === '7️⃣') {
      multiplier = 250;
      isJackpot = true;
    } else if (r1 === '💎' && r2 === '💎' && r3 === '💎') {
      multiplier = 50;
    } else if (r1 === '🔔' && r2 === '🔔' && r3 === '🔔') {
      multiplier = 20;
    } else if (r1 === '🍒' && r2 === '🍒' && r3 === '🍒') {
      multiplier = 10;
    } else if (r1 === '🍋' && r2 === '🍋' && r3 === '🍋') {
      multiplier = 5;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      multiplier = 1.5;
    }

    const payout = Math.round(bet * multiplier);
    if (payout > 0) {
      this.economy.addCash(payout);
      this.sound.playFanfare();
    }

    const message = isJackpot
      ? `🎰 777 MEGA-JACKPOT! Gewinn: +$${payout}!`
      : payout > 0
        ? `🎉 GEWINN! [${r1} ${r2} ${r3}] Auszahlung: +$${payout}`
        : `Niete [${r1} ${r2} ${r3}] — Viel Glück beim nächsten Dreh!`;

    eventBus.emit(EVENTS.NOTIFICATION, { text: message });

    return {
      reels: [r1, r2, r3],
      payout,
      isJackpot,
      message,
    };
  }

  public spinLuckyWheel(): WheelPrize {
    if (this.hasSpunDailyWheel) {
      eventBus.emit(EVENTS.NOTIFICATION, {
        text: '🎡 Glücksrad bereits heute gedreht! Komm morgen wieder!',
      });
      return { label: 'Bereits heute gedreht', cash: 0 };
    }

    const prizes: WheelPrize[] = [
      { label: '💵 $1.000 Cash', cash: 1000 },
      { label: '💵 $2.500 Cash', cash: 2500 },
      { label: '🚀 Raketenwerfer Munition + $500', cash: 500, ammoBonus: true },
      { label: '💰 $10.000 Highroller-Prämie', cash: 10000 },
      { label: '🌟 $25.000 DIAMOND JACKPOT', cash: 25000 },
      { label: '💵 $5.000 Cash', cash: 5000 },
    ];

    const pick = prizes[Math.floor(Math.random() * prizes.length)];
    this.economy.addCash(pick.cash);
    if (pick.ammoBonus) {
      const rpg = this.economy.weapons.find((w) => w.id === 'rocket_launcher');
      if (rpg) {
        rpg.unlocked = true;
        rpg.ammo = Math.min(rpg.maxAmmo, rpg.ammo + 5);
        eventBus.emit(EVENTS.WEAPON_CHANGE, rpg);
      }
    }
    this.hasSpunDailyWheel = true;
    this.sound.playFanfare();

    eventBus.emit(EVENTS.NOTIFICATION, {
      text: `🎡 GLÜCKSRAD GEWINN: ${pick.label}!`,
    });

    return pick;
  }

  public isNearEntrance(playerX: number, playerZ: number): boolean {
    return Math.hypot(playerX - this.casinoX, playerZ - (this.casinoZ - 15)) < 8.0;
  }
}
