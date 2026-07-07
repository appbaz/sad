import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
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

export function getConversationId(usernameA, usernameB) {
  const sorted = [usernameA, usernameB].sort();
  return `conv_${sorted[0]}_${sorted[1]}`;
}

export async function prepareConversation(myUsername, otherUsername) {
  const me = getCurrentUser();
  if (!me) throw new Error("লগইন করা নেই");

  const convId = getConversationId(myUsername, otherUsername);
  const otherUid = await resolveUidByUsername(otherUsername);
  await ensureConversation(convId, myUsername, otherUsername, me.uid, otherUid);
  return convId;
}

async function ensureConversation(convId, myUsername, otherUsername, myUid, otherUid) {
  const convRef = doc(db, "conversations", convId);
  const snap = await getDoc(convRef);
  const sortedNames = [myUsername, otherUsername].sort();
  const participants = new Set([myUid]);
  if (otherUid) participants.add(otherUid);

  if (!snap.exists()) {
    await setDoc(convRef, {
      participants: [...participants],
      participantNames: sortedNames,
      participantUsernames: sortedNames,
      updatedAt: serverTimestamp(),
      unreadCount: {},
    });
    return;
  }

  const existing = snap.data().participants || [];
  existing.forEach((uid) => participants.add(uid));

  await updateDoc(convRef, {
    participants: [...participants],
    participantNames: sortedNames,
    participantUsernames: sortedNames,
    updatedAt: serverTimestamp(),
  });
}

export async function resolveUidByUsername(username) {
  const snap = await getDoc(doc(db, "usernames", username));
  return snap.exists() ? snap.data().uid : null;
}

export async function sendMessageToServer(convId, text, localId = null) {
  const me = getCurrentUser();
  if (!me) throw new Error("লগইন করা নেই");

  const convRef = doc(db, "conversations", convId);
  const messagesRef = collection(db, "conversations", convId, "messages");

  await addDoc(messagesRef, {
    senderId: me.username,
    senderName: me.displayName || me.username,
    senderUid: me.uid,
    text,
    createdAt: serverTimestamp(),
    read: false,
    localId,
  });

  const convSnap = await getDoc(convRef);
  const unreadCount = convSnap.data()?.unreadCount || {};
  const otherUsernames = (convSnap.data()?.participantUsernames || []).filter(
    (u) => u !== me.username
  );

  for (const uname of otherUsernames) {
    unreadCount[uname] = (unreadCount[uname] || 0) + 1;
  }

  await updateDoc(convRef, {
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unreadCount,
  });

  if (localId) {
    await removeFromOutbox(localId);
  }
}

export async function sendMessage(otherUsername, text, options = {}) {
  const me = getCurrentUser();
  if (!me) throw new Error("লগইন করা নেই");

  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`মেসেজ ${MAX_MESSAGE_LENGTH} অক্ষরের বেশি হতে পারবে না`);
  }

  const convId = await prepareConversation(me.username, otherUsername);

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
      convId,
      otherUsername,
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
    await sendMessageToServer(convId, trimmed, localId);
    optimistic.status = "sent";
    return optimistic;
  } catch (err) {
    await addToOutbox({
      id: localId,
      convId,
      otherUsername,
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
    await sendMessageToServer(item.convId, item.text, item.id);
    await removeFromOutbox(item.id);
    return true;
  } catch {
    await updateOutboxMessage(item.id, { status: "failed" });
    return false;
  }
}

export function listenToMessages(convId, callback) {
  const q = query(
    collection(db, "conversations", convId, "messages"),
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

export function listenToConversations(callback) {
  return onSnapshot(
    collection(db, "conversations"),
    (snap) => {
      const convs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        lastMessageAt: d.data().lastMessageAt?.toMillis?.() ?? 0,
      }));
      callback(convs);
    },
    (err) => callback([], err)
  );
}

export function listenToUsers(callback) {
  return onSnapshot(
    collection(db, "users"),
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

export async function markConversationRead(convId) {
  const me = getCurrentUser();
  if (!me) return;

  const convRef = doc(db, "conversations", convId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) return;

  const unreadCount = { ...(snap.data().unreadCount || {}) };
  if (!unreadCount[me.username]) return;

  unreadCount[me.username] = 0;
  await updateDoc(convRef, { unreadCount });
}

export function getUnreadForUser(conv, uid) {
  return conv?.unreadCount?.[uid] || 0;
}

export function getConversationForUser(conversations, myUsername, otherUsername) {
  const convId = getConversationId(myUsername, otherUsername);
  return conversations.find((c) => c.id === convId) || null;
}
