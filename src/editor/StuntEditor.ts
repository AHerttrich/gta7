import * as THREE from 'three';
import { CarPhysics } from '../vehicles/CarPhysics';
import { SoundManager } from '../audio/SoundManager';
import { eventBus } from '../utils/EventBus';
import { EVENTS } from '../utils/Constants';

export type StuntPropType = 'rampe' | 'looping' | 'boost_pad' | 'feuerring' | 'kisten';

export interface StuntProp {
  id: string;
  type: StuntPropType;
  x: number;
  y: number;
  z: number;
  heading: number;
  group: THREE.Group;
}

export class StuntEditor {
  public group: THREE.Group;
  public isBuildMode: boolean = false;
  public selectedProp: StuntPropType = 'rampe';
  public placedProps: StuntProp[] = [];

  private scene: THREE.Scene;
  private sound: SoundManager;

  constructor(scene: THREE.Scene, sound: SoundManager) {
    this.scene = scene;
    this.sound = sound;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.loadFromLocalStorage();
  }

  public toggleBuildMode(): boolean {
    this.isBuildMode = !this.isBuildMode;
    eventBus.emit(EVENTS.NOTIFICATION, {
      text: this.isBuildMode
        ? '🏗️ BAU-MODUS AKTIV! Platziere Rampen, Loopings & Booster!'
        : '🚗 FAHR-MODUS AKTIV! Teste deine Stunt-Strecke!',
    });
    return this.isBuildMode;
  }

  public placeProp(type: StuntPropType, x: number, z: number, heading: number = 0): StuntProp {
    const propGroup = new THREE.Group();

    if (type === 'rampe') {
      // 45° Launch Stunt Ramp
      const rampGeo = new THREE.BoxGeometry(6.5, 3.2, 8.5);
      rampGeo.rotateX(-Math.PI / 6);
      const rampMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.3,
        metalness: 0.6,
      });
      const ramp = new THREE.Mesh(rampGeo, rampMat);
      ramp.position.y = 1.6;
      propGroup.add(ramp);
    } else if (type === 'boost_pad') {
      // High-Velocity Neon Booster Pad
      const padGeo = new THREE.BoxGeometry(5.0, 0.15, 6.0);
      const padMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.y = 0.08;
      propGroup.add(pad);

      const light = new THREE.PointLight(0x00f0ff, 4, 10);
      light.position.y = 0.5;
      propGroup.add(light);
    } else if (type === 'feuerring') {
      // Burning Ring of Fire
      const ringGeo = new THREE.TorusGeometry(4.2, 0.35, 12, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 4.5;
      propGroup.add(ring);

      const fireLight = new THREE.PointLight(0xf97316, 5, 16);
      fireLight.position.y = 4.5;
      propGroup.add(fireLight);
    } else if (type === 'looping') {
      // 360° Corkscrew Ring
      const loopGeo = new THREE.TorusGeometry(6.5, 0.5, 16, 32);
      const loopMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        metalness: 0.8,
        roughness: 0.2,
      });
      const loop = new THREE.Mesh(loopGeo, loopMat);
      loop.position.y = 7.0;
      propGroup.add(loop);
    } else if (type === 'kisten') {
      // Crate Stack
      const crateMat = new THREE.MeshStandardMaterial({ color: 0xb45309 });
      for (let i = 0; i < 3; i++) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), crateMat);
        crate.position.set((i - 1) * 1.6, 0.75, 0);
        propGroup.add(crate);
      }
    }

    propGroup.position.set(x, 0, z);
    propGroup.rotation.y = heading;
    this.group.add(propGroup);

    const prop: StuntProp = {
      id: `${type}_${Date.now()}_${Math.random()}`,
      type,
      x,
      y: 0,
      z,
      heading,
      group: propGroup,
    };

    this.placedProps.push(prop);
    this.saveToLocalStorage();
    this.sound.playCheckpointChime();

    return prop;
  }

  public checkCarInteraction(carX: number, carZ: number, physics: CarPhysics): void {
    for (const prop of this.placedProps) {
      const dist = Math.hypot(carX - prop.x, carZ - prop.z);

      if (prop.type === 'boost_pad' && dist < 3.2) {
        // Boost pad shoots car forward at max turbo speed!
        physics.speed = Math.max(physics.speed, 68.0); // 245 km/h instant boost
        physics.isBoosting = true;
        this.sound.playFanfare();
      } else if (prop.type === 'feuerring' && dist < 4.2) {
        // High air jump through ring of fire
        if (physics.isAirborne) {
          eventBus.emit(EVENTS.NOTIFICATION, {
            text: '🔥 FEUERRING DURCHQUERT! Stunt-Meister! +$500!',
          });
        }
      }
    }
  }

  public exportTrackJSON(): string {
    return JSON.stringify(
      this.placedProps.map((p) => ({
        type: p.type,
        x: p.x,
        z: p.z,
        heading: p.heading,
      })),
    );
  }

  public importTrackJSON(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr) as {
        type: StuntPropType;
        x: number;
        z: number;
        heading: number;
      }[];
      this.clearAllProps();
      data.forEach((d) => this.placeProp(d.type, d.x, d.z, d.heading));
      return true;
    } catch {
      return false;
    }
  }

  public clearAllProps(): void {
    for (const p of this.placedProps) {
      this.group.remove(p.group);
    }
    this.placedProps = [];
    this.saveToLocalStorage();
  }

  private saveToLocalStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('gta7_stunt_track', this.exportTrackJSON());
    } catch (err) {
      void err;
    }
  }

  private loadFromLocalStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem('gta7_stunt_track');
      if (saved) {
        this.importTrackJSON(saved);
      }
    } catch (err) {
      void err;
    }
  }
}
