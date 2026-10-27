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
import { PortalSystem } from '../world/PortalSystem';

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
  public portal: PortalSystem;

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
    this.portal = new PortalSystem(this.renderer.scene, this.economy, this.sound);

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

    // Immediate first render to ensure canvas is never black on initial load
    try {
      this.renderer.render();
    } catch {
      // Ignored
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.isRunning) {
          this.lastTime = performance.now();
          this.renderer.render();
        }
      });
    }

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
      if (this.mode === 'ON_FOOT') {
        this.player.setPosition(44, 0, 44);
        this.player.vy = 0;
        this.hud.showNotification('Sicher zur Kreuzung zurückgesetzt!');
      } else if (this.mode === 'IN_HELI') {
        this.helicopter.x = 44;
        this.helicopter.y = 0.5;
        this.helicopter.z = 44;
        this.helicopter.vx = 0;
        this.helicopter.vy = 0;
        this.helicopter.vz = 0;
        this.helicopter.heading = 0;
        this.helicopter.health = 100;
        this.helicopter.group.position.set(44, 0.5, 44);
        this.hud.showNotification('Helikopter repariert & zur Kreuzung zurückgesetzt!');
      } else if (this.mode === 'IN_TANK' && this.activeTank) {
        this.activeTank.x = 44;
        this.activeTank.y = 0;
        this.activeTank.z = 44;
        this.activeTank.speed = 0;
        this.activeTank.heading = 0;
        this.activeTank.health = 100;
        this.activeTank.group.position.set(44, 0, 44);
        this.hud.showNotification('Panzer repariert & zur Kreuzung zurückgesetzt!');
      } else if (this.mode === 'IN_BOAT' && this.activeBoat) {
        this.activeBoat.x = -170;
        this.activeBoat.y = 0;
        this.activeBoat.z = 0;
        this.activeBoat.speed = 0;
        this.activeBoat.heading = 0;
        this.activeBoat.group.position.set(-170, 0, 0);
        this.hud.showNotification('Boot repariert & zur Marina zurückgesetzt!');
      } else {
        this.car.physics.reset(44, 44, 0);
        this.car.repair();
        this.hud.showNotification('Auto repariert & zur Kreuzung zurückgesetzt!');
      }
    }
    if (this.input.toggleLights) {
      this.car.toggleHeadlights();
    }
    if (this.input.toggleMute) {
      const muted = this.sound.toggleMute();
      this.hud.updateMuteButton(muted);
      this.hud.showNotification(muted ? 'Ton stummgeschaltet 🔇' : 'Ton aktiviert 🔊');
    }
    if (this.input.cycleRadio) {
      const station = this.radio.cycleStation();
      this.hud.showRadioStation(station.name, station.genre);
    }
    const inVehicle =
      this.mode === 'IN_CAR' ||
      this.mode === 'IN_HELI' ||
      this.mode === 'IN_TANK' ||
      this.mode === 'IN_BOAT';
    this.radio.update(dt, inVehicle);
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
      // DeLorean Hover Mode toggle trigger
      const wasHover = this.car.physics.isHoverMode;
      const hoverToggled = this.input.hoverToggle;

      // Update dynamic surface elevation below vehicle (rooftop, street ground, or Otherworld floating platforms)
      if (this.portal.currentDimension === 'OTHER_WORLD') {
        const elev = this.portal.getOtherWorldElevation(this.car.physics.x, this.car.physics.z);
        if (elev.onPlatform) {
          this.car.physics.groundY = elev.height + 0.5;
          if (this.car.physics.y < elev.height + 0.5) {
            this.car.physics.y = elev.height + 0.5;
            this.car.physics.vy = Math.max(0, this.car.physics.vy);
          }
          if (elev.isBoostPad && Math.abs(this.car.physics.speed) > 2.0) {
            this.car.physics.speed = Math.min(68.0, this.car.physics.speed + 35.0 * dt);
            this.car.physics.nitro = 100;
          }
        } else {
          this.car.physics.groundY = -999;
        }
      } else {
        const roofH = this.city.getRoofHeightAt(this.car.physics.x, this.car.physics.z, 0);
        if (roofH > 0 && (this.car.physics.y >= roofH - 0.8 || this.car.physics.groundY >= roofH)) {
          this.car.physics.groundY = roofH + 0.5;
          // Anti-tunneling: if vehicle dropped slightly below roof surface, clamp up to roof surface
          if (this.car.physics.y < roofH + 0.5) {
            this.car.physics.y = roofH + 0.5;
            this.car.physics.vy = Math.max(0, this.car.physics.vy);
          }
        } else {
          this.car.physics.groundY = 0.5;
        }
      }

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

      // Car Collision with Buildings (Continuous Anti-Tunneling Swept Collision in 3D)
      const col = this.city.checkSweptCollision(
        this.car.physics.prevX,
        this.car.physics.prevZ,
        this.car.physics.x,
        this.car.physics.z,
        2.0,
        this.car.physics.y,
      );
      if (col.collided) {
        const currentSpeed = this.car.physics.speed;
        const isForward = currentSpeed >= 0;
        const absSpeed = Math.abs(currentSpeed);

        if (absSpeed > 4.0 && this.crashCooldown <= 0) {
          // More forgiving crash damage so cars can take many hits
          const dmg = Math.max(2, Math.round(absSpeed * 0.45));
          this.car.takeDamage(dmg);
          this.sound.playCrash(Math.min(30, Math.round(absSpeed)));
          this.police.addCrimeSeverity(dmg);
          this.input.triggerRumble(0.6, 180);
          this.input.triggerHaptics(50);
          this.crashCooldown = 0.25;
        }

        // Anti-stuck position resolution: safeX/safeZ guarantees clean exterior placement
        this.car.physics.x = col.safeX;
        this.car.physics.z = col.safeZ;
        this.car.physics.prevX = col.safeX;
        this.car.physics.prevZ = col.safeZ;

        // In flight mode, dampen vertical velocity on wall impact
        if (this.car.physics.isHoverMode) {
          this.car.physics.vy *= 0.3;
        }

        // Tangential wall sliding & smooth deceleration (no negative reverse stutter)
        const forwardX = Math.sin(this.car.physics.heading);
        const forwardZ = Math.cos(this.car.physics.heading);
        const moveX = isForward ? forwardX : -forwardX;
        const moveZ = isForward ? forwardZ : -forwardZ;
        const dot = moveX * col.normalX + moveZ * col.normalZ;

        if (dot < 0) {
          // Impact heading towards the wall
          if (dot < -0.75) {
            // Direct head-on collision: clean stop with zero velocity (no backwards recoil loop)
            this.car.physics.speed = 0;
          } else {
            // Glancing blow: slide along the wall with friction
            const slideFraction = Math.sqrt(Math.max(0, 1 - dot * dot));
            const tangentialSpeed = absSpeed * slideFraction * 0.82;
            this.car.physics.speed = isForward ? tangentialSpeed : -tangentialSpeed;

            // Gently align heading along the wall tangent
            const tangentX = moveX - dot * col.normalX;
            const tangentZ = moveZ - dot * col.normalZ;
            const tanLen = Math.hypot(tangentX, tangentZ);
            if (tanLen > 0.001) {
              const targetHeading = Math.atan2(
                isForward ? tangentX : -tangentX,
                isForward ? tangentZ : -tangentZ,
              );
              let diff = targetHeading - this.car.physics.heading;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              this.car.physics.heading += diff * 0.25;
            }
          }
        }
      }

      // Bulletproof failsafe: Ensure car is never inside any building geometry
      const carFix = this.city.resolveBuildingIntersection(
        this.car.physics.x,
        this.car.physics.z,
        2.0,
        this.car.physics.y,
      );
      if (carFix.corrected) {
        this.car.physics.x = carFix.x;
        this.car.physics.z = carFix.z;
        this.car.physics.prevX = carFix.x;
        this.car.physics.prevZ = carFix.z;
        if (carFix.roofY !== undefined) {
          this.car.physics.y = carFix.roofY + 0.5;
          this.car.physics.vy = 0;
        }
      }

      // Collision with Traffic Cars
      for (const tCar of this.traffic.cars) {
        if (this.car.physics.isAirborne || this.car.physics.y > 1.8) continue;
        const dx = this.car.physics.x - tCar.x;
        const dz = this.car.physics.z - tCar.z;
        const d = Math.hypot(dx, dz);
        const minDist = 3.2;
        if (d < minDist) {
          const overlap = minDist - d;
          const nx = d > 0.001 ? dx / d : 1;
          const nz = d > 0.001 ? dz / d : 0;

          // Resolve overlap in a single frame to eliminate multi-frame hitching & freeze
          const playerPush = overlap * 0.55 + 0.08;
          const trafficPush = overlap * 0.45 + 0.08;

          this.car.physics.x += nx * playerPush;
          this.car.physics.z += nz * playerPush;
          const trSafe = this.city.resolveBuildingIntersection(
            this.car.physics.x,
            this.car.physics.z,
            2.0,
            this.car.physics.y,
          );
          this.car.physics.x = trSafe.x;
          this.car.physics.z = trSafe.z;
          this.car.physics.prevX = this.car.physics.x;
          this.car.physics.prevZ = this.car.physics.z;

          tCar.x -= nx * trafficPush;
          tCar.z -= nz * trafficPush;

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

            // Single impulse on impact
            this.car.physics.speed *= 0.75;
            tCar.speed = Math.max(0, tCar.speed * 0.4);
          } else {
            // Low speed nudge
            this.car.physics.speed *= 0.94;
          }
        }
      }

      // Police Cruisers Ramming Player Car
      for (const cop of this.police.copCars) {
        // Vertical 3D altitude check: ground police cruisers cannot ram airborne / jumping / hovering cars
        const copY = cop.y ?? 0;
        const dy = Math.abs(this.car.physics.y - copY);
        const isAirborne =
          this.car.physics.isAirborne ||
          this.car.physics.isHoverMode ||
          this.car.physics.y > this.car.physics.groundY + 0.8;

        if (dy > 1.8 || (isAirborne && dy > 1.2)) {
          // Cop cruiser passes underneath cleanly while player car is in the air!
          continue;
        }

        const dx = this.car.physics.x - cop.x;
        const dz = this.car.physics.z - cop.z;
        const d = Math.hypot(dx, dz);
        const minDist = 3.4;
        if (d < minDist) {
          const overlap = minDist - d;
          const nx = d > 0.001 ? dx / d : 1;
          const nz = d > 0.001 ? dz / d : 0;

          // Physical separation: resolve overlap with swept collision to prevent pushing through walls or out of map
          const playerPush = overlap * 0.55 + 0.08;
          const copPush = overlap * 0.45 + 0.08;

          const targetX = this.car.physics.x + nx * playerPush;
          const targetZ = this.car.physics.z + nz * playerPush;
          const swept = this.city.checkSweptCollision(
            this.car.physics.x,
            this.car.physics.z,
            targetX,
            targetZ,
            2.0,
            this.car.physics.y,
          );

          if (swept.collided) {
            // Player car is pinned against a solid wall or map boundary: stay on the exterior
            this.car.physics.x = swept.safeX;
            this.car.physics.z = swept.safeZ;
            // Cop car absorbs the rebound instead of driving the player through geometry
            cop.x -= nx * (copPush + playerPush * 1.2);
            cop.z -= nz * (copPush + playerPush * 1.2);
            cop.speed *= 0.2;
          } else {
            this.car.physics.x = targetX;
            this.car.physics.z = targetZ;
            cop.x -= nx * copPush;
            cop.z -= nz * copPush;
          }

          const copSafe = this.city.resolveBuildingIntersection(
            this.car.physics.x,
            this.car.physics.z,
            2.0,
            this.car.physics.y,
          );
          this.car.physics.x = copSafe.x;
          this.car.physics.z = copSafe.z;
          this.car.physics.prevX = this.car.physics.x;
          this.car.physics.prevZ = this.car.physics.z;

          // Keep cop car strictly within playable map boundaries
          cop.x = Math.max(-410, Math.min(380, cop.x));
          cop.z = Math.max(-380, Math.min(380, cop.z));

          const impactSpeed = Math.abs(this.car.physics.speed) + Math.abs(cop.speed);
          if (impactSpeed > 3.0 && this.crashCooldown <= 0) {
            this.sound.playCrash(22);
            const dmg = Math.max(2, Math.round(cop.speed * 0.35));
            this.car.takeDamage(dmg);
            this.hud.showNotification('🚨 Die Polizei rammt dich! Bleib stehen!');
            this.input.triggerRumble(0.65, 200);
            this.input.triggerHaptics(50);
            this.crashCooldown = 0.3;

            // Physical ram impulse: fling car and fishtail
            const ramAngle = Math.atan2(this.car.physics.x - cop.x, this.car.physics.z - cop.z);
            const ramKick = Math.min(4.0, Math.max(1.5, Math.abs(cop.speed) * 0.35));
            this.car.physics.x += Math.sin(ramAngle) * ramKick;
            this.car.physics.z += Math.cos(ramAngle) * ramKick;
            const kickSafe = this.city.resolveBuildingIntersection(
              this.car.physics.x,
              this.car.physics.z,
              2.0,
              this.car.physics.y,
            );
            this.car.physics.x = kickSafe.x;
            this.car.physics.z = kickSafe.z;
            this.car.physics.prevX = this.car.physics.x;
            this.car.physics.prevZ = this.car.physics.z;
            this.car.physics.heading += (Math.random() - 0.5) * 0.45;

            // High speed ram: damp speed once cleanly
            this.car.physics.speed *= 0.82;
            cop.speed *= 0.5;
          } else {
            // Low-speed rubbing
            this.car.physics.speed *= 0.96;
            cop.speed *= 0.85;
          }
        }
      }

      // Multiplayer Ramming: Local Car vs Remote Buddy Car
      if (this.network.isConnected && this.remotePlayer.mode === 'IN_CAR') {
        const dx = this.car.physics.x - this.remotePlayer.targetX;
        const dz = this.car.physics.z - this.remotePlayer.targetZ;
        const distToBuddy = Math.hypot(dx, dz);
        const minDist = 3.2;
        if (distToBuddy < minDist) {
          const overlap = minDist - distToBuddy;
          const nx = distToBuddy > 0.001 ? dx / distToBuddy : 1;
          const nz = distToBuddy > 0.001 ? dz / distToBuddy : 0;

          this.car.physics.x += nx * (overlap * 0.55 + 0.08);
          this.car.physics.z += nz * (overlap * 0.55 + 0.08);
          const buddySafe = this.city.resolveBuildingIntersection(
            this.car.physics.x,
            this.car.physics.z,
            2.0,
            this.car.physics.y,
          );
          this.car.physics.x = buddySafe.x;
          this.car.physics.z = buddySafe.z;
          this.car.physics.prevX = this.car.physics.x;
          this.car.physics.prevZ = this.car.physics.z;

          const impact = Math.abs(this.car.physics.speed) + Math.abs(this.remotePlayer.speed);
          if (impact > 4.0 && this.crashCooldown <= 0) {
            this.sound.playCrash();
            const dmg = Math.round(impact * 1.3);
            this.car.takeDamage(dmg);
            this.crashCooldown = 0.3;

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
        // Vertical check: pedestrians are on sidewalks/roads (ped.y ≈ 0.25); ignore if car is airborne
        if (Math.abs(this.car.physics.y - ped.y) > 1.8) continue;
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
          this.car.physics.y,
        )
      ) {
        this.sound.playCrash();
        this.car.takeDamage(12);
        this.police.addCrimeSeverity(30);
        this.hud.showNotification('💥 Straßensperre der Polizei durchbrochen!');
      }

      // Police Spike Strip collisions
      if (
        this.police.checkSpikeStripCollision(
          this.car.physics.x,
          this.car.physics.z,
          this.car.physics.y,
        )
      ) {
        this.sound.playCrash(22);
        this.car.physics.blowTires();
      }

      // Police Tactical PIT Maneuver (only applies when car is on ground)
      const isCarAirborne =
        this.car.physics.isAirborne ||
        this.car.physics.isHoverMode ||
        this.car.physics.y > this.car.physics.groundY + 0.8;
      const pit = this.police.checkPitManeuver(
        this.car.physics.x,
        this.car.physics.z,
        this.car.physics.heading,
        this.car.physics.speed,
        this.car.physics.y,
        isCarAirborne,
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
        const trainSafe = this.city.resolveBuildingIntersection(
          this.car.physics.x,
          this.car.physics.z,
          2.0,
          this.car.physics.y,
        );
        this.car.physics.x = trainSafe.x;
        this.car.physics.z = trainSafe.z;
        this.car.physics.prevX = this.car.physics.x;
        this.car.physics.prevZ = this.car.physics.z;
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
      if (this.portal.currentDimension === 'OTHER_WORLD') {
        if (
          this.car.physics.y < 350 ||
          Math.abs(this.car.physics.x - 2500) > 450 ||
          Math.abs(this.car.physics.z - 2500) > 450
        ) {
          this.car.physics.reset(2500, 2500, 0);
          this.car.physics.y = 402;
          this.car.physics.groundY = 400.5;
          this.car.physics.speed = 0;
          this.hud.showNotification('🌌 Vom kosmischen Portal gerettet!');
        }
      } else if (
        this.car.physics.y < -8.0 ||
        this.car.physics.x > 410 ||
        this.car.physics.x < -450 ||
        Math.abs(this.car.physics.z) > 410
      ) {
        // Void & Out-of-bounds auto-rescue
        this.car.physics.reset(44, 44, 0);
        this.car.repair();
        this.hud.showNotification('⚓ Notfall-Bergung: Auto auf die Straße zurückgesetzt!');
      } else if (this.car.physics.y < -0.8) {
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
      if (this.helicopter.hasCollided && this.crashCooldown <= 0) {
        this.sound.playCrash(18);
        this.input.triggerRumble(0.5, 120);
        this.input.triggerHaptics(40);
        this.crashCooldown = 0.3;
      }
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
        (this.helicopter.y <= 0.6 || Math.abs(this.helicopter.vy) < 0.6 || this.helicopter.isLanded)
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

      // Tank Building Collision Check & Anti-Penetration Resolution
      const tankFix = this.city.resolveBuildingIntersection(
        this.activeTank.x,
        this.activeTank.z,
        2.5,
        this.activeTank.y,
      );
      if (tankFix.corrected) {
        this.activeTank.x = tankFix.x;
        this.activeTank.z = tankFix.z;
        this.activeTank.speed = 0;
        this.activeTank.group.position.set(this.activeTank.x, this.activeTank.y, this.activeTank.z);
      }

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
        // Vertical 3D altitude check: ground police cruisers cannot hit player in the air (jetpack, jump, roof)
        const copY = cop.y ?? 0;
        const dy = this.player.y - copY;
        const isAirborne =
          this.player.y > 1.6 ||
          this.player.vy > 1.0 ||
          (this.player.hasJetpack && this.player.y > 1.0);

        if (dy > 1.5 || (isAirborne && dy > 1.0)) {
          // Cop cruiser passes underneath cleanly while player is airborne / flying / on roof!
          continue;
        }

        const d = Math.hypot(this.player.x - cop.x, this.player.z - cop.z);
        if (d < 2.5 && Math.abs(cop.speed) > 3.0 && this.crashCooldown <= 0) {
          this.sound.playPedestrianHit();
          this.player.takeDamage(20);
          this.police.addCrimeSeverity(30);
          this.hud.showNotification('🚨 Von Polizeiwagen angefahren!');
          this.input.triggerRumble(0.7, 200);
          this.input.triggerHaptics(60);
          this.crashCooldown = 0.5;

          // Controlled knockback: ensure player cannot be launched through walls or off map
          const pushAngle = Math.atan2(this.player.x - cop.x, this.player.z - cop.z);
          const flingForce = Math.max(9.0, Math.abs(cop.speed) * 0.9);
          const pushDist = Math.min(3.5, flingForce * 0.28);
          const targetX = this.player.x + Math.sin(pushAngle) * pushDist;
          const targetZ = this.player.z + Math.cos(pushAngle) * pushDist;

          const swept = this.city.checkSweptCollision(
            this.player.x,
            this.player.z,
            targetX,
            targetZ,
            0.4,
            this.player.y,
          );
          if (swept.collided) {
            this.player.x = swept.safeX;
            this.player.z = swept.safeZ;
          } else {
            this.player.x = targetX;
            this.player.z = targetZ;
          }
          this.player.vy = 3.5; // Controlled vertical hop instead of catapulting into stratosphere

          const flingSafe = this.city.resolveBuildingIntersection(
            this.player.x,
            this.player.z,
            0.4,
            this.player.y,
          );
          this.player.x = flingSafe.x;
          this.player.z = flingSafe.z;
          this.player.setPosition(this.player.x, this.player.y, this.player.z);
        }
      }

      // Void & Out-of-bounds auto-rescue for player on foot
      if (this.portal.currentDimension === 'OTHER_WORLD') {
        const elev = this.portal.getOtherWorldElevation(this.player.x, this.player.z);
        if (elev.onPlatform) {
          if (this.player.y < elev.height) {
            this.player.y = elev.height;
            this.player.vy = 0;
            this.player.setPosition(this.player.x, this.player.y, this.player.z);
          }
        }
        if (
          this.player.y < 350 ||
          Math.abs(this.player.x - 2500) > 450 ||
          Math.abs(this.player.z - 2500) > 450
        ) {
          this.player.setPosition(2500, 401.5, 2500);
          this.player.vy = 0;
          this.hud.showNotification('🌌 Vom kosmischen Portal gerettet!');
        }
      } else if (
        this.player.y < -1.5 ||
        this.player.x > 410 ||
        this.player.x < -450 ||
        Math.abs(this.player.z) > 410
      ) {
        this.player.setPosition(44, 0.25, 44);
        this.player.vy = 0;
        this.hud.showNotification('⚓ Notfall-Bergung: Spieler auf den Gehweg zurückgesetzt!');
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
        this.car.physics.y,
      );
    }
    this.traffic.update(dt, playerPos.x, playerPos.z);
    this.pedestrians.update(
      dt,
      playerPos.x,
      playerPos.z,
      this.mode === 'IN_CAR' ? this.car.physics.speed : 0,
      this.city,
    );
    this.police.update(dt, playerPos.x, playerPos.z, playerPos.y);
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

    // Update Portal System & Check Interdimensional Warp
    this.portal.update(dt);
    const warpCheck = this.portal.checkPortalTransition(playerPos.x, playerPos.y, playerPos.z);
    if (warpCheck.shouldWarp) {
      this.portal.warpCooldown = 3.5;
      this.portal.currentDimension = warpCheck.targetDimension;
      this.sound.playCheckpointChime();

      if (this.mode === 'IN_CAR') {
        this.car.physics.x = warpCheck.targetPos.x;
        this.car.physics.z = warpCheck.targetPos.z;
        this.car.physics.y = warpCheck.targetPos.y;
        this.car.physics.prevX = warpCheck.targetPos.x;
        this.car.physics.prevZ = warpCheck.targetPos.z;
        this.car.physics.groundY = warpCheck.targetDimension === 'OTHER_WORLD' ? 400.5 : 0.5;
        this.car.physics.speed *= 0.5;
      } else if (this.mode === 'IN_TANK' && this.activeTank) {
        this.activeTank.x = warpCheck.targetPos.x;
        this.activeTank.z = warpCheck.targetPos.z;
        this.activeTank.y = warpCheck.targetPos.y;
        this.activeTank.group.position.set(
          warpCheck.targetPos.x,
          warpCheck.targetPos.y,
          warpCheck.targetPos.z,
        );
      } else {
        this.player.setPosition(
          warpCheck.targetPos.x,
          warpCheck.targetPos.y,
          warpCheck.targetPos.z,
        );
        this.player.vy = 0;
      }

      this.renderer.setDimension(warpCheck.targetDimension);

      if (warpCheck.targetDimension === 'OTHER_WORLD') {
        this.hud.showNotification('🌌 DIMENSIONSSPRUNG: Willkommen in der Anderen Welt!');
        this.hud.setPrompt('🌀 Sammle die 7 Dragon Balls & rase über den Schlangenpfad!');
      } else {
        this.hud.showNotification('🏙️ Rückkehr in die GTA 7 Cyber City!');
      }
    }

    // Check Dragon Ball collection in Other World
    if (this.portal.currentDimension === 'OTHER_WORLD') {
      const ballRes = this.portal.checkBallCollection(playerPos.x, playerPos.y, playerPos.z);
      if (ballRes.collected) {
        this.sound.playFanfare();
        this.economy.addCash(15000);
        this.car.physics.nitro = 100;
        this.hud.showNotification(
          `🐉 Dragon Ball #${ballRes.ballId} gesammelt! (${this.portal.collectedBallsCount}/7) +15.000$`,
        );

        if (ballRes.allCollected) {
          this.sound.playFanfare();
          this.economy.addCash(100000);
          this.car.repair();
          this.hud.showNotification('🐉 SHENLONG BESCHWOREN! +100.000$ & SUPER SAIYAJIN POWER!');
        }
      }
    }

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

    // =========================================================================
    // Bulletproof Auto-Rescue Watchdog: Prevent falling into void or out-of-bounds lock
    // =========================================================================
    // 1. DeLorean Car Watchdog
    if (
      this.car.physics.y < -12.0 ||
      Math.abs(this.car.physics.x) > 380 ||
      Math.abs(this.car.physics.z) > 380 ||
      Number.isNaN(this.car.physics.x) ||
      Number.isNaN(this.car.physics.z)
    ) {
      this.car.physics.reset(44, 44, 0);
      this.car.repair();
      this.hud.showNotification(
        '⚓ Notfall-Bergung: DeLorean sicher auf die Straße zurückgesetzt!',
      );
    }

    // 2. Player on Foot Watchdog
    if (
      this.player.y < -12.0 ||
      Math.abs(this.player.x) > 380 ||
      Math.abs(this.player.z) > 380 ||
      Number.isNaN(this.player.x) ||
      Number.isNaN(this.player.z)
    ) {
      this.player.setPosition(44, 0, 44);
      this.player.vy = 0;
      this.hud.showNotification('⚓ Notfall-Bergung: Spieler sicher auf die Straße zurückgesetzt!');
    }

    // 3. Helicopter Watchdog
    if (
      this.helicopter.y < -12.0 ||
      Math.abs(this.helicopter.x) > 480 ||
      Math.abs(this.helicopter.z) > 480 ||
      Number.isNaN(this.helicopter.x) ||
      Number.isNaN(this.helicopter.z)
    ) {
      this.helicopter.x = 44;
      this.helicopter.y = 0.5;
      this.helicopter.z = 44;
      this.helicopter.vx = 0;
      this.helicopter.vy = 0;
      this.helicopter.vz = 0;
      this.helicopter.heading = 0;
      this.helicopter.group.position.set(44, 0.5, 44);
    }

    // 4. Rhino Tank Watchdog
    if (this.activeTank) {
      if (
        this.activeTank.y < -12.0 ||
        Math.abs(this.activeTank.x) > 380 ||
        Math.abs(this.activeTank.z) > 380 ||
        Number.isNaN(this.activeTank.x) ||
        Number.isNaN(this.activeTank.z)
      ) {
        this.activeTank.x = 44;
        this.activeTank.y = 0;
        this.activeTank.z = 44;
        this.activeTank.speed = 0;
        this.activeTank.heading = 0;
        this.activeTank.group.position.set(44, 0, 44);
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
    let exitX = this.helicopter.x - Math.cos(this.helicopter.heading) * 2.5;
    let exitZ = this.helicopter.z + Math.sin(this.helicopter.heading) * 2.5;
    let exitY = this.helicopter.y;

    const heliCheck = this.city.resolveBuildingIntersection(exitX, exitZ, 0.4, exitY);
    if (heliCheck.corrected) {
      exitX = heliCheck.x;
      exitZ = heliCheck.z;
    }

    const roofH = this.city.getRoofHeightAt(exitX, exitZ, 0);
    if (roofH > 0 && exitY >= roofH - 1.0) {
      exitY = roofH;
    }

    this.player.setPosition(exitX, exitY, exitZ);
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
    let exitX = this.activeTank.x - Math.cos(this.activeTank.heading) * 3.5;
    let exitZ = this.activeTank.z + Math.sin(this.activeTank.heading) * 3.5;
    let exitY = this.activeTank.y;

    const tankCheck = this.city.resolveBuildingIntersection(exitX, exitZ, 0.4, exitY);
    if (tankCheck.corrected) {
      exitX = tankCheck.x;
      exitZ = tankCheck.z;
    }

    const roofH = this.city.getRoofHeightAt(exitX, exitZ, 0);
    exitY = roofH > 0 && exitY >= roofH - 1.0 ? roofH : 0;

    this.player.setPosition(exitX, exitY, exitZ);
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
    let exitX = this.car.physics.x - Math.cos(this.car.physics.heading) * 2.2;
    let exitZ = this.car.physics.z + Math.sin(this.car.physics.heading) * 2.2;
    let exitY = this.car.physics.y;

    // Check if driver side is obstructed by building
    const driverCheck = this.city.resolveBuildingIntersection(exitX, exitZ, 0.4, exitY);
    if (driverCheck.corrected) {
      // Driver side blocked, try passenger side
      const passX = this.car.physics.x + Math.cos(this.car.physics.heading) * 2.2;
      const passZ = this.car.physics.z - Math.sin(this.car.physics.heading) * 2.2;
      const passCheck = this.city.resolveBuildingIntersection(passX, passZ, 0.4, exitY);
      if (!passCheck.corrected) {
        exitX = passX;
        exitZ = passZ;
      } else {
        exitX = driverCheck.x;
        exitZ = driverCheck.z;
      }
    }

    // Determine correct Y elevation: if on roof, stand on roof; else ground
    const roofH = this.city.getRoofHeightAt(exitX, exitZ, 0);
    if (roofH > 0 && (exitY >= roofH - 1.0 || this.car.physics.groundY >= roofH)) {
      exitY = roofH;
    } else {
      exitY = 0;
    }

    this.player.setPosition(exitX, exitY, exitZ);
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
