import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PortalSystem } from '../world/PortalSystem';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';
import { City } from '../city/City';

describe('Dimensional Portal & The Other World System', () => {
  it('should initialize City Portal and Other World structures with 7 Dragon Balls', () => {
    const scene = new THREE.Scene();
    const economy = new EconomySystem();
    const sound = new SoundManager();
    const portal = new PortalSystem(scene, economy, sound);

    expect(portal.currentDimension).toBe('NORMAL_WORLD');
    expect(portal.cityPortalPos.x).toBe(-185);
    expect(portal.cityPortalPos.z).toBe(132);
    expect(portal.otherWorldPortalPos.x).toBe(2500);

    // Platforms in the Other World
    expect(portal.platforms.length).toBeGreaterThanOrEqual(7);

    // 7 Collectable Dragon Balls
    expect(portal.dragonBalls.length).toBe(7);
    expect(portal.collectedBallsCount).toBe(0);
  });

  it('should trigger dimensional warp from City to Other World when stepping into City Portal', () => {
    const scene = new THREE.Scene();
    const economy = new EconomySystem();
    const sound = new SoundManager();
    const portal = new PortalSystem(scene, economy, sound);

    // Player far away from portal
    const farWarp = portal.checkPortalTransition(0, 0, 0);
    expect(farWarp.shouldWarp).toBe(false);

    // Player stepping into City Portal
    const nearWarp = portal.checkPortalTransition(
      portal.cityPortalPos.x,
      portal.cityPortalPos.y,
      portal.cityPortalPos.z,
    );
    expect(nearWarp.shouldWarp).toBe(true);
    expect(nearWarp.targetDimension).toBe('OTHER_WORLD');
    expect(nearWarp.targetPos.x).toBe(2500);
    expect(nearWarp.targetPos.y).toBeGreaterThan(400);
  });

  it('should trigger return warp from Other World back to City when stepping into Return Portal', () => {
    const scene = new THREE.Scene();
    const economy = new EconomySystem();
    const sound = new SoundManager();
    const portal = new PortalSystem(scene, economy, sound);

    portal.currentDimension = 'OTHER_WORLD';
    portal.warpCooldown = 0;

    const returnWarp = portal.checkPortalTransition(
      portal.otherWorldPortalPos.x,
      portal.otherWorldPortalPos.y,
      portal.otherWorldPortalPos.z,
    );
    expect(returnWarp.shouldWarp).toBe(true);
    expect(returnWarp.targetDimension).toBe('NORMAL_WORLD');
    expect(returnWarp.targetPos.x).toBe(portal.cityPortalPos.x);
  });

  it('should provide exact floating platform elevations and detect cosmic abyss in Other World', () => {
    const scene = new THREE.Scene();
    const economy = new EconomySystem();
    const sound = new SoundManager();
    const portal = new PortalSystem(scene, economy, sound);

    // Atop central sanctuary platform (x: 2500, z: 2500)
    const onCenter = portal.getOtherWorldElevation(2500, 2500);
    expect(onCenter.onPlatform).toBe(true);
    expect(onCenter.height).toBe(400.0);

    // Along Snake Way highway (x: 2500, z: 2600)
    const onSnakeWay = portal.getOtherWorldElevation(2500, 2600);
    expect(onSnakeWay.onPlatform).toBe(true);
    expect(onSnakeWay.height).toBe(400.0);
    expect(onSnakeWay.isBoostPad).toBe(true);

    // Off the edge in deep cosmic void (x: 2800, z: 2800)
    const inVoid = portal.getOtherWorldElevation(2800, 2800);
    expect(inVoid.onPlatform).toBe(false);
    expect(inVoid.height).toBe(-999);
  });

  it('should collect Dragon Balls and detect when all 7 are gathered', () => {
    const scene = new THREE.Scene();
    const economy = new EconomySystem();
    const sound = new SoundManager();
    const portal = new PortalSystem(scene, economy, sound);

    const firstBall = portal.dragonBalls[0];
    const res = portal.checkBallCollection(firstBall.x, firstBall.y, firstBall.z);

    expect(res.collected).toBe(true);
    expect(res.ballId).toBe(firstBall.id);
    expect(portal.collectedBallsCount).toBe(1);
    expect(firstBall.isCollected).toBe(true);
    expect(firstBall.group.visible).toBe(false);
    expect(res.allCollected).toBe(false);

    // Collect the remaining 6 balls
    for (let i = 1; i < portal.dragonBalls.length; i++) {
      const b = portal.dragonBalls[i];
      portal.checkBallCollection(b.x, b.y, b.z);
    }

    expect(portal.collectedBallsCount).toBe(7);
    const lastCheck = portal.checkBallCollection(firstBall.x, firstBall.y, firstBall.z);
    expect(lastCheck.collected).toBe(false); // Already collected
  });

  it('should verify that City Portal at seaside boulevard (-185, 132) is clear of building collisions', () => {
    const city = new City();
    const col = city.checkCollision(-185, 132, 3.5);
    expect(col.collided).toBe(false);
  });
});
