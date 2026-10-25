import * as THREE from 'three';
import { Renderer } from './Renderer';
import { Input } from './Input';
import { GameCamera } from './Camera';
import { City } from '../city/City';
import { Garage } from '../city/Garage';
import { Car } from '../vehicles/Car';
import { Player } from '../character/Player';
import { PoliceSystem } from '../police/PoliceSystem';
import { TrafficSystem, TrafficCar } from '../traffic/TrafficSystem';
import { PedestrianSystem } from '../pedestrians/PedestrianSystem';
import { WeaponSystem } from '../combat/WeaponSystem';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';
import { HUD } from '../ui/HUD';
import { PLAYER_CONFIG } from '../utils/Constants';

export type PlayerMode = 'IN_CAR' | 'ON_FOOT';

export class Game {
  public renderer: Renderer;
  public input: Input;
  public camera: GameCamera;
  public city: City;
  public garage: Garage;
  public car: Car;
  public player: Player;
  public police: PoliceSystem;
  public traffic: TrafficSystem;
  public pedestrians: PedestrianSystem;
  public weapons: WeaponSystem;
  public economy: EconomySystem;
  public sound: SoundManager;
  public hud: HUD;

  public mode: PlayerMode = 'IN_CAR';

  private lastTime: number = 0;
  private isRunning: boolean = false;
  private weaponCooldown: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.input = new Input();
    this.camera = new GameCamera(this.renderer.camera);

    // City & Garage
    this.city = new City();
    this.renderer.scene.add(this.city.group);

    this.garage = new Garage();
    this.renderer.scene.add(this.garage.group);

    // Initial Car at road intersection
    this.car = new Car(44, 44, 0, 0xe62429);
    this.renderer.scene.add(this.car.group);

    // Player character (hidden when in car)
    this.player = new Player(44, 44);
    this.player.group.visible = false;
    this.renderer.scene.add(this.player.group);

    // Subsystems
    this.sound = new SoundManager();
    this.traffic = new TrafficSystem(this.renderer.scene);
    this.pedestrians = new PedestrianSystem(this.renderer.scene);
    this.police = new PoliceSystem(this.renderer.scene, this.city);
    this.economy = new EconomySystem();

    this.weapons = new WeaponSystem(
      this.renderer.scene,
      this.sound,
      this.traffic,
      this.police,
      this.pedestrians,
    );

    this.hud = new HUD('hud-overlay', this.economy);

