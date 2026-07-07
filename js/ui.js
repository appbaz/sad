import { getUserIndex } from "./users.js";

const AVATAR_COLORS = 10;

export function getInitial(name) {
  return (name || "?").charAt(0).toUpperCase();
}

export function getAvatarColorClass(userId) {
  const idx = getUserIndex(userId);
  return `avatar-color-${idx >= 0 ? idx % AVATAR_COLORS : 0}`;
}

export function formatTime(ts) {
  if (!ts) return "";
  const date = new Date(typeof ts === "number" ? ts : ts);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });

  if (isToday) return time;
  if (isYesterday) return "গতকাল";
  return date.toLocaleDateString("bn-BD", { day: "numeric", month: "short" });
}

export function formatDateSeparator(ts) {
  if (!ts) return "";
  const date = new Date(typeof ts === "number" ? ts : ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "আজ";
  if (isYesterday) return "গতকাল";
  return date.toLocaleDateString("bn-BD", { weekday: "long", day: "numeric", month: "long" });
}

export function showToast(message, type = "danger") {
  const container = document.getElementById("toastContainer");
  const id = `toast-${Date.now()}`;
  const html = `
    <div id="${id}" class="toast align-items-center text-bg-${type} border-0" role="alert">
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`;
  container.insertAdjacentHTML("beforeend", html);
  const el = document.getElementById(id);
  const toast = new bootstrap.Toast(el, { delay: 4000 });
  toast.show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function setConnectionBar(status, label) {
  const bar = document.getElementById("connectionBar");
  const text = document.getElementById("connectionText");
  bar.className = `connection-bar ${status}`;
  text.textContent = label;
}

export function showView(viewName) {
  document.getElementById("homeView")?.classList.toggle("d-none", viewName !== "home");
  document.getElementById("loginView")?.classList.toggle("d-none", viewName !== "join");
  document.getElementById("chatView")?.classList.toggle("d-none", viewName !== "chat");
}

export function setAuthTab(mode) {
  const isLogin = mode === "login";
  document.getElementById("loginForm")?.classList.toggle("d-none", !isLogin);
  document.getElementById("registerForm")?.classList.toggle("d-none", isLogin);
  document.getElementById("loginTabBtn")?.classList.toggle("active", isLogin);
  document.getElementById("registerTabBtn")?.classList.toggle("active", !isLogin);
}

export function setLoginLoading(loading) {
  document.getElementById("loginBtn").disabled = loading;
  document.querySelector(".login-btn-text")?.classList.toggle("d-none", loading);
  document.getElementById("loginSpinner")?.classList.toggle("d-none", !loading);
}

export function setRegisterLoading(loading) {
  document.getElementById("registerBtn").disabled = loading;
  document.querySelector(".register-btn-text")?.classList.toggle("d-none", loading);
  document.getElementById("registerSpinner")?.classList.toggle("d-none", !loading);
}

export function prefillRegisterForm(userId = "", name = "") {
  if (userId) document.getElementById("registerUserId").value = userId;
  if (name) document.getElementById("registerName").value = name;
}

export function prefillLoginUsername(userId = "") {
  if (userId) document.getElementById("loginUsername").value = userId;
}

export function updatePartnerHeader(partner, isOnline) {
  if (!partner) return;
  document.getElementById("partnerName").textContent = partner.name;
  document.getElementById("partnerStatus").textContent = isOnline ? "অনলাইন" : "অফলাইন";
  const avatar = document.getElementById("partnerAvatar");
  avatar.className = `avatar ${getAvatarColorClass(partner.id)}`;
  avatar.innerHTML = `${getInitial(partner.name)}${isOnline ? '<span class="online-dot"></span>' : ""}`;
}

export function showWaitingForPartner(shareLink = "") {
  document.getElementById("waitingPartner")?.classList.remove("d-none");
  document.getElementById("chatBody")?.classList.add("d-none");
  document.getElementById("partnerName").textContent = "সঙ্গীর অপেক্ষায়";
  document.getElementById("partnerStatus").textContent = "রেজিস্টার হয়নি";

  const hint = document.getElementById("waitingShareHint");
  if (hint && shareLink) {
    hint.textContent = shareLink;
  }
}

export function showChatReady(partner, isOnline) {
  document.getElementById("waitingPartner")?.classList.add("d-none");
  document.getElementById("chatBody")?.classList.remove("d-none");
  updatePartnerHeader(partner, isOnline);
}

export function isOwnMessage(msg, username, uid) {
  return (
    msg.senderId === username ||
    msg.senderName === username ||
    msg.senderUid === uid ||
    msg.senderId === uid
  );
}

export function renderMessages(messages, currentUsername, currentUid, pendingLocal = [], onRetry) {
  const container = document.getElementById("messages");
  document.getElementById("messagesSkeleton")?.remove();

  const all = [
    ...messages.map((m) => ({ ...m, status: m.status || "sent" })),
    ...pendingLocal.filter(
      (p) => !messages.some((m) => m.localId && m.localId === p.localId)
    ),
  ].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  if (all.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted py-5">
        <p class="mb-0">এখনো কোনো মেসেজ নেই। প্রথম মেসেজ পাঠান!</p>
      </div>`;
    return;
  }

  let html = "";
  let lastDate = "";

  all.forEach((msg) => {
    const ts = msg.createdAt?.toMillis?.() ?? msg.createdAt ?? Date.now();
    const dateLabel = formatDateSeparator(ts);
    if (dateLabel && dateLabel !== lastDate) {
      html += `<div class="date-separator"><span>${dateLabel}</span></div>`;
      lastDate = dateLabel;
    }

    const isOwn = isOwnMessage(msg, currentUsername, currentUid);
    const rowClass = isOwn ? "own" : "other";
    const pendingClass = msg.status === "pending" ? "pending" : "";
    const failedClass = msg.status === "failed" ? "failed" : "";

    let statusIcon = "";
    if (isOwn) {
      if (msg.status === "sending") statusIcon = "⏳";
      else if (msg.status === "pending") statusIcon = "🕐";
      else if (msg.status === "failed") statusIcon = "⚠";
      else statusIcon = "✓";
    }

    const retryBtn =
      msg.status === "failed" && msg.localId
        ? `<button class="retry-btn" data-local-id="${msg.localId}">আবার চেষ্টা</button>`
        : "";

    html += `
      <div class="msg-row ${rowClass}">
        <div class="msg-bubble ${pendingClass} ${failedClass}">
          ${escapeHtml(msg.text)}
          <div class="msg-meta">
            <span>${formatTime(ts)}</span>
            ${statusIcon ? `<span>${statusIcon}</span>` : ""}
            ${retryBtn}
          </div>
        </div>
      </div>`;
  });

  container.innerHTML = html;

  container.querySelectorAll(".retry-btn").forEach((btn) => {
    btn.addEventListener("click", () => onRetry?.(btn.dataset.localId));
  });

  scrollToBottom();
}

export function scrollToBottom(smooth = true) {
  const el = document.getElementById("messages");
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

export function focusMessageInput() {
  const input = document.getElementById("messageInput");
  if (input) input.focus();
}

export function clearMessageInput() {
  const input = document.getElementById("messageInput");
  input.value = "";
  input.style.height = "auto";
  document.getElementById("sendBtn").disabled = true;
}

export function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
}

export function showInstallBanner() {
  document.getElementById("installBanner").classList.remove("d-none");
}

export function hideInstallBanner() {
  document.getElementById("installBanner").classList.add("d-none");
}

export function setSendEnabled(enabled) {
  document.getElementById("sendBtn").disabled = !enabled;
}

export function setRegisterTabEnabled(enabled) {
  const tab = document.getElementById("registerTabBtn");
  const link = document.getElementById("goRegisterLink");
  if (tab) {
    tab.disabled = !enabled;
    tab.classList.toggle("disabled", !enabled);
  }
  if (link) link.classList.toggle("d-none", !enabled);
}

export function setQuickLoginMode(enabled, username = "") {
  const hint = document.getElementById("quickLoginHint");
  const usernameInput = document.getElementById("loginUsername");
  const loginBtnText = document.querySelector(".login-btn-text");

  hint?.classList.toggle("d-none", !enabled);

  if (enabled && username && usernameInput) {
    usernameInput.value = username;
  }

  if (loginBtnText) {
    loginBtnText.textContent = enabled ? "চালিয়ে যান" : "প্রবেশ করুন";
  }
}

export function setShareLink(link) {
  const input = document.getElementById("shareLinkInput");
  if (input) input.value = link || "";
}

export function setRoomInfo(roomId, memberCount = 0) {
  const codeEl = document.getElementById("roomCode");
  const statusEl = document.getElementById("roomStatus");
  if (codeEl) codeEl.textContent = roomId || "—";
  if (statusEl) {
    statusEl.textContent =
      memberCount >= 2 ? "রুম পূর্ণ" : `${memberCount}/২ জন যোগ দিয়েছে`;
  }
}

export function setHomeLoading(loading) {
  const btn = document.getElementById("createRoomBtn");
  const spinner = document.getElementById("createRoomSpinner");
  if (btn) btn.disabled = loading;
  spinner?.classList.toggle("d-none", !loading);
}

export function setJoinLoading(loading) {
  const btn = document.getElementById("joinRoomBtn");
  if (btn) btn.disabled = loading;
}

export function showInvalidRoom(message) {
  const el = document.getElementById("invalidRoomAlert");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("d-none");
}

export function hideInvalidRoom() {
  document.getElementById("invalidRoomAlert")?.classList.add("d-none");
}
