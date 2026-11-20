/* NEXUS Spracheingabe: Mikrofon -> Sprachsegmente (Pausenerkennung) -> WAV 16 kHz mono -> Erkennung im Backend.
   Die reinen Funktionen sind in Node testbar (tests/unit.test.cjs). */
(function (root) {
  'use strict';
  const RATE = 16000;

  function rms(samples) {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / Math.max(1, samples.length));
  }

  // Mittelt jeweils ein Fenster Eingangswerte zu einem Ausgangswert (einfacher Tiefpass, fuer Sprache ausreichend).
  function downsample(samples, inRate, outRate) {
    outRate = outRate || RATE;
    if (inRate <= outRate) return Float32Array.from(samples);
    const ratio = inRate / outRate, outLen = Math.floor(samples.length / ratio), out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const start = Math.floor(i * ratio), end = Math.min(samples.length, Math.floor((i + 1) * ratio));
      let sum = 0;
      for (let j = start; j < end; j++) sum += samples[j];
      out[i] = sum / Math.max(1, end - start);
    }
    return out;
  }

  function encodeWav(samples, rate) {
    rate = rate || RATE;
    const n = samples.length, view = new DataView(new ArrayBuffer(44 + n * 2));
    const text = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
    text(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, samples[i])); view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); }
    return new Uint8Array(view.buffer);
  }

  function silentWav(seconds) { return encodeWav(new Float32Array(Math.round(RATE * (seconds || 1))), RATE); }

  // Teilt den Audiostrom anhand der Lautstaerke in Aeusserungen. Die Ruhe-Schwelle wird aus den ersten ~0,4 s gelernt.
  class Segmenter {
    constructor(options) {
      this.o = Object.assign({ minSpeechMs: 200, silenceMs: 1100, maxMs: 30000, preRollMs: 300, minThreshold: 0.012, noiseFactor: 3, calibrationMs: 400 }, options || {});
      this.reset();
    }
    reset() { this.noise = Infinity; this.calibMs = 0; this.threshold = this.o.minThreshold; this.calibrated = false; this.discard(); }
    discard() { this.state = 'idle'; this.pre = []; this.preMs = 0; this.buf = []; this.speechMs = 0; this.quietMs = 0; this.totalMs = 0; }
    feed(frame) {
      const ms = frame.length / (RATE / 1000), level = rms(frame), o = this.o;
      if (!this.calibrated) {
        this.noise = Math.min(this.noise, level); this.calibMs += ms;
        if (this.calibMs >= o.calibrationMs) { this.calibrated = true; this.threshold = Math.max(o.minThreshold, this.noise * o.noiseFactor); }
        return { event: 'none', level };
      }
      if (this.state === 'idle') {
        if (level > this.threshold) {
          this.state = 'speech'; this.buf = this.pre.slice(); this.buf.push(frame);
          this.pre = []; this.preMs = 0; this.speechMs = ms; this.quietMs = 0; this.totalMs = ms;
          return { event: 'speech-start', level };
        }
        this.noise = this.noise * 0.95 + level * 0.05; this.threshold = Math.max(o.minThreshold, this.noise * o.noiseFactor);
        this.pre.push(frame); this.preMs += ms;
        while (this.preMs > o.preRollMs && this.pre.length > 1) this.preMs -= this.pre.shift().length / (RATE / 1000);
        return { event: 'none', level };
      }
      this.buf.push(frame); this.totalMs += ms;
      if (level > this.threshold) { this.speechMs += ms; this.quietMs = 0; } else this.quietMs += ms;
      if (this.quietMs >= o.silenceMs || this.totalMs >= o.maxMs) {
        const enough = this.speechMs >= o.minSpeechMs;
        let length = 0; for (const f of this.buf) length += f.length;
        const samples = new Float32Array(length); let at = 0; for (const f of this.buf) { samples.set(f, at); at += f.length; }
        this.discard();
        return enough ? { event: 'utterance', samples, level } : { event: 'discard', level };
      }
      return { event: 'none', level };
    }
  }

  // Whisper erfindet bei Stille oder Rauschen gern Phrasen. Solche Ergebnisse werden verworfen.
  function cleanTranscript(text) {
    let t = String(text == null ? '' : text).replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|[\u266A\u266B]/g, ' ').replace(/\s+/g, ' ').trim();
    if (t.length < 2 || !/[A-Za-z\u00C0-\u024F0-9]/.test(t)) return '';
    const junk = [/^untertitel/i, /amara\.org/i, /^(vielen )?dank(e)? f\u00FCrs zuschauen/i, /^copyright /i, /^musik\.?$/i, /^thanks for watching/i];
    return junk.some(rx => rx.test(t)) ? '' : t;
  }

  async function openMicrophone(onFrame) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const AC = root.AudioContext || root.webkitAudioContext, ctx = new AC();
    const source = ctx.createMediaStreamSource(stream), processor = ctx.createScriptProcessor(4096, 1, 1), mute = ctx.createGain();
    mute.gain.value = 0;
    processor.onaudioprocess = e => onFrame(downsample(e.inputBuffer.getChannelData(0), ctx.sampleRate, RATE));
    source.connect(processor); processor.connect(mute); mute.connect(ctx.destination);
    if (ctx.state === 'suspended') await ctx.resume();
    return { stop() { try { processor.disconnect(); source.disconnect(); mute.disconnect(); } catch (_) {} stream.getTracks().forEach(t => t.stop()); ctx.close().catch(() => {}); } };
  }

  // Verbindet Mikrofon, Pausenerkennung und Erkennung. Waehrend NEXUS antwortet (isPaused) oder erkennt, wird nichts aufgenommen.
  function createController(opts) {
    const transcribe = opts.transcribe, onState = opts.onState || (() => {}), onText = opts.onText || (() => {});
    const onError = opts.onError || (() => {}), onFatal = opts.onFatal || (() => {}), isPaused = opts.isPaused || (() => false);
    const segmenter = new Segmenter(opts.segmenter);
    let mic = null, running = false, inFlight = false, errors = 0;
    async function handle(samples) {
      inFlight = true; onState('transcribing');
      try {
        const text = await transcribe(encodeWav(samples, RATE));
        errors = 0; inFlight = false;
        if (running) { onState('listening'); onText(text); }
      } catch (e) {
        inFlight = false; errors++;
        if (!running) return;
        if (errors >= 3) onFatal(e); else { onError(e); onState('listening'); }
      }
    }
    function onFrame(frame) {
      if (!running) return;
      if (isPaused() || inFlight) { segmenter.discard(); return; }
      const r = segmenter.feed(frame);
      if (r.event === 'speech-start') onState('speech');
      else if (r.event === 'utterance') handle(r.samples);
      else if (r.event === 'discard') onState('listening');
    }
    return {
      async start() { running = true; errors = 0; segmenter.reset(); mic = await (opts.openMic || api.openMicrophone)(onFrame); onState('listening'); },
      stop() { running = false; if (mic) mic.stop(); mic = null; segmenter.reset(); },
      get running() { return running; }
    };
  }

  const api = { RATE, rms, downsample, encodeWav, silentWav, Segmenter, cleanTranscript, openMicrophone, createController };
  root.NexusVoice = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
