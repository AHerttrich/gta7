import { eventBus } from '../utils/EventBus';
import { EVENTS, CAR_CATALOG, WEAPON_CATALOG, CarModelData, WeaponData } from '../utils/Constants';

export interface ActiveJob {
  id: string;
  title: string;
  description: string;
  targetX: number;
  targetZ: number;
  timeRemaining: number;
  reward: number;
}

export interface TuningUpgrade {
  id: string;
  name: string;
  description: string;
  category: 'engine' | 'armor' | 'neon';
  price: number;
  stage?: number;
  color?: number;
  purchased: boolean;
}

export const TUNING_CATALOG: TuningUpgrade[] = [
  {
    id: 'engine_stage_1',
    name: '🏎️ Stage 1 Street Chip',
    description: '+25% Beschleunigung & 210 km/h Topspeed',
    category: 'engine',
    price: 1000,
    stage: 1,
    purchased: false,
  },
  {
    id: 'engine_stage_2',
    name: '🔥 Stage 2 Twin Turbo',
    description: '+50% Beschleunigung & 240 km/h Topspeed',
    category: 'engine',
    price: 2500,
    stage: 2,
    purchased: false,
  },
  {
    id: 'engine_stage_3',
    name: '⚡ Stage 3 Cyber Vortex',
    description: '+85% Beschleunigung & 280 km/h Topspeed',
    category: 'engine',
    price: 5000,
    stage: 3,
    purchased: false,
  },
  {
    id: 'armor_plating',
    name: '🛡️ Kevlar-Panzerung',
    description: 'Verringert Fahrzeugschaden um 50%',
    category: 'armor',
    price: 1500,
    purchased: false,
  },
  {
    id: 'neon_pink',
    name: '💖 Neon: Hot Pink',
    description: 'Leuchtendes Pink unter dem Chassis',
    category: 'neon',
    price: 400,
    color: 0xff007f,
    purchased: false,
  },
  {
    id: 'neon_lime',
    name: '💚 Neon: Toxic Lime',
    description: 'Giftgrüner Neon-Glow auf dem Asphalt',
    category: 'neon',
    price: 400,
    color: 0x39ff14,
    purchased: false,
  },
  {
    id: 'neon_gold',
    name: '💛 Neon: Solar Gold',
    description: 'Goldgelbes Glühen unter dem Wagen',
    category: 'neon',
    price: 400,
    color: 0xffaa00,
    purchased: false,
  },
  {
    id: 'neon_purple',
    name: '💜 Neon: Cyber Purple',
    description: 'Ultravioletter Leuchtscheinwerfer',
    category: 'neon',
    price: 400,
    color: 0x9d00ff,
    purchased: false,
  },
];

export class EconomySystem {
  public cash: number = 500; // Starter cash
  public activeJob: ActiveJob | null = null;
  public cars: CarModelData[] = CAR_CATALOG.map((c) => ({ ...c }));
  public weapons: WeaponData[] = WEAPON_CATALOG.map((w) => ({ ...w }));
  public tuningUpgrades: TuningUpgrade[] = TUNING_CATALOG.map((u) => ({ ...u }));
  public selectedCarId: string = 'starter_muscle';
  public selectedWeaponId: string = 'fists';

  constructor() {
    // Initial emit
    setTimeout(() => {
      eventBus.emit(EVENTS.MONEY_CHANGE, { cash: this.cash });
    }, 100);
  }

  public addCash(amount: number): void {
    if (Number.isNaN(amount)) return;
    this.cash += amount;
    eventBus.emit(EVENTS.MONEY_CHANGE, { cash: this.cash });
  }

  public spendCash(amount: number): boolean {
    if (Number.isNaN(amount) || amount < 0) return false;
    if (amount === 0) return true;
    if (this.cash >= amount) {
      this.cash -= amount;
      eventBus.emit(EVENTS.MONEY_CHANGE, { cash: this.cash });
      return true;
    }
    return false;
  }

  public startRandomJob(): ActiveJob {
    const jobTypes = [
      {
        title: '🚖 VIP-Taxi Express',
        description: 'Bringe den VIP-Passagier schnell zum Ziel!',
        reward: 350,
        time: 35,
      },
      {
        title: '📦 Eildelivery / Kurier',
        description: 'Liefere die heiße Fracht rechtzeitig ab!',
        reward: 500,
        time: 40,
      },
      {
        title: '🏁 Fluchtfahrer-Auftrag',
        description: 'Fahre mit Topspeed zum Übergabeort!',
        reward: 750,
        time: 30,
      },
    ];

    const pick = jobTypes[Math.floor(Math.random() * jobTypes.length)];
    // Pick random target in the city grid
    const targetX = (Math.random() - 0.5) * 200;
    const targetZ = (Math.random() - 0.5) * 200;

    this.activeJob = {
      id: String(Date.now()),
      title: pick.title,
      description: pick.description,
      targetX,
      targetZ,
      timeRemaining: pick.time,
      reward: pick.reward,
    };

    eventBus.emit(EVENTS.JOB_START, this.activeJob);
    eventBus.emit(EVENTS.NOTIFICATION, {
      text: `Neuer Job: ${pick.title}! Belohnung: $${pick.reward}`,
    });

    return this.activeJob;
  }

