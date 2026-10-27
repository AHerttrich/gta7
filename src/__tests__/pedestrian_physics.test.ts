import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PedestrianSystem } from '../pedestrians/PedestrianSystem';
import { Input } from '../engine/Input';

describe('Pedestrian Ragdoll Physics & Mobile Controls', () => {
  it('should initialize pedestrian crowd in walking state', () => {
    const scene = new THREE.Scene();
    const system = new PedestrianSystem(scene);

    expect(system.pedestrians.length).toBeGreaterThan(0);
    const ped = system.pedestrians[0];
    expect(ped.state).toBe('WALKING');
    expect(ped.y).toBe(0.25);
    expect(ped.vy).toBe(0);
    expect(ped.vx).toBe(0);
  });

  it('should launch pedestrian into ballistic airborne ragdoll trajectory on car impact', () => {
    const scene = new THREE.Scene();
    const system = new PedestrianSystem(scene);
    const ped = system.pedestrians[0];

    // Car impact at 20 m/s heading north (heading = 0)
    system.launchPedestrian(ped, 20.0, 0);

    expect(ped.state).toBe('AIRBORNE');
    expect(ped.isPanicking).toBe(true);
    expect(ped.vy).toBeGreaterThan(10.0); // Upward catapult
    expect(ped.vz).toBeGreaterThan(0); // Forward velocity along heading
    expect(ped.rotVx).not.toBe(0); // Wild tumble in 3D
  });

  it('should apply gravity and update 3D position while airborne', () => {
    const scene = new THREE.Scene();
    const system = new PedestrianSystem(scene);
    const ped = system.pedestrians[0];

    system.launchPedestrian(ped, 15.0, 0);
    const initialVy = ped.vy;
    const initialY = ped.y;

    // Simulate 0.1s delta time
    system.update(0.1, 0, 0, 0);

    // Gravity (26.0 * dt) decreases vy
    expect(ped.vy).toBeLessThan(initialVy);
    expect(ped.y).toBeGreaterThan(initialY);
    expect(ped.group.position.y).toBe(ped.y);
  });

  it('should bounce on ground contact and transition to grounded state upon settling', () => {
    const scene = new THREE.Scene();
    const system = new PedestrianSystem(scene);
    const ped = system.pedestrians[0];

    system.launchPedestrian(ped, 10.0, 0);

    // Run simulation until pedestrian descends and bounces/settles
    for (let step = 0; step < 80; step++) {
      system.update(0.05, 0, 0, 0);
      if (ped.state === 'GROUNDED') break;
    }

    expect(ped.state).toBe('GROUNDED');
    expect(ped.groundTimer).toBeGreaterThan(0);
    expect(ped.group.rotation.x).toBeCloseTo(Math.PI / 2, 0.1); // Flat on back
  });

  it('should recover from grounded state back to walking once ground timer elapses', () => {
    const scene = new THREE.Scene();
    const system = new PedestrianSystem(scene);
    const ped = system.pedestrians[0];

    ped.state = 'GROUNDED';
    ped.groundTimer = 0.1;
    ped.group.rotation.x = Math.PI / 2;

    // Update by 0.2s so timer expires
    system.update(0.2, 0, 0, 0);

    expect(ped.state).toBe('WALKING');
    expect(ped.group.rotation.x).toBe(0);
    expect(ped.y).toBe(0.25);
  });

  it('should reflect touch control states in Input getters', () => {
    const input = new Input();

    expect(input.forward).toBe(false);
    expect(input.nitro).toBe(false);
    expect(input.left).toBe(false);
    expect(input.right).toBe(false);
    expect(input.horn).toBe(false);

    // Simulate mobile touch inputs
    input.touchState.forward = true;
    input.touchState.nitro = true;
    input.touchState.left = true;
    input.touchState.horn = true;

    expect(input.forward).toBe(true);
    expect(input.nitro).toBe(true);
    expect(input.left).toBe(true);
    expect(input.horn).toBe(true);
    expect(input.right).toBe(false);

    // One-shot mobile action interact
    input.touchState.actionInteract = true;
    expect(input.actionInteract).toBe(true);
    expect(input.touchState.actionInteract).toBe(false); // Resets after consumption
  });

  it('should contain pedestrians within map boundaries and prevent walking out of map', () => {
    const scene = new THREE.Scene();
    const system = new PedestrianSystem(scene);
    const ped = system.pedestrians[0];

    // Place pedestrian near boundary walking outwards towards +X (East)
    ped.x = system.mapLimit - 0.1;
    ped.z = 0;
    ped.rotationY = Math.PI / 2; // East
    ped.speed = 5.0;

    // Advance 0.5s: without containment it would reach > mapLimit + 2m
    system.update(0.5, 0, 0, 0);

    expect(ped.x).toBeLessThanOrEqual(system.mapLimit);
    // Heading should have been redirected away from +X
    expect(ped.rotationY).not.toBe(Math.PI / 2);

    // Place near south boundary walking outwards towards +Z (South)
    ped.x = 0;
    ped.z = system.mapLimit - 0.1;
    ped.rotationY = 0; // South (+Z)
    system.update(0.5, 0, 0, 0);

    expect(ped.z).toBeLessThanOrEqual(system.mapLimit);
    expect(ped.rotationY).not.toBe(0);
  });

  it('should safely respawn pedestrians thrown into void or far out of map', () => {
    const scene = new THREE.Scene();
    const system = new PedestrianSystem(scene);
    const ped = system.pedestrians[0];

    // Scenario A: Blasted far beyond emergency boundary (> emergencyLimit)
    ped.x = system.emergencyLimit + 100.0;
    ped.z = system.emergencyLimit + 100.0;
    system.update(0.1, 0, 0, 0);

    expect(Math.abs(ped.x)).toBeLessThanOrEqual(system.mapLimit);
    expect(Math.abs(ped.z)).toBeLessThanOrEqual(system.mapLimit);
    expect(ped.y).toBe(0.25);
    expect(ped.state).toBe('WALKING');

    // Scenario B: Dropped into ocean / below ground level (y < -1.5m)
    ped.y = -8.0;
    system.update(0.1, 0, 0, 0);

    expect(ped.y).toBe(0.25);
    expect(Math.abs(ped.x)).toBeLessThanOrEqual(system.mapLimit);
    expect(Math.abs(ped.z)).toBeLessThanOrEqual(system.mapLimit);
    expect(ped.state).toBe('WALKING');
  });

  it('should trigger corner turns when patrol timer elapses', () => {
    const scene = new THREE.Scene();
    const system = new PedestrianSystem(scene);
    const ped = system.pedestrians[0];

    ped.turnTimer = 0.05;
    const initialRot = ped.rotationY;

    system.update(0.1, 0, 0, 0);

    expect(ped.turnTimer).toBeGreaterThan(3.0); // Reset to new duration
    expect(ped.rotationY).not.toBe(initialRot); // Successfully turned corner
  });
});
