import * as THREE from 'three';
import { CITY_CONFIG } from '../utils/Constants';
import { Car } from '../vehicles/Car';
import { PoliceSystem } from '../police/PoliceSystem';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';
import { HUD } from '../ui/HUD';

export class Garage {
  public group: THREE.Group;
  public x: number;
  public z: number;
  private cooldownTimer: number = 0;

  constructor() {
    this.x = CITY_CONFIG.GARAGE_X;
    this.z = CITY_CONFIG.GARAGE_Z;
    this.group = new THREE.Group();
    this.buildGarageMesh();
  }

  private buildGarageMesh(): void {
    const width = 16;
    const depth = 20;
    const height = 7;

    // Building structure
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7,
      metalness: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(this.x, height / 2, this.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    // Glowing Neon Sign: PAY 'N' SPRAY
    const signGeo = new THREE.BoxGeometry(width * 0.8, 1.2, 0.4);
    const signMat = new THREE.MeshBasicMaterial({ color: 0x22c55e }); // Bright Neon Green
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(this.x, height + 0.6, this.z - depth / 2 - 0.2);
    this.group.add(sign);

    // Entrance Roll-up door
    const doorGeo = new THREE.PlaneGeometry(8, 5);
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.3,
    });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(this.x, 2.5, this.z - depth / 2 + 0.05);
    this.group.add(door);

    // Yellow hazard lines on ground in front of garage
    const hazardGeo = new THREE.PlaneGeometry(8, 6);
    hazardGeo.rotateX(-Math.PI / 2);
    const hazardMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });
    const hazard = new THREE.Mesh(hazardGeo, hazardMat);
    hazard.position.set(this.x, 0.03, this.z - depth / 2 - 3);
    this.group.add(hazard);
  }

  public update(
    dt: number,
    car: Car,
    police: PoliceSystem,
    economy: EconomySystem,
    sound: SoundManager,
    hud: HUD,
  ): void {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
      return;
    }

    // Check if player's car is inside the garage entrance zone
    const dist = Math.hypot(car.physics.x - this.x, car.physics.z - (this.z - 10));

    if (dist < 4.5 && Math.abs(car.physics.speed) < 12) {
      this.cooldownTimer = 6.0; // Cooldown between sprays

      const colors = [
        0xe62429, // Cherry Red
        0x00d4ff, // Cyber Cyan
        0xffd700, // Gold
        0x10b981, // Emerald Green
        0xa855f7, // Deep Purple
        0xff5500, // Sunset Orange
        0x111827, // Matte Stealth Black
      ];
      const newColor = colors[Math.floor(Math.random() * colors.length)];

      car.repair();
      car.setColor(newColor);
      sound.playSprayPaint();

      // Clear all police wanted stars
      const hadWanted = police.wantedLevel > 0;
      police.setWantedLevel(0);

      // Small fee if affordable
      if (economy.cash >= 100) {
        economy.spendCash(100);
      }

      hud.showNotification(
        hadWanted
          ? '🎨 Pay ’n’ Spray: Auto repariert, neu lackiert & POLIZEI ABGEHÄNGT! ⭐'
          : '🎨 Pay ’n’ Spray: Auto komplett repariert und frisch lackiert!',
      );
    }
  }
}
