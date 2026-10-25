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
});
