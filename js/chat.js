import {
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { getCurrentUser } from "./auth.js";
import {
  addToOutbox,
  generateLocalId,
  removeFromOutbox,
  updateOutboxMessage,
} from "./store.js";
import { MAX_MESSAGE_LENGTH } from "./constants.js";

let persistenceEnabled = false;

export async function enableOfflinePersistence() {
  if (persistenceEnabled) return;
  try {
    await enableIndexedDbPersistence(db);
    persistenceEnabled = true;
  } catch (err) {
    if (err.code !== "failed-precondition" && err.code !== "unimplemented") {
      console.warn("Offline persistence unavailable:", err);
    }
  }
}

export async function sendMessageToServer(roomId, text, localId = null) {
  const me = getCurrentUser();
  if (!me) throw new Error("লগইন করা নেই");

  const messagesRef = collection(db, "rooms", roomId, "messages");

  await addDoc(messagesRef, {
    senderId: me.username,
    senderName: me.displayName || me.username,
    senderUid: me.uid,
    text,
    createdAt: serverTimestamp(),
    read: false,
    localId,
  });

  await setDoc(
    doc(db, "rooms", roomId),
    { lastActivityAt: serverTimestamp() },
    { merge: true }
  ).catch(() => {});

  if (localId) {
    await removeFromOutbox(localId);
  }
}

export async function sendMessage(roomId, text, options = {}) {
  const me = getCurrentUser();
  if (!me) throw new Error("লগইন করা নেই");

  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`মেসেজ ${MAX_MESSAGE_LENGTH} অক্ষরের বেশি হতে পারবে না`);
  }

  const localId = options.localId || generateLocalId();
  const optimistic = {
    id: localId,
    localId,
    senderId: me.username,
    senderName: me.displayName || me.username,
    text: trimmed,
    createdAt: Date.now(),
    status: "sending",
    pending: false,
  };

  if (!navigator.onLine) {
    await addToOutbox({
      id: localId,
      roomId,
      text: trimmed,
      senderId: me.username,
      senderName: me.displayName || me.username,
      createdAt: Date.now(),
      status: "pending",
      retries: 0,
    });
    optimistic.status = "pending";
    optimistic.pending = true;
    return optimistic;
  }

  try {
    await sendMessageToServer(roomId, trimmed, localId);
    optimistic.status = "sent";
    return optimistic;
  } catch (err) {
    await addToOutbox({
      id: localId,
      roomId,
      text: trimmed,
      senderId: me.username,
      senderName: me.displayName || me.username,
      createdAt: Date.now(),
      status: "pending",
      retries: 0,
    });
    optimistic.status = "pending";
    optimistic.pending = true;
    return optimistic;
  }
}

export async function retryOutboxMessage(item) {
  await updateOutboxMessage(item.id, { status: "pending", retries: (item.retries || 0) + 1 });
  try {
    await sendMessageToServer(item.roomId, item.text, item.id);
    await removeFromOutbox(item.id);
    return true;
  } catch {
    await updateOutboxMessage(item.id, { status: "failed" });
    return false;
  }
}

export function listenToMessages(roomId, callback) {
  const q = query(
    collection(db, "rooms", roomId, "messages"),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toMillis?.() ?? d.data().createdAt,
        status: "sent",
      }));
      callback(messages);
    },
    (err) => {
      console.error("Message listener error:", err);
      callback(null, err);
    }
  );
}

export function listenToRoomUsers(roomId, callback) {
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
