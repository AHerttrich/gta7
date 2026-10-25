import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TrafficSystem } from '../traffic/TrafficSystem';
import { PedestrianSystem } from '../pedestrians/PedestrianSystem';

describe('Traffic & Pedestrians Life in GTA 7', () => {
  it('should spawn initial traffic cars on roads', () => {
    const scene = new THREE.Scene();
    const traffic = new TrafficSystem(scene);
    expect(traffic.cars.length).toBeGreaterThan(0);

    const firstCar = traffic.cars[0];
    expect(firstCar.speed).toBeGreaterThan(0);
    expect(firstCar.health).toBe(80);
    expect(firstCar.isWrecked).toBe(false);
  });

  it('should damage traffic cars and mark wrecked on 0 health', () => {
    const scene = new THREE.Scene();
    const traffic = new TrafficSystem(scene);
    const car = traffic.cars[0];

    traffic.damageCar(car, 90);
    expect(car.health).toBeLessThanOrEqual(0);
    expect(car.isWrecked).toBe(true);
    expect(car.speed).toBe(0);
  });

  it('should spawn pedestrians on sidewalks with walking animation state', () => {
    const scene = new THREE.Scene();
    const pedestrians = new PedestrianSystem(scene);
    expect(pedestrians.pedestrians.length).toBeGreaterThan(0);

    const firstPed = pedestrians.pedestrians[0];
    expect(firstPed.speed).toBeGreaterThan(0);
    expect(firstPed.isPanicking).toBe(false);
  });

  it('should cause nearby pedestrians to panic when threatened or honked at', () => {
    const scene = new THREE.Scene();
    const pedestrians = new PedestrianSystem(scene);
    const ped = pedestrians.pedestrians[0];

    // Scare nearby
    pedestrians.scareNearby(ped.x, ped.z, 10);
    expect(ped.isPanicking).toBe(true);
    expect(ped.panicTimer).toBeGreaterThan(0);
  });
});
