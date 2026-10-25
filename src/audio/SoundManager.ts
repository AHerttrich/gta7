export class SoundManager {
  public ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  // Engine Audio Nodes
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  // Helicopter Rotor Audio Nodes
  private rotorOsc: OscillatorNode | null = null;
  private rotorGain: GainNode | null = null;

  // Police Siren Nodes
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenTimer: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = (): void => {
        this.initAudioContext();
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('click', unlock);
      window.addEventListener('keydown', unlock);
      window.addEventListener('touchstart', unlock);
    }
  }

  private initAudioContext(): void {
    if (this.ctx) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    // Setup Engine Oscillator (Sawtooth waveform)
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, this.ctx.currentTime);

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();

    // Setup Police Siren
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.setValueAtTime(650, this.ctx.currentTime);

    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.ctx.destination);
    this.sirenOsc.start();

    // Setup Helicopter Rotor Oscillator (Low Frequency Chopper Thump)
    this.rotorOsc = this.ctx.createOscillator();
    this.rotorOsc.type = 'sawtooth';
    this.rotorOsc.frequency.setValueAtTime(24, this.ctx.currentTime);

    this.rotorGain = this.ctx.createGain();
    this.rotorGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    const rotorFilter = this.ctx.createBiquadFilter();
    rotorFilter.type = 'lowpass';
    rotorFilter.frequency.setValueAtTime(180, this.ctx.currentTime);

    this.rotorOsc.connect(rotorFilter);
    rotorFilter.connect(this.rotorGain);
    this.rotorGain.connect(this.ctx.destination);
    this.rotorOsc.start();
  }

  public updateRotorPitch(rpm: number, inHeli: boolean): void {
    if (!this.ctx || !this.rotorOsc || !this.rotorGain || this.isMuted) return;

    if (!inHeli || rpm <= 0.05) {
      this.rotorGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      return;
    }

    const freq = 12 + rpm * 26; // Rhythmic chopper blade thump
    this.rotorOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    this.rotorGain.gain.setValueAtTime(0.06 * Math.min(1.0, rpm), this.ctx.currentTime);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setValueAtTime(this.isMuted ? 0 : 0.04, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public updateEnginePitch(
    rpm: number,
    inCar: boolean,
    isBoosting: boolean = false,
    isHoverMode: boolean = false,
  ): void {
    if (!this.ctx || !this.engineOsc || this.isMuted) return;

    if (!inCar) {
      this.engineGain?.gain.setValueAtTime(0.0, this.ctx.currentTime);
      return;
    }

    if (isHoverMode) {
      // Futuristic sci-fi hover hum
      const hoverFreq = 160 + Math.sin(this.ctx.currentTime * 8) * 20 + rpm * 80;
      this.engineOsc.frequency.setTargetAtTime(hoverFreq, this.ctx.currentTime, 0.05);
      this.engineGain?.gain.setValueAtTime(isBoosting ? 0.08 : 0.05, this.ctx.currentTime);
      return;
    }

    const boostMultiplier = isBoosting ? 1.4 : 1.0;
    const freq = (45 + rpm * 110) * boostMultiplier;
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    this.engineGain?.gain.setValueAtTime(isBoosting ? 0.07 : 0.04, this.ctx.currentTime);
  }

  public playHoverEngage(): void {
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  public updateSiren(wantedLevel: number, dt: number): void {
    if (!this.ctx || !this.sirenOsc || !this.sirenGain || this.isMuted) return;

    if (wantedLevel > 0) {
      this.sirenTimer += dt * 3.5;
      const sirenFreq = 650 + Math.sin(this.sirenTimer) * 250;
      this.sirenOsc.frequency.setValueAtTime(sirenFreq, this.ctx.currentTime);
      this.sirenGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    } else {
      this.sirenGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    }
  }

  public playHorn(): void {
    if (!this.ctx || this.isMuted) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(349, this.ctx.currentTime);
    osc2.frequency.setValueAtTime(440, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.35);
    osc2.stop(this.ctx.currentTime + 0.35);
  }

  public playGunshot(): void {
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  public playExplosion(): void {
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.6);
  }

  public playPedestrianHit(): void {
    if (!this.ctx || this.isMuted) return;

    // Slap / Thump sound + comical slide down
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  }

  public playSprayPaint(): void {
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  public playCheckpointChime(): void {
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  public playFanfare(): void {
    if (!this.ctx || this.isMuted) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      const startTime = this.ctx!.currentTime + idx * 0.1;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  public playCrash(): void {
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }
}
