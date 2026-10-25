import * as THREE from 'three';
import { RACE_CIRCUIT, CITY_CONFIG, EVENTS } from '../utils/Constants';
import { eventBus } from '../utils/EventBus';
import { SoundManager } from '../audio/SoundManager';
import { EconomySystem } from '../economy/EconomySystem';

export interface RaceState {
  isActive: boolean;
  currentCheckpointIndex: number;
  totalCheckpoints: number;
  elapsedTime: number;
  timeLimit: number;
}

export interface TaxiPassengerState {
  isActive: boolean;
  hasPickedUp: boolean;
  passengerMesh: THREE.Group | null;
  pickupX: number;
  pickupZ: number;
  dropoffX: number;
  dropoffZ: number;
  fare: number;
  timeRemaining: number;
}

export class MissionSystem {
  public group: THREE.Group;
  private scene: THREE.Scene;
  private sound: SoundManager;
  private economy: EconomySystem;

  // Race properties
  public race: RaceState = {
    isActive: false,
    currentCheckpointIndex: 0,
    totalCheckpoints: RACE_CIRCUIT.length,
    elapsedTime: 0,
    timeLimit: 90,
  };

  private activeRingMesh: THREE.Mesh | null = null;
  private activeRingLight: THREE.PointLight | null = null;

