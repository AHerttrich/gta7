import { describe, it, expect } from 'vitest';
import { Car } from '../vehicles/Car';
import { CarPhysics } from '../vehicles/CarPhysics';
import { Building } from '../city/Building';
import { Road } from '../city/Road';

describe('DeLorean Flying Mode & Graphics Upgrades', () => {
  it('should initialize DeLorean with brushed stainless steel finish', () => {
    const car = new Car(0, 0, 0);
    expect(car.group).toBeDefined();
    expect(car.physics.isHoverMode).toBe(false);
    expect(car.physics.y).toBe(0.5);
  });

  it('should toggle into hover flight mode and lift into the air', () => {
    const car = new Car(0, 0, 0);

    // Toggle hover flight mode
    car.update(0.1, {
      throttle: true,
      reverse: false,
      steerLeft: false,
      steerRight: false,
      handbrake: false,
      hoverToggle: true,
      ascend: true,
    });

    expect(car.physics.isHoverMode).toBe(true);
    expect(car.physics.isAirborne).toBe(true);
    expect(car.physics.vy).toBeGreaterThan(0); // Upward lift
    expect(car.physics.y).toBeGreaterThan(0.5);
  });

  it('should climb when ascend input is held in hover flight', () => {
    const physics = new CarPhysics(0, 0, 0);
    physics.isHoverMode = true;
    physics.y = 2.0;

    physics.update(0.2, {
      throttle: true,
      reverse: false,
      steerLeft: false,
      steerRight: false,
      handbrake: false,
      ascend: true,
    });

    expect(physics.vy).toBeGreaterThan(0);
    expect(physics.y).toBeGreaterThan(2.0);
  });

  it('should descend smoothly and touch down when descending near ground', () => {
    const physics = new CarPhysics(0, 0, 0);
    physics.isHoverMode = true;
    physics.y = 0.58;
    physics.vy = -1.0;

    physics.update(0.1, {
      throttle: false,
      reverse: false,
      steerLeft: false,
      steerRight: false,
      handbrake: false,
      descend: true,
    });

    expect(physics.y).toBe(0.5);
    expect(physics.isHoverMode).toBe(false);
    expect(physics.isAirborne).toBe(false);
  });

  it('should generate enhanced city graphics: buildings, palm trees, street lamps and crosswalks', () => {
    const bldg = Building.createBuilding(0, 0, 30, 30, 45, 0x00d4ff, 'GTA 7');
    expect(bldg.mesh.children.length).toBeGreaterThan(2);
    expect(bldg.bounds.height).toBeGreaterThan(45);

    const palm = Road.createPalmTree(10, 10);
    expect(palm.children.length).toBeGreaterThan(5);

    const lamp = Road.createStreetLamp(5, 5);
    expect(lamp.children.length).toBeGreaterThan(2);

    const crosswalk = Road.createCrosswalk(0, 0, true);
    expect(crosswalk.children.length).toBe(6);
  });
});
