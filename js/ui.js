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
  const views = {
    home: "homeView",
    admin: "adminView",
    chat: "chatView",
  };
  Object.entries(views).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const active = key === viewName;
    el.classList.toggle("d-none", !active);
    if (key === "chat") {
      el.classList.toggle("view-active", active);
    }
  });
}

export function updatePartnerHeader(partner, isOnline) {
  if (!partner) return;
  document.getElementById("partnerName").textContent = partner.name;
  const statusEl = document.getElementById("partnerStatus");
  if (statusEl) {
    statusEl.textContent = isOnline ? "অনলাইন" : "অফলাইন";
    statusEl.classList.toggle("is-online", isOnline);
  }
  const avatar = document.getElementById("partnerAvatar");
  avatar.className = `avatar avatar-lg ${getAvatarColorClass(partner.id)}`;
  avatar.innerHTML = `${getInitial(partner.name)}${isOnline ? '<span class="online-dot"></span>' : ""}`;
}

export function showWaitingForPartner() {
  const waiting = document.getElementById("waitingPartner");
  const body = document.getElementById("chatBody");
  waiting?.classList.remove("d-none");
  body?.classList.add("d-none");
  document.getElementById("partnerName").textContent = "সঙ্গীর অপেক্ষায়";
  const statusEl = document.getElementById("partnerStatus");
  if (statusEl) {
    statusEl.textContent = "অপেক্ষায়";
    statusEl.classList.remove("is-online");
  }
}

export function showChatReady(partner, isOnline) {
  document.getElementById("waitingPartner")?.classList.add("d-none");
  const body = document.getElementById("chatBody");
  body?.classList.remove("d-none");
  body?.classList.add("chat-body-visible");
  updatePartnerHeader(partner, isOnline);
  bindMessagesScroll();
}

function renderStatusIcon(status) {
  if (status === "sending" || status === "pending") {
    return `<span class="msg-status pending" aria-label="পাঠানো হচ্ছে">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>
    </span>`;
  }
  if (status === "failed") {
    return `<span class="msg-status failed" aria-label="ব্যর্থ">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/></svg>
    </span>`;
  }
  return `<span class="msg-status sent" aria-label="পাঠানো হয়েছে">
    <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><path d="M10.97 1.46a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 0 1 0 1.06l-6.25 6.25a.75.75 0 0 1-1.06 0L.97 6.53a.75.75 0 0 1 0-1.06l1.5-1.5a.75.75 0 0 1 1.06 0l3.22 3.22 5.22-5.22z"/></svg>
  </span>`;
}

function getMessageGroupClasses(isOwn, isFirst, isLast) {
  const classes = [];
  if (isFirst) classes.push("msg-first");
  if (!isFirst && !isLast) classes.push("msg-middle");
  if (!isFirst && isLast) classes.push("msg-last");
  if (!isFirst) classes.push("msg-grouped");
  return classes.join(" ");
}

let scrollListenerBound = false;

export function bindMessagesScroll() {
  if (scrollListenerBound) return;
  const el = document.getElementById("messages");
  const btn = document.getElementById("scrollBottomBtn");
  if (!el || !btn) return;

  scrollListenerBound = true;
  el.addEventListener("scroll", () => {
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    btn.classList.toggle("d-none", nearBottom);
  });
  btn.addEventListener("click", () => scrollToBottom(true));
}

export function isOwnMessage(msg, username, uid) {
  return (
    msg.senderId === username ||
    msg.senderName === username ||
    msg.senderUid === uid ||
    msg.senderId === uid
  );
}

