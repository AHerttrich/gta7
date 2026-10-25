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
import { PLAYER_CONFIG, RACE_CIRCUIT, EVENTS } from '../utils/Constants';
import { RadioSystem } from '../audio/RadioSystem';
import { Helicopter } from '../vehicles/Helicopter';
import { Tank } from '../vehicles/Tank';
import { Boat } from '../vehicles/Boat';
import { MilitarySystem } from '../military/MilitarySystem';
import { CasinoSystem } from '../casino/CasinoSystem';
import { HeistSystem } from '../heists/HeistSystem';
import { WaterSystem } from '../water/WaterSystem';
import { TrainSystem } from '../trains/TrainSystem';
import { StorySystem } from '../story/StorySystem';
import { StuntEditor } from '../editor/StuntEditor';
import { eventBus } from '../utils/EventBus';
import { GangSystem } from '../gangs/GangSystem';
import { SkidmarkSystem } from '../vehicles/SkidmarkSystem';

export type PlayerMode = 'IN_CAR' | 'ON_FOOT' | 'IN_HELI' | 'IN_TANK' | 'IN_BOAT';

export class Game {
  public renderer: Renderer;
  public input: Input;
  public camera: GameCamera;
  public city: City;
  public garage: Garage;
  public car: Car;
  public skidmarks: SkidmarkSystem;
  public helicopter: Helicopter;
  public player: Player;
  public police: PoliceSystem;
  public traffic: TrafficSystem;
  public pedestrians: PedestrianSystem;
  public weapons: WeaponSystem;
  public missions: MissionSystem;
  public gangs: GangSystem;
  public economy: EconomySystem;
  public sound: SoundManager;
  public radio: RadioSystem;
  public hud: HUD;

  // Master Expansion Subsystems (Phases 13-20)
  public military: MilitarySystem;
  public casino: CasinoSystem;
  public heist: HeistSystem;
  public water: WaterSystem;
  public train: TrainSystem;
  public story: StorySystem;
  public stuntEditor: StuntEditor;
  public activeTank: Tank | null = null;
  public activeBoat: Boat | null = null;

  // Multiplayer
  public network: NetworkManager;
  public remotePlayer: RemotePlayer;
  private netSyncTimer: number = 0;

  public mode: PlayerMode = 'IN_CAR';

  private lastTime: number = 0;
  private isRunning: boolean = false;
  private weaponCooldown: number = 0;
  private prevCarBoosting: boolean = false;
  private crashCooldown: number = 0;

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
    this.skidmarks = new SkidmarkSystem(this.renderer.scene);

    // Player character (hidden when in car)
    this.player = new Player(44, 44);
    this.player.group.visible = false;
    this.renderer.scene.add(this.player.group);

    // Subsystems
    this.sound = new SoundManager();
    this.radio = new RadioSystem(this.sound);

    // Controllable Player Helicopter on Skyscraper Helipad
    this.helicopter = new Helicopter(0, 52.5, 0);
    this.renderer.scene.add(this.helicopter.group);

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
    this.gangs = new GangSystem(this.renderer.scene, this.economy, this.sound);
    this.weapons.setGangSystem(this.gangs);

    // Phases 13-20 Subsystems
    this.military = new MilitarySystem(this.renderer.scene);
    this.casino = new CasinoSystem(this.renderer.scene, this.economy, this.sound);
    this.heist = new HeistSystem(this.renderer.scene, this.economy, this.police, this.sound);
    this.water = new WaterSystem(this.renderer.scene, this.economy, this.sound);
    this.train = new TrainSystem(this.renderer.scene, this.sound);
    this.story = new StorySystem(this.economy, this.sound);
    this.stuntEditor = new StuntEditor(this.renderer.scene, this.sound);

    // Multiplayer initialization
    this.network = new NetworkManager();
    this.remotePlayer = new RemotePlayer(this.renderer.scene);
    this.hud = new HUD('hud-overlay', this.economy, this.network, this.input);
    this.hud.setCasino(this.casino);
    this.hud.setAudioSystems(this.sound, this.radio, this.renderer);

    this.setupMultiplayerNetworking();

    // Hotkeys & Event Listeners
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

