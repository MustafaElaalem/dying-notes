// Timing harness for the "mobile PWA slow while structuring" bug.
// Times each step of the deployed pipeline separately:
//   /structure (small JSON POST -> OpenRouter DeepSeek)
//   /transcribe (WAV upload -> Cohere), unthrottled and with mobile-uplink emulation
// HTTP goes through curl (Node fetch is flaky against these APIs in this env).
// Usage: node scripts/diag-pipeline.mjs [--skip-fixture]

import { spawnSync } from "node:child_process";
import { existsSync, statSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const WORKER = "https://dying-notes-api.mostafa-elaalem.workers.dev";
const ORIGIN = "https://mustafaelaalem.github.io";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHORT_WAV = path.join(HERE, "diag-fixture-20s.wav");
const LONG_WAV = path.join(HERE, "diag-fixture-180s.wav");
const SHORT_WEBM = path.join(HERE, "diag-fixture-20s.webm");
const LONG_WEBM = path.join(HERE, "diag-fixture-180s.webm");

// --- fixture: PowerShell SAPI -> 16kHz 16-bit mono WAV speech ---
const SENTENCE =
  "Note to self. Buy olive bread on the way home, and call the dentist tomorrow morning. " +
  "The meeting notes from today say the launch is postponed to next Friday. " +
  "I should water the plants before the weekend.";

function makeFixture(file, repeats) {
  const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile("${file.replace(/\\/g, "\\\\")}", $fmt)
$s.Rate = 0
${Array.from({ length: repeats }, () => `$s.Speak("${SENTENCE}")`).join("\n")}
$s.Dispose()
`;
  const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "pipe" });
  if (r.status !== 0) throw new Error("SAPI fixture failed: " + r.stderr.toString());
}

function curl(args, timeoutMs = 150_000) {
  const t0 = Date.now();
  const r = spawnSync("curl", ["-s", "-o", "NUL", "--max-time", String(Math.round(timeoutMs / 1000)), ...args], { stdio: "pipe" });
  const wall = (Date.now() - t0) / 1000;
  if (r.status !== 0) return { ok: false, wall, err: (r.stderr + "").trim() || `curl exit ${r.status}` };
  return { ok: true, wall };
}

function curlJSON(url, bodyFile, label) {
  // 3 retries on transport flakiness (HTTP 000 etc.)
  for (let i = 1; i <= 3; i++) {
    const r = curl(["-X", "POST", "-H", `Origin: ${ORIGIN}`, "-H", "Content-Type: application/json", "--data-binary", `@${bodyFile}`, url]);
    if (r.ok) return r;
    console.log(`  ${label}: attempt ${i} failed (${r.err}), retrying...`);
  }
  return { ok: false, wall: NaN, err: "all attempts failed" };
}

function fmtMb(bytes) { return (bytes / 1024 / 1024).toFixed(2) + " MB"; }

const results = [];
function record(step, detail, wall) { results.push({ step, detail, wall }); console.log(String(wall).padStart(8) + "s  " + step + "  " + detail); }

console.log("== dying-notes pipeline timing ==");
console.log("worker: " + WORKER + "\n");

// health
const h = curl(["-H", `Origin: ${ORIGIN}`, `${WORKER}/health`]);
console.log(h.ok ? "health: OK" : "health: FAILED " + h.err);
if (!h.ok) process.exit(1);

// --- /structure: small JSON POST, desktop network, 5 samples ---
console.log("\n-- /structure (structure model via OpenRouter, ~1KB body, 5 calls) --");
const bodyFile = path.join(HERE, "diag-body.json");
if (!existsSync(bodyFile) || process.argv.includes("--refresh-body")) {
  const transcript =
    "خاصني نشري الخبز فالطريق للدار و نعيط للطبيب غدا فالصباح. " +
    "خطرت بالبالي بلي الاجتماع تأجل للجمعة القادمة " +
    "وعندي أفكار جديدة للمشروع بغيت نكتبهم قبل ما نساههم.";
  const { writeFileSync } = await import("node:fs");
  writeFileSync(bodyFile, JSON.stringify({ transcript, input_mode: "voice" }));
}
const sTimes = [];
for (let i = 0; i < 5; i++) {
  const r = curlJSON(`${WORKER}/structure`, bodyFile, `structure#${i + 1}`);
  if (!r.ok) { record("structure", "FAILED " + r.err, NaN); break; }
  sTimes.push(r.wall);
  record("structure", `call ${i + 1}/5`, r.wall);
}

// --- fixtures: SAPI WAV, then transcode to webm/opus (what the app uploads) ---
if (!process.argv.includes("--skip-fixture")) {
  if (!existsSync(SHORT_WAV)) { console.log("\ngenerating 20s speech fixture..."); makeFixture(SHORT_WAV, 2); }
  if (!existsSync(LONG_WAV)) { console.log("generating 180s speech fixture (SAPI, slow)..."); makeFixture(LONG_WAV, 16); }
  for (const [wav, webm] of [[SHORT_WAV, SHORT_WEBM], [LONG_WAV, LONG_WEBM]]) {
    if (!existsSync(webm)) {
      const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", wav, "-c:a", "libopus", "-b:a", "24k", webm], { stdio: "pipe" });
      if (r.status !== 0) throw new Error("ffmpeg transcode failed: " + r.stderr);
    }
  }
}
for (const f of [SHORT_WAV, LONG_WAV]) {
  if (!existsSync(f)) { console.log("missing fixture " + f + " (rerun without --skip-fixture)"); process.exit(1); }
  console.log(`fixture ${path.basename(f)}: ${fmtMb(statSync(f).size)} (~${Math.round(statSync(f).size / 32000)}s)`);
}

// --- /transcribe: webm (production path) unthrottled + mobile emulation ---
console.log("\n-- /transcribe (webm upload -> Cohere) --");
for (const [label, file] of [["20s webm", SHORT_WEBM], ["180s webm", LONG_WEBM]]) {
  const r = curl(["-X", "POST", "-H", `Origin: ${ORIGIN}`,
    "-F", "model=cohere-transcribe-arabic-07-2026", "-F", "language=ar",
    "-F", `file=@${file};type=audio/webm;filename=note.webm`, `${WORKER}/transcribe`]);
  if (!r.ok) { record("transcribe", `${label} FAILED ${r.err}`, NaN); continue; }
  record("transcribe", `${label} unthrottled`, r.wall);
}

console.log("\n-- /transcribe, mobile-uplink emulation --");
// 256KB/s ≈ 2 Mbps (good 4G up), 64KB/s ≈ 0.5 Mbps (weak mobile uplink)
for (const rate of ["256K", "64K"]) {
  const r = curl(["-X", "POST", "-H", `Origin: ${ORIGIN}`,
    "--limit-rate", rate,
    "-F", "model=cohere-transcribe-arabic-07-2026", "-F", "language=ar",
    "-F", `file=@${LONG_WEBM};type=audio/webm;filename=note.webm`, `${WORKER}/transcribe`], 300_000);
  if (!r.ok) { record("transcribe", `180s webm @${rate}/s FAILED ${r.err}`, NaN); continue; }
  record("transcribe", `180s webm @${rate}/s`, r.wall);
}

// --- summary ---
console.log("\n== summary ==");
if (sTimes.length) {
  const sorted = [...sTimes].sort((a, b) => a - b);
  const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  console.log(`structure: min ${sorted[0].toFixed(1)}s  p50 ${p(0.5).toFixed(1)}s  max ${sorted[sorted.length - 1].toFixed(1)}s  (n=${sTimes.length})`);
}
const un = results.find((r) => r.step === "transcribe" && r.detail === "180s webm unthrottled");
for (const rate of ["256K", "64K"]) {
  const th = results.find((r) => r.step === "transcribe" && r.detail === `180s webm @${rate}/s`);
  if (un && th && Number.isFinite(un.wall) && Number.isFinite(th.wall))
    console.log(`transcribe 180s webm @${rate}/s: ${th.wall.toFixed(1)}s total, +${(th.wall - un.wall).toFixed(1)}s upload cost vs desktop`);
}

// machine-readable for later gating
const { writeFileSync } = await import("node:fs");
writeFileSync(path.join(HERE, "diag-results.json"), JSON.stringify(results, null, 2));
console.log("\nresults -> scripts/diag-results.json");
