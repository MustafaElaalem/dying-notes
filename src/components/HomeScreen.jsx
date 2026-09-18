import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, lifeInfo, deleteNote } from "../db";
import { useDragDismiss } from "../gestures";
import ConfirmDialog, { randomDeathNotice } from "./ConfirmDialog.jsx";
import { Icon } from "./Icons.jsx";
import NoteCard from "./NoteCard.jsx";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "immortal", label: "Immortal", icon: "infinity" },
  { id: "dying", label: "Dying", icon: "hourglass" },
  { id: "dead", label: "Dead", icon: "skull" }
];

export default function HomeScreen({ onNewVoice, onNewText, onNewChecklist, onOpenNote, onOpenSettings }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { ref: dragRef, bind: dragBind } = useDragDismiss(() => setSheetOpen(false));
  const [confirmNote, setConfirmNote] = useState(null);
  const [deathNotice, setDeathNotice] = useState("");
  const [dyingId, setDyingId] = useState(null);

  function confirmDelete(note) {
    setDeathNotice(randomDeathNotice());
    setConfirmNote(note);
  }

  function handleConfirmDelete() {
    const doomed = confirmNote;
    setConfirmNote(null);
    setDyingId(doomed.id);
    // let the funeral play before the reaper collects
    setTimeout(async () => {
      await deleteNote(doomed.id);
      setDyingId(null);
    }, 1150);
  }

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e) => e.key === "Escape" && setSheetOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const notes = useLiveQuery(() => db.notes.orderBy("createdAt").reverse().toArray(), [], []);

  const shown = useMemo(() => {
    let list = notes || [];
    if (filter === "immortal") list = list.filter((n) => n.status === "immortal");
    else if (filter === "dead") list = list.filter((n) => n.status === "dead");
    else if (filter === "dying") list = list.filter((n) => { const l = lifeInfo(n); return l.state === "warn"; });
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((n) => (n.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q) || n.tasks.some((t) => (t.text || "").toLowerCase().includes(q)));
    }
    return [...list].sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));
  }, [notes, filter, query]);

  const counts = useMemo(() => ({
    immortal: (notes || []).filter((n) => n.status === "immortal").length,
    dying: (notes || []).filter((n) => lifeInfo(n).state === "warn").length,
    dead: (notes || []).filter((n) => n.status === "dead").length
  }), [notes]);

  return (
    <div className={"screen" + (sheetOpen ? " sheet-open" : "")}>
      <div className="topbar">
        <div className="wordmark">Noted<span className="dot">.</span></div>
        <label className="searchpill">
          <Icon name="search" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your notes" aria-label="Search your notes" />
        </label>
        <button className="avatar" onClick={onOpenSettings} aria-label="Settings">M</button>
      </div>

      <div className="chips" role="tablist" aria-label="Filters">
        {FILTERS.map((f) => (
          <button key={f.id} className={"chip" + (filter === f.id ? " active" : "")} onClick={() => setFilter(f.id)} role="tab" aria-selected={filter === f.id}>
            {f.icon && <Icon name={f.icon} size={13} />}
            {f.label}
            {f.id !== "all" && counts[f.id] > 0 && <span className="count">{counts[f.id]}</span>}
          </button>
        ))}
      </div>

      {(notes || []).length === 0 ? (
        <div className="empty">
          <div className="bigghost"><Icon name="ghost" size={52} /></div>
          <h2>Nothing alive in here yet.</h2>
          <p>Tap the mic below and say it out loud. Every note gets a life. <b>Keep the good ones forever.</b></p>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <div className="bigghost"><Icon name="ghost" size={52} /></div>
          <h2>No {filter === "all" ? "matches" : filter + " notes"}.</h2>
          <p>{filter === "dead" ? "Nothing has died yet. Give it time." : "Try another filter or search."}</p>
        </div>
      ) : (
        <div className="grid">
          {[0, 1].map((col) => (
            <div className="mcol" key={col}>
              {shown.filter((_, i) => i % 2 === col).map((n) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  dying={dyingId === n.id}
                  onOpen={() => onOpenNote(n.id)}
                  onRequestDelete={() => confirmDelete(n)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setSheetOpen((v) => !v)} aria-label="New note">
        <Icon name={sheetOpen ? "x" : "mic"} size={28} />
      </button>

      {sheetOpen && (
        <div className="layer-sheet">
          <div className="scrim" onClick={() => setSheetOpen(false)} />
          <div className="sheet">
            <div className="sheet-head">
              <div className="drag-zone" ref={dragRef} {...dragBind()}>
                <div className="grabber" />
                <h3>New note</h3>
              </div>
            </div>
            <button className="voice-card" onClick={() => { setSheetOpen(false); onNewVoice(); }}>
              <span className="micb"><Icon name="mic" size={28} /></span>
              <span><b>Voice note</b><small>Speak naturally. It's transcribed, tidied and given a lifespan.</small></span>
              <Icon name="chev" size={22} className="go" />
            </button>
            <div className="opt-row">
              <button className="opt" onClick={() => { setSheetOpen(false); onNewText(); }}><Icon name="text" />Text</button>
              <button className="opt" onClick={() => { setSheetOpen(false); onNewChecklist(); }}><Icon name="list" />Checklist</button>
            </div>
          </div>
        </div>
      )}
      {confirmNote && (
        <ConfirmDialog
          title="Delete this note?"
          body={deathNotice}
          onConfirm={handleConfirmDelete}
          onClose={() => setConfirmNote(null)}
        />
      )}
    </div>
  );
}
