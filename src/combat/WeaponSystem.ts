import * as THREE from 'three';
import { WeaponData } from '../utils/Constants';
import { TrafficSystem } from '../traffic/TrafficSystem';
import { PoliceSystem } from '../police/PoliceSystem';
import { PedestrianSystem } from '../pedestrians/PedestrianSystem';
import { SoundManager } from '../audio/SoundManager';
import { GangSystem } from '../gangs/GangSystem';
import { eventBus } from '../utils/EventBus';
import { EVENTS } from '../utils/Constants';

export interface Projectile {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  isRocket: boolean;
  damage: number;
}

export interface Explosion {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  x: number;
  y: number;
  z: number;
  radius: number;
  maxRadius: number;
  life: number;
}

export class WeaponSystem {
  public projectiles: Projectile[] = [];
  public explosions: Explosion[] = [];
  public group: THREE.Group;

  private scene: THREE.Scene;
  private sound: SoundManager;
  private traffic: TrafficSystem;
  private police: PoliceSystem;
  private pedestrians: PedestrianSystem;
  private gangs: GangSystem | null = null;

  private bulletGeo: THREE.SphereGeometry;
  private bulletMat: THREE.MeshBasicMaterial;

  private rocketGeo: THREE.CylinderGeometry;
  private rocketMat: THREE.MeshStandardMaterial;

  constructor(
    scene: THREE.Scene,
    sound: SoundManager,
    traffic: TrafficSystem,
    police: PoliceSystem,
    pedestrians: PedestrianSystem,
  ) {
    this.scene = scene;
    this.sound = sound;
    this.traffic = traffic;
    this.police = police;
    this.pedestrians = pedestrians;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.bulletGeo = new THREE.SphereGeometry(0.12, 6, 6);
    this.bulletMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });

    this.rocketGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8);
    this.rocketGeo.rotateX(Math.PI / 2);
    this.rocketMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
  }

  public setGangSystem(gangs: GangSystem): void {
    this.gangs = gangs;
  }

  public fire(
    weapon: WeaponData,
    originX: number,
    originY: number,
    originZ: number,
    heading: number,
  ): boolean {
    if (weapon.ammo <= 0) return false;

    // Deduct ammo if finite
    if (weapon.ammo !== Infinity) {
      weapon.ammo -= 1;
      eventBus.emit(EVENTS.WEAPON_CHANGE, weapon);
    }

    if (!weapon.isRanged) {
      // Melee attack: Punch or Baseball Bat hit
      this.sound.playCrash();
      const strikeDist = 3.5;
      const targetX = originX + Math.sin(heading) * strikeDist;
      const targetZ = originZ + Math.cos(heading) * strikeDist;

      // Hit traffic cars
      for (const car of this.traffic.cars) {
        if (Math.hypot(car.x - targetX, car.z - targetZ) < 2.5) {
          this.traffic.damageCar(car, weapon.damage);
          this.police.addCrimeSeverity(15);
        }
      }

      // Hit pedestrians
      for (const ped of this.pedestrians.pedestrians) {
        if (Math.hypot(ped.x - targetX, ped.z - targetZ) < 2.0) {
          ped.isPanicking = true;
          ped.panicTimer = 5;
          this.police.addCrimeSeverity(20);
        }
      }

      // Hit gang cars or bounty boss
      if (this.gangs) {
        this.gangs.takeWeaponDamage(targetX, targetZ, weapon.damage, 2.5);
      }
      return true;
    }

    const isRocket = weapon.id === 'rocket_launcher';
    const speed = isRocket ? 42 : 90;

    let projMesh: THREE.Mesh;
    if (isRocket) {
      projMesh = new THREE.Mesh(this.rocketGeo, this.rocketMat);
      this.sound.playExplosion(); // Initial rocket roar
    } else {
      projMesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
      this.sound.playGunshot();
    }

    projMesh.position.set(originX, originY, originZ);
    projMesh.rotation.y = heading;
    this.group.add(projMesh);

    const vx = Math.sin(heading) * speed;
    const vz = Math.cos(heading) * speed;

    this.projectiles.push({
      mesh: projMesh,
      x: originX,
      y: originY,
      z: originZ,
      vx,
      vy: 0,
      vz,
      life: isRocket ? 3.0 : 1.2,
      isRocket,
      damage: weapon.damage,
    });

    // Alert police if firing guns in the city!
    this.police.addCrimeSeverity(isRocket ? 30 : 10);
    return true;
  }

  public createExplosion(x: number, y: number, z: number, maxRadius: number = 7.0): void {
    const geo = new THREE.SphereGeometry(1.0, 12, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    this.group.add(mesh);

    const light = new THREE.PointLight(0xff7700, 8, 30);
    light.position.set(x, y + 1, z);
    this.group.add(light);

    this.sound.playExplosion();

    this.explosions.push({
      mesh,
      light,
      x,
      y,
      z,
      radius: 1.0,
      maxRadius,
      life: 0.5,
    });

    // AoE Damage & blast shockwave
    for (const car of this.traffic.cars) {
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < maxRadius) {
        this.traffic.damageCar(car, 120);
        car.x += (Math.random() - 0.5) * 4;
        car.z += (Math.random() - 0.5) * 4;
      }
    }

    for (const cop of this.police.copCars) {
      const d = Math.hypot(cop.x - x, cop.z - z);
      if (d < maxRadius) {
        cop.speed *= 0.2;
      }
    }

    for (const ped of this.pedestrians.pedestrians) {
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < maxRadius) {
        ped.isPanicking = true;
        ped.panicTimer = 6;
      }
    }

    if (this.gangs) {
      this.gangs.takeWeaponDamage(x, z, 220, maxRadius);
    }
  }

  public update(dt: number): void {
    // 1. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);

      let hasHit = false;

      // Hit traffic cars
      for (const car of this.traffic.cars) {
        if (!car.isWrecked && Math.hypot(car.x - p.x, car.z - p.z) < 2.3) {
          hasHit = true;
          this.traffic.damageCar(car, p.damage);
          break;
        }
      }

      // Hit cop cars
      if (!hasHit) {
        for (const cop of this.police.copCars) {
          if (Math.hypot(cop.x - p.x, cop.z - p.z) < 2.5) {
            hasHit = true;
            this.police.addCrimeSeverity(30);
            break;
          }
        }
      }

      // Hit pedestrians
      if (!hasHit) {
        for (const ped of this.pedestrians.pedestrians) {
          if (Math.hypot(ped.x - p.x, ped.z - p.z) < 1.4) {
            hasHit = true;
            ped.isPanicking = true;
            ped.panicTimer = 6;
            this.police.addCrimeSeverity(25);
            break;
          }
        }
      }

      // Hit gang cars or bounty boss
      if (!hasHit && this.gangs) {
        if (this.gangs.takeWeaponDamage(p.x, p.z, p.damage, 1.8)) {
          hasHit = true;
        }
      }

      if (hasHit || p.life <= 0) {
        if (p.isRocket) {
          this.createExplosion(p.x, Math.max(1, p.y), p.z);
        }
        this.group.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // 2. Update Explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.life -= dt;
      exp.radius += (exp.maxRadius - exp.radius) * 12 * dt;
      exp.mesh.scale.set(exp.radius, exp.radius, exp.radius);

      const mat = exp.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, exp.life * 2.0);
      exp.light.intensity = exp.life * 14;

      if (exp.life <= 0) {
        this.group.remove(exp.mesh);
        this.group.remove(exp.light);
        this.explosions.splice(i, 1);
      }
    }
  }
}
