/**
 * CHRONO Sound Synthesizer
 * Uses the Web Audio API for crystal-clear, zero-dependency audio alerts.
 */

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.tickingEnabled = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  static CHIME_FREQS = Object.freeze([523.25, 659.25, 783.99, 1046.50]);
  static CHIME_GAINS = Object.freeze([0.25, 0.20, 0.18, 0.12]);

  // Play peaceful resonant singing bowl / chime chord
  playChime() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = SoundSynthesizer.CHIME_FREQS;
    const gains = SoundSynthesizer.CHIME_GAINS;

    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      // Smooth attack & long crystal decay
      gainNode.gain.setValueAtTime(0.0001, now + idx * 0.08);
      gainNode.gain.exponentialRampToValueAtTime(gains[idx], now + idx * 0.08 + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 3.2);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.onended = () => {
        try {
          osc.disconnect();
          gainNode.disconnect();
        } catch (_) {}
      };

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 3.3);
    });
  }

  // Soft wooden / mechanical tick
  playTick() {
    if (this.isMuted || !this.tickingEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.015);

    gainNode.gain.setValueAtTime(0.04, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.onended = () => {
      try {
        osc.disconnect();
        gainNode.disconnect();
      } catch (_) {}
    };

    osc.start(now);
    osc.stop(now + 0.016);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  setTicking(enabled) {
    this.tickingEnabled = enabled;
  }
}

// Global instance
window.chronoSound = new SoundSynthesizer();
