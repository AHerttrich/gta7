import { describe, it, expect } from 'vitest';
import { City } from '../city/City';
import { Building } from '../city/Building';
import { Player } from '../character/Player';
import { Input } from '../engine/Input';
import { Helicopter } from '../vehicles/Helicopter';

describe('Anti-Penetration & Building Clipping Prevention', () => {
  it('should immediately eject entity placed inside building interior to safe exterior coordinates', () => {
    const city = new City();
    const b = city.buildingBounds[0];
    const centerX = (b.minX + b.maxX) / 2;
    const centerZ = (b.minZ + b.maxZ) / 2;

    // Verify it is inside the building
    const insideCol = city.checkCollision(centerX, centerZ, 1.2, 0.5);
    expect(insideCol.collided).toBe(true);

    // Run resolveBuildingIntersection
    const resolved = city.resolveBuildingIntersection(centerX, centerZ, 1.2, 0.5);
    expect(resolved.corrected).toBe(true);

    // Verify the resolved position is now cleanly outside the building
    const postCol = city.checkCollision(resolved.x, resolved.z, 1.2, 0.5);
    expect(postCol.collided).toBe(false);
  });

  it('should not alter coordinates when entity is already in clear street space', () => {
    const city = new City();
    // Intersection at (44, 44) is completely clear
    const resolved = city.resolveBuildingIntersection(44, 44, 1.2, 0.5);
    expect(resolved.corrected).toBe(false);
    expect(resolved.x).toBe(44);
    expect(resolved.z).toBe(44);
  });

  it('should snap entity near rooftop surface up to roof level', () => {
    const city = new City();
    const b = city.buildingBounds[0];
    const centerX = (b.minX + b.maxX) / 2;
    const centerZ = (b.minZ + b.maxZ) / 2;
    const roofH = city.getRoofHeightAt(centerX, centerZ, 0);

    // Entity slightly below roof (within 0.8m)
    const resolved = city.resolveBuildingIntersection(centerX, centerZ, 1.2, roofH - 0.3);
    expect(resolved.corrected).toBe(true);
    expect(resolved.roofY).toBe(roofH);
  });

  it('should correctly support two-tier skyscraper setback without phantom air walls', () => {
    const building = Building.createBuilding(0, 0, 40, 40, 60, 0x00d4ff);
    expect(building.bounds.baseHeight).toBe(60);
    expect(building.bounds.tier).toBeDefined();
    expect(building.bounds.height).toBeGreaterThan(60); // topY

    const city = new City();
    city.buildingBounds = [building.bounds];

    // Point on lower terrace: outside tier box (tier is 40 * 0.72 = 28.8 wide, so x = 17 is outside tier [-14.4, 14.4])
    const terraceX = 17;
    const terraceZ = 0;
    const terraceRoofH = city.getRoofHeightAt(terraceX, terraceZ, 0);
    expect(terraceRoofH).toBe(60);

    // Point on upper tier roof: inside tier box (x = 0, z = 0)
    const upperRoofH = city.getRoofHeightAt(0, 0, 0);
    expect(upperRoofH).toBe(building.bounds.height);

    // Entity flying in the air above terrace at y = 65 outside tier should NOT collide
    const colTerraceAir = city.checkCollision(terraceX, terraceZ, 1.2, 65);
    expect(colTerraceAir.collided).toBe(false);

    // Entity flying into the upper tier at y = 65 at x = 5 should collide with the upper tier
    const colTier = city.checkCollision(5, 0, 1.2, 65);
    expect(colTier.collided).toBe(true);
  });

  it('should prevent player on foot from clipping through building walls or getting stuck inside', () => {
    const city = new City();
    const b = city.buildingBounds[0];
    const centerX = (b.minX + b.maxX) / 2;
    const centerZ = (b.minZ + b.maxZ) / 2;

    const player = new Player(centerX, centerZ);
    const input = new Input();

    // Update player: failsafe anti-penetration must immediately eject player from interior
    player.update(0.016, input, city);
    expect(player.x).not.toBe(centerX);
    const postCol = city.checkCollision(player.x, player.z, 0.4, player.y);
    expect(postCol.collided).toBe(false);
  });

  it('should firmly support player landing on rooftop without falling through into building', () => {
    const city = new City();
    const b = city.buildingBounds[0];
    const centerX = (b.minX + b.maxX) / 2;
    const centerZ = (b.minZ + b.maxZ) / 2;
    const roofH = city.getRoofHeightAt(centerX, centerZ, 0);

    const player = new Player(centerX, centerZ);
    player.setPosition(centerX, roofH + 0.1, centerZ);
    player.vy = -10.0; // Rapid downward fall
    const input = new Input();

    player.update(0.033, input, city);
    // Player must land on roof level without penetrating into interior
    expect(player.y).toBe(roofH);
    expect(player.vy).toBe(0);
  });

  it('should prevent helicopter from tunneling through buildings', () => {
    const city = new City();
    const b = city.buildingBounds[0];
    const centerX = (b.minX + b.maxX) / 2;
    const centerZ = (b.minZ + b.maxZ) / 2;

    const heli = new Helicopter(centerX, b.height / 2, centerZ);
    heli.isOccupied = true;
    const input = new Input();

    heli.update(0.016, input, city);
    // Helicopter must collide and be ejected safely
    expect(heli.hasCollided).toBe(true);
    const postCol = city.checkCollision(heli.x, heli.z, 2.2, heli.y);
    expect(postCol.collided).toBe(false);
  });

  it('should continuously sweep car trajectory and prevent wall penetration', () => {
    const city = new City();
    const b = city.buildingBounds[0];

    // Start 1 meter outside the west wall, moving at high speed (50 m/s) eastward directly into the wall
    const startX = b.minX - 1.0;
    const startZ = (b.minZ + b.maxZ) / 2;
    const targetX = startX + 5.0; // Deep inside the building

    const swept = city.checkSweptCollision(startX, startZ, targetX, startZ, 2.0, 0.5);
    expect(swept.collided).toBe(true);
    expect(swept.safeX).toBeLessThan(b.minX); // Kept strictly outside west wall
    expect(city.checkCollision(swept.safeX, swept.safeZ, 2.0, 0.5).collided).toBe(false);
  });

  it('should prevent nitro boosted high speed car (80 m/s) from tunneling through walls', () => {
    const city = new City();
    const b = city.buildingBounds[0];

    // High speed delta of 8.0 meters in a single frame across the wall boundary
    const x1 = b.minX - 2.0;
    const z1 = (b.minZ + b.maxZ) / 2;
    const x2 = b.minX + 6.0; // 6 meters deep inside the building

    const col = city.checkSweptCollision(x1, z1, x2, z1, 2.0, 0.5);
    expect(col.collided).toBe(true);
    expect(col.safeX).toBeLessThanOrEqual(b.minX - 2.0); // Safely clamped outside
    expect(city.checkCollision(col.safeX, col.safeZ, 2.0, 0.5).collided).toBe(false);
  });

  it('should prevent player sprinting at 16 m/s into a corner from clipping through', () => {
    const city = new City();
    const b = city.buildingBounds[0];

    // Place player right outside the corner of the building (minX - 0.2, minZ - 0.2)
    const player = new Player(b.minX - 0.2, b.minZ - 0.2);
    const input = new Input();
    // Sprint forward diagonally into the corner
    input.keys['w'] = true;
    input.keys['shift'] = true;
    player.rotationY = Math.PI / 4; // heading pointing towards corner

    for (let i = 0; i < 10; i++) {
      player.update(0.016, input, city);
      const col = city.checkCollision(player.x, player.z, 0.4, player.y);
      expect(col.collided).toBe(false);
    }
  });

  it('should safely eject external police ram pushes away from building interior', () => {
    const city = new City();
    const b = city.buildingBounds[0];

    // Player car near east wall
    let carX = b.maxX + 1.0;
    const carZ = (b.minZ + b.maxZ) / 2;

    // Violent ram impulse pointing westward directly into the building
    const shoveX = -5.0; // 5 meters into the building
    carX += shoveX; // car is now inside (b.maxX - 4.0)

    // Run resolveBuildingIntersection
    const resolved = city.resolveBuildingIntersection(carX, carZ, 2.0, 0.5);
    expect(resolved.corrected).toBe(true);
    expect(resolved.x).toBeGreaterThan(b.maxX); // Ejected back outside the east wall
    expect(city.checkCollision(resolved.x, resolved.z, 2.0, 0.5).collided).toBe(false);
  });
});
