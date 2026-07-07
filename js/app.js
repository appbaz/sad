import {
  getMemberById,
  getOtherMember,
  getMembers,
  fetchMembersOnce,
  listenToMembers,
  createMember,
  canRegister,
} from "./users.js";
import { login, logout, register, onAuthChange, sendHeartbeat, getCurrentUser, canQuickLogin, getQuickLoginUsername, markDeviceOffline, isUsernameOnline } from "./auth.js";
import { isInstallDismissed, dismissInstallPrompt, getPendingMessages, touchDeviceSession } from "./store.js";
import {
  enableOfflinePersistence,
  sendMessage,
  listenToMessages,
  listenToUsers,
  markConversationRead,
  getConversationId,
  prepareConversation,
} from "./chat.js";
import { initOfflineSync, onConnectionStatusChange, flushOutbox, retryOutboxMessage } from "./offline.js";
import { normalizeUserId } from "./constants.js";
import {
  setAuthTab,
  setRegisterLoading,
  prefillRegisterForm,
  prefillLoginUsername,
  showView,
  showToast,
  setLoginLoading,
  renderMessages,
  focusMessageInput,
  clearMessageInput,
  autoResizeTextarea,
  setSendEnabled,
  setConnectionBar,
  showInstallBanner,
  hideInstallBanner,
  showWaitingForPartner,
  showChatReady,
  updatePartnerHeader,
  setRegisterTabEnabled,
  setQuickLoginMode,
} from "./ui.js";
import {
  bindSoundUnlock,
  loadSoundPreference,
  saveSoundPreference,
  isSoundEnabled,
  playSend,
  playReceive,
  playLogin,
  playLogout,
  playError,
  playOnline,
  playOffline,
  playTap,
  playSync,
  playSentConfirm,
} from "./sounds.js";
import { formatFirebaseError } from "./errors.js";

let partnerUsername = null;
let unsubscribeMessages = null;
let unsubscribeUsers = null;
let unsubscribeMembers = null;
let pendingLocalMessages = [];
let members = [];
let usersOnline = [];
let deferredInstallPrompt = null;
let heartbeatTimer = null;
let isLoggingIn = false;
let sessionStarted = false;
let prevConnectionStatus = "online";
let knownMessageIds = new Set();
let messagesInitialized = false;
let currentMessages = [];
let quickLoginActive = false;

async function refreshQuickLoginUI(username = null) {
  const inputUsername = normalizeUserId(
    username || document.getElementById("loginUsername")?.value || ""
  );
  const quickUser = await getQuickLoginUsername();
  const enabled = Boolean(
    quickUser &&
    (!inputUsername || inputUsername === quickUser) &&
    (await canQuickLogin(inputUsername || quickUser))
  );

  quickLoginActive = enabled;
  setQuickLoginMode(enabled, enabled ? (inputUsername || quickUser) : null);
}

async function init() {
  registerServiceWorker();
  initInstallPrompt();
  bindSoundUnlock();
  await loadSoundPreference();
  updateSoundToggleUI();
  initOfflineSync();
  onConnectionStatusChange(handleConnectionChange);
  await enableOfflinePersistence();

  try {
    await fetchMembersOnce();
    members = getMembers();
    setRegisterTabEnabled(canRegister());
  } catch (err) {
    console.warn("members fetch failed:", err);
  }

  setAuthTab("login");
  await refreshQuickLoginUI();

  document.getElementById("loginUsername")?.addEventListener("input", () => {
    refreshQuickLoginUI();
  });

  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("registerForm").addEventListener("submit", handleRegister);
  document.getElementById("loginTabBtn").addEventListener("click", () => { playTap(); setAuthTab("login"); });
  document.getElementById("registerTabBtn").addEventListener("click", () => {
    if (!canRegister()) {
      showToast("ইতিমধ্যে ২ জন রেজিস্টার হয়েছে");
      return;
    }
    playTap();
    setAuthTab("register");
  });
  document.getElementById("goRegisterLink").addEventListener("click", () => {
    if (!canRegister()) {
      showToast("ইতিমধ্যে ২ জন রেজিস্টার হয়েছে");
      return;
    }
    playTap();
    prefillRegisterForm(document.getElementById("loginUsername").value.trim());
    setAuthTab("register");
  });
  document.getElementById("goLoginLink").addEventListener("click", () => {
    playTap();
    prefillLoginUsername(document.getElementById("registerUserId").value.trim());
    setAuthTab("login");
  });
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  document.getElementById("soundToggleBtn").addEventListener("click", handleSoundToggle);
  document.getElementById("sendBtn").addEventListener("click", handleSend);
  document.getElementById("messageInput").addEventListener("input", handleInputChange);
  document.getElementById("messageInput").addEventListener("keydown", handleInputKeydown);

  onAuthChange(async (user) => {
    if (isLoggingIn) return;
    if (user) enterChat(user);
    else {
      exitChat();
      await refreshQuickLoginUI();
    }
  });

  initDeviceLifecycle();
}

