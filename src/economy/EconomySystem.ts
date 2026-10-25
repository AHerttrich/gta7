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

export class EconomySystem {
  public cash: number = 500; // Starter cash
  public activeJob: ActiveJob | null = null;
  public cars: CarModelData[] = [...CAR_CATALOG];
  public weapons: WeaponData[] = [...WEAPON_CATALOG];
  public selectedCarId: string = 'starter_muscle';
  public selectedWeaponId: string = 'fists';

  constructor() {
    // Initial emit
    setTimeout(() => {
      eventBus.emit(EVENTS.MONEY_CHANGE, { cash: this.cash });
    }, 100);
  }

  public addCash(amount: number): void {
    this.cash += amount;
    eventBus.emit(EVENTS.MONEY_CHANGE, { cash: this.cash });
  }

  public spendCash(amount: number): boolean {
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

  public buyWeapon(weaponId: string): boolean {
    const weapon = this.weapons.find((w) => w.id === weaponId);
    if (!weapon || weapon.unlocked) return false;

    if (this.spendCash(weapon.price)) {
      weapon.unlocked = true;
      this.selectedWeaponId = weapon.id;
      eventBus.emit(EVENTS.NOTIFICATION, {
        text: `🔫 Waffe ausgerüstet: ${weapon.name}!`,
      });
      return true;
    }
    return false;
  }
}
