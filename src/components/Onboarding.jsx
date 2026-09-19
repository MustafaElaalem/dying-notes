import { useState } from "react";
import { setLang } from "../cohere";
import { Icon } from "./Icons.jsx";

// First-run: creates a purely local profile (name + spoken language).
// No servers, no sign-up — everything stays on this device.
export default function Onboarding({ onDone }) {
  const [name, setName] = useState("");
  const [lang, setLangState] = useState("ar");
  const [touched, setTouched] = useState(false);
  const valid = name.trim().length > 0;

  function start() {
    if (!valid) { setTouched(true); return; }
    setLang(lang);
    onDone({ name: name.trim().slice(0, 40), lang, createdAt: Date.now() });
  }

  return (
    <div className="screen onboarding">
      <div className="onb-brand">Noted<span className="dot">.</span></div>

      <div className="onb-mid">
        <div className="bigghost"><Icon name="ghost" size={48} /></div>
        <h1>Every note lives until it dies.</h1>
        <p>Speak, and it's written down. Mortal by default, <b>immortal by choice</b>. First, your local account.</p>

        <div className="onb-field">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && start()}
            placeholder="Your name"
            aria-label="Your name"
            maxLength={40}
            autoFocus
          />
          {touched && !valid && <small className="onb-error">Tell me your name first.</small>}
        </div>

        <div className="onb-field">
          <div className="lp-label">Spoken language</div>
          <div className="lp-opts">
            <button className={"lp" + (lang === "ar" ? " sel" : "")} onClick={() => setLangState("ar")}>العربية</button>
            <button className={"lp" + (lang === "en" ? " sel" : "")} onClick={() => setLangState("en")}>English</button>
          </div>
        </div>

        <button className="donepill onb-start" onClick={start}>Create my local account</button>
        <small className="onb-foot">No servers, no sign-up. Your notes live in this browser, and no one else's.</small>
      </div>
    </div>
  );
}
