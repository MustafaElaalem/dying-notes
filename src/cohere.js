// Cohere client. The API key lives in localStorage on this device only,
// entered in Settings. It is never bundled or committed.
const BASE = "https://api.cohere.com";
const KEY_STORAGE = "noted.cohere.key";
const LANG_STORAGE = "noted.lang";

const TRANSCRIBE_MODEL = "cohere-transcribe-03-2026";
const TIDY_MODEL = "command-r7b-arabic-02-2025"; // Arabic-first, strong English too

export const getKey = () => localStorage.getItem(KEY_STORAGE) || "";
export const setKey = (k) => localStorage.setItem(KEY_STORAGE, k.trim());
export const hasKey = () => getKey().length > 10;
export const getLang = () => localStorage.getItem(LANG_STORAGE) || "ar";
export const setLang = (l) => localStorage.setItem(LANG_STORAGE, l);

async function cohereError(res) {
  let msg = `Cohere ${res.status}`;
  try {
    const j = await res.json();
    if (j.message) msg = j.message;
  } catch { /* keep status text */ }
  return new Error(msg);
}

// audio: Blob (WAV, 16kHz mono). lang: "ar" | "en".
// Contract (verified live): POST /v1/audio/transcriptions, multipart,
// model and language fields MUST come before the file part.
export async function transcribe(audioBlob, lang = "ar") {
  const fd = new FormData();
  fd.append("model", TRANSCRIBE_MODEL);
  fd.append("language", lang);
  fd.append("file", audioBlob, "note.wav");
  const res = await fetch(`${BASE}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getKey()}` },
    body: fd
  });
  if (!res.ok) throw await cohereError(res);
  const j = await res.json();
  return (j.text || "").trim();
}

const TIDY_PROMPT = `You tidy raw voice-note transcripts. Reply with ONLY a JSON object, no markdown fences, in the SAME language as the transcript (Arabic or English), with exactly these keys:
{"title": string (max 6 words, or "" if nothing fits), "body": string (the transcript cleaned up: fix filler words, punctuation, spacing; keep the speaker's meaning and language), "tasks": string[] (short actionable items extracted from it; [] if none)}
Transcript:`;

export async function tidy(transcript) {
  const res = await fetch(`${BASE}/v2/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TIDY_MODEL,
      temperature: 0.3,
      max_tokens: 800,
      messages: [{ role: "user", content: `${TIDY_PROMPT}\n${transcript}` }]
    })
  });
  if (!res.ok) throw await cohereError(res);
  const j = await res.json();
  const text = (j.message?.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  return parseTidy(text, transcript);
}

function parseTidy(text, fallbackTranscript) {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const o = JSON.parse(m[0]);
      return {
        title: typeof o.title === "string" ? o.title : "",
        body: typeof o.body === "string" && o.body.trim() ? o.body : fallbackTranscript,
        tasks: Array.isArray(o.tasks) ? o.tasks.filter((t) => typeof t === "string" && t.trim()).map((t) => ({ text: t.trim(), done: false })) : []
      };
    }
  } catch { /* fall through */ }
  return { title: "", body: fallbackTranscript, tasks: [] };
}