    // Number keys 1-4 for quick weapon selection
    window.addEventListener('keydown', (e) => {
      const weaponMap: { [key: string]: string } = {
        '1': 'fists',
        '2': 'baseball_bat',
        '3': 'pistol',
        '4': 'rocket_launcher',
      };
      if (weaponMap[e.key]) {
        const weaponId = weaponMap[e.key];
        const weapon = this.economy.weapons.find((w) => w.id === weaponId);
        if (weapon && weapon.unlocked) {
          this.economy.equipWeapon(weaponId);
        } else if (weapon && !weapon.unlocked) {
          this.hud.showNotification(`🔒 ${weapon.name} noch nicht im Shop gekauft!`);
        }
      }
    });
  }

  public start(): void {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.hud.showNotification('Willkommen in GTA 7! Fahre los mit [W][A][S][D]!');
    requestAnimationFrame((time) => this.loop(time));
  }

  private loop(time: number): void {
    if (!this.isRunning) return;

    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.update(dt);
    this.renderer.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    if (this.weaponCooldown > 0) {
      this.weaponCooldown -= dt;
    }

    // 1. Process Actions & Subsystem Toggles
    if (this.input.toggleShop) {
      this.hud.toggleShop();
    }
    if (this.input.startJob) {
      this.economy.startRandomJob();
    }
    if (this.input.cycleCamera) {
      this.camera.cycleMode();
    }
    if (this.input.resetVehicle) {
      this.car.physics.reset(44, 44, 0);
      this.car.repair();
      this.hud.showNotification('Auto repariert & zur Kreuzung zurückgesetzt!');
    }
    if (this.input.toggleLights) {
      this.car.toggleHeadlights();
    }
    if (this.input.toggleMute) {
      const muted = this.sound.toggleMute();
      this.hud.showNotification(muted ? 'Ton stummgeschaltet 🔇' : 'Ton aktiviert 🔊');
    }
    if (this.input.horn) {
      this.sound.playHorn();
      const pX = this.mode === 'IN_CAR' ? this.car.physics.x : this.player.x;
      const pZ = this.mode === 'IN_CAR' ? this.car.physics.z : this.player.z;
      this.pedestrians.scareNearby(pX, pZ, 20);
    }

    // 2. Weapon Combat (Mouse Click or F key)
    if (this.input.fire && this.weaponCooldown <= 0) {
      const currentWeapon = this.economy.getSelectedWeapon();
      this.weaponCooldown = currentWeapon.fireRate;

      let originX: number;
      let originY: number;
      let originZ: number;
      let heading: number;

      if (this.mode === 'IN_CAR') {
        // Drive-by shooting from car
        originX = this.car.physics.x + Math.sin(this.car.physics.heading) * 1.5;
        originY = 1.0;
        originZ = this.car.physics.z + Math.cos(this.car.physics.heading) * 1.5;
        heading = this.car.physics.heading;
      } else {
        // Shooting on foot
        originX = this.player.x + Math.sin(this.player.rotationY) * 0.6;
        originY = 1.4;
        originZ = this.player.z + Math.cos(this.player.rotationY) * 0.6;
        heading = this.player.rotationY;
      }

      this.weapons.fire(currentWeapon, originX, originY, originZ, heading);
    }

    // 3. Player State Mode (In Car vs On Foot)
    const playerPos =
      this.mode === 'IN_CAR'
        ? new THREE.Vector3(this.car.physics.x, 0.5, this.car.physics.z)
        : new THREE.Vector3(this.player.x, 0, this.player.z);

    if (this.mode === 'IN_CAR') {
      // Car controls
      this.car.update(dt, {
        throttle: this.input.forward,
        reverse: this.input.backward,
        steerLeft: this.input.left,
        steerRight: this.input.right,
        handbrake: this.input.handbrake,
      });

      // Car Collision with Buildings
      const col = this.city.checkCollision(this.car.physics.x, this.car.physics.z, 2.0);
      if (col.collided) {
        const speed = Math.abs(this.car.physics.speed);
        if (speed > 4.0) {
          const dmg = Math.round(speed * 1.5);
          this.car.takeDamage(dmg);
          this.sound.playCrash();
          this.police.addCrimeSeverity(dmg);
        }
        this.car.physics.speed = -this.car.physics.speed * 0.4;
        this.car.physics.x += col.normalX * 0.8;
        this.car.physics.z += col.normalZ * 0.8;
      }

      // Check Collision with Traffic Cars
      for (const tCar of this.traffic.cars) {
        const d = Math.hypot(this.car.physics.x - tCar.x, this.car.physics.z - tCar.z);
        if (d < 3.2) {
          const impactSpeed = Math.abs(this.car.physics.speed) + tCar.speed;
          if (impactSpeed > 4.0) {
            this.sound.playCrash();
            const dmg = Math.round(impactSpeed * 1.2);
            this.car.takeDamage(dmg);
            this.traffic.damageCar(tCar, dmg * 2);
            this.police.addCrimeSeverity(20);
            this.hud.showNotification('💥 Unfall verursacht! Fahndung steigt!');
          }
          const angle = Math.atan2(this.car.physics.x - tCar.x, this.car.physics.z - tCar.z);
          this.car.physics.x += Math.sin(angle) * 1.0;
          this.car.physics.z += Math.cos(angle) * 1.0;
          this.car.physics.speed *= 0.4;
        }
      }

      // Check Collision with Pedestrians
      for (const ped of this.pedestrians.pedestrians) {
        const d = Math.hypot(this.car.physics.x - ped.x, this.car.physics.z - ped.z);
        if (d < 1.8 && Math.abs(this.car.physics.speed) > 6.0) {
          this.police.addCrimeSeverity(35);
          this.economy.addCash(40);
          this.hud.showNotification('⚠️ Passant angefahren! +$40 Beute | ⭐ Fahndung erhöht!');
          ped.x += Math.sin(this.car.physics.heading) * 4;
          ped.z += Math.cos(this.car.physics.heading) * 4;
          ped.isPanicking = true;
          ped.panicTimer = 5.0;
        }
      }

      // Pay 'n' Spray Garage check
      this.garage.update(dt, this.car, this.police, this.economy, this.sound, this.hud);

      // Camera Follow
      this.camera.updateVehicle(
        this.car.group.position,
        this.car.physics.heading,
        this.car.physics.speed,
        dt,
      );

      // Audio
      this.sound.updateEnginePitch(this.car.physics.rpm, true);

      // HUD Stats
      this.hud.updateVehicleStats(
        this.car.physics.getSpeedKmh(),
        this.car.physics.gear,
        this.car.health,
      );

      // Exit Car Prompt
      this.hud.setPrompt('Drücke [E] zum Aussteigen');
      if (this.input.actionInteract && Math.abs(this.car.physics.speed) < 5) {
        this.exitCar();
      }
    } else {
      // On Foot Mode
      this.player.update(dt, this.input, this.city);
      this.camera.updateOnFoot(this.player.group.position, this.player.rotationY, dt);
      this.sound.updateEnginePitch(0, false);
      this.hud.updateVehicleStats(0, 'FUSS', 100);

      // 1. Distance to own car
      const distToOwnCar = Math.hypot(
        this.player.x - this.car.physics.x,
        this.player.z - this.car.physics.z,
      );

      // 2. Distance to traffic cars (Car-Jacking)
      let nearestTrafficCar: TrafficCar | null = null;
      let nearestDist = 9999;
      for (const tCar of this.traffic.cars) {
        const d = Math.hypot(this.player.x - tCar.x, this.player.z - tCar.z);
        if (d < nearestDist) {
          nearestDist = d;
          nearestTrafficCar = tCar;
        }
      }

      if (nearestTrafficCar && nearestDist < 3.5) {
        this.hud.setPrompt('Drücke [E] um dieses Auto / Taxi zu KLAUEN! 🚨');
        if (this.input.actionInteract) {
          this.jackTrafficCar(nearestTrafficCar);
        }
      } else if (distToOwnCar < PLAYER_CONFIG.INTERACTION_RADIUS) {
        this.hud.setPrompt('Drücke [E] um ins Auto einzusteigen');
        if (this.input.actionInteract) {
          this.enterCar();
        }
      } else {
        this.hud.setPrompt(null);
      }
    }

    // 4. Update Subsystems
    this.weapons.update(dt);
    this.traffic.update(dt, playerPos.x, playerPos.z);
    this.pedestrians.update(
      dt,
      playerPos.x,
      playerPos.z,
      this.mode === 'IN_CAR' ? this.car.physics.speed : 0,
    );
    this.police.update(dt, playerPos.x, playerPos.z);
    this.sound.updateSiren(this.police.wantedLevel, dt);
    this.economy.update(dt, playerPos.x, playerPos.z);

    // 5. Update Minimap Radar (Player + Cops + Traffic + Pay 'n' Spray)
    const currentHeading =
      this.mode === 'IN_CAR' ? this.car.physics.heading : this.player.rotationY;
    const copPositions = this.police.copCars.map((c) => ({ x: c.x, z: c.z }));
    const trafficPositions = this.traffic.cars.map((c) => ({ x: c.x, z: c.z }));
    this.hud.updateMinimap(
      playerPos.x,
      playerPos.z,
      currentHeading,
      copPositions,
      trafficPositions,
    );
  }

  private enterCar(): void {
    this.mode = 'IN_CAR';
    this.player.group.visible = false;
    this.hud.showNotification('Eingestiegen! Gas geben mit [W]!');
  }

  private exitCar(): void {
    this.mode = 'ON_FOOT';
    const exitX = this.car.physics.x - Math.cos(this.car.physics.heading) * 2.2;
    const exitZ = this.car.physics.z + Math.sin(this.car.physics.heading) * 2.2;
    this.player.setPosition(exitX, 0, exitZ);
    this.player.group.visible = true;
    this.hud.showNotification('Ausgestiegen. Zu Fuß unterwegs.');
  }

  private jackTrafficCar(trafficCar: TrafficCar): void {
    this.car.physics.reset(trafficCar.x, trafficCar.z, trafficCar.heading);
    this.car.setColor(trafficCar.color);
    this.car.repair();

    this.traffic.removeCar(trafficCar);

    this.mode = 'IN_CAR';
    this.player.group.visible = false;

    this.police.addCrimeSeverity(25);
    this.hud.showNotification('🚗💨 Auto geklaut! Fahrer rausgeworfen — Polizei sucht dich!');
  }
}
