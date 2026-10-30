import * as THREE from 'three';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';
import { City } from '../city/City';
import { eventBus } from '../utils/EventBus';
import { EVENTS } from '../utils/Constants';
import { disposeObject3D } from '../utils/disposeObject';

export interface GangTerritory {
  id: 'vipers' | 'syndicate';
  name: string;
  x: number;
  z: number;
  radius: number;
  color: number;
  accentColor: number;
}

export interface GangCar {
  territoryId: 'vipers' | 'syndicate';
  group: THREE.Group;
  x: number;
  z: number;
  speed: number;
  heading: number;
  health: number;
  maxHealth: number;
  isHostile: boolean;
  shootCooldown: number;
}

export interface BountyBoss {
  group: THREE.Group;
  x: number;
  z: number;
  speed: number;
  heading: number;
  health: number;
  maxHealth: number;
  isDestroyed: boolean;
  bodyMesh: THREE.Mesh;
  bossLight: THREE.PointLight;
}

export class GangSystem {
  public group: THREE.Group;
  public territories: GangTerritory[];
  public gangCars: GangCar[] = [];
  public bountyBoss: BountyBoss | null = null;
  public bossWaypointIndex: number = 0;
  public bossRespawnTimer: number = 0;

  private scene: THREE.Scene;
  private economy: EconomySystem;
  private sound: SoundManager;
  private city: City | null = null;
  private currentDistrictName: string = '';
  private ramCooldown: number = 0;

  constructor(scene: THREE.Scene, economy: EconomySystem, sound: SoundManager, city?: City) {
    this.scene = scene;
    this.economy = economy;
    this.sound = sound;
    this.city = city || null;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.territories = [
      {
        id: 'vipers',
        name: '🐍 Cyber Vipers Turf',
        x: 60,
        z: 60,
        radius: 65,
        color: 0x22c55e, // Toxic Green
        accentColor: 0xa855f7, // Violet
      },
      {
        id: 'syndicate',
        name: '🔥 Neon Syndicate Docks',
        x: -60,
        z: -60,
        radius: 65,
        color: 0xf97316, // Blaze Orange
        accentColor: 0xef4444, // Red
      },
    ];

    this.spawnTerritoryMarkers();
    this.spawnGangCruisers();
    this.spawnBountyBoss();
  }

  private spawnTerritoryMarkers(): void {
    for (const t of this.territories) {
      // 3D Neon District Overhead Hologram Arch
      const archGeo = new THREE.TorusGeometry(8.0, 0.45, 8, 24);
      const archMat = new THREE.MeshStandardMaterial({
        color: t.color,
        emissive: t.color,
        emissiveIntensity: 0.6,
        roughness: 0.3,
      });
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.position.set(t.x, 8.0, t.z);
      this.group.add(arch);
    }
  }

