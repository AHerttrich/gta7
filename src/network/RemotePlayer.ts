import * as THREE from 'three';
import { PlayerSyncMsg } from './NetProtocol';
import { VEHICLE_CONFIG } from '../utils/Constants';

export class RemotePlayer {
  public group: THREE.Group;
  private carGroup: THREE.Group;
  private characterGroup: THREE.Group;

  private carBodyMesh!: THREE.Mesh;
  private nitroFlameLeft!: THREE.Mesh;
  private nitroFlameRight!: THREE.Mesh;
  private wheels: THREE.Mesh[] = [];

  // Target values for smooth network interpolation
  public targetX: number = 0;
  public targetY: number = 0.5;
  public targetZ: number = 0;
  public targetHeading: number = 0;
  public speed: number = 0;
  public mode: 'IN_CAR' | 'ON_FOOT' = 'IN_CAR';

  private wheelRotation: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.carGroup = new THREE.Group();
    this.characterGroup = new THREE.Group();

    this.group.add(this.carGroup);
    this.group.add(this.characterGroup);
    scene.add(this.group);

    this.buildRemoteCar();
    this.buildRemoteCharacter();
    this.buildNameTag();

    this.group.visible = false;
  }

  private buildRemoteCar(): void {
    // DeLorean Body
    const bodyGeo = new THREE.BoxGeometry(
      VEHICLE_CONFIG.CAR_WIDTH,
      0.48,
      VEHICLE_CONFIG.CAR_LENGTH,
    );
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db, // DeLorean Brushed Metallic
      metalness: 0.94,
      roughness: 0.22,
    });
    this.carBodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.carBodyMesh.position.y = 0.44;
    this.carBodyMesh.castShadow = true;
    this.carGroup.add(this.carBodyMesh);

    // Front wedge hood
    const hoodMesh = new THREE.Mesh(
      new THREE.BoxGeometry(VEHICLE_CONFIG.CAR_WIDTH * 0.94, 0.2, 1.5),
      bodyMat,
    );
    hoodMesh.position.set(0, 0.52, 1.4);
    hoodMesh.rotation.x = -0.08;
    this.carGroup.add(hoodMesh);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(VEHICLE_CONFIG.CAR_WIDTH * 0.84, 0.52, 2.1);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.08,
    });
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 0.88, -0.15);
    this.carGroup.add(cabin);

    // Rear window louvers
    const louverMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
    for (let l = 0; l < 4; l++) {
      const louver = new THREE.Mesh(
        new THREE.BoxGeometry(VEHICLE_CONFIG.CAR_WIDTH * 0.8, 0.03, 0.16),
        louverMat,
      );
      louver.position.set(0, 0.78 + l * 0.07, -0.75 - l * 0.22);
      this.carGroup.add(louver);
    }

    // Rear nuclear thruster vents
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const ventGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.4, 12);
    ventGeo.rotateX(Math.PI / 2);
    const ventL = new THREE.Mesh(ventGeo, ventMat);
    ventL.position.set(-0.48, 0.7, -VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.12);
    const ventR = ventL.clone();
    ventR.position.x = 0.48;
    this.carGroup.add(ventL, ventR);

    // Wheels
    const wheelPositions = [
      [-1.08, 0.4, 1.35],
      [1.08, 0.4, 1.35],
      [-1.08, 0.4, -1.35],
      [1.08, 0.4, -1.35],
    ];
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.32, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8 });

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      this.carGroup.add(wheel);
      this.wheels.push(wheel);
    });

    // Nitro Flames
    const flameGeo = new THREE.ConeGeometry(0.2, 1.0, 8);
    flameGeo.rotateX(Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.0,
    });

    this.nitroFlameLeft = new THREE.Mesh(flameGeo, flameMat);
    this.nitroFlameLeft.position.set(-0.48, 0.7, -VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.6);
    this.nitroFlameRight = new THREE.Mesh(flameGeo, flameMat);
    this.nitroFlameRight.position.set(0.48, 0.7, -VEHICLE_CONFIG.CAR_LENGTH / 2 - 0.6);

    this.carGroup.add(this.nitroFlameLeft, this.nitroFlameRight);
  }

  private buildRemoteCharacter(): void {
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.9, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x0284c7 }),
    );
    torso.position.y = 1.35;
    this.characterGroup.add(torso);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xf5d0b0 }),
    );
    head.position.y = 2.05;
    this.characterGroup.add(head);

    this.characterGroup.visible = false;
  }

  private buildNameTag(): void {
    if (typeof document === 'undefined') return;

    const tagGeo = new THREE.PlaneGeometry(2.4, 0.6);
    tagGeo.rotateY(Math.PI);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 60);

    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎮 KUMPEL', 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const tagMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const tagMesh = new THREE.Mesh(tagGeo, tagMat);
    tagMesh.position.y = 2.6;
    this.group.add(tagMesh);
  }

  public applySync(msg: PlayerSyncMsg): void {
    this.group.visible = true;
    this.targetX = msg.x;
    this.targetY = msg.y;
    this.targetZ = msg.z;
    this.targetHeading = msg.heading;
    this.speed = msg.speed;
    this.mode = msg.mode;

    // Update body color if changed
    (this.carBodyMesh.material as THREE.MeshStandardMaterial).color.setHex(msg.carColor);

    // Switch between car and on foot
    if (this.mode === 'IN_CAR') {
      this.carGroup.visible = true;
      this.characterGroup.visible = false;

      // Nitro Flame visibility
      const flameMat = this.nitroFlameLeft.material as THREE.MeshBasicMaterial;
      flameMat.opacity = msg.isBoosting ? 0.9 : 0.0;
    } else {
      this.carGroup.visible = false;
      this.characterGroup.visible = true;
    }
  }

  public update(dt: number): void {
    if (!this.group.visible) return;

    // Smooth position interpolation
    this.group.position.x = THREE.MathUtils.lerp(this.group.position.x, this.targetX, 0.25);
    this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, this.targetY, 0.25);
    this.group.position.z = THREE.MathUtils.lerp(this.group.position.z, this.targetZ, 0.25);
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, this.targetHeading, 0.25);

    // Wheel roll & hover folding
    if (this.mode === 'IN_CAR') {
      const isFlying = this.targetY > 0.9;
      const targetFold = isFlying ? Math.PI / 2 : 0;
      this.wheels.forEach((w, idx) => {
        const isLeft = idx % 2 === 0;
        w.rotation.z = THREE.MathUtils.lerp(w.rotation.z, isLeft ? targetFold : -targetFold, 0.2);
        if (!isFlying) {
          w.rotation.x = this.wheelRotation;
        }
      });
      if (!isFlying) {
        this.wheelRotation += (this.speed * dt) / 0.4;
      }
    }
  }

  public hide(): void {
    this.group.visible = false;
  }
}
