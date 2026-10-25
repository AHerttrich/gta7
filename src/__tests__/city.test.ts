import { describe, it, expect } from 'vitest';
import { City } from '../city/City';

describe('City Generation and Collisions', () => {
  it('should initialize city with building bounds', () => {
    const city = new City();
    expect(city.buildingBounds.length).toBeGreaterThan(0);
  });

  it('should detect collision when point is inside a building', () => {
    const city = new City();
    const firstBuilding = city.buildingBounds[0];

    const centerX = (firstBuilding.minX + firstBuilding.maxX) / 2;
    const centerZ = (firstBuilding.minZ + firstBuilding.maxZ) / 2;

    const collision = city.checkCollision(centerX, centerZ, 1.0);
    expect(collision.collided).toBe(true);
  });

  it('should report no collision in the center of an intersection', () => {
    const city = new City();
    // Intersection at (44, 44) is clear street asphalt
    const collision = city.checkCollision(44, 44, 1.0);
    expect(collision.collided).toBe(false);
  });

  it('should detect boundary collision at extreme coordinates', () => {
    const city = new City();
    const collision = city.checkCollision(1000, 0, 1.0);
    expect(collision.collided).toBe(true);
  });
});
