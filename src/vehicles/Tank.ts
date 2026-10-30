import * as THREE from 'three';

export interface TankInput {
  throttle: boolean;
  reverse: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  fire: boolean;
  turretLeft?: boolean;
  turretRight?: boolean;
}

export class Tank {
  public group: THREE.Group;
  public turretGroup: THREE.Group;
  public barrelMesh: THREE.Mesh;
  public x: number;
  public y: number = 0.8;
  public z: number;
  public heading: number = 0; // Hull heading
  public turretAngle: number = 0; // Relative to hull
  public speed: number = 0;
  public health: number = 800;
  public maxHealth: number = 800;
  public isDestroyed: boolean = false;
  public cannonCooldown: number = 0;
  private recoilTimer: number = 0;

  private leftTreadWheels: THREE.Mesh[] = [];
  private rightTreadWheels: THREE.Mesh[] = [];

  constructor(startX: number, startZ: number, initialHeading: number = 0) {
    this.x = startX;
    this.z = startZ;
    this.heading = initialHeading;

    this.group = new THREE.Group();
    this.turretGroup = new THREE.Group();
    this.barrelMesh = this.buildTank();
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.heading;
  }

  private buildTank(): THREE.Mesh {
    // 1. Lower Chassis & Armored Hull (Military Camo Green / Olive)
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x2e3d23, // Military Olive Green
      roughness: 0.5,
      metalness: 0.8,
    });
    const hullGeo = new THREE.BoxGeometry(3.6, 1.1, 6.2);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.6;
    hull.castShadow = true;
    hull.receiveShadow = true;
    this.group.add(hull);

    // Front Sloped Glacis Armor
    const glacisGeo = new THREE.BoxGeometry(3.5, 0.45, 1.8);
    const glacis = new THREE.Mesh(glacisGeo, hullMat);
    glacis.position.set(0, 0.85, 2.7);
    glacis.rotation.x = -Math.PI / 6;
    this.group.add(glacis);

    // 2. Heavy Steel Tread Skirts & Rollers
    const treadMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, roughness: 0.9 });
    const skirtGeo = new THREE.BoxGeometry(0.5, 0.9, 6.5);

    const leftSkirt = new THREE.Mesh(skirtGeo, treadMat);
    leftSkirt.position.set(-1.85, 0.45, 0);
    const rightSkirt = new THREE.Mesh(skirtGeo, treadMat);
    rightSkirt.position.set(1.85, 0.45, 0);
    this.group.add(leftSkirt, rightSkirt);

    // Tread Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.45, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111411, roughness: 0.8 });

    for (let i = -2.6; i <= 2.6; i += 1.05) {
      const lw = new THREE.Mesh(wheelGeo, wheelMat);
      lw.position.set(-1.85, 0.42, i);
      this.group.add(lw);
      this.leftTreadWheels.push(lw);

      const rw = new THREE.Mesh(wheelGeo, wheelMat);
      rw.position.set(1.85, 0.42, i);
      this.group.add(rw);
      this.rightTreadWheels.push(rw);
    }

    // 3. 360° Rotating Armored Turret
    const turretGeo = new THREE.BoxGeometry(2.4, 0.95, 3.2);
    const turret = new THREE.Mesh(turretGeo, hullMat);
    turret.position.y = 0.48;
    this.turretGroup.add(turret);

    // Commander Cupola & Hatch
    const hatchGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.25, 12);
    const hatch = new THREE.Mesh(hatchGeo, treadMat);
    hatch.position.set(-0.6, 1.05, -0.4);
    this.turretGroup.add(hatch);

    // Heavy 120mm Smoothbore Main Cannon Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.18, 0.22, 4.6, 16);
    barrelGeo.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0x1f2421,
      metalness: 0.9,
      roughness: 0.3,
    });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(0, 0.6, 3.2);
    this.turretGroup.add(barrel);

    // Heavy Muzzle Brake
    const muzzleGeo = new THREE.BoxGeometry(0.55, 0.45, 0.65);
    const muzzle = new THREE.Mesh(muzzleGeo, barrelMat);
    muzzle.position.set(0, 0.6, 5.5);
    this.turretGroup.add(muzzle);

    // Coaxial Heavy Machine Gun
    const coaxGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8);
    coaxGeo.rotateX(Math.PI / 2);
    const coax = new THREE.Mesh(coaxGeo, barrelMat);
    coax.position.set(0.4, 0.7, 2.0);
    this.turretGroup.add(coax);

    this.turretGroup.position.set(0, 1.15, -0.2);
    this.group.add(this.turretGroup);

    return barrel;
  }

  public update(
    dt: number,
    input: TankInput,
    city?: { getRoofHeightAt: (x: number, z: number, r?: number) => number },
  ): { firedCannon: boolean } {
    if (this.isDestroyed) return { firedCannon: false };

    this.cannonCooldown = Math.max(0, this.cannonCooldown - dt);
    if (this.recoilTimer > 0) {
      this.recoilTimer -= dt;
      if (this.recoilTimer <= 0) {
        this.barrelMesh.position.z = 3.2;
      }
    }

    // 1. Dual Track Differential Steering
    const turnRate = 1.4; // rad/s
    if (input.steerLeft) {
      this.heading += turnRate * dt;
    }
    if (input.steerRight) {
      this.heading -= turnRate * dt;
    }
    this.heading = THREE.MathUtils.euclideanModulo(this.heading + Math.PI, Math.PI * 2) - Math.PI;

    // 2. Throttle / Reverse
    const maxSpeed = 22.0; // ~80 km/h
    const accel = 14.0;
    const brake = 22.0;

    if (input.throttle) {
      this.speed = Math.min(maxSpeed, this.speed + accel * dt);
    } else if (input.reverse) {
      this.speed = Math.max(-10.0, this.speed - accel * 0.7 * dt);
    } else {
      // Natural track drag friction
      if (Math.abs(this.speed) < 1.0) {
        this.speed = 0;
      } else {
        this.speed -= Math.sign(this.speed) * brake * 0.5 * dt;
      }
    }

    // Move forward along hull heading
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;

    if (city) {
      const roofH = city.getRoofHeightAt(this.x, this.z, 0);
      this.y = roofH > 0 && this.y >= roofH - 0.8 ? roofH + 0.8 : 0.8;
    }

    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.heading;

    // Spin tread wheels
    const wheelSpin = (this.speed / 0.42) * dt;
    for (const w of this.leftTreadWheels) w.rotation.x += wheelSpin;
    for (const w of this.rightTreadWheels) w.rotation.x += wheelSpin;

    // 3. Turret Aiming
    if (input.turretLeft) this.turretAngle += 1.8 * dt;
    if (input.turretRight) this.turretAngle -= 1.8 * dt;
    this.turretGroup.rotation.y = this.turretAngle;

    // 4. Cannon Fire Check
    let firedCannon = false;
    if (input.fire && this.cannonCooldown <= 0) {
      this.cannonCooldown = 1.8; // 1.8s reload time
      firedCannon = true;
      // Visual cannon recoil kickback
      this.barrelMesh.position.z = 2.7;
      this.recoilTimer = 0.14;
    }

    return { firedCannon };
  }

  public getCannonMuzzlePosition(): THREE.Vector3 {
    const muzzleLocal = new THREE.Vector3(0, 0.6, 5.8);
    muzzleLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.turretAngle);
    muzzleLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    return new THREE.Vector3(
      this.x + muzzleLocal.x,
      this.y + 1.15 + muzzleLocal.y,
      this.z + muzzleLocal.z,
    );
  }

  public getCannonAimVector(): THREE.Vector3 {
    const totalAngle = this.heading + this.turretAngle;
    return new THREE.Vector3(Math.sin(totalAngle), 0, Math.cos(totalAngle)).normalize();
  }

  public takeDamage(amount: number): void {
    if (this.isDestroyed) return;
    // Heavy armor absorbs 60% of all incoming damage
    this.health = Math.max(0, this.health - amount * 0.4);
    if (this.health <= 0) {
      this.isDestroyed = true;
      this.speed = 0;
    }
  }

  public repair(): void {
    this.health = this.maxHealth;
    this.isDestroyed = false;
  }
}