function initDeviceLifecycle() {
  const markActive = () => touchDeviceSession().catch(() => {});

  document.addEventListener("click", markActive, { passive: true });
  document.addEventListener("keydown", markActive, { passive: true });
  document.addEventListener("touchstart", markActive, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && getCurrentUser()) {
      sendHeartbeat();
      touchDeviceSession().catch(() => {});
    }
  });

  window.addEventListener("pagehide", () => {
    markDeviceOffline();
  });
}

function onMembersUpdated(list) {
  members = list;
  setRegisterTabEnabled(canRegister());

  const me = getCurrentUser();
  if (!me) return;

  const partner = getOtherMember(me.username);
  if (partner && !partnerUsername) {
    openPartnerChat(partner);
  } else if (!partner) {
    showWaitingForPartner();
  }
}

function handleConnectionChange(status, label) {
  setConnectionBar(status, label);
  if (prevConnectionStatus === "offline" && status === "online") playOnline();
  else if (prevConnectionStatus !== "offline" && status === "offline") playOffline();
  else if (prevConnectionStatus === "syncing" && status === "online") playSync();
  prevConnectionStatus = status;
}

function updateSoundToggleUI() {
  const on = isSoundEnabled();
  document.getElementById("soundOnIcon")?.classList.toggle("d-none", !on);
  document.getElementById("soundOffIcon")?.classList.toggle("d-none", on);
  const btn = document.getElementById("soundToggleBtn");
  if (btn) btn.title = on ? "সাউন্ড বন্ধ করুন" : "সাউন্ড চালু করুন";
}

async function handleSoundToggle() {
  await saveSoundPreference(!isSoundEnabled());
  updateSoundToggleUI();
  if (isSoundEnabled()) playTap();
}

function enterChat(user) {
  showView("chat");
  if (!sessionStarted) {
    startChatSession();
    sessionStarted = true;
  }
  const partner = getOtherMember(user.username);
  if (partner) openPartnerChat(partner);
  else showWaitingForPartner();
}

function exitChat() {
  stopChatSession();
  sessionStarted = false;
  partnerUsername = null;
  showView("login");
}

async function handleLogin(e) {
  e.preventDefault();
  const secret = document.getElementById("secretInput").value;
  const rawUsername = document.getElementById("loginUsername").value;
  const username = normalizeUserId(rawUsername);
  const quick = quickLoginActive && (await canQuickLogin(username));

  if (!rawUsername.trim()) {
    showToast("ইউজারনেম দিন");
    playError();
    return;
  }

  if (!quick && !secret) {
    showToast("সিক্রেট ও ইউজারনেম দিন");
    playError();
    return;
  }

  try {
    await fetchMembersOnce();
    members = getMembers();
    setRegisterTabEnabled(canRegister());
  } catch { /* proceed */ }

  if (members.length > 0 && !getMemberById(username)) {
    playError();
    if (canRegister()) {
      showToast("ইউজার পাওয়া যায়নি — রেজিস্টার করুন");
      prefillRegisterForm(username);
      setAuthTab("register");
    } else {
      showToast("ভুল ইউজারনেম");
    }
    return;
  }

  setLoginLoading(true);
  isLoggingIn = true;
  try {
    const user = await login(secret, username, { quick });
    enterChat(user);
    playLogin();
    showToast("স্বাগতম!", "success");
  } catch (err) {
    console.error("Login failed:", err);
    playError();
    showToast(formatFirebaseError(err));
  } finally {
    isLoggingIn = false;
    setLoginLoading(false);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const secret = document.getElementById("registerSecret").value;
  const rawId = document.getElementById("registerUserId").value;
  const name = document.getElementById("registerName").value.trim();
  const userId = normalizeUserId(rawId);

  if (!secret || !rawId.trim() || !name) {
    showToast("সব তথ্য পূরণ করুন");
    playError();
    return;
  }

  try {
    await fetchMembersOnce();
    members = getMembers();
  } catch { /* proceed */ }

  if (!canRegister()) {
    playError();
    showToast("ইতিমধ্যে ২ জন রেজিস্টার হয়েছে — প্রবেশ করুন");
    setAuthTab("login");
    return;
  }

  if (getMemberById(userId)) {
    playError();
    showToast("এই ইউজারনেম আছে — প্রবেশ করুন");
    prefillLoginUsername(userId);
    setAuthTab("login");
    return;
  }

  setRegisterLoading(true);
  isLoggingIn = true;
  try {
    const user = await register(secret, rawId, name);
    enterChat(user);
    playLogin();
    showToast("রেজিস্টার সফল!", "success");
    setRegisterTabEnabled(false);
  } catch (err) {
    console.error("Register failed:", err);
    playError();
    showToast(formatFirebaseError(err));
  } finally {
    isLoggingIn = false;
    setRegisterLoading(false);
  }
}

async function handleLogout() {
  playLogout();
  await logout();
  exitChat();
  showToast("লগআউট হয়েছে", "success");
}

function handleInputChange(e) {
  autoResizeTextarea(e.target);
  setSendEnabled(e.target.value.trim().length > 0);
}

function handleInputKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

async function handleSend() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text || !partnerUsername) return;

  const me = getCurrentUser();
  if (!me) return;

  clearMessageInput();
  playSend();

  try {
    const optimistic = await sendMessage(partnerUsername, text);
    if (optimistic) {
      pendingLocalMessages.push(optimistic);
      renderMessages(currentMessages, me.username, me.uid, pendingLocalMessages, handleRetry);
    }
    if (navigator.onLine) flushOutbox();
  } catch (err) {
    console.error("Send failed:", err);
    playError();
    showToast(formatFirebaseError(err));
  }
}

