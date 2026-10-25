import * as THREE from 'three';
import { CarPhysics, CarInput } from './CarPhysics';
import { VEHICLE_CONFIG } from '../utils/Constants';

export class Car {
  public group: THREE.Group;
  public physics: CarPhysics;
  public health: number = VEHICLE_CONFIG.MAX_HEALTH;
  public isDestroyed: boolean = false;

  private frontLeftWheel!: THREE.Group;
  private frontRightWheel!: THREE.Group;
  private rearLeftWheel!: THREE.Group;
  private rearRightWheel!: THREE.Group;
  private carBodyGroup: THREE.Group;
  private bodyMesh!: THREE.Mesh;

  private headlightLeft!: THREE.SpotLight;
  private headlightRight!: THREE.SpotLight;
  private taillightMaterial!: THREE.MeshStandardMaterial;

  // Nitro twin exhaust flame cones
  private nitroFlameLeft!: THREE.Mesh;
  private nitroFlameRight!: THREE.Mesh;
  private underglowLight!: THREE.PointLight;

  // Damage smoke & flame particles
  private smokeParticles!: THREE.Points;
  private smokeGeometry!: THREE.BufferGeometry;
  private smokePositions!: Float32Array;

  constructor(
    startX: number = 0,
    startZ: number = 0,
    heading: number = 0,
    bodyColor: number = 0xe62429,
  ) {
    this.physics = new CarPhysics(startX, startZ, heading);
    this.group = new THREE.Group();
    this.carBodyGroup = new THREE.Group();
    this.group.add(this.carBodyGroup);

    this.buildCarModel(bodyColor);
    this.initSmokeParticles();
    this.initNitroAndUnderglow();
  }

  private buildCarModel(bodyColor: number): void {
    // 1. Lower Chassis
    const bodyGeo = new THREE.BoxGeometry(VEHICLE_CONFIG.CAR_WIDTH, 0.6, VEHICLE_CONFIG.CAR_LENGTH);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = 0.5;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.carBodyGroup.add(this.bodyMesh);

    // 2. Cabin / Windshield / Roof
    const cabinGeo = new THREE.BoxGeometry(VEHICLE_CONFIG.CAR_WIDTH * 0.85, 0.55, 2.2);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x111625,
      metalness: 0.9,
      roughness: 0.1,
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
    cabinMesh.position.set(0, 0.95, -0.2);
    cabinMesh.castShadow = true;
    this.carBodyGroup.add(cabinMesh);

    // 3. Rear Wing / Spoiler
    const spoilerWing = new THREE.Mesh(
      new THREE.BoxGeometry(VEHICLE_CONFIG.CAR_WIDTH * 0.9, 0.08, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }),
    );
    spoilerWing.position.set(0, 1.15, -VEHICLE_CONFIG.CAR_LENGTH / 2 + 0.3);
    this.carBodyGroup.add(spoilerWing);

