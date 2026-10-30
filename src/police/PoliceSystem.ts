import * as THREE from 'three';
import { eventBus } from '../utils/EventBus';
import { EVENTS } from '../utils/Constants';
import { City } from '../city/City';
import { disposeObject3D } from '../utils/disposeObject';

export interface CopCar {
  group: THREE.Group;
  x: number;
  y?: number;
  z: number;
  speed: number;
  heading: number;
  health?: number;
  maxHealth?: number;
  isWrecked?: boolean;
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
  health?: number;
  maxHealth?: number;
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

export interface SpikeStrip {
  x: number;
  z: number;
  group: THREE.Group;
  isTriggered: boolean;
  hazardLight: THREE.PointLight;
}

export class PoliceSystem {
  public wantedLevel: number = 0; // 0 to 5 stars
  public crimeScore: number = 0;
  public isSuppressed: boolean = false;
  public copCars: CopCar[] = [];
  public policeHeli: PoliceHeli | null = null;
  public roadblocks: Roadblock[] = [];
  public spikeStrips: SpikeStrip[] = [];
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
    const clamped = Math.max(0, Math.min(6, Math.floor(level)));
    if (this.wantedLevel !== clamped) {
      this.wantedLevel = clamped;
      const thresholds = [0, 10, 25, 50, 80, 120, 180];
      this.crimeScore = thresholds[this.wantedLevel] || 0;
      eventBus.emit(EVENTS.WANTED_CHANGE, { wantedLevel: this.wantedLevel });
      this.adjustCopPresence();
    }
  }

  public addCrimeSeverity(points: number): void {
    if (this.isSuppressed || points <= 0) return;
    this.crimeScore += points;

    if (this.crimeScore >= 180) {
      this.setWantedLevel(6);
    } else if (this.crimeScore >= 120) {
      this.setWantedLevel(5);
    } else if (this.crimeScore >= 80) {
      this.setWantedLevel(4);
    } else if (this.crimeScore >= 50) {
      this.setWantedLevel(3);
    } else if (this.crimeScore >= 25) {
      this.setWantedLevel(2);
    } else if (this.crimeScore >= 10) {
      this.setWantedLevel(1);
    }
  }

