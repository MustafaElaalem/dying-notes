import { useEffect, useRef, useState } from "react";
import { transcribe, tidy, structure, getLang } from "../cohere";
import { createNote } from "../db";
import { Icon } from "./Icons.jsx";

const STEPS = ["Transcribing", "Structuring"];

export default function ProcessScreen({ blob, duration, onSaved, onCancel }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [junk, setJunk] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        setStep(0);
        // Upload the recorded blob as-is (webm/opus ~10x smaller than WAV —
        // the WAV round-trip cost mobile 20-100s of upload per long note).
        const audio = blob;
        const transcript = await transcribe(audio, getLang());
        if (!transcript) throw new Error("The transcript came back empty. Try speaking a bit louder.");
        setStep(1);

        // DeepSeek structures the note in one call: intent + title/body/tasks.
        // Any failure falls back to the Cohere combined prompt.
        const s = await structure(transcript, "voice");
        if (s && s.intent === "not_a_note") {
          setJunk(true);
          return; // filler transcript — nothing worth keeping, no note created
        }
        let tidied;
        try {
          tidied = s ? { title: s.title, body: s.body, tasks: s.tasks } : await tidy(transcript);
          if (!tidied.body.trim() && !tidied.tasks.length) tidied.body = transcript;
        } catch {
          tidied = { title: "", body: transcript, tasks: [] }; // formatting is a bonus; raw transcript still saves
        }
        const id = await createNote({
          // intent-driven type: a task-intent utterance becomes a checklist note
          type: tidied.tasks.length ? "checklist" : "voice",
          title: tidied.title,
          body: tidied.body,
          tasks: tidied.tasks,
          rawTranscript: transcript,
          audio,
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

  if (junk) {
    return (
      <div className="screen">
        <div className="nav-row">
          <button className="iconbtn" onClick={onCancel} aria-label="Back"><Icon name="x" size={16} /></button>
          <span className="ttl">New note</span>
          <span style={{ width: 42 }} />
        </div>
        <div className="proc-error">
          <div className="bigghost"><Icon name="ghost" size={44} /></div>
          <h2>Nothing to keep here.</h2>
          <p>That was filler, not a note — the reaper moved along without collecting anything.</p>
          <div className="err-actions">
            <button className="donepill" onClick={onCancel}>Back home</button>
          </div>
        </div>
      </div>
    );
  }

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
            {i < step && !error ? <Icon name="check" size={13} /> : i === 1 ? <Icon name="sparkle" size={13} /> : null}
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
