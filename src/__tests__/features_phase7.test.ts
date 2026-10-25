import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RadioSystem, RADIO_STATIONS } from '../audio/RadioSystem';
import { SoundManager } from '../audio/SoundManager';
import { Helicopter } from '../vehicles/Helicopter';
import { PoliceSystem } from '../police/PoliceSystem';
import { City } from '../city/City';
import { Input } from '../engine/Input';

describe('Phase 7 Features: Radio Stations, Helicopter & Police Interceptor', () => {
  it('should initialize radio stations and cycle correctly', () => {
    const sound = new SoundManager();
    const radio = new RadioSystem(sound);

    expect(RADIO_STATIONS.length).toBeGreaterThanOrEqual(4);
    expect(radio.getCurrentStation().id).toBe('synthwave');

    const s1 = radio.cycleStation();
    expect(s1.id).toBe('cyberpunk');
    expect(s1.bpm).toBe(136);

    const s2 = radio.cycleStation();
    expect(s2.id).toBe('chill');

    const s3 = radio.cycleStation();
    expect(s3.id).toBe('off');

    const s4 = radio.cycleStation();
    expect(s4.id).toBe('synthwave'); // Loops back to start
  });

  it('should initialize player helicopter on skyscraper helipad', () => {
    const heli = new Helicopter(0, 52.5, 0);

    expect(heli.x).toBe(0);
    expect(heli.y).toBe(52.5);
    expect(heli.z).toBe(0);
    expect(heli.rpm).toBe(0);
    expect(heli.isOccupied).toBe(false);
  });

  it('should spin up rotor and ascend when player occupies helicopter and applies lift', () => {
    const heli = new Helicopter(0, 52.5, 0);
    const input = new Input();
    const city = new City();

    heli.isOccupied = true;
    input.touchState.ascend = true;

    // Simulate 0.5s of flight
    for (let i = 0; i < 5; i++) {
      heli.update(0.1, input, city);
    }

    expect(heli.rpm).toBeGreaterThan(0.3); // Spin-up
    expect(heli.vy).toBeGreaterThan(0); // Upward lift
    expect(heli.y).toBeGreaterThan(52.5); // Ascended
  });

  it('should steer, roll, and pitch forward during helicopter flight', () => {
    const heli = new Helicopter(0, 60.0, 0);
    const input = new Input();
    const city = new City();

    heli.isOccupied = true;
    heli.rpm = 1.0;

    // Forward and Left steering
    input.touchState.forward = true;
    input.touchState.left = true;

    heli.update(0.1, input, city);

    expect(heli.pitch).toBeLessThan(0); // Forward nose tilt
    expect(heli.heading).toBeGreaterThan(0); // Left turn
    expect(heli.roll).toBeGreaterThan(0); // Banking roll
  });

  it('should spawn police helicopter with searchlight at 4-5 stars and despawn below 4', () => {
    const scene = new THREE.Scene();
    const city = new City();
    const police = new PoliceSystem(scene, city);

    expect(police.policeHeli).toBeNull();

    // Trigger 4-star wanted level
    police.setWantedLevel(4);
    expect(police.policeHeli).not.toBeNull();
    expect(police.policeHeli?.y).toBe(38);
    expect(police.policeHeli?.searchlight).toBeDefined();

    // Update with player coordinates
    police.update(0.1, 50, 50);
    expect(police.policeHeli?.searchlightTarget.position.x).toBeCloseTo(
      50 - police.policeHeli!.x,
      1,
    );

    // Drop wanted level to 2 stars
    police.setWantedLevel(2);
    expect(police.policeHeli).toBeNull();
  });

  it('should spawn roadblocks at 3+ stars and smash when rammed at speed', () => {
    const scene = new THREE.Scene();
    const city = new City();
    const police = new PoliceSystem(scene, city);

    police.setWantedLevel(3);
    expect(police.roadblocks.length).toBeGreaterThan(0);

    const rb = police.roadblocks[0];
    expect(rb.isSmashed).toBe(false);

    // Ram roadblock at 15 m/s
    const hit = police.checkRoadblockCollision(rb.x, rb.z, 15.0);
    expect(hit).toBe(true);
    expect(rb.isSmashed).toBe(true);

    // Dropping wanted level clears roadblocks
    police.setWantedLevel(1);
    expect(police.roadblocks.length).toBe(0);
  });
});
