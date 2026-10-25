import { VEHICLE_CONFIG } from '../utils/Constants';

export interface CarInput {
  throttle: boolean;
  reverse: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  handbrake: boolean;
  nitro?: boolean;
  hoverToggle?: boolean;
  ascend?: boolean;
  descend?: boolean;
}

export interface CarState {
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  steerAngle: number;
  isDrifting: boolean;
  isBoosting: boolean;
  isAirborne: boolean;
  nitro: number;
  gear: number | string;
  rpm: number;
  wheelRotation: number;
}

export class CarPhysics {
  public x: number = 0;
  public y: number = 0.5;
  public z: number = 0;
  public vy: number = 0; // Vertical velocity for stunt jumps
  public heading: number = 0; // Radians: 0 faces +Z
  public speed: number = 0; // In m/s
  public steerAngle: number = 0; // Radians
  public isDrifting: boolean = false;
  public isBoosting: boolean = false;
  public isAirborne: boolean = false;
  public isHoverMode: boolean = false;
  public nitro: number = VEHICLE_CONFIG.MAX_NITRO;
  public wheelRotation: number = 0;
  public rpm: number = 0.2;
  public gear: number | string = 1;

  // Stunt jump flight tracking
  public airtime: number = 0;
  public jumpStartX: number = 0;
  public jumpStartZ: number = 0;

  // Performance Tuning & Spike Physics (Phase 9 & 10)
  public engineStage: number = 0; // 0: stock, 1: +25%, 2: +50%, 3: +85%
  public armorPlating: boolean = false;
  public hasSpikePuncture: boolean = false;

  constructor(startX: number = 0, startZ: number = 0, initialHeading: number = 0) {
    this.x = startX;
    this.z = startZ;
    this.heading = initialHeading;
  }

  public reset(startX: number = 0, startZ: number = 0, initialHeading: number = 0): void {
    this.x = startX;
    this.y = 0.5;
    this.z = startZ;
    this.vy = 0;
    this.heading = initialHeading;
    this.speed = 0;
    this.steerAngle = 0;
    this.isDrifting = false;
    this.isBoosting = false;
    this.isAirborne = false;
    this.isHoverMode = false;
    this.nitro = VEHICLE_CONFIG.MAX_NITRO;
    this.wheelRotation = 0;
    this.rpm = 0.2;
    this.gear = 1;
    this.airtime = 0;
  }

  public launchJump(upwardVelocity: number = 10.0): void {
    if (!this.isAirborne) {
      this.isAirborne = true;
      this.vy = upwardVelocity;
      this.airtime = 0;
      this.jumpStartX = this.x;
      this.jumpStartZ = this.z;
    }
  }

