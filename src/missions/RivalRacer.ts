import * as THREE from 'three';
import { RACE_CIRCUIT } from '../utils/Constants';

export interface RivalConfig {
  id: string;
  name: string;
  bodyColor: number;
  stripeColor: number;
  neonColor: number;
  baseSpeed: number; // m/s
  turnSpeed: number; // rad/s
}

export class RivalRacer {
  public mesh: THREE.Group;
  public config: RivalConfig;
  public x: number;
  public z: number;
  public y: number = 0.5;
  public heading: number = 0; // radians
  public speed: number = 0; // m/s
  public currentCheckpointIndex: number = 0;
  public isFinished: boolean = false;
  public finishTime: number = 0;
  public collisionRadius: number = 2.2;

  private wheels: THREE.Mesh[] = [];

  constructor(
    scene: THREE.Scene,
    config: RivalConfig,
    startX: number,
    startZ: number,
    startHeading: number,
  ) {
    this.config = config;
    this.x = startX;
    this.z = startZ;
    this.heading = startHeading;
    this.mesh = this.buildMesh();
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    scene.add(this.mesh);
  }

  private buildMesh(): THREE.Group {
    const group = new THREE.Group();

    // Main Chassis
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.config.bodyColor,
      roughness: 0.25,
      metalness: 0.8,
    });
    const bodyGeo = new THREE.BoxGeometry(2.0, 0.75, 4.2);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    group.add(body);

    // Racing Stripe / Accent
    const stripeMat = new THREE.MeshBasicMaterial({ color: this.config.stripeColor });
    const stripeGeo = new THREE.BoxGeometry(0.45, 0.77, 4.22);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.56;
    group.add(stripe);

    // Cabin / Windshield
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.1,
      metalness: 0.9,
    });
    const cabinGeo = new THREE.BoxGeometry(1.6, 0.55, 2.0);
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.1, -0.2);
    group.add(cabin);

    // High Downforce Rear Spoiler
    const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const wingGeo = new THREE.BoxGeometry(2.1, 0.08, 0.45);
    const wing = new THREE.Mesh(wingGeo, spoilerMat);
    wing.position.set(0, 1.35, -1.8);
    group.add(wing);

    // Spoiler Struts
    const strutGeo = new THREE.BoxGeometry(0.08, 0.4, 0.1);
    const leftStrut = new THREE.Mesh(strutGeo, spoilerMat);
    leftStrut.position.set(-0.7, 1.15, -1.8);
    const rightStrut = leftStrut.clone();
    rightStrut.position.set(0.7, 1.15, -1.8);
    group.add(leftStrut, rightStrut);

    // Headlights
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hlGeo = new THREE.BoxGeometry(0.35, 0.15, 0.05);
    const hlLeft = new THREE.Mesh(hlGeo, lightMat);
    hlLeft.position.set(-0.7, 0.6, 2.12);
    const hlRight = hlLeft.clone();
    hlRight.position.set(0.7, 0.6, 2.12);
    group.add(hlLeft, hlRight);

    // Taillights
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const tlLeft = new THREE.Mesh(hlGeo, tailMat);
    tlLeft.position.set(-0.7, 0.65, -2.12);
    const tlRight = tlLeft.clone();
    tlRight.position.set(0.7, 0.65, -2.12);
    group.add(tlLeft, tlRight);

    // Underglow Neon Light kept for reference without adding to scene graph
    const underglowLight = new THREE.PointLight(this.config.neonColor, 3, 6);
    underglowLight.position.set(0, 0.2, 0);

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });

    const wheelOffsets = [
      [-1.0, 0.38, 1.3],
      [1.0, 0.38, 1.3],
      [-1.0, 0.38, -1.3],
      [1.0, 0.38, -1.3],
    ];

    for (const [wx, wy, wz] of wheelOffsets) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
      this.wheels.push(wheel);
    }

    return group;
  }

  public update(
    dt: number,
    playerProgress: number,
    elapsedRaceTime: number,
    obstacles: { x: number; z: number; radius: number }[] = [],
  ): void {
    if (this.isFinished) {
      // Coast to a stop after crossing the finish line
      this.speed = Math.max(0, this.speed - 12.0 * dt);
      this.x += Math.sin(this.heading) * this.speed * dt;
      this.z += Math.cos(this.heading) * this.speed * dt;
      this.mesh.position.set(this.x, this.y, this.z);
      return;
    }

    if (this.currentCheckpointIndex >= RACE_CIRCUIT.length) {
      this.isFinished = true;
      this.finishTime = elapsedRaceTime;
      return;
    }

    const targetPt = RACE_CIRCUIT[this.currentCheckpointIndex];
    const dx = targetPt.x - this.x;
    const dz = targetPt.z - this.z;
    const distToTarget = Math.hypot(dx, dz);

    // Target angle (Z is forward in Three.js when rotY = 0)
    let targetAngle = Math.atan2(dx, dz);

    // Obstacle avoidance: nudge target angle if close to obstacle
    for (const obs of obstacles) {
      const ox = obs.x - this.x;
      const oz = obs.z - this.z;
      const odist = Math.hypot(ox, oz);
      if (odist < obs.radius + 3.0 && odist > 0.1) {
        const obsAngle = Math.atan2(ox, oz);
        const relAngle = this.normalizeAngle(obsAngle - this.heading);
        if (Math.abs(relAngle) < Math.PI / 3) {
          // Push target steering away from obstacle
          targetAngle += relAngle > 0 ? -0.8 : 0.8;
        }
      }
    }

    // Steering diff
    const angleDiff = this.normalizeAngle(targetAngle - this.heading);
    const steerStep =
      Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.config.turnSpeed * dt);
    this.heading += steerStep;

    // Speed calculation with corner braking and rubberbanding
    let desiredSpeed = this.config.baseSpeed;

    // Cornering slowdown
    if (Math.abs(angleDiff) > 0.45) {
      desiredSpeed *= 0.65;
    } else if (Math.abs(angleDiff) > 0.25) {
      desiredSpeed *= 0.82;
    }

    // Rubberbanding against player
    const myProgress = this.getProgress();
    const progressDiff = myProgress - playerProgress;
    if (progressDiff > 0.6) {
      // Rival is ahead of player: slightly reduce speed to keep it competitive
      desiredSpeed *= 0.88;
    } else if (progressDiff < -0.6) {
      // Rival is lagging behind player: rubberband catch-up boost
      desiredSpeed *= 1.18;
    }

    // Accelerate / Decelerate towards desired speed
    if (this.speed < desiredSpeed) {
      this.speed = Math.min(desiredSpeed, this.speed + 18.0 * dt);
    } else {
      this.speed = Math.max(desiredSpeed, this.speed - 24.0 * dt);
    }

    // Move forward
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;

    // Spin wheels
    const wheelSpin = (this.speed / 0.38) * dt;
    for (const w of this.wheels) {
      w.rotation.x += wheelSpin;
    }

    // Checkpoint detection
    if (distToTarget < 7.5) {
      this.currentCheckpointIndex++;
      if (this.currentCheckpointIndex >= RACE_CIRCUIT.length) {
        this.isFinished = true;
        this.finishTime = elapsedRaceTime;
      }
    }
  }

  public getProgress(): number {
    if (this.isFinished) return RACE_CIRCUIT.length + 10;
    if (this.currentCheckpointIndex >= RACE_CIRCUIT.length) return RACE_CIRCUIT.length;

    const targetPt = RACE_CIRCUIT[this.currentCheckpointIndex];
    const prevPt =
      this.currentCheckpointIndex === 0
        ? { x: RACE_CIRCUIT[0].x, z: RACE_CIRCUIT[0].z - 10 }
        : RACE_CIRCUIT[this.currentCheckpointIndex - 1];

    const segLen = Math.hypot(targetPt.x - prevPt.x, targetPt.z - prevPt.z) || 1;
    const distToTarget = Math.hypot(targetPt.x - this.x, targetPt.z - this.z);
    const subProgress = Math.max(0, Math.min(1, 1 - distToTarget / segLen));

    return this.currentCheckpointIndex + subProgress;
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
