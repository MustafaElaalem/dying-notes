# dying notes

**Noted.** — a voice-first quick-notes PWA where every note has a lifespan.

> Mortal by default, immortal by choice. Say it out loud, it gets transcribed and tidied,
> and the note lives until it dies unless you make it immortal.

**Live app:** https://mustafaelaalem.github.io/dying-notes/

## How it works

1. Tap the mic, speak (Arabic, English, or code-switched between them), pause for two seconds to stop.
2. The clip is converted to 16 kHz WAV in your browser and sent to
   **Cohere Transcribe Arabic** (`cohere-transcribe-arabic-07-2026`).
3. An LLM pass (**Cohere, `command-r7b-arabic-02-2025`**) tidies the raw transcript:
   title, clean body, extracted tasks.
4. The note is saved to **IndexedDB (Dexie)** with a lifespan: 24h, 1 week, 1 month, or immortal.
5. A reaper marks expired notes dead. Dead notes grey out but can be revived.
   Pinning a note makes it immortal.

## The API key

The app needs your Cohere API key. Open **Settings** (avatar, top right) in the app and
paste it there. It is stored in `localStorage` on your device only — it is never bundled,
committed, or sent anywhere except Cohere's API. This is why the repo can be public safely.

## Stack

- React 19 + Vite, no UI framework (hand-rolled sticker-lite design system)
- Dexie.js for IndexedDB
- `vite-plugin-pwa` for the service worker / installability
- No backend: the browser talks to Cohere directly

## Design system

- 9-step warm gray scale, one step per role, mapped for light and dark.
- Semantic colors separated from the brand: cobalt leads the UI, green = alive,
  amber = expiring, red = recording/errors only.
- Dark mode by elevation: surfaces lighten above the background, shadows switch off.

## Develop

```bash
npm install
npm run dev       # local dev server
npm run build     # production build
npm run icons     # regenerate PWA icons (node scripts/make-icons.mjs)
```

Deploying is automatic: pushing to `main` builds and publishes via GitHub Actions.
If the repo is renamed, update `base` in `vite.config.js` and the manifest paths.

## Repo layout

- `mockups/noted-ui-mockups.html` — the original design board (7 screens, self-contained)
- `src/` — the app
- `scripts/make-icons.mjs` — dependency-free PNG icon generator
