import * as THREE from 'three';
import { CAMERA_CONFIG } from '../utils/Constants';
import { City } from '../city/City';

export type CameraMode = 'CHASE' | 'CLOSE' | 'COCKPIT' | 'TOP_DOWN';

export class GameCamera {
  private camera: THREE.PerspectiveCamera;
  public mode: CameraMode = 'CHASE';

  private currentTargetPos: THREE.Vector3 = new THREE.Vector3();
  private currentCameraPos: THREE.Vector3 = new THREE.Vector3();
  // Per-frame scratch vectors (avoid allocating in the render loop)
  private readonly desiredCamPos = new THREE.Vector3();
  private readonly desiredLookTarget = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /**
   * Frame-rate independent smoothing factor: applies `perFrame60` blending per 1/60 s,
   * so camera feel is identical at 30, 60 or 144 Hz.
   */
  private static smoothing(perFrame60: number, dt: number): number {
    if (perFrame60 >= 1) return 1;
    return 1 - Math.pow(1 - perFrame60, 60 * dt);
  }

  public reset(targetPos: THREE.Vector3, heading: number = 0): void {
    const dist = CAMERA_CONFIG.FOOT_DISTANCE;
    const height = CAMERA_CONFIG.FOOT_HEIGHT;
    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);
    this.currentCameraPos.set(
      targetPos.x - forwardX * dist,
      targetPos.y + height,
      targetPos.z - forwardZ * dist,
    );
    this.currentTargetPos.set(targetPos.x, targetPos.y + 1.5, targetPos.z);
    this.camera.position.copy(this.currentCameraPos);
    this.camera.lookAt(this.currentTargetPos);
  }

  public cycleMode(): CameraMode {
    if (this.mode === 'CHASE') this.mode = 'CLOSE';
    else if (this.mode === 'CLOSE') this.mode = 'COCKPIT';
    else if (this.mode === 'COCKPIT') this.mode = 'TOP_DOWN';
    else this.mode = 'CHASE';
    return this.mode;
  }

  public updateVehicle(
    carPos: THREE.Vector3,
    heading: number,
    speed: number,
    dt: number,
    city?: City,
  ): void {
    let dist: number = CAMERA_CONFIG.CHASE_DISTANCE;
    let height: number = CAMERA_CONFIG.CHASE_HEIGHT;

    if (this.mode === 'CLOSE') {
      dist = 5.5;
      height = 2.2;
    } else if (this.mode === 'COCKPIT') {
      dist = -0.3; // Inside cabin
      height = 1.15;
    } else if (this.mode === 'TOP_DOWN') {
      dist = 1.0;
      height = 28.0;
    }

    // Dynamic FOV speed zoom effect
    const speedRatio = Math.min(1.0, Math.abs(speed) / 45.0);
    const baseFov = this.mode === 'COCKPIT' ? 75 : 65;
    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      baseFov + speedRatio * 15,
      GameCamera.smoothing(0.1, dt),
    );
    this.camera.updateProjectionMatrix();

    // Calculate ideal camera position behind the car
    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);
    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);

    let targetCamX = carPos.x - forwardX * dist;
    let targetCamZ = carPos.z - forwardZ * dist;
    let targetCamY = carPos.y + height;

    if (this.mode === 'COCKPIT') {
      // Offset to driver side (left seat)
      targetCamX = carPos.x + forwardX * 0.1 - rightX * 0.35;
      targetCamZ = carPos.z + forwardZ * 0.1 - rightZ * 0.35;
      targetCamY = carPos.y + 1.15;
    } else if (this.mode === 'TOP_DOWN') {
      targetCamX = carPos.x;
      targetCamZ = carPos.z + 0.1;
      targetCamY = carPos.y + height;
    } else if (city) {
      // Anti-clipping: check raycast against buildings in 3D
      const col = city.checkCollision(targetCamX, targetCamZ, 0.8, targetCamY);
      if (col.collided) {
        targetCamX = carPos.x - forwardX * (dist * 0.35);
        targetCamZ = carPos.z - forwardZ * (dist * 0.35);
        targetCamY = carPos.y + height * 0.75;
      }
    }

    if (
      !Number.isFinite(targetCamX) ||
      !Number.isFinite(targetCamY) ||
      !Number.isFinite(targetCamZ)
    ) {
      targetCamX = carPos.x;
      targetCamY = carPos.y + height;
      targetCamZ = carPos.z;
    }

    // Smooth interpolation with delta time (hard attach in COCKPIT mode to eliminate visual jitter)
    const lerpFactor =
      this.mode === 'COCKPIT' ? 1.0 : GameCamera.smoothing(CAMERA_CONFIG.SMOOTH_FACTOR, dt);
    this.desiredCamPos.set(targetCamX, targetCamY, targetCamZ);
    this.currentCameraPos.lerp(this.desiredCamPos, lerpFactor);
    this.camera.position.copy(this.currentCameraPos);

    // Look slightly ahead of the car
    const lookAheadDist =
      this.mode === 'TOP_DOWN'
        ? 0
        : this.mode === 'COCKPIT'
          ? 12.0
          : CAMERA_CONFIG.LOOK_AHEAD_DISTANCE;
    const lookTarget = this.desiredLookTarget.set(
      carPos.x + forwardX * lookAheadDist - (this.mode === 'COCKPIT' ? rightX * 0.35 : 0),
      carPos.y + (this.mode === 'COCKPIT' ? 1.05 : 1.2),
      carPos.z + forwardZ * lookAheadDist - (this.mode === 'COCKPIT' ? rightZ * 0.35 : 0),
    );

    this.currentTargetPos.lerp(lookTarget, lerpFactor);
    this.camera.lookAt(this.currentTargetPos);
  }

  public updateOnFoot(
    playerPos: THREE.Vector3,
    playerRotationY: number,
    dt: number,
    city?: City,
  ): void {
    const dist = CAMERA_CONFIG.FOOT_DISTANCE;
    const height = CAMERA_CONFIG.FOOT_HEIGHT;

    // Reset FOV towards 60 on foot
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 60.0, GameCamera.smoothing(0.1, dt));
    this.camera.updateProjectionMatrix();

    const forwardX = Math.sin(playerRotationY);
    const forwardZ = Math.cos(playerRotationY);

    let targetCamX = playerPos.x - forwardX * dist;
    let targetCamZ = playerPos.z - forwardZ * dist;
    let targetCamY = playerPos.y + height;

    const isInterior = playerPos.x >= 3800 && playerPos.z >= 3800;
    if (isInterior) {
      targetCamY = Math.max(100.8, Math.min(104.2, targetCamY));
    } else if (city) {
      // 3-step ray sample from playerPos towards targetCam
      for (let step = 1; step <= 3; step++) {
        const frac = step / 3.0;
        const testX = THREE.MathUtils.lerp(playerPos.x, targetCamX, frac);
        const testZ = THREE.MathUtils.lerp(playerPos.z, targetCamZ, frac);
        const testY = THREE.MathUtils.lerp(playerPos.y + 1.5, targetCamY, frac);
        const col = city.checkCollision(testX, testZ, 0.5, testY);
        if (col.collided) {
          targetCamX = THREE.MathUtils.lerp(playerPos.x, targetCamX, Math.max(0.2, frac - 0.2));
          targetCamZ = THREE.MathUtils.lerp(playerPos.z, targetCamZ, Math.max(0.2, frac - 0.2));
          targetCamY = THREE.MathUtils.lerp(
            playerPos.y + 1.5,
            targetCamY,
            Math.max(0.2, frac - 0.2),
          );
          break;
        }
      }
    }

    if (
      !Number.isFinite(targetCamX) ||
      !Number.isFinite(targetCamY) ||
      !Number.isFinite(targetCamZ)
    ) {
      targetCamX = playerPos.x;
      targetCamY = playerPos.y + height;
      targetCamZ = playerPos.z;
    }

    const lerpFactor = GameCamera.smoothing(0.15, dt);
    this.desiredCamPos.set(targetCamX, targetCamY, targetCamZ);
    this.currentCameraPos.lerp(this.desiredCamPos, lerpFactor);
    this.camera.position.copy(this.currentCameraPos);

    const lookTarget = this.desiredLookTarget.set(playerPos.x, playerPos.y + 1.5, playerPos.z);
    this.currentTargetPos.lerp(lookTarget, lerpFactor);
    this.camera.lookAt(this.currentTargetPos);
  }
}
