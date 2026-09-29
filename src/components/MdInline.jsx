import { inlineTokens } from "../markdown";

// Renders **bold** / *italic* / `code` as spans. Tokens, never HTML, so note
// content can't inject markup.
export default function MdInline({ text }) {
  return inlineTokens(text || "").map((tok, i) =>
    tok.t === "b" ? <b key={i}>{tok.s}</b>
    : tok.t === "i" ? <i key={i}>{tok.s}</i>
    : tok.t === "c" ? <code key={i}>{tok.s}</code>
    : <span key={i}>{tok.s}</span>
  );
}
