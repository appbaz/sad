export const MAX_USERS = 2;
export const MAX_MESSAGE_LENGTH = 1000;
export const MIN_USER_ID_LENGTH = 2;
export const MAX_USER_ID_LENGTH = 20;
export const APP_NAME = "Private Chat";
export const QUICK_LOGIN_IDLE_MS = 10 * 60 * 1000;
export const ONLINE_THRESHOLD_MS = 90 * 1000;

export function normalizeUserId(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, MAX_USER_ID_LENGTH);
}

export function validateUserId(id) {
  if (!id || id.length < MIN_USER_ID_LENGTH) {
    return "ইউজারনেম কমপক্ষে ২ অক্ষর হতে হবে";
  }
  if (!/^[a-z][a-z0-9_]*$/.test(id)) {
    return "ইউজারনেম ছোট হাতের ইংরেজি অক্ষর দিয়ে শুরু হতে হবে (a-z, 0-9, _)";
  }
  return null;
}

export function validateDisplayName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "নাম খালি রাখা যাবে না";
  if (trimmed.length > 40) return "নাম ৪০ অক্ষরের বেশি হতে পারবে না";
  return null;
}
