// dying-notes API proxy (Cloudflare Worker, zero dependencies).
// Keeps the Cohere key server-side, locks calls to the PWA's origin,
// and is the future seam for JEV intent routing (/classify).

const COHERE = "https://api.cohere.com";
const TIDY_MODEL = "command-r7b-arabic-02-2025";
const RATE_LIMIT = 30;        // requests...
const RATE_WINDOW = 5 * 60;   // ...per 5 minutes per IP (isolate-memory, best effort)

const buckets = new Map();

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...extra } });

function rateLimited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now() / 1000;
  const b = buckets.get(ip) || { count: 0, reset: now + RATE_WINDOW };
  if (now > b.reset) { b.count = 0; b.reset = now + RATE_WINDOW; }
  b.count++;
  buckets.set(ip, b);
  if (buckets.size > 10_000) buckets.clear(); // crude memory guard
  return b.count > RATE_LIMIT;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors || {} });
    if (!cors) return json({ error: "origin not allowed" }, 403);

    const url = new URL(request.url);

    if (url.pathname === "/health") return json({ ok: true }, 200, cors);
    if (rateLimited(request)) return json({ error: "slow down" }, 429, cors);

    if (url.pathname === "/transcribe" && request.method === "POST") {
      const form = await request.formData();
      const model = String(form.get("model") || "cohere-transcribe-arabic-07-2026");
      const language = String(form.get("language") || "ar");
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0 || file.size > 26 * 1024 * 1024) {
        return json({ error: "missing or oversized file" }, 400, cors);
      }
      // Contract (verified against Cohere): model and language MUST precede the file part.
      const out = new FormData();
      out.append("model", model);
      out.append("language", language);
      out.append("file", file, "note.wav");
      const r = await fetch(`${COHERE}/v1/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.COHERE_KEY}` },
        body: out
      });
      return new Response(r.body, { status: r.status, headers: { "Content-Type": "application/json", ...cors } });
    }

    if (url.pathname === "/tidy" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body.prompt !== "string" || body.prompt.length > 20_000) {
        return json({ error: "invalid body" }, 400, cors);
      }
      const r = await fetch(`${COHERE}/v2/chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.COHERE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: TIDY_MODEL,
          temperature: 0.2,
          max_tokens: 800,
          messages: [{ role: "user", content: body.prompt }]
        })
      });
      return new Response(r.body, { status: r.status, headers: { "Content-Type": "application/json", ...cors } });
    }

    return json({ error: "not found" }, 404, cors);
  }
};
