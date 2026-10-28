import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PortalSystem } from '../world/PortalSystem';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';
import { Player } from '../character/Player';
import { Car } from '../vehicles/Car';
import { City } from '../city/City';
import { Input } from '../engine/Input';

describe('Moon World (Mond-Dimension): Lunar Surface, Apollo 11, Earth in the Sky & 1/6g Low Gravity', () => {
  function createMoonTestSetup(): {
    scene: THREE.Scene;
    economy: EconomySystem;
    sound: SoundManager;
    portal: PortalSystem;
    player: Player;
    car: Car;
    city: City;
  } {
    const scene = new THREE.Scene();
    const economy = new EconomySystem();
    const sound = new SoundManager();
    const portal = new PortalSystem(scene, economy, sound);
    const player = new Player(2500, 2500);
    const car = new Car(2500, 2500, 0);
    const city = new City();

    return { scene, economy, sound, portal, player, car, city };
  }

  it('should build Planet Earth in the lunar sky overlooking the Moon surface', () => {
    const { portal } = createMoonTestSetup();

    expect(portal.earthGroup).toBeDefined();
    expect(portal.earthGroup.children.length).toBeGreaterThan(5);

    // Positioned high above lunar horizon
    expect(portal.earthGroup.position.y).toBeGreaterThan(500);

    // Slowly rotates on its axis during update
    const initRotY = portal.earthGroup.rotation.y;
    portal.update(0.1);
    expect(portal.earthGroup.rotation.y).toBeGreaterThan(initRotY);
  });

  it('should build Apollo 11 Landing Site with Eagle Lunar Module and Flag', () => {
    const { portal } = createMoonTestSetup();

    expect(portal.apolloGroup).toBeDefined();
    expect(portal.apolloGroup.children.length).toBeGreaterThan(8);

    // Placed on Tranquility Base near (2420, 400.5, 2430)
    expect(portal.apolloGroup.position.x).toBeCloseTo(2420, 0);
    expect(portal.apolloGroup.position.z).toBeCloseTo(2430, 0);
    expect(portal.apolloGroup.position.y).toBeCloseTo(400.5, 1);
  });

  it('should build Moon Base Alpha with Bio-Dome, Earth Communications Dish, and Solar Farm', () => {
    const { portal } = createMoonTestSetup();

    expect(portal.baseAlphaGroup).toBeDefined();
    expect(portal.satelliteDishMesh).toBeDefined();
    expect(portal.baseAlphaGroup.children.length).toBeGreaterThan(10);
  });

  it('should place Alien Monolith and impact craters on the Moon surface', () => {
    const { portal } = createMoonTestSetup();

    expect(portal.monolithGroup).toBeDefined();
    expect(portal.monolithGroup.position.y).toBeCloseTo(400.5, 1);
  });

  it('should apply 1/6g Moon gravity physics to player jumps and jetpack flight', () => {
    const { player, city } = createMoonTestSetup();
    const jumpInput = {
      jump: true,
      forward: false,
      backward: false,
      left: false,
      right: false,
    } as unknown as Input;
    const idleInput = {
      jump: false,
      forward: false,
      backward: false,
      left: false,
      right: false,
    } as unknown as Input;

    player.setPosition(2500, 400.0, 2500);
    expect(city.getRoofHeightAt(2500, 2500)).toBe(400.0);

    // Normal Earth Gravity: Jump velocity is base PLAYER_CONFIG
    player.lowGravity = false;
    player.update(0.016, jumpInput, city);
    const normalJumpVy = player.vy;

    // Reset player on ground
    player.setPosition(2500, 400.0, 2500);
    player.vy = 0;

    // Moon Low Gravity: Jump velocity boosted & gravity softened
    player.lowGravity = true;
    player.update(0.016, jumpInput, city);
    const moonJumpVy = player.vy;

    expect(moonJumpVy).toBeGreaterThan(normalJumpVy);

    // In mid-air, falling acceleration is much lower under moon gravity
    player.vy = 0;
    player.setPosition(2500, 405.0, 2500);

    // 1 frame under moon gravity
    player.lowGravity = true;
    player.update(0.1, idleInput, city);
    const moonVyFall = player.vy;

    // Compare with normal earth gravity fall
    player.setPosition(2500, 405.0, 2500);
    player.vy = 0;
    player.lowGravity = false;
    player.update(0.1, idleInput, city);
    const earthVyFall = player.vy;

    expect(Math.abs(moonVyFall)).toBeLessThan(Math.abs(earthVyFall));
  });

  it('should apply low gravity multiplier to vehicle airborne stunts on the Moon', () => {
    const { car } = createMoonTestSetup();

    car.physics.gravityMultiplier = 0.28;
    car.physics.isAirborne = true;
    car.physics.vy = 10;
    car.physics.groundY = 400.0;
    car.physics.y = 405.0;

    car.update(0.1, {
      throttle: false,
      reverse: false,
      steerLeft: false,
      steerRight: false,
      handbrake: false,
      nitro: false,
      hoverToggle: false,
    });

    // Under 0.28x gravity: vy drops by ~22 * 0.28 * 0.1 = ~0.616 instead of 2.2
    expect(car.physics.vy).toBeGreaterThan(8.5);
  });

  it('should play cosmic moon landing sound with Apollo Quindar radio beep', () => {
    const { sound } = createMoonTestSetup();

    expect(() => sound.playMoonLanding()).not.toThrow();
  });

  it('should place all 7 Dragon Balls at iconic lunar landmarks', () => {
    const { portal } = createMoonTestSetup();

    expect(portal.dragonBalls.length).toBe(7);

    // Ball #1 at Apollo 11 Lunar Module
    const ball1 = portal.dragonBalls[0];
    expect(ball1.x).toBeCloseTo(2420, 0);
    expect(ball1.z).toBeCloseTo(2430, 0);

    // Ball #2 on Geodesic Bio-Dome
    const ball2 = portal.dragonBalls[1];
    expect(ball2.y).toBeGreaterThan(415);
  });

  it('should provide vast lunar surface elevation across Mare Tranquillitatis and void outside', () => {
    const { portal } = createMoonTestSetup();

    // On lunar plain (2550, 2550)
    const onPlain = portal.getOtherWorldElevation(2550, 2550);
    expect(onPlain.onPlatform).toBe(true);
    expect(onPlain.height).toBe(400.0);

    // Deep space void beyond lunar horizon (3000, 3000)
    const deepSpace = portal.getOtherWorldElevation(3000, 3000);
    expect(deepSpace.onPlatform).toBe(false);
    expect(deepSpace.height).toBe(-999);
  });
});
