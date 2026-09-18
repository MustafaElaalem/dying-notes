import { useEffect } from "react";
import { Icon } from "./Icons.jsx";

// Random eulogies for a deleted note. Short, dry, on-theme.
const DEATH_NOTICES = [
  "Every note dies. This one just dies sooner.",
  "It trusted you with its thoughts.",
  "The reaper accepts your request. No refunds.",
  "No funeral, no flowers. Just one tap.",
  "It had so much left to say. Probably."
];

export function randomDeathNotice() {
  return DEATH_NOTICES[Math.floor(Math.random() * DEATH_NOTICES.length)];
}

export default function ConfirmDialog({ title, body, confirmLabel = "Delete", cancelLabel = "Keep it", onConfirm, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="layer-sheet confirm-layer">
      <div className="scrim" onClick={onClose} />
      <div className="confirm-card" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="confirm-icon"><Icon name="skull" size={28} /></div>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onClose}>{cancelLabel}</button>
          <button className="confirm-delete" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