  private spawnGangCruisers(): void {
    for (const t of this.territories) {
      // 2 Patrol Cars per district
      for (let i = 0; i < 2; i++) {
        const angle = i * Math.PI + (Math.random() - 0.5);
        const spawnX = t.x + Math.sin(angle) * 35;
        const spawnZ = t.z + Math.cos(angle) * 35;

        const g = new THREE.Group();

        // Muscle Car Body
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x111827,
          roughness: 0.3,
          metalness: 0.8,
        });
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.4), bodyMat);
        body.position.y = 0.55;
        g.add(body);

        // Gang Livery Racing Stripes
        const stripeMat = new THREE.MeshBasicMaterial({ color: t.color });
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 4.42), stripeMat);
        stripe.position.y = 0.56;
        g.add(stripe);

        g.position.set(spawnX, 0, spawnZ);
        this.group.add(g);

        this.gangCars.push({
          territoryId: t.id,
          group: g,
          x: spawnX,
          z: spawnZ,
          speed: 18.0,
          heading: angle + Math.PI / 2,
          health: 120,
          maxHealth: 120,
          isHostile: false,
          shootCooldown: 0,
        });
      }
    }
  }

  private spawnBountyBoss(): void {
    if (this.bountyBoss && this.bountyBoss.group.parent) {
      this.group.remove(this.bountyBoss.group);
      disposeObject3D(this.bountyBoss.group);
    }
    const bossGroup = new THREE.Group();

    // Heavy Plated Armored Super-SUV
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Deep Tactical Matte
      roughness: 0.2,
      metalness: 0.9,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 5.6), bodyMat);
    body.position.y = 0.9;
    bossGroup.add(body);

    // Armor Roof Turret & Shielding
    const turretMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8 });
    const turret = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.6), turretMat);
    turret.position.set(0, 1.7, 0.2);
    bossGroup.add(turret);

    // Twin Machine Gun Barrels
    const gunGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8);
    gunGeo.rotateX(Math.PI / 2);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.95 });
    const gunLeft = new THREE.Mesh(gunGeo, gunMat);
    gunLeft.position.set(-0.4, 1.7, 1.2);
    const gunRight = gunLeft.clone();
    gunRight.position.set(0.4, 1.7, 1.2);
    bossGroup.add(gunLeft, gunRight);

    // Red Hazard Underglow & Boss Aura (kept on interface without adding to scene)
    const bossLight = new THREE.PointLight(0xef4444, 4, 14);
    bossLight.position.set(0, 0.4, 0);

    const startX = 132;
    const startZ = -132;
    bossGroup.position.set(startX, 0, startZ);
    this.group.add(bossGroup);

    this.bountyBoss = {
      group: bossGroup,
      x: startX,
      z: startZ,
      speed: 26.0,
      heading: 0,
      health: 300,
      maxHealth: 300,
      isDestroyed: false,
      bodyMesh: body,
      bossLight,
    };
  }

  public update(dt: number, playerX: number, playerZ: number, _inCar: boolean): void {
    // 1. Territory detection & HUD notification
    let inAnyTerritory = false;
    for (const t of this.territories) {
      const dist = Math.hypot(playerX - t.x, playerZ - t.z);
      if (dist < t.radius) {
        inAnyTerritory = true;
        if (this.currentDistrictName !== t.name) {
          this.currentDistrictName = t.name;
          eventBus.emit(EVENTS.NOTIFICATION, {
            text: `📍 Gebiet betreten: ${t.name}!`,
          });
        }
        break;
      }
    }
    if (!inAnyTerritory && this.currentDistrictName !== '') {
      this.currentDistrictName = '';
    }

    // 2. Update Gang Patrol Cars
    for (const car of this.gangCars) {
      if (car.health <= 0) continue;

      if (car.isHostile) {
        // Pursue player
        const dx = playerX - car.x;
        const dz = playerZ - car.z;
        const targetAngle = Math.atan2(dx, dz);
        const dist = Math.hypot(dx, dz);

        let diff = targetAngle - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.heading += Math.sign(diff) * Math.min(Math.abs(diff), 2.8 * dt);

        car.speed = Math.min(32.0, car.speed + 16.0 * dt);

        // Drive-by shooting if close
        car.shootCooldown -= dt;
        if (dist < 28.0 && car.shootCooldown <= 0) {
          car.shootCooldown = 1.6;
          this.sound.playGunshot();
          eventBus.emit(EVENTS.NOTIFICATION, {
            text: '💥 Gang-Beschuss! Ausweichen oder zurückballern!',
          });
        }
      } else {
        // Patrol in a wide loop within territory
        const t = this.territories.find((x) => x.id === car.territoryId)!;
        const dx = t.x - car.x;
        const dz = t.z - car.z;
        const distFromCenter = Math.hypot(dx, dz);

        if (distFromCenter > t.radius * 0.8) {
          // Turn back towards center
          const targetAngle = Math.atan2(dx, dz);
          let diff = targetAngle - car.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          car.heading += Math.sign(diff) * Math.min(Math.abs(diff), 2.2 * dt);
        } else {
          // Gently curve
          car.heading += 0.3 * dt;
        }
      }

      const nextX = car.x + Math.sin(car.heading) * car.speed * dt;
      const nextZ = car.z + Math.cos(car.heading) * car.speed * dt;

      if (this.city && this.city.checkCollision(nextX, nextZ, 1.5).collided) {
        car.heading += Math.PI / 2;
        car.speed *= 0.5;
      } else {
        car.x = nextX;
        car.z = nextZ;
      }

      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
    }

    // 3. Update Bounty Boss Convoy & Respawn Watchdog
    this.ramCooldown = Math.max(0, this.ramCooldown - dt);

    if (this.bountyBoss && this.bountyBoss.isDestroyed) {
      if (this.bossRespawnTimer > 0) {
        this.bossRespawnTimer -= dt;
        if (this.bossRespawnTimer <= 0) {
          this.bossRespawnTimer = 0;
          this.spawnBountyBoss();
          eventBus.emit(EVENTS.NOTIFICATION, {
            text: '⚠️ KOPFGELD-ZIEL RESPAWNT! Schwerer Konvoi wieder aufgetaucht!',
          });
        }
      }
    } else if (this.bountyBoss && !this.bountyBoss.isDestroyed) {
      const boss = this.bountyBoss;

      // Boss navigates the grand outer perimeter circuit
      const waypoints = [
        { x: 132, z: 132 },
        { x: -132, z: 132 },
        { x: -132, z: -132 },
        { x: 132, z: -132 },
      ];

      const targetPt = waypoints[this.bossWaypointIndex % waypoints.length];
      const distToWp = Math.hypot(targetPt.x - boss.x, targetPt.z - boss.z);
      if (distToWp < 14.0) {
        this.bossWaypointIndex = (this.bossWaypointIndex + 1) % waypoints.length;
      }

      const activePt = waypoints[this.bossWaypointIndex % waypoints.length];
      const dx = activePt.x - boss.x;
      const dz = activePt.z - boss.z;
      const targetAngle = Math.atan2(dx, dz);

      let diff = targetAngle - boss.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      boss.heading += Math.sign(diff) * Math.min(Math.abs(diff), 1.8 * dt);

      boss.x += Math.sin(boss.heading) * boss.speed * dt;
      boss.z += Math.cos(boss.heading) * boss.speed * dt;
      boss.group.position.set(boss.x, 0, boss.z);
      boss.group.rotation.y = boss.heading;

      // Player proximity check
      const dPlayer = Math.hypot(playerX - boss.x, playerZ - boss.z);
      if (dPlayer < 45.0) {
        // Alert player
        boss.bossLight.intensity = Math.sin(Date.now() * 0.01) * 2 + 5;
      }
    }
  }

  public takeWeaponDamage(x: number, z: number, damage: number, radius: number): boolean {
    let hitAny = false;

    // Check Gang Cars
    for (const car of this.gangCars) {
      if (car.health <= 0) continue;
      const d = Math.hypot(x - car.x, z - car.z);
      if (d < radius + 2.0) {
        car.health -= damage;
        car.isHostile = true; // Aggro!
        hitAny = true;

        if (car.health <= 0) {
          // Destroyed!
          this.sound.playCrash(20);
          this.economy.addCash(350);
          this.group.remove(car.group);
          disposeObject3D(car.group);
          eventBus.emit(EVENTS.NOTIFICATION, {
            text: '💥 GANG-WAGEN ZERSTÖRT! +$350 Beute!',
          });
        }
      }
    }

    // Check Bounty Boss
    if (this.bountyBoss && !this.bountyBoss.isDestroyed) {
      const boss = this.bountyBoss;
      const d = Math.hypot(x - boss.x, z - boss.z);
      if (d < radius + 3.0) {
        boss.health -= damage;
        hitAny = true;

        // Flash boss chassis
        (boss.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0xff3b30);
        setTimeout(() => {
          if (!boss.isDestroyed) {
            (boss.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0x0f172a);
          }
        }, 120);

        if (boss.health <= 0) {
          boss.isDestroyed = true;
          this.bossRespawnTimer = 90.0;
          this.sound.playFanfare();
          this.economy.addCash(5000);
          this.group.remove(boss.group);
          disposeObject3D(boss.group);
          eventBus.emit(EVENTS.NOTIFICATION, {
            text: '🏆 KOPFGELD-ZIEL ELIMINIERT! Mega-Prämie: +$5.000!',
          });
        } else {
          eventBus.emit(EVENTS.NOTIFICATION, {
            text: `🎯 KOPFGELD-ZIEL GETROFFEN! Boss-HP: ${boss.health}/${boss.maxHealth}`,
          });
        }
      }
    }

    return hitAny;
  }

  public checkPlayerCarRamming(
    carX: number,
    carZ: number,
    speed: number,
    carY: number = 0,
  ): boolean {
    if (this.ramCooldown > 0) return false;
    if (carY > 2.0) return false;
    if (Math.abs(speed) < 10.0) return false;

    // Ramming Bounty Boss
    if (this.bountyBoss && !this.bountyBoss.isDestroyed) {
      const boss = this.bountyBoss;
      const dist = Math.hypot(carX - boss.x, carZ - boss.z);
      if (dist < 4.5) {
        const damage = Math.round(Math.abs(speed) * 1.5);
        this.takeWeaponDamage(boss.x, boss.z, damage, 1.0);
        this.sound.playCrash(25);
        this.ramCooldown = 0.5;
        return true;
      }
    }

    // Ramming Gang Cars
    for (const car of this.gangCars) {
      if (car.health <= 0) continue;
      const dist = Math.hypot(carX - car.x, carZ - car.z);
      if (dist < 3.5) {
        this.takeWeaponDamage(car.x, car.z, 50, 1.0);
        this.sound.playCrash(18);
        this.ramCooldown = 0.5;
        return true;
      }
    }

    return false;
  }

  public getBountyBossInfo(): { health: number; maxHealth: number; x: number; z: number } | null {
    if (!this.bountyBoss || this.bountyBoss.isDestroyed) return null;
    return {
      health: this.bountyBoss.health,
      maxHealth: this.bountyBoss.maxHealth,
      x: this.bountyBoss.x,
      z: this.bountyBoss.z,
    };
  }
}
