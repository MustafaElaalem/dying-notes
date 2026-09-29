import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, updateNote, setLifespan, deleteNote, LIFESPANS } from "../db";
import { noteMarkdown, parseBlocks, toggleCheckLine, appendCheck } from "../markdown";
import ConfirmDialog, { randomDeathNotice } from "./ConfirmDialog.jsx";
import MdInline from "./MdInline.jsx";
import { Icon } from "./Icons.jsx";

function AudioPlayer({ note }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const url = useMemo(() => (note.audio ? URL.createObjectURL(note.audio) : null), [note.audio]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  if (!url) return null;
  return (
    <div className="audio-card">
      <button className="pbtn" aria-label={playing ? "Pause" : "Play original audio"} onClick={() => {
        const a = ref.current;
        if (!a) return;
        if (a.paused) a.play(); else a.pause();
      }}><Icon name={playing ? "pause" : "play"} size={16} /></button>
      <div className="meta"><b>Original audio</b><small>Kept on this device</small></div>
      <audio ref={ref} src={url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </div>
  );
}

function BodyView({ blocks, onToggle }) {
  if (!blocks.length) return <p className="md-empty">Nothing here yet — tap to write.</p>;
  return (
    <div className="md-body" dir="auto">
      {blocks.map((b, i) =>
        b.type === "check" ? (
          <div key={i} className={"todo md-check" + (b.done ? " done" : "")} role="checkbox" aria-checked={b.done}
            onClick={(e) => { e.stopPropagation(); onToggle(i); }}>
            <span className="cb"><Icon name="check" size={13} /></span>
            <span dir="auto"><MdInline text={b.text} /></span>
          </div>
        ) : b.type === "bullet" ? (
          <div key={i} className="md-bullet"><MdInline text={b.text} /></div>
        ) : b.type === "heading" ? (
          <div key={i} className={"md-h md-h" + b.level}><MdInline text={b.text} /></div>
        ) : (
          <p key={i} className="md-text"><MdInline text={b.text} /></p>
        )
      )}
    </div>
  );
}

export default function ReviewScreen({ id, onDone, startInEditor = false }) {
  const note = useLiveQuery(() => db.notes.get(id), [id]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [newTask, setNewTask] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deathNotice, setDeathNotice] = useState(randomDeathNotice());
  const [editingBody, setEditingBody] = useState(startInEditor);
  const hydrated = useRef(false);

  useEffect(() => {
    if (note && !hydrated.current) {
      hydrated.current = true;
      setTitle(note.title || "");
      // legacy tasks fold into the body here; persist() commits the fold
      setBody(noteMarkdown(note));
    }
  }, [note]);

  if (!note) return <div className="screen" />;

  const blocks = parseBlocks(body);

  const persist = (extra = {}) => updateNote(id, { title, body, tasks: [], ...extra });

  async function saveAndClose() {
    await persist();
    setSaved(true);
    onDone();
  }

  function toggleEditing() {
    if (editingBody) {
      persist();
      setEditingBody(false);
    } else {
      setEditingBody(true);
    }
  }

  async function toggleCheck(i) {
    const b = blocks[i];
    if (!b) return;
    const next = toggleCheckLine(body, b.line);
    setBody(next);
    await persist({ body: next });
  }

  async function addTask() {
    const t = newTask.trim();
    if (!t) return;
    const next = appendCheck(body, t);
    setBody(next);
    setNewTask("");
    await persist({ body: next });
  }

  // The chosen lifespan is stored on the note. Legacy notes (created before it
  // existed) fall back to deriving it from timestamps, then default to 1 week.
  const currentLifespan = note.status === "immortal"
    ? "immortal"
    : note.lifespan
      || Object.entries(LIFESPANS).find(([, v]) => v.ms !== Infinity && note.expiresAt && note.expiresAt - note.createdAt === v.ms)?.[0]
      || "1w";

  return (
    <div className="screen">
      <div className="nav-row">
        <button className="iconbtn" onClick={onDone} aria-label="Back"><Icon name="x" size={16} /></button>
        <span className="ttl">Note</span>
        <button className="donepill" onClick={saveAndClose}>Done</button>
      </div>

      <div className="edit-scroll">
        <AudioPlayer note={note} />

        {note.tidied && (
          <div className="ai-row">
            <span className="badge"><Icon name="sparkle" size={13} />Tidied by AI</span>
            {note.rawTranscript && <button className="linkbtn" onClick={() => setShowRaw((v) => !v)}>{showRaw ? "Hide original transcript" : "Show original transcript"}</button>}
          </div>
        )}
        {showRaw && note.rawTranscript && <p className="raw-transcript" dir="auto">{note.rawTranscript}</p>}

        <div className="lifespan">
          <div className="lp-label">Lifespan</div>
          <div className="lp-opts">
            {Object.entries(LIFESPANS).map(([key, v]) => (
              <button key={key} className={"lp" + (currentLifespan === key ? " sel" : "")} onClick={() => setLifespan(id, key)}>
                {key === "immortal" && <Icon name="infinity" size={13} />}
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <input className="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={persist} placeholder="Title" dir="auto" aria-label="Note title" />

        <div className="body-tools">
          <button className="linkbtn" onClick={toggleEditing}>{editingBody ? "Preview" : "Edit"}</button>
        </div>

        {editingBody ? (
          <textarea
            className="edit-body" value={body} onChange={(e) => setBody(e.target.value)} onBlur={persist}
            placeholder="Say it here… '- [ ] ' makes a task" dir="auto" autoFocus
            rows={Math.min(16, Math.max(3, body.split("\n").length + 1))}
            aria-label="Note body"
          />
        ) : (
          <div className="md-wrap" onClick={() => setEditingBody(true)}>
            <BodyView blocks={blocks} onToggle={toggleCheck} />
          </div>
        )}

        <div className="tasks-card">
          <div className="todo add">
            <span className="cb ghost"><Icon name="plus" size={12} /></span>
            <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="Add a task" aria-label="Add a task" />
          </div>
        </div>
      </div>

      <div className="toolbar">
        <button aria-label="Delete" onClick={() => { setDeathNotice(randomDeathNotice()); setConfirmDelete(true); }}><Icon name="trash" /></button>
        <span className="toolbar-time">{new Date(note.createdAt).toLocaleString()}</span>
        {saved && <span className="saveflash">Saved</span>}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this note?"
          body={deathNotice}
          onConfirm={async () => { await deleteNote(id); onDone(); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
