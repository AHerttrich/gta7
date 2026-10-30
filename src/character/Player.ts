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

  public takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  public setOutfit(torsoColor: number, legColor: number): void {
    if (this.torsoMesh && this.torsoMesh.material instanceof THREE.MeshStandardMaterial) {
      this.torsoMesh.material.color.setHex(torsoColor);
    }
    if (this.leftLeg && this.leftLeg.material instanceof THREE.MeshStandardMaterial) {
      this.leftLeg.material.color.setHex(legColor);
    }
    if (this.rightLeg && this.rightLeg.material instanceof THREE.MeshStandardMaterial) {
      this.rightLeg.material.color.setHex(legColor);
    }
  }

  // Cyber Jetpack (Phase 13)
  public hasJetpack: boolean = false;
  public isJetpacking: boolean = false;
  public jetpackFuel: number = 100;
  public vy: number = 0;
  public lowGravity: boolean = false;
  public speedMultiplier: number = 1.0;

  private torsoMesh!: THREE.Mesh;
  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private jetpackGroup!: THREE.Group;
  private jetpackFlameL!: THREE.Mesh;
  private jetpackFlameR!: THREE.Mesh;
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
    this.torsoMesh = torso;
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

    // 5. Cyber Jetpack (mounted on back)
    this.buildJetpack();
  }

  private buildJetpack(): void {
    this.jetpackGroup = new THREE.Group();

    // Twin Fuel Cylinders
    const tankGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 12);
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Cyan blue
      metalness: 0.85,
      roughness: 0.2,
    });

    const tankL = new THREE.Mesh(tankGeo, tankMat);
    tankL.position.set(-0.2, 1.4, -0.32);
    const tankR = new THREE.Mesh(tankGeo, tankMat);
    tankR.position.set(0.2, 1.4, -0.32);

    // Thruster Cones
    const thrusterGeo = new THREE.ConeGeometry(0.14, 0.25, 10);
    const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 });
    const thrusterL = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterL.position.set(-0.2, 0.95, -0.32);
    thrusterL.rotation.x = Math.PI;
    const thrusterR = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterR.position.set(0.2, 0.95, -0.32);
    thrusterR.rotation.x = Math.PI;

    // Plasma Exhaust Flames
    const flameGeo = new THREE.ConeGeometry(0.1, 0.5, 8);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.0,
    });
    this.jetpackFlameL = new THREE.Mesh(flameGeo, flameMat);
    this.jetpackFlameL.position.set(-0.2, 0.6, -0.32);
    this.jetpackFlameL.rotation.x = Math.PI;

    this.jetpackFlameR = new THREE.Mesh(flameGeo, flameMat);
    this.jetpackFlameR.position.set(0.2, 0.6, -0.32);
    this.jetpackFlameR.rotation.x = Math.PI;

    this.jetpackGroup.add(
      tankL,
      tankR,
      thrusterL,
      thrusterR,
      this.jetpackFlameL,
      this.jetpackFlameR,
    );
    this.jetpackGroup.visible = false;
    this.group.add(this.jetpackGroup);
  }

  public toggleJetpack(): boolean {
    this.hasJetpack = !this.hasJetpack;
    this.jetpackGroup.visible = this.hasJetpack;
    return this.hasJetpack;
  }

  public setPosition(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.group.position.set(x, y, z);
  }

  public update(dt: number, input: Input, city: City): void {
    // 1. Steering & Rotation (Left / Right Arrows / Touch D-Pad / Swiping)
    const turnSpeed = PLAYER_CONFIG.TURN_SPEED;

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
    this.rotationY =
      THREE.MathUtils.euclideanModulo(this.rotationY + Math.PI, Math.PI * 2) - Math.PI;
    this.group.rotation.y = this.rotationY;

    // 2. Forward / Backward Movement along facing direction
    let moveDir = 0;
    if (input.forward) moveDir += 1;
    if (input.backward) moveDir -= 0.65; // Slightly slower in reverse

    const isMoving = moveDir !== 0;

    if (isMoving) {
      const baseSpeed =
        (input.sprint ? PLAYER_CONFIG.RUN_SPEED : PLAYER_CONFIG.WALK_SPEED) * this.speedMultiplier;
      const speed = moveDir * baseSpeed * dt;

      // Translate forward/backward along player's current facing heading
      const vx = Math.sin(this.rotationY) * speed;
      const vz = Math.cos(this.rotationY) * speed;

      // Check collision with city walls in 3D
      const nextX = this.x + vx;
      const nextZ = this.z + vz;
      const col = city.checkCollision(nextX, nextZ, 0.4, this.y);

      if (!col.collided) {
        this.x = nextX;
        this.z = nextZ;
      } else {
        // Slide along walls
        if (col.normalX !== 0 && !city.checkCollision(this.x, nextZ, 0.4, this.y).collided) {
          this.z = nextZ;
        } else if (col.normalZ !== 0 && !city.checkCollision(nextX, this.z, 0.4, this.y).collided) {
          this.x = nextX;
        }
      }

      // Secondary anti-penetration resolution: ensure player never slipped into corner interior
      const postCol = city.resolveBuildingIntersection(this.x, this.z, 0.4, this.y);
      if (postCol.corrected) {
        this.x = postCol.x;
        this.z = postCol.z;
        if (postCol.roofY !== undefined) {
          this.y = postCol.roofY;
          this.vy = 0;
        }
      }

      this.group.position.set(this.x, this.y, this.z);

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

    // 3. Jump & Cyber Jetpack Physics (with Rooftop Landing Support)
    const roofH = city.getRoofHeightAt(this.x, this.z, 0);
    const groundLevel =
      roofH > 0 && (this.y >= roofH - 0.8 || this.y >= roofH) ? roofH : this.x < -318 ? -2.5 : 0;

    if (this.hasJetpack) {
      if (input.jump && this.jetpackFuel > 0) {
        this.isJetpacking = true;
        this.vy = Math.min(22.0, this.vy + (this.lowGravity ? 24.0 : 34.0) * dt);
        this.jetpackFuel = Math.max(0, this.jetpackFuel - (this.lowGravity ? 7.0 : 20.0) * dt);
        (this.jetpackFlameL.material as THREE.MeshBasicMaterial).opacity = 0.95;
        (this.jetpackFlameR.material as THREE.MeshBasicMaterial).opacity = 0.95;
      } else {
        this.isJetpacking = false;
        (this.jetpackFlameL.material as THREE.MeshBasicMaterial).opacity = 0.0;
        (this.jetpackFlameR.material as THREE.MeshBasicMaterial).opacity = 0.0;
        this.vy -= (this.lowGravity ? 5.0 : 16.0) * dt;
      }

      this.y += this.vy * dt;
      if (this.y <= groundLevel) {
        this.y = groundLevel;
        this.vy = 0;
        this.jetpackFuel = Math.min(100, this.jetpackFuel + 30.0 * dt);
      }
    } else {
      // Ground jump trigger (Space key or Gamepad A) - higher & floaty jump in moon gravity!
      if (input.jump && this.y <= groundLevel + 0.02 && this.vy <= 0.05) {
        this.vy = PLAYER_CONFIG.JUMP_VELOCITY * (this.lowGravity ? 1.5 : 1.0);
      }

      if (this.y > groundLevel || this.vy > 0) {
        // Airborne jump or descent (1/6g lunar physics floating descent)
        const maxGlideFall = this.lowGravity ? -2.5 : -5.0;
        // High fall has cyber parachute glide
        if (this.y > 15.0 && this.vy < 0) {
          this.vy = Math.max(maxGlideFall, this.vy - (this.lowGravity ? 5.5 : 16.0) * dt);
        } else {
          this.vy -= (this.lowGravity ? 6.5 : 22.0) * dt;
        }

        this.y += this.vy * dt;
        if (this.y <= groundLevel) {
          this.y = groundLevel;
          this.vy = 0;
        }

        // Midair jumping pose: tuck legs and raise arms
        this.leftLeg.rotation.x = -0.35;
        this.rightLeg.rotation.x = 0.25;
        this.leftArm.rotation.x = 0.5;
        this.rightArm.rotation.x = 0.5;
      } else {
        this.y = groundLevel;
        this.vy = 0;
      }
    }

    // Final failsafe anti-penetration resolution: Player is never trapped inside building interior
    const finalFix = city.resolveBuildingIntersection(this.x, this.z, 0.4, this.y);
    if (finalFix.corrected) {
      this.x = finalFix.x;
      this.z = finalFix.z;
      if (finalFix.roofY !== undefined) {
        this.y = finalFix.roofY;
        this.vy = 0;
      }
    }

    this.group.position.set(this.x, this.y, this.z);
  }
}
