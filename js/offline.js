import { getPendingMessages, updateOutboxMessage, removeFromOutbox } from "./store.js";
import { sendMessageToServer, retryOutboxMessage } from "./messaging/messages.js";
import { getCurrentUser } from "./auth.js";
import { buildMessagePayload, MESSAGE_TYPES } from "./messaging/message-model.js";

let connectionStatus = "online";
let statusCallback = null;
let isFlushing = false;

const STATUS_LABELS = {
  online: "অনলাইন",
  offline: "অফলাইন — মেসেজ পরে পাঠানো হবে",
  syncing: "সিঙ্ক হচ্ছে...",
};

export function getConnectionStatus() {
  return connectionStatus;
}

export function onConnectionStatusChange(callback) {
  statusCallback = callback;
  callback(connectionStatus, STATUS_LABELS[connectionStatus]);
}

function setStatus(status) {
  connectionStatus = status;
  if (statusCallback) {
    statusCallback(status, STATUS_LABELS[status]);
  }
}

export async function flushOutbox() {
  if (isFlushing || !navigator.onLine) return;
  isFlushing = true;
  setStatus("syncing");

  try {
    const pending = await getPendingMessages();
    for (const item of pending) {
      if (item.status === "failed" && (item.retries || 0) >= 3) continue;

      await updateOutboxMessage(item.id, { status: "pending" });
      try {
        const me = getCurrentUser();
        if (!me) throw new Error("লগইন করা নেই");
        const payload = buildMessagePayload(me, {
          text: item.text,
          type: item.type || MESSAGE_TYPES.TEXT,
          imageUrl: item.imageUrl,
          replyTo: item.replyTo,
        });
        await sendMessageToServer(item.roomId, payload, item.id);
        await removeFromOutbox(item.id);
      } catch {
        const retries = (item.retries || 0) + 1;
        await updateOutboxMessage(item.id, {
          status: retries >= 3 ? "failed" : "pending",
          retries,
        });
      }
    }
  } finally {
    isFlushing = false;
    setStatus(navigator.onLine ? "online" : "offline");
  }
}

export function initOfflineSync() {
  setStatus(navigator.onLine ? "online" : "offline");

  window.addEventListener("online", () => {
    setStatus("syncing");
    flushOutbox();
  });

  window.addEventListener("offline", () => {
    setStatus("offline");
  });

  if (navigator.onLine) {
    flushOutbox();
  }
}

export { retryOutboxMessage };
