import { lifeInfo, togglePin, reviveNote, deleteNote } from "../db";
import { Icon } from "./Icons.jsx";

function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function NoteCard({ note, onOpen }) {
  const life = lifeInfo(note);
  const dead = note.status === "dead";

  return (
    <article className={"note" + (note.type === "checklist" && note.tasks.length ? " tinted" : "") + (dead ? " dead" : "")} onClick={onOpen}>
      {note.type === "voice" && (
        <span className="audio-chip" onClick={(e) => e.stopPropagation()}>
          <span className="pbtn"><Icon name={note.audio ? "play" : "wave"} size={13} /></span>
          <span className="wv">{Array.from({ length: 10 }, (_, i) => <span key={i} style={{ "--h": 0.4 + ((i * 37) % 55) / 100 }} />)}</span>
          <time>{Math.floor(note.audioDuration || 0)}s</time>
        </span>
      )}
      {note.tidied && !dead && <span className="badge"><Icon name="sparkle" size={13} />Tidied</span>}
      {note.title && <div className="note-title" dir="auto">{note.title}</div>}
      {note.body && <div className="note-body" dir="auto">{note.body}</div>}
      {note.type === "checklist" && note.tasks.filter((t) => t.text).length > 0 && (
        <div>
          {note.tasks.filter((t) => t.text).slice(0, 5).map((t, i) => (
            <div key={i} className={"todo" + (t.done ? " done" : "")}>
              <span className="cb"><Icon name="check" size={13} /></span>
              <span dir="auto">{t.text}</span>
            </div>
          ))}
        </div>
      )}
      {dead ? (
        <div className="dead-row">
          <span className="st st-dead"><Icon name="skull" size={13} />Dead</span>
          <button className="revive" onClick={(e) => { e.stopPropagation(); reviveNote(note.id); }}>
            <Icon name="heart" size={13} />Revive
          </button>
        </div>
      ) : (
        <div className="note-foot">
          <span className="life-wrap">
            {life.state === "immortal"
              ? <span className="st st-immortal"><Icon name="infinity" size={13} />Immortal</span>
              : <><span className="life"><span className={"hp " + life.state} style={{ "--p": life.p }} /></span>
                 <span className={"llabel " + life.state}>{life.label}</span></>}
          </span>
          <span className="foot-right">
            <time>{ago(note.createdAt)}</time>
            <button className="pinbtn" aria-label={note.pinned ? "Unpin" : "Pin (makes immortal)"} onClick={(e) => { e.stopPropagation(); togglePin(note.id); }}>
              <Icon name="pin" size={13} className={note.pinned ? "pinned" : ""} />
            </button>
            <button className="pinbtn" aria-label="Delete note" onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}>
              <Icon name="trash" size={13} />
            </button>
          </span>
        </div>
      )}
    </article>
  );
}
