import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "../firebase.js";
import { getCurrentUser } from "../auth.js";
import {
  addToOutbox,
  generateLocalId,
  removeFromOutbox,
  updateOutboxMessage,
} from "../store.js";
import { MAX_MESSAGE_LENGTH } from "../constants.js";
import {
  MESSAGE_TYPES,
  normalizeMessage,
  buildMessagePayload,
  isMessageVisible,
} from "./message-model.js";
import { extractFirstUrl, buildBasicLinkPreview } from "./links.js";

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

export function listenRoomMeta(roomId, callback) {
  const ref = doc(db, "rooms", roomId, "meta", "settings");
  return onSnapshot(
    ref,
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      callback({
        clearedAt: data.clearedAt?.toMillis?.() ?? data.clearedAt ?? 0,
      });
    },
    () => callback({ clearedAt: 0 })
  );
}

export async function setRoomClearedAt(roomId) {
  await setDoc(
    doc(db, "rooms", roomId, "meta", "settings"),
    { clearedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function sendMessageToServer(roomId, payload, localId = null) {
  const me = getCurrentUser();
  if (!me) throw new Error("লগইন করা নেই");

  const messagesRef = collection(db, "rooms", roomId, "messages");
  await addDoc(messagesRef, {
    ...payload,
    createdAt: serverTimestamp(),
    localId,
  });

  await setDoc(
    doc(db, "rooms", roomId),
    { lastActivityAt: serverTimestamp() },
    { merge: true }
  ).catch(() => {});

  if (localId) await removeFromOutbox(localId);
}

function buildPayloadFromInput(me, text, options = {}) {
  const trimmed = (text || "").trim();
  const type = options.type || MESSAGE_TYPES.TEXT;
  const payload = buildMessagePayload(me, { text: trimmed, type });

  if (options.replyTo) payload.replyTo = options.replyTo;

  const url = extractFirstUrl(trimmed);
  if (options.imageUrl) {
    payload.type = MESSAGE_TYPES.IMAGE;
    payload.imageUrl = options.imageUrl;
    payload.imageThumbUrl = options.imageThumbUrl || options.imageUrl;
    payload.imageWidth = options.imageWidth || null;
    payload.imageHeight = options.imageHeight || null;
  } else if (type === MESSAGE_TYPES.LINK && url) {
    payload.type = MESSAGE_TYPES.LINK;
    payload.linkUrl = url;
    payload.linkPreview = options.linkPreview || buildBasicLinkPreview(url);
  } else if (url && trimmed === url) {
    payload.type = MESSAGE_TYPES.LINK;
    payload.linkUrl = url;
    payload.linkPreview = options.linkPreview || buildBasicLinkPreview(url);
  } else if (url) {
    payload.linkUrl = url;
    payload.linkPreview = buildBasicLinkPreview(url);
  }

  return payload;
}

export async function sendMessage(roomId, text, options = {}) {
  const me = getCurrentUser();
  if (!me) throw new Error("লগইন করা নেই");

  const trimmed = (text || "").trim();
  const isImage = Boolean(options.imageUrl);
  if (!trimmed && !isImage) return null;
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`মেসেজ ${MAX_MESSAGE_LENGTH} অক্ষরের বেশি হতে পারবে না`);
  }

  const localId = options.localId || generateLocalId();
  const payload = buildPayloadFromInput(me, trimmed, options);

  const optimistic = {
    id: localId,
    localId,
    ...payload,
    createdAt: Date.now(),
    status: "sending",
    pending: false,
  };

  if (!navigator.onLine) {
    await addToOutbox({
      id: localId,
      roomId,
      text: trimmed,
      type: payload.type,
      imageUrl: payload.imageUrl,
      replyTo: payload.replyTo,
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
    await sendMessageToServer(roomId, payload, localId);
    optimistic.status = "sent";
    return optimistic;
  } catch (err) {
    await addToOutbox({
      id: localId,
      roomId,
      text: trimmed,
      type: payload.type,
      imageUrl: payload.imageUrl,
      replyTo: payload.replyTo,
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

export async function sendImageMessage(roomId, imageUrl, meta = {}, caption = "") {
  return sendMessage(roomId, caption, {
    type: MESSAGE_TYPES.IMAGE,
    imageUrl,
    imageThumbUrl: imageUrl,
    imageWidth: meta.width,
    imageHeight: meta.height,
    replyTo: meta.replyTo,
  });
}

export async function retryOutboxMessage(item) {
  const me = getCurrentUser();
  if (!me) return false;

  await updateOutboxMessage(item.id, { status: "pending", retries: (item.retries || 0) + 1 });
  try {
    const payload = buildMessagePayload(me, {
      text: item.text,
      type: item.type || MESSAGE_TYPES.TEXT,
      imageUrl: item.imageUrl,
      replyTo: item.replyTo,
    });
    await sendMessageToServer(item.roomId, payload, item.id);
    await removeFromOutbox(item.id);
    return true;
  } catch {
    await updateOutboxMessage(item.id, { status: "failed" });
    return false;
  }
}

export function listenToMessages(roomId, callback, clearedAt = 0) {
  const q = query(
    collection(db, "rooms", roomId, "messages"),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs
        .map((d) => normalizeMessage({ id: d.id, ...d.data() }))
        .filter((m) => isMessageVisible(m, clearedAt));
      callback(messages);
    },
    (err) => {
      console.error("Message listener error:", err);
      callback(null, err);
    }
  );
}

export async function markMessageRead(roomId, messageId) {
  const me = getCurrentUser();
  if (!me?.username) return;
  const ref = doc(db, "rooms", roomId, "messages", messageId);
  await updateDoc(ref, {
    [`readBy.${me.username}`]: serverTimestamp(),
    read: true,
  }).catch(() => {});
}

export async function markMessagesRead(roomId, messages, myUsername) {
  const unread = messages.filter(
    (m) =>
      m.senderId !== myUsername &&
      !m.deletedAt &&
      !isAlreadyRead(m, myUsername)
  );
  if (!unread.length) return;

  unread.forEach((m) => pendingMarkReadIds.add(m.id));

  const batch = writeBatch(db);
  unread.slice(0, 50).forEach((m) => {
    const ref = doc(db, "rooms", roomId, "messages", m.id);
    batch.update(ref, {
      [`readBy.${myUsername}`]: serverTimestamp(),
      read: true,
    });
  });

  try {
    await batch.commit();
  } catch (err) {
    unread.forEach((m) => pendingMarkReadIds.delete(m.id));
    console.warn("markMessagesRead failed:", err);
  }
}

const pendingMarkReadIds = new Set();

function isAlreadyRead(msg, username) {
  if (!username) return false;
  if (pendingMarkReadIds.has(msg.id)) return true;
  const readBy = msg.readBy || {};
  return readBy[username] != null;
}

export function resetMarkReadCache() {
  pendingMarkReadIds.clear();
}

export async function softDeleteMessage(roomId, messageId) {
  const me = getCurrentUser();
  if (!me) throw new Error("লগইন করা নেই");
  await updateDoc(doc(db, "rooms", roomId, "messages", messageId), {
    deletedAt: serverTimestamp(),
    deletedBy: me.username,
    text: "",
  });
}

export async function toggleMessagePin(roomId, messageId, pinned) {
  await updateDoc(doc(db, "rooms", roomId, "messages", messageId), {
    pinned: Boolean(pinned),
    pinnedAt: pinned ? serverTimestamp() : null,
  });
}

export async function toggleReaction(roomId, messageId, emoji, currentReactions = {}) {
  const me = getCurrentUser();
  if (!me?.username) return;

  const users = Array.isArray(currentReactions[emoji]) ? [...currentReactions[emoji]] : [];
  const idx = users.indexOf(me.username);
  if (idx >= 0) users.splice(idx, 1);
  else users.push(me.username);

  const reactions = { ...currentReactions, [emoji]: users };
  if (!users.length) delete reactions[emoji];

  await updateDoc(doc(db, "rooms", roomId, "messages", messageId), { reactions });
}

export async function clearAllMessages(roomId) {
  const snap = await getDocs(collection(db, "rooms", roomId, "messages"));
  const BATCH = 400;
  for (let i = 0; i < snap.docs.length; i += BATCH) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + BATCH).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await setRoomClearedAt(roomId);
}

export function searchMessages(messages, queryText) {
  const q = String(queryText || "").trim().toLowerCase();
  if (!q) return [];
  return messages.filter((m) => {
    if (m.deletedAt) return false;
    const text = (m.text || "").toLowerCase();
    const link = (m.linkUrl || "").toLowerCase();
    const name = (m.senderName || "").toLowerCase();
    return text.includes(q) || link.includes(q) || name.includes(q);
  });
}
