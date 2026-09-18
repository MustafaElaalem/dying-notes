# dying notes

UI mockups for **Noted.**, a voice-first quick-notes PWA where every note has a lifespan.

> Mortal by default, immortal by choice. Say it out loud, an LLM transcribes and tidies it,
> and the note lives until it dies unless you make it immortal.

## What's here

- `mockups/noted-ui-mockups.html` — a self-contained design board with 7 phone-frame screens
  (390×844): home grid, new-note sheet, voice recording, LLM transcribing, review/edit,
  dark home, and first run. Open it directly in any browser, no build step needed.
  The mic button works and "Flip all themes" toggles dark mode.

## Design system

- **9-step warm gray scale**, one step per role (background, wells, cards, elevated, hairlines,
  placeholder, metadata, secondary text, ink), fully mapped for light and dark.
- **Semantic colors stay out of the brand**: cobalt leads the UI, green means alive,
  amber means expiring, red is reserved for recording-in-progress and errors.
- **Dark mode by elevation**: surfaces lighten above the background, shadows switch off.
- Type: Fredoka + Nunito.
