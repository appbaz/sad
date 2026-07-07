const DB_NAME = "chat-app-db";
const DB_VERSION = 1;
const OUTBOX_STORE = "outbox";
const PREFS_STORE = "preferences";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(PREFS_STORE)) {
        db.createObjectStore(PREFS_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then(
    (db) => db.transaction(storeName, mode).objectStore(storeName)
  );
}

export async function addToOutbox(message) {
  const store = await tx(OUTBOX_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put(message);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingMessages() {
  const store = await tx(OUTBOX_STORE, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      resolve(
        all
          .filter((m) => m.status === "pending" || m.status === "failed")
          .sort((a, b) => a.createdAt - b.createdAt)
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateOutboxMessage(id, updates) {
  const store = await tx(OUTBOX_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) {
        resolve();
        return;
      }
      const putReq = store.put({ ...existing, ...updates });
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function removeFromOutbox(id) {
  const store = await tx(OUTBOX_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPreference(key) {
  const store = await tx(PREFS_STORE, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function setPreference(key, value) {
  const store = await tx(PREFS_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getLastChatUser() {
  return getPreference("lastChatUser");
}

export async function setLastChatUser(username) {
  return setPreference("lastChatUser", username);
}

export async function isInstallDismissed() {
  const dismissed = await getPreference("installDismissedAt");
  if (!dismissed) return false;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - dismissed < sevenDays;
}

export async function dismissInstallPrompt() {
  return setPreference("installDismissedAt", Date.now());
}

const DEVICE_SESSION_KEY = "deviceSession";

export async function getDeviceSession() {
  return getPreference(DEVICE_SESSION_KEY);
}

export async function saveDeviceSession(session) {
  if (!session) {
    const store = await tx(PREFS_STORE, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.delete(DEVICE_SESSION_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
  return setPreference(DEVICE_SESSION_KEY, session);
}

export async function clearDeviceSession() {
  return saveDeviceSession(null);
}

export async function touchDeviceSession() {
  const session = await getDeviceSession();
  if (!session?.username || !session?.roomId) return null;
  const next = { ...session, lastActiveAt: Date.now() };
  await saveDeviceSession(next);
  return next;
}

export function generateLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
