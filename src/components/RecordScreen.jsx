import { useEffect, useRef, useState } from "react";
import { Recorder, fmtTime } from "../audio";
import { Icon } from "./Icons.jsx";

const BARS = Array.from({ length: 26 }, (_, i) => 0.3 + ((i * 53) % 70) / 100);

export default function RecordScreen({ onDone, onCancel }) {
  const recRef = useRef(null);
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const rec = new Recorder();
    recRef.current = rec;
    rec.onLevel = setLevel;
    rec.onAutoStop = () => finish();
    rec.start().catch((e) => setErr(e.name === "NotAllowedError" ? "Microphone permission was denied. Allow it in your browser and try again." : `Could not start recording: ${e.message}`));
    const t = setInterval(() => setSecs(rec.duration()), 200);
    return () => { clearInterval(t); rec.discard(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await recRef.current.stop();
      if (blob.size < 1000) { setErr("Too quiet. Nothing was recorded."); setBusy(false); return; }
      onDone(blob, recRef.current.duration());
    } catch (e) {
      setErr(`Recording failed: ${e.message}`);
      setBusy(false);
    }
  }

  return (
    <div className="screen capture">
      <div className="cap-top">
        <button className="iconbtn" onClick={onCancel} aria-label="Cancel"><Icon name="x" size={16} /></button>
        <span className="lbl">Voice note</span>
        <span style={{ width: 42 }} />
      </div>

      <div className="cap-mid">
        {err ? (
          <div className="cap-error">
            <p>{err}</p>
            <button className="donepill" onClick={onCancel}>Go back</button>
          </div>
        ) : (
          <>
            <div className="timer">{fmtTime(secs)}</div>
            <div className="cap-state"><span className="recdot" />Listening</div>
            <div className="bigwave">
              {BARS.map((h, i) => {
                const live = h * (0.35 + level * 1.3);
                return <span key={i} style={{ "--h": Math.min(1, live) }} />;
              })}
            </div>
            <div className="cap-hint">Speak naturally. Pause for two seconds when you're done.</div>
          </>
        )}
      </div>

      <div className="live-card">
        <div className="lbl"><Icon name="wave" size={13} />Capture</div>
        <p>Audio stays on your device. Only the converted clip is sent to Cohere for transcription.</p>
      </div>

      <div className="cap-controls">
        <button className="discard" onClick={onCancel}>Discard</button>
        <button className="stopbtn" onClick={finish} disabled={busy} aria-label="Stop recording">
          <Icon name={busy ? "clock" : "stop"} size={28} />
        </button>
      </div>
    </div>
  );
}
