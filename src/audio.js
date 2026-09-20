// Audio capture: MediaRecorder (webm/opus, or mp4 on iOS) + a live analyser
// feeding the waveform. The recorded blob is uploaded and stored as-is —
// no WAV conversion. Recording ends ONLY when the user stops it — or when
// the hard cap is reached. No silence auto-stop: thinking pauses are allowed.

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
    return this.startedAt ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  async #teardown() {
    this.stopped = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.ctx && this.ctx.state !== "closed") await this.ctx.close().catch(() => {});
  }

  async stop() {
    // start() may still be awaiting mic permission — nothing to stop yet
    if (!this.recorder) {
      await this.#teardown();
      throw new Error("The microphone was still starting. Give it a second and try again.");
    }
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
// REMOVED 2026-09-20: Cohere accepts the recorded container directly and it is
// ~10x smaller — the WAV round-trip added 20-100s of upload on mobile uplinks.

export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(1, "0")}:${String(s % 60).padStart(2, "0")}`;
}
