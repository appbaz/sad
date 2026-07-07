import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import {
  MAX_MEMBERS_PER_ROOM,
  validateUserId,
  validateDisplayName,
  normalizeUserId,
} from "./constants.js";

let membersCache = [];
let activeRoomId = null;

function membersRef(roomId) {
  return collection(db, "rooms", roomId, "members");
}

function memberDoc(roomId, username) {
  return doc(db, "rooms", roomId, "members", username);
}

function sortMembers(members) {
  return [...members].sort((a, b) => a.name.localeCompare(b.name));
}

export function getMembers() {
  return sortMembers(membersCache);
}

export function getMemberById(id) {
  return membersCache.find((u) => u.id === id) || null;
}

export function getOtherMember(currentUsername) {
  return membersCache.find((u) => u.id !== currentUsername) || null;
}

export function getMemberCount() {
  return membersCache.length;
}

export function canRegister() {
  return membersCache.length < MAX_MEMBERS_PER_ROOM;
}

export function getUserIndex(id) {
  const sorted = sortMembers(membersCache);
  return sorted.findIndex((u) => u.id === id);
}

export async function fetchMembersOnce(roomId) {
  activeRoomId = roomId;
  try {
    const snap = await getDocs(query(membersRef(roomId), orderBy("name")));
    membersCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    if (err?.code === "failed-precondition") {
      const snap = await getDocs(membersRef(roomId));
      membersCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      throw err;
    }
  }
  return sortMembers(membersCache);
}

export function listenToMembers(roomId, callback) {
  activeRoomId = roomId;
  return onSnapshot(
    query(membersRef(roomId), orderBy("name")),
    (snap) => {
      membersCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(sortMembers(membersCache));
    },
    (err) => {
      console.error("members listener error:", err);
      callback(sortMembers(membersCache), err);
    }
  );
}

export async function createMember(roomId, rawId, rawName) {
  const id = normalizeUserId(rawId);
  const idError = validateUserId(id);
  if (idError) throw new Error(idError);

  const name = String(rawName || "").trim();
  const nameError = validateDisplayName(name);
  if (nameError) throw new Error(nameError);

  const roomRef = doc(db, "rooms", roomId);
  const newMemberRef = memberDoc(roomId, id);

  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) {
      throw new Error("রুম পাওয়া যায়নি — লিংক যাচাই করুন");
    }

    const memberCount = roomSnap.data().memberCount || 0;
    if (memberCount >= MAX_MEMBERS_PER_ROOM) {
      throw new Error("রুম পূর্ণ — আর কেউ যোগ দিতে পারবে না");
    }

    const existing = await tx.get(newMemberRef);
    if (existing.exists()) {
      throw new Error("এই ইউজারনেম ইতিমধ্যে আছে — প্রবেশ করুন");
    }

    tx.set(newMemberRef, {
      id,
      name,
      joinedAt: serverTimestamp(),
    });

    const newCount = memberCount + 1;
    tx.update(roomRef, {
      memberCount: newCount,
      status: newCount >= MAX_MEMBERS_PER_ROOM ? "active" : "waiting",
      lastActivityAt: serverTimestamp(),
      ...(newCount === 1 ? { createdBy: id } : {}),
    });
  });

  membersCache = [...membersCache, { id, name }];
}

export function clearMembersCache() {
  membersCache = [];
  activeRoomId = null;
}

export function getActiveRoomId() {
  return activeRoomId;
}
