import * as THREE from 'three';
import { PLAYER_CONFIG } from '../utils/Constants';
import { Input } from '../engine/Input';
import { City } from '../city/City';

export class Player {
  public group: THREE.Group;
  public x: number = 0;
  public y: number = 0;
  public z: number = 0;
  public rotationY: number = 0;
  public health: number = PLAYER_CONFIG.MAX_HEALTH;

  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private walkAnimTimer: number = 0;

  constructor(startX: number = 0, startZ: number = 0) {
    this.x = startX;
    this.z = startZ;
    this.group = new THREE.Group();
    this.buildCharacterMesh();
    this.setPosition(startX, 0, startZ);
  }

  private buildCharacterMesh(): void {
    // 1. Torso (Leather Jacket / Hoodie)
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.45);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937, // Dark slate jacket
      roughness: 0.6,
    });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.35;
    torso.castShadow = true;
    this.group.add(torso);

    // 2. Head & Cap
    const headGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xf5d0b0, // Skin tone
      roughness: 0.8,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.05;
    head.castShadow = true;
    this.group.add(head);

    // Backward baseball cap
    const capGeo = new THREE.BoxGeometry(0.46, 0.15, 0.52);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xd97706 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 2.25, -0.05);
    this.group.add(cap);

    // 3. Legs
    const legGeo = new THREE.BoxGeometry(0.24, 0.85, 0.26);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a }); // Denim Jeans

    this.leftLeg = new THREE.Mesh(legGeo, legMat);
    this.leftLeg.position.set(-0.2, 0.45, 0);
    this.leftLeg.castShadow = true;

    this.rightLeg = new THREE.Mesh(legGeo, legMat);
    this.rightLeg.position.set(0.2, 0.45, 0);
    this.rightLeg.castShadow = true;

    this.group.add(this.leftLeg, this.rightLeg);

    // 4. Arms
    const armGeo = new THREE.BoxGeometry(0.18, 0.75, 0.2);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x1f2937 });

    this.leftArm = new THREE.Mesh(armGeo, armMat);
    this.leftArm.position.set(-0.46, 1.3, 0);
    this.leftArm.castShadow = true;

    this.rightArm = new THREE.Mesh(armGeo, armMat);
    this.rightArm.position.set(0.46, 1.3, 0);
    this.rightArm.castShadow = true;

    this.group.add(this.leftArm, this.rightArm);
  }

  public setPosition(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.group.position.set(x, y, z);
  }

  public update(dt: number, input: Input, city: City): void {
    // 1. Steering & Rotation (Left / Right Arrows / Touch D-Pad / Swiping)
    const turnSpeed = 3.8; // ~218 deg/sec, smooth and responsive

    if (input.left) {
      this.rotationY += turnSpeed * dt;
    }
    if (input.right) {
      this.rotationY -= turnSpeed * dt;
    }

    if (input.touchTurnDelta !== 0) {
      this.rotationY -= input.touchTurnDelta;
      input.touchTurnDelta = 0;
    }

    // Keep rotation in [-PI, PI]
    this.rotationY = ((this.rotationY + Math.PI) % (Math.PI * 2)) - Math.PI;
    this.group.rotation.y = this.rotationY;

    // 2. Forward / Backward Movement along facing direction
    let moveDir = 0;
    if (input.forward) moveDir += 1;
    if (input.backward) moveDir -= 0.65; // Slightly slower in reverse

    const isMoving = moveDir !== 0;

    if (isMoving) {
      const baseSpeed = input.sprint ? PLAYER_CONFIG.RUN_SPEED : PLAYER_CONFIG.WALK_SPEED;
      const speed = moveDir * baseSpeed * dt;

      // Translate forward/backward along player's current facing heading
      const vx = Math.sin(this.rotationY) * speed;
      const vz = Math.cos(this.rotationY) * speed;

      // Check collision with city walls
      const nextX = this.x + vx;
      const nextZ = this.z + vz;
      const col = city.checkCollision(nextX, nextZ, 0.4);

      if (!col.collided) {
        this.x = nextX;
        this.z = nextZ;
      } else {
        // Slide along walls
        if (col.normalX !== 0 && !city.checkCollision(this.x, nextZ, 0.4).collided) {
          this.z = nextZ;
        } else if (col.normalZ !== 0 && !city.checkCollision(nextX, this.z, 0.4).collided) {
          this.x = nextX;
        }
      }

      this.group.position.set(this.x, 0, this.z);

      // Walking swing animation
      this.walkAnimTimer += dt * (input.sprint ? 14 : 9) * Math.sign(moveDir);
      const legAngle = Math.sin(this.walkAnimTimer) * 0.55;
      this.leftLeg.rotation.x = legAngle;
      this.rightLeg.rotation.x = -legAngle;
      this.leftArm.rotation.x = -legAngle * 0.7;
      this.rightArm.rotation.x = legAngle * 0.7;
    } else {
      // Rotating in place foot shuffle animation
      if (input.left || input.right) {
        this.walkAnimTimer += dt * 8;
        const shuffle = Math.sin(this.walkAnimTimer) * 0.25;
        this.leftLeg.rotation.x = shuffle;
        this.rightLeg.rotation.x = -shuffle;
        this.leftArm.rotation.x = 0;
        this.rightArm.rotation.x = 0;
      } else {
        // Reset limbs to resting position
        this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, 0.2);
        this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, 0.2);
        this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, 0.2);
        this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, 0.2);
      }
    }
  }
}
