import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { City } from '../city/City';
import { CITY_CONFIG } from '../utils/Constants';
import { WaterSystem } from '../water/WaterSystem';
import { TrainSystem } from '../trains/TrainSystem';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';

describe('Map Expansion: 7x7 Grid & Handcrafted POIs', () => {
  it('should initialize 7x7 city grid configuration', () => {
    expect(CITY_CONFIG.GRID_SIZE).toBe(7);
    expect(CITY_CONFIG.MAX_BOUND_X_POS).toBe(395.0);
    expect(CITY_CONFIG.MAX_BOUND_X_NEG).toBe(-435.0);
    expect(CITY_CONFIG.MAX_BOUND_Z).toBe(395.0);

    const city = new City();
    expect(city.maxBoundXPositive).toBe(395.0);
    expect(city.maxBoundXNegative).toBe(-435.0);
    expect(city.maxBoundZ).toBe(395.0);
    expect(city.buildingBounds.length).toBeGreaterThanOrEqual(49);
  });

  it('should contain Grand Central Cyber Park at Block [3, 3] (Center: x=0, z=0)', () => {
    const city = new City();

    // Central hero statue bound is at (18, -16)
    const statueCollision = city.checkCollision(18, -16, 1.0, 2.0);
    expect(statueCollision.collided).toBe(true);

    // Park pathway around pond is open for walking
    const pathCollision = city.checkCollision(0, -6, 0.5, 0.5);
    expect(pathCollision.collided).toBe(false);
  });

  it('should generate GTA 7 International Airport at Block [5, 3] (Center: x=176, z=0)', () => {
    const city = new City();

    // Airport Runway Centerline is at x = 186 (176 + 10)
    // The runway should be completely clear for high-speed drag racing and aircraft take-off!
    const runwayCollision = city.checkCollision(186, 0, 1.2, 0.5);
    expect(runwayCollision.collided).toBe(false);

    // Control Tower is at (176 - 22, 0 - 15) = (154, -15) with height 39m
    const towerCollision = city.checkCollision(154, -15, 1.0, 10.0);
    expect(towerCollision.collided).toBe(true);

    // Tower roof height check
    const roofH = city.getRoofHeightAt(154, -15, 1.0);
    expect(roofH).toBeGreaterThanOrEqual(38.0);
  });

  it('should generate Stunt Mega Stadium at Block [2, 5] (Center: x=-88, z=176)', () => {
    const city = new City();

    // Launch ramp at (-88, 176 - 14) = (-88, 162)
    const rampCollision = city.checkCollision(-88, 162, 1.0, 1.0);
    expect(rampCollision.collided).toBe(true);

    // Stadium floor transition is drivable
    const arenaFloor = city.checkCollision(-88, 176, 1.0, 0.5);
    expect(arenaFloor.collided).toBe(false);
  });

  it('should generate Lighthouse Island in the Western Ocean at x=-350, z=0', () => {
    const city = new City();

    // Lighthouse tower is at (-354, 0) with height 33m
    const lighthouseCollision = city.checkCollision(-354, 0, 1.0, 10.0);
    expect(lighthouseCollision.collided).toBe(true);

    const lighthouseRoof = city.getRoofHeightAt(-354, 0, 1.0);
    expect(lighthouseRoof).toBe(33.0);

    // Rocky island foundation allows landing
    const islandRock = city.checkCollision(-360, 10, 1.0, 1.0);
    expect(islandRock.collided).toBe(true);
  });

  it('should expand elevated Maglev metro circuit to loop around ±220m corridor', () => {
    const scene = new THREE.Scene();
    const sound = new SoundManager();
    const trains = new TrainSystem(scene, sound);

    trains.update(0.1);
    expect(trains.subwayGroup.position.y).toBe(8.5);

    // Waypoints span ±220
    trains.subwayProgress = 0.0;
    trains.update(0.0001);
    expect(Math.abs(trains.subwayGroup.position.x)).toBeCloseTo(220, 0);
  });

  it('should expand Western Ocean bay with WaterSystem and smuggling crates', () => {
    const scene = new THREE.Scene();
    const sound = new SoundManager();
    const economy = new EconomySystem();
    const water = new WaterSystem(scene, economy, sound);

    expect(water.waterMesh.position.x).toBe(-478);
    expect(water.crates.length).toBe(3);
    // Boats are placed in the expanded bay
    expect(water.speedboat.x).toBe(-335);
    expect(water.jetSki.x).toBe(-335);
  });
});
