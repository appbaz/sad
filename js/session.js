import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { generateSessionId, getDeviceSession } from "./store.js";

export async function claimMemberSession(roomId, username, sessionId = generateSessionId()) {
  await setDoc(
    doc(db, "rooms", roomId, "members", username),
    {
      activeSessionId: sessionId,
      activeSessionAt: serverTimestamp(),
    },
    { merge: true }
  );
  return sessionId;
}

export async function getActiveMemberSessionId(roomId, username) {
  const snap = await getDoc(doc(db, "rooms", roomId, "members", username));
  if (!snap.exists()) return null;
  return snap.data().activeSessionId || null;
}

export async function validateDeviceSession(roomId, username) {
  const deviceSession = await getDeviceSession();
  if (!deviceSession?.sessionId) return false;
  if (deviceSession.roomId !== roomId || deviceSession.username !== username) return false;
  const activeId = await getActiveMemberSessionId(roomId, username);
  return Boolean(activeId && activeId === deviceSession.sessionId);
}

export function listenMemberSession(roomId, username, onChange) {
  return onSnapshot(
    doc(db, "rooms", roomId, "members", username),
    (snap) => {
      if (!snap.exists()) return;
      onChange(snap.data());
    },
    (err) => console.error("session listener error:", err)
  );
}
