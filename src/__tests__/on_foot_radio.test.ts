import { describe, it, expect } from 'vitest';
import { RadioSystem, RADIO_STATIONS } from '../audio/RadioSystem';
import { SoundManager } from '../audio/SoundManager';

describe('On-Foot Radio & Cyber Earphones System', () => {
  it('should have playOnFoot enabled by default to allow music playback while walking', () => {
    const sound = new SoundManager();
    const radio = new RadioSystem(sound);

    expect(radio.playOnFoot).toBe(true);
  });

  it('should advance radio sequence when player is on foot (inVehicle = false but playOnFoot = true)', () => {
    const sound = new SoundManager();
    // Provide typed AudioContext mock for node test runner
    const mockCtx = {
      currentTime: 0,
      createGain: (): {
        gain: {
          value: number;
          setValueAtTime: (v: number, t: number) => void;
          linearRampToValueAtTime: (v: number, t: number) => void;
          exponentialRampToValueAtTime: (v: number, t: number) => void;
        };
        connect: () => void;
      } => ({
        gain: {
          value: 0,
          setValueAtTime: (): void => {},
          linearRampToValueAtTime: (): void => {},
          exponentialRampToValueAtTime: (): void => {},
        },
        connect: (): void => {},
      }),
      createOscillator: (): {
        type: string;
        frequency: {
          setValueAtTime: (v: number, t: number) => void;
          exponentialRampToValueAtTime: (v: number, t: number) => void;
        };
        connect: () => void;
        start: () => void;
        stop: () => void;
      } => ({
        type: 'sine',
        frequency: {
          setValueAtTime: (): void => {},
          exponentialRampToValueAtTime: (): void => {},
        },
        connect: (): void => {},
        start: (): void => {},
        stop: (): void => {},
      }),
    };
    sound.ctx = mockCtx as unknown as AudioContext;
    const radio = new RadioSystem(sound);

    // Initial station is Dragon Ball Z FM
    expect(radio.getCurrentStation().id).toBe('dbz');
    expect(radio.getCurrentStation().bpm).toBe(148);

    // Simulate in-game condition when player is on foot
    const inVehicle = false;
    const isRadioActive = inVehicle || radio.playOnFoot;
    expect(isRadioActive).toBe(true);

    const stepBefore = radio.currentStep;
    radio.update(0.35, isRadioActive);
    expect(radio.currentStep).toBeGreaterThan(stepBefore);
  });

  it('should cycle stations while on foot and loop through all radio stations', () => {
    const sound = new SoundManager();
    const radio = new RadioSystem(sound);

    expect(radio.getCurrentStation().name).toContain('Dragon Ball Z');

    // Cycle through all stations on foot
    for (let i = 0; i < RADIO_STATIONS.length; i++) {
      const st = radio.cycleStation();
      expect(st).toBeDefined();
      expect(st.name.length).toBeGreaterThan(0);
    }

    // Back to DBZ
    expect(radio.getCurrentStation().id).toBe('dbz');
  });

  it('should remain silent when player sets station to Radio Aus (off)', () => {
    const sound = new SoundManager();
    const radio = new RadioSystem(sound);

    // Set to 'off' station
    const offIdx = RADIO_STATIONS.findIndex((s) => s.id === 'off');
    radio.setStation(offIdx);
    expect(radio.getCurrentStation().id).toBe('off');

    const stepBefore = radio.currentStep;
    radio.update(0.5, true);
    expect(radio.currentStep).toBe(stepBefore); // No advancement on off
  });
});
