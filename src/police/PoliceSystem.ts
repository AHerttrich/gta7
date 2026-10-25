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

export interface PoliceHeli {
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  rotor: THREE.Group;
  tailRotor: THREE.Group;
  searchlight: THREE.SpotLight;
  searchlightTarget: THREE.Object3D;
  sirenLightRed: THREE.PointLight;
  sirenLightBlue: THREE.PointLight;
}

export interface Roadblock {
  x: number;
  z: number;
  group: THREE.Group;
  isSmashed: boolean;
  barrierMesh: THREE.Mesh;
}

export class PoliceSystem {
  public wantedLevel: number = 0; // 0 to 5 stars
  public copCars: CopCar[] = [];
  public policeHeli: PoliceHeli | null = null;
  public roadblocks: Roadblock[] = [];
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

    // Police Helicopter at 4 & 5 stars
    if (this.wantedLevel >= 4 && !this.policeHeli) {
      this.spawnPoliceHelicopter();
    } else if (this.wantedLevel < 4 && this.policeHeli) {
      this.despawnPoliceHelicopter();
    }

    // SWAT Roadblocks at 3 to 5 stars
    if (this.wantedLevel >= 3 && this.roadblocks.length === 0) {
      this.spawnRoadblocks();
    } else if (this.wantedLevel < 3 && this.roadblocks.length > 0) {
      this.clearRoadblocks();
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

    // Spawn 70m away
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

  private spawnPoliceHelicopter(): void {
    const heliGroup = new THREE.Group();

    // Fuselage
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.8, 4.4), bodyMat);
    bodyMesh.position.y = 1.1;
    heliGroup.add(bodyMesh);

    // White Police Stripe
    const stripeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.05, 0.3, 4.2),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    stripeMesh.position.y = 1.1;
    heliGroup.add(stripeMesh);

    // Tail Boom
    const boomMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 4.2, 8), bodyMat);
    boomMesh.rotateX(Math.PI / 2);
    boomMesh.position.set(0, 1.4, -3.6);
    heliGroup.add(boomMesh);

    // Main Rotor
    const rotor = new THREE.Group();
    rotor.position.set(0, 2.2, 0);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.04, 4.2),
        new THREE.MeshStandardMaterial({ color: 0x18181b }),
      );
      blade.position.z = 2.1;
      const pivot = new THREE.Group();
      pivot.rotation.y = (b * Math.PI) / 2;
      pivot.add(blade);
      rotor.add(pivot);
    }
    heliGroup.add(rotor);

    // Tail Rotor
    const tailRotor = new THREE.Group();
    tailRotor.position.set(0.15, 2.2, -5.5);
    const tBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.2, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x18181b }),
    );
    tailRotor.add(tBlade);
    heliGroup.add(tailRotor);

    // High Power Searchlight
    const searchlight = new THREE.SpotLight(0xfffaed, 5.5, 90, Math.PI / 5, 0.3);
    searchlight.position.set(0, 0.2, 1.6);
    const searchlightTarget = new THREE.Object3D();
    searchlightTarget.position.set(0, -38, 0);
    heliGroup.add(searchlight);
    heliGroup.add(searchlightTarget);
    searchlight.target = searchlightTarget;

    // Siren Lights
    const sirenLightRed = new THREE.PointLight(0xff0000, 3, 25);
    sirenLightRed.position.set(-0.6, 0.4, 0);
    const sirenLightBlue = new THREE.PointLight(0x0066ff, 3, 25);
    sirenLightBlue.position.set(0.6, 0.4, 0);
    heliGroup.add(sirenLightRed, sirenLightBlue);

    heliGroup.position.set(0, 38, 0);
    this.group.add(heliGroup);

    this.policeHeli = {
      group: heliGroup,
      x: 0,
      y: 38,
      z: 0,
      rotor,
      tailRotor,
      searchlight,
      searchlightTarget,
      sirenLightRed,
      sirenLightBlue,
    };
  }

  private despawnPoliceHelicopter(): void {
    if (this.policeHeli) {
      this.group.remove(this.policeHeli.group);
      this.policeHeli = null;
    }
  }

  private spawnRoadblocks(): void {
    // Spawn 2 roadblocks at road intersections
    const locs = [
      { x: 44, z: -44 },
      { x: -44, z: 44 },
    ];

    locs.forEach((loc) => {
      const rbGroup = new THREE.Group();

      // Police Cars in V-Shape
      const carMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
      const car1 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.6), carMat);
      car1.position.set(-4.5, 0.4, 0);
      car1.rotation.y = 0.45;
      const car2 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.6), carMat);
      car2.position.set(4.5, 0.4, 0);
      car2.rotation.y = -0.45;

      // Hazard Barricade in Center
      const barGeo = new THREE.BoxGeometry(6.2, 0.9, 0.25);
      const barMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
      const barrierMesh = new THREE.Mesh(barGeo, barMat);
      barrierMesh.position.set(0, 0.6, 0);

      // Warning Flasher
      const flash = new THREE.PointLight(0xff0000, 3, 12);
      flash.position.set(0, 1.2, 0);

      rbGroup.add(car1, car2, barrierMesh, flash);
      rbGroup.position.set(loc.x, 0, loc.z);
      this.group.add(rbGroup);

      this.roadblocks.push({
        x: loc.x,
        z: loc.z,
        group: rbGroup,
        isSmashed: false,
        barrierMesh,
      });
    });
  }

  private clearRoadblocks(): void {
    this.roadblocks.forEach((rb) => this.group.remove(rb.group));
    this.roadblocks = [];
  }

  public checkRoadblockCollision(carX: number, carZ: number, speed: number): boolean {
    for (const rb of this.roadblocks) {
      if (rb.isSmashed) continue;
      const dist = Math.hypot(carX - rb.x, carZ - rb.z);
      if (dist < 4.2) {
        if (Math.abs(speed) > 5.0) {
          rb.isSmashed = true;
          // Scatter barrier with physics simulation
          rb.barrierMesh.position.y += 3.5;
          rb.barrierMesh.rotation.x = Math.PI / 3;
          rb.barrierMesh.rotation.z = Math.PI / 4;
          return true;
        }
      }
    }
    return false;
  }

  public update(dt: number, playerX: number, playerZ: number): void {
    if (this.wantedLevel === 0) return;

    // Siren lights flash animation
    this.sirenTimer += dt * 8;
    const flash = Math.sin(this.sirenTimer) > 0;

    // Update Ground Cop Cruisers
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

    // Update Police Helicopter
    if (this.policeHeli) {
      const heli = this.policeHeli;
      heli.rotor.rotation.y += dt * 32;
      heli.tailRotor.rotation.x += dt * 45;

      heli.sirenLightRed.intensity = flash ? 4 : 0;
      heli.sirenLightBlue.intensity = flash ? 0 : 4;

      // Circle overhead
      const circleAngle = this.sirenTimer * 0.4;
      const desiredX = playerX + Math.sin(circleAngle) * 18;
      const desiredZ = playerZ + Math.cos(circleAngle) * 18;

      heli.x = THREE.MathUtils.lerp(heli.x, desiredX, dt * 1.5);
      heli.z = THREE.MathUtils.lerp(heli.z, desiredZ, dt * 1.5);
      heli.group.position.set(heli.x, heli.y, heli.z);

      // Searchlight tracks player ground location
      heli.searchlightTarget.position.set(playerX - heli.x, -heli.y, playerZ - heli.z);
    }

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
