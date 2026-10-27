import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PoliceSystem } from '../police/PoliceSystem';
import { City } from '../city/City';
import { Car } from '../vehicles/Car';
import { Player } from '../character/Player';

describe('Anti-Air Police Ramming Prevention (3D Altitude Awareness)', () => {
  it('should prevent ground police cruisers from PIT maneuvering airborne cars', () => {
    const scene = new THREE.Scene();
    const city = new City();
    const police = new PoliceSystem(scene, city);
    police.setWantedLevel(2);

    expect(police.copCars.length).toBeGreaterThan(0);
    const cop = police.copCars[0];

    const playerX = 10;
    const playerZ = 10;
    const playerHeading = 0;
    const playerSpeed = 20;

    cop.x = playerX + 1.2;
    cop.z = playerZ - 2.5; // directly behind player in 2D plane
    cop.y = 0; // on the ground

    // Scenario A: Player car is airborne / jumping at altitude y = 5.0m
    const pitAirborne = police.checkPitManeuver(
      playerX,
      playerZ,
      playerHeading,
      playerSpeed,
      5.0, // playerY in air
      true, // isAirborne
    );
    expect(pitAirborne.triggered).toBe(false);

    // Scenario B: Player car is on ground (y = 0.5m)
    const pitGrounded = police.checkPitManeuver(
      playerX,
      playerZ,
      playerHeading,
      playerSpeed,
      0.5,
      false,
    );
    expect(pitGrounded.triggered).toBe(true);
  });

  it('should prevent road spike strips from popping tires of jumping or hovering vehicles', () => {
    const scene = new THREE.Scene();
    const city = new City();
    const police = new PoliceSystem(scene, city);
    police.setWantedLevel(3);

    // At 3 stars, spike strips are spawned
    expect(police.spikeStrips.length).toBeGreaterThan(0);
    const strip = police.spikeStrips[0];

    // Car jumping over the spike strip at y = 3.5m
    const hitAir = police.checkSpikeStripCollision(strip.x, strip.z, 3.5);
    expect(hitAir).toBe(false);
    expect(strip.isTriggered).toBe(false);

    // Car driving flat on the ground at y = 0.2m
    const hitGround = police.checkSpikeStripCollision(strip.x, strip.z, 0.2);
    expect(hitGround).toBe(true);
    expect(strip.isTriggered).toBe(true);
  });

  it('should allow jumping vehicles to sail over roadblocks without collision', () => {
    const scene = new THREE.Scene();
    const city = new City();
    const police = new PoliceSystem(scene, city);
    police.setWantedLevel(3);

    expect(police.roadblocks.length).toBeGreaterThan(0);
    const rb = police.roadblocks[0];

    // High jump clears roadblock (y = 4.0m)
    const hitAir = police.checkRoadblockCollision(rb.x, rb.z, 20.0, 4.0);
    expect(hitAir).toBe(false);
    expect(rb.isSmashed).toBe(false);

    // Ground impact smashes roadblock (y = 0.5m)
    const hitGround = police.checkRoadblockCollision(rb.x, rb.z, 20.0, 0.5);
    expect(hitGround).toBe(true);
    expect(rb.isSmashed).toBe(true);
  });

  it('should calculate 3D altitude distance so players flying high in the sky can escape and lose wanted levels', () => {
    const scene = new THREE.Scene();
    const city = new City();
    const police = new PoliceSystem(scene, city);
    police.setWantedLevel(1);

    const cop = police.copCars[0];
    cop.x = 0;
    cop.y = 0;
    cop.z = 0;

    // Player is directly above cop in 2D (x=0, z=0), but 120m high in the air
    // In 2D distance this would be 0m, but in 3D distance it is 120m (> 80m escape threshold)
    for (let i = 0; i < 20; i++) {
      police.update(1.0, 0, 0, 120.0);
    }

    // After 15+ seconds escaping > 80m away in 3D space, wanted level drops
    expect(police.wantedLevel).toBe(0);
  });

  it('should verify 3D vertical separation logic between player car and police cruiser', () => {
    const car = new Car(0, 0, 0);
    const copY = 0;

    // Airborne jump: car at y = 4.5m
    car.physics.y = 4.5;
    car.physics.isAirborne = true;
    const dyJump = Math.abs(car.physics.y - copY);
    const isAirborneJump =
      car.physics.isAirborne ||
      car.physics.isHoverMode ||
      car.physics.y > car.physics.groundY + 0.8;
    const shouldIgnoreJump = dyJump > 1.8 || (isAirborneJump && dyJump > 1.2);
    expect(shouldIgnoreJump).toBe(true);

    // DeLorean hover mode: car at y = 8.0m
    car.physics.isAirborne = false;
    car.physics.isHoverMode = true;
    car.physics.y = 8.0;
    const dyHover = Math.abs(car.physics.y - copY);
    const isAirborneHover =
      car.physics.isAirborne ||
      car.physics.isHoverMode ||
      car.physics.y > car.physics.groundY + 0.8;
    const shouldIgnoreHover = dyHover > 1.8 || (isAirborneHover && dyHover > 1.2);
    expect(shouldIgnoreHover).toBe(true);

    // Grounded driving: car at y = 0.5m
    car.physics.isHoverMode = false;
    car.physics.isAirborne = false;
    car.physics.y = 0.5;
    const dyGrounded = Math.abs(car.physics.y - copY);
    const isAirborneGrounded =
      car.physics.isAirborne ||
      car.physics.isHoverMode ||
      car.physics.y > car.physics.groundY + 0.8;
    const shouldIgnoreGrounded = dyGrounded > 1.8 || (isAirborneGrounded && dyGrounded > 1.2);
    expect(shouldIgnoreGrounded).toBe(false);
  });

  it('should verify 3D vertical separation logic between player on foot and police cruiser', () => {
    const player = new Player();
    const copY = 0;

    // Jetpack flight at altitude y = 10.0m
    player.hasJetpack = true;
    player.y = 10.0;
    const dyJetpack = player.y - copY;
    const isAirborneJetpack =
      player.y > 1.6 || player.vy > 1.0 || (player.hasJetpack && player.y > 1.0);
    const shouldIgnoreJetpack = dyJetpack > 1.5 || (isAirborneJetpack && dyJetpack > 1.0);
    expect(shouldIgnoreJetpack).toBe(true);

    // Jumping on foot over car at y = 2.2m
    player.hasJetpack = false;
    player.y = 2.2;
    player.vy = 4.0;
    const dyJump = player.y - copY;
    const isAirborneJump =
      player.y > 1.6 || player.vy > 1.0 || (player.hasJetpack && player.y > 1.0);
    const shouldIgnoreJump = dyJump > 1.5 || (isAirborneJump && dyJump > 1.0);
    expect(shouldIgnoreJump).toBe(true);

    // Walking on street at y = 0.25m
    player.hasJetpack = false;
    player.y = 0.25;
    player.vy = 0;
    const dyWalking = player.y - copY;
    const isAirborneWalking =
      player.y > 1.6 || player.vy > 1.0 || (player.hasJetpack && player.y > 1.0);
    const shouldIgnoreWalking = dyWalking > 1.5 || (isAirborneWalking && dyWalking > 1.0);
    expect(shouldIgnoreWalking).toBe(false);
  });
});
