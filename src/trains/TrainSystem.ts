import * as THREE from 'three';
import { SoundManager } from '../audio/SoundManager';
import { eventBus } from '../utils/EventBus';
import { EVENTS } from '../utils/Constants';

export interface TrainCar {
  group: THREE.Group;
  length: number;
}

export class TrainSystem {
  public group: THREE.Group;
  public subwayGroup: THREE.Group;
  public freightTrainGroup: THREE.Group;

  public subwayProgress: number = 0;
  public freightProgress: number = 0;
  public freightSpeed: number = 24.0; // m/s (~86 km/h)
  public subwaySpeed: number = 28.0;

  private scene: THREE.Scene;
  private sound: SoundManager;

  // Track Waypoints (Elevated Circuit along Outer Avenue Corridors: x, z = ±220)
  private subwayWaypoints = [
    { x: -220, z: -220 },
    { x: 220, z: -220 },
    { x: 220, z: 220 },
    { x: -220, z: 220 },
  ];

  constructor(scene: THREE.Scene, sound: SoundManager) {
    this.scene = scene;
    this.sound = sound;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.subwayGroup = this.buildSubwayTrain();
    this.freightTrainGroup = this.buildFreightTrain();
    this.group.add(this.subwayGroup, this.freightTrainGroup);
  }

  private buildSubwayTrain(): THREE.Group {
    const train = new THREE.Group();
    const carMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // Silver chrome
      metalness: 0.9,
      roughness: 0.1,
    });
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff }); // Cyan glass
    const maglevMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff }); // Cyber Maglev glow

    // 3 Linked Metro Wagons
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.4, 12), carMat);
      body.position.y = 2.0;
      w.add(body);

      // Glowing Neon Windows
      const winGeo = new THREE.BoxGeometry(3.26, 1.2, 10);
      const win = new THREE.Mesh(winGeo, windowMat);
      win.position.y = 2.4;
      w.add(win);

      // Magnetic Levitation Emitter Strip (Under-wagon Cyber Glow)
      const maglevGeo = new THREE.BoxGeometry(2.4, 0.15, 11);
      const maglev = new THREE.Mesh(maglevGeo, maglevMat);
      maglev.position.y = 0.2;
      w.add(maglev);

      w.position.z = i * -13.5;
      train.add(w);
    }

    return train;
  }

  private buildFreightTrain(): THREE.Group {
    const freight = new THREE.Group();

    // Heavy Diesel Locomotive (Industrial Black & Caution Yellow)
    const locoMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.85,
      roughness: 0.3,
    });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });

    const loco = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.2, 14), locoMat);
    loco.position.y = 2.4;
    freight.add(loco);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.65, 0.6, 14), stripeMat);
    stripe.position.y = 2.8;
    freight.add(stripe);

    // 3 Heavy Cargo Container Wagons
    const cargoColors = [0xef4444, 0x0284c7, 0x10b981];
    for (let i = 1; i <= 3; i++) {
      const cMat = new THREE.MeshStandardMaterial({ color: cargoColors[i - 1], roughness: 0.5 });
      const wagon = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.8, 13), cMat);
      wagon.position.set(0, 2.2, -i * 14.5);
      freight.add(wagon);
    }

    return freight;
  }

  public update(dt: number): void {
    const safeDt = Math.max(0, dt);

    // 1. Move Elevated Sky-Train along avenue circuit (elevated at y = 8.5m)
    this.subwayProgress = (this.subwayProgress + (this.subwaySpeed / 1760) * safeDt) % 1.0;
    if (this.subwayProgress < 0) this.subwayProgress += 1.0;

    const subIdx = Math.floor(this.subwayProgress * 4) % 4;
    const safeIdx = Math.max(0, Math.min(3, (subIdx + 4) % 4));
    const subNextIdx = (safeIdx + 1) % 4;
    const subT = (this.subwayProgress * 4) % 1;

    const p1 = this.subwayWaypoints[safeIdx] || this.subwayWaypoints[0];
    const p2 = this.subwayWaypoints[subNextIdx] || this.subwayWaypoints[1];

    const subX = THREE.MathUtils.lerp(p1.x, p2.x, subT);
    const subZ = THREE.MathUtils.lerp(p1.z, p2.z, subT);
    const subAngle = Math.atan2(p2.x - p1.x, p2.z - p1.z);

    this.subwayGroup.position.set(subX, 8.5, subZ);
    this.subwayGroup.rotation.y = subAngle;

    // 2. Move Unstoppable Freight Train (East-West Industrial Line along z = -220)
    this.freightProgress = (this.freightProgress + (this.freightSpeed / 560) * safeDt) % 1.0;
    if (this.freightProgress < 0) this.freightProgress += 1.0;

    const fx = THREE.MathUtils.lerp(-280, 280, this.freightProgress);
    const fz = -220;
    this.freightTrainGroup.position.set(fx, 0, fz);
    this.freightTrainGroup.rotation.y = Math.PI / 2;
  }

  public checkFreightTrainCollision(
    carX: number,
    carZ: number,
  ): { hit: boolean; pushX: number; pushZ: number } {
    const fx = this.freightTrainGroup.position.x;
    const fz = this.freightTrainGroup.position.z;

    // Check collision bounding box along 50m train length
    const dx = Math.abs(carX - fx);
    const dz = Math.abs(carZ - fz);

    if (dx < 3.2 && dz < 25.0) {
      this.sound.playCrash(35);
      eventBus.emit(EVENTS.NOTIFICATION, {
        text: '💥 VOM GÜTERZUG ERFASST! Unaufhaltbare Wucht!',
      });
      return {
        hit: true,
        pushX: 18.0, // High-speed shunt forward
        pushZ: carZ > fz ? 25.0 : -25.0, // Catapult sideways
      };
    }

    return { hit: false, pushX: 0, pushZ: 0 };
  }
}
