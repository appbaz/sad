import { APP_NAME } from "./constants.js";
import { formatLastSeen } from "./ui/format.js";
import { getInitial, getAvatarColorClass, bindMessagesScroll } from "./ui-messages.js";

export { formatTime, formatDateSeparator } from "./ui/format.js";
export {
  renderMessages,
  scrollToBottom,
  bindMessagesScroll,
  isOwnMessage,
  showMessageContextMenu,
  showReactionPicker,
  showReplyPreview,
  showSearchOverlay,
  showImageLightbox,
  downloadImage,
  renderPinnedBar,
  setUploadProgress,
  pulseSendButton,
  resetMessageRenderCache,
  getInitial,
  getAvatarColorClass,
} from "./ui-messages.js";

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

let currentView = null;

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

    if (currentView && currentView !== viewName && active) {
      const prev = document.getElementById(views[currentView]);
      prev?.classList.add("view-exit");
      setTimeout(() => prev?.classList.remove("view-exit"), 320);
    }

    el.classList.toggle("d-none", !active);
    if (active) {
      el.classList.add("view-enter");
      setTimeout(() => el.classList.remove("view-enter"), 400);
    }
    if (key === "chat") {
      el.classList.toggle("view-active", active);
    }
  });

  currentView = viewName;
}

export function updatePartnerHeader(partner, isOnline, lastSeen = 0, isTyping = false) {
  if (!partner) return;
  document.getElementById("partnerName").textContent = partner.name;
  const statusEl = document.getElementById("partnerStatus");
  if (statusEl) {
    let statusText = formatLastSeen(lastSeen, isOnline);
    if (isOnline && isTyping) {
      statusText = "অনলাইন · লিখছেন…";
      statusEl.classList.add("is-typing");
    } else {
      statusEl.classList.remove("is-typing");
    }
    statusEl.textContent = statusText;
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
    statusEl.classList.remove("is-online", "is-typing");
  }
}

export function showChatReady(partner, isOnline, lastSeen = 0) {
  document.getElementById("waitingPartner")?.classList.add("d-none");
  const body = document.getElementById("chatBody");
  body?.classList.remove("d-none");
  body?.classList.add("chat-body-visible");
  updatePartnerHeader(partner, isOnline, lastSeen, false);
  bindMessagesScroll();
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
      title: `${APP_NAME} ইনস্টল করুন`,
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
      title: `${APP_NAME} ইনস্টল করুন`,
      text: "ঠিকানা বারে ইনস্টল (⊕) আইকনে ক্লিক করুন",
      btn: "গাইড দেখুন",
      showBtn: true,
    },
    edge: {
      ios: false,
      title: `${APP_NAME} ইনস্টল করুন`,
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
      title: `${APP_NAME} ইনস্টল করুন`,
      text: "মেনু (☰) → Install অথবা Page → Install App (যদি থাকে)",
      btn: "গাইড দেখুন",
      showBtn: true,
    },
    generic: {
      ios: false,
      title: `${APP_NAME} ইনস্টল করুন`,
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
  document.getElementById("installBanner")?.classList.add("d-none");
}

export function setSendEnabled(enabled) {
  document.getElementById("sendBtn").disabled = !enabled;
}

export function toggleRoomMenu(open) {
  document.getElementById("roomMenu")?.classList.toggle("d-none", !open);
}

export function setClearChatVisible(visible) {
  document.getElementById("clearChatBtn")?.classList.toggle("d-none", !visible);
}

export function setNotifySettingsMenuVisible(visible) {
  document.getElementById("notifySettingsBtn")?.classList.toggle("d-none", !visible);
}

const CHIP_LABELS = {
  ready: "প্রস্তুত",
  app_off: "বন্ধ (অ্যাপ)",
  blocked: "ব্লক (সেটিংস)",
  admin_off: "অ্যাডমিন বন্ধ",
  unsupported: "সাপোর্ট নেই",
};

const CHIP_CLASS = {
  ready: "chip-ready",
  app_off: "chip-off",
  blocked: "chip-blocked",
  admin_off: "chip-admin",
  unsupported: "chip-unsupported",
};

export function openNotifySettingsSheet() {
  const sheet = document.getElementById("notifySettingsSheet");
  if (!sheet) return;
  sheet.classList.remove("d-none");
  sheet.hidden = false;
}

export function closeNotifySettingsSheet() {
  const sheet = document.getElementById("notifySettingsSheet");
  if (!sheet) return;
  sheet.classList.add("d-none");
  sheet.hidden = true;
}

export function isNotifySettingsSheetOpen() {
  const sheet = document.getElementById("notifySettingsSheet");
  return Boolean(sheet && !sheet.classList.contains("d-none") && !sheet.hidden);
}

/**
 * @param {object} snap — getNotifySettingsSnapshot result
 */
export function renderNotifySettingsSheet(snap) {
  if (!snap) return;

  const chip = document.getElementById("notifyStatusChip");
  if (chip) {
    const key = snap.chip || "app_off";
    chip.textContent = CHIP_LABELS[key] || key;
    chip.className = `notify-chip ${CHIP_CLASS[key] || "chip-off"}`;
  }

  const toggle = document.getElementById("notifyReceiveToggle");
  if (toggle) toggle.checked = Boolean(snap.enabledInApp);

  const adminLine = document.getElementById("notifyAdminGateLine");
  if (adminLine) {
    if (snap.memberId === "m1") {
      adminLine.classList.remove("d-none");
      adminLine.textContent = snap.adminPushM1
        ? "রুম অ্যাডমিন m1 নোটিফ চালু রেখেছে"
        : "রুম অ্যাডমিন m1 নোটিফ বন্ধ রেখেছে — আপনার টগল চালু থাকলেও পুশ আসবে না";
    } else {
      adminLine.classList.add("d-none");
      adminLine.textContent = "";
    }
  }

  const guide = document.getElementById("notifyDeniedGuide");
  if (guide) {
    if (snap.permission === "denied" && snap.deniedSteps?.length) {
      guide.classList.remove("d-none");
      guide.textContent = snap.deniedSteps.join("\n");
    } else {
      guide.classList.add("d-none");
      guide.textContent = "";
    }
  }

  const list = document.getElementById("notifyDeviceList");
  const keepBtn = document.getElementById("notifyKeepThisDeviceBtn");
  if (list) {
    const devices = snap.devices || [];
    if (!devices.length) {
      list.innerHTML = `<li class="text-muted">কোনো রেজিস্টার্ড ডিভাইস নেই</li>`;
    } else {
      list.innerHTML = devices
        .map((d) => {
          const when = d.updatedAt
            ? new Date(d.updatedAt).toLocaleString("bn-BD", {
                dateStyle: "short",
                timeStyle: "short",
              })
            : "—";
          const label = d.isCurrent ? "এই ডিভাইস" : "অন্য ডিভাইস";
          return `<li><span>${label}</span><span class="device-meta">${when}</span></li>`;
        })
        .join("");
    }
    const others = devices.filter((d) => !d.isCurrent).length;
    if (keepBtn) {
      keepBtn.classList.toggle("d-none", others === 0 || !snap.subscribed);
      keepBtn.textContent =
        others > 0 ? `শুধু এই ডিভাইস রাখুন (অন্য ${others}টি সরান)` : "শুধু এই ডিভাইস রাখুন";
    }
  }
}
