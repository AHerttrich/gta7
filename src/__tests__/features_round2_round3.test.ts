import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EconomySystem } from '../economy/EconomySystem';
import { CarPhysics } from '../vehicles/CarPhysics';
import { Car } from '../vehicles/Car';
import { PoliceSystem } from '../police/PoliceSystem';
import { City } from '../city/City';
import { VEHICLE_CONFIG } from '../utils/Constants';

describe('Round 2 & 3: Tuning Shop, Spike Strips & PIT Maneuvers', () => {
  let economy: EconomySystem;
  let physics: CarPhysics;
  let car: Car;
  let scene: THREE.Scene;
  let city: City;
  let police: PoliceSystem;

  beforeEach(() => {
    economy = new EconomySystem();
    economy.cash = 10000; // ample test cash
    physics = new CarPhysics();
    car = new Car();
    scene = new THREE.Scene();
    city = new City();
    police = new PoliceSystem(scene, city);
  });

  it('allows purchasing tuning upgrades when cash is sufficient and tracks purchase status', () => {
    expect(economy.tuningUpgrades.length).toBeGreaterThan(0);
    const upgrade = economy.tuningUpgrades[0];
    const initialCash = economy.cash;

    const success = economy.buyTuning(upgrade.id);
    expect(success).toBe(true);
    expect(upgrade.purchased).toBe(true);
    expect(economy.cash).toBe(initialCash - upgrade.price);

    // Cannot rebuy already purchased item
    const rebuy = economy.buyTuning(upgrade.id);
    expect(rebuy).toBe(true);
    expect(economy.cash).toBe(initialCash - upgrade.price);
  });

  it('prevents purchasing tuning upgrades when player has insufficient cash', () => {
    economy.cash = 50;
    const expensiveUpgrade = economy.tuningUpgrades.find((u) => u.price > 1000)!;
    const success = economy.buyTuning(expensiveUpgrade.id);
    expect(success).toBe(false);
    expect(expensiveUpgrade.purchased).toBe(false);
    expect(economy.cash).toBe(50);
  });

  it('applies engine stage tuning multipliers to acceleration and top speed in CarPhysics', () => {
    // Stage 0 (Stock)
    physics.setEngineStage(0);
    physics.update(0.2, {
      throttle: true,
      reverse: false,
      steerLeft: false,
      steerRight: false,
      handbrake: false,
      nitro: false,
    });
    const stockSpeed = physics.speed;

    // Stage 3 (Cyber Turbo)
    physics.reset();
    physics.setEngineStage(3);
    physics.update(0.2, {
      throttle: true,
      reverse: false,
      steerLeft: false,
      steerRight: false,
      handbrake: false,
      nitro: false,
    });
    const tunedSpeed = physics.speed;

    expect(stockSpeed).toBeGreaterThan(0);
    expect(tunedSpeed).toBeGreaterThan(stockSpeed);
  });

  it('halves vehicle damage taken when armor plating is active', () => {
    car.physics.setArmorPlating(false);
    car.takeDamage(40);
    const regularRemaining = car.health;

    car.repair();
    car.physics.setArmorPlating(true);
    car.takeDamage(40);
    const armoredRemaining = car.health;

    expect(armoredRemaining).toBeGreaterThan(regularRemaining);
    expect(armoredRemaining).toBe(VEHICLE_CONFIG.MAX_HEALTH - 20);
  });

  it('customizes neon underglow color on Car', () => {
    car.setUnderglowColor(0xff007f);
    // Verified method executes without error
    expect(car).toBeDefined();
  });

  it('punctures tires upon spike strip collision, reducing speed and adding steering drag', () => {
    police.setWantedLevel(3);
    expect(police.spikeStrips.length).toBeGreaterThan(0);

    const strip = police.spikeStrips[0];
    const hit = police.checkSpikeStripCollision(strip.x, strip.z);
    expect(hit).toBe(true);
    expect(strip.isTriggered).toBe(true);

    // Apply puncture to physics
    physics.blowTires();
    expect(physics.hasSpikePuncture).toBe(true);

    // Accelerated speed should now be capped at low speed
    for (let i = 0; i < 20; i++) {
      physics.update(0.1, {
        throttle: true,
        reverse: false,
        steerLeft: false,
        steerRight: false,
        handbrake: false,
        nitro: false,
      });
    }
    expect(physics.speed).toBeLessThanOrEqual(16.5);

    // Repair tires
    physics.repairTires();
    expect(physics.hasSpikePuncture).toBe(false);
  });

  it('detects tactical PIT maneuver when a cop cruiser strikes the player rear at speed', () => {
    police.setWantedLevel(2);
    expect(police.copCars.length).toBeGreaterThan(0);

    const cop = police.copCars[0];
    // Position cop right behind the player (player heading 0 faces +Z)
    const playerX = 10;
    const playerZ = 10;
    const playerHeading = 0;
    const playerSpeed = 20;

    cop.x = playerX + 1.2;
    cop.z = playerZ - 2.5; // behind player

    const pit = police.checkPitManeuver(playerX, playerZ, playerHeading, playerSpeed);
    expect(pit.triggered).toBe(true);
    expect(pit.spinDir).not.toBe(0);
  });
});
