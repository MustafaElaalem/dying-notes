// One-off model probe against local wrangler dev --remote (port 8799).
// Usage: node scripts/diag-model-probe.mjs
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REQ = path.join(HERE, "diag-req.json");
const RESP = path.join(HERE, "diag-resp.json");
const transcript = JSON.parse(readFileSync(path.join(HERE, "diag-body.json"))).transcript;

const VARIANTS = [
  ["glm-5.3-flash effort:low", "z-ai/glm-5.3-flash", { effort: "low" }, 1000],
  ["glm-5.3-flash effort:minimal", "z-ai/glm-5.3-flash", { effort: "minimal" }, 1000],
  ["glm-5.3-flashx default", "z-ai/glm-5.3-flashx", null, 1000],
  ["glm-5.3-flashx reasoning-off", "z-ai/glm-5.3-flashx", { enabled: false }, 1000],
  ["glm-5.3-flash effort:low +4k tok", "z-ai/glm-5.3-flash", { effort: "low" }, 4000],
];

for (const [label, model, reasoning, maxTokens] of VARIANTS) {
  const body = { transcript, input_mode: "voice", model, max_tokens: maxTokens };
  if (reasoning) body.reasoning = reasoning;
  writeFileSync(REQ, JSON.stringify(body));
  console.log("== " + label + " ==");
  for (let i = 1; i <= 2; i++) {
    const t0 = Date.now();
    const r = spawnSync("curl", ["-s", "-X", "POST", "-H", "Origin: http://localhost:5173",
      "-H", "Content-Type: application/json", "--data-binary", "@" + REQ,
      "-o", RESP, "-w", "%{time_total}", "http://127.0.0.1:8799/structure"], { stdio: "pipe" });
    if (r.status !== 0) { console.log("  curl fail", r.stderr + ""); continue; }
    const secs = r.stdout.toString().trim();
    let j;
    try { j = JSON.parse(readFileSync(RESP, "utf8")); } catch { console.log("  bad response file"); continue; }
    if (j.error) { console.log(`  ${secs}s ERR ${j.error.code} ${j.error.message.slice(0, 70)}`); continue; }
    const c = j.choices?.[0]?.message?.content || "";
    const m = c.match(/\{[\s\S]*\}/);
    let q = "NO-JSON";
    if (m) { try { const o = JSON.parse(m[0]); q = `intent=${o.intent} tasks=${(o.tasks || []).length} title="${(o.title || "").slice(0, 22)}"`; } catch { q = "BAD-JSON"; } }
    console.log(`  run${i} ${secs}s ${q} rtokens=${j.usage?.completion_tokens_details?.reasoning_tokens ?? "-"}`);
  }
}
unlinkSync(REQ); unlinkSync(RESP);
