import {
  signInAnonymously,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { createTeamUser } from "./users.js";
import { normalizeUserId, validateUserId, QUICK_LOGIN_IDLE_MS } from "./constants.js";
import { sha256Hex } from "./crypto-utils.js";
import {
  getDeviceSession,
  saveDeviceSession,
  clearDeviceSession,
  touchDeviceSession,
} from "./store.js";

let currentUserDoc = null;

export async function hashSecret(secret) {
  return sha256Hex(secret);
}

async function validateSecret(secret) {
  const configRef = doc(db, "config", "app");
  const snap = await getDoc(configRef);
  if (!snap.exists()) {
    throw new Error("অ্যাপ কনফিগার করা হয়নি। Firebase Console-এ config/app সেট করুন।");
  }
  const storedHash = snap.data().secretHash;
  const inputHash = await hashSecret(secret);
  if (inputHash !== storedHash) {
    throw new Error("ভুল সিক্রেট। আবার চেষ্টা করুন।");
  }
}

export async function canQuickLogin(username) {
  const normalized = normalizeUserId(username);
  if (!normalized) return false;

  const session = await getDeviceSession();
  if (!session?.username || session.username !== normalized) return false;
  if (!session.secretVerifiedAt) return false;

  const lastActive = session.lastActiveAt || session.secretVerifiedAt;
  return Date.now() - lastActive < QUICK_LOGIN_IDLE_MS;
}

export async function getQuickLoginUsername() {
  const session = await getDeviceSession();
  if (!session?.username) return null;
  return (await canQuickLogin(session.username)) ? session.username : null;
}

async function attachDeviceSession(uid, username) {
  const memberSnap = await getDoc(doc(db, "members", username));
  if (!memberSnap.exists()) {
    throw new Error("এই ইউজারনেম নেই — রেজিস্টার করুন।");
  }
  const userMeta = memberSnap.data();
  const userRef = doc(db, "users", uid);

  await setDoc(
    userRef,
    {
      username,
      displayName: userMeta.name,
      isOnline: true,
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "usernames", username),
    {
      username,
      displayName: userMeta.name,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const userSnap = await getDoc(userRef);
  currentUserDoc = { uid, ...userSnap.data() };
  return currentUserDoc;
}

export async function login(secret, rawUsername, options = {}) {
  const username = normalizeUserId(rawUsername);
  const idError = validateUserId(username);
  if (idError) throw new Error(idError);

  const quick =
    options.quick === true ||
    (options.quick !== false && (await canQuickLogin(username)));

  if (!quick) {
    if (!secret) throw new Error("সিক্রেট দিন");
    await validateSecret(secret);
  }

  const cred = await signInAnonymously(auth);
  try {
    const user = await attachDeviceSession(cred.user.uid, username);
    const now = Date.now();
    const existing = await getDeviceSession();
    await saveDeviceSession({
      username,
      secretVerifiedAt: quick ? (existing?.secretVerifiedAt || now) : now,
      lastActiveAt: now,
    });
    return user;
  } catch (err) {
    await signOut(auth);
    throw err;
  }
}

export async function register(secret, rawId, rawName) {
  const username = normalizeUserId(rawId);
  const idError = validateUserId(username);
  if (idError) throw new Error(idError);

  if (!secret) throw new Error("সিক্রেট দিন");

  const cred = await signInAnonymously(auth);
  try {
    await validateSecret(secret);
    await createTeamUser(rawId, rawName);
    const user = await attachDeviceSession(cred.user.uid, username);
    await saveDeviceSession({
      username,
      secretVerifiedAt: Date.now(),
      lastActiveAt: Date.now(),
    });
    return user;
  } catch (err) {
    await signOut(auth);
    throw err;
  }
}

export async function logout() {
  await markDeviceOffline();
  currentUserDoc = null;
  await clearDeviceSession();
  await signOut(auth);
}

export async function markDeviceOffline() {
  if (!auth.currentUser) return;
  await setDoc(
    doc(db, "users", auth.currentUser.uid),
    { isOnline: false, lastSeen: serverTimestamp() },
    { merge: true }
  ).catch(() => {});
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      currentUserDoc = null;
      callback(null);
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      currentUserDoc = null;
      callback(null);
      return;
    }

    currentUserDoc = { uid: user.uid, ...snap.data() };
    await setDoc(
      userRef,
      { isOnline: true, lastSeen: serverTimestamp() },
      { merge: true }
    ).catch(() => {});
    await touchDeviceSession().catch(() => {});
    callback(currentUserDoc);
  });
}

export function getCurrentUser() {
  return currentUserDoc;
}

export async function refreshCurrentUser() {
  if (!auth.currentUser) return null;
  const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
  if (snap.exists()) {
    currentUserDoc = { uid: auth.currentUser.uid, ...snap.data() };
  }
  return currentUserDoc;
}

export async function sendHeartbeat() {
  if (!auth.currentUser) return;
  await setDoc(
    doc(db, "users", auth.currentUser.uid),
    { isOnline: true, lastSeen: serverTimestamp() },
    { merge: true }
  ).catch(() => {});
  await touchDeviceSession().catch(() => {});
}

export function isUserRecentlyActive(lastSeen, thresholdMs = 90 * 1000) {
  if (!lastSeen) return false;
  const ts = typeof lastSeen === "number" ? lastSeen : lastSeen;
  return Date.now() - ts < thresholdMs;
}

export function isUsernameOnline(users, username, thresholdMs = 90 * 1000) {
  return users.some(
    (user) =>
      user.username === username &&
      user.isOnline &&
      isUserRecentlyActive(user.lastSeen, thresholdMs)
  );
}
