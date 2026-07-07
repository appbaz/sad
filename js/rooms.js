import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { MAX_MEMBERS_PER_ROOM, normalizeRoomCode, validateRoomCode } from "./constants.js";
import { sha256Hex } from "./crypto-utils.js";

export async function createRoom(label, password, rawRoomCode) {
  const roomId = normalizeRoomCode(rawRoomCode);
  const codeError = validateRoomCode(roomId);
  if (codeError) throw new Error(codeError);

  const existing = await getDoc(doc(db, "rooms", roomId));
  if (existing.exists()) {
    throw new Error("এই রুম কোড ইতিমধ্যে আছে — অন্য কোড ব্যবহার করুন");
  }

  const passwordHash = await sha256Hex(password);
  await setDoc(doc(db, "rooms", roomId), {
    label: String(label || "").trim() || roomId,
    code: roomId,
    passwordHash,
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
  const snap = await getDocs(query(collection(db, "rooms"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toMillis?.() ?? 0,
  }));
}

export async function updateRoomPassword(roomId, newPassword) {
  const passwordHash = await sha256Hex(newPassword);
  await updateDoc(doc(db, "rooms", roomId), {
    passwordHash,
    updatedAt: serverTimestamp(),
  });
}

export async function setRoomStatus(roomId, status) {
  await updateDoc(doc(db, "rooms", roomId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export function isRoomFull(room) {
  return (room?.memberCount || 0) >= MAX_MEMBERS_PER_ROOM;
}

export function buildShareLink(roomId) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/room/${roomId}`;
}
