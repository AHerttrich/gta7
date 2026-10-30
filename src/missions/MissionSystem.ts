import * as THREE from 'three';
import { RACE_CIRCUIT, CITY_CONFIG, EVENTS } from '../utils/Constants';
import { eventBus } from '../utils/EventBus';
import { SoundManager } from '../audio/SoundManager';
import { EconomySystem } from '../economy/EconomySystem';
import { City } from '../city/City';
import { disposeObject3D } from '../utils/disposeObject';
import { RivalRacer } from './RivalRacer';

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
  private city: City | null = null;
  public raceCooldown: number = 0;

  // Race properties
  public race: RaceState = {
    isActive: false,
    currentCheckpointIndex: 0,
    totalCheckpoints: RACE_CIRCUIT.length,
    elapsedTime: 0,
    timeLimit: 120,
  };

  public rivals: RivalRacer[] = [];
  public playerPosition: number = 1;

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

  constructor(scene: THREE.Scene, sound: SoundManager, economy: EconomySystem, city?: City) {
    this.scene = scene;
    this.sound = sound;
    this.economy = economy;
    this.city = city || null;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.buildRaceStartMarker();
  }

  public setCity(city: City): void {
    this.city = city;
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

    startGroup.position.set(CITY_CONFIG.RACE_START_X, 0, CITY_CONFIG.RACE_START_Z);
    this.group.add(startGroup);
  }

  public startRace(): void {
    this.cleanupRivals();

    this.race.isActive = true;
    this.race.currentCheckpointIndex = 0;
    this.race.elapsedTime = 0;
    this.race.timeLimit = 120;

    const startX = CITY_CONFIG.RACE_START_X;
    const startZ = CITY_CONFIG.RACE_START_Z;

    // Spawn 2 rival sports cars at the starting grid
    const viper = new RivalRacer(
      this.scene,
      {
        id: 'viper',
        name: '🔥 Cyber Viper',
        bodyColor: 0xef4444,
        stripeColor: 0xf97316,
        neonColor: 0xff3b30,
        baseSpeed: 38.0,
        turnSpeed: 3.4,
      },
      startX - 4.5,
      startZ - 3.5,
      0,
    );

    const phantom = new RivalRacer(
      this.scene,
      {
        id: 'phantom',
        name: '⚡ Neon Phantom',
        bodyColor: 0x8b5cf6,
        stripeColor: 0x00f0ff,
        neonColor: 0xa855f7,
        baseSpeed: 36.5,
        turnSpeed: 3.8,
      },
      startX + 4.5,
      startZ - 3.5,
      0,
    );

    this.rivals.push(viper, phantom);
    this.playerPosition = 1;

    this.showCheckpointRing(0);
    this.sound.playCheckpointChime();
    eventBus.emit(EVENTS.NOTIFICATION, {
      text: '🏁 STRASSENRENNEN GESTARTET! Besiege Cyber Viper & Neon Phantom!',
    });
  }

  public cleanupRivals(): void {
    for (const rival of this.rivals) {
      rival.dispose(this.scene);
    }
    this.rivals = [];
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

    this.group.add(this.activeRingMesh);
  }

  public startTaxiMission(): void {
    if (this.taxiMission.passengerMesh) {
      this.group.remove(this.taxiMission.passengerMesh);
      disposeObject3D(this.taxiMission.passengerMesh);
      this.taxiMission.passengerMesh = null;
    }
    if (this.dropoffBeam) {
      this.group.remove(this.dropoffBeam);
      disposeObject3D(this.dropoffBeam);
      this.dropoffBeam = null;
    }

    // Generate random pickup on sidewalk/street outside buildings
    let pickupX = (Math.random() - 0.5) * 220;
    let pickupZ = (Math.random() - 0.5) * 220;
    if (this.city) {
      const fixed = this.city.resolveBuildingIntersection(pickupX, pickupZ, 1.0, 1.0);
      if (fixed.corrected) {
        pickupX = fixed.x;
        pickupZ = fixed.z;
      }
    }

    // Generate random dropoff across town outside buildings
    let dropoffX = (Math.random() - 0.5) * 220;
    let dropoffZ = (Math.random() - 0.5) * 220;
    if (this.city) {
      const fixed = this.city.resolveBuildingIntersection(dropoffX, dropoffZ, 1.0, 1.0);
      if (fixed.corrected) {
        dropoffX = fixed.x;
        dropoffZ = fixed.z;
      }
    }

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

  public update(dt: number, carX: number, carZ: number, inCar: boolean, carY: number = 0): void {
    this.raceCooldown = Math.max(0, this.raceCooldown - dt);

    // Check if player reaches Street Race Start Line (when not in active race)
    if (!this.race.isActive && inCar && this.raceCooldown <= 0) {
      const dToStart = Math.hypot(carX - CITY_CONFIG.RACE_START_X, carZ - CITY_CONFIG.RACE_START_Z);
      if (dToStart < 6.0 && carY < 8.0) {
        this.startRace();
      }
    }

    // 1. Street Race Loop
    if (this.race.isActive) {
      this.race.elapsedTime += dt;

      // Softlock prevention: 120s time limit
      if (this.race.elapsedTime > this.race.timeLimit) {
        this.race.isActive = false;
        this.raceCooldown = 8.0;
        if (this.activeRingMesh) {
          this.group.remove(this.activeRingMesh);
          disposeObject3D(this.activeRingMesh);
          this.activeRingMesh = null;
        }
        if (this.activeRingLight) {
          this.group.remove(this.activeRingLight);
          this.activeRingLight = null;
        }
        this.cleanupRivals();
        eventBus.emit(EVENTS.NOTIFICATION, {
          text: '❌ Zeit abgelaufen (120s)! Straßenrennen abgebrochen.',
        });
        return;
      }

      // Calculate player progress along the circuit
      const targetPt = RACE_CIRCUIT[this.race.currentCheckpointIndex];
      const prevPt =
        this.race.currentCheckpointIndex === 0
          ? { x: CITY_CONFIG.RACE_START_X, z: CITY_CONFIG.RACE_START_Z - 10 }
          : RACE_CIRCUIT[this.race.currentCheckpointIndex - 1];

      const segLen = Math.hypot(targetPt.x - prevPt.x, targetPt.z - prevPt.z) || 1;
      const distToTarget = Math.hypot(targetPt.x - carX, targetPt.z - carZ);
      const playerSubProgress = Math.max(0, Math.min(1, 1 - distToTarget / segLen));
      const playerProgress = this.race.currentCheckpointIndex + playerSubProgress;

      // Update AI Rivals
      for (const rival of this.rivals) {
        rival.update(dt, playerProgress, this.race.elapsedTime);

        // Collision check between player and rival
        if (inCar) {
          const d = Math.hypot(carX - rival.x, carZ - rival.z);
          if (d < 3.2 && d > 0.05) {
            const overlap = 3.2 - d;
            const nx = (carX - rival.x) / d;
            const nz = (carZ - rival.z) / d;
            rival.x -= nx * overlap * 0.5;
            rival.z -= nz * overlap * 0.5;
            this.sound.playCrash(16);
          }
        }
      }

      // Leaderboard calculation
      const racers = [
        { id: 'player', name: 'Du', progress: playerProgress, isPlayer: true },
        ...this.rivals.map((r) => ({
          id: r.config.id,
          name: r.config.name,
          progress: r.getProgress(),
          isPlayer: false,
        })),
      ];
      racers.sort((a, b) => b.progress - a.progress);
      this.playerPosition = racers.findIndex((r) => r.isPlayer) + 1;

      // Emit live race telemetry
      eventBus.emit(EVENTS.RACE_UPDATE, {
        position: this.playerPosition,
        totalRacers: racers.length,
        currentCheckpoint: this.race.currentCheckpointIndex,
        totalCheckpoints: RACE_CIRCUIT.length - 1,
        elapsedTime: this.race.elapsedTime,
      });

      // Animate active ring
      if (this.activeRingMesh) {
        this.activeRingMesh.rotation.y += 1.8 * dt;
        const dist = Math.hypot(carX - targetPt.x, carZ - targetPt.z);

        if (dist < 7.0 && inCar && carY < 12.0) {
          // Checkpoint cleared!
          this.sound.playCheckpointChime();
          this.race.currentCheckpointIndex += 1;

          if (this.race.currentCheckpointIndex >= RACE_CIRCUIT.length) {
            // Race Won/Finished!
            this.sound.playFanfare();

            let reward = 500;
            let badge = '🥉 PLATZ 3!';
            if (this.playerPosition === 1) {
              reward = 2000;
              badge = '🥇 PLATZ 1! RENN-CHAMPION!';
            } else if (this.playerPosition === 2) {
              reward = 1000;
              badge = '🥈 PLATZ 2!';
            }

            this.economy.addCash(reward);
            this.race.isActive = false;
            this.raceCooldown = 8.0;

            if (this.activeRingMesh) {
              this.group.remove(this.activeRingMesh);
              disposeObject3D(this.activeRingMesh);
              this.activeRingMesh = null;
            }
            if (this.activeRingLight) {
              this.group.remove(this.activeRingLight);
              this.activeRingLight = null;
            }

            eventBus.emit(EVENTS.NOTIFICATION, {
              text: `🏆 ${badge} Zeit: ${this.race.elapsedTime.toFixed(1)}s | Prämie: +$${reward}!`,
            });

            eventBus.emit(EVENTS.RACE_COMPLETE, {
              position: this.playerPosition,
              reward,
              time: this.race.elapsedTime,
            });

            setTimeout(() => this.cleanupRivals(), 6000);
          } else {
            this.showCheckpointRing(this.race.currentCheckpointIndex);
            eventBus.emit(EVENTS.NOTIFICATION, {
              text: `🏁 Checkpoint ${this.race.currentCheckpointIndex}/${RACE_CIRCUIT.length - 1} | Platz: ${this.playerPosition}.!`,
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
        if (d < 5.0 && inCar && carY < 4.0) {
          this.taxiMission.hasPickedUp = true;
          this.sound.playCheckpointChime();

          if (this.taxiMission.passengerMesh) {
            this.group.remove(this.taxiMission.passengerMesh);
            disposeObject3D(this.taxiMission.passengerMesh);
            this.taxiMission.passengerMesh = null;
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
        if (d < 6.0 && inCar && carY < 4.0) {
          const reward = this.taxiMission.fare + Math.round(this.taxiMission.timeRemaining * 10);
          this.economy.addCash(reward);
          this.sound.playFanfare();

          if (this.dropoffBeam) {
            this.group.remove(this.dropoffBeam);
            disposeObject3D(this.dropoffBeam);
            this.dropoffBeam = null;
          }
          if (this.taxiMission.passengerMesh) {
            this.group.remove(this.taxiMission.passengerMesh);
            disposeObject3D(this.taxiMission.passengerMesh);
            this.taxiMission.passengerMesh = null;
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
          disposeObject3D(this.dropoffBeam);
          this.dropoffBeam = null;
        }
        if (this.taxiMission.passengerMesh) {
          this.group.remove(this.taxiMission.passengerMesh);
          disposeObject3D(this.taxiMission.passengerMesh);
          this.taxiMission.passengerMesh = null;
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
