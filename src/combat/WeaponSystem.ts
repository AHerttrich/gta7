import * as THREE from 'three';
import { WeaponData, EVENTS } from '../utils/Constants';
import { TrafficSystem } from '../traffic/TrafficSystem';
import { PoliceSystem } from '../police/PoliceSystem';
import { PedestrianSystem } from '../pedestrians/PedestrianSystem';
import { SoundManager } from '../audio/SoundManager';
import { GangSystem } from '../gangs/GangSystem';
import { AlienSystem } from '../world/AlienSystem';
import { City } from '../city/City';
import { eventBus } from '../utils/EventBus';
import { disposeObject3D } from '../utils/disposeObject';

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
  light?: THREE.PointLight;
  x: number;
  y: number;
  z: number;
  radius: number;
  maxRadius: number;
  life: number;
}

export class WeaponSystem {
  private static readonly explosionGeo: THREE.SphereGeometry = ((): THREE.SphereGeometry => {
    const geo = new THREE.SphereGeometry(1.0, 12, 12);
    geo.userData.shared = true;
    return geo;
  })();

  public projectiles: Projectile[] = [];
  public explosions: Explosion[] = [];
  public group: THREE.Group;

  private scene: THREE.Scene;
  private sound: SoundManager;
  private traffic: TrafficSystem;
  private police: PoliceSystem;
  private pedestrians: PedestrianSystem;
  private gangs: GangSystem | null = null;
  private aliens: AlienSystem | null = null;
  private city: City | null = null;

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
    city?: City,
  ) {
    this.scene = scene;
    this.sound = sound;
    this.traffic = traffic;
    this.police = police;
    this.pedestrians = pedestrians;
    this.city = city || null;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.bulletGeo = new THREE.SphereGeometry(0.12, 6, 6);
    this.bulletGeo.userData.shared = true;
    this.bulletMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
    this.bulletMat.userData.shared = true;

    this.rocketGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8);
    this.rocketGeo.rotateX(Math.PI / 2);
    this.rocketGeo.userData.shared = true;
    this.rocketMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    this.rocketMat.userData.shared = true;
  }

  public setGangSystem(gangs: GangSystem): void {
    this.gangs = gangs;
  }

  public setAlienSystem(aliens: AlienSystem): void {
    this.aliens = aliens;
  }

  public setCity(city: City): void {
    this.city = city;
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
      if (this.traffic?.cars) {
        for (const car of this.traffic.cars) {
          if (Math.hypot(car.x - targetX, car.z - targetZ) < 2.5) {
            this.traffic.damageCar(car, weapon.damage);
            this.police?.addCrimeSeverity(15);
          }
        }
      }

      // Hit pedestrians
      if (this.pedestrians?.pedestrians) {
        for (const ped of this.pedestrians.pedestrians) {
          if (Math.hypot(ped.x - targetX, ped.z - targetZ) < 2.0) {
            this.pedestrians.launchRagdoll(
              ped,
              Math.sin(heading) * 8.0,
              4.0,
              Math.cos(heading) * 8.0,
            );
            this.police?.addCrimeSeverity(20);
          }
        }
      }

      // Hit gang cars or bounty boss
      if (this.gangs) {
        this.gangs.takeWeaponDamage(targetX, targetZ, weapon.damage, 2.5);
      }

      // Hit aliens on the moon
      if (this.aliens) {
        this.aliens.takeWeaponDamage(targetX, originY, targetZ, weapon.damage, 2.5);
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
    this.police?.addCrimeSeverity(isRocket ? 30 : 10);
    return true;
  }

  public createExplosion(x: number, y: number, z: number, maxRadius: number = 7.0): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(WeaponSystem.explosionGeo, mat);
    mesh.position.set(x, y, z);
    this.group.add(mesh);

    // Keep light object for interface compatibility without adding to scene
    const light = new THREE.PointLight(0xff7700, 8, 30);
    light.position.set(x, y + 1, z);

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
        this.police.damageCopCar(cop, 80);
      }
    }

    if (this.police.policeHeli) {
      const dHeli = Math.hypot(
        this.police.policeHeli.x - x,
        this.police.policeHeli.y - y,
        this.police.policeHeli.z - z,
      );
      if (dHeli < maxRadius + 3.0) {
        this.police.damagePoliceHeli(120);
      }
    }

    for (const ped of this.pedestrians.pedestrians) {
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < maxRadius) {
        const angle = Math.atan2(ped.x - x, ped.z - z);
        this.pedestrians.launchRagdoll(ped, Math.sin(angle) * 12.0, 8.0, Math.cos(angle) * 12.0);
      }
    }

    if (this.gangs) {
      this.gangs.takeWeaponDamage(x, z, 220, maxRadius);
    }

    if (this.aliens) {
      this.aliens.takeWeaponDamage(x, y, z, 220, maxRadius);
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

      // Check building collision (bullets/rockets don't pass through skyscrapers)
      if (this.city) {
        const col = this.city.checkCollision(p.x, p.z, 0.4);
        if (col.collided && p.y < 30.0) {
          hasHit = true;
        }
      }

      // Hit traffic cars
      if (!hasHit && this.traffic?.cars) {
        for (const car of this.traffic.cars) {
          if (!car.isWrecked && Math.hypot(car.x - p.x, car.z - p.z) < 2.3) {
            hasHit = true;
            this.traffic.damageCar(car, p.damage);
            break;
          }
        }
      }

      // Hit cop cars
      if (!hasHit && this.police?.copCars) {
        for (const cop of this.police.copCars) {
          if (Math.hypot(cop.x - p.x, cop.z - p.z) < 2.5) {
            hasHit = true;
            this.police.damageCopCar(cop, p.damage);
            this.police.addCrimeSeverity(30);
            break;
          }
        }
      }

      // Hit police helicopter
      if (!hasHit && this.police?.policeHeli) {
        const heli = this.police.policeHeli;
        if (Math.hypot(heli.x - p.x, heli.y - p.y, heli.z - p.z) < 3.5) {
          hasHit = true;
          this.police.damagePoliceHeli(p.damage);
          this.police.addCrimeSeverity(40);
        }
      }

      // Hit pedestrians
      if (!hasHit && this.pedestrians?.pedestrians) {
        for (const ped of this.pedestrians.pedestrians) {
          if (Math.hypot(ped.x - p.x, ped.z - p.z) < 1.4) {
            hasHit = true;
            this.pedestrians.launchRagdoll(ped, p.vx * 0.15, 6.0, p.vz * 0.15);
            this.police?.addCrimeSeverity(25);
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

      // Hit aliens on the moon
      if (!hasHit && this.aliens) {
        if (this.aliens.takeWeaponDamage(p.x, p.y, p.z, p.damage, 2.2)) {
          hasHit = true;
        }
      }

      if (hasHit || p.life <= 0) {
        if (p.isRocket) {
          this.createExplosion(p.x, Math.max(1, p.y), p.z);
        }
        this.group.remove(p.mesh);
        disposeObject3D(p.mesh);
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
      if (exp.light) {
        exp.light.intensity = exp.life * 14;
      }

      if (exp.life <= 0) {
        this.group.remove(exp.mesh);
        if (exp.light && exp.light.parent) {
          exp.light.parent.remove(exp.light);
        }
        disposeObject3D(exp.mesh);
        this.explosions.splice(i, 1);
      }
    }
  }
}
