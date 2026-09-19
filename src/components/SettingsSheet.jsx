import { useEffect, useState } from "react";
import { useDragDismiss } from "../gestures";
import { getLang, setLang } from "../cohere";
import { db } from "../db";
import ConfirmDialog from "./ConfirmDialog.jsx";
import { Icon } from "./Icons.jsx";

export default function SettingsSheet({ theme, onThemeChange, profile, onProfileChange, onClose }) {
  const [lang, setLangState] = useState(getLang());
  const [name, setName] = useState(profile?.name || "");
  const [confirmWipe, setConfirmWipe] = useState(false);
  const { ref: dragRef, bind: dragBind } = useDragDismiss(onClose);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function saveName(v) {
    const clean = v.trim().slice(0, 40);
    if (clean) onProfileChange({ ...profile, name: clean });
    setName(v.trim() ? v : name);
  }

  return (
    <div className="layer-sheet open">
      <div className="scrim" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-head">
          <div className="drag-zone" ref={dragRef} {...dragBind()}>
            <div className="grabber" />
            <h3>Settings</h3>
          </div>
          <button className="iconbtn small" onClick={onClose} aria-label="Close settings"><Icon name="x" size={15} /></button>
        </div>

        <div className="set-group">
          <div className="lp-label">Profile</div>
          <div className="key-row">
            <input value={name} onChange={(e) => saveName(e.target.value)}
              placeholder="Your name" spellCheck="false" autoComplete="off" aria-label="Your name" maxLength={40} />
          </div>
          <small className="set-hint">Local account on this device only. No servers, no sign-up.</small>
        </div>

        <div className="set-group">
          <div className="lp-label">Spoken language</div>
          <div className="lp-opts">
            <button className={"lp" + (lang === "ar" ? " sel" : "")} onClick={() => { setLang("ar"); setLangState("ar"); }}>العربية</button>
            <button className={"lp" + (lang === "en" ? " sel" : "")} onClick={() => { setLang("en"); setLangState("en"); }}>English</button>
          </div>
          <small className="set-hint">Used as a hint for Cohere Transcribe. Notes render right-to-left automatically when Arabic.</small>
        </div>

        <div className="set-group">
          <div className="lp-label">Theme</div>
          <div className="lp-opts">
            <button className={"lp" + (theme === "light" ? " sel" : "")} onClick={() => onThemeChange("light")}><Icon name="sun" size={14} />Light</button>
            <button className={"lp" + (theme === "dark" ? " sel" : "")} onClick={() => onThemeChange("dark")}><Icon name="moon" size={14} />Dark</button>
          </div>
        </div>

        <button className="danger-zone" onClick={() => setConfirmWipe(true)}>
          <Icon name="trash" size={15} />Delete all notes
        </button>

        {confirmWipe && (
          <ConfirmDialog
            title="Delete every note?"
            body="Even the immortals bow to this button. There is no undo."
            confirmLabel="Delete all"
            cancelLabel="Spare them"
            onConfirm={async () => { await db.notes.clear(); setConfirmWipe(false); onClose(); }}
            onClose={() => setConfirmWipe(false)}
          />
        )}
      </div>
    </div>
  );
}
