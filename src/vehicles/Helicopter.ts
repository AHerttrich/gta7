import * as THREE from 'three';
import { Input } from '../engine/Input';
import { City } from '../city/City';

export class Helicopter {
  public group: THREE.Group;
  public x: number;
  public y: number;
  public z: number;
  public vx: number = 0;
  public vy: number = 0;
  public vz: number = 0;
  public heading: number = 0;
  public pitch: number = 0;
  public roll: number = 0;
  public rpm: number = 0; // 0 to 1
  public health: number = 100;
  public isDestroyed: boolean = false;
  public isOccupied: boolean = false;

  private mainRotor!: THREE.Group;
  private tailRotor!: THREE.Group;
  private searchlight!: THREE.SpotLight;
  private searchlightTarget!: THREE.Object3D;
  private beaconLight!: THREE.Mesh;

  constructor(startX: number = 0, startY: number = 52.5, startZ: number = 0) {
    this.x = startX;
    this.y = startY;
    this.z = startZ;

    this.group = new THREE.Group();
    this.buildHelicopterModel();
    this.group.position.set(this.x, this.y, this.z);
  }

  private buildHelicopterModel(): void {
    // 1. Cockpit & Fuselage (Glossy Black / Gold Executive Style)
    const bodyGeo = new THREE.BoxGeometry(2.0, 1.8, 4.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Obsidian Black
      metalness: 0.9,
      roughness: 0.2,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 1.1;
    bodyMesh.castShadow = true;
    this.group.add(bodyMesh);

    // Gold decorative stripe
    const stripeGeo = new THREE.BoxGeometry(2.04, 0.15, 4.2);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.3,
    });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 1.1;
    this.group.add(stripe);

    // Cockpit Tinted Canopy (Glass)
    const glassGeo = new THREE.BoxGeometry(1.85, 1.1, 1.8);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.95,
      roughness: 0.05,
      transparent: true,
      opacity: 0.85,
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.set(0, 1.4, 1.3);
    glassMesh.rotation.x = -0.15;
    this.group.add(glassMesh);

    // 2. Tail Boom & Fin
    const boomGeo = new THREE.CylinderGeometry(0.25, 0.45, 4.5, 8);
    boomGeo.rotateX(Math.PI / 2);
    const boomMesh = new THREE.Mesh(boomGeo, bodyMat);
    boomMesh.position.set(0, 1.35, -3.8);
    boomMesh.castShadow = true;
    this.group.add(boomMesh);

    // Vertical Tail Fin
    const finGeo = new THREE.BoxGeometry(0.12, 1.6, 1.0);
    const finMesh = new THREE.Mesh(finGeo, bodyMat);
    finMesh.position.set(0, 2.0, -5.8);
    this.group.add(finMesh);

