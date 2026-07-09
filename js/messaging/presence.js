import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "../firebase.js";
import { getCurrentUser } from "../auth.js";
import { TYPING_TIMEOUT_MS, TYPING_STALE_MS } from "../constants.js";

let typingTimer = null;
let lastTypingState = false;

export function listenRoomUsers(roomId, callback) {
  const q = query(collection(db, "users"), where("roomId", "==", roomId));
  return onSnapshot(
    q,
    (snap) => {
      const users = snap.docs.map((d) => ({
        uid: d.id,
        ...d.data(),
        lastSeen: d.data().lastSeen?.toMillis?.() ?? 0,
      }));
      callback(users);
    },
    (err) => callback([], err)
  );
}

export function listenPresence(roomId, callback) {
  const ref = collection(db, "rooms", roomId, "presence");
  return onSnapshot(
    ref,
    (snap) => {
      const presence = {};
      snap.docs.forEach((d) => {
        presence[d.id] = {
          username: d.id,
          ...d.data(),
          updatedAt: d.data().updatedAt?.toMillis?.() ?? 0,
        };
      });
      callback(presence);
    },
    (err) => callback({}, err)
  );
}

export function isPartnerTyping(presence, partnerUsername) {
  if (!partnerUsername || !presence[partnerUsername]) return false;
  const entry = presence[partnerUsername];
  if (!entry.typing) return false;
  const updatedAt = entry.updatedAt || 0;
  return Date.now() - updatedAt < TYPING_STALE_MS;
}

export async function setTyping(roomId, typing) {
  const me = getCurrentUser();
  if (!me?.username || !roomId) return;

  if (typing === lastTypingState && typing) return;

  lastTypingState = typing;
  const ref = doc(db, "rooms", roomId, "presence", me.username);
  await setDoc(
    ref,
    {
      username: me.username,
      typing: Boolean(typing),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  ).catch(() => {});

  if (typing) {
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      setTyping(roomId, false).catch(() => {});
    }, TYPING_TIMEOUT_MS);
  }
}

export function stopTyping(roomId) {
  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }
  lastTypingState = false;
  if (roomId) setTyping(roomId, false).catch(() => {});
}