async function handleRetry(localId) {
  const pending = await getPendingMessages();
  const item = pending.find((p) => p.id === localId);
  if (!item) return;

  const ok = await retryOutboxMessage(item);
  if (ok) {
    pendingLocalMessages = pendingLocalMessages.filter((m) => m.localId !== localId);
    playSentConfirm();
    showToast("মেসেজ পাঠানো হয়েছে", "success");
  } else {
    playError();
    showToast("পাঠানো ব্যর্থ — আবার চেষ্টা করুন");
  }
}

function startChatSession() {
  const me = getCurrentUser();
  if (!me) return;

  unsubscribeMembers = listenToMembers(onMembersUpdated);

  unsubscribeUsers = listenToUsers((users) => {
    usersOnline = users;
    if (partnerUsername) {
      const partner = getMemberById(partnerUsername);
      if (partner) updatePartnerHeader(partner, isUsernameOnline(users, partnerUsername));
    }
  });

  heartbeatTimer = setInterval(sendHeartbeat, 30000);
  sendHeartbeat();
}

function stopChatSession() {
  if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }
  if (unsubscribeUsers) { unsubscribeUsers(); unsubscribeUsers = null; }
  if (unsubscribeMembers) { unsubscribeMembers(); unsubscribeMembers = null; }
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

async function openPartnerChat(partner) {
  const me = getCurrentUser();
  if (!me || !partner) return;

  partnerUsername = partner.id;
  const onlineUser = isUsernameOnline(usersOnline, partner.id);
  showChatReady(partner, onlineUser);
  focusMessageInput();

  if (unsubscribeMessages) unsubscribeMessages();

  let convId;
  try {
    convId = await prepareConversation(me.username, partner.id);
  } catch (err) {
    console.error("Conversation prepare failed:", err);
    playError();
    showToast(formatFirebaseError(err));
    return;
  }

  pendingLocalMessages = [];
  knownMessageIds = new Set();
  messagesInitialized = false;

  unsubscribeMessages = listenToMessages(convId, async (messages, err) => {
    if (err) {
      console.error("Messages sync error:", err);
      showToast("মেসেজ লোড করা যায়নি — পেজ রিফ্রেশ করুন");
      return;
    }
    if (messages === null) return;

    if (!messagesInitialized) {
      messages.forEach((m) => knownMessageIds.add(m.id));
      messagesInitialized = true;
    } else {
      const incoming = messages.filter(
        (m) => !knownMessageIds.has(m.id) && m.senderId !== me.username && m.senderName !== me.username
      );
      if (incoming.length > 0) playReceive();
      messages.forEach((m) => knownMessageIds.add(m.id));
    }

    currentMessages = messages;

    const pending = await getPendingMessages();
    pendingLocalMessages = pending
      .filter((p) => p.convId === convId)
      .map((p) => ({
        id: p.id,
        localId: p.id,
        senderId: me.username,
        senderName: me.displayName || me.username,
        text: p.text,
        createdAt: p.createdAt,
        status: p.status === "failed" ? "failed" : "pending",
        pending: true,
      }));

    messages.forEach((m) => {
      if (m.localId) {
        pendingLocalMessages = pendingLocalMessages.filter((p) => p.localId !== m.localId);
      }
    });

    renderMessages(currentMessages, me.username, me.uid, pendingLocalMessages, handleRetry);
    await markConversationRead(convId);
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  }
}

function initInstallPrompt() {
  window.addEventListener("beforeinstallprompt", async (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const dismissed = await isInstallDismissed();
    if (!dismissed) showInstallBanner();
  });

  document.getElementById("installBtn")?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    hideInstallBanner();
  });

  document.getElementById("dismissInstallBtn")?.addEventListener("click", async () => {
    await dismissInstallPrompt();
    hideInstallBanner();
  });
}

init();
