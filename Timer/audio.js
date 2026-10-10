/**
 * TIMER PRO — Advanced Sound Synthesizer & Playback Engine
 * Features:
 * - Single-shot playback ("once")
 * - Seamless indefinite looping ("infinite")
 * - Instant click-free stop via gain envelope cancellation
 * - Overlap protection (guarantees strictly one audio instance)
 * - State tracking: 'stopped' | 'playing' | 'loop'
 * - Offline-ready Web Audio API with zero external dependencies
 */

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.tickingEnabled = false;

    // Mode: 'once' | 'infinite'
    this.mode = 'once';
    try {
      this.mode = localStorage.getItem('chrono_sound_mode') || 'once';
    } catch (_) {}

    // Playback state: 'stopped' | 'playing' | 'loop'
    this.playbackState = 'stopped';
    this.isLooping = false;

    // Active nodes tracking for immediate termination
    this.activeOscillators = new Set();
    this.activeGains = new Set();
    this.loopTimer = null;
    this.currentIterationId = 0;

    // State change listeners
    this.stateListeners = [];
  }

  // Subscribe to playback state & mode changes
  onStateChange(callback) {
    if (typeof callback === 'function') {
      this.stateListeners.push(callback);
      callback(this.playbackState, this.mode);
    }
  }

  notifyStateChange() {
    this.stateListeners.forEach(fn => {
      try {
        fn(this.playbackState, this.mode);
      } catch (err) {
        console.warn('Sound state listener error:', err);
      }
    });
  }

  // Initialize or resume Web Audio context
  init() {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume().catch(err => {
          console.warn('AudioContext resume error:', err);
        });
      } catch (err) {
        console.warn('AudioContext resume error:', err);
      }
    }

    return this.ctx;
  }

  // Resonant singing bowl / Tibetan chime harmonic frequencies (C5, E5, G5, C6)
  static CHIME_FREQS = Object.freeze([523.25, 659.25, 783.99, 1046.50]);
  static CHIME_GAINS = Object.freeze([0.25, 0.20, 0.18, 0.12]);

  // Set mode: 'once' or 'infinite'
  setMode(mode) {
    if (mode !== 'once' && mode !== 'infinite') return;
    this.mode = mode;

    try {
      localStorage.setItem('chrono_sound_mode', mode);
    } catch (_) {}

    // If currently playing, dynamically adjust looping state
    if (this.playbackState !== 'stopped') {
      if (mode === 'infinite') {
        this.isLooping = true;
        this.playbackState = 'loop';
      } else {
        this.isLooping = false;
        this.playbackState = 'playing';
      }
    }

    this.notifyStateChange();
  }

  // Toggle playback: on -> off or off -> on
  toggleSound() {
    if (this.playbackState !== 'stopped') {
      this.stopSound();
    } else {
      this.startSound();
    }
  }

  // Start sound in current mode (strictly avoids multiple overlapping instances)
  startSound() {
    // 1. Immediately terminate any previous sound instances
    this.stopSound(false);

    // 2. Initialize / resume AudioContext on user gesture
    try {
      this.init();
    } catch (err) {
      console.warn('Cannot initialize audio:', err);
      return;
    }

    if (!this.ctx) return;

    this.currentIterationId++;
    const iterationId = this.currentIterationId;

    if (this.mode === 'infinite') {
      this.isLooping = true;
      this.playbackState = 'loop';
    } else {
      this.isLooping = false;
      this.playbackState = 'playing';
    }

    this.notifyStateChange();
    this.playIteration(iterationId);
  }

  // Stop sound immediately and kill repeating loop
  stopSound(notify = true) {
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }

    this.isLooping = false;
    this.currentIterationId++;

    // Instant click-free fade out of all currently sounding nodes
    if (this.ctx && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      this.activeGains.forEach(gainNode => {
        try {
          gainNode.gain.cancelScheduledValues(now);
          gainNode.gain.setValueAtTime(gainNode.gain.value, now);
          gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.02);
        } catch (_) {}
      });

      this.activeOscillators.forEach(osc => {
        try {
          osc.stop(now + 0.025);
        } catch (_) {}
      });
    } else {
      this.activeOscillators.forEach(osc => {
        try {
          osc.stop();
        } catch (_) {}
      });
    }

    this.activeOscillators.clear();
    this.activeGains.clear();

    const previousState = this.playbackState;
    this.playbackState = 'stopped';

    if (notify && previousState !== 'stopped') {
      this.notifyStateChange();
    }
  }

  // Play a single harmonic chime chord iteration
  playIteration(iterationId) {
    if (this.isMuted) {
      this.stopSound();
      return;
    }

    if (!this.ctx || iterationId !== this.currentIterationId) return;

    const now = this.ctx.currentTime;
    const freqs = SoundSynthesizer.CHIME_FREQS;
    const gains = SoundSynthesizer.CHIME_GAINS;
    const noteSpacing = 0.08;
    const decayDuration = 3.2;

    freqs.forEach((freq, idx) => {
      try {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sine';
        const startTime = now + idx * noteSpacing;
        osc.frequency.setValueAtTime(freq, startTime);

        // Gentle attack and crystalline long decay
        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.exponentialRampToValueAtTime(gains[idx], startTime + 0.04);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + decayDuration);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        this.activeOscillators.add(osc);
        this.activeGains.add(gainNode);

        osc.onended = () => {
          try {
            osc.disconnect();
            gainNode.disconnect();
          } catch (_) {}
          this.activeOscillators.delete(osc);
          this.activeGains.delete(gainNode);
        };

        osc.start(startTime);
        osc.stop(startTime + decayDuration + 0.1);
      } catch (err) {
        console.warn('Failed to start oscillator note:', err);
      }
    });

    const totalDuration = (freqs.length - 1) * noteSpacing + decayDuration;
    const durationMs = totalDuration * 1000;

    if (this.isLooping && this.mode === 'infinite') {
      // Loop seamlessly without delay
      this.loopTimer = setTimeout(() => {
        if (this.isLooping && iterationId === this.currentIterationId) {
          this.playIteration(iterationId);
        }
      }, durationMs - 50); // slight 50ms harmonic blend for seamless loop
    } else {
      // Single-shot: after decay completes, revert state to stopped
      this.loopTimer = setTimeout(() => {
        if (iterationId === this.currentIterationId) {
          this.playbackState = 'stopped';
          this.notifyStateChange();
        }
      }, durationMs);
    }
  }

  // Timer finished alarm trigger
  triggerAlarm() {
    this.startSound();
  }

  // Compatibility helper
  playChime() {
    this.startSound();
  }

  // Soft wooden / mechanical tick for active countdown
  playTick() {
    if (this.isMuted || !this.tickingEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
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
    } catch (_) {}
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopSound();
    }
    return this.isMuted;
  }

  setTicking(enabled) {
    this.tickingEnabled = enabled;
  }
}

// Global singleton instance
window.chronoSound = new SoundSynthesizer();
