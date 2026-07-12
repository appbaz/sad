/**
 * GitBridge media upload Worker
 * POST /v1/media — Firebase ID token + multipart file → Google Drive
 * GET  /v1/media/:fileId/thumb — authenticated thumbnail proxy
 * GET  /health
 */

const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,thumbnailLink";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
]);

/** @type {Map<string, {n:number, t:number}>} */
const memRate = new Map();

export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx);
    } catch (err) {
      console.error(err);
      return json({ error: "internal_error", message: "সার্ভার ত্রুটি" }, 500);
    }
  },
};

async function handle(request, env, ctx) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return cors(new Response(null, { status: 204 }));
  }

  if (url.pathname === "/health" && request.method === "GET") {
    return cors(json({ ok: true, service: "gitbridge-media-upload" }));
  }

  const thumbMatch = url.pathname.match(/^\/v1\/media\/([^/]+)\/thumb$/);
  if (thumbMatch && request.method === "GET") {
    return cors(await handleThumb(request, env, thumbMatch[1]));
  }

  if (url.pathname === "/v1/media" && request.method === "POST") {
    return cors(await handleUpload(request, env));
  }

  return cors(json({ error: "not_found" }, 404));
}

async function handleUpload(request, env) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const rate = checkRate(auth.uid, env);
  if (rate) return rate;

  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return json({ error: "bad_request", message: "multipart/form-data লাগবে" }, 400);
  }

  const form = await request.formData();
  const roomId = String(form.get("roomId") || "").trim();
  const kind = String(form.get("kind") || "image").trim();
  const file = form.get("file");

  if (!roomId || !file || typeof file === "string") {
    return json({ error: "bad_request", message: "roomId ও file লাগবে" }, 400);
  }

  if (auth.roomId !== roomId) {
    return json({ error: "forbidden", message: "রুমে অনুমতি নেই" }, 403);
  }

  const memberOk = await verifyRoomMember(env, auth.uid, roomId, auth.username);
  if (!memberOk) {
    return json({ error: "forbidden", message: "রুম মেম্বার নন" }, 403);
  }

  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return json({ error: "unsupported_media", message: "ফাইল টাইপ অনুমোদিত নয়" }, 415);
  }

  const maxImage = Number(env.MAX_IMAGE_BYTES || 2_097_152);
  const maxVideo = Number(env.MAX_VIDEO_BYTES || 26_214_400);
  const maxBytes = kind === "video" || mime.startsWith("video/") ? maxVideo : maxImage;
  if (file.size > maxBytes) {
    return json({ error: "too_large", message: "ফাইল খুব বড়" }, 413);
  }

  const accessToken = await getDriveAccessToken(env);
  const rootId = await ensureFolder(accessToken, "root", env.DRIVE_ROOT_FOLDER_NAME || "GitBridge");
  const roomFolderId = await ensureFolder(accessToken, rootId, sanitizeId(roomId));
  const now = new Date();
  const yFolder = await ensureFolder(accessToken, roomFolderId, String(now.getUTCFullYear()));
  const mFolder = await ensureFolder(
    accessToken,
    yFolder,
    String(now.getUTCMonth() + 1).padStart(2, "0")
  );

  const safeName = sanitizeFilename(file.name || `upload-${Date.now()}`);
  const meta = {
    name: `${Date.now()}_${auth.username}_${safeName}`,
    parents: [mFolder],
    appProperties: {
      roomId,
      uploaderUid: auth.uid,
      uploader: auth.username,
      kind,
    },
  };

  const boundary = "gitbridge_" + crypto.randomUUID().replace(/-/g, "");
  const fileBuf = await file.arrayBuffer();
  const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`;
  const filePartHead = `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`;
  const end = `\r\n--${boundary}--`;

  const body = concatBytes(
    new TextEncoder().encode(metaPart),
    new TextEncoder().encode(filePartHead),
    new Uint8Array(fileBuf),
    new TextEncoder().encode(end)
  );

  const uploadRes = await fetch(DRIVE_UPLOAD, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!uploadRes.ok) {
    const t = await uploadRes.text();
    console.error("drive upload failed", uploadRes.status, t);
    return json({ error: "drive_upload_failed", message: "Drive আপলোড ব্যর্থ" }, 502);
  }

  const created = await uploadRes.json();
  await setAnyoneWithLink(accessToken, created.id);

  const origin = new URL(request.url).origin;
  const viewUrl = `https://drive.google.com/uc?export=view&id=${created.id}`;
  const thumbUrl = `${origin}/v1/media/${created.id}/thumb`;

  return json({
    fileId: created.id,
    viewUrl,
    thumbUrl,
    mimeType: created.mimeType || mime,
    bytes: Number(created.size || file.size),
  });
}

