import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MissionSystem } from '../missions/MissionSystem';
import { SoundManager } from '../audio/SoundManager';
import { EconomySystem } from '../economy/EconomySystem';
import { CarPhysics } from '../vehicles/CarPhysics';

describe('Missions, Street Racing & Stunts in GTA 7', () => {
  it('should start street race and initialize checkpoint sequence', () => {
    const scene = new THREE.Scene();
    const sound = new SoundManager();
    const economy = new EconomySystem();
    const missions = new MissionSystem(scene, sound, economy);

    expect(missions.race.isActive).toBe(false);
    missions.startRace();

    expect(missions.race.isActive).toBe(true);
    expect(missions.race.currentCheckpointIndex).toBe(0);
    expect(missions.race.totalCheckpoints).toBeGreaterThan(0);
  });

  it('should start taxi mission with pickup and dropoff points', () => {
    const scene = new THREE.Scene();
    const sound = new SoundManager();
    const economy = new EconomySystem();
    const missions = new MissionSystem(scene, sound, economy);

    expect(missions.taxiMission.isActive).toBe(false);
    missions.startTaxiMission();

    expect(missions.taxiMission.isActive).toBe(true);
    expect(missions.taxiMission.hasPickedUp).toBe(false);
    expect(missions.taxiMission.fare).toBeGreaterThan(0);
  });

  it('should reward cash when performing high distance stunt jump', () => {
    const scene = new THREE.Scene();
    const sound = new SoundManager();
    const economy = new EconomySystem();
    const missions = new MissionSystem(scene, sound, economy);

    const initialCash = economy.cash;
    missions.handleStuntJump(45, 1.8);

    expect(economy.cash).toBe(initialCash + 450);
  });

  it('should consume nitro when boosting and recharge when coasting', () => {
    const car = new CarPhysics();
    car.speed = 20; // moving fast enough to boost

    // Boost with nitro
    car.update(0.2, {
      throttle: true,
      reverse: false,
      steerLeft: false,
      steerRight: false,
      handbrake: false,
      nitro: true,
    });

    expect(car.isBoosting).toBe(true);
    expect(car.nitro).toBeLessThan(100);

    const nitroAfterBoost = car.nitro;

    // Coast without nitro
    car.update(0.2, {
      throttle: false,
      reverse: false,
      steerLeft: false,
      steerRight: false,
      handbrake: false,
      nitro: false,
    });

    expect(car.isBoosting).toBe(false);
    expect(car.nitro).toBeGreaterThan(nitroAfterBoost);
  });
});
