import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { Renderer } from '../engine/Renderer';

// Mock WebGLRenderer and canvas for Node/Vitest environment
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    ...actual,
    WebGLRenderer: class {
      setSize = vi.fn();
      setPixelRatio = vi.fn();
      render = vi.fn();
      shadowMap = { enabled: false, type: 0 };
      toneMapping = 0;
      toneMappingExposure = 1.0;
    },
  };
});

describe('Round 4: Dynamic Day/Night Cycle & Cyber Weather FX', () => {
  let renderer: Renderer;
  let mockCanvas: HTMLCanvasElement;

  beforeEach(() => {
    mockCanvas = {
      getContext: vi.fn(),
      addEventListener: vi.fn(),
      style: {},
    } as unknown as HTMLCanvasElement;

    renderer = new Renderer(mockCanvas);
  });

  it('initializes Day/Night lighting and weather system defaults', () => {
    expect(renderer.sunLight).toBeDefined();
    expect(renderer.ambientLight).toBeDefined();
    expect(renderer.timeOfDay).toBeCloseTo(0.35);
    expect(renderer.weather).toBe('clear');
  });

  it('cycles time of day presets correctly through Tag, Sonnenuntergang, Cyber-Nacht, Sonnenaufgang', () => {
    renderer.setTimeOfDay(0.5); // Tag
    const next1 = renderer.cycleTimePreset();
    expect(next1).toContain('Sonnenuntergang');
    expect(renderer.timeOfDay).toBeCloseTo(0.78);

    const next2 = renderer.cycleTimePreset();
    expect(next2).toContain('Nacht');
    expect(renderer.timeOfDay).toBe(0.0);

    const next3 = renderer.cycleTimePreset();
    expect(next3).toContain('Sonnenaufgang');
    expect(renderer.timeOfDay).toBeCloseTo(0.25);

    const next4 = renderer.cycleTimePreset();
    expect(next4).toContain('Tag');
    expect(renderer.timeOfDay).toBeCloseTo(0.5);
  });

  it('cycles weather modes between clear, rain, and thunder', () => {
    expect(renderer.weather).toBe('clear');

    const w1 = renderer.cycleWeather();
    expect(w1).toContain('Regen');
    expect(renderer.weather).toBe('rain');

    const w2 = renderer.cycleWeather();
    expect(w2).toContain('Gewitter');
    expect(renderer.weather).toBe('thunder');

    const w3 = renderer.cycleWeather();
    expect(w3).toContain('Klar');
    expect(renderer.weather).toBe('clear');
  });

  it('updates sun position and lighting intensity based on time of day', () => {
    const camPos = new THREE.Vector3(0, 5, 0);

    // Midday
    renderer.setTimeOfDay(0.25); // sun angle ~ PI/2, sin > 0
    renderer.updateAtmosphere(0.1, camPos, 0, false, false);
    expect(renderer.sunLight.intensity).toBeGreaterThan(0.5);

    // Midnight
    renderer.setTimeOfDay(0.75); // sun angle ~ 3PI/2, sin < 0
    renderer.updateAtmosphere(0.1, camPos, 0, false, false);
    expect(renderer.sunLight.intensity).toBeLessThanOrEqual(0.1);
  });
});