async function handleThumb(request, env, fileId) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const rate = checkRate(auth.uid + ":thumb", env);
  if (rate) return rate;

  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(fileId)) {
    return json({ error: "bad_request" }, 400);
  }

  const accessToken = await getDriveAccessToken(env);
  const metaRes = await fetch(
    `${DRIVE_FILES}/${encodeURIComponent(fileId)}?fields=id,mimeType,appProperties,thumbnailLink`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!metaRes.ok) {
    return json({ error: "not_found", message: "ফাইল পাওয়া যায়নি" }, 404);
  }
  const meta = await metaRes.json();
  const fileRoom = meta.appProperties?.roomId;
  if (fileRoom && fileRoom !== auth.roomId) {
    return json({ error: "forbidden", message: "অনুমতি নেই" }, 403);
  }

  // Prefer Drive media download for images; for video return 415 (use client player with viewUrl)
  if (meta.mimeType?.startsWith("video/")) {
    if (meta.thumbnailLink) {
      const t = await fetch(meta.thumbnailLink);
      if (t.ok) {
        return new Response(t.body, {
          status: 200,
          headers: {
            "Content-Type": t.headers.get("Content-Type") || "image/jpeg",
            "Cache-Control": "private, max-age=300",
          },
        });
      }
    }
    return json({ error: "no_thumb", message: "ভিডিও থাম্ব নেই" }, 404);
  }

  const mediaRes = await fetch(
    `${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!mediaRes.ok) {
    return json({ error: "fetch_failed", message: "মিডিয়া লোড ব্যর্থ" }, 502);
  }

  return new Response(mediaRes.body, {
    status: 200,
    headers: {
      "Content-Type": meta.mimeType || "application/octet-stream",
      "Cache-Control": "private, max-age=300",
    },
  });
}

async function requireAuth(request, env) {
  const header = request.headers.get("Authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return json({ error: "unauthorized", message: "লগইন প্রয়োজন" }, 401);
  }
  try {
    const payload = await verifyFirebaseIdToken(m[1], env.FIREBASE_PROJECT_ID);
    const profile = await getUserProfile(env, payload.user_id || payload.sub);
    if (!profile?.roomId || !profile?.username) {
      return json({ error: "unauthorized", message: "প্রোফাইল নেই — রুমে লগইন করুন" }, 401);
    }
    return {
      uid: payload.user_id || payload.sub,
      roomId: profile.roomId,
      username: profile.username,
    };
  } catch (e) {
    console.error("auth failed", e);
    return json({ error: "unauthorized", message: "টোকেন অবৈধ বা মেয়াদোত্তীর্ণ" }, 401);
  }
}

async function verifyFirebaseIdToken(token, projectId) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed");
  const header = JSON.parse(atobUrl(parts[0]));
  const payload = JSON.parse(atobUrl(parts[1]));
  if (payload.aud !== projectId) throw new Error("bad aud");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("bad iss");
  if ((payload.exp || 0) * 1000 < Date.now()) throw new Error("expired");

  const jwks = await (await fetch(JWKS_URL)).json();
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("no jwk");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBuf(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!ok) throw new Error("bad sig");
  return payload;
}

async function getUserProfile(env, uid) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT secret required");
  }
  return getUserProfileWithSa(env, uid);
}

async function getUserProfileWithSa(env, uid) {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const accessToken = await getGoogleSaAccessToken(sa, [
    "https://www.googleapis.com/auth/datastore",
    "https://www.googleapis.com/auth/cloud-platform",
  ]);
  const projectId = env.FIREBASE_PROJECT_ID;
  const path = `projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
  const res = await fetch(`https://firestore.googleapis.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const doc = await res.json();
  const fields = doc.fields || {};
  return {
    roomId: fields.roomId?.stringValue || null,
    username: fields.username?.stringValue || null,
  };
}

async function verifyRoomMember(env, uid, roomId, username) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    return false;
  }
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const accessToken = await getGoogleSaAccessToken(sa, [
    "https://www.googleapis.com/auth/datastore",
    "https://www.googleapis.com/auth/cloud-platform",
  ]);
  const projectId = env.FIREBASE_PROJECT_ID;
  const path = `projects/${projectId}/databases/(default)/documents/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(username)}`;
  const res = await fetch(`https://firestore.googleapis.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok;
}

