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

export function formatLastSeen(lastSeen, isOnline = false) {
  if (isOnline) return "অনলাইন";

  if (!lastSeen) return "অফলাইন";

  const ts = typeof lastSeen === "number" ? lastSeen : lastSeen?.toMillis?.() ?? 0;
  if (!ts) return "অফলাইন";

  const diff = Date.now() - ts;
  if (diff < 60 * 1000) return "এইমাত্র দেখা";
  if (diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / 60000);
    return `${mins} মিনিট আগে`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} ঘণ্টা আগে`;
  }

  const date = new Date(ts);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const time = date.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });

  if (date.toDateString() === yesterday.toDateString()) {
    return `গতকাল ${time}`;
  }

  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days} দিন আগে`;

  return date.toLocaleDateString("bn-BD", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