  public damageCopCar(cop: CopCar, amount: number): void {
    if (cop.health === undefined) {
      cop.health = 120;
      cop.maxHealth = 120;
    }
    cop.health -= amount;
    if (cop.health <= 0) {
      cop.isWrecked = true;
      cop.speed = 0;
      // Visually darken chassis
      cop.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          if (m.material && (m.material as THREE.MeshStandardMaterial).color) {
            (m.material as THREE.MeshStandardMaterial).color.setHex(0x1e293b);
          }
        }
      });
      const idx = this.copCars.indexOf(cop);
      if (idx !== -1) {
        this.copCars.splice(idx, 1);
        this.group.remove(cop.group);
        disposeObject3D(cop.group);
      }
    }
  }

  public damagePoliceHeli(amount: number): void {
    if (!this.policeHeli) return;
    if (this.policeHeli.health === undefined) {
      this.policeHeli.health = 250;
      this.policeHeli.maxHealth = 250;
    }
    this.policeHeli.health -= amount;
    if (this.policeHeli.health <= 0) {
      this.despawnPoliceHelicopter();
    }
  }

  private adjustCopPresence(): void {
    const targetCops = this.wantedLevel === 0 ? 0 : Math.min(4, this.wantedLevel);

    while (this.copCars.length < targetCops) {
      this.spawnCopCar();
    }
    while (this.copCars.length > targetCops) {
      const removed = this.copCars.pop();
      if (removed) {
        this.group.remove(removed.group);
        disposeObject3D(removed.group);
      }
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

    // Spike Strips at 3 to 5 stars
    if (this.wantedLevel >= 3 && this.spikeStrips.length === 0) {
      this.spawnSpikeStrips();
    } else if (this.wantedLevel < 3 && this.spikeStrips.length > 0) {
      this.clearSpikeStrips();
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

    // Add only visible emissive siren meshes to copGroup (avoids dynamic PointLight budget overflow)
    copGroup.add(sirenMeshRed, sirenMeshBlue);

    // Spawn 70m away
    const angle = Math.random() * Math.PI * 2;
    let spawnX = Math.cos(angle) * 70;
    let spawnZ = Math.sin(angle) * 70;

    if (this.city) {
      const fixed = this.city.resolveBuildingIntersection(spawnX, spawnZ, 2.2, 1.2);
      if (fixed.corrected) {
        spawnX = fixed.x;
        spawnZ = fixed.z;
      }
    }

    copGroup.position.set(spawnX, 0, spawnZ);
    this.group.add(copGroup);

    this.copCars.push({
      group: copGroup,
      x: spawnX,
      y: 0,
      z: spawnZ,
      speed: 0,
      heading: angle,
      health: 120,
      maxHealth: 120,
      isWrecked: false,
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
    searchlight.visible = false;
    const searchlightTarget = new THREE.Object3D();
    searchlightTarget.position.set(0, -38, 0);
    heliGroup.add(searchlight);
    heliGroup.add(searchlightTarget);
    searchlight.target = searchlightTarget;

    // Siren Lights kept on interface for intensity calculation without adding to scene
    const sirenLightRed = new THREE.PointLight(0xff0000, 3, 25);
    sirenLightRed.position.set(-0.6, 0.4, 0);
    const sirenLightBlue = new THREE.PointLight(0x0066ff, 3, 25);
    sirenLightBlue.position.set(0.6, 0.4, 0);

    heliGroup.position.set(0, 38, 0);
    this.group.add(heliGroup);

    this.policeHeli = {
      group: heliGroup,
      x: 0,
      y: 38,
      z: 0,
      health: 250,
      maxHealth: 250,
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
      disposeObject3D(this.policeHeli.group);
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

      // Emissive roadblock cars and barrier (no dynamic point light needed)
      rbGroup.add(car1, car2, barrierMesh);
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
    this.roadblocks.forEach((rb) => {
      this.group.remove(rb.group);
      disposeObject3D(rb.group);
    });
    this.roadblocks = [];
  }

  private spawnSpikeStrips(): void {
    const locations = [
      { x: 0, z: 44, rot: Math.PI / 2 },
      { x: 44, z: 0, rot: 0 },
      { x: -44, z: 88, rot: Math.PI / 2 },
      { x: 88, z: -44, rot: 0 },
    ];

    locations.forEach((loc) => {
      const g = new THREE.Group();

      // Main heavy steel base strip with rubber padding
      const barGeo = new THREE.BoxGeometry(8.5, 0.1, 0.55);
      const barMat = new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        roughness: 0.6,
        metalness: 0.7,
      });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.y = 0.05;
      g.add(bar);

      // Warning hazard stripes (Black & Yellow)
      const stripeGeo = new THREE.BoxGeometry(8.3, 0.11, 0.2);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.y = 0.06;
      g.add(stripe);

      // Rows of sharp puncture spikes
      const spikeGeo = new THREE.ConeGeometry(0.07, 0.32, 6);
      const spikeMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.95,
        roughness: 0.15,
      });

      for (let i = -3.8; i <= 3.8; i += 0.4) {
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.set(i, 0.2, (Math.random() - 0.5) * 0.15);
        g.add(spike);
      }

      // Blinking orange hazard light retained on interface without adding to scene
      const hazardLight = new THREE.PointLight(0xf97316, 2.5, 8);
      hazardLight.position.set(0, 0.4, 0);

      g.position.set(loc.x, 0.03, loc.z);
      g.rotation.y = loc.rot;
      this.group.add(g);

      this.spikeStrips.push({
        x: loc.x,
        z: loc.z,
        group: g,
        isTriggered: false,
        hazardLight,
      });
    });
  }

  private clearSpikeStrips(): void {
    this.spikeStrips.forEach((s) => {
      this.group.remove(s.group);
      disposeObject3D(s.group);
    });
    this.spikeStrips = [];
  }

  public checkSpikeStripCollision(carX: number, carZ: number, carY: number = 0): boolean {
    // Spike strips lie on the road; cannot puncture tires of jumping, hovering, or flying car
    if (carY > 1.2) return false;

    for (const strip of this.spikeStrips) {
      if (strip.isTriggered) continue;
      const dist = Math.hypot(carX - strip.x, carZ - strip.z);
      if (dist < 4.2) {
        strip.isTriggered = true;
        strip.hazardLight.color.setHex(0xef4444);
        strip.hazardLight.intensity = 5;
        eventBus.emit(EVENTS.NOTIFICATION, {
          text: '⚠️ REIFEN ZERSTOCHEN! Nagelsperre überfahren! Zur Werkstatt für Reparatur!',
        });
        return true;
      }
    }
    return false;
  }

  public checkPitManeuver(
    playerX: number,
    playerZ: number,
    playerHeading: number,
    speed: number,
    playerY: number = 0,
    isAirborne: boolean = false,
  ): { triggered: boolean; spinDir: number } {
    // Ground cruisers cannot PIT-maneuver a car that is in the air, jumping, or hovering
    if (isAirborne || playerY > 1.8) return { triggered: false, spinDir: 0 };
    if (Math.abs(speed) < 10.0) return { triggered: false, spinDir: 0 };

    for (const cop of this.copCars) {
      const copY = cop.y ?? 0;
      if (Math.abs(playerY - copY) > 1.8) continue;

      const dx = playerX - cop.x;
      const dz = playerZ - cop.z;
      const dist = Math.hypot(dx, dz);

      // Cop is close behind player at speed
      if (dist < 3.8 && dist > 1.0) {
        const forwardX = Math.sin(playerHeading);
        const forwardZ = Math.cos(playerHeading);
        const dot = (cop.x - playerX) * forwardX + (cop.z - playerZ) * forwardZ;

        // Cop is hitting rear corners
        if (dot < -0.6) {
          const cross = (cop.x - playerX) * forwardZ - (cop.z - playerZ) * forwardX;
          const spinDir = cross > 0 ? 1 : -1;
          return { triggered: true, spinDir };
        }
      }
    }
    return { triggered: false, spinDir: 0 };
  }

  public checkRoadblockCollision(
    carX: number,
    carZ: number,
    speed: number,
    carY: number = 0,
  ): boolean {
    // High jump clears roadblocks (height ~1.2m)
    if (carY > 2.2) return false;

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

  public update(dt: number, playerX: number, playerZ: number, playerY: number = 0): void {
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

      // Accelerate towards player (only try to ram if player is near ground level)
      const maxCopSpeed = 22 + this.wantedLevel * 4;
      const copY = cop.y ?? 0;
      const dy = Math.abs(playerY - copY);
      if (dist > 4 || dy > 2.2) {
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

      // Map boundary containment for cop cruisers (expanded city grid)
      if (cop.x > 380) {
        cop.x = 380;
        cop.heading = -Math.PI / 2;
      } else if (cop.x < -410) {
        cop.x = -410;
        cop.heading = Math.PI / 2;
      }
      if (cop.z > 380) {
        cop.z = 380;
        cop.heading = Math.PI;
      } else if (cop.z < -380) {
        cop.z = -380;
        cop.heading = 0;
      }

      cop.group.position.set(cop.x, copY, cop.z);
      cop.group.rotation.y = cop.heading;
    });

    // Update Police Helicopter
    if (this.policeHeli) {
      const heli = this.policeHeli;
      heli.rotor.rotation.y += dt * 32;
      heli.tailRotor.rotation.x += dt * 45;

      heli.sirenLightRed.intensity = flash ? 4 : 0;
      heli.sirenLightBlue.intensity = flash ? 0 : 4;
      heli.searchlight.visible = this.wantedLevel >= 4;

      // Circle overhead
      const circleAngle = this.sirenTimer * 0.4;
      const desiredX = playerX + Math.sin(circleAngle) * 18;
      const desiredZ = playerZ + Math.cos(circleAngle) * 18;

      heli.x = THREE.MathUtils.lerp(heli.x, desiredX, dt * 1.5);
      heli.z = THREE.MathUtils.lerp(heli.z, desiredZ, dt * 1.5);
      heli.group.position.set(heli.x, heli.y, heli.z);

      // Searchlight tracks player 3D location
      heli.searchlightTarget.position.set(playerX - heli.x, playerY - heli.y, playerZ - heli.z);
    }

    // Cooldown logic when escaping far away (> 80m in 3D space)
    const closestDist = this.copCars.reduce((min, cop) => {
      const copY = cop.y ?? 0;
      return Math.min(min, Math.hypot(playerX - cop.x, playerY - copY, playerZ - cop.z));
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