async function getDriveAccessToken(env) {
  if (!env.DRIVE_CLIENT_ID || !env.DRIVE_CLIENT_SECRET || !env.DRIVE_REFRESH_TOKEN) {
    throw new Error("Drive secrets missing");
  }
  const body = new URLSearchParams({
    client_id: env.DRIVE_CLIENT_ID,
    client_secret: env.DRIVE_CLIENT_SECRET,
    refresh_token: env.DRIVE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error("drive token failed: " + (await res.text()));
  }
  const data = await res.json();
  return data.access_token;
}

async function getGoogleSaAccessToken(sa, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: scopes.join(" "),
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await importPkcs8(sa.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${bufToB64url(sig)}`;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error("sa token failed: " + (await res.text()));
  return (await res.json()).access_token;
}

async function ensureFolder(accessToken, parentId, name) {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`
  );
  const list = await fetch(`${DRIVE_FILES}?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!list.ok) throw new Error("folder list failed");
  const data = await list.json();
  if (data.files?.length) return data.files[0].id;

  const create = await fetch(DRIVE_FILES, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId === "root" ? undefined : [parentId],
    }),
  });
  if (!create.ok) throw new Error("folder create failed: " + (await create.text()));
  return (await create.json()).id;
}

async function setAnyoneWithLink(accessToken, fileId) {
  const res = await fetch(`${DRIVE_FILES}/${encodeURIComponent(fileId)}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  if (!res.ok) {
    console.warn("permission set failed", await res.text());
  }
}

function checkRate(key, env) {
  const windowMs = 60_000;
  const max = Number(env.RATE_LIMIT_PER_MIN || 30);
  const now = Date.now();
  const cur = memRate.get(key);
  if (!cur || now - cur.t > windowMs) {
    memRate.set(key, { n: 1, t: now });
    return null;
  }
  cur.n += 1;
  if (cur.n > max) {
    return json({ error: "rate_limited", message: "অনেক অনুরোধ — একটু পরে চেষ্টা করুন" }, 429);
  }
  return null;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function cors(res) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return new Response(res.body, { status: res.status, headers });
}

function sanitizeId(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

function sanitizeFilename(s) {
  return String(s).replace(/[^\w.\-()+\u0980-\u09FF]/g, "_").slice(0, 80);
}

function concatBytes(...parts) {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p instanceof Uint8Array ? p : new Uint8Array(p), o);
    o += p.byteLength;
  }
  return out;
}

function atobUrl(s) {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}

function b64urlToBuf(s) {
  const bin = atobUrl(s);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

function b64url(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bufToB64url(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPkcs8(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}
