// Notion-lite note bodies: the body is one markdown string the user can mix
// free text and checklists in. Supported: "- [ ] "/"- [x] " check rows,
// "- " bullets, "#/##/### " headings, and **bold** / *italic* / `code` inline.
// Everything else renders as a text line.

// Legacy notes keep tasks in a separate array (the AI pipeline's old shape);
// they render folded into the body and are merged into it for real on the
// next save from the editor.
export function noteMarkdown(note) {
  const taskLines = (note.tasks || [])
    .filter((t) => (t.text ?? t).trim())
    .map((t) => `- [${t.done ? "x" : " "}] ${(t.text ?? t).trim()}`);
  const body = (note.body || "").replace(/\s+$/, "");
  return taskLines.length ? (body ? body + "\n" : "") + taskLines.join("\n") : body;
}

export function parseBlocks(md) {
  const blocks = [];
  (md || "").split("\n").forEach((line, i) => {
    let m;
    if ((m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/))) {
      blocks.push({ type: "check", done: m[1] !== " ", text: m[2], line: i });
    } else if ((m = line.match(/^\s*[-*]\s+(.+)$/))) {
      blocks.push({ type: "bullet", text: m[1], line: i });
    } else if ((m = line.match(/^\s*(#{1,3})\s+(.+)$/))) {
      blocks.push({ type: "heading", level: m[1].length, text: m[2], line: i });
    } else if (line.trim()) {
      blocks.push({ type: "text", text: line, line: i });
    }
  });
  return blocks;
}

// Minimal inline tokenizer — returns spans, never HTML, so nothing to escape.
export function inlineTokens(text) {
  const out = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: "text", s: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: "b", s: m[1] });
    else if (m[2] !== undefined) out.push({ t: "i", s: m[2] });
    else out.push({ t: "c", s: m[3] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: "text", s: text.slice(last) });
  return out;
}

export function toggleCheckLine(md, lineIndex) {
  const lines = (md || "").split("\n");
  if (lines[lineIndex] === undefined) return md;
  lines[lineIndex] = lines[lineIndex].replace(
    /^(\s*[-*]\s+\[)( |x|X)(\])/,
    (_, pre, c, post) => pre + (c === " " ? "x" : " ") + post
  );
  return lines.join("\n");
}

export function appendCheck(md, text) {
  const base = (md || "").replace(/\s+$/, "");
  return (base ? base + "\n" : "") + `- [ ] ${text}`;
}