  public update(
    dt: number,
    input: CarInput,
  ): { stuntCompleted: boolean; distance: number; airtime: number } {
    let stuntResult = { stuntCompleted: false, distance: 0, airtime: 0 };
    if (dt <= 0 || dt > 0.5) return stuntResult;

    // 1. Steering calculation
    let targetSteer = 0;
    if (input.steerLeft) targetSteer += VEHICLE_CONFIG.MAX_STEER_ANGLE;
    if (input.steerRight) targetSteer -= VEHICLE_CONFIG.MAX_STEER_ANGLE;

    const speedRatio = Math.min(1.0, Math.abs(this.speed) / VEHICLE_CONFIG.MAX_FORWARD_SPEED);
    const effectiveTargetSteer = targetSteer * (1.0 - speedRatio * 0.4);

    const steerRate =
      targetSteer !== 0 ? VEHICLE_CONFIG.STEER_SPEED : VEHICLE_CONFIG.STEER_RETURN_SPEED;
    if (this.steerAngle < effectiveTargetSteer) {
      this.steerAngle = Math.min(effectiveTargetSteer, this.steerAngle + steerRate * dt);
    } else if (this.steerAngle > effectiveTargetSteer) {
      this.steerAngle = Math.max(effectiveTargetSteer, this.steerAngle - steerRate * dt);
    }

    // 2. Nitro Boost logic
    this.isBoosting = false;
    if (input.nitro && this.nitro > 2 && input.throttle && this.speed > 5) {
      this.isBoosting = true;
      this.nitro = Math.max(0, this.nitro - VEHICLE_CONFIG.NITRO_CONSUMPTION * dt);
    } else {
      // Passive recharge
      this.nitro = Math.min(
        VEHICLE_CONFIG.MAX_NITRO,
        this.nitro + VEHICLE_CONFIG.NITRO_RECHARGE * dt,
      );
    }

    // 3. Acceleration / Braking with Tuning & Spike Punctures
    this.isDrifting = false;
    const stageMulti = [1.0, 1.25, 1.5, 1.85][this.engineStage] || 1.0;
    const stageSpeedBonus = [0, 10.0, 18.0, 29.0][this.engineStage] || 0; // m/s bonus

    let accel =
      (this.isBoosting ? VEHICLE_CONFIG.NITRO_ACCELERATION : VEHICLE_CONFIG.ACCELERATION) *
      stageMulti;
    let maxForward =
      (this.isBoosting ? VEHICLE_CONFIG.MAX_NITRO_SPEED : VEHICLE_CONFIG.MAX_FORWARD_SPEED) +
      stageSpeedBonus;

    // Blown tire drag and speed cap
    if (this.hasSpikePuncture) {
      accel *= 0.55;
      maxForward = Math.min(maxForward, 16.0); // max ~58 km/h on rims
      this.steerAngle += Math.sin(this.wheelRotation * 3.5) * 0.03;
    }

    if (input.throttle) {
      if (this.speed < -0.5) {
        this.speed += VEHICLE_CONFIG.BRAKE_DECELERATION * dt;
      } else {
        this.speed += accel * dt;
        if (this.speed > maxForward) {
          this.speed = maxForward;
        }
      }
    } else if (input.reverse) {
      if (this.speed > 0.5) {
        this.speed -= VEHICLE_CONFIG.BRAKE_DECELERATION * dt;
      } else {
        this.speed -= VEHICLE_CONFIG.ACCELERATION * 0.6 * dt;
        if (this.speed < -VEHICLE_CONFIG.MAX_REVERSE_SPEED) {
          this.speed = -VEHICLE_CONFIG.MAX_REVERSE_SPEED;
        }
      }
    } else {
      const friction = VEHICLE_CONFIG.ROLLING_FRICTION * dt;
      if (Math.abs(this.speed) <= friction) {
        this.speed = 0;
      } else if (this.speed > 0) {
        this.speed -= friction;
      } else {
        this.speed += friction;
      }
    }

    // Handbrake action
    if (input.handbrake) {
      const hbDecel = VEHICLE_CONFIG.HANDBRAKE_DECELERATION * dt;
      if (Math.abs(this.speed) > 5.0 && Math.abs(this.steerAngle) > 0.15) {
        this.isDrifting = true;
      }
      if (Math.abs(this.speed) <= hbDecel) {
        this.speed = 0;
      } else if (this.speed > 0) {
        this.speed -= hbDecel;
      } else {
        this.speed += hbDecel;
      }
    }

    // Aerodynamic Drag
    const dragForce = VEHICLE_CONFIG.DRAG_COEFFICIENT * this.speed * Math.abs(this.speed);
    this.speed -= dragForce * dt;

    // 4. Angular turning
    if (Math.abs(this.speed) > 0.05) {
      const driftMultiplier = this.isDrifting ? 1.6 : 1.0;
      const turnRate =
        (this.speed / VEHICLE_CONFIG.CAR_LENGTH) * Math.sin(this.steerAngle) * driftMultiplier;
      this.heading += turnRate * dt;
    }

    // Normalize heading to [-PI, PI]
    this.heading = ((this.heading + Math.PI) % (Math.PI * 2)) - Math.PI;

    // 5. Position integration
    const forwardX = Math.sin(this.heading);
    const forwardZ = Math.cos(this.heading);

    this.x += forwardX * this.speed * dt;
    this.z += forwardZ * this.speed * dt;

    // 6. Vertical Jump & DeLorean Hover Flight Physics
    if (input.hoverToggle) {
      this.isHoverMode = !this.isHoverMode;
      if (this.isHoverMode && this.y <= 0.8) {
        this.isAirborne = true;
        this.vy = 8.0;
      }
    }

    if (this.isHoverMode) {
      this.isAirborne = true;
      this.airtime += dt;

      // Ascend / Descend controls
      if (input.ascend) {
        this.vy = Math.min(20.0, this.vy + 26.0 * dt);
      } else if (input.descend) {
        this.vy = Math.max(-18.0, this.vy - 24.0 * dt);
      } else {
        // Anti-gravity auto-leveling hover stabilization
        const targetVy = Math.sin(this.airtime * 2.5) * 0.35;
        this.vy += (targetVy - this.vy) * Math.min(1.0, 5.0 * dt);
      }

      this.y += this.vy * dt;

      // Maximum flight ceiling
      if (this.y > 80.0) {
        this.y = 80.0;
        this.vy = Math.min(0, this.vy);
      }

      // Smooth landing or touch down
      if (this.y <= 0.55) {
        if (!input.ascend && input.descend) {
          this.y = 0.5;
          this.vy = 0;
          this.isHoverMode = false;
          this.isAirborne = false;
        } else {
          this.y = 0.65;
          this.vy = Math.max(0, this.vy);
        }
      }
    } else if (this.isAirborne) {
      this.airtime += dt;
      this.vy -= 22.0 * dt; // Gravity
      this.y += this.vy * dt;

      // Land on ground
      if (this.y <= 0.5) {
        this.y = 0.5;
        this.vy = 0;
        this.isAirborne = false;

        const jumpDist = Math.hypot(this.x - this.jumpStartX, this.z - this.jumpStartZ);
        if (jumpDist > 12.0 && this.airtime > 0.4) {
          stuntResult = {
            stuntCompleted: true,
            distance: Math.round(jumpDist),
            airtime: Number(this.airtime.toFixed(1)),
          };
        }
      }
    }

    // 7. Wheel rotation
    const distanceTraveled = this.speed * dt;
    this.wheelRotation += distanceTraveled / VEHICLE_CONFIG.WHEEL_RADIUS;

    // 8. Gear & RPM Calculation
    this.updateGearsAndRpm();

    return stuntResult;
  }

