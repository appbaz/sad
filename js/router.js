import { ROOM_ID_PATTERN } from "./constants.js";

const ROOM_ROUTE_PREFIX = "#/room/";

export function getRoomIdFromHash() {
  const hash = window.location.hash || "";
  if (!hash.startsWith(ROOM_ROUTE_PREFIX)) return null;
  const id = hash.slice(ROOM_ROUTE_PREFIX.length).split(/[?#/]/)[0];
  return id && ROOM_ID_PATTERN.test(id) ? id : null;
}

export function navigateToRoom(roomId) {
  const next = `${ROOM_ROUTE_PREFIX}${roomId}`;
  if (window.location.hash !== next) {
    window.location.hash = `room/${roomId}`;
  }
}

export function buildShareLink(roomId) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/room/${roomId}`;
}

export function parseRoomIdFromInput(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;

  const hashMatch = trimmed.match(/#\/room\/([a-zA-Z0-9_-]+)/);
  if (hashMatch && ROOM_ID_PATTERN.test(hashMatch[1])) return hashMatch[1];

  if (ROOM_ID_PATTERN.test(trimmed)) return trimmed;
  return null;
}

export function onRouteChange(callback) {
  const handler = () => callback(getRoomIdFromHash());
  window.addEventListener("hashchange", handler);
  handler();
}
