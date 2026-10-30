import * as THREE from 'three';
import { CarPhysics } from '../vehicles/CarPhysics';
import { SoundManager } from '../audio/SoundManager';
import { EconomySystem } from '../economy/EconomySystem';
import { eventBus } from '../utils/EventBus';
import { EVENTS } from '../utils/Constants';
import { disposeObject3D } from '../utils/disposeObject';

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
  public placeCooldown: number = 0;

  private scene: THREE.Scene;
  private sound: SoundManager;
  private economy: EconomySystem | null = null;

  constructor(scene: THREE.Scene, sound: SoundManager, economy?: EconomySystem) {
    this.scene = scene;
    this.sound = sound;
    this.economy = economy || null;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.loadFromLocalStorage();
  }

  public setEconomy(economy: EconomySystem): void {
    this.economy = economy;
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

  public placeProp(
    type: StuntPropType,
    x: number,
    z: number,
    heading: number = 0,
    ignoreCooldown: boolean = false,
  ): StuntProp {
    if (!ignoreCooldown && this.placeCooldown > 0 && this.placedProps.length > 0) {
      return this.placedProps[this.placedProps.length - 1];
    }
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
    } else if (type === 'feuerring') {
      // Burning Ring of Fire
      const ringGeo = new THREE.TorusGeometry(4.2, 0.35, 12, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 4.5;
      propGroup.add(ring);
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
    this.placeCooldown = 0.2;
    this.saveToLocalStorage();
    this.sound.playCheckpointChime();

    return prop;
  }

  public removeLastProp(): boolean {
    if (this.placedProps.length === 0) return false;
    const removed = this.placedProps.pop();
    if (removed) {
      this.group.remove(removed.group);
      disposeObject3D(removed.group);
      this.saveToLocalStorage();
      return true;
    }
    return false;
  }

  public update(dt: number): void {
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
  }

  public checkCarInteraction(carX: number, carZ: number, physics: CarPhysics): void {
    for (const prop of this.placedProps) {
      const dist = Math.hypot(carX - prop.x, carZ - prop.z);

      if (prop.type === 'rampe' && dist < 4.5) {
        if (!physics.isAirborne && Math.abs(physics.speed) > 10.0) {
          physics.launchJump(Math.max(10.0, Math.abs(physics.speed) * 0.45));
          this.sound.playHoverEngage();
        }
      } else if (prop.type === 'boost_pad' && dist < 3.2) {
        // Boost pad shoots car forward at max turbo speed!
        physics.speed = Math.max(physics.speed, 68.0); // 245 km/h instant boost
        physics.isBoosting = true;
        this.sound.playFanfare();
      } else if (prop.type === 'feuerring' && dist < 4.2) {
        // High air jump through ring of fire
        if (physics.isAirborne) {
          if (this.economy) {
            this.economy.addCash(500);
          }
          eventBus.emit(EVENTS.NOTIFICATION, {
            text: '🔥 FEUERRING DURCHQUERT! Stunt-Meister! +$500!',
          });
        }
      } else if (prop.type === 'kisten' && dist < 3.0) {
        if (Math.abs(physics.speed) > 5.0) {
          physics.speed *= 0.6;
          this.sound.playCrash(12);
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
      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data)) return false;
      const validTypes: StuntPropType[] = ['rampe', 'looping', 'boost_pad', 'feuerring', 'kisten'];
      const validItems = data.filter(
        (d) =>
          d &&
          typeof d === 'object' &&
          validTypes.includes(d.type) &&
          typeof d.x === 'number' &&
          !Number.isNaN(d.x) &&
          typeof d.z === 'number' &&
          !Number.isNaN(d.z) &&
          typeof d.heading === 'number' &&
          !Number.isNaN(d.heading),
      );
      if (validItems.length === 0 && data.length > 0) return false;
      this.clearAllProps();
      validItems.forEach((d) => this.placeProp(d.type, d.x, d.z, d.heading, true));
      return true;
    } catch {
      return false;
    }
  }

  public clearAllProps(): void {
    for (const p of this.placedProps) {
      this.group.remove(p.group);
      disposeObject3D(p.group);
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
