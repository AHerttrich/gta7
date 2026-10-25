import * as THREE from 'three';
import { Boat } from '../vehicles/Boat';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';
import { eventBus } from '../utils/EventBus';
import { EVENTS } from '../utils/Constants';

export interface SmugglingCrate {
  x: number;
  z: number;
  mesh: THREE.Mesh;
  isCollected: boolean;
  value: number;
}

export class WaterSystem {
  public group: THREE.Group;
  public waterMesh: THREE.Mesh;
  public speedboat: Boat;
  public jetSki: Boat;
  public crates: SmugglingCrate[] = [];

  private scene: THREE.Scene;
  private economy: EconomySystem;
  private sound: SoundManager;
  private waveTimer: number = 0;

  constructor(scene: THREE.Scene, economy: EconomySystem, sound: SoundManager) {
    this.scene = scene;
    this.economy = economy;
    this.sound = sound;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // 1. Vast Western Ocean Bay
    const waterGeo = new THREE.PlaneGeometry(280, 500, 32, 32);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Vibrant Azure
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.88,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.set(-200, 0.05, 0);
    this.waterMesh.receiveShadow = true;
    this.group.add(this.waterMesh);

    // 2. Marina Dock & Wooden Piers
    this.buildMarina();

    // 3. Docked Water Vehicles
    this.speedboat = new Boat(-165, 20, false);
    this.jetSki = new Boat(-165, -20, true);
    this.scene.add(this.speedboat.group, this.jetSki.group);

    // 4. Sunken Smuggling Crates
    this.spawnCrates();
  }

  private buildMarina(): void {
    const dockGeo = new THREE.BoxGeometry(14, 0.8, 120);
    const dockMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 }); // Timber
    const dock = new THREE.Mesh(dockGeo, dockMat);
    dock.position.set(-155, 0.4, 0);
    dock.castShadow = true;
    dock.receiveShadow = true;
    this.group.add(dock);

    // Wooden Stunt Water Ramp
    const rampGeo = new THREE.BoxGeometry(8, 2.5, 8);
    rampGeo.rotateX(-Math.PI / 8);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xb45309 });
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.position.set(-210, 0.6, 60);
    this.group.add(ramp);
  }

  private spawnCrates(): void {
    const locations = [
      { x: -190, z: -70, val: 1500 },
      { x: -230, z: 0, val: 2000 },
      { x: -210, z: 90, val: 2500 },
    ];

    locations.forEach((loc) => {
      const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
      const mat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.3 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(loc.x, 0.5, loc.z);
      this.group.add(mesh);

      this.crates.push({
        x: loc.x,
        z: loc.z,
        mesh,
        isCollected: false,
        value: loc.val,
      });
    });
  }

  public update(dt: number, playerX: number, playerZ: number): void {
    this.waveTimer += dt;

    // Bob crates gently in water
    for (const c of this.crates) {
      if (!c.isCollected) {
        c.mesh.position.y = 0.5 + Math.sin(this.waveTimer * 2.0 + c.x) * 0.25;

        // Collect check
        const dist = Math.hypot(playerX - c.x, playerZ - c.z);
        if (dist < 4.0) {
          c.isCollected = true;
          this.group.remove(c.mesh);
          this.economy.addCash(c.value);
          this.sound.playCheckpointChime();
          eventBus.emit(EVENTS.NOTIFICATION, {
            text: `📦 SCHMUGGLER-FRACHT GEBORGEN! Prämie: +$${c.value.toLocaleString()}!`,
          });
        }
      }
    }
  }

  public getWaveTime(): number {
    return this.waveTimer;
  }
}
