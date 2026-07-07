import { ROOM_ID_PATTERN } from "./constants.js";

const RESERVED_SEGMENTS = new Set(["admin", "index.html", "css", "js", "icons"]);

let routeCallback = null;

export function getAppBasePath() {
  const el = document.querySelector('script[src*="js/app.js"]');
  if (!el) return "/";
  const jsPath = new URL(el.getAttribute("src"), window.location.href).pathname;
  const base = jsPath.replace(/js\/app\.js$/, "");
  return base.endsWith("/") ? base : `${base}/`;
}

function getPathSegment() {
  const base = getAppBasePath();
  const rest = window.location.pathname.slice(base.length).replace(/^\/+|\/+$/g, "");
  if (!rest) return null;
  return rest.split("/")[0].toLowerCase();
}

function migrateLegacyHashIfNeeded() {
  const hash = window.location.hash || "";
  if (!hash) return;

  const roomMatch = hash.match(/^#\/?room\/([a-z0-9_-]+)/i);
  if (roomMatch) {
    const id = roomMatch[1].toLowerCase();
    if (ROOM_ID_PATTERN.test(id)) {
      history.replaceState(null, "", `${getAppBasePath()}${id}`);
      return;
    }
  }

  if (/^#\/?admin\/?$/i.test(hash)) {
    history.replaceState(null, "", `${getAppBasePath()}admin`);
  }
}

export function restoreSpaRedirect() {
  const redirect = sessionStorage.getItem("spa-path");
  if (!redirect) return;
  sessionStorage.removeItem("spa-path");
  const target = redirect.split("?")[0];
  if (target && target !== window.location.pathname) {
    history.replaceState(null, "", redirect);
  }
}

function emitRouteChange() {
  routeCallback?.(parseRoute());
}

function navigateTo(path) {
  const base = getAppBasePath();
  const url = path.startsWith("/") ? path : `${base}${path}`;
  if (`${window.location.pathname}${window.location.search}` === url) {
    emitRouteChange();
    return;
  }
  history.pushState(null, "", url);
  emitRouteChange();
}

export function parseRoute() {
  migrateLegacyHashIfNeeded();

  const segment = getPathSegment();
  if (segment === "admin") {
    return { view: "admin" };
  }
  if (segment && !RESERVED_SEGMENTS.has(segment) && ROOM_ID_PATTERN.test(segment)) {
    return { view: "room", roomId: segment };
  }
  return { view: "home" };
}

/** @deprecated use parseRoute — kept for compatibility */
export function getRoomIdFromHash() {
  const route = parseRoute();
  return route.view === "room" ? route.roomId : null;
}

export function navigateToRoom(roomId) {
  navigateTo(String(roomId || "").toLowerCase());
}

export function navigateToAdmin() {
  navigateTo("admin");
}

export function navigateToHome() {
  navigateTo(getAppBasePath());
}

export function buildShareLink(roomId) {
  const id = String(roomId || "").toLowerCase();
  return `${window.location.origin}${getAppBasePath()}${id}`;
}

export function parseRoomIdFromInput(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;

  const hashPatterns = [/#\/?room\/([a-z0-9_-]+)/i];
  for (const pattern of hashPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const id = match[1].toLowerCase();
      if (ROOM_ID_PATTERN.test(id)) return id;
    }
  }

  try {
    const url = trimmed.startsWith("http")
      ? new URL(trimmed)
      : new URL(trimmed, window.location.origin);
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1]?.toLowerCase();
    if (last && !RESERVED_SEGMENTS.has(last) && last !== "admin" && ROOM_ID_PATTERN.test(last)) {
      return last;
    }
  } catch {
    /* not a URL */
  }

  const code = trimmed.toLowerCase();
  if (ROOM_ID_PATTERN.test(code)) return code;
  return null;
}

export function onRouteChange(callback) {
  routeCallback = callback;
  const handler = () => callback(parseRoute());
  window.addEventListener("popstate", handler);
  restoreSpaRedirect();
  handler();
}
