// Audio pipeline: MediaRecorder capture -> 16kHz mono WAV (what Cohere accepts),
// plus a live analyser feeding the waveform. Recording ends ONLY when the user
// stops it — or when the hard cap is reached. No silence auto-stop: thinking
// pauses are allowed.

export const MAX_RECORD_SECONDS = 180; // 3 minutes per voice note

export class Recorder {
  constructor() {
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.ctx = null;
    this.analyser = null;
    this.raf = null;
    this.startedAt = 0;
    this.stopped = false;
    this.onLevel = null;   // (level 0..1) => void
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
      .find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    src.connect(this.analyser);

    this.startedAt = performance.now();
    this.stopped = false;
    this.recorder.start(250);
    this.#loop();
  }

  #loop() {
    if (this.stopped) return;
    const buf = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128) / 128);
    this.onLevel?.(Math.min(1, peak * 1.6));
    this.raf = requestAnimationFrame(() => this.#loop());
  }

  duration() {
    return (performance.now() - this.startedAt) / 1000;
  }

  async #teardown() {
    this.stopped = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx && this.ctx.state !== "closed") await this.ctx.close().catch(() => {});
  }

  async stop() {
    const done = new Promise((resolve) => { this.recorder.onstop = () => resolve(); });
    this.recorder.stop();
    await done;
    await this.#teardown();
    return new Blob(this.chunks, { type: this.recorder.mimeType || "audio/webm" });
  }

  async discard() {
    try { this.recorder.state !== "inactive" && this.recorder.stop(); } catch { /* already stopped */ }
    await this.#teardown();
  }
}

// Converts any recorded blob to 16kHz mono 16-bit WAV via decode + OfflineAudioContext.
export async function toWav(blob) {
  const arr = await blob.arrayBuffer();
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await ac.decodeAudioData(arr.slice(0));
  await ac.close().catch(() => {});
  const sr = 16000;
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * sr)), sr);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  const ch = rendered.getChannelData(0);

  const header = BufferLike(44 + ch.length * 2);
  const dv = new DataView(header);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); dv.setUint32(4, 36 + ch.length * 2, true); ws(8, "WAVE");
  ws(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  ws(36, "data"); dv.setUint32(40, ch.length * 2, true);
  for (let i = 0; i < ch.length; i++) {
    const v = Math.max(-1, Math.min(1, ch[i]));
    dv.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([header], { type: "audio/wav" });
}

function BufferLike(size) {
  return new ArrayBuffer(size);
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(1, "0")}:${String(s % 60).padStart(2, "0")}`;
}
