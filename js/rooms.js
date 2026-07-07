import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { MAX_MEMBERS_PER_ROOM } from "./constants.js";

export function generateRoomId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function createRoom() {
  const roomId = generateRoomId();
  const existing = await getDoc(doc(db, "rooms", roomId));
  if (existing.exists()) return createRoom();

  await setDoc(doc(db, "rooms", roomId), {
    createdAt: serverTimestamp(),
    memberCount: 0,
    status: "waiting",
    lastActivityAt: serverTimestamp(),
  });

  return roomId;
}

export async function getRoom(roomId) {
  const snap = await getDoc(doc(db, "rooms", roomId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function isRoomFull(room) {
  return (room?.memberCount || 0) >= MAX_MEMBERS_PER_ROOM;
}
