// dying-notes API proxy (Cloudflare Worker, zero dependencies).
// Keeps the Cohere key server-side, locks calls to the PWA's origin,
// rate-limits, and structures notes via OpenRouter DeepSeek (/structure).

const COHERE = "https://api.cohere.com";
const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
const DEEPSEEK = "deepseek/deepseek-v4.1-flash";
const TIDY_MODEL = "command-r7b-arabic-02-2025";
const RATE_LIMIT = 60;        // requests...
const RATE_WINDOW = 5 * 60;   // ...per 5 minutes per IP (isolate-memory, best effort)

// One general-purpose call classifies intent AND writes the note.
// Mixed intent (prose + tasks) is first-class; language of every output
// string must match the transcript.
const STRUCTURE_PROMPT = `You structure voice-note transcripts and must honor the speaker's intent. Reply with ONLY JSON, no markdown fences. EVERY string (title, body, each task) MUST be in the transcript's language. Keys: {"intent": "task" | "mixed" | "note" | "not_a_note", "title": string (max 6 words, "" if nothing fits), "body": string (the prose cleaned up: fix filler words, punctuation, spacing; "" if it was purely a task list), "tasks": string[] (short imperative phrases)}.
Rules:
- intent "task": essentially items to do (errands, reminders, lists, "I need to...", Arabic equivalents like "خاصني ندير", "أريد إنشاء مهام"). tasks filled, body "".
- intent "mixed": meaningful prose AND explicit to-do items. body keeps the prose WITHOUT the to-do items, tasks extracts them.
- intent "note": a thought, memory, or information with no to-do intent. tasks MUST be []. Never invent tasks that the speaker did not explicitly commit to doing.
- intent "not_a_note": filler words only, empty, or too little content to keep. Everything empty.
Transcript:`;

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

// Outbound AI calls get hard deadlines; a stalled upstream becomes a 504 the
// client can retry instead of an eternal wait.
async function fetchT(url, opts, ms) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
}

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
      const r = await fetchT(`${COHERE}/v1/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.COHERE_KEY}` },
        body: out
      }, 100_000);
      return new Response(r.body, { status: r.status, headers: { "Content-Type": "application/json", ...cors } });
    }

    if (url.pathname === "/tidy" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body.prompt !== "string" || body.prompt.length > 20_000) {
        return json({ error: "invalid body" }, 400, cors);
      }
      const r = await fetchT(`${COHERE}/v2/chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.COHERE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: TIDY_MODEL,
          temperature: 0.2,
          max_tokens: 800,
          messages: [{ role: "user", content: body.prompt }]
        })
      }, 60_000);
      return new Response(r.body, { status: r.status, headers: { "Content-Type": "application/json", ...cors } });
    }

    if (url.pathname === "/structure" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body.transcript !== "string" || !body.transcript.trim()) {
        return json({ error: "invalid body" }, 400, cors);
      }
      const r = await fetchT(OPENROUTER, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://mustafaelaalem.github.io/dying-notes",
          "X-Title": "dying-notes"
        },
        body: JSON.stringify({
          model: DEEPSEEK,
          temperature: 0.2,
          max_tokens: 1000,
          // v4.1-flash is a reasoning model: left on, it burns the whole
          // completion budget on thinking and never emits the JSON (measured:
          // 1000/1000 reasoning tokens, empty content, 10-40s). Disabling it
          // returns valid JSON in ~2s.
          reasoning: { enabled: false },
          messages: [{ role: "user", content: STRUCTURE_PROMPT + "\n" + body.transcript.slice(0, 6000) }]
        })
      }, 45_000);
      return new Response(r.body, { status: r.status, headers: { "Content-Type": "application/json", ...cors } });
    }

    return json({ error: "not found" }, 404, cors);
  }
};
