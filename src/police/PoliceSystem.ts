import * as THREE from 'three';
import { eventBus } from '../utils/EventBus';
import { EVENTS } from '../utils/Constants';
import { City } from '../city/City';

export interface CopCar {
  group: THREE.Group;
  x: number;
  z: number;
  speed: number;
  heading: number;
  sirenLightRed: THREE.PointLight;
  sirenLightBlue: THREE.PointLight;
  sirenMeshRed: THREE.Mesh;
  sirenMeshBlue: THREE.Mesh;
}

export class PoliceSystem {
  public wantedLevel: number = 0; // 0 to 5 stars
  public copCars: CopCar[] = [];
  public group: THREE.Group;

  private scene: THREE.Scene;
  private city: City;
  private sirenTimer: number = 0;
  private cooldownTimer: number = 0;

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene;
    this.city = city;
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  public setWantedLevel(level: number): void {
    const clamped = Math.max(0, Math.min(5, Math.floor(level)));
    if (this.wantedLevel !== clamped) {
      this.wantedLevel = clamped;
      eventBus.emit(EVENTS.WANTED_CHANGE, { wantedLevel: this.wantedLevel });
      this.adjustCopPresence();
    }
  }

  public addCrimeSeverity(points: number): void {
    if (this.wantedLevel === 0 && points >= 10) {
      this.setWantedLevel(1);
    } else if (this.wantedLevel === 1 && points >= 25) {
      this.setWantedLevel(2);
    } else if (this.wantedLevel === 2 && points >= 50) {
      this.setWantedLevel(3);
    } else if (this.wantedLevel === 3 && points >= 80) {
      this.setWantedLevel(4);
    } else if (this.wantedLevel === 4 && points >= 120) {
      this.setWantedLevel(5);
    }
  }

  private adjustCopPresence(): void {
    const targetCops = this.wantedLevel === 0 ? 0 : Math.min(4, this.wantedLevel);

    while (this.copCars.length < targetCops) {
      this.spawnCopCar();
    }
    while (this.copCars.length > targetCops) {
      const removed = this.copCars.pop();
      if (removed) this.group.remove(removed.group);
    }
  }

  private spawnCopCar(): void {
    const copGroup = new THREE.Group();

    // Cruiser Body (Police Black & White)
    const bodyGeo = new THREE.BoxGeometry(2.1, 0.65, 4.6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.3,
      metalness: 0.7,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.55;
    copGroup.add(bodyMesh);

    // White door panel
    const doorGeo = new THREE.BoxGeometry(2.15, 0.45, 1.8);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(0, 0.55, 0);
    copGroup.add(doorMesh);

    // Roof & Cabin
    const cabinGeo = new THREE.BoxGeometry(1.8, 0.55, 2.3);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 1.05, -0.2);
    copGroup.add(cabinMesh);

    // Siren Lightbar on Roof
    const sirenGeo = new THREE.BoxGeometry(0.35, 0.15, 0.25);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x0066ff });

    const sirenMeshRed = new THREE.Mesh(sirenGeo, redMat);
    sirenMeshRed.position.set(-0.4, 1.4, -0.2);

    const sirenMeshBlue = new THREE.Mesh(sirenGeo, blueMat);
    sirenMeshBlue.position.set(0.4, 1.4, -0.2);

    const sirenLightRed = new THREE.PointLight(0xff0000, 3, 20);
    sirenLightRed.position.copy(sirenMeshRed.position);

    const sirenLightBlue = new THREE.PointLight(0x0066ff, 3, 20);
    sirenLightBlue.position.copy(sirenMeshBlue.position);

    copGroup.add(sirenMeshRed, sirenMeshBlue, sirenLightRed, sirenLightBlue);

    // Spawn 60m away from center
    const angle = Math.random() * Math.PI * 2;
    const spawnX = Math.cos(angle) * 70;
    const spawnZ = Math.sin(angle) * 70;

    copGroup.position.set(spawnX, 0, spawnZ);
    this.group.add(copGroup);

    this.copCars.push({
      group: copGroup,
      x: spawnX,
      z: spawnZ,
      speed: 0,
      heading: angle,
      sirenLightRed,
      sirenLightBlue,
      sirenMeshRed,
      sirenMeshBlue,
    });
  }

  public update(dt: number, playerX: number, playerZ: number): void {
    if (this.wantedLevel === 0) return;

    // Siren lights flash animation
    this.sirenTimer += dt * 8;
    const flash = Math.sin(this.sirenTimer) > 0;

    this.copCars.forEach((cop) => {
      cop.sirenLightRed.intensity = flash ? 4 : 0;
      cop.sirenLightBlue.intensity = flash ? 0 : 4;

      // AI Chase Player
      const dx = playerX - cop.x;
      const dz = playerZ - cop.z;
      const targetAngle = Math.atan2(dx, dz);
      const dist = Math.hypot(dx, dz);

      // Rotate towards player
      let angleDiff = targetAngle - cop.heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      cop.heading += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 2.5 * dt);

      // Accelerate towards player
      const maxCopSpeed = 22 + this.wantedLevel * 4;
      if (dist > 4) {
        cop.speed = Math.min(maxCopSpeed, cop.speed + 16 * dt);
      } else {
        // Ram!
        cop.speed = Math.min(maxCopSpeed * 0.8, cop.speed);
      }

      // Move cop
      const nextX = cop.x + Math.sin(cop.heading) * cop.speed * dt;
      const nextZ = cop.z + Math.cos(cop.heading) * cop.speed * dt;

      // Avoid solid buildings
      if (!this.city.checkCollision(nextX, nextZ, 1.5).collided) {
        cop.x = nextX;
        cop.z = nextZ;
      } else {
        cop.heading += Math.PI / 2;
        cop.speed *= 0.5;
      }

      cop.group.position.set(cop.x, 0, cop.z);
      cop.group.rotation.y = cop.heading;
    });

    // Cooldown logic when escaping far away (> 90m)
    const closestDist = this.copCars.reduce((min, cop) => {
      return Math.min(min, Math.hypot(playerX - cop.x, playerZ - cop.z));
    }, 9999);

    if (closestDist > 80) {
      this.cooldownTimer += dt;
      if (this.cooldownTimer > 15) {
        this.cooldownTimer = 0;
        this.setWantedLevel(Math.max(0, this.wantedLevel - 1));
      }
    } else {
      this.cooldownTimer = 0;
    }
  }
}
