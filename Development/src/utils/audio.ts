/**
 * Web Audio API Sound Synthesizer with Voice Limiting, Throttling, and Compressor
 * Prevents stuttering/lag during rapid clicks.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private isMuted: boolean = false;

  // Throttling timestamps to prevent audio stuttering on rapid clicks/collisions
  private lastClickTime: number = 0;
  private lastBounceTime: number = 0;
  private lastDropTime: number = 0;
  private lastMergeTime: number = 0;

  // Active oscillator count limiter
  private activeVoices: number = 0;
  private readonly MAX_VOICES: number = 6;

  constructor() {
    const saved = localStorage.getItem('suika_sound_enabled');
    if (saved !== null) {
      this.isMuted = saved === 'false';
    }
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        // Master dynamics compressor prevents digital clipping & crackles
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public getSoundEnabled(): boolean {
    return !this.isMuted;
  }

  public setSoundEnabled(enabled: boolean) {
    this.isMuted = !enabled;
    localStorage.setItem('suika_sound_enabled', String(enabled));
  }

  public toggleSound(): boolean {
    const nextState = this.isMuted;
    this.setSoundEnabled(nextState);
    if (nextState) {
      this.playClick();
    }
    return nextState;
  }

  public playClick() {
    if (this.isMuted) return;
    const nowMs = performance.now();
    // Throttle clicks to at least 70ms apart to prevent audio thread lockup
    if (nowMs - this.lastClickTime < 70) return;
    this.lastClickTime = nowMs;

    this.initContext();
    if (!this.ctx || !this.compressor || this.activeVoices >= this.MAX_VOICES) return;

    try {
      const t = Math.max(this.ctx.currentTime, 0.001);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, t);
      osc.frequency.exponentialRampToValueAtTime(780, t + 0.04);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.compressor);

      this.activeVoices++;
      osc.start(t);
      osc.stop(t + 0.05);

      osc.onended = () => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };
    } catch {}
  }

  public playDrop() {
    if (this.isMuted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastDropTime < 80) return;
    this.lastDropTime = nowMs;

    this.initContext();
    if (!this.ctx || !this.compressor || this.activeVoices >= this.MAX_VOICES) return;

    try {
      const t = Math.max(this.ctx.currentTime, 0.001);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.1);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);

      osc.connect(gain);
      gain.connect(this.compressor);

      this.activeVoices++;
      osc.start(t);
      osc.stop(t + 0.1);

      osc.onended = () => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };
    } catch {}
  }

  public playBounce(tier: number = 1) {
    if (this.isMuted) return;
    const nowMs = performance.now();
    // Throttle bounce effects to 60ms to prevent collision avalanche stuttering
    if (nowMs - this.lastBounceTime < 60) return;
    this.lastBounceTime = nowMs;

    this.initContext();
    if (!this.ctx || !this.compressor || this.activeVoices >= this.MAX_VOICES) return;

    try {
      const t = Math.max(this.ctx.currentTime, 0.001);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const baseFreq = Math.max(75, 250 - tier * 12);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, t + 0.07);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

      osc.connect(gain);
      gain.connect(this.compressor);

      this.activeVoices++;
      osc.start(t);
      osc.stop(t + 0.07);

      osc.onended = () => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };
    } catch {}
  }

  public playMerge(tier: number = 1) {
    if (this.isMuted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastMergeTime < 50) return;
    this.lastMergeTime = nowMs;

    this.initContext();
    if (!this.ctx || !this.compressor) return;

    try {
      const now = Math.max(this.ctx.currentTime, 0.001);
      const notes = [
        261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5,
        1174.66, 1318.51,
      ];
      const noteIdx = Math.min(notes.length - 1, tier);
      const rootFreq = notes[noteIdx] || 440;

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(rootFreq, now);
      osc1.frequency.exponentialRampToValueAtTime(rootFreq * 1.25, now + 0.12);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(rootFreq * 1.5, now + 0.03);
      osc2.frequency.exponentialRampToValueAtTime(rootFreq * 2.0, now + 0.18);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.compressor);

      this.activeVoices += 2;
      osc1.start(now);
      osc2.start(now + 0.03);
      osc1.stop(now + 0.22);
      osc2.stop(now + 0.22);

      const cleanup = () => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
        try {
          osc1.disconnect();
          osc2.disconnect();
          gain.disconnect();
        } catch {}
      };
      osc1.onended = cleanup;
      osc2.onended = cleanup;
    } catch {}
  }

  public playCombo(combo: number) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.compressor) return;

    try {
      const now = Math.max(this.ctx.currentTime, 0.001);
      const baseFreq = 440 + Math.min(5, combo) * 75;
      const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];

      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.compressor) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + idx * 0.05;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);

        osc.connect(gain);
        gain.connect(this.compressor);

        this.activeVoices++;
        osc.start(start);
        osc.stop(start + 0.14);

        osc.onended = () => {
          this.activeVoices = Math.max(0, this.activeVoices - 1);
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
        };
      });
    } catch {}
  }

  public playRevival() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.compressor) return;

    try {
      const now = Math.max(this.ctx.currentTime, 0.001);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

      osc.connect(gain);
      gain.connect(this.compressor);

      osc.start(now);
      osc.stop(now + 0.38);
    } catch {}
  }

  public playUltimateMerge() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.compressor) return;

    try {
      const now = Math.max(this.ctx.currentTime, 0.001);
      const chords = [523.25, 659.25, 783.99, 1046.5];

      chords.forEach((freq) => {
        if (!this.ctx || !this.compressor) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + 0.5);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

        osc.connect(gain);
        gain.connect(this.compressor);

        osc.start(now);
        osc.stop(now + 0.6);
      });
    } catch {}
  }

  public playGameOver() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.compressor) return;

    try {
      const now = Math.max(this.ctx.currentTime, 0.001);
      const notes = [440, 392, 349.23, 293.66];
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.compressor) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + idx * 0.1;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

        osc.connect(gain);
        gain.connect(this.compressor);

        osc.start(start);
        osc.stop(start + 0.16);
      });
    } catch {}
  }
}

export const soundManager = new SoundManager();
