import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, updateNote, setLifespan, deleteNote, LIFESPANS } from "../db";
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

export default function ReviewScreen({ id, onDone }) {
  const note = useLiveQuery(() => db.notes.get(id), [id]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [newTask, setNewTask] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [saved, setSaved] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (note && !hydrated.current) {
      hydrated.current = true;
      setTitle(note.title || "");
      setBody(note.body || "");
    }
  }, [note]);

  if (!note) return <div className="screen" />;

  const persist = (extra = {}) => updateNote(id, { title, body, ...extra });

  async function saveAndClose() {
    await persist();
    setSaved(true);
    onDone();
  }

  async function addTask() {
    const t = newTask.trim();
    if (!t) return;
    const tasks = [...(note.tasks || []), { text: t, done: false }];
    await updateNote(id, { tasks, title, body });
    setNewTask("");
  }

  async function toggleTask(i) {
    const tasks = note.tasks.map((t, j) => (j === i ? { ...t, done: !t.done } : t));
    await updateNote(id, { tasks, title, body });
  }

  async function removeTask(i) {
    const tasks = note.tasks.filter((_, j) => j !== i);
    await updateNote(id, { tasks, title, body });
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
        <span className="ttl">Edit note</span>
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

        <input className="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={persist} placeholder="Title" dir="auto" aria-label="Note title" />

        <textarea className="edit-body" value={body} onChange={(e) => setBody(e.target.value)} onBlur={persist} placeholder="Say it here…" dir="auto" rows={Math.min(8, Math.max(3, body.split("\n").length + 1))} aria-label="Note body" />

        <div className="tasks-card">
          {note.tasks.map((t, i) => (
            <div key={i} className={"todo" + (t.done ? " done" : "")}>
              <button className="cb" onClick={() => toggleTask(i)} aria-label={t.done ? "Mark not done" : "Mark done"}><Icon name="check" size={13} /></button>
              <span dir="auto">{t.text}</span>
              <button className="task-x" onClick={() => removeTask(i)} aria-label="Remove task"><Icon name="x" size={12} /></button>
            </div>
          ))}
          <div className="todo add">
            <span className="cb ghost"><Icon name="plus" size={12} /></span>
            <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="Add a task" aria-label="Add a task" />
          </div>
        </div>

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
      </div>

      <div className="toolbar">
        <button aria-label="Delete" onClick={async () => { await deleteNote(id); onDone(); }}><Icon name="trash" /></button>
        <span className="toolbar-time">{new Date(note.createdAt).toLocaleString()}</span>
        {saved && <span className="saveflash">Saved</span>}
      </div>
    </div>
  );
}
