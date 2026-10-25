import { SoundManager } from './SoundManager';

export interface RadioStation {
  id: string;
  name: string;
  genre: string;
  bpm: number;
}

export const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'synthwave',
    name: '⚡ 80s Synthwave FM',
    genre: 'Outrun / Retro Synth',
    bpm: 120,
  },
  {
    id: 'cyberpunk',
    name: '🔥 Cyber Electro Drive',
    genre: 'High-Octane Techno',
    bpm: 136,
  },
  {
    id: 'chill',
    name: '🌴 Vice Beach Chill',
    genre: 'Mellow Lo-Fi Beats',
    bpm: 92,
  },
  {
    id: 'off',
    name: '📻 Radio Aus',
    genre: 'Stille',
    bpm: 0,
  },
];

export class RadioSystem {
  public currentStationIndex: number = 0; // Default: Synthwave FM
  private sound: SoundManager;

  private stepTimer: number = 0;
  private currentStep: number = 0;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  public musicVolume: number = 0.8;

  constructor(sound: SoundManager) {
    this.sound = sound;
  }

  public setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.sound.ctx) {
      this.masterGain.gain.setValueAtTime(0.08 * this.musicVolume, this.sound.ctx.currentTime);
    }
  }

  private ensureMasterGain(): GainNode | null {
    if (this.masterGain) return this.masterGain;
    const ctx = this.sound.ctx;
    if (!ctx) return null;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.08 * this.musicVolume, ctx.currentTime);
    this.masterGain.connect(this.sound.masterGain || ctx.destination);
    return this.masterGain;
  }

  public getCurrentStation(): RadioStation {
    return RADIO_STATIONS[this.currentStationIndex];
  }

  public cycleStation(): RadioStation {
    this.currentStationIndex = (this.currentStationIndex + 1) % RADIO_STATIONS.length;
    this.stepTimer = 0;
    this.currentStep = 0;

    // Smooth radio tuning dip & crossfade
    if (this.masterGain && this.sound.ctx) {
      const now = this.sound.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(0.01, now);
      this.masterGain.gain.linearRampToValueAtTime(0.08 * this.musicVolume, now + 0.35);
    }

    return this.getCurrentStation();
  }

  public setStation(index: number): RadioStation {
    this.currentStationIndex = Math.max(0, Math.min(RADIO_STATIONS.length - 1, index));
    this.stepTimer = 0;
    this.currentStep = 0;

    if (this.masterGain && this.sound.ctx) {
      const now = this.sound.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(0.01, now);
      this.masterGain.gain.linearRampToValueAtTime(0.08 * this.musicVolume, now + 0.35);
    }

    return this.getCurrentStation();
  }

  public update(dt: number, inVehicle: boolean): void {
    if (!inVehicle || this.isMuted) return;

    const station = this.getCurrentStation();
    if (station.id === 'off' || station.bpm <= 0) return;

    const ctx = this.sound.ctx;
    if (!ctx) return;

    const master = this.ensureMasterGain();
    if (!master) return;

    const stepInterval = 60 / station.bpm / 2; // Eighth notes
    this.stepTimer += dt;

    if (this.stepTimer >= stepInterval) {
      this.stepTimer -= stepInterval;
      this.playSequencerStep(ctx, master, station.id, this.currentStep);
      this.currentStep = (this.currentStep + 1) % 16;
    }
  }

  private playSequencerStep(
    ctx: AudioContext,
    master: GainNode,
    stationId: string,
    step: number,
  ): void {
    if (ctx.state !== 'running') return;

    if (stationId === 'synthwave') {
      this.playSynthwaveStep(ctx, master, step);
    } else if (stationId === 'cyberpunk') {
      this.playCyberpunkStep(ctx, master, step);
    } else if (stationId === 'chill') {
      this.playChillStep(ctx, master, step);
    }
  }

  // 1. Synthwave: Driving A minor Bassline + Kick & Snare + Retro Saw Lead
  private playSynthwaveStep(ctx: AudioContext, master: GainNode, step: number): void {
    const bassNotes = [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83]; // A2, C3, D3, E3
    const freq = bassNotes[step % bassNotes.length];

    // Bass synth
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);

    // Four on the floor kick
    if (step % 4 === 0) {
      this.playKick(ctx, master);
    }
    // Snare on 4 and 12
    if (step === 4 || step === 12) {
      this.playSnare(ctx, master);
    }
  }

  // 2. Cyberpunk Electro: Pumping Sub-bass + 16th Hi-Hats + Hard Techno Kick
  private playCyberpunkStep(ctx: AudioContext, master: GainNode, step: number): void {
    const cyberBass = [73.42, 73.42, 82.41, 73.42, 98.0, 73.42, 87.31, 73.42]; // D2, E2, G2, F2
    const freq = cyberBass[step % cyberBass.length];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(master);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);

    // Fast techno kick
    if (step % 4 === 0) {
      this.playKick(ctx, master, 140, 40);
    }
    // Hi-hats on off-beats
    if (step % 2 === 1) {
      this.playHiHat(ctx, master);
    }
  }

  // 3. Vice Beach Chill: Mellow Sine Chords + Smooth Groove
  private playChillStep(ctx: AudioContext, master: GainNode, step: number): void {
    const chords = [220, 261.63, 329.63, 392.0]; // Am7: A3, C4, E4, G4
    if (step % 4 === 0) {
      const freq = chords[(step / 4) % chords.length];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(master);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }

    if (step % 8 === 0) {
      this.playKick(ctx, master, 90, 45);
    }
  }

  private playKick(
    ctx: AudioContext,
    master: GainNode,
    startFreq: number = 120,
    endFreq: number = 35,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(master);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  private playSnare(ctx: AudioContext, master: GainNode): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.09);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(master);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  private playHiHat(ctx: AudioContext, master: GainNode): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(4500, ctx.currentTime);

    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(master);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }
}
