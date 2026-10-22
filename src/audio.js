export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.started = false;
    this.birdTimer = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.4;
    this.master.connect(this.ctx.destination);
    this.startAmbience();
    this.started = true;
    return this.ctx;
  }

  startAmbience() {
    const ctx = this.ctx;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.035;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    padGain.connect(filter).connect(this.master);
    const freqs = [110, 164.81, 220, 329.63];
    for (const [i, f] of freqs.entries()) {
      const osc = ctx.createOscillator();
      osc.type = i % 2 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (i - 1.5) * 5;
      const g = ctx.createGain();
      g.gain.value = 0.25 / (i + 1);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.035 + i * 0.012;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.09;
      lfo.connect(lfoGain).connect(g.gain);
      osc.connect(g).connect(padGain);
      osc.start();
      lfo.start();
    }

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 340;
    noiseFilter.Q.value = 0.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.06;
    noise.connect(noiseFilter).connect(noiseGain).connect(this.master);
    noise.start();

    const chirp = () => {
      if (!this.ctx || this.muted) return;
      const notes = 2 + Math.floor(Math.random() * 4);
      const base = 1500 + Math.random() * 1300;
      let t = this.ctx.currentTime + 0.05;
      for (let i = 0; i < notes; i++) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base + Math.random() * 400, t);
        osc.frequency.exponentialRampToValueAtTime(base + 700 + Math.random() * 700, t + 0.07);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        osc.connect(g).connect(this.master);
        osc.start(t); osc.stop(t + 0.14);
        t += 0.11 + Math.random() * 0.06;
      }
    };
    this.birdTimer = setInterval(() => {
      if (Math.random() < 0.55) chirp();
    }, 5200);
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.4, this.ctx.currentTime + 0.25);
    }
    return this.muted;
  }

  tone(freq, duration, { type = 'sine', volume = 0.15, slide = null, delay = 0 } = {}) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t); osc.stop(t + duration + 0.03);
  }

  noise(duration, { volume = 0.12, cutoff = 1800, type = 'bandpass', freq = 900, delay = 0 } = {}) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + delay;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  click() { this.tone(720, 0.06, { type: 'triangle', volume: 0.05, slide: 680 }); }
  swing() {
    this.noise(0.18, { volume: 0.12, freq: 1400, type: 'bandpass' });
    this.tone(320, 0.14, { type: 'sawtooth', volume: 0.03, slide: 120 });
  }
  hit() {
    this.noise(0.12, { volume: 0.18, freq: 260, type: 'lowpass' });
    this.tone(110, 0.12, { type: 'sine', volume: 0.1, slide: 70 });
  }
  hurt() {
    this.tone(170, 0.22, { type: 'sawtooth', volume: 0.08, slide: 90 });
    this.noise(0.2, { volume: 0.1, freq: 300, type: 'lowpass' });
  }
  coin() {
    this.tone(1050, 0.08, { type: 'triangle', volume: 0.06 });
    this.tone(1480, 0.12, { type: 'triangle', volume: 0.05, delay: 0.05 });
  }
  chop() {
    this.noise(0.08, { volume: 0.12, freq: 420, type: 'lowpass' });
    this.tone(180, 0.06, { type: 'triangle', volume: 0.05, slide: 120 });
  }
  mine() {
    this.noise(0.1, { volume: 0.1, freq: 2200, type: 'bandpass' });
    this.tone(880, 0.07, { type: 'square', volume: 0.022, slide: 600 });
  }
  levelUp() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, i) => this.tone(n, 0.5, { type: 'triangle', volume: 0.09, delay: i * 0.11 }));
  }
  quest() {
    [392, 523.25, 659.25, 783.99].forEach((n, i) => this.tone(n, 0.42, { type: 'sine', volume: 0.07, delay: i * 0.13 }));
  }
  eat() {
    this.noise(0.2, { volume: 0.08, freq: 600, type: 'bandpass' });
    this.tone(220, 0.16, { type: 'sine', volume: 0.04, slide: 320 });
  }
  teleport() {
    [220, 330, 440, 660, 880].forEach((n, i) => this.tone(n, 0.5, { type: 'sine', volume: 0.05, delay: i * 0.07, slide: n * 1.4 }));
    this.noise(0.7, { volume: 0.06, freq: 2600, type: 'bandpass' });
  }
  error() { this.tone(200, 0.13, { type: 'square', volume: 0.035, slide: 150 }); }
}
