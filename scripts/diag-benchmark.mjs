// Multi-model benchmark for the /structure slot, against local wrangler dev --remote.
// REQUIRES the worker's temporary benchmark passthrough in /structure
// (model/reasoning read from the request body) — re-add it locally, never deploy it.
// For each candidate: find a reasoning config that returns valid JSON (default ->
// off -> effort:low), then time 2 calls. Usage: node scripts/diag-benchmark.mjs
// Follow up with: node scripts/eval-structure.mjs http://127.0.0.1:8799 <model> <off|low|default>
// (restart wrangler dev between 40-case evals — the worker rate-limits 60 req/5min).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REQ = path.join(HERE, "diag-req.json");
const RESP = path.join(HERE, "diag-resp.json");
const transcript = JSON.parse(readFileSync(path.join(HERE, "diag-body.json"))).transcript;

const CANDIDATES = [
  "inclusionai/ling-3.0-flash",
  "mistralai/mistral-nemo",
  "qwen/qwen3.7-flash",
  "openai/gpt-oss-20b",
  "deepseek/deepseek-v4-flash",
  "inception/mercury-2.5",
  "qwen/qwen3-30b-a3b-instruct-2507",
  "z-ai/glm-4.7-flash",
  "google/gemini-2.5-flash-lite",
];

const CONFIGS = [["default", undefined], ["off", { enabled: false }], ["effort:low", { effort: "low" }]];

function call(model, reasoning) {
  const body = { transcript, input_mode: "voice", model };
  if (reasoning !== undefined) body.reasoning = reasoning;
  writeFileSync(REQ, JSON.stringify(body));
  const r = spawnSync("curl", ["-s", "--max-time", "60", "-X", "POST", "-H", "Origin: http://localhost:5173",
    "-H", "Content-Type: application/json", "--data-binary", "@" + REQ,
    "-o", RESP, "-w", "%{time_total}", "http://127.0.0.1:8799/structure"], { stdio: "pipe" });
  if (r.status !== 0) return { err: "curl " + r.status };
  let j; try { j = JSON.parse(readFileSync(RESP, "utf8")); } catch { return { err: "bad json file" }; }
  if (j.error) return { err: j.error.code + " " + j.error.message.slice(0, 60) };
  const c = j.choices?.[0]?.message?.content || "";
  const m = c.match(/\{[\s\S]*\}/);
  if (!m) return { secs: r.stdout.toString().trim(), rtokens: j.usage?.completion_tokens_details?.reasoning_tokens, nojson: true };
  try {
    const o = JSON.parse(m[0]);
    return { secs: r.stdout.toString().trim(), intent: o.intent, tasks: (o.tasks || []).length, title: (o.title || "").slice(0, 24) };
  } catch { return { secs: r.stdout.toString().trim(), nojson: "BAD" }; }
}

for (const model of CANDIDATES) {
  console.log("== " + model + " ==");
  let won = null, wonCfg = null;
  for (const [name, cfg] of CONFIGS) {
    const r = call(model, cfg);
    if (r.err) { console.log(`  ${name}: ERR ${r.err}`); continue; }
    if (r.nojson) { console.log(`  ${name}: ${r.secs}s NO-JSON (rtokens=${r.rtokens ?? "-"})`); continue; }
    console.log(`  ${name}: ${r.secs}s OK intent=${r.intent} tasks=${r.tasks} "${r.title}"`);
    won = r; wonCfg = name; break;
  }
  if (won) {
    const r2 = call(model, CONFIGS.find(([n]) => n === wonCfg)[1]);
    if (r2.secs && !r2.nojson && !r2.err) console.log(`  ^ config ${wonCfg}: ${won.secs}s / ${r2.secs}s`);
  } else {
    console.log("  => no working config");
  }
}
unlinkSync(REQ); unlinkSync(RESP);