export function renderMessages(messages, currentUsername, currentUid, pendingLocal = [], onRetry, partner = null) {
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
      <div class="chat-empty">
        <div class="chat-empty-icon">
          <svg width="36" height="36" fill="currentColor" viewBox="0 0 16 16"><path d="M2.678 11.894a1 1 0 0 1 .287.801 10.97 10.97 0 0 1-.398 2c1.395-.323 2.674-.394 2.865-1.204a1 1 0 0 1 1.316 1.316c-.72 3.08-3.386 3.125-5.053 3.125A1 1 0 0 1 0 13.5a11.96 11.96 0 0 1 .678-1.894zm8.931-6.03a1 1 0 0 1 .698-.698l2.865-.803a1 1 0 0 1 1.316 1.316l-.803 2.865a1 1 0 0 1-.698.698l-2.865.803a1 1 0 0 1-1.316-1.316l.803-2.865zM8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0z"/></svg>
        </div>
        <h3 class="chat-empty-title">কথোপকথন শুরু করুন</h3>
        <p>প্রথম মেসেজ পাঠান — এটি শুধু আপনার সঙ্গী দেখতে পারবে</p>
      </div>`;
    return;
  }

  let html = "";
  let lastDate = "";
  let animIndex = 0;

  const partnerAvatarHtml = partner
    ? `<div class="msg-avatar avatar avatar-sm ${getAvatarColorClass(partner.id)}" aria-hidden="true">${getInitial(partner.name)}</div>`
    : `<div class="msg-avatar msg-avatar-spacer" aria-hidden="true"></div>`;

  all.forEach((msg, index) => {
    const ts = msg.createdAt?.toMillis?.() ?? msg.createdAt ?? Date.now();
    const dateLabel = formatDateSeparator(ts);
    if (dateLabel && dateLabel !== lastDate) {
      html += `<div class="date-separator"><span>${dateLabel}</span></div>`;
      lastDate = dateLabel;
    }

    const isOwn = isOwnMessage(msg, currentUsername, currentUid);
    const prevOwn = index > 0 ? isOwnMessage(all[index - 1], currentUsername, currentUid) : null;
    const nextOwn = index < all.length - 1 ? isOwnMessage(all[index + 1], currentUsername, currentUid) : null;
    const isFirst = prevOwn !== isOwn;
    const isLast = nextOwn !== isOwn;
    const rowClass = isOwn ? "own" : "other";
    const groupClass = getMessageGroupClasses(isOwn, isFirst, isLast);
    const pendingClass = msg.status === "pending" || msg.status === "sending" ? "pending" : "";
    const failedClass = msg.status === "failed" ? "failed" : "";
    const delay = Math.min(animIndex * 0.02, 0.3);
    animIndex += 1;

    const statusHtml = isOwn ? renderStatusIcon(msg.status) : "";
    const retryBtn =
      msg.status === "failed" && msg.localId
        ? `<button class="retry-btn" data-local-id="${msg.localId}">আবার চেষ্টা</button>`
        : "";

    const avatarSlot = isOwn ? "" : isLast ? partnerAvatarHtml : `<div class="msg-avatar msg-avatar-spacer" aria-hidden="true"></div>`;

    html += `
      <div class="msg-row ${rowClass} ${groupClass}" style="animation-delay:${delay}s">
        ${avatarSlot}
        <div class="msg-bubble ${pendingClass} ${failedClass}">
          <div class="msg-body">
            <span class="msg-text">${escapeHtml(msg.text)}</span>
            <div class="msg-meta">
              <span class="msg-time">${formatTime(ts)}</span>
              ${statusHtml}
              ${retryBtn}
            </div>
          </div>
        </div>
      </div>`;
  });

  const wasNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
  container.innerHTML = html;

  container.querySelectorAll(".retry-btn").forEach((btn) => {
    btn.addEventListener("click", () => onRetry?.(btn.dataset.localId));
  });

  if (wasNearBottom || animIndex <= 3) scrollToBottom();
  bindMessagesScroll();
}

export function scrollToBottom(smooth = true) {
  const el = document.getElementById("messages");
  const btn = document.getElementById("scrollBottomBtn");
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  btn?.classList.add("d-none");
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

export function showInstallBanner(mode = "native") {
  const banner = document.getElementById("installBanner");
  if (!banner) return;

  const configs = {
    native: {
      ios: false,
      title: "Chat App ইনস্টল করুন",
      text: "এক ক্লিকে ইনস্টল করুন — দ্রুত ও অফলাইন অ্যাক্সেস",
      btn: "ইনস্টল",
      showBtn: true,
    },
    ios: {
      ios: true,
      title: "হোম স্ক্রিনে যোগ করুন",
      text: "Safari-তে শেয়ার (□↑) → Add to Home Screen",
      btn: "",
      showBtn: false,
    },
    chrome: {
      ios: false,
      title: "Chat App ইনস্টল করুন",
      text: "ঠিকানা বারে ইনস্টল (⊕) আইকনে ক্লিক করুন",
      btn: "গাইড দেখুন",
      showBtn: true,
    },
    edge: {
      ios: false,
      title: "Chat App ইনস্টল করুন",
      text: "ঠিকানা বারে 'অ্যাপ হিসেবে ইনস্টল করুন' ক্লিক করুন",
      btn: "গাইড দেখুন",
      showBtn: true,
    },
    safari: {
      ios: true,
      title: "অ্যাপ হিসেবে যোগ করুন",
      text: "Safari → File → Add to Dock অথবা Share → Add to Home Screen",
      btn: "",
      showBtn: false,
    },
    firefox: {
      ios: false,
      title: "Chat App ইনস্টল করুন",
      text: "মেনু (☰) → Install অথবা Page → Install App (যদি থাকে)",
      btn: "গাইড দেখুন",
      showBtn: true,
    },
    generic: {
      ios: false,
      title: "Chat App ইনস্টল করুন",
      text: "ব্রাউজার মেনু থেকে 'হোম স্ক্রিনে যোগ করুন' বা 'Install app' খুঁজুন",
      btn: "গাইড দেখুন",
      showBtn: true,
    },
  };

  const config = configs[mode] || configs.generic;
  banner.classList.toggle("ios-mode", config.ios);
  banner.dataset.installMode = mode;

  const title = document.getElementById("installBannerTitle");
  const text = document.getElementById("installBannerText");
  const installBtn = document.getElementById("installBtn");

  if (title) title.textContent = config.title;
  if (text) text.textContent = config.text;
  if (installBtn) {
    installBtn.textContent = config.btn || "ইনস্টল";
    installBtn.classList.toggle("d-none", !config.showBtn);
  }

  banner.classList.remove("d-none");
}

export function hideInstallBanner() {
  document.getElementById("installBanner").classList.add("d-none");
}

export function setSendEnabled(enabled) {
  document.getElementById("sendBtn").disabled = !enabled;
}
