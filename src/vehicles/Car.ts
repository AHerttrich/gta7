import * as THREE from 'three';
import { CarPhysics, CarInput } from './CarPhysics';
import { VEHICLE_CONFIG } from '../utils/Constants';

export class Car {
  public group: THREE.Group;
  public physics: CarPhysics;
  public health: number = VEHICLE_CONFIG.MAX_HEALTH;
  public isDestroyed: boolean = false;

  // Wheel assemblies with folding hover pivots
  private flPivot!: THREE.Group;
  private frPivot!: THREE.Group;
  private rlPivot!: THREE.Group;
  private rrPivot!: THREE.Group;

  private flWheel!: THREE.Group;
  private frWheel!: THREE.Group;
  private rlWheel!: THREE.Group;
  private rrWheel!: THREE.Group;

  // Hover thruster plasma disks & lights
  private flThrusterDisk!: THREE.Mesh;
  private frThrusterDisk!: THREE.Mesh;
  private rlThrusterDisk!: THREE.Mesh;
  private rrThrusterDisk!: THREE.Mesh;
  private hoverGlowLight!: THREE.PointLight;

  private carBodyGroup: THREE.Group;
  private bodyMesh!: THREE.Mesh;

  private headlightLeft!: THREE.SpotLight;
  private headlightRight!: THREE.SpotLight;
  private headlightConeLeft!: THREE.Mesh;
  private headlightConeRight!: THREE.Mesh;
  private headlightConeMat!: THREE.MeshBasicMaterial;
  private taillightMaterial!: THREE.MeshStandardMaterial;

  // Nitro twin exhaust flame cones
  private nitroFlameLeft!: THREE.Mesh;
  private nitroFlameRight!: THREE.Mesh;
  private underglowLight!: THREE.PointLight;

  // Damage smoke & flame particles
  private smokeParticles!: THREE.Points;
  private smokeGeometry!: THREE.BufferGeometry;
  private smokePositions!: Float32Array;

  // Hover particle stream
  private hoverParticles!: THREE.Points;
  private hoverPositions!: Float32Array;
  public baseColor: number = 0xd1d5db;

  constructor(
    startX: number = 0,
    startZ: number = 0,
    heading: number = 0,
    bodyColor: number = 0xd1d5db, // DeLorean Brushed Stainless Steel
  ) {
    this.baseColor = bodyColor;
    this.physics = new CarPhysics(startX, startZ, heading);
    this.group = new THREE.Group();
    this.carBodyGroup = new THREE.Group();
    this.group.add(this.carBodyGroup);

    this.buildDeLoreanModel(bodyColor);
    this.initSmokeParticles();
    this.initHoverParticles();
    this.initNitroAndUnderglow();
  }

