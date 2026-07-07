import { ROOM_ID_PATTERN } from "./constants.js";

const ADMIN_HASHES = ["#/admin", "#admin"];

function isAdminRoute(hash) {
  return ADMIN_HASHES.some((h) => hash === h || hash.startsWith(`${h}/`));
}

function extractRoomId(hash) {
  const patterns = [/^#\/room\/([a-z0-9_-]+)/i, /^#room\/([a-z0-9_-]+)/i];
  for (const pattern of patterns) {
    const match = hash.match(pattern);
    if (match) {
      const id = match[1].toLowerCase();
      if (ROOM_ID_PATTERN.test(id)) return id;
    }
  }
  return null;
}

export function parseRoute() {
  const hash = window.location.hash || "";
  if (isAdminRoute(hash)) {
    return { view: "admin" };
  }
  const roomId = extractRoomId(hash);
  if (roomId) return { view: "room", roomId };
  return { view: "home" };
}

export function getRoomIdFromHash() {
  return extractRoomId(window.location.hash || "");
}

export function navigateToRoom(roomId) {
  window.location.hash = `/room/${roomId}`;
}

export function navigateToAdmin() {
  window.location.hash = "/admin";
}

export function navigateToHome() {
  window.location.hash = "";
}

export function buildShareLink(roomId) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/room/${roomId}`;
}

export function parseRoomIdFromInput(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;

  const patterns = [/#\/room\/([a-z0-9_-]+)/i, /#room\/([a-z0-9_-]+)/i];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const id = match[1].toLowerCase();
      if (ROOM_ID_PATTERN.test(id)) return id;
    }
  }

  const code = trimmed.toLowerCase();
  if (ROOM_ID_PATTERN.test(code)) return code;
  return null;
}

export function onRouteChange(callback) {
  const handler = () => callback(parseRoute());
  window.addEventListener("hashchange", handler);
  handler();
}