  public update(dt: number, playerX: number, playerZ: number): void {
    if (!this.activeJob) return;

    this.activeJob.timeRemaining -= dt;

    // Check if player reached target (radius < 8m)
    const dist = Math.hypot(playerX - this.activeJob.targetX, playerZ - this.activeJob.targetZ);

    if (dist < 8.0) {
      // Completed!
      const reward = this.activeJob.reward;
      this.addCash(reward);
      eventBus.emit(EVENTS.JOB_COMPLETE, { success: true, reward });
      eventBus.emit(EVENTS.NOTIFICATION, {
        text: `🎉 Job erledigt! Du hast $${reward} verdient!`,
      });
      this.activeJob = null;
    } else if (this.activeJob.timeRemaining <= 0) {
      // Failed!
      eventBus.emit(EVENTS.JOB_COMPLETE, { success: false, reward: 0 });
      eventBus.emit(EVENTS.NOTIFICATION, {
        text: '❌ Zeit abgelaufen! Job fehlgeschlagen.',
      });
      this.activeJob = null;
    }
  }

  public buyCar(carId: string): boolean {
    const car = this.cars.find((c) => c.id === carId);
    if (!car || car.unlocked) return false;

    if (this.spendCash(car.price)) {
      car.unlocked = true;
      this.selectedCarId = car.id;
      eventBus.emit(EVENTS.NOTIFICATION, {
        text: `🏎️ Neues Auto gekauft: ${car.name}!`,
      });
      return true;
    }
    return false;
  }

  public selectCar(carId: string): boolean {
    const car = this.cars.find((c) => c.id === carId);
    if (!car || !car.unlocked) return false;
    this.selectedCarId = car.id;
    eventBus.emit(EVENTS.NOTIFICATION, {
      text: `🏎️ Fahrzeug ausgewählt: ${car.name}!`,
    });
    return true;
  }

  public buyAmmo(weaponId: string, amount: number = 30, price: number = 200): boolean {
    const weapon = this.weapons.find((w) => w.id === weaponId);
    if (!weapon || !weapon.unlocked) return false;
    if (weapon.ammo === Infinity) return false;
    if (this.spendCash(price)) {
      weapon.ammo = Math.min(weapon.maxAmmo, weapon.ammo + amount);
      eventBus.emit(EVENTS.WEAPON_CHANGE, weapon);
      eventBus.emit(EVENTS.NOTIFICATION, {
        text: `🔫 Munition gekauft für ${weapon.name}! (+${amount})`,
      });
      return true;
    }
    return false;
  }

  public getSelectedWeapon(): WeaponData {
    return this.weapons.find((w) => w.id === this.selectedWeaponId) || this.weapons[0];
  }

  public equipWeapon(weaponId: string): boolean {
    const weapon = this.weapons.find((w) => w.id === weaponId);
    if (!weapon || !weapon.unlocked) return false;

    this.selectedWeaponId = weapon.id;
    eventBus.emit(EVENTS.WEAPON_CHANGE, weapon);
    eventBus.emit(EVENTS.NOTIFICATION, {
      text: `Waffe gewechselt: ${weapon.name}!`,
    });
    return true;
  }

  public buyWeapon(weaponId: string): boolean {
    const weapon = this.weapons.find((w) => w.id === weaponId);
    if (!weapon || weapon.unlocked) return false;

    if (this.spendCash(weapon.price)) {
      weapon.unlocked = true;
      this.equipWeapon(weapon.id);
      return true;
    }
    return false;
  }

  public buyTuning(tuningId: string): boolean {
    const item = this.tuningUpgrades.find((u) => u.id === tuningId);
    if (!item) return false;
    if (item.purchased) return true;

    if (this.spendCash(item.price)) {
      item.purchased = true;
      eventBus.emit(EVENTS.NOTIFICATION, {
        text: `🛠️ TUNING INSTALLIERT: ${item.name}!`,
      });
      return true;
    } else {
      eventBus.emit(EVENTS.NOTIFICATION, {
        text: `❌ Nicht genug Geld für ${item.name}! ($${item.price} benötigt)`,
      });
      return false;
    }
  }
}