    // 3. Landing Skids (Left & Right)
    const skidMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
    const skidGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.2, 8);
    skidGeo.rotateX(Math.PI / 2);

    const leftSkid = new THREE.Mesh(skidGeo, skidMat);
    leftSkid.position.set(-1.0, 0.1, 0.2);
    const rightSkid = leftSkid.clone();
    rightSkid.position.x = 1.0;
    this.group.add(leftSkid, rightSkid);

    // Skid Struts
    const strutGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6);
    [-0.9, 0.9].forEach((sx) => {
      [1.0, -1.0].forEach((sz) => {
        const strut = new THREE.Mesh(strutGeo, skidMat);
        strut.position.set(sx, 0.55, sz);
        this.group.add(strut);
      });
    });

    // 4. Main Rotor (4 Blades on Top Mast)
    this.mainRotor = new THREE.Group();
    this.mainRotor.position.set(0, 2.2, 0.2);

    const mastGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8);
    const mast = new THREE.Mesh(mastGeo, skidMat);
    this.mainRotor.add(mast);

    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
    for (let b = 0; b < 4; b++) {
      const bladeGeo = new THREE.BoxGeometry(0.3, 0.04, 4.2);
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.z = 2.1;
      const bladePivot = new THREE.Group();
      bladePivot.rotation.y = (b * Math.PI) / 2;
      bladePivot.add(blade);
      this.mainRotor.add(bladePivot);
    }
    this.group.add(this.mainRotor);

    // 5. Tail Rotor (2 Blades)
    this.tailRotor = new THREE.Group();
    this.tailRotor.position.set(0.15, 2.4, -5.8);

    const tBladeGeo = new THREE.BoxGeometry(0.1, 1.4, 0.04);
    const tBlade = new THREE.Mesh(tBladeGeo, bladeMat);
    this.tailRotor.add(tBlade);
    this.group.add(this.tailRotor);

    // 6. Downward High-Intensity Searchlight
    this.searchlight = new THREE.SpotLight(0xffffff, 4.5, 90, Math.PI / 5, 0.35);
    this.searchlight.position.set(0, 0.4, 1.8);

    this.searchlightTarget = new THREE.Object3D();
    this.searchlightTarget.position.set(0, -30, 8);
    this.group.add(this.searchlight);
    this.group.add(this.searchlightTarget);
    this.searchlight.target = this.searchlightTarget;

    // Beacon warning light on tail
    const beaconGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    this.beaconLight = new THREE.Mesh(beaconGeo, beaconMat);
    this.beaconLight.position.set(0, 2.85, -5.8);
    this.group.add(this.beaconLight);
  }

  public update(dt: number, input: Input, city: City): void {
    if (this.isDestroyed) return;

    // 1. Rotor RPM Spin-Up / Spin-Down
    const targetRpm = this.isOccupied ? 1.0 : 0.0;
    this.rpm = THREE.MathUtils.lerp(this.rpm, targetRpm, dt * 3.0);

    // Spin blades
    this.mainRotor.rotation.y += this.rpm * 26 * dt;
    this.tailRotor.rotation.x += this.rpm * 40 * dt;

    if (!this.isOccupied && this.rpm < 0.05) {
      return;
    }

    // 2. Flight Aerodynamics & Controls
    if (this.isOccupied) {
      if (this.rpm > 0.15) {
        // Ascend / Descend (Space / Shift / W / S)
        if (input.ascend) {
          this.vy = Math.min(18.0, this.vy + this.rpm * 26.0 * dt);
        } else if (input.descend) {
          this.vy = Math.max(-16.0, this.vy - 20.0 * dt);
        } else {
          // Auto-hover stabilization
          this.vy = THREE.MathUtils.lerp(this.vy, 0, dt * 2.5);
        }

        // Yaw Steering (A / D / Left / Right)
        const turnSpeed = 2.4;
        if (input.left) {
          this.heading += turnSpeed * dt;
          this.roll = THREE.MathUtils.lerp(this.roll, 0.35, dt * 4);
        } else if (input.right) {
          this.heading -= turnSpeed * dt;
          this.roll = THREE.MathUtils.lerp(this.roll, -0.35, dt * 4);
        } else {
          this.roll = THREE.MathUtils.lerp(this.roll, 0, dt * 3);
        }

        // Forward / Backward Cyclic Pitch & Thrust
        const forwardThrust = 32.0;
        if (input.forward) {
          this.pitch = THREE.MathUtils.lerp(this.pitch, -0.28, dt * 3);
          this.vx += Math.sin(this.heading) * forwardThrust * dt;
          this.vz += Math.cos(this.heading) * forwardThrust * dt;
        } else if (input.backward) {
          this.pitch = THREE.MathUtils.lerp(this.pitch, 0.22, dt * 3);
          this.vx -= Math.sin(this.heading) * forwardThrust * 0.6 * dt;
          this.vz -= Math.cos(this.heading) * forwardThrust * 0.6 * dt;
        } else {
          this.pitch = THREE.MathUtils.lerp(this.pitch, 0, dt * 2.5);
          this.vx = THREE.MathUtils.lerp(this.vx, 0, dt * 1.5);
          this.vz = THREE.MathUtils.lerp(this.vz, 0, dt * 1.5);
        }
      }
    } else {
      // Free fall if unoccupied in mid-air
      this.vy -= 18.0 * dt;
      this.vx = THREE.MathUtils.lerp(this.vx, 0, dt * 2);
      this.vz = THREE.MathUtils.lerp(this.vz, 0, dt * 2);
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0, dt * 2);
      this.roll = THREE.MathUtils.lerp(this.roll, 0, dt * 2);
    }

    // 3. Position Integration
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    // Ground & Helipad Landing Bounds Check
    const minHeight = 0.2;
    if (this.y < minHeight) {
      this.y = minHeight;
      this.vy = 0;
    }

    // Ceiling limit
    if (this.y > 110.0) {
      this.y = 110.0;
      this.vy = Math.min(0, this.vy);
    }

    // Keep rotation in range
    this.heading = ((this.heading + Math.PI) % (Math.PI * 2)) - Math.PI;

    // Apply 3D transforms
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.set(0, 0, 0);
    this.group.rotateY(this.heading);
    this.group.rotateX(this.pitch);
    this.group.rotateZ(this.roll);

    // Building Collision
    const col = city.checkCollision(this.x, this.z, 2.2);
    if (col.collided && this.y < 35.0) {
      this.vx = -this.vx * 0.5;
      this.vz = -this.vz * 0.5;
      this.x += col.normalX * 1.2;
      this.z += col.normalZ * 1.2;
    }
  }

  public getSpeedKmh(): number {
    return Math.round(Math.hypot(this.vx, this.vy, this.vz) * 3.6);
  }
}
