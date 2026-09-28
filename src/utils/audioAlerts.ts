// Web Audio API harmonic sound synthesizer for institutional trading alerts
// Safe against autoplay blocks, zero external assets required.

class SoundAlertService {
  private ctx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playChime(direction: 'ABOVE' | 'BELOW' = 'ABOVE') {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const isUp = direction === 'ABOVE';

      // 2-tone melodic harmonic chime
      const freq1 = isUp ? 880 : 987.77; // A5 or B5
      const freq2 = isUp ? 1318.51 : 659.25; // E6 or E5

      // Oscillator 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq1, now);
      osc1.frequency.exponentialRampToValueAtTime(freq1 * 1.05, now + 0.12);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.46);

      // Oscillator 2 (delayed slightly for sparkling bell texture)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq2, now + 0.08);

      gain2.gain.setValueAtTime(0.001, now + 0.08);
      gain2.gain.linearRampToValueAtTime(0.14, now + 0.11);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.08);
      osc2.stop(now + 0.66);
    } catch {
      // Audio playback fails silently if browser policy restricts
    }
  }
}

export const soundAlertService = new SoundAlertService();
