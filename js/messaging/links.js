const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

export function extractUrls(text) {
  if (!text) return [];
  const matches = String(text).match(URL_REGEX) || [];
  return [...new Set(matches.map((u) => u.replace(/[.,;:!?)]+$/, "")))];
}

export function extractFirstUrl(text) {
  return extractUrls(text)[0] || null;
}

export function parseDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function buildBasicLinkPreview(url) {
  const domain = parseDomain(url);
  let title = domain;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    title = domain + path;
  } catch {
    /* ignore */
  }
  return {
    url,
    title,
    description: "",
    image: null,
    domain,
  };
}

export function linkifyText(text, escapeHtml) {
  if (!text) return "";
  const escaped = escapeHtml(text);
  return escaped.replace(URL_REGEX, (url) => {
    const clean = url.replace(/[.,;:!?)]+$/, "");
    const suffix = url.slice(clean.length);
    return `<a href="${clean}" target="_blank" rel="noopener noreferrer" class="msg-link">${clean}</a>${suffix}`;
  });
}

export function detectMessageType(text, hasImage = false) {
  if (hasImage) return "image";
  const url = extractFirstUrl(text);
  if (url && text.trim() === url) return "link";
  if (url) return "text";
  return "text";
}
