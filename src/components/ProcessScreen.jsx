import { useEffect, useRef, useState } from "react";
import { toWav } from "../audio";
import { transcribe, tidy, getLang } from "../cohere";
import { createNote } from "../db";
import { Icon } from "./Icons.jsx";

const STEPS = ["Converting", "Transcribing", "Tidying up"];

export default function ProcessScreen({ blob, duration, onSaved, onCancel }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        setStep(0);
        const wav = await toWav(blob);
        setStep(1);
        const transcript = await transcribe(wav, getLang());
        if (!transcript) throw new Error("The transcript came back empty. Try speaking a bit louder.");
        setStep(2);
        let tidied;
        try {
          tidied = await tidy(transcript);
        } catch {
          tidied = { title: "", body: transcript, tasks: [] }; // tidy is a bonus; raw transcript still saves
        }
        const id = await createNote({
          type: "voice",
          title: tidied.title,
          body: tidied.body,
          tasks: tidied.tasks,
          rawTranscript: transcript,
          audio: wav,
          audioDuration: duration,
          tidied: true,
          lifespan: "1w"
        });
        onSaved(id);
      } catch (e) {
        setError(e.message || String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen">
      <div className="nav-row">
        <button className="iconbtn" onClick={onCancel} aria-label="Cancel"><Icon name="x" size={16} /></button>
        <span className="ttl">New note</span>
        <span className="savepill">{error ? "Failed" : "Saving…"}</span>
      </div>

      <div className="steps">
        {STEPS.map((s, i) => (
          <span key={s} className={"step" + (error ? "" : i < step ? " done" : i === step ? " active" : "")}>
            {i < step && !error ? <Icon name="check" size={13} /> : i === 2 ? <Icon name="sparkle" size={13} /> : null}
            {s}
          </span>
        ))}
      </div>

      {error ? (
        <div className="proc-error">
          <div className="bigghost"><Icon name="skull" size={44} /></div>
          <h2>The note died in transit.</h2>
          <p>{error}</p>
          <div className="err-actions">
            <button className="donepill" onClick={() => location.reload()}>Retry</button>
            <button className="discard" onClick={onCancel}>Back home</button>
          </div>
        </div>
      ) : (
        <>
          <div className="draft">
            <span className="audio-chip">
              <span className="pbtn"><Icon name="play" size={13} /></span>
              <span className="wv">{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ "--h": 0.4 + ((i * 41) % 60) / 100 }} />)}</span>
              <time>{Math.floor(duration)}s</time>
            </span>
            <div className="sk sk-title" />
            <div className="sk sk-line" style={{ width: "92%" }} />
            <div className="sk sk-line" style={{ width: "84%" }} />
            <div className="sk sk-line" style={{ width: "47%", marginBottom: 14 }} />
            {[62, 54, 58].map((w, i) => (
              <div className="sk-task" key={i}><i className="sk" /><div className="sk" style={{ width: w + "%" }} /></div>
            ))}
          </div>
          <p className="bg-hint">Transcribed by Cohere, tidied by an LLM, then saved to your device. Nothing is stored on any server.</p>
        </>
      )}
    </div>
  );
}
