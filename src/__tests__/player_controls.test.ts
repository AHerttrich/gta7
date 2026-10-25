import { describe, it, expect } from 'vitest';
import { Player } from '../character/Player';
import { Input } from '../engine/Input';
import { City } from '../city/City';

describe('Player Character On-Foot Controls & Rotation', () => {
  it('should initialize player at start coordinates', () => {
    const player = new Player(44, 44);
    expect(player.x).toBe(44);
    expect(player.z).toBe(44);
    expect(player.rotationY).toBe(0);
    expect(player.group.position.x).toBe(44);
  });

  it('should rotate left when left input is pressed', () => {
    const player = new Player(44, 44);
    const input = new Input();
    const city = new City();

    input.touchState.left = true;
    player.update(0.1, input, city);

    expect(player.rotationY).toBeGreaterThan(0);
    expect(player.group.rotation.y).toBe(player.rotationY);
  });

  it('should rotate right when right input is pressed', () => {
    const player = new Player(44, 44);
    const input = new Input();
    const city = new City();

    input.touchState.right = true;
    player.update(0.1, input, city);

    expect(player.rotationY).toBeLessThan(0);
    expect(player.group.rotation.y).toBe(player.rotationY);
  });

  it('should walk forward in facing direction', () => {
    const player = new Player(44, 44);
    const input = new Input();
    const city = new City();

    // Facing North (rotationY = 0, facing +Z)
    input.touchState.forward = true;
    player.update(0.1, input, city);

    expect(player.z).toBeGreaterThan(44);
    expect(player.x).toBeCloseTo(44, 2);
  });

  it('should turn and walk forward along rotated heading', () => {
    const player = new Player(44, 44);
    const input = new Input();
    const city = new City();

    // Rotate 90 degrees to face +X (East)
    player.rotationY = Math.PI / 2;
    input.touchState.forward = true;
    player.update(0.1, input, city);

    expect(player.x).toBeGreaterThan(44);
    expect(player.z).toBeCloseTo(44, 2);
  });

  it('should apply touchTurnDelta from screen swiping to player rotation', () => {
    const player = new Player(44, 44);
    const input = new Input();
    const city = new City();

    input.touchTurnDelta = 0.5;
    player.update(0.1, input, city);

    expect(player.rotationY).toBeCloseTo(-0.5, 2);
    expect(input.touchTurnDelta).toBe(0); // Resets after consumption
  });
});
