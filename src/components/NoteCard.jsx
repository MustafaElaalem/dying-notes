import { useRef } from "react";
import { useDrag } from "@use-gesture/react";
import { lifeInfo, togglePin, reviveNote, updateNote } from "../db";
import { Icon } from "./Icons.jsx";

function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function NoteCard({ note, onOpen, onRequestDelete, dying = false }) {
  const life = lifeInfo(note);
  const dead = note.status === "dead";
  const cardRef = useRef(null);
  const dragged = useRef(false);

  // Horizontal card gestures. touch-action: pan-y keeps vertical scrolling native.
  // Swipe right = pin/unpin (immortality). Swipe left = kill a living note / revive a dead one.
  // Commits the instant the threshold is crossed (no reliance on end events),
  // and the release branch only ever springs the card back.
  const consumed = useRef(false);
  const bind = useDrag(({ down, first, movement: [mx], velocity: [vx], direction: [dx] }) => {
    const el = cardRef.current;
    if (!el) return;
    if (first) { consumed.current = false; dragged.current = false; }
    if (down && Math.abs(mx) > 7) dragged.current = true;
    if (down) {
      if (consumed.current) return; // action already fired for this gesture
      el.style.transition = "none";
      el.style.transform = `translateX(${mx}px)`;
      el.style.backgroundColor = mx < -12 ? (dead ? "var(--good-tint)" : "var(--accent-soft)") : mx > 12 ? "var(--g-sunken)" : "";
      el.classList.toggle("swiping-left", mx < -12);
      el.classList.toggle("swiping-right", mx > 12);
      const left = mx < -72 || (vx < -0.9 && dx < 0 && mx < 20);
      const right = mx > 72 || (vx > 0.9 && dx > 0 && mx > -20);
      if (left || right) {
        consumed.current = true;
        try { navigator.vibrate?.(12); } catch { /* unsupported */ }
        el.classList.remove("swiping-left", "swiping-right");
        el.style.transition = "transform .22s cubic-bezier(.2,.9,.3,1), opacity .22s ease, background-color .22s ease";
        el.style.transform = `translateX(${left ? -420 : 420}px)`;
        el.style.opacity = "0.25";
        if (left) dead ? reviveNote(note.id) : updateNote(note.id, { status: "dead" });
        else togglePin(note.id);
        // guaranteed cleanup: never rely on the pointer's end events to restore
        // the card; it re-enters view with its new life state.
        setTimeout(() => {
          el.style.transition = "transform .2s ease, opacity .2s ease";
          el.style.transform = "";
          el.style.opacity = "";
          el.style.backgroundColor = "";
        }, 260);
      }
    } else {
      el.classList.remove("swiping-left", "swiping-right");
      if (consumed.current) return; // fly-off owns the visuals; cleanup restores
      el.style.transition = "transform .24s cubic-bezier(.2,.9,.3,1), background-color .24s ease";
      el.style.transform = "";
      el.style.backgroundColor = "";
    }
  }, { axis: "x", filterTaps: true });

  return (
    <article
      ref={cardRef}
      {...bind()}
      className={"note" + (note.type === "checklist" && note.tasks.length ? " tinted" : "") + (dead ? " dead" : "") + (dying ? " dying" : "")}
      onClick={() => { if (dragged.current) { dragged.current = false; return; } onOpen(); }}
    >
      {dying && <span className="rising-ghost"><Icon name="ghost" size={40} /></span>}
      <span className="swipe-hint left">{dead ? <Icon name="heart" size={16} /> : <Icon name="skull" size={16} />}</span>
      <span className="swipe-hint right"><Icon name="pin" size={16} /></span>
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
            <button className="pinbtn" aria-label="Delete note" onClick={(e) => { e.stopPropagation(); onRequestDelete?.(); }}>
              <Icon name="trash" size={13} />
            </button>
          </span>
        </div>
      )}
    </article>
  );
}
