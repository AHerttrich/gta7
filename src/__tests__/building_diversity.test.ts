import { describe, it, expect } from 'vitest';
import { Building, BuildingStyle } from '../city/Building';
import { City } from '../city/City';

describe('Diverse Building Architecture & Styles Suite', () => {
  const styles: BuildingStyle[] = [
    'CYBER_TOWER',
    'LUXURY_RESORT',
    'RESIDENTIAL_BLOCK',
    'COMMERCIAL_HQ',
    'CLASSIC_BRICK_LOFT',
    'ROUND_TOWER',
    'PAGODA_NEON_TOWER',
    'TWIN_TOWERS',
  ];

  it('should generate all 8 architectural styles with valid bounds and geometries', () => {
    for (const style of styles) {
      const b = Building.createBuilding(0, 0, 40, 40, 50, 0x00d4ff, 'TEST', style);
      expect(b.mesh).toBeDefined();
      expect(b.mesh.children.length).toBeGreaterThan(0);
      expect(b.bounds).toBeDefined();
      expect(b.bounds.height).toBeGreaterThanOrEqual(50);
      expect(b.bounds.minX).toBeLessThan(b.bounds.maxX);
      expect(b.bounds.minZ).toBeLessThan(b.bounds.maxZ);
    }
  });

  it('should generate rooftop swimming pool and marquee on LUXURY_RESORT', () => {
    const resort = Building.createBuilding(
      0,
      0,
      44,
      44,
      45,
      0xf59e0b,
      'HOTEL VICE',
      'LUXURY_RESORT',
    );
    expect(resort.bounds.tier).toBeDefined();
    expect(resort.bounds.height).toBeGreaterThan(45);
    // Mesh contains pool, sundeck, canopy marquee, pillars, etc.
    expect(resort.mesh.children.length).toBeGreaterThanOrEqual(6);
  });

  it('should generate 3D protruding balconies and AC units on RESIDENTIAL_BLOCK', () => {
    const res = Building.createBuilding(0, 0, 40, 40, 40, 0x10b981, undefined, 'RESIDENTIAL_BLOCK');
    expect(res.bounds.baseHeight).toBe(40);
    expect(res.mesh.children.length).toBeGreaterThanOrEqual(8);
  });

  it('should generate water tower and fire escapes on CLASSIC_BRICK_LOFT', () => {
    const loft = Building.createBuilding(
      0,
      0,
      38,
      38,
      35,
      0xf59e0b,
      undefined,
      'CLASSIC_BRICK_LOFT',
    );
    expect(loft.bounds.height).toBeGreaterThan(35);
    expect(loft.bounds.tier).toBeDefined();
    expect(loft.mesh.children.length).toBeGreaterThanOrEqual(8);
  });

  it('should generate circular geometry and helipad on ROUND_TOWER', () => {
    const round = Building.createBuilding(0, 0, 42, 42, 55, 0xa855f7, undefined, 'ROUND_TOWER');
    expect(round.bounds.height).toBe(55);
    // Helipad rings and H-mark
    expect(round.mesh.children.length).toBeGreaterThanOrEqual(6);
  });

  it('should generate multi-tiered flared pagoda roofs on PAGODA_NEON_TOWER', () => {
    const pagoda = Building.createBuilding(
      0,
      0,
      36,
      36,
      48,
      0xef4444,
      undefined,
      'PAGODA_NEON_TOWER',
    );
    expect(pagoda.bounds.height).toBeGreaterThan(48);
    expect(pagoda.mesh.children.length).toBeGreaterThanOrEqual(10);
  });

  it('should generate dual towers and skybridge on TWIN_TOWERS', () => {
    const twin = Building.createBuilding(0, 0, 48, 48, 65, 0x00d4ff, 'NEXUS', 'TWIN_TOWERS');
    expect(twin.extraBounds).toBeDefined();
    expect(twin.extraBounds?.length).toBe(2); // Second tower + podium base
    expect(twin.mesh.children.length).toBeGreaterThanOrEqual(5);
  });

  it('should initialize City with diverse building bounds and accurate collision detection', () => {
    const city = new City();
    // 25 blocks with extra bounds from twin towers
    expect(city.buildingBounds.length).toBeGreaterThanOrEqual(25);

    // Verify collision on multiple building types
    const b0 = city.buildingBounds[0];
    const colInside = city.checkCollision((b0.minX + b0.maxX) / 2, (b0.minZ + b0.maxZ) / 2, 1.0);
    expect(colInside.collided).toBe(true);

    // Verify open road has no collision
    const colStreet = city.checkCollision(44, 44, 1.0);
    expect(colStreet.collided).toBe(false);
  });

  it('should safely generate and cache procedural textures without memory leaks', () => {
    const t1 = Building.getOfficeWindowTexture('cyan');
    const t2 = Building.getOfficeWindowTexture('cyan');
    expect(t1).toBe(t2); // Cached

    const h1 = Building.getLuxuryHotelTexture();
    const h2 = Building.getLuxuryHotelTexture();
    expect(h1).toBe(h2); // Cached

    const r1 = Building.getResidentialTexture('terracotta');
    const r2 = Building.getResidentialTexture('terracotta');
    expect(r1).toBe(r2); // Cached

    const b1 = Building.getBrickWarehouseTexture();
    const b2 = Building.getBrickWarehouseTexture();
    expect(b1).toBe(b2); // Cached

    const c1 = Building.getCommercialRibbonTexture();
    const c2 = Building.getCommercialRibbonTexture();
    expect(c1).toBe(c2); // Cached
  });
});
