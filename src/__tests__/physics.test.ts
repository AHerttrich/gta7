import { describe, it, expect } from 'vitest';
import { CarPhysics } from '../vehicles/CarPhysics';
import { VEHICLE_CONFIG } from '../utils/Constants';

describe('CarPhysics', () => {
  it('should initialize at starting coordinates with zero speed', () => {
    const car = new CarPhysics(10, 20, 0);
    expect(car.x).toBe(10);
    expect(car.z).toBe(20);
    expect(car.speed).toBe(0);
    expect(car.getSpeedKmh()).toBe(0);
  });

  it('should accelerate forward when throttle is active', () => {
    const car = new CarPhysics();
    car.update(0.1, {
      throttle: true,
      reverse: false,
      steerLeft: false,
      steerRight: false,
      handbrake: false,
    });

    expect(car.speed).toBeGreaterThan(0);
    expect(car.getSpeedKmh()).toBeGreaterThan(0);
  });

  it('should respect maximum forward speed limit', () => {
    const car = new CarPhysics();
    car.speed = 100; // Force high speed
    car.update(0.1, {
      throttle: true,
      reverse: false,
      steerLeft: false,
      steerRight: false,
      handbrake: false,
    });

    expect(car.speed).toBeLessThanOrEqual(VEHICLE_CONFIG.MAX_FORWARD_SPEED);
  });

  it('should decelerate with friction when no inputs are pressed', () => {
    const car = new CarPhysics();
    car.speed = 20;
    car.update(0.1, {
      throttle: false,
      reverse: false,
      steerLeft: false,
      steerRight: false,
      handbrake: false,
    });

    expect(car.speed).toBeLessThan(20);
  });

  it('should activate drift flag during high speed handbrake turns', () => {
    const car = new CarPhysics();
    car.speed = 25;
    car.steerAngle = 0.5;
    car.update(0.1, {
      throttle: false,
      reverse: false,
      steerLeft: true,
      steerRight: false,
      handbrake: true,
    });

    expect(car.isDrifting).toBe(true);
  });

  it('should reset position and speed cleanly', () => {
    const car = new CarPhysics(50, 50, 1.0);
    car.speed = 30;
    car.reset(0, 0, 0);

    expect(car.x).toBe(0);
    expect(car.z).toBe(0);
    expect(car.speed).toBe(0);
    expect(car.heading).toBe(0);
  });
});
