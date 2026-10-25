import { VEHICLE_CONFIG } from '../utils/Constants';

export interface CarInput {
  throttle: boolean;
  reverse: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  handbrake: boolean;
}

export interface CarState {
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  steerAngle: number;
  isDrifting: boolean;
  gear: number | string;
  rpm: number;
  wheelRotation: number;
}

export class CarPhysics {
  public x: number = 0;
  public y: number = 0.5;
  public z: number = 0;
  public heading: number = 0; // In radians: 0 faces +Z
  public speed: number = 0; // In m/s
  public steerAngle: number = 0; // In radians
  public isDrifting: boolean = false;
  public wheelRotation: number = 0;
  public rpm: number = 0.2;
  public gear: number | string = 1;

  constructor(startX: number = 0, startZ: number = 0, initialHeading: number = 0) {
    this.x = startX;
    this.z = startZ;
    this.heading = initialHeading;
  }

  public reset(startX: number = 0, startZ: number = 0, initialHeading: number = 0): void {
    this.x = startX;
    this.y = 0.5;
    this.z = startZ;
    this.heading = initialHeading;
    this.speed = 0;
    this.steerAngle = 0;
    this.isDrifting = false;
    this.wheelRotation = 0;
    this.rpm = 0.2;
    this.gear = 1;
  }

  public update(dt: number, input: CarInput): void {
    if (dt <= 0 || dt > 0.5) return; // Prevent teleportation on lag spikes

    // 1. Steering calculation
    let targetSteer = 0;
    if (input.steerLeft) targetSteer += VEHICLE_CONFIG.MAX_STEER_ANGLE;
    if (input.steerRight) targetSteer -= VEHICLE_CONFIG.MAX_STEER_ANGLE;

    // Steering sensitivity reduces slightly at high speeds for stability
    const speedRatio = Math.min(1.0, Math.abs(this.speed) / VEHICLE_CONFIG.MAX_FORWARD_SPEED);
    const effectiveTargetSteer = targetSteer * (1.0 - speedRatio * 0.4);

    const steerRate =
      targetSteer !== 0 ? VEHICLE_CONFIG.STEER_SPEED : VEHICLE_CONFIG.STEER_RETURN_SPEED;
    if (this.steerAngle < effectiveTargetSteer) {
      this.steerAngle = Math.min(effectiveTargetSteer, this.steerAngle + steerRate * dt);
    } else if (this.steerAngle > effectiveTargetSteer) {
      this.steerAngle = Math.max(effectiveTargetSteer, this.steerAngle - steerRate * dt);
    }

    // 2. Acceleration / Braking
    this.isDrifting = false;

    if (input.throttle) {
      if (this.speed < -0.5) {
        // Active brake while going in reverse
        this.speed += VEHICLE_CONFIG.BRAKE_DECELERATION * dt;
      } else {
        // Accelerating forward
        this.speed += VEHICLE_CONFIG.ACCELERATION * dt;
        if (this.speed > VEHICLE_CONFIG.MAX_FORWARD_SPEED) {
          this.speed = VEHICLE_CONFIG.MAX_FORWARD_SPEED;
        }
      }
    } else if (input.reverse) {
      if (this.speed > 0.5) {
        // Active brake while going forward
        this.speed -= VEHICLE_CONFIG.BRAKE_DECELERATION * dt;
      } else {
        // Accelerating in reverse
        this.speed -= VEHICLE_CONFIG.ACCELERATION * 0.6 * dt;
        if (this.speed < -VEHICLE_CONFIG.MAX_REVERSE_SPEED) {
          this.speed = -VEHICLE_CONFIG.MAX_REVERSE_SPEED;
        }
      }
    } else {
      // Natural rolling friction deceleration
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

    // 3. Angular turning
    if (Math.abs(this.speed) > 0.05) {
      const driftMultiplier = this.isDrifting ? 1.6 : 1.0;
      const turnRate =
        (this.speed / VEHICLE_CONFIG.CAR_LENGTH) * Math.sin(this.steerAngle) * driftMultiplier;
      this.heading += turnRate * dt;
    }

    // Normalize heading to [-PI, PI]
    this.heading = ((this.heading + Math.PI) % (Math.PI * 2)) - Math.PI;

    // 4. Position integration
    const forwardX = Math.sin(this.heading);
    const forwardZ = Math.cos(this.heading);

    this.x += forwardX * this.speed * dt;
    this.z += forwardZ * this.speed * dt;

    // 5. Wheel rotation
    const distanceTraveled = this.speed * dt;
    this.wheelRotation += distanceTraveled / VEHICLE_CONFIG.WHEEL_RADIUS;

    // 6. Gear & RPM Calculation
    this.updateGearsAndRpm();
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
    } else if (kmh < 30) {
      this.gear = 1;
      this.rpm = 0.2 + (kmh / 30) * 0.8;
    } else if (kmh < 60) {
      this.gear = 2;
      this.rpm = 0.3 + ((kmh - 30) / 30) * 0.7;
    } else if (kmh < 95) {
      this.gear = 3;
      this.rpm = 0.35 + ((kmh - 60) / 35) * 0.65;
    } else if (kmh < 130) {
      this.gear = 4;
      this.rpm = 0.4 + ((kmh - 95) / 35) * 0.6;
    } else {
      this.gear = 5;
      this.rpm = 0.45 + Math.min(0.55, ((kmh - 130) / 35) * 0.55);
    }
  }

  public getSpeedKmh(): number {
    return Math.round(this.speed * 3.6);
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
      gear: this.gear,
      rpm: this.rpm,
      wheelRotation: this.wheelRotation,
    };
  }
}
