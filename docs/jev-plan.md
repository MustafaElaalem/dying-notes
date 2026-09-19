# JEV Integration Plan — Precise Routing for Note Structuring

Status: planned (awaiting JEV API key — waitlist at typesafe.ai).
Owner doc for wiring JEV into the note pipeline. Architecture context: the app
already routes all AI calls through the Cloudflare Worker (`worker/`), and
Cohere handles transcription (`cohere-transcribe-arabic-07-2026`) plus tidy/format
(`command-r7b-arabic-02-2025`).

## The problem today

One Cohere call classifies intent AND writes the note. Three known weaknesses:

1. **Binary intent.** The prompt knows `task` vs `note`. Real utterances are often
   mixed ("the garden was lovely, entrance 20 dirhams — oh, and I need to buy bread").
   The forced `tasks: []` on `note` intent drops embedded action items.
2. **No confidence.** When the classifier guesses, we act on the guess silently.
3. **No language detection.** The ar/en Settings toggle exists only because
   nothing in the pipeline can detect language per utterance.

JEV (System One) is built for exactly this layer: typed answers with calibrated
probabilities at 70–500ms, output tokens free. It does NOT generate text, so
Cohere keeps all writing duties. JEV routes; Cohere formats.

## The routing design

One JEV call per note (typed or voice), three independent questions evaluated
in parallel. Request shape (POST `https://api.typesafe.ai/v1/systemone`,
from the Worker's new `/classify` route — key stays server-side):

```json
{
  "model": "jev-latest",
  "state": {
    "transcript": "<raw transcript or typed text>",
    "input_mode": "voice",
    "user_language_setting": "ar",
    "app_purpose": "quick notes where every note has a lifespan (task lists, thoughts, mixed)"
  },
  "questions": {
    "note_kind": {
      "type": "choice",
      "instructions": "What kind of note does the speaker intend? This routes the note to its formatting handler.",
      "criteria": {
        "task_list": {
          "what": "Essentially items to do: errands, reminders, todos, shopping lists",
          "not_for": "Prose narration that merely mentions actions in passing",
          "examples": ["خاصني نشري الخبز و الحليب و نعيط على بابا", "remind me to call the dentist"]
        },
        "note_with_tasks": {
          "what": "Meaningful prose (memory, observation, info) plus at least one explicit item to do",
          "not_for": "Pure lists; pure narration without any to-do",
          "examples": ["الحديقة زوينة، الدخلة عشرين درهم، و خاصني نشري الخبز قبل الجمعة"]
        },
        "pure_note": {
          "what": "A thought, memory, or information with no to-do intent",
          "not_for": "Anything containing explicit items to do",
          "examples": ["wifi password is solstice2024", "التذكرة كانت عشرين درهم للشخص"]
        },
        "not_a_note": {
          "what": "Filler words only, empty, or too little content to be worth keeping",
          "not_for": "Short but meaningful notes",
          "examples": ["اه اه يعني"]
        }
      }
    },
    "language": {
      "type": "choice",
      "instructions": "The dominant language the note should be written in",
      "criteria": {
        "ar": "Arabic (any dialect)",
        "en": "English",
        "mixed": "Genuinely code-switched; both languages carry meaning"
      }
    },
    "has_deadline": {
      "type": "noul",
      "instructions": "The utterance states an explicit date, day, or time by which something must happen (e.g. 'before Friday', 'غدا', 'tomorrow at 9')."
    }
  }
}
```

Notes on the design, per TypeSafe guidance:

- `note_kind` criteria use structured `what` / `not_for` / `examples` objects —
  the `task_list` vs `note_with_tasks` boundary is where confusion will live.
- `has_deadline` is speculative: asked in the same call, consumed only when true.
  It does NOT gate anything today; it unlocks Phase 3.
- Questions are independent, so they ride one request. Cost is input-tokens only
  (~$0.042/M tokens; state is a few hundred tokens → ~$0.00002 per note).

## Pipeline (target)

```
input (voice → Cohere transcript | typed text)
  │
  ├─ JEV /classify  (1 call: note_kind + language + has_deadline)
  │
  ├─ confidence gate on note_kind:
  │    conf < 0.5  → today's combined Cohere prompt (never worse than current)
  │    conf ≥ 0.5  → dispatch to a specialized Cohere prompt:
  │        task_list       → list formatter (items only, no body)
  │        pure_note       → prose formatter (title + body, tasks forbidden)
  │        note_with_tasks → hybrid formatter (prose preserved AND tasks extracted)
  │        not_a_note      → skip Cohere; show "Nothing worth keeping" (new UX)
  │
  ├─ language: JEV answer replaces the hint when its confidence ≥ 0.5,
  │  else the user's setting stands (Settings toggle becomes an override)
  │
  └─ note assembled → existing review screen (lifespan picker unchanged)
```

`note_with_tasks` is the headline improvement: mixed utterances stop losing
their tasks. `not_a_note` kills junk notes from filler transcripts.

## Worker contract

New route in `worker/src/index.js`, same origin-lock + rate-limit as /transcribe:

```
POST /classify  { "transcript": string, "input_mode": "voice" | "typed" }
→ 200 { "note_kind": { "choice", "confidence", "probabilities" },
        "language":  { "choice", "confidence" },
        "has_deadline": { "noul" } }
→ 502 { "error": "jev unavailable" }   (client falls back to combined prompt)
```

JEV key: `npx wrangler secret put JEV_KEY` alongside `COHERE_KEY`.
Client: extend `src/cohere.js` (rename conceptually to `src/ai.js` if it helps)
with `classify(text, mode)`; on any error return `null` → caller uses fallback.

## Validation before shipping (required, not optional)

System One guarantees typed output, not truth — calibrate on our domain:

1. **Golden set**: 40 utterances, 10 per class, ar/en/mixed, including the
   adversarial cases we already tested this session (wifi password, garden
   memory, "خاصني نشري", "أريد إنشاء مهام", English task list) plus filler-only
   and single-task inputs. Script: `scripts/eval-jev.mjs` (mirrors the earlier
   `test-tidy-prompt` harness: build bodies locally, POST via curl, retry on
   transient 000s).
2. **Shadow mode first**: Phase 1 logs JEV routing next to the current combined
   prompt's behavior without acting on it. Compare on the golden set.
3. **Ship the gate only if** routing accuracy ≥ the combined prompt on the same
   set. Otherwise tune criteria wording first (cheap), threshold second.
4. Confidence thresholds (0.5 above) are starting points — measure the actual
   distribution on the golden set before locking them.

## Phases

- **Phase 0 (now, no key)**: this doc; join the waitlist. Optional small win:
  route typed input through the existing intent prompt so Text/Checklist
  creation paths get the same treatment voice notes already have.
- **Phase 1 (key arrives)**: Worker `/classify` + `JEV_KEY`; golden set; shadow
  logging. No user-facing change.
- **Phase 2**: confidence-gated dispatch to specialized prompts; auto language
  (Settings toggle demoted to override); `not_a_note` → "nothing worth keeping"
  state on the processing screen.
- **Phase 3 (speculative, measure first)**: `has_deadline > 0.7` triggers date
  extraction (JEV date-extraction cookbook pattern or Cohere) into a `dueAt`
  field → lifespan pre-selects to match the deadline, reminder chip on cards.
  Deadline-becomes-death-clock is the on-brand killer feature; validate
  extraction accuracy on Arabic date speech before promising it.

## Non-goals

- JEV does not transcribe and does not write notes — Cohere keeps both.
- No client-side JEV calls; everything through the Worker.
- No new Settings fields; the experience should need zero configuration.
