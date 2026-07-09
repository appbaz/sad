import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  endBefore,
  Timestamp,
  writeBatch,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "../firebase.js";
import { getCurrentUser } from "../auth.js";
import {
  PURGE_BATCH_SIZE,
  RETENTION_DAYS_DEFAULT,
  IMAGE_STRIP_DAYS_DEFAULT,
  MAINTENANCE_INTERVAL_MS,
} from "../constants.js";
import { normalizeMessage, MESSAGE_TYPES } from "./message-model.js";

/** Never purge unless every recipient (non-sender) has readBy set */
export function isSafeToPurge(msg, memberIds) {
  if (!msg || msg.pinned || msg.deletedAt) return false;
  if (!Array.isArray(memberIds) || memberIds.length < 1) return false;

  for (const id of memberIds) {
    if (id === msg.senderId) continue;
    if (msg.readBy?.[id] == null) return false;
  }
  return true;
}

export function isSafeToStripImage(msg, memberIds) {
  if (!msg || msg.pinned || msg.deletedAt || msg.imageStripped) return false;
  if (msg.type !== MESSAGE_TYPES.IMAGE || !msg.imageUrl) return false;
  return isSafeToPurge(msg, memberIds);
}

function messagesCol(roomId) {
  return collection(db, "rooms", roomId, "messages");
}

export async function purgeFullyReadMessages(roomId, memberIds, retentionDays = RETENTION_DAYS_DEFAULT) {
  const me = getCurrentUser();
  if (!me || !roomId || retentionDays < 1) return { deleted: 0 };

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let totalDeleted = 0;

  for (let round = 0; round < 5; round++) {
    const snap = await getDocs(
      query(
        messagesCol(roomId),
        orderBy("createdAt", "asc"),
        endBefore(Timestamp.fromMillis(cutoff)),
        limit(PURGE_BATCH_SIZE)
      )
    );

    if (snap.empty) break;

    const batch = writeBatch(db);
    let batchCount = 0;

    snap.docs.forEach((d) => {
      const msg = normalizeMessage({ id: d.id, ...d.data() });
      if (!isSafeToPurge(msg, memberIds)) return;
      batch.delete(d.ref);
      batchCount++;
    });

    if (batchCount === 0) break;
    await batch.commit();
    totalDeleted += batchCount;
    if (snap.docs.length < PURGE_BATCH_SIZE) break;
  }

  return { deleted: totalDeleted };
}

export async function stripSeenImages(roomId, memberIds, stripDays = IMAGE_STRIP_DAYS_DEFAULT) {
  const me = getCurrentUser();
  if (!me || !roomId || stripDays < 1) return { stripped: 0 };

  const cutoff = Date.now() - stripDays * 24 * 60 * 60 * 1000;
  let totalStripped = 0;

  for (let round = 0; round < 5; round++) {
    const snap = await getDocs(
      query(
        messagesCol(roomId),
        orderBy("createdAt", "asc"),
        endBefore(Timestamp.fromMillis(cutoff)),
        limit(PURGE_BATCH_SIZE)
      )
    );

    if (snap.empty) break;

    const batch = writeBatch(db);
    let batchCount = 0;

    snap.docs.forEach((d) => {
      const msg = normalizeMessage({ id: d.id, ...d.data() });
      if (!isSafeToStripImage(msg, memberIds)) return;
      if (msg.imageUrl?.startsWith("data:")) {
        batch.update(d.ref, {
          imageUrl: null,
          imageThumbUrl: null,
          imageStripped: true,
          imageStrippedAt: serverTimestamp(),
        });
        batchCount++;
      }
    });

    if (batchCount === 0) break;
    await batch.commit();
    totalStripped += batchCount;
    if (snap.docs.length < PURGE_BATCH_SIZE) break;
  }

  return { stripped: totalStripped };
}

export async function runRoomMaintenance(roomId, memberIds, meta = {}) {
  const me = getCurrentUser();
  if (!me || !roomId) return;

  const lastAt = meta.lastMaintenanceAt || 0;
  if (lastAt && Date.now() - lastAt < MAINTENANCE_INTERVAL_MS) return;

  const retentionDays = meta.retentionDays || RETENTION_DAYS_DEFAULT;
  const imageStripDays = meta.imageStripDays || IMAGE_STRIP_DAYS_DEFAULT;

  await stripSeenImages(roomId, memberIds, imageStripDays);
  await purgeFullyReadMessages(roomId, memberIds, retentionDays);

  await setDoc(
    doc(db, "rooms", roomId, "meta", "settings"),
    { lastMaintenanceAt: serverTimestamp() },
    { merge: true }
  ).catch(() => {});
}