    // Spoiler struts
    const strutMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const strutLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.1), strutMat);
    strutLeft.position.set(-0.6, 0.95, -VEHICLE_CONFIG.CAR_LENGTH / 2 + 0.3);
    const strutRight = strutLeft.clone();
    strutRight.position.x = 0.6;
    this.carBodyGroup.add(strutLeft, strutRight);

    // 4. Headlights
    const lightGlowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headlightGeo = new THREE.BoxGeometry(0.35, 0.15, 0.1);

    const hlLeft = new THREE.Mesh(headlightGeo, lightGlowMat);
    hlLeft.position.set(-0.65, 0.55, VEHICLE_CONFIG.CAR_LENGTH / 2 + 0.02);
    const hlRight = new THREE.Mesh(headlightGeo, lightGlowMat);
    hlRight.position.set(0.65, 0.55, VEHICLE_CONFIG.CAR_LENGTH / 2 + 0.02);
    this.carBodyGroup.add(hlLeft, hlRight);

    this.headlightLeft = new THREE.SpotLight(0xfffaed, 2.5, 45, Math.PI / 6, 0.4);
    this.headlightLeft.position.set(-0.65, 0.55, VEHICLE_CONFIG.CAR_LENGTH / 2);
    this.headlightLeft.target.position.set(-0.65, 0, VEHICLE_CONFIG.CAR_LENGTH / 2 + 20);
    this.carBodyGroup.add(this.headlightLeft);
    this.carBodyGroup.add(this.headlightLeft.target);

    this.headlightRight = new THREE.SpotLight(0xfffaed, 2.5, 45, Math.PI / 6, 0.4);
    this.headlightRight.position.set(0.65, 0.55, VEHICLE_CONFIG.CAR_LENGTH / 2);
    this.headlightRight.target.position.set(0.65, 0, VEHICLE_CONFIG.CAR_LENGTH / 2 + 20);
    this.carBodyGroup.add(this.headlightRight);
    this.carBodyGroup.add(this.headlightRight.target);

    // 5. Taillights
    this.taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xaa0000,
      emissive: 0x660000,
      roughness: 0.3,
    });
    const tlLeft = new THREE.Mesh(headlightGeo, this.taillightMaterial);
    tlLeft.position.set(-0.65, 0.55, -VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.02);
    const tlRight = tlLeft.clone();
    tlRight.position.x = 0.65;
    this.carBodyGroup.add(tlLeft, tlRight);

    // 6. Wheels
    const wheelTrack = VEHICLE_CONFIG.CAR_WIDTH / 2 + 0.08;
    const wheelBase = VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.85;

    this.frontLeftWheel = this.createWheel();
    this.frontLeftWheel.position.set(-wheelTrack, VEHICLE_CONFIG.WHEEL_RADIUS, wheelBase);

    this.frontRightWheel = this.createWheel();
    this.frontRightWheel.position.set(wheelTrack, VEHICLE_CONFIG.WHEEL_RADIUS, wheelBase);

    this.rearLeftWheel = this.createWheel();
    this.rearLeftWheel.position.set(-wheelTrack, VEHICLE_CONFIG.WHEEL_RADIUS, -wheelBase);

    this.rearRightWheel = this.createWheel();
    this.rearRightWheel.position.set(wheelTrack, VEHICLE_CONFIG.WHEEL_RADIUS, -wheelBase);

    this.group.add(
      this.frontLeftWheel,
      this.frontRightWheel,
      this.rearLeftWheel,
      this.rearRightWheel,
    );
  }

  private createWheel(): THREE.Group {
    const wheelGroup = new THREE.Group();

    const tireGeo = new THREE.CylinderGeometry(
      VEHICLE_CONFIG.WHEEL_RADIUS,
      VEHICLE_CONFIG.WHEEL_RADIUS,
      0.32,
      16,
    );
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.9,
    });
    const tireMesh = new THREE.Mesh(tireGeo, tireMat);
    tireMesh.castShadow = true;
    wheelGroup.add(tireMesh);

    const rimGeo = new THREE.CylinderGeometry(
      VEHICLE_CONFIG.WHEEL_RADIUS * 0.6,
      VEHICLE_CONFIG.WHEEL_RADIUS * 0.6,
      0.34,
      8,
    );
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd8d8d8,
      metalness: 0.9,
      roughness: 0.1,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    wheelGroup.add(rimMesh);

    return wheelGroup;
  }

  private initNitroAndUnderglow(): void {
    // Twin Nitro Exhaust Flames
    const flameGeo = new THREE.ConeGeometry(0.18, 0.9, 8);
    flameGeo.rotateX(Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.0,
    });

    this.nitroFlameLeft = new THREE.Mesh(flameGeo, flameMat);
    this.nitroFlameLeft.position.set(-0.45, 0.35, -VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.45);

    this.nitroFlameRight = new THREE.Mesh(flameGeo, flameMat);
    this.nitroFlameRight.position.set(0.45, 0.35, -VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.45);

    this.carBodyGroup.add(this.nitroFlameLeft, this.nitroFlameRight);

    // Cyan Underglow Light
    this.underglowLight = new THREE.PointLight(0x00d4ff, 2.5, 6);
    this.underglowLight.position.set(0, 0.15, 0);
    this.carBodyGroup.add(this.underglowLight);
  }

  private initSmokeParticles(): void {
    const count = 30;
    this.smokePositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.smokePositions[i * 3] = (Math.random() - 0.5) * 0.6;
      this.smokePositions[i * 3 + 1] = 0.8 + Math.random() * 2.0;
      this.smokePositions[i * 3 + 2] =
        VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.5 + (Math.random() - 0.5) * 0.6;
    }

    this.smokeGeometry = new THREE.BufferGeometry();
    this.smokeGeometry.setAttribute('position', new THREE.BufferAttribute(this.smokePositions, 3));

    const smokeMat = new THREE.PointsMaterial({
      color: 0x222222,
      size: 0.8,
      transparent: true,
      opacity: 0.0,
    });

    this.smokeParticles = new THREE.Points(this.smokeGeometry, smokeMat);
    this.carBodyGroup.add(this.smokeParticles);
  }

  public takeDamage(amount: number): void {
    if (this.isDestroyed) return;

    this.health = Math.max(0, this.health - amount);

    if (this.health <= 0) {
      this.isDestroyed = true;
      (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0x1a1a1a);
      this.physics.speed = 0;
    } else if (this.health < 40) {
      (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0x442222);
    }
  }

  public repair(): void {
    this.health = VEHICLE_CONFIG.MAX_HEALTH;
    this.isDestroyed = false;
    (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0xe62429);
  }

  public setColor(colorHex: number): void {
    (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(colorHex);
  }

  public toggleHeadlights(): boolean {
    const newState = !this.headlightLeft.visible;
    this.headlightLeft.visible = newState;
    this.headlightRight.visible = newState;
    return newState;
  }

  public update(
    dt: number,
    input: CarInput,
  ): { stuntCompleted: boolean; distance: number; airtime: number } {
    let stuntResult = { stuntCompleted: false, distance: 0, airtime: 0 };
    if (!this.isDestroyed) {
      stuntResult = this.physics.update(dt, input);
    }

    // Update positions
    this.group.position.set(this.physics.x, this.physics.y, this.physics.z);
    this.group.rotation.y = this.physics.heading;

    // Body roll
    const lateralSpeed = this.physics.speed * Math.sin(this.physics.steerAngle);
    const rollAngle = -lateralSpeed * 0.015;
    this.carBodyGroup.rotation.z = THREE.MathUtils.lerp(
      this.carBodyGroup.rotation.z,
      rollAngle,
      0.2,
    );

    // Airborne pitch tilt
    if (this.physics.isAirborne) {
      this.carBodyGroup.rotation.x = THREE.MathUtils.lerp(
        this.carBodyGroup.rotation.x,
        -this.physics.vy * 0.03,
        0.1,
      );
    } else {
      this.carBodyGroup.rotation.x = THREE.MathUtils.lerp(this.carBodyGroup.rotation.x, 0, 0.2);
    }

    // Taillight glow on brake
    if (input.reverse && this.physics.speed > 0) {
      this.taillightMaterial.emissive.setHex(0xff1111);
    } else {
      this.taillightMaterial.emissive.setHex(0x550000);
    }

    // Nitro Flame Cones animation
    const flameMat = this.nitroFlameLeft.material as THREE.MeshBasicMaterial;
    if (this.physics.isBoosting) {
      flameMat.opacity = 0.95;
      const flicker = 0.8 + Math.random() * 0.4;
      this.nitroFlameLeft.scale.set(flicker, flicker, flicker * 1.4);
      this.nitroFlameRight.scale.set(flicker, flicker, flicker * 1.4);
      this.underglowLight.intensity = 5.0;
    } else {
      flameMat.opacity = 0;
      this.underglowLight.intensity = 1.8;
    }

    // Front wheels steering
    this.frontLeftWheel.rotation.y = this.physics.steerAngle;
    this.frontRightWheel.rotation.y = this.physics.steerAngle;

    // Wheel roll rotation
    this.frontLeftWheel.children.forEach((c) => (c.rotation.x = this.physics.wheelRotation));
    this.frontRightWheel.children.forEach((c) => (c.rotation.x = this.physics.wheelRotation));
    this.rearLeftWheel.children.forEach((c) => (c.rotation.x = this.physics.wheelRotation));
    this.rearRightWheel.children.forEach((c) => (c.rotation.x = this.physics.wheelRotation));

    // Smoke particles animation
    const smokeMat = this.smokeParticles.material as THREE.PointsMaterial;
    if (this.health < 60) {
      smokeMat.opacity = THREE.MathUtils.lerp(
        smokeMat.opacity,
        this.health <= 0 ? 0.9 : (60 - this.health) / 60,
        0.1,
      );
      if (this.health < 25) {
        smokeMat.color.setHex(0xff3300);
      } else {
        smokeMat.color.setHex(0x333333);
      }

      const pos = this.smokePositions;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 1] += dt * 2.5;
        if (pos[i * 3 + 1] > 3.5) {
          pos[i * 3 + 1] = 0.8;
          pos[i * 3] = (Math.random() - 0.5) * 0.8;
          pos[i * 3 + 2] = VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.5 + (Math.random() - 0.5) * 0.8;
        }
      }
      this.smokeGeometry.attributes.position.needsUpdate = true;
    } else {
      smokeMat.opacity = 0;
    }

    return stuntResult;
  }
}
