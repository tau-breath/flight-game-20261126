// All Coast Patrol sound is synthesized here. The graph is built only after a user gesture and
// every method is inert when Web Audio is unavailable, muted, closed or still suspended.
export function createAudio() {
  let context = null;
  let master = null;
  let engineGain = null;
  let engineFilter = null;
  let engineA = null;
  let engineB = null;
  let propLfo = null;
  let propDepth = null;
  let windGain = null;
  let windFilter = null;
  let hornGain = null;
  let noiseBuffer = null;
  let started = false;
  let isMuted = false;
  let stallActive = false;
  let nextBeep = 0;

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function makeNoiseBuffer(audioContext) {
    const length = Math.max(1, Math.floor(audioContext.sampleRate * 2));
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const samples = buffer.getChannelData(0);
    let randomState = 0x74a31c29;
    for (let index = 0; index < length; index += 1) {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      samples[index] = (randomState / 4294967296) * 2 - 1;
    }
    return buffer;
  }

  function buildGraph() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    context = new AudioContextClass({ latencyHint: 'interactive' });
    master = context.createGain();
    master.gain.value = isMuted ? 0 : 0.78;
    master.connect(context.destination);

    engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 900;
    engineFilter.Q.value = 0.7;
    engineGain = context.createGain();
    engineGain.gain.value = 0.018;
    engineFilter.connect(engineGain);
    engineGain.connect(master);

    engineA = context.createOscillator();
    engineA.type = 'sawtooth';
    engineA.frequency.value = 82;
    engineA.detune.value = -7;
    engineA.connect(engineFilter);
    engineA.start();

    engineB = context.createOscillator();
    engineB.type = 'sawtooth';
    engineB.frequency.value = 82;
    engineB.detune.value = 8;
    engineB.connect(engineFilter);
    engineB.start();

    propLfo = context.createOscillator();
    propLfo.type = 'sine';
    propLfo.frequency.value = 32;
    propDepth = context.createGain();
    propDepth.gain.value = 0.004;
    propLfo.connect(propDepth);
    propDepth.connect(engineGain.gain);
    propLfo.start();

    noiseBuffer = makeNoiseBuffer(context);
    const windSource = context.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;
    windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.55;
    windGain = context.createGain();
    windGain.gain.value = 0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSource.start();

    const horn = context.createOscillator();
    horn.type = 'square';
    horn.frequency.value = 430;
    hornGain = context.createGain();
    hornGain.gain.value = 0;
    horn.connect(hornGain);
    hornGain.connect(master);
    horn.start();
    return true;
  }

  function running() {
    return Boolean(context && context.state === 'running' && master);
  }

  function resumeSafely() {
    try {
      if (context?.state === 'suspended') {
        const resumed = context.resume();
        if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {});
      }
    } catch {
      // A device can disappear or deny resumption; the game remains fully playable in silence.
    }
  }

  function silenceHorn() {
    if (!context || !hornGain) return;
    try {
      const now = context.currentTime;
      hornGain.gain.cancelScheduledValues(now);
      hornGain.gain.setValueAtTime(0, now);
    } catch {
      // Ignore a closed context during teardown.
    }
    stallActive = false;
  }

  function start() {
    if (context && context.state === 'closed') {
      started = false;
      context = null;
      master = null;
    }
    if (!started) {
      try {
        started = buildGraph();
      } catch {
        started = false;
        try { context?.close(); } catch { /* no device to close */ }
        context = null;
        master = null;
      }
    }
    resumeSafely();
    return started;
  }

  function updateFlight(state) {
    if (!running()) {
      stallActive = false;
      return;
    }
    const throttle = clamp01(state?.throttle);
    const speed = Math.max(0, Number(state?.speed) || 0);
    const damage = Math.max(0, Math.min(100, Number(state?.damage) || 0));
    const frequency = 55 + throttle * 165;
    engineA.frequency.value = frequency;
    engineB.frequency.value = frequency * 1.006;
    engineFilter.frequency.value = 280 + throttle * 1450 + speed * 7;
    engineGain.gain.value = (0.012 + throttle * 0.044) * (1 - damage / 260);
    propLfo.frequency.value = 18 + throttle * 64;
    propDepth.gain.value = 0.0015 + throttle * 0.007;
    windFilter.frequency.value = 420 + speed * 25;
    windGain.gain.value = Math.min(0.052, speed * speed * 0.0000065);
    stall(Boolean(state?.stall));
  }

  function tone(frequency, offset, duration, type, volume, endFrequency = 0) {
    if (!running() || isMuted) return;
    try {
      const now = context.currentTime + offset;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (endFrequency > 0) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.03);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {
      // One-shot sounds are optional; a rejected device must not interrupt the sortie.
    }
  }

  function noiseBurst(duration, volume, startFrequency, endFrequency, filterType = 'lowpass') {
    if (!running() || isMuted || !noiseBuffer) return;
    try {
      const now = context.currentTime;
      const source = context.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = context.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(startFrequency, now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + duration);
      const gain = context.createGain();
      gain.gain.setValueAtTime(Math.max(0.0002, volume), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(now);
      source.stop(now + duration + 0.03);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    } catch {
      // Silence is preferable to an uncaught audio-device error.
    }
  }

  function stall(on) {
    const audible = Boolean(on) && running() && !isMuted;
    if (!audible) {
      if (stallActive) silenceHorn();
      return;
    }
    const now = context.currentTime;
    if (!stallActive) {
      stallActive = true;
      nextBeep = now;
    }
    if (now >= nextBeep) {
      try {
        hornGain.gain.cancelScheduledValues(now);
        hornGain.gain.setValueAtTime(0.0001, now);
        hornGain.gain.linearRampToValueAtTime(0.045, now + 0.015);
        hornGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
        hornGain.gain.setValueAtTime(0, now + 0.17);
        nextBeep = now + 0.55;
      } catch {
        stallActive = false;
      }
    }
  }

  const audio = {
    start,
    updateFlight,
    ring() {
      tone(740, 0, 0.2, 'sine', 0.12);
      tone(988, 0.095, 0.28, 'sine', 0.1);
    },
    touchdown(grade) {
      const volume = grade === 'PERFECT' ? 0.12 : grade === 'GOOD' ? 0.15 : 0.2;
      noiseBurst(0.24, volume, 1900, 280, 'bandpass');
      tone(92, 0, 0.42, 'sine', volume * 1.25, 42);
    },
    crash() {
      noiseBurst(0.9, 0.42, 1800, 65, 'lowpass');
      tone(155, 0, 1.05, 'sine', 0.28, 29);
    },
    stall,
    get muted() {
      return isMuted;
    },
    set muted(value) {
      isMuted = Boolean(value);
      if (master && context) {
        try {
          const now = context.currentTime;
          master.gain.cancelScheduledValues(now);
          master.gain.setTargetAtTime(isMuted ? 0 : 0.78, now, 0.025);
        } catch {
          // The graph may have been closed by the browser.
        }
      }
      if (isMuted) silenceHorn();
    },
  };
  return audio;
}
