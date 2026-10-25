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
import { MissionSystem } from '../missions/MissionSystem';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';
import { HUD } from '../ui/HUD';
import { NetworkManager } from '../network/NetworkManager';
import { RemotePlayer } from '../network/RemotePlayer';
import { NetMsgKind, PlayerSyncMsg } from '../network/NetProtocol';
import { PLAYER_CONFIG, RACE_CIRCUIT } from '../utils/Constants';

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
  public missions: MissionSystem;
  public economy: EconomySystem;
  public sound: SoundManager;
  public hud: HUD;

  // Multiplayer
  public network: NetworkManager;
  public remotePlayer: RemotePlayer;
  private netSyncTimer: number = 0;

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

    this.missions = new MissionSystem(this.renderer.scene, this.sound, this.economy);

    // Multiplayer initialization
    this.network = new NetworkManager();
    this.remotePlayer = new RemotePlayer(this.renderer.scene);
    this.hud = new HUD('hud-overlay', this.economy, this.network, this.input);

    this.setupMultiplayerNetworking();

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

  private setupMultiplayerNetworking(): void {
    this.network.onMessage((msg) => {
      if (msg.kind === NetMsgKind.PLAYER_SYNC) {
        this.remotePlayer.applySync(msg);
      } else if (msg.kind === NetMsgKind.COMBAT_FIRE) {
        const weapon =
          this.economy.weapons.find((w) => w.id === msg.weaponId) || this.economy.weapons[2];
        this.weapons.fire(weapon, msg.x, msg.y, msg.z, msg.heading);
      } else if (msg.kind === NetMsgKind.VEHICLE_RAM) {
        this.sound.playCrash();
        this.car.takeDamage(msg.damage);
        this.car.physics.x += msg.pushX;
        this.car.physics.z += msg.pushZ;
        this.hud.showNotification('💥 Kumpel hat dich gerammt!');
      }
    });
  }

  public start(): void {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.hud.showNotification(
      'Willkommen in GTA 7! Gas: [W] | Nitro: [N] | Schießen: [Klick] | Multiplayer: [P]!',
    );
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
    if (this.input.toggleMultiplayer) {
      this.hud.toggleMultiplayer();
    }
    if (this.input.startJob) {
      this.missions.startTaxiMission();
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
        originX = this.car.physics.x + Math.sin(this.car.physics.heading) * 1.5;
        originY = 1.0;
        originZ = this.car.physics.z + Math.cos(this.car.physics.heading) * 1.5;
        heading = this.car.physics.heading;
      } else {
        originX = this.player.x + Math.sin(this.player.rotationY) * 0.6;
        originY = 1.4;
        originZ = this.player.z + Math.cos(this.player.rotationY) * 0.6;
        heading = this.player.rotationY;
      }

      this.weapons.fire(currentWeapon, originX, originY, originZ, heading);

      // Broadcast shot to remote player
      if (this.network.isConnected) {
        this.network.send({
          kind: NetMsgKind.COMBAT_FIRE,
          weaponId: currentWeapon.id,
          x: originX,
          y: originY,
          z: originZ,
          heading,
        });
      }
    }

    // 3. Player State Mode (In Car vs On Foot)
    const playerPos =
      this.mode === 'IN_CAR'
        ? new THREE.Vector3(this.car.physics.x, 0.5, this.car.physics.z)
        : new THREE.Vector3(this.player.x, 0, this.player.z);

    if (this.mode === 'IN_CAR') {
      // Check Stunt Ramps in city
      const ramp1Dist = Math.hypot(this.car.physics.x - 0, this.car.physics.z - 40);
      const ramp2Dist = Math.hypot(this.car.physics.x - 88, this.car.physics.z - -40);

      if (
        (ramp1Dist < 6.0 || ramp2Dist < 6.0) &&
        this.car.physics.speed > 12 &&
        !this.car.physics.isAirborne
      ) {
        this.car.physics.launchJump(12.5);
      }

      // Car controls
      const stuntResult = this.car.update(dt, {
        throttle: this.input.forward,
        reverse: this.input.backward,
        steerLeft: this.input.left,
        steerRight: this.input.right,
        handbrake: this.input.handbrake,
        nitro: this.input.nitro,
      });

      if (stuntResult.stuntCompleted) {
        this.missions.handleStuntJump(stuntResult.distance, stuntResult.airtime);
      }

      // Car Collision with Buildings
      if (!this.car.physics.isAirborne) {
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
      }

      // Collision with Traffic Cars
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

      // Multiplayer Ramming: Local Car vs Remote Buddy Car
      if (this.network.isConnected && this.remotePlayer.mode === 'IN_CAR') {
        const distToBuddy = Math.hypot(
          this.car.physics.x - this.remotePlayer.targetX,
          this.car.physics.z - this.remotePlayer.targetZ,
        );
        if (distToBuddy < 3.2) {
          const impact = Math.abs(this.car.physics.speed) + Math.abs(this.remotePlayer.speed);
          if (impact > 4.0) {
            this.sound.playCrash();
            const dmg = Math.round(impact * 1.3);
            this.car.takeDamage(dmg);

            const pushAngle = Math.atan2(
              this.remotePlayer.targetX - this.car.physics.x,
              this.remotePlayer.targetZ - this.car.physics.z,
            );
            const pushX = Math.sin(pushAngle) * 2.0;
            const pushZ = Math.cos(pushAngle) * 2.0;

            this.network.send({
              kind: NetMsgKind.VEHICLE_RAM,
              damage: dmg,
              pushX,
              pushZ,
            });
            this.hud.showNotification('💥 Du hast deinen Kumpel gerammt!');
          }
        }
      }

      // Check Collision with Pedestrians
      for (const ped of this.pedestrians.pedestrians) {
        const d = Math.hypot(this.car.physics.x - ped.x, this.car.physics.z - ped.z);
        if (d < 2.0 && Math.abs(this.car.physics.speed) > 4.0 && ped.state === 'WALKING') {
          this.sound.playPedestrianHit();
          this.pedestrians.launchPedestrian(
            ped,
            Math.abs(this.car.physics.speed),
            this.car.physics.heading,
          );
          this.police.addCrimeSeverity(35);
          this.economy.addCash(50);
          this.hud.showNotification('💥 Passant weggeschleudert! +$50 Beute | ⭐ Fahndung erhöht!');
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

      // Audio (with Nitro scream!)
      this.sound.updateEnginePitch(this.car.physics.rpm, true, this.car.physics.isBoosting);

      // HUD Stats
      this.hud.updateVehicleStats(
        this.car.physics.getSpeedKmh(),
        this.car.physics.gear,
        this.car.health,
        this.car.physics.nitro,
        true,
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
      this.hud.updateVehicleStats(0, 'FUSS', 100, 0, false);

      const distToOwnCar = Math.hypot(
        this.player.x - this.car.physics.x,
        this.player.z - this.car.physics.z,
      );

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
    this.missions.update(dt, playerPos.x, playerPos.z, this.mode === 'IN_CAR');
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

    // 5. Update Remote Peer & Sync Broadcast (every 50ms)
    this.remotePlayer.update(dt);
    if (this.network.isConnected) {
      this.netSyncTimer += dt;
      if (this.netSyncTimer >= 0.05) {
        this.netSyncTimer = 0;
        const syncMsg: PlayerSyncMsg = {
          kind: NetMsgKind.PLAYER_SYNC,
          x: playerPos.x,
          y: playerPos.y,
          z: playerPos.z,
          heading: this.mode === 'IN_CAR' ? this.car.physics.heading : this.player.rotationY,
          speed: this.mode === 'IN_CAR' ? this.car.physics.speed : 0,
          mode: this.mode,
          carColor: 0xe62429,
          isBoosting: this.mode === 'IN_CAR' && this.car.physics.isBoosting,
          isDrifting: this.mode === 'IN_CAR' && this.car.physics.isDrifting,
          health: this.car.health,
          t: performance.now(),
        };
        this.network.send(syncMsg);
      }
    }

    // 6. Update Minimap Radar with Active Target & Remote Buddy
    let activeTarget: { x: number; z: number; color?: string } | null = null;
    if (this.missions.race.isActive) {
      const pt = RACE_CIRCUIT[this.missions.race.currentCheckpointIndex];
      if (pt) activeTarget = { x: pt.x, z: pt.z, color: '#00e5ff' };
    } else if (this.missions.taxiMission.isActive) {
      if (!this.missions.taxiMission.hasPickedUp) {
        activeTarget = {
          x: this.missions.taxiMission.pickupX,
          z: this.missions.taxiMission.pickupZ,
          color: '#facc15',
        };
      } else {
        activeTarget = {
          x: this.missions.taxiMission.dropoffX,
          z: this.missions.taxiMission.dropoffZ,
          color: '#22c55e',
        };
      }
    }

    const remotePos = this.network.isConnected
      ? { x: this.remotePlayer.targetX, z: this.remotePlayer.targetZ }
      : null;

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
      activeTarget,
      remotePos,
    );
  }

  private enterCar(): void {
    this.mode = 'IN_CAR';
    this.player.group.visible = false;
    this.hud.showNotification('Eingestiegen! Gas: [W] | Nitro: [N]!');
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
