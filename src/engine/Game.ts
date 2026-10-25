import * as THREE from 'three';
import { Renderer } from './Renderer';
import { Input } from './Input';
import { GameCamera } from './Camera';
import { City } from '../city/City';
import { Car } from '../vehicles/Car';
import { Player } from '../character/Player';
import { PoliceSystem } from '../police/PoliceSystem';
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
  public car: Car;
  public player: Player;
  public police: PoliceSystem;
  public economy: EconomySystem;
  public sound: SoundManager;
  public hud: HUD;

  public mode: PlayerMode = 'IN_CAR';

  private lastTime: number = 0;
  private isRunning: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.input = new Input();
    this.camera = new GameCamera(this.renderer.camera);
    this.city = new City();
    this.renderer.scene.add(this.city.group);

    // Initial Car at road intersection
    this.car = new Car(44, 44, 0, 0xe62429);
    this.renderer.scene.add(this.car.group);

    // Player character (hidden when in car)
    this.player = new Player(44, 44);
    this.player.group.visible = false;
    this.renderer.scene.add(this.player.group);

    // Subsystems
    this.police = new PoliceSystem(this.renderer.scene, this.city);
    this.economy = new EconomySystem();
    this.sound = new SoundManager();
    this.hud = new HUD('hud-overlay', this.economy);

    // Keyboard debug for wanted stars
    window.addEventListener('keydown', (e) => {
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        this.police.setWantedLevel(parseInt(e.key, 10));
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
      this.car.physics.reset(0, 0, 0);
      this.car.repair();
      this.hud.showNotification('Auto zurückgesetzt & repariert!');
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
    }

    // 2. Player State Mode (In Car vs On Foot)
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
          this.police.addCrimeSeverity(dmg); // High speed crash alerts police!
        }
        // Bounce back
        this.car.physics.speed = -this.car.physics.speed * 0.4;
        this.car.physics.x += col.normalX * 0.8;
        this.car.physics.z += col.normalZ * 0.8;
      }

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

      // Exit Car Prompt / Action
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

      // Check distance to car for car-jacking / entering
      const distToCar = Math.hypot(
        this.player.x - this.car.physics.x,
        this.player.z - this.car.physics.z,
      );

      if (distToCar < PLAYER_CONFIG.INTERACTION_RADIUS) {
        this.hud.setPrompt('Drücke [E] um ins Auto einzusteigen (Auto klauen!)');
        if (this.input.actionInteract) {
          this.enterCar();
        }
      } else {
        this.hud.setPrompt(null);
      }
    }

    // 3. Update Subsystems
    this.police.update(dt, playerPos.x, playerPos.z);
    this.sound.updateSiren(this.police.wantedLevel, dt);
    this.economy.update(dt, playerPos.x, playerPos.z);

    // 4. Update Minimap Radar
    const currentHeading =
      this.mode === 'IN_CAR' ? this.car.physics.heading : this.player.rotationY;
    const copPositions = this.police.copCars.map((c) => ({ x: c.x, z: c.z }));
    this.hud.updateMinimap(playerPos.x, playerPos.z, currentHeading, copPositions);
  }

  private enterCar(): void {
    this.mode = 'IN_CAR';
    this.player.group.visible = false;
    this.hud.showNotification('Eingestiegen! Gas geben mit [W]!');
  }

  private exitCar(): void {
    this.mode = 'ON_FOOT';
    // Spawn player beside car driver door
    const exitX = this.car.physics.x - Math.cos(this.car.physics.heading) * 2.2;
    const exitZ = this.car.physics.z + Math.sin(this.car.physics.heading) * 2.2;
    this.player.setPosition(exitX, 0, exitZ);
    this.player.group.visible = true;
    this.hud.showNotification('Ausgestiegen. Zu Fuß unterwegs.');
  }
}