  private updateGearsAndRpm(): void {
    if (this.speed < -0.1) {
      this.gear = 'R';
      this.rpm = Math.min(
        1.0,
        0.2 + (Math.abs(this.speed) / VEHICLE_CONFIG.MAX_REVERSE_SPEED) * 0.8,
      );
      return;
    }

    const kmh = Math.abs(this.getSpeedKmh());
    if (kmh < 1) {
      this.gear = 'P';
      this.rpm = 0.2;
    } else if (kmh < 35) {
      this.gear = 1;
      this.rpm = 0.2 + (kmh / 35) * 0.8;
    } else if (kmh < 75) {
      this.gear = 2;
      this.rpm = 0.3 + ((kmh - 35) / 40) * 0.7;
    } else if (kmh < 120) {
      this.gear = 3;
      this.rpm = 0.35 + ((kmh - 75) / 45) * 0.65;
    } else if (kmh < 170) {
      this.gear = 4;
      this.rpm = 0.4 + ((kmh - 120) / 50) * 0.6;
    } else {
      this.gear = 5;
      this.rpm = 0.45 + Math.min(0.55, ((kmh - 170) / 75) * 0.55);
    }
  }

  public getSpeedKmh(): number {
    return Math.round(this.speed * 3.6);
  }

  public setEngineStage(stage: number): void {
    this.engineStage = Math.max(0, Math.min(3, Math.floor(stage)));
  }

  public setArmorPlating(enabled: boolean): void {
    this.armorPlating = enabled;
  }

  public blowTires(): void {
    this.hasSpikePuncture = true;
  }

  public repairTires(): void {
    this.hasSpikePuncture = false;
  }

  public getState(): CarState {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      heading: this.heading,
      speed: this.speed,
      steerAngle: this.steerAngle,
      isDrifting: this.isDrifting,
      isBoosting: this.isBoosting,
      isAirborne: this.isAirborne,
      nitro: this.nitro,
      gear: this.gear,
      rpm: this.rpm,
      wheelRotation: this.wheelRotation,
    };
  }
}
