import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Renderer } from '../engine/Renderer';

const setPixelRatio = vi.fn();

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    ...actual,
    WebGLRenderer: class {
      setSize = vi.fn();
      setPixelRatio = setPixelRatio;
      render = vi.fn();
      compile = vi.fn();
      getPixelRatio = (): number => 1;
      shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
      toneMapping = 0;
      toneMappingExposure = 1.0;
    },
  };
});

function makeRenderer(): Renderer {
  const canvas = {
    getContext: vi.fn(),
    addEventListener: vi.fn(),
    style: {},
  } as unknown as HTMLCanvasElement;
  return new Renderer(canvas);
}

describe('Renderer frame-time governor & shadow cadence', () => {
  let renderer: Renderer;

  /** Simulates a fill-rate bound GPU: frame time scales with the render resolution. */
  const runGpuBound = (frames: number, msAtFullScale: number): void => {
    const full = renderer.renderScale;
    for (let i = 0; i < frames; i++) {
      const ratio = renderer.renderScale / full;
      renderer.adaptResolution((msAtFullScale / 1000) * ratio * ratio);
    }
  };

  beforeEach(() => {
    setPixelRatio.mockClear();
    renderer = makeRenderer();
    renderer.setGraphicsQuality('ultra');
    setPixelRatio.mockClear();
  });

  it('lowers the render scale on a fill-rate bound GPU, never below the floor', () => {
    const start = renderer.renderScale;
    runGpuBound(600, 40); // 25 fps at full scale
    expect(renderer.renderScale).toBeLessThan(start);
    expect(renderer.renderScale).toBeGreaterThanOrEqual(0.6);
  });

  it('keeps resolution when the game is CPU-bound (reduction does not help) and backs off', () => {
    const start = renderer.renderScale;
    // Frame time is 45 ms no matter what the resolution is
    for (let i = 0; i < 2000; i++) renderer.adaptResolution(0.045);
    expect(renderer.renderScale).toBe(start);
    // ...and it does not keep retrying (lockout): resolution never drops for a long stretch
    let minScale = start;
    for (let i = 0; i < 1500; i++) {
      renderer.adaptResolution(0.045);
      minScale = Math.min(minScale, renderer.renderScale);
    }
    expect(minScale).toBeGreaterThan(start - 0.21);
  });

  it('ignores one-off stalls (shader compile, tab switch) and keeps resolution', () => {
    const start = renderer.renderScale;
    for (let i = 0; i < 200; i++) renderer.adaptResolution(0.0167);
    renderer.adaptResolution(0.24); // single hitch
    for (let i = 0; i < 200; i++) renderer.adaptResolution(0.0167);
    renderer.adaptResolution(5); // tab switch
    expect(renderer.renderScale).toBe(start);
  });

  it('restores resolution after sustained headroom, capped at the preset ceiling', () => {
    const start = renderer.renderScale;
    runGpuBound(600, 40);
    const reduced = renderer.renderScale;
    expect(reduced).toBeLessThan(start);
    for (let i = 0; i < 5000; i++) renderer.adaptResolution(0.008); // 125 fps
    expect(renderer.renderScale).toBeGreaterThan(reduced);
    expect(renderer.renderScale).toBeLessThanOrEqual(2);
  });

  it('refreshes the shadow map every other frame and not at all at night', () => {
    const sm = (renderer.renderer as unknown as { shadowMap: { needsUpdate: boolean } }).shadowMap;
    renderer.setTimeOfDay(0.25); // noon
    renderer.updateAtmosphere(0.016, renderer.camera.position, 0, false, false);

    let updates = 0;
    for (let i = 0; i < 20; i++) {
      sm.needsUpdate = false;
      renderer.render();
      if (sm.needsUpdate) updates++;
    }
    expect(updates).toBeGreaterThanOrEqual(9);
    expect(updates).toBeLessThanOrEqual(12);

    renderer.setTimeOfDay(0.75); // midnight
    renderer.updateAtmosphere(0.016, renderer.camera.position, 0, false, false);
    let nightUpdates = 0;
    for (let i = 0; i < 20; i++) {
      sm.needsUpdate = false;
      renderer.render();
      if (sm.needsUpdate) nightUpdates++;
    }
    expect(nightUpdates).toBe(0);

    // Sunrise: first frame refreshes immediately (no shadow pop)
    renderer.setTimeOfDay(0.25);
    renderer.updateAtmosphere(0.016, renderer.camera.position, 0, false, false);
    sm.needsUpdate = false;
    renderer.render();
    expect(sm.needsUpdate).toBe(true);
  });
});
