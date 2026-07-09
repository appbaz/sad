import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { MAX_MEMBERS_PER_ROOM, normalizeRoomCode, validateRoomCode } from "./constants.js";

function mapRoomDoc(d) {
  return {
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toMillis?.() ?? 0,
  };
}

export async function createRoom(label, rawRoomCode) {
  const roomId = normalizeRoomCode(rawRoomCode);
  const codeError = validateRoomCode(roomId);
  if (codeError) throw new Error(codeError);

  const existing = await getDoc(doc(db, "rooms", roomId));
  if (existing.exists()) {
    throw new Error("এই রুম কোড ইতিমধ্যে আছে — অন্য কোড ব্যবহার করুন");
  }

  await setDoc(doc(db, "rooms", roomId), {
    label: String(label || "").trim() || roomId,
    code: roomId,
    memberCount: 0,
    maxMembers: MAX_MEMBERS_PER_ROOM,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  });

  return roomId;
}

export async function getRoom(roomId) {
  const snap = await getDoc(doc(db, "rooms", roomId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function listRooms() {
  try {
    const snap = await getDocs(query(collection(db, "rooms"), orderBy("createdAt", "desc")));
    return snap.docs.map(mapRoomDoc);
  } catch (err) {
    if (err?.code !== "failed-precondition") throw err;
    const snap = await getDocs(collection(db, "rooms"));
    return snap.docs.map(mapRoomDoc).sort((a, b) => b.createdAt - a.createdAt);
  }
}

export async function setRoomStatus(roomId, status) {
  await updateDoc(doc(db, "rooms", roomId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRoom(roomId) {
  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error("রুম পাওয়া যায়নি");

  try {
    const membersSnap = await getDocs(collection(db, "rooms", roomId, "members"));
    for (const member of membersSnap.docs) {
      await deleteDoc(member.ref);
    }
  } catch (err) {
    if (err?.code === "permission-denied") {
      throw new Error("সদস্য মুছতে অনুমতি নেই — firestore.rules Publish করুন");
    }
    throw err;
  }

  try {
    const messagesSnap = await getDocs(collection(db, "rooms", roomId, "messages"));
    let batch = writeBatch(db);
    let ops = 0;
    for (const msg of messagesSnap.docs) {
      batch.delete(msg.ref);
      ops++;
      if (ops >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
  } catch (err) {
    if (err?.code === "permission-denied") {
      throw new Error("মেসেজ মুছতে অনুমতি নেই — firestore.rules Publish করুন");
    }
    throw err;
  }

  try {
    const presenceSnap = await getDocs(collection(db, "rooms", roomId, "presence"));
    for (const p of presenceSnap.docs) {
      await deleteDoc(p.ref);
    }
    const metaSnap = await getDocs(collection(db, "rooms", roomId, "meta"));
    for (const m of metaSnap.docs) {
      await deleteDoc(m.ref);
    }
  } catch {
    /* optional cleanup */
  }

  try {
    await deleteDoc(roomRef);
  } catch (err) {
    if (err?.code === "permission-denied") {
      throw new Error("রুম মুছতে অনুমতি নেই — firestore.rules Publish করুন");
    }
    throw err;
  }
}

export function isRoomFull(room) {
  return (room?.memberCount || 0) >= MAX_MEMBERS_PER_ROOM;
}
