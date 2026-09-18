import Dexie from "dexie";

// Lifespans: every note is born mortal. Infinity means immortal.
export const LIFESPANS = {
  "24h": { label: "24h", ms: 24 * 60 * 60 * 1000 },
  "1w": { label: "1 week", ms: 7 * 24 * 60 * 60 * 1000 },
  "1m": { label: "1 month", ms: 30 * 24 * 60 * 60 * 1000 },
  immortal: { label: "Immortal", ms: Infinity }
};

export const db = new Dexie("dying-notes");
db.version(1).stores({
  notes: "++id, createdAt, expiresAt, status, pinned"
});

export async function createNote({ title = "", body = "", tasks = [], type = "text", rawTranscript = null, audio = null, audioDuration = 0, lifespan = "1w", tidied = false }) {
  const now = Date.now();
  const ms = LIFESPANS[lifespan]?.ms ?? LIFESPANS["1w"].ms;
  return db.notes.add({
    title, body, tasks, type, rawTranscript, audio, audioDuration, tidied,
    createdAt: now,
    expiresAt: ms === Infinity ? null : now + ms,
    status: ms === Infinity ? "immortal" : "alive",
    pinned: false
  });
}

export async function updateNote(id, changes) {
  return db.notes.update(id, changes);
}

export async function setLifespan(id, lifespan) {
  const note = await db.notes.get(id);
  if (!note) return;
  const ms = LIFESPANS[lifespan]?.ms ?? Infinity;
  await db.notes.update(id, {
    expiresAt: ms === Infinity ? null : (note.createdAt > Date.now() - 1000 ? Date.now() + ms : Date.now() + ms),
    status: ms === Infinity ? "immortal" : "alive"
  });
}

export async function reviveNote(id, lifespan = "1w") {
  const ms = LIFESPANS[lifespan].ms;
  await db.notes.update(id, {
    expiresAt: ms === Infinity ? null : Date.now() + ms,
    status: ms === Infinity ? "immortal" : "alive"
  });
}

export async function togglePin(id) {
  const note = await db.notes.get(id);
  if (!note) return;
  const pinned = !note.pinned;
  await db.notes.update(id, {
    pinned,
    // pinning grants immortality, unpinning returns a week of life
    ...(pinned
      ? { status: "immortal", expiresAt: null }
      : { status: "alive", expiresAt: Date.now() + LIFESPANS["1w"].ms })
  });
}

export async function deleteNote(id) {
  return db.notes.delete(id);
}

// Reaps everything past its time. Runs on startup and every minute.
export async function sweep() {
  return db.notes.where("status").equals("alive").and((n) => n.expiresAt !== null && n.expiresAt <= Date.now()).modify({ status: "dead" });
}

// Life math for the heartbeat bar
export function lifeInfo(note) {
  if (note.status === "immortal") return { state: "immortal", p: 1, label: "Immortal" };
  if (note.status === "dead" || !note.expiresAt) return { state: "dead", p: 0, label: "Dead" };
  const total = note.expiresAt - note.createdAt;
  const left = note.expiresAt - Date.now();
  const p = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const hours = left / 3.6e6;
  const label = hours < 1 ? `${Math.max(1, Math.round(left / 6e4))}m` : hours < 24 ? `${Math.round(hours)}h` : hours < 168 ? `${Math.round(hours / 24)}d` : `${Math.round(hours / 24 / 7)}w`;
  const state = p <= 0.25 ? "warn" : "good";
  return { state, p, label: hours < 30 ? "Dies soon" : label };
}