  // Taxi properties
  public taxiMission: TaxiPassengerState = {
    isActive: false,
    hasPickedUp: false,
    passengerMesh: null,
    pickupX: 0,
    pickupZ: 0,
    dropoffX: 0,
    dropoffZ: 0,
    fare: 450,
    timeRemaining: 45,
  };
  private dropoffBeam: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene, sound: SoundManager, economy: EconomySystem) {
    this.scene = scene;
    this.sound = sound;
    this.economy = economy;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.buildRaceStartMarker();
  }

  private buildRaceStartMarker(): void {
    const startGroup = new THREE.Group();

    // Checkered Banner Arches
    const archGeo = new THREE.TorusGeometry(5.5, 0.4, 8, 24);
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x005577,
      roughness: 0.2,
    });
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.position.y = 5.0;
    startGroup.add(arch);

    // Glowing Hologram Text
    const signGeo = new THREE.BoxGeometry(6.0, 1.2, 0.3);
    const signMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.y = 9.5;
    startGroup.add(sign);

    const light = new THREE.PointLight(0x00d4ff, 4, 18);
    light.position.y = 5.0;
    startGroup.add(light);

    startGroup.position.set(CITY_CONFIG.RACE_START_X, 0, CITY_CONFIG.RACE_START_Z);
    this.group.add(startGroup);
  }

  public startRace(): void {
    this.race.isActive = true;
    this.race.currentCheckpointIndex = 0;
    this.race.elapsedTime = 0;
    this.race.timeLimit = 75;

    this.showCheckpointRing(0);
    this.sound.playCheckpointChime();
    eventBus.emit(EVENTS.NOTIFICATION, {
      text: '🏁 STRASSENRENNEN GESTARTET! Fahre durch die Neon-Ringe!',
    });
  }

  private showCheckpointRing(index: number): void {
    if (this.activeRingMesh) {
      this.group.remove(this.activeRingMesh);
      if (this.activeRingLight) this.group.remove(this.activeRingLight);
    }

    if (index >= RACE_CIRCUIT.length) return;

    const pt = RACE_CIRCUIT[index];
    const isFinish = index === RACE_CIRCUIT.length - 1;

    // Glowing Checkpoint Ring
    const ringGeo = new THREE.TorusGeometry(4.8, 0.35, 12, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: isFinish ? 0xffea00 : 0x00e5ff,
    });

    this.activeRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.activeRingMesh.position.set(pt.x, 4.0, pt.z);

    this.activeRingLight = new THREE.PointLight(isFinish ? 0xffea00 : 0x00e5ff, 5, 22);
    this.activeRingLight.position.set(pt.x, 4.0, pt.z);

    this.group.add(this.activeRingMesh, this.activeRingLight);
  }

  public startTaxiMission(): void {
    // Generate random pickup on sidewalk
    const pickupX = (Math.random() - 0.5) * 220;
    const pickupZ = (Math.random() - 0.5) * 220;

    // Generate random dropoff across town
    const dropoffX = (Math.random() - 0.5) * 220;
    const dropoffZ = (Math.random() - 0.5) * 220;

    this.taxiMission = {
      isActive: true,
      hasPickedUp: false,
      passengerMesh: this.createPassengerModel(pickupX, pickupZ),
      pickupX,
      pickupZ,
      dropoffX,
      dropoffZ,
      fare: 500,
      timeRemaining: 50,
    };

    eventBus.emit(EVENTS.NOTIFICATION, {
      text: '🚖 TAXI-AUFTRAG: Hole den Fahrgast an der Markierung ab!',
    });
  }

  private createPassengerModel(x: number, z: number): THREE.Group {
    const pGroup = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.9, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x0284c7 }),
    );
    body.position.y = 1.2;
    pGroup.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xfde047 }),
    );
    head.position.y = 1.9;
    pGroup.add(head);

    // Glowing Taxi Hologram Sign above head
    const icon = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.3, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x22c55e }),
    );
    icon.position.y = 2.4;
    pGroup.add(icon);

    pGroup.position.set(x, 0, z);
    this.group.add(pGroup);
    return pGroup;
  }

  public update(dt: number, carX: number, carZ: number, inCar: boolean): void {
    // Check if player reaches Street Race Start Line (when not in active race)
    if (!this.race.isActive && inCar) {
      const dToStart = Math.hypot(carX - CITY_CONFIG.RACE_START_X, carZ - CITY_CONFIG.RACE_START_Z);
      if (dToStart < 6.0) {
        this.startRace();
      }
    }

    // 1. Street Race Loop
    if (this.race.isActive) {
      this.race.elapsedTime += dt;

      // Animate active ring
      if (this.activeRingMesh) {
        this.activeRingMesh.rotation.y += 1.8 * dt;
        const pt = RACE_CIRCUIT[this.race.currentCheckpointIndex];
        const dist = Math.hypot(carX - pt.x, carZ - pt.z);

        if (dist < 6.5) {
          // Checkpoint cleared!
          this.sound.playCheckpointChime();
          this.race.currentCheckpointIndex += 1;

          if (this.race.currentCheckpointIndex >= RACE_CIRCUIT.length) {
            // Race Won!
            this.sound.playFanfare();
            const reward = 1500;
            this.economy.addCash(reward);
            this.race.isActive = false;

            if (this.activeRingMesh) this.group.remove(this.activeRingMesh);
            if (this.activeRingLight) this.group.remove(this.activeRingLight);

            eventBus.emit(EVENTS.NOTIFICATION, {
              text: `🏆 RENNEN GEWONNEN! Zeit: ${this.race.elapsedTime.toFixed(1)}s | Prämie: +$${reward}!`,
            });
          } else {
            this.showCheckpointRing(this.race.currentCheckpointIndex);
            eventBus.emit(EVENTS.NOTIFICATION, {
              text: `🏁 Checkpoint ${this.race.currentCheckpointIndex}/${RACE_CIRCUIT.length - 1} erreicht!`,
            });
          }
        }
      }
    }

    // 2. Taxi Mission Loop
    if (this.taxiMission.isActive) {
      this.taxiMission.timeRemaining -= dt;

      if (!this.taxiMission.hasPickedUp) {
        // Checking pickup
        const d = Math.hypot(carX - this.taxiMission.pickupX, carZ - this.taxiMission.pickupZ);
        if (d < 5.0 && inCar) {
          this.taxiMission.hasPickedUp = true;
          this.sound.playCheckpointChime();

          if (this.taxiMission.passengerMesh) {
            this.group.remove(this.taxiMission.passengerMesh);
          }

          // Create destination beam
          const beamGeo = new THREE.CylinderGeometry(0.8, 0.8, 40, 16);
          const beamMat = new THREE.MeshBasicMaterial({
            color: 0x22c55e,
            transparent: true,
            opacity: 0.6,
          });
          this.dropoffBeam = new THREE.Mesh(beamGeo, beamMat);
          this.dropoffBeam.position.set(this.taxiMission.dropoffX, 20, this.taxiMission.dropoffZ);
          this.group.add(this.dropoffBeam);

          eventBus.emit(EVENTS.NOTIFICATION, {
            text: '🚖 Fahrgast ist eingestiegen! Bringe ihn zum grünen Leuchtstrahl!',
          });
        }
      } else {
        // Checking dropoff
        const d = Math.hypot(carX - this.taxiMission.dropoffX, carZ - this.taxiMission.dropoffZ);
        if (d < 6.0 && inCar) {
          const reward = this.taxiMission.fare + Math.round(this.taxiMission.timeRemaining * 10);
          this.economy.addCash(reward);
          this.sound.playFanfare();

          if (this.dropoffBeam) {
            this.group.remove(this.dropoffBeam);
            this.dropoffBeam = null;
          }

          this.taxiMission.isActive = false;
          eventBus.emit(EVENTS.NOTIFICATION, {
            text: `💵 Fahrgast abgeliefert! Fahrpreis & Trinkgeld: +$${reward}!`,
          });
        }
      }

      if (this.taxiMission.timeRemaining <= 0) {
        if (this.dropoffBeam) {
          this.group.remove(this.dropoffBeam);
          this.dropoffBeam = null;
        }
        if (this.taxiMission.passengerMesh) {
          this.group.remove(this.taxiMission.passengerMesh);
        }
        this.taxiMission.isActive = false;
        eventBus.emit(EVENTS.NOTIFICATION, {
          text: '❌ Zeit abgelaufen! Der Fahrgast ist ausgestiegen.',
        });
      }
    }
  }

  public handleStuntJump(distance: number, airtime: number): void {
    const reward = distance * 10;
    this.economy.addCash(reward);
    this.sound.playFanfare();
    eventBus.emit(EVENTS.NOTIFICATION, {
      text: `✈️ FETTER STUNT-SPRUNG! Weite: ${distance}m | Airtime: ${airtime}s | Prämie: +$${reward}!`,
    });
  }
}