      if (e.key === 'Tab') {
        e.preventDefault();
        this.stuntEditor.toggleBuildMode();
      } else if (e.key === 'j' || e.key === 'J') {
        const active = this.player.toggleJetpack();
        this.hud.showNotification(
          active
            ? '🚀 CYBER-JETPACK AKTIV! [Leertaste] Steigen — Tank lädt am Boden nach!'
            : '🚀 Jetpack abgelegt.',
        );
      } else if (this.stuntEditor.isBuildMode) {
        const x = this.mode === 'IN_CAR' ? this.car.physics.x : this.player.x;
        const z = this.mode === 'IN_CAR' ? this.car.physics.z : this.player.z;
        const heading = this.mode === 'IN_CAR' ? this.car.physics.heading : this.player.rotationY;
        const spawnX = x + Math.sin(heading) * 9.0;
        const spawnZ = z + Math.cos(heading) * 9.0;

        if (e.key === '5') {
          this.stuntEditor.placeProp('rampe', spawnX, spawnZ, heading);
          this.hud.showNotification('🏗️ 45° Stunt-Rampe platziert!');
        } else if (e.key === '6') {
          this.stuntEditor.placeProp('boost_pad', spawnX, spawnZ, heading);
          this.hud.showNotification('⚡ Neon-Booster Pad (245 km/h) platziert!');
        } else if (e.key === '7') {
          this.stuntEditor.placeProp('feuerring', spawnX, spawnZ, heading);
          this.hud.showNotification('🔥 Ring of Fire platziert!');
        } else if (e.key === '8') {
          this.stuntEditor.placeProp('looping', spawnX, spawnZ, heading);
          this.hud.showNotification('🌀 Korkenzieher-Looping platziert!');
        } else if (e.key === '9') {
          this.stuntEditor.placeProp('kisten', spawnX, spawnZ, heading);
          this.hud.showNotification('📦 Kisten-Hindernis platziert!');
        }
      }
    });

    eventBus.on('vr:toggle', () => {
      this.camera.mode = this.camera.mode === 'COCKPIT' ? 'CHASE' : 'COCKPIT';
      this.hud.showNotification(
        this.camera.mode === 'COCKPIT'
          ? '🥽 COCKPIT & VR EGO-PERSPEKTIVE AKTIVIERT!'
          : '🎥 DRITT-PERSON KAMERA AKTIV',
      );
    });

    eventBus.on('tuning:applied', (data: unknown) => {
      const d = data as { id: string };
      if (d.id === 'engine_stage_1') {
        this.car.physics.setEngineStage(1);
      } else if (d.id === 'engine_stage_2') {
        this.car.physics.setEngineStage(2);
      } else if (d.id === 'engine_stage_3') {
        this.car.physics.setEngineStage(3);
      } else if (d.id === 'armor_plating') {
        this.car.physics.setArmorPlating(true);
      } else if (d.id === 'neon_pink') {
        this.car.setUnderglowColor(0xff007f);
      } else if (d.id === 'neon_lime') {
        this.car.setUnderglowColor(0x39ff14);
      } else if (d.id === 'neon_gold') {
        this.car.setUnderglowColor(0xffaa00);
      } else if (d.id === 'neon_purple') {
        this.car.setUnderglowColor(0x9d00ff);
      }

      if (this.story.currentChapterIndex === 0) {
        this.story.advanceChapter();
      }
    });

    eventBus.on(EVENTS.RACE_COMPLETE, () => {
      if (this.story.currentChapterIndex === 1) {
        this.story.advanceChapter();
      }
    });

    // Time & Weather quickbar controls
    const btnTime = document.getElementById('m-btn-time');
    if (btnTime) {
      btnTime.addEventListener('click', () => {
        const name = this.renderer.cycleTimePreset();
        this.hud.showNotification(`🕒 Beleuchtung: ${name}`);
      });
    }
    const btnWeather = document.getElementById('m-btn-weather');
    if (btnWeather) {
      btnWeather.addEventListener('click', () => {
        const name = this.renderer.cycleWeather();
        this.city.setWeatherMode(this.renderer.weather);
        this.hud.showNotification(`🌦️ Wetter: ${name}`);
      });
    }

    // Keyboard shortcuts L (Day/Night) and K (Weather)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'l' || e.key === 'L') {
        const name = this.renderer.cycleTimePreset();
        this.hud.showNotification(`🕒 Beleuchtung: ${name}`);
      } else if (e.key === 'k' || e.key === 'K') {
        const name = this.renderer.cycleWeather();
        this.city.setWeatherMode(this.renderer.weather);
        this.hud.showNotification(`🌦️ Wetter: ${name}`);
      }
    });

    // Background tab / Window visibility handling (stops sound and throttles loop when tab is inactive)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.sound.suspend();
        } else {
          this.sound.resume();
          this.lastTime = performance.now();
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', () => {
        this.sound.suspend();
      });
      window.addEventListener('focus', () => {
        this.sound.resume();
        this.lastTime = performance.now();
      });
    }
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
      'Willkommen in GTA 7! Gas: [W] | Nitro: [N] | DeLorean Flugmodus: [V]/[X] | Multiplayer: [P]!',
    );
    requestAnimationFrame((time) => this.loop(time));
  }

  private loop(time: number): void {
    if (!this.isRunning) return;

    // Halt game execution and loop while tab is hidden in background
    if (typeof document !== 'undefined' && document.hidden) {
      this.lastTime = time;
      requestAnimationFrame((t) => this.loop(t));
      return;
    }

    if (!this.lastTime) {
      this.lastTime = time;
    }
    const rawDt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // Guard against negative dt (clock skew) or huge dt (tab backgrounded)
    const dt = Math.max(0.001, Math.min(rawDt, 0.1));

    try {
      this.input.pollGamepad();
      this.update(dt);
      this.renderer.updateAtmosphere(
        dt,
        this.renderer.camera.position,
        this.mode === 'IN_CAR' ? this.car.physics.speed : 0,
        this.mode === 'IN_CAR' && this.car.physics.isBoosting,
        this.mode === 'IN_CAR' && this.car.physics.isHoverMode,
      );
      this.renderer.render();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error in game loop:', err);
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    if (this.weaponCooldown > 0) {
      this.weaponCooldown -= dt;
    }
    if (this.crashCooldown > 0) {
      this.crashCooldown -= dt;
    }

    // 1. Process Actions & Subsystem Toggles
    if (this.input.toggleSettings) {
      this.hud.toggleSettings();
    }
    if (this.input.wasJustPressed('m')) {
      this.hud.toggleMinimapZoom();
    }
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
    if (this.input.cycleRadio) {
      const station = this.radio.cycleStation();
      this.hud.showRadioStation(station.name, station.genre);
    }
    this.radio.update(dt, this.mode === 'IN_CAR' || this.mode === 'IN_HELI');
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
      this.input.triggerRumble(0.4, 90);
      this.input.triggerHaptics(35);

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

    // 3. Player State Mode (In Car vs On Foot vs Helicopter vs Tank vs Boat)
    const playerPos =
      this.mode === 'IN_CAR'
        ? new THREE.Vector3(this.car.physics.x, 0.5, this.car.physics.z)
        : this.mode === 'IN_HELI'
          ? new THREE.Vector3(this.helicopter.x, this.helicopter.y, this.helicopter.z)
          : this.mode === 'IN_TANK' && this.activeTank
            ? new THREE.Vector3(this.activeTank.x, this.activeTank.y, this.activeTank.z)
            : this.mode === 'IN_BOAT' && this.activeBoat
              ? new THREE.Vector3(this.activeBoat.x, this.activeBoat.y, this.activeBoat.z)
              : new THREE.Vector3(this.player.x, this.player.y, this.player.z);

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

      // DeLorean Hover Mode toggle trigger
      const wasHover = this.car.physics.isHoverMode;
      const hoverToggled = this.input.hoverToggle;

      // Car controls
      const stuntResult = this.car.update(dt, {
        throttle: this.input.forward,
        reverse: this.input.backward,
        steerLeft: this.input.left,
        steerRight: this.input.right,
        handbrake: this.input.handbrake,
        nitro: this.input.nitro,
        hoverToggle: hoverToggled,
        ascend: this.input.ascend,
        descend: this.input.descend,
      });

      if (this.car.physics.isHoverMode !== wasHover) {
        if (this.car.physics.isHoverMode) {
          this.sound.playHoverEngage();
          this.hud.showNotification(
            '⚡ DELOREAN HOVER-FLUG! [Leertaste] Steigen | [C] Sinken | [V]/[X] Landen',
          );
        } else {
          this.hud.showNotification('🛬 DeLorean gelandet — Straßenmodus aktiv');
        }
      }

      // Turbo Blow-Off Valve on boost release & Rumble
      if (this.prevCarBoosting && !this.car.physics.isBoosting) {
        this.sound.playBlowOffValve();
      }
      this.prevCarBoosting = this.car.physics.isBoosting;
      if (this.car.physics.isBoosting) {
        this.input.triggerRumble(0.2, 50);
      }

      if (stuntResult.stuntCompleted) {
        this.missions.handleStuntJump(stuntResult.distance, stuntResult.airtime);
      }

      // Car Collision with Buildings (Continuous Anti-Tunneling Swept Collision)
      if (!this.car.physics.isAirborne) {
        const col = this.city.checkSweptCollision(
          this.car.physics.prevX,
          this.car.physics.prevZ,
          this.car.physics.x,
          this.car.physics.z,
          2.0,
        );
        if (col.collided) {
          const speed = Math.abs(this.car.physics.speed);
          if (speed > 4.0 && this.crashCooldown <= 0) {
            // More forgiving crash damage so cars can take many hits
            const dmg = Math.max(2, Math.round(speed * 0.45));
            this.car.takeDamage(dmg);
            this.sound.playCrash(Math.min(30, Math.round(speed)));
            this.police.addCrimeSeverity(dmg);
            this.input.triggerRumble(0.6, 180);
            this.input.triggerHaptics(50);
            this.crashCooldown = 0.3;
          }
          this.car.physics.speed = -this.car.physics.speed * 0.3;
          this.car.physics.x = col.safeX + col.normalX * 0.3;
          this.car.physics.z = col.safeZ + col.normalZ * 0.3;
        }
      }

      // Collision with Traffic Cars
      for (const tCar of this.traffic.cars) {
        const d = Math.hypot(this.car.physics.x - tCar.x, this.car.physics.z - tCar.z);
        if (d < 3.2) {
          const impactSpeed = Math.abs(this.car.physics.speed) + tCar.speed;
          if (impactSpeed > 4.0 && this.crashCooldown <= 0) {
            this.sound.playCrash(Math.min(30, Math.round(impactSpeed)));
            const dmg = Math.max(2, Math.round(impactSpeed * 0.35));
            this.car.takeDamage(dmg);
            this.traffic.damageCar(tCar, dmg * 2);
            this.police.addCrimeSeverity(15);
            this.hud.showNotification('💥 Unfall verursacht! Fahndung steigt!');
            this.input.triggerRumble(0.55, 150);
            this.input.triggerHaptics(40);
            this.crashCooldown = 0.3;
          }
          const angle = Math.atan2(this.car.physics.x - tCar.x, this.car.physics.z - tCar.z);
          this.car.physics.x += Math.sin(angle) * 0.8;
          this.car.physics.z += Math.cos(angle) * 0.8;
          this.car.physics.speed *= 0.6;
        }
      }

      // Police Cruisers Ramming Player Car
      for (const cop of this.police.copCars) {
        const d = Math.hypot(this.car.physics.x - cop.x, this.car.physics.z - cop.z);
        if (d < 3.4) {
          const impactSpeed = Math.abs(this.car.physics.speed) + Math.abs(cop.speed);
          const pushAngle = Math.atan2(this.car.physics.x - cop.x, this.car.physics.z - cop.z);
          const pushForce = Math.max(4.0, cop.speed * 0.7);

          // Physical impulse on player car
          this.car.physics.x += Math.sin(pushAngle) * pushForce * dt;
          this.car.physics.z += Math.cos(pushAngle) * pushForce * dt;
          this.car.physics.speed *= 0.85;

          // Cop recoil
          cop.x -= Math.sin(pushAngle) * 0.6;
          cop.z -= Math.cos(pushAngle) * 0.6;
          cop.speed *= 0.5;

          if (impactSpeed > 3.0 && this.crashCooldown <= 0) {
            this.sound.playCrash(22);
            const dmg = Math.max(2, Math.round(cop.speed * 0.35));
            this.car.takeDamage(dmg);
            this.hud.showNotification('🚨 Die Polizei rammt dich! Bleib stehen!');
            this.input.triggerRumble(0.65, 200);
            this.input.triggerHaptics(50);
            this.crashCooldown = 0.3;
          }
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

      // Police Roadblock collisions
      if (
        this.police.checkRoadblockCollision(
          this.car.physics.x,
          this.car.physics.z,
          this.car.physics.speed,
        )
      ) {
        this.sound.playCrash();
        this.car.takeDamage(12);
        this.police.addCrimeSeverity(30);
        this.hud.showNotification('💥 Straßensperre der Polizei durchbrochen!');
      }

      // Police Spike Strip collisions
      if (this.police.checkSpikeStripCollision(this.car.physics.x, this.car.physics.z)) {
        this.sound.playCrash(22);
        this.car.physics.blowTires();
      }

      // Police Tactical PIT Maneuver
      const pit = this.police.checkPitManeuver(
        this.car.physics.x,
        this.car.physics.z,
        this.car.physics.heading,
        this.car.physics.speed,
      );
      if (pit.triggered) {
        this.car.physics.heading += pit.spinDir * 1.6 * dt;
        this.sound.playCrash(12);
      }

      // Train track collision check
      const trainCollision = this.train.checkFreightTrainCollision(
        this.car.physics.x,
        this.car.physics.z,
      );
      if (trainCollision.hit) {
        this.car.takeDamage(40);
        this.car.physics.x += trainCollision.pushX;
        this.car.physics.z += trainCollision.pushZ;
        this.car.physics.speed *= -0.5;
      }

      // Stunt editor interactive props check
      this.stuntEditor.checkCarInteraction(
        this.car.physics.x,
        this.car.physics.z,
        this.car.physics,
      );

      // Pay 'n' Spray Garage check
      this.garage.update(dt, this.car, this.police, this.economy, this.sound, this.hud);

      // Camera Follow
      this.camera.updateVehicle(
        this.car.group.position,
        this.car.physics.heading,
        this.car.physics.speed,
        dt,
        this.city,
      );

      // Tire Skidmarks & Burnout Smoke
      this.skidmarks.update(
        dt,
        this.car.physics.x,
        this.car.physics.z,
        this.car.physics.heading,
        this.car.physics.speed,
        this.car.physics.isDrifting,
        this.input.nitro || (this.input.backward && this.car.physics.speed > 5),
        this.car.physics.isAirborne || this.car.physics.isHoverMode,
      );

      // Audio (with Nitro scream & DeLorean Sci-Fi Hover hum!)
      this.sound.updateEnginePitch(
        this.car.physics.rpm,
        true,
        this.car.physics.isBoosting,
        this.car.physics.isHoverMode,
      );
      this.sound.updateRotorPitch(0, false);

      // HUD Stats (including dynamic RPM tachometer)
      this.hud.updateVehicleStats(
        this.car.physics.getSpeedKmh(),
        this.car.physics.gear,
        this.car.health,
        this.car.physics.nitro,
        true,
        this.car.physics.isHoverMode,
        this.car.physics.rpm,
      );

      // Exit Car Prompt, Water Rescue & Upside-Down Recovery
      if (this.car.physics.y < -0.8) {
        this.hud.setPrompt('⚠️ Auto im Wasser versunken! Drücke [R] zur Bergung');
        if (this.input.resetVehicle || this.input.actionInteract) {
          this.car.physics.reset(44, 44, 0);
          this.car.repair();
          this.hud.showNotification('⚓ Auto vom Bergungsdienst an Land gezogen!');
        }
      } else if (this.car.physics.isFlipped) {
        this.hud.setPrompt('⚠️ Auto liegt auf dem Dach! Drücke [R] zum Aufrichten');
        if (this.input.resetVehicle || this.input.actionInteract) {
          this.car.physics.rightUpright();
          this.hud.showNotification('🔄 Auto wieder aufgerichtet!');
        }
      } else {
        this.hud.setPrompt('Drücke [E] zum Aussteigen');
        if (this.input.actionInteract && Math.abs(this.car.physics.speed) < 5) {
          this.exitCar();
        }
      }
    } else if (this.mode === 'IN_HELI') {
      // Helicopter Flight Mode
      this.helicopter.update(dt, this.input, this.city);
      this.camera.updateVehicle(
        this.helicopter.group.position,
        this.helicopter.heading,
        this.helicopter.getSpeedKmh() / 3.6,
        dt,
      );
      this.sound.updateRotorPitch(this.helicopter.rpm, true);
      this.sound.updateEnginePitch(0, false);
      this.hud.updateVehicleStats(
        this.helicopter.getSpeedKmh(),
        'HELI',
        this.helicopter.health,
        100,
        true,
        true,
      );

      this.hud.setPrompt('Drücke [E] zum Landen / Aussteigen 🚁');
      if (
        this.input.actionInteract &&
        (this.helicopter.y <= 0.6 || Math.abs(this.helicopter.vy) < 0.6)
      ) {
        this.exitHelicopter();
      }
    } else if (this.mode === 'IN_TANK' && this.activeTank) {
      // Rhino Tank Controls & Physics
      const res = this.activeTank.update(dt, {
        throttle: this.input.forward,
        reverse: this.input.backward,
        steerLeft: this.input.left,
        steerRight: this.input.right,
        fire: this.input.fire,
        turretLeft: this.input.isDown('q'),
        turretRight: this.input.isDown('e') && Math.abs(this.activeTank.speed) > 1,
      });

      if (res.firedCannon) {
        this.sound.playExplosion();
        const muzzle = this.activeTank.getCannonMuzzlePosition();
        const aim = this.activeTank.getCannonAimVector();
        this.weapons.fire(
          this.economy.weapons[3],
          muzzle.x,
          muzzle.y,
          muzzle.z,
          Math.atan2(aim.x, aim.z),
        );
        this.hud.showNotification('💥 120mm PANZER-KANONE ABGEFEUERT!');
      }

      this.camera.updateVehicle(
        this.activeTank.group.position,
        this.activeTank.heading,
        this.activeTank.speed,
        dt,
      );
      this.sound.updateEnginePitch(Math.abs(this.activeTank.speed) * 80 + 1000, true);
      this.sound.updateRotorPitch(0, false);
      this.hud.updateVehicleStats(
        Math.round(this.activeTank.speed * 3.6),
        'RHINO',
        this.activeTank.health,
        100,
        true,
        false,
      );

      this.hud.setPrompt('Drücke [E] zum Aussteigen aus dem Panzer');
      if (this.input.actionInteract && Math.abs(this.activeTank.speed) < 3.0) {
        this.exitTank();
      }
    } else if (this.mode === 'IN_BOAT' && this.activeBoat) {
      // Boat & Jet-Ski Controls & Water Buoyancy
      this.activeBoat.update(
        dt,
        {
          throttle: this.input.forward,
          reverse: this.input.backward,
          steerLeft: this.input.left,
          steerRight: this.input.right,
        },
        this.water.getWaveTime(),
      );

      this.camera.updateVehicle(
        this.activeBoat.group.position,
        this.activeBoat.heading,
        this.activeBoat.speed,
        dt,
      );
      this.sound.updateEnginePitch(Math.abs(this.activeBoat.speed) * 90 + 900, true);
      this.sound.updateRotorPitch(0, false);
      this.hud.updateVehicleStats(
        Math.round(this.activeBoat.speed * 3.6),
        this.activeBoat.isJetSki ? 'JETSKI' : 'BOOT',
        this.activeBoat.health,
        100,
        true,
        false,
      );

      this.hud.setPrompt('Drücke [E] zum Verlassen des Boots');
      if (this.input.actionInteract && Math.abs(this.activeBoat.speed) < 4.0) {
        this.exitBoat();
      }
    } else {
      // On Foot Mode
      this.player.update(dt, this.input, this.city);
      this.camera.updateOnFoot(this.player.group.position, this.player.rotationY, dt, this.city);
      this.sound.updateEnginePitch(0, false);
      this.sound.updateRotorPitch(this.helicopter.rpm, false);
      this.hud.updateVehicleStats(0, 'FUSS', this.player.health, 0, false);

      // Police Cruisers Ramming / Running Down Player on Foot
      for (const cop of this.police.copCars) {
        const d = Math.hypot(this.player.x - cop.x, this.player.z - cop.z);
        if (d < 2.5 && Math.abs(cop.speed) > 3.0 && this.crashCooldown <= 0) {
          this.sound.playPedestrianHit();
          this.player.takeDamage(20);
          this.police.addCrimeSeverity(30);
          this.hud.showNotification('🚨 Von Polizeiwagen angefahren!');
          this.input.triggerRumble(0.7, 200);
          this.input.triggerHaptics(60);
          this.crashCooldown = 0.5;
        }
      }

      const distToHeli = Math.hypot(
        this.player.x - this.helicopter.x,
        this.player.z - this.helicopter.z,
      );
      const distToOwnCar = Math.hypot(
        this.player.x - this.car.physics.x,
        this.player.z - this.car.physics.z,
      );
      const distToTank = Math.hypot(
        this.player.x - this.military.parkedTank.x,
        this.player.z - this.military.parkedTank.z,
      );
      const distToBoat = Math.hypot(
        this.player.x - this.water.speedboat.x,
        this.player.z - this.water.speedboat.z,
      );
      const distToJetSki = Math.hypot(
        this.player.x - this.water.jetSki.x,
        this.player.z - this.water.jetSki.z,
      );
      const nearCasino = this.casino.isNearEntrance(this.player.x, this.player.z);
      const distToBank = Math.hypot(
        this.player.x - this.heist.bankX,
        this.player.z - (this.heist.bankZ - 14),
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

      if (distToTank < 4.5) {
        this.hud.setPrompt('Drücke [E] um in den RHINO TANK einzusteigen 🛡️');
        if (this.input.actionInteract) {
          this.enterTank();
        }
      } else if (distToBoat < 5.0) {
        this.hud.setPrompt('Drücke [E] um ins OFFSHORE SPEEDBOOT einzusteigen 🚤');
        if (this.input.actionInteract) {
          this.enterBoat(this.water.speedboat);
        }
      } else if (distToJetSki < 4.5) {
        this.hud.setPrompt('Drücke [E] um auf das CYBER JET-SKI aufzusteigen 🌊');
        if (this.input.actionInteract) {
          this.enterBoat(this.water.jetSki);
        }
      } else if (distToHeli < 4.5 && Math.abs(this.player.y - this.helicopter.y) < 4.0) {
        this.hud.setPrompt('Drücke [E] um in den Helikopter einzusteigen 🚁');
        if (this.input.actionInteract) {
          this.enterHelicopter();
        }
      } else if (nearestTrafficCar && nearestDist < 3.5) {
        this.hud.setPrompt('Drücke [E] um dieses Auto / Taxi zu KLAUEN! 🚨');
        if (this.input.actionInteract) {
          this.jackTrafficCar(nearestTrafficCar);
        }
      } else if (distToOwnCar < PLAYER_CONFIG.INTERACTION_RADIUS) {
        this.hud.setPrompt('Drücke [E] um ins Auto einzusteigen');
        if (this.input.actionInteract) {
          this.enterCar();
        }
      } else if (nearCasino) {
        this.hud.setPrompt('Drücke [G] oder [🎰 CASINO] um das Casino zu betreten');
        if (this.input.actionInteract) {
          this.hud.toggleCasino(true);
        }
      } else if (distToBank < 6.0) {
        this.hud.setPrompt('Drücke [E] um den GROSSEN BANKRAUB zu starten 🏦');
        if (this.input.actionInteract) {
          this.heist.startHeist();
        }
      } else {
        this.hud.setPrompt(null);
      }
    }

    // 4. Update Subsystems
    this.weapons.update(dt);
    this.missions.update(dt, playerPos.x, playerPos.z, this.mode === 'IN_CAR');
    this.gangs.update(dt, playerPos.x, playerPos.z, this.mode === 'IN_CAR');
    if (this.mode === 'IN_CAR') {
      this.gangs.checkPlayerCarRamming(
        this.car.physics.x,
        this.car.physics.z,
        this.car.physics.speed,
      );
    }
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

    // Phases 13-20 Subsystem Updates
    const milResult = this.military.update(dt, playerPos.x, playerPos.z);
    if (milResult.triggerArea77Alarm) {
      this.police.setWantedLevel(6);
    }
    this.water.update(dt, playerPos.x, playerPos.z);
    this.train.update(dt);
    this.heist.update(dt, playerPos.x, playerPos.z, this.mode === 'IN_CAR');

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
          heading:
            this.mode === 'IN_CAR'
              ? this.car.physics.heading
              : this.mode === 'IN_HELI'
                ? this.helicopter.heading
                : this.mode === 'IN_TANK' && this.activeTank
                  ? this.activeTank.heading
                  : this.mode === 'IN_BOAT' && this.activeBoat
                    ? this.activeBoat.heading
                    : this.player.rotationY,
          speed:
            this.mode === 'IN_CAR'
              ? this.car.physics.speed
              : this.mode === 'IN_HELI'
                ? this.helicopter.getSpeedKmh() / 3.6
                : this.mode === 'IN_TANK' && this.activeTank
                  ? this.activeTank.speed
                  : this.mode === 'IN_BOAT' && this.activeBoat
                    ? this.activeBoat.speed
                    : 0,
          mode: this.mode === 'ON_FOOT' ? 'ON_FOOT' : 'IN_CAR',
          carColor: 0xe62429,
          isBoosting: this.mode === 'IN_CAR' && this.car.physics.isBoosting,
          isDrifting: this.mode === 'IN_CAR' && this.car.physics.isDrifting,
          health: this.mode === 'IN_HELI' ? this.helicopter.health : this.car.health,
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
      this.mode === 'IN_CAR'
        ? this.car.physics.heading
        : this.mode === 'IN_HELI'
          ? this.helicopter.heading
          : this.mode === 'IN_TANK' && this.activeTank
            ? this.activeTank.heading
            : this.mode === 'IN_BOAT' && this.activeBoat
              ? this.activeBoat.heading
              : this.player.rotationY;
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

  private enterHelicopter(): void {
    this.mode = 'IN_HELI';
    this.player.group.visible = false;
    this.helicopter.isOccupied = true;
    this.hud.showNotification(
      '🚁 Im Helikopter! Steigen: [Leertaste] | Sinken: [Shift] | Lenken: [A]/[D]',
    );
  }

  private exitHelicopter(): void {
    this.mode = 'ON_FOOT';
    this.helicopter.isOccupied = false;
    const exitX = this.helicopter.x - Math.cos(this.helicopter.heading) * 2.5;
    const exitZ = this.helicopter.z + Math.sin(this.helicopter.heading) * 2.5;
    this.player.setPosition(exitX, this.helicopter.y, exitZ);
    this.player.group.visible = true;

    // High altitude cyber parachute bailout
    if (this.helicopter.y > 6.0) {
      this.player.vy = -3.5;
      this.hud.showNotification('🪂 Cyber-Fallschirm aktiviert! Sanfte Landung');
    } else {
      this.hud.showNotification('Aus dem Helikopter ausgestiegen.');
    }
  }

  private enterTank(): void {
    this.mode = 'IN_TANK';
    this.player.group.visible = false;
    this.activeTank = this.military.parkedTank;
    this.hud.showNotification(
      '🛡️ RHINO TANK ÜBERNOMMEN! Fahren: [W/A/S/D] | 120mm Kanone: [Klick]/[F] | Turm: [Q]/[E] | Aussteigen: [E]',
    );
  }

  private exitTank(): void {
    if (!this.activeTank) return;
    this.mode = 'ON_FOOT';
    const exitX = this.activeTank.x - Math.cos(this.activeTank.heading) * 3.5;
    const exitZ = this.activeTank.z + Math.sin(this.activeTank.heading) * 3.5;
    this.player.setPosition(exitX, 0, exitZ);
    this.player.group.visible = true;
    this.activeTank = null;
    this.hud.showNotification('Aus dem Rhino Tank ausgestiegen.');
  }

  private enterBoat(boat: Boat): void {
    this.mode = 'IN_BOAT';
    this.player.group.visible = false;
    this.activeBoat = boat;
    this.hud.showNotification(
      boat.isJetSki
        ? '🌊 AUF CYBER JET-SKI AUFGESTIEGEN! Gas: [W] | Lenken: [A/D] | Aussteigen: [E]'
        : '🚤 IM OFFSHORE SPEEDBOOT! Gas: [W] | Lenken: [A/D] | Aussteigen: [E]',
    );
  }

  private exitBoat(): void {
    if (!this.activeBoat) return;
    this.mode = 'ON_FOOT';
    const exitX = this.activeBoat.x + 3.0;
    const exitZ = this.activeBoat.z;
    this.player.setPosition(exitX, 0.4, exitZ);
    this.player.group.visible = true;
    this.activeBoat = null;
    this.hud.showNotification('Vom Boot ausgestiegen.');
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
