import { useEffect, useState } from "react";
import { sweep, createNote } from "./db";
import HomeScreen from "./components/HomeScreen.jsx";
import RecordScreen from "./components/RecordScreen.jsx";
import ProcessScreen from "./components/ProcessScreen.jsx";
import ReviewScreen from "./components/ReviewScreen.jsx";
import SettingsSheet from "./components/SettingsSheet.jsx";

const THEME_KEY = "noted.theme";
function initialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [view, setView] = useState({ name: "home" });
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // Back button on Android closes overlays / returns home
  useEffect(() => {
    const onPop = () => setView((v) => (v.name === "home" ? v : { name: "home" }));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <>
      {view.name === "home" && (
        <HomeScreen
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
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