  private buildDeLoreanModel(bodyColor: number): void {
    // 1. Lower Main Chassis (Low-slung wedge profile)
    const bodyGeo = new THREE.BoxGeometry(
      VEHICLE_CONFIG.CAR_WIDTH,
      0.48,
      VEHICLE_CONFIG.CAR_LENGTH,
    );
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      metalness: 0.94,
      roughness: 0.22,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = 0.44;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.carBodyGroup.add(this.bodyMesh);

    // 2. Sloped Aerodynamic Front Wedge Hood
    const hoodGeo = new THREE.BoxGeometry(VEHICLE_CONFIG.CAR_WIDTH * 0.94, 0.2, 1.5);
    const hoodMesh = new THREE.Mesh(hoodGeo, bodyMat);
    hoodMesh.position.set(0, 0.52, 1.4);
    hoodMesh.rotation.x = -0.08;
    hoodMesh.castShadow = true;
    this.carBodyGroup.add(hoodMesh);

    // Front Black Bumper & Lower Chin Spoiler
    const bumperMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
    const frontBumper = new THREE.Mesh(
      new THREE.BoxGeometry(VEHICLE_CONFIG.CAR_WIDTH * 1.02, 0.22, 0.35),
      bumperMat,
    );
    frontBumper.position.set(0, 0.32, VEHICLE_CONFIG.CAR_LENGTH / 2 + 0.1);
    this.carBodyGroup.add(frontBumper);

    // Iconic DeLorean Black Side Rub Strips
    const stripGeo = new THREE.BoxGeometry(0.04, 0.08, VEHICLE_CONFIG.CAR_LENGTH * 0.95);
    const stripLeft = new THREE.Mesh(stripGeo, bumperMat);
    stripLeft.position.set(-VEHICLE_CONFIG.CAR_WIDTH / 2 - 0.01, 0.45, 0);
    const stripRight = stripLeft.clone();
    stripRight.position.x = VEHICLE_CONFIG.CAR_WIDTH / 2 + 0.01;
    this.carBodyGroup.add(stripLeft, stripRight);

    // 3. Cabin / Glass Cockpit / Gullwing Door Seams
    const cabinGeo = new THREE.BoxGeometry(VEHICLE_CONFIG.CAR_WIDTH * 0.84, 0.52, 2.1);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.08,
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
    cabinMesh.position.set(0, 0.88, -0.15);
    cabinMesh.castShadow = true;
    this.carBodyGroup.add(cabinMesh);

    // Roof T-Top Center Bar
    const tTopBar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 1.4), bodyMat);
    tTopBar.position.set(0, 1.15, -0.1);
    this.carBodyGroup.add(tTopBar);

    // 4. Rear Window Louvers (Stepped horizontal black slats)
    const louverMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
    for (let l = 0; l < 5; l++) {
      const louver = new THREE.Mesh(
        new THREE.BoxGeometry(VEHICLE_CONFIG.CAR_WIDTH * 0.8, 0.03, 0.16),
        louverMat,
      );
      louver.position.set(0, 0.78 + l * 0.065, -0.75 - l * 0.22);
      this.carBodyGroup.add(louver);
    }

    // 5. Rear Time Machine Reactor Deck & Nuclear Thruster Vents
    const reactorBox = new THREE.Mesh(
      new THREE.BoxGeometry(VEHICLE_CONFIG.CAR_WIDTH * 0.75, 0.35, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 }),
    );
    reactorBox.position.set(0, 0.72, -VEHICLE_CONFIG.CAR_LENGTH / 2 + 0.35);
    this.carBodyGroup.add(reactorBox);

    // Twin Cylindrical Thruster Exhaust Vents
    const ventGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.45, 16);
    ventGeo.rotateX(Math.PI / 2);
    const ventMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.2,
    });

    const ventLeft = new THREE.Mesh(ventGeo, ventMat);
    ventLeft.position.set(-0.48, 0.72, -VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.15);
    const ventRight = ventLeft.clone();
    ventRight.position.x = 0.48;
    this.carBodyGroup.add(ventLeft, ventRight);

    // Glowing Cyan Energy Rings inside Thruster Vents
    const energyRingGeo = new THREE.TorusGeometry(0.18, 0.03, 8, 16);
    const energyRingMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const ringLeft = new THREE.Mesh(energyRingGeo, energyRingMat);
    ringLeft.position.set(-0.48, 0.72, -VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.32);
    const ringRight = ringLeft.clone();
    ringRight.position.x = 0.48;
    this.carBodyGroup.add(ringLeft, ringRight);

    // Glowing Neon Flux Conduit Wiring along Rear Sides
    const conduitGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8);
    conduitGeo.rotateX(Math.PI / 2);
    const conduitMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const condLeft = new THREE.Mesh(conduitGeo, conduitMat);
    condLeft.position.set(-VEHICLE_CONFIG.CAR_WIDTH / 2 - 0.02, 0.58, -1.1);
    const condRight = condLeft.clone();
    condRight.position.x = VEHICLE_CONFIG.CAR_WIDTH / 2 + 0.02;
    this.carBodyGroup.add(condLeft, condRight);

    // 6. Cyber Headlights (Quad Rectangular LED Array + Cyan Accent)
    const ledGlowMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const quadGeo = new THREE.BoxGeometry(0.22, 0.1, 0.08);

    const hl1 = new THREE.Mesh(quadGeo, ledGlowMat);
    hl1.position.set(-0.7, 0.48, VEHICLE_CONFIG.CAR_LENGTH / 2 + 0.05);
    const hl2 = new THREE.Mesh(quadGeo, ledGlowMat);
    hl2.position.set(-0.44, 0.48, VEHICLE_CONFIG.CAR_LENGTH / 2 + 0.05);

    const hr1 = new THREE.Mesh(quadGeo, ledGlowMat);
    hr1.position.set(0.44, 0.48, VEHICLE_CONFIG.CAR_LENGTH / 2 + 0.05);
    const hr2 = new THREE.Mesh(quadGeo, ledGlowMat);
    hr2.position.set(0.7, 0.48, VEHICLE_CONFIG.CAR_LENGTH / 2 + 0.05);

    this.carBodyGroup.add(hl1, hl2, hr1, hr2);

    // Glowing Cyan Grille Cyber Line
    const cyberLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.04, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
    );
    cyberLine.position.set(0, 0.48, VEHICLE_CONFIG.CAR_LENGTH / 2 + 0.05);
    this.carBodyGroup.add(cyberLine);

    // Spotlights for Night/Day illumination
    this.headlightLeft = new THREE.SpotLight(0xfffaed, 2.8, 50, Math.PI / 6, 0.4);
    this.headlightLeft.position.set(-0.55, 0.48, VEHICLE_CONFIG.CAR_LENGTH / 2);
    this.headlightLeft.target.position.set(-0.55, 0, VEHICLE_CONFIG.CAR_LENGTH / 2 + 25);
    this.carBodyGroup.add(this.headlightLeft);
    this.carBodyGroup.add(this.headlightLeft.target);

    this.headlightRight = new THREE.SpotLight(0xfffaed, 2.8, 50, Math.PI / 6, 0.4);
    this.headlightRight.position.set(0.55, 0.48, VEHICLE_CONFIG.CAR_LENGTH / 2);
    this.headlightRight.target.position.set(0.55, 0, VEHICLE_CONFIG.CAR_LENGTH / 2 + 25);
    this.carBodyGroup.add(this.headlightRight);
    this.carBodyGroup.add(this.headlightRight.target);

    // Volumetric 3D Headlight Light Beams (Soft Additive Light Cones)
    const coneGeo = new THREE.CylinderGeometry(0.12, 1.45, 18, 12, 1, true);
    coneGeo.rotateX(Math.PI / 2);
    this.headlightConeMat = new THREE.MeshBasicMaterial({
      color: 0xfffaed,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.headlightConeLeft = new THREE.Mesh(coneGeo, this.headlightConeMat);
    this.headlightConeLeft.position.set(-0.55, 0.44, VEHICLE_CONFIG.CAR_LENGTH / 2 + 9.0);
    this.headlightConeRight = new THREE.Mesh(coneGeo, this.headlightConeMat);
    this.headlightConeRight.position.set(0.55, 0.44, VEHICLE_CONFIG.CAR_LENGTH / 2 + 9.0);
    this.carBodyGroup.add(this.headlightConeLeft, this.headlightConeRight);

    // 7. Wide Segmented Cyber Taillight Bar
    this.taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0033,
      emissive: 0xaa0022,
      roughness: 0.2,
    });
    const tlBar = new THREE.Mesh(
      new THREE.BoxGeometry(VEHICLE_CONFIG.CAR_WIDTH * 0.94, 0.12, 0.06),
      this.taillightMaterial,
    );
    tlBar.position.set(0, 0.5, -VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.02);
    this.carBodyGroup.add(tlBar);

    // "OUTATIME" / GTA 7 Glowing License Plate
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.14, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    );
    plate.position.set(0, 0.32, -VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.02);
    this.carBodyGroup.add(plate);

    // 8. Folding Hover Thruster Wheels (Back to the Future II style)
    const wheelTrack = VEHICLE_CONFIG.CAR_WIDTH / 2 + 0.08;
    const wheelBase = VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.85;

    // Create Pivots (allow 90° horizontal folding into hover thruster position)
    this.flPivot = new THREE.Group();
    this.flPivot.position.set(-wheelTrack, VEHICLE_CONFIG.WHEEL_RADIUS, wheelBase);
    const flW = this.createWheelWithThruster(true);
    this.flWheel = flW.wheel;
    this.flThrusterDisk = flW.thruster;
    this.flPivot.add(this.flWheel);

    this.frPivot = new THREE.Group();
    this.frPivot.position.set(wheelTrack, VEHICLE_CONFIG.WHEEL_RADIUS, wheelBase);
    const frW = this.createWheelWithThruster(false);
    this.frWheel = frW.wheel;
    this.frThrusterDisk = frW.thruster;
    this.frPivot.add(this.frWheel);

    this.rlPivot = new THREE.Group();
    this.rlPivot.position.set(-wheelTrack, VEHICLE_CONFIG.WHEEL_RADIUS, -wheelBase);
    const rlW = this.createWheelWithThruster(true);
    this.rlWheel = rlW.wheel;
    this.rlThrusterDisk = rlW.thruster;
    this.rlPivot.add(this.rlWheel);

    this.rrPivot = new THREE.Group();
    this.rrPivot.position.set(wheelTrack, VEHICLE_CONFIG.WHEEL_RADIUS, -wheelBase);
    const rrW = this.createWheelWithThruster(false);
    this.rrWheel = rrW.wheel;
    this.rrThrusterDisk = rrW.thruster;
    this.rrPivot.add(this.rrWheel);

    this.group.add(this.flPivot, this.frPivot, this.rlPivot, this.rrPivot);

    // Blue Hover Glow Light beneath Car
    this.hoverGlowLight = new THREE.PointLight(0x00d4ff, 0.0, 10);
    this.hoverGlowLight.visible = false;
    this.hoverGlowLight.position.set(0, 0.2, 0);
    this.carBodyGroup.add(this.hoverGlowLight);
  }

  private createWheelWithThruster(isLeft: boolean): {
    wheel: THREE.Group;
    thruster: THREE.Mesh;
  } {
    const wheelGroup = new THREE.Group();

    // Tire
    const tireGeo = new THREE.CylinderGeometry(
      VEHICLE_CONFIG.WHEEL_RADIUS,
      VEHICLE_CONFIG.WHEEL_RADIUS,
      0.32,
      18,
    );
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x141416,
      roughness: 0.92,
    });
    const tireMesh = new THREE.Mesh(tireGeo, tireMat);
    tireMesh.castShadow = true;
    wheelGroup.add(tireMesh);

    // DeLorean Cyber Rim
    const rimGeo = new THREE.CylinderGeometry(
      VEHICLE_CONFIG.WHEEL_RADIUS * 0.65,
      VEHICLE_CONFIG.WHEEL_RADIUS * 0.65,
      0.34,
      10,
    );
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.15,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    wheelGroup.add(rimMesh);

    // Glowing Cyan Plasma Hover Thruster Disk (Mounted on inside/underside of wheel)
    const thrusterGeo = new THREE.CylinderGeometry(
      VEHICLE_CONFIG.WHEEL_RADIUS * 0.55,
      VEHICLE_CONFIG.WHEEL_RADIUS * 0.55,
      0.08,
      16,
    );
    thrusterGeo.rotateZ(Math.PI / 2);
    const thrusterMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.0,
    });
    const thrusterMesh = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterMesh.position.x = isLeft ? 0.08 : -0.08;
    wheelGroup.add(thrusterMesh);

    return { wheel: wheelGroup, thruster: thrusterMesh };
  }

  private initNitroAndUnderglow(): void {
    // Twin Nitro Exhaust Flames
    const flameGeo = new THREE.ConeGeometry(0.2, 1.1, 10);
    flameGeo.rotateX(Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.0,
    });

    this.nitroFlameLeft = new THREE.Mesh(flameGeo, flameMat);
    this.nitroFlameLeft.position.set(-0.48, 0.72, -VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.7);

    this.nitroFlameRight = new THREE.Mesh(flameGeo, flameMat);
    this.nitroFlameRight.position.set(0.48, 0.72, -VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.7);

    this.carBodyGroup.add(this.nitroFlameLeft, this.nitroFlameRight);

    // Cyan Underglow Light
    this.underglowLight = new THREE.PointLight(0x00d4ff, 2.5, 7);
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

  private initHoverParticles(): void {
    const count = 24;
    this.hoverPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.hoverPositions[i * 3] = (Math.random() - 0.5) * VEHICLE_CONFIG.CAR_WIDTH;
      this.hoverPositions[i * 3 + 1] = -0.2 - Math.random() * 0.6;
      this.hoverPositions[i * 3 + 2] = (Math.random() - 0.5) * VEHICLE_CONFIG.CAR_LENGTH;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.hoverPositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.45,
      transparent: true,
      opacity: 0.0,
    });

    this.hoverParticles = new THREE.Points(geo, mat);
    this.carBodyGroup.add(this.hoverParticles);
  }

  public takeDamage(amount: number): void {
    if (this.isDestroyed) return;

    if (this.physics.armorPlating) {
      amount *= 0.5;
    }

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
    this.physics.repairTires();
    (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(this.baseColor);
  }

  public setUnderglowColor(colorHex: number): void {
    this.underglowLight.color.setHex(colorHex);
  }

  public setColor(colorHex: number): void {
    this.baseColor = colorHex;
    (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(colorHex);
  }

  public getColor(): number {
    return this.baseColor;
  }

  public toggleHeadlights(): boolean {
    const newState = !this.headlightLeft.visible;
    this.headlightLeft.visible = newState;
    this.headlightRight.visible = newState;
    if (this.headlightConeLeft) this.headlightConeLeft.visible = newState;
    if (this.headlightConeRight) this.headlightConeRight.visible = newState;
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

    // Update root transforms
    this.group.position.set(this.physics.x, this.physics.y, this.physics.z);
    this.group.rotation.y = this.physics.heading;

    const isHoverOrAir = this.physics.isHoverMode || this.physics.isAirborne;

    // DeLorean Dynamic Body Banking & Roll
    if (isHoverOrAir) {
      // Smooth banking roll into turns during flight
      const flightBank = -this.physics.steerAngle * (Math.abs(this.physics.speed) > 2 ? 0.35 : 0.1);
      this.carBodyGroup.rotation.z = THREE.MathUtils.lerp(
        this.carBodyGroup.rotation.z,
        flightBank,
        0.15,
      );

      // Pitch angle reflecting climb or dive
      const pitchAngle = -this.physics.vy * 0.025;
      this.carBodyGroup.rotation.x = THREE.MathUtils.lerp(
        this.carBodyGroup.rotation.x,
        pitchAngle,
        0.15,
      );
    } else {
      // Ground body roll and suspension pitch
      this.carBodyGroup.rotation.z = THREE.MathUtils.lerp(
        this.carBodyGroup.rotation.z,
        this.physics.roll,
        0.25,
      );
      this.carBodyGroup.rotation.x = THREE.MathUtils.lerp(
        this.carBodyGroup.rotation.x,
        this.physics.pitch,
        0.25,
      );
    }

    // Folding Hover Wheels (Back to the Future II)
    const targetFoldAngle = isHoverOrAir ? Math.PI / 2 : 0;
    this.flPivot.rotation.z = THREE.MathUtils.lerp(this.flPivot.rotation.z, targetFoldAngle, 0.18);
    this.frPivot.rotation.z = THREE.MathUtils.lerp(this.frPivot.rotation.z, -targetFoldAngle, 0.18);
    this.rlPivot.rotation.z = THREE.MathUtils.lerp(this.rlPivot.rotation.z, targetFoldAngle, 0.18);
    this.rrPivot.rotation.z = THREE.MathUtils.lerp(this.rrPivot.rotation.z, -targetFoldAngle, 0.18);

    // Front wheels steering (in ground mode)
    if (!isHoverOrAir) {
      this.flPivot.rotation.y = this.physics.steerAngle;
      this.frPivot.rotation.y = this.physics.steerAngle;

      // Wheel rolling
      this.flWheel.rotation.x = this.physics.wheelRotation;
      this.frWheel.rotation.x = this.physics.wheelRotation;
      this.rlWheel.rotation.x = this.physics.wheelRotation;
      this.rrWheel.rotation.x = this.physics.wheelRotation;
    } else {
      this.flPivot.rotation.y = THREE.MathUtils.lerp(this.flPivot.rotation.y, 0, 0.2);
      this.frPivot.rotation.y = THREE.MathUtils.lerp(this.frPivot.rotation.y, 0, 0.2);
    }

    // Hover Thruster Plasma Disks & Blue Underglow
    const thrusterOpacity = isHoverOrAir ? 0.95 : 0.0;
    (this.flThrusterDisk.material as THREE.MeshBasicMaterial).opacity = thrusterOpacity;
    (this.frThrusterDisk.material as THREE.MeshBasicMaterial).opacity = thrusterOpacity;
    (this.rlThrusterDisk.material as THREE.MeshBasicMaterial).opacity = thrusterOpacity;
    (this.rrThrusterDisk.material as THREE.MeshBasicMaterial).opacity = thrusterOpacity;

    this.hoverGlowLight.intensity = isHoverOrAir ? 4.5 : 0.0;
    this.hoverGlowLight.visible = isHoverOrAir;

    // Hover downward particle emission
    const hoverMat = this.hoverParticles.material as THREE.PointsMaterial;
    if (isHoverOrAir) {
      hoverMat.opacity = 0.85;
      const hPos = this.hoverPositions;
      for (let i = 0; i < hPos.length / 3; i++) {
        hPos[i * 3 + 1] -= dt * 4.0;
        if (hPos[i * 3 + 1] < -2.0) {
          hPos[i * 3 + 1] = -0.1;
          hPos[i * 3] = (Math.random() - 0.5) * VEHICLE_CONFIG.CAR_WIDTH;
          hPos[i * 3 + 2] = (Math.random() - 0.5) * VEHICLE_CONFIG.CAR_LENGTH;
        }
      }
      this.hoverParticles.geometry.attributes.position.needsUpdate = true;
    } else {
      hoverMat.opacity = 0;
    }

    // Taillight glow on brake / reverse / handbrake
    const isBraking = (input.reverse && this.physics.speed > 0.4) || input.handbrake;
    if (isBraking) {
      this.taillightMaterial.emissive.setHex(0xff0022);
      this.taillightMaterial.emissiveIntensity = 2.4;
    } else {
      this.taillightMaterial.emissive.setHex(0x660011);
      this.taillightMaterial.emissiveIntensity = 0.8;
    }

    // Nitro Flame Cones animation
    const flameMat = this.nitroFlameLeft.material as THREE.MeshBasicMaterial;
    if (this.physics.isBoosting) {
      flameMat.opacity = 0.95;
      const flicker = 0.8 + Math.random() * 0.4;
      this.nitroFlameLeft.scale.set(flicker, flicker, flicker * 1.5);
      this.nitroFlameRight.scale.set(flicker, flicker, flicker * 1.5);
      this.underglowLight.intensity = 5.5;
    } else {
      flameMat.opacity = 0;
      this.underglowLight.intensity = isHoverOrAir ? 3.5 : 1.8;
    }

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
