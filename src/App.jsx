import { useEffect, useRef, useState } from "react";
import { sweep, createNote } from "./db";
import { setLang } from "./cohere";
import HomeScreen from "./components/HomeScreen.jsx";
import RecordScreen from "./components/RecordScreen.jsx";
import ProcessScreen from "./components/ProcessScreen.jsx";
import ReviewScreen from "./components/ReviewScreen.jsx";
import SettingsSheet from "./components/SettingsSheet.jsx";
import Onboarding from "./components/Onboarding.jsx";

const THEME_KEY = "noted.theme";
const PROFILE_KEY = "noted.profile";
function initialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch { return null; }
}

export default function App() {
  const [profile, setProfile] = useState(loadProfile);
  const [view, setView] = useState({ name: "home" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // The reaper: mark expired notes dead on load and every minute
  useEffect(() => {
    sweep();
    const t = setInterval(sweep, 60_000);
    return () => clearInterval(t);
  }, []);

  // Back button on mobile must land on home, not out of the app. Views and
  // overlays are state, not routes, so the browser history has nothing to pop
  // unless we put it there: exactly one entry is pushed while anything covers
  // home (note detail, recorder, settings, new-note sheet). Hardware/gesture
  // back pops that entry and popstate returns to home; in-app dismissal flips
  // the state instead and the effect pops the entry for us. One entry total —
  // surfaces never stack (settings/sheet only open on home) — so back always
  // means "one level down to home".
  const subSurface = view.name !== "home" || settingsOpen || sheetOpen;
  const guardPushed = useRef(false);
  useEffect(() => {
    const onPop = () => {
      guardPushed.current = false;
      setView((v) => (v.name === "home" ? v : { name: "home" }));
      setSettingsOpen(false);
      setSheetOpen(false);
    };
    window.addEventListener("popstate", onPop);
    if (subSurface && !guardPushed.current) {
      history.pushState({ noted: "overlay" }, "");
      guardPushed.current = true;
    } else if (!subSurface && guardPushed.current) {
      guardPushed.current = false;
      history.back();
    }
    return () => window.removeEventListener("popstate", onPop);
  }, [subSurface]);

  function saveProfile(p) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    if (p.lang) setLang(p.lang);
    setProfile(p);
  }

  // NOTE: all hooks must stay above this early return (rules of hooks)
  if (!profile || !profile.name) {
    return <Onboarding onDone={saveProfile} />;
  }

  const avatarLetter = profile.name.charAt(0).toUpperCase();

  return (
    <>
      {view.name === "home" && (
        <HomeScreen
          avatarLetter={avatarLetter}
          sheetOpen={sheetOpen}
          onSheetChange={setSheetOpen}
          onNewVoice={() => setView({ name: "record" })}
          onNewText={async () => {
            const id = await createNote({ type: "text", lifespan: "1w" });
            setView({ name: "review", id });
          }}
          onNewChecklist={async () => {
            const id = await createNote({ type: "checklist", tasks: [{ text: "", done: false }], lifespan: "1w" });
            setView({ name: "review", id });
          }}
          onOpenNote={(id) => setView({ name: "review", id })}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {view.name === "record" && (
        <RecordScreen
          onDone={(blob, duration) => setView({ name: "process", blob, duration })}
          onCancel={() => setView({ name: "home" })}
        />
      )}

      {view.name === "process" && (
        <ProcessScreen
          blob={view.blob}
          duration={view.duration}
          onSaved={(id) => setView({ name: "review", id })}
          onCancel={() => setView({ name: "home" })}
        />
      )}

      {view.name === "review" && (
        <ReviewScreen id={view.id} onDone={() => setView({ name: "home" })} />
      )}

      {settingsOpen && (
        <SettingsSheet
          theme={theme}
          onThemeChange={setTheme}
          profile={profile}
          onProfileChange={saveProfile}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
