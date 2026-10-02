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

// Safari/WebKit throws "Error preparing Blob/File data to be stored in object
// store" when a Blob is put into IndexedDB (MediaRecorder blobs always hit it),
// so audio is persisted as a raw ArrayBuffer + mime string instead.
export async function createNote({ title = "", body = "", tasks = [], type = "text", rawTranscript = null, audio = null, audioDuration = 0, lifespan = "1w", tidied = false }) {
  const now = Date.now();
  const ms = LIFESPANS[lifespan]?.ms ?? LIFESPANS["1w"].ms;
  const audioBuf = audio instanceof Blob ? await audio.arrayBuffer() : audio;
  const audioMime = audio instanceof Blob ? audio.type : "";
  return db.notes.add({
    title, body, tasks, type, rawTranscript, audio: audioBuf, audioMime, audioDuration, tidied,
    createdAt: now,
    expiresAt: ms === Infinity ? null : now + ms,
    status: ms === Infinity ? "immortal" : "alive",
    lifespan: ms === Infinity ? "immortal" : lifespan,
    pinned: false
  });
}

// Rebuilds a playable Blob from a stored note. Rows saved before the
// ArrayBuffer switch (on browsers where storing Blobs works) hold a Blob.
export function noteAudioBlob(note) {
  if (!note.audio) return null;
  if (note.audio instanceof Blob) return note.audio;
  return new Blob([note.audio], { type: note.audioMime || "audio/webm" });
}

export async function updateNote(id, changes) {
  return db.notes.update(id, changes);
}

export async function setLifespan(id, lifespan) {
  const note = await db.notes.get(id);
  if (!note) return;
  const ms = LIFESPANS[lifespan]?.ms ?? Infinity;
  await db.notes.update(id, {
    lifespan,
    expiresAt: ms === Infinity ? null : Date.now() + ms,
    status: ms === Infinity ? "immortal" : "alive"
  });
}

export async function reviveNote(id, lifespan = "1w") {
  const ms = LIFESPANS[lifespan].ms;
  await db.notes.update(id, {
    lifespan,
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
      : { status: "alive", expiresAt: Date.now() + LIFESPANS["1w"].ms, lifespan: "1w" })
  });
}

export async function deleteNote(id) {
  return db.notes.delete(id);
}

// Reaps everything past its time. Runs on startup and every minute.
export async function sweep() {
  return db.notes.where("status").equals("alive").and((n) => n.expiresAt !== null && n.expiresAt <= Date.now()).modify({ status: "dead" });
}

// Life math for the heartbeat bar. The bar drains over the CHOSEN lifespan,
// so switching to 24h restarts the bar at full, not at (24h / total age).
export function lifeInfo(note) {
  if (note.status === "immortal") return { state: "immortal", p: 1, label: "Immortal" };
  if (note.status === "dead" || !note.expiresAt) return { state: "dead", p: 0, label: "Dead" };
  const chosen = LIFESPANS[note.lifespan]?.ms;
  const total = chosen && chosen !== Infinity ? chosen : Math.max(1, note.expiresAt - note.createdAt);
  const left = note.expiresAt - Date.now();
  const p = Math.max(0, Math.min(1, left / total));
  const hours = left / 3.6e6;
  const label = hours < 1 ? `${Math.max(1, Math.round(left / 6e4))}m` : hours < 24 ? `${Math.round(hours)}h` : hours < 168 ? `${Math.round(hours / 24)}d` : `${Math.round(hours / 24 / 7)}w`;
  const state = p <= 0.25 ? "warn" : "good";
  return { state, p, label: hours < 30 ? "Dies soon" : label };
}
