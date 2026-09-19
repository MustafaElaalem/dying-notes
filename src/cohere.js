// Cohere client. All calls route through our Cloudflare Worker (dying-notes-api),
// which holds the key server-side, origin-locks the PWA, and rate-limits.
// There is no API key in this app, anywhere.
const WORKER = "https://dying-notes-api.mostafa-elaalem.workers.dev";
const LANG_STORAGE = "noted.lang";

// Arabic transcribe model: Arabic-first, handles English and code-switched
// Arabic/English speech. The `language` hint (from Settings) still guides decoding.
const TRANSCRIBE_MODEL = "cohere-transcribe-arabic-07-2026";
const TIDY_MODEL = "command-r7b-arabic-02-2025"; // Arabic-first, strong English too

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
  const res = await fetch(`${WORKER}/transcribe`, { method: "POST", body: fd });
  if (!res.ok) throw await cohereError(res);
  const j = await res.json();
  return (j.text || "").trim();
}

const TIDY_PROMPT = `You tidy raw voice-note transcripts and must honor the speaker's intent. Reply with ONLY a JSON object, no markdown fences. EVERY string you output (title, body, each task) MUST be in the same language as the transcript: an English transcript gets English tasks, an Arabic transcript gets Arabic tasks. Keys:
{"title": string (max 6 words, or "" if nothing fits), "body": string (the transcript cleaned up: fix filler words, punctuation, spacing; keep the speaker's meaning and language; "" if it was purely a task list), "tasks": string[] , "intent": "task" | "note"}
Intent rules:
- If the speaker expresses intent to create tasks, todos, a list, or reminders (e.g. "I want to create a task", "remind me to...", "add to my list", "I need to...", Arabic equivalents like "أريد إنشاء مهام", "ذكرني", "خاصني ندير", "عندي أشياء خاصني نديرهم"), set intent "task": put each actionable item in tasks as a short imperative phrase, and leave body "" if the whole utterance was the list.
- If the utterance is a thought, memory, or information with no to-do intent (even if it mentions actions in passing), set intent "note" and tasks MUST be [].
Transcript:`;

export async function tidy(transcript) {
  const res = await fetch(`${WORKER}/tidy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: `${TIDY_PROMPT}\n${transcript}` })
  });
  if (!res.ok) throw await cohereError(res);
  const j = await res.json();
  const text = (j.message?.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  return parseTidy(text, transcript);
}

// ---- JEV intent routing (docs/jev-plan.md) ----
// The Worker classifies the transcript (note_kind + language + has_deadline).
// Returns null on any failure — callers fall back to the combined prompt above.

export async function classify(transcript, inputMode = "voice") {
  try {
    const res = await fetch(`${WORKER}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, input_mode: inputMode })
    });
    if (!res.ok) return null;
    const j = await res.json();
    const a = j.answers || {};
    return {
      noteKind: a.note_kind?.choice || null,
      confidence: a.note_kind?.confidence ?? 0,
      probabilities: a.note_kind?.probabilities || {},
      language: a.language?.choice || null,
      hasDeadline: a.has_deadline?.noul ?? null
    };
  } catch { return null; }
}

const LANG_LINE = (lang) =>
  lang === "mixed" ? "Arabic-English code-switched is fine; keep each phrase in its own language."
  : lang === "en" ? "English."
  : "Arabic.";

const LIST_PROMPT = (lang) => `The speaker intended a to-do list. Extract every item to do as a short imperative phrase. Reply with ONLY JSON: {"title": string (max 6 words), "tasks": string[]}. Write everything in ${LANG_LINE(lang)} Transcript:`;

const PROSE_PROMPT = (lang) => `The speaker is recording a thought or information — NOT a to-do list. Clean it up (filler words, punctuation, spacing) and keep their meaning. Reply with ONLY JSON: {"title": string (max 6 words), "body": string}. Do NOT output any tasks. Write everything in ${LANG_LINE(lang)} Transcript:`;

const HYBRID_PROMPT = (lang) => `The speaker recorded meaningful prose that also contains explicit to-do items. Reply with ONLY JSON: {"title": string (max 6 words), "body": string (the prose, cleaned up — do NOT put the to-do items in the body), "tasks": string[] (each explicit item as a short imperative phrase)}. Write everything in ${LANG_LINE(lang)} Transcript:`;

async function formatWith(prompt, transcript) {
  const res = await fetch(`${WORKER}/tidy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) throw await cohereError(res);
  const j = await res.json();
  const text = (j.message?.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  return parseTidy(text, transcript, { allowEmptyBody: true });
}

export const formatList = (transcript, lang) => formatWith(LIST_PROMPT(lang), transcript);
export const formatProse = (transcript, lang) => formatWith(PROSE_PROMPT(lang), transcript);
export const formatHybrid = (transcript, lang) => formatWith(HYBRID_PROMPT(lang), transcript);

function parseTidy(text, fallback, { allowEmptyBody = false } = {}) {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const o = JSON.parse(m[0]);
      // intent "note" forces tasks empty regardless of what the model listed
      const tasks = (o.intent === "note" || !Array.isArray(o.tasks))
        ? []
        : o.tasks.filter((t) => typeof t === "string" && t.trim()).map((t) => ({ text: t.trim(), done: false }));
      const body = typeof o.body === "string" && o.body.trim() ? o.body : (allowEmptyBody ? "" : fallback);
      return {
        title: typeof o.title === "string" ? o.title : "",
        body,
        tasks
      };
    }
  } catch { /* fall through */ }
  return { title: "", body: fallback, tasks: [] };
}
