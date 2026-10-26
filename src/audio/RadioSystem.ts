import { SoundManager } from './SoundManager';

export interface RadioStation {
  id: string;
  name: string;
  genre: string;
  bpm: number;
}

export const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'dbz',
    name: '🐉 Dragon Ball Z FM',
    genre: 'Cha-La Head-Cha-La & Super Saiyan',
    bpm: 148,
  },
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
  public currentStationIndex: number = 0; // Default: Dragon Ball Z FM
  private sound: SoundManager;

  private stepTimer: number = 0;
  public currentStep: number = 0;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  public musicVolume: number = 0.8;

  constructor(sound: SoundManager) {
    this.sound = sound;
  }

  public setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.sound.ctx) {
      const vol = 0.08 * this.musicVolume;
      this.masterGain.gain.value = vol;
      this.masterGain.gain.setValueAtTime(vol, this.sound.ctx.currentTime);
    }
  }

  private ensureMasterGain(): GainNode | null {
    if (this.masterGain) return this.masterGain;
    const ctx = this.sound.ctx;
    if (!ctx) return null;

    this.masterGain = ctx.createGain();
    const vol = 0.08 * this.musicVolume;
    this.masterGain.gain.value = vol;
    this.masterGain.gain.setValueAtTime(vol, ctx.currentTime);
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

  public update(dt: number, inVehicle: boolean = true): void {
    if (!inVehicle || this.isMuted || this.sound.getIsMuted()) return;

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
      const maxSteps = station.id === 'dbz' ? 64 : 16;
      this.currentStep = (this.currentStep + 1) % maxSteps;
    }
  }

  private playSequencerStep(
    ctx: AudioContext,
    master: GainNode,
    stationId: string,
    step: number,
  ): void {
    if (ctx.state !== 'running') return;

    if (stationId === 'dbz') {
      this.playDbzStep(ctx, master, step);
    } else if (stationId === 'synthwave') {
      this.playSynthwaveStep(ctx, master, step);
    } else if (stationId === 'cyberpunk') {
      this.playCyberpunkStep(ctx, master, step);
    } else if (stationId === 'chill') {
      this.playChillStep(ctx, master, step);
    }
  }

  // 0. Dragon Ball Z: Cha-La Head-Cha-La + Super Saiyan Battle Anthem (64 Steps)
  private playDbzStep(ctx: AudioContext, master: GainNode, step: number): void {
    // 64-step melody map: Steps 0-31 (Cha-La Head-Cha-La), Steps 32-63 (Super Saiyan Theme)
    const melody: (number | null)[] = [
      // Bars 1-4: Cha-La Head-Cha-La (Heroic Japanese Anime Rock Theme)
      // Bar 1 (C Major): "Cha-La! Head-Cha-La!"
      392.0,
      null,
      392.0,
      440.0,
      493.88,
      null,
      523.25,
      523.25,
      // Bar 2 (A Minor): "E-ga-o Urutora"
      null,
      587.33,
      523.25,
      493.88,
      440.0,
      392.0,
      329.63,
      392.0,
      // Bar 3 (F Major): "Zetto de Kyou mo"
      440.0,
      440.0,
      392.0,
      329.63,
      392.0,
      440.0,
      523.25,
      587.33,
      // Bar 4 (G Major): "SPARKING!"
      659.25,
      null,
      587.33,
      523.25,
      587.33,
      null,
      null,
      null,

      // Bars 5-8: Super Saiyan Awakening & Power-Up Battle Theme (Bruce Faulconer Style)
      // Bar 5 (E Minor): Fast heroic arpeggio
      329.63,
      392.0,
      493.88,
      659.25,
      587.33,
      493.88,
      392.0,
      440.0,
      // Bar 6 (C Major): Rising Saiyan Power
      329.63,
      440.0,
      523.25,
      659.25,
      587.33,
      523.25,
      493.88,
      440.0,
      // Bar 7 (D Major): Ki Aura Flash
      493.88,
      587.33,
      739.99,
      783.99,
      739.99,
      587.33,
      493.88,
      587.33,
      // Bar 8 (B / E Minor): Ultimate Kamehameha Climax!
      659.25,
      739.99,
      783.99,
      880.0,
      987.77,
      880.0,
      783.99,
      739.99,
    ];

    // Driving anime rock bass (64 steps)
    const bass: number[] = [
      // Steps 0-7: C Major bass
      65.41, 130.81, 65.41, 130.81, 65.41, 65.41, 73.42, 82.41,
      // Steps 8-15: A Minor bass
      55.0, 110.0, 55.0, 110.0, 55.0, 55.0, 61.74, 65.41,
      // Steps 16-23: F Major bass
      43.65, 87.31, 43.65, 87.31, 43.65, 43.65, 49.0, 55.0,
      // Steps 24-31: G Major bass
      49.0, 98.0, 49.0, 98.0, 49.0, 49.0, 55.0, 61.74,

      // Steps 32-39: E Minor battle bass
      41.2, 82.41, 41.2, 82.41, 41.2, 41.2, 49.0, 55.0,
      // Steps 40-47: C Major power bass
      65.41, 130.81, 65.41, 130.81, 65.41, 65.41, 73.42, 82.41,
      // Steps 48-55: D Major drive bass
      73.42, 146.83, 73.42, 146.83, 73.42, 73.42, 82.41, 92.5,
      // Steps 56-63: B Minor / E Minor tension
      61.74, 123.47, 61.74, 123.47, 82.41, 82.41, 82.41, 82.41,
    ];

    // Chords on downbeats to add full polyphonic rock richness
    const chords: { [step: number]: number[] } = {
      0: [130.81, 164.81, 196.0], // C Maj
      8: [110.0, 130.81, 164.81], // A Min
      16: [87.31, 110.0, 130.81], // F Maj
      24: [98.0, 123.47, 146.83], // G Maj
      32: [82.41, 98.0, 123.47], // E Min
      40: [130.81, 164.81, 196.0], // C Maj
      48: [146.83, 185.0, 220.0], // D Maj
      56: [123.47, 146.83, 185.0], // B Min
    };

    // 1. Play Lead Melody Note
    const noteFreq = melody[step];
    if (noteFreq) {
      this.playDbzLead(ctx, master, noteFreq, 0.22);
    }

    // 2. Play Bass Note
    const bassFreq = bass[step];
    this.playDbzBass(ctx, master, bassFreq);

    // 3. Play Power Chord on measure start
    if (chords[step]) {
      this.playDbzPowerChord(ctx, master, chords[step]);
    }

    // 4. Drums
    // Crash Cymbal on section intros (step 0 and 32)
    if (step === 0 || step === 32) {
      this.playCrash(ctx, master);
    }

    // Kick: Driving rock syncopation
    if (step < 32) {
      if (
        step === 0 ||
        step === 3 ||
        step === 6 ||
        step === 8 ||
        step === 11 ||
        step === 14 ||
        step === 16 ||
        step === 19 ||
        step === 22 ||
        step === 24 ||
        step === 27 ||
        step === 30
      ) {
        this.playKick(ctx, master, 130, 42);
      }
    } else {
      // High-octane battle double kick!
      if (step % 2 === 0 || step === 61 || step === 62 || step === 63) {
        this.playKick(ctx, master, 145, 45);
      }
    }

    // Snare on 4 and 12 of every 16 steps, plus drum fills
    if (step % 8 === 4 || step === 31 || step === 62 || step === 63) {
      this.playSnare(ctx, master);
    }

    // Hi-hat on 8th notes
    if (step % 2 === 1) {
      this.playHiHat(ctx, master);
    }
  }

  private playDbzLead(
    ctx: AudioContext,
    master: GainNode,
    freq: number,
    duration: number = 0.22,
  ): void {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, ctx.currentTime);

    // Slight chorus detune for glorious 90s anime synth brass sound
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq * 1.006, ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + duration);
    filter.Q.setValueAtTime(3.0, ctx.currentTime);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + duration);
    osc2.stop(ctx.currentTime + duration);
  }

  private playDbzBass(ctx: AudioContext, master: GainNode, freq: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.16);

    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  }

  private playDbzPowerChord(ctx: AudioContext, master: GainNode, freqs: number[]): void {
    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * 2, ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, ctx.currentTime);

      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    });
  }

  private playCrash(ctx: AudioContext, master: GainNode): void {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'square';
    osc1.frequency.setValueAtTime(3600, ctx.currentTime);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(5200, ctx.currentTime);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3200, ctx.currentTime);

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + 0.45);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.5);
    osc2.stop(ctx.currentTime + 0.5);
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
