# GitBridge Flutter + Google Drive + Cloudflare Worker — Setup

## Architecture

- **PWA (web)** → Firebase project `chatapp-1dfee` (`js/firebase-config.js`) — leave alone  
- **Flutter APK** → **separate** Firebase project (default name `gitbridge-mobile`)  
- **Chat text** → that mobile project's Auth + Firestore  
- **Images/videos** → Your single Google Drive via Cloudflare Worker  
- **Worker** → verifies tokens against the **mobile** Firebase project only  

No VPS required. PWA and Flutter never share Auth/Firestore, so they cannot conflict.

---

## 1. Firebase (mobile project only)

Do **not** add the Android app to `chatapp-1dfee`. Create a new project.

1. [Firebase Console](https://console.firebase.google.com) → **Add project**  
   Suggested ID: `gitbridge-mobile` (any unused ID is fine — then update configs to match).  
2. Enable **Anonymous Authentication**.  
3. Enable **Cloud Firestore** (start in production mode; rules come from this repo).  
4. Add app → **Android**  
   - Package name: `com.gitbridge.gitbridge_mobile`  
   - Download `google-services.json` → `apps/mobile/android/app/google-services.json`  
5. Copy values into `apps/mobile/lib/config.dart`:  
   - `apiKey`, `mobilesdk_app_id` → `firebaseAppId`, `project_id`, `storage_bucket`, `messagingSenderId` / project number, `authDomain`  
6. Create a **service account** on **this** mobile project (Project settings → Service accounts → Generate new private key).  
   Used only as Worker secret `FIREBASE_SERVICE_ACCOUNT` — never commit.  
7. Point Firebase CLI at the mobile project and deploy rules:

```bash
cp .firebaserc.example .firebaserc
# edit .firebaserc if your project ID is not gitbridge-mobile
firebase login
firebase use mobile   # or: firebase use YOUR_MOBILE_PROJECT_ID
firebase deploy --only firestore:rules
```

`.firebaserc` alias `pwa` → `chatapp-1dfee` is only for reference; do **not** deploy these mobile rules onto the PWA project unless you intend to.

---

## 2. Google Drive OAuth (one Drive for all users)

1. [Google Cloud Console](https://console.cloud.google.com) → the **mobile** Firebase project's linked GCP project (or any project you prefer for Drive).  
2. Enable **Google Drive API**.  
3. APIs & Services → Credentials → **Create OAuth client ID** → type **Desktop app**.  
4. Note `CLIENT_ID` and `CLIENT_SECRET`.  
5. OAuth consent screen: External (or Internal). Add yourself as test user while unverified.  
6. Get a **refresh token** (one-time on your machine):

```bash
cd workers/media-upload
npm i
node scripts/get-refresh-token.mjs
# Browser opens → sign in with the Google account that owns the Drive
# Copy the printed REFRESH_TOKEN
```

7. In Drive, a folder `GitBridge` is created automatically on first upload (or create it manually).

**Never** put client secret / refresh token in the Flutter APK or git.

---

## 3. Cloudflare Worker

```bash
cd workers/media-upload
npm i
npx wrangler login
npx wrangler secret put DRIVE_CLIENT_ID
npx wrangler secret put DRIVE_CLIENT_SECRET
npx wrangler secret put DRIVE_REFRESH_TOKEN
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT   # paste entire JSON from MOBILE project
# Confirm FIREBASE_PROJECT_ID in wrangler.toml matches mobile project
npx wrangler deploy
```

Note the Worker URL, e.g. `https://gitbridge-media-upload.<subdomain>.workers.dev`.

Set it in Flutter: `apps/mobile/lib/config.dart` → `mediaWorkerBaseUrl`.

Optional KV rate limit:

```bash
npx wrangler kv namespace create RATE_LIMIT
# Add binding in wrangler.toml
```

---

## 4. Flutter app

After Firebase + Worker URL are in `config.dart`, create a room (§6) then build (§7). Short commands:

```bash
cd apps/mobile
flutter pub get
# Place google-services.json + fill config.dart first
flutter run
# Release APK:
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

Distribute via **GitHub Releases** (sideload). Unknown sources required on device.

---

## 5. Security checklist

- [ ] Drive secrets only in `wrangler secret`  
- [ ] `FIREBASE_SERVICE_ACCOUNT` only in Worker  
- [ ] Worker rejects upload if Firebase token invalid or user not room member  
- [ ] Firestore rules allow only room members to create messages  
- [ ] `imageUrl` / `videoUrl` only allowlisted hosts (Drive / workers.dev)  
- [ ] APK has no Drive tokens  
- [ ] Release APK is signed  

### Do not

- Embed refresh token in the app  
- Deploy Worker without auth  
- Commit `google-services.json` with unused secrets that are private keys (service account JSON must not be in git)

---

## 6. Create a chat room (mobile Firestore — browser)

Rooms live in the **mobile** Firebase project only — they are **not** shared with the PWA (`chatapp-1dfee`).

Do this in [Firebase Console → Firestore](https://console.firebase.google.com/project/gitbridge-mobile/firestore) (use your mobile project ID if different).

### 6a. Room document

1. **Start collection** → Collection ID: `rooms`  
2. Document ID = room code, e.g. `demo`  
   Allowed shapes (app validates): lowercase slug `^[a-z][a-z0-9_-]{2,23}$`, or 4–8 digits, or 12–20 alphanumeric.  
3. Fields:

| Field | Type | Value |
|---|---|---|
| `memberCount` | number | `2` |
| `status` | string | `active` |

### 6b. Password hashes

Login compares **SHA-256 hex** of the plain password (UTF-8, no newline). From the repo (or any machine):

```bash
echo -n 'pass1' | sha256sum
echo -n 'pass2' | sha256sum
```

Copy only the 64-character hex (ignore the ` -` at the end).

Example hashes (plain passwords `pass1` / `pass2`):

| Plain password | `passwordHash` |
|---|---|
| `pass1` | `e6c3da5b206634d7f3f3586d747ffdb36b5c675757b380c6a5fe5c570c714349` |
| `pass2` | `1ba3d16e9881959f8c9a9762854f72c6e6321cdd44358a10a4e939033117eab9` |

Use your own passwords in production; recompute hashes the same way.

### 6c. Members `m1` and `m2`

Under `rooms/{roomId}` → **Start collection** → Collection ID: `members`.

**Document ID `m1`:**

| Field | Type | Value |
|---|---|---|
| `id` | string | `m1` |
| `name` | string | `Member 1` |
| `passwordHash` | string | hash for that member’s password |

**Document ID `m2`:** same fields with `id` / `name` = `m2` / `Member 2` and the other hash.

In the app: room code = document ID (e.g. `demo`), password = plain text you hashed (e.g. `pass1`).

More message fields: `docs/SCHEMA.md`.

### 6d. Use the room

1. Build/install APK (section 7).  
2. On two phones: enter room code + each member password.  
3. Text → mobile Firestore; media → Drive via Worker under `GitBridge/{roomId}/YYYY/MM/`.

---

## 7. Build & install APK

Prerequisites: Flutter on `PATH`, `ANDROID_HOME` set, real `google-services.json`, and `mediaWorkerBaseUrl` in `apps/mobile/lib/config.dart`.

```bash
export PATH="$HOME/flutter/bin:$PATH"
export ANDROID_HOME="$HOME/Android/Sdk"
cd apps/mobile
flutter pub get
flutter build apk --release
```

APK path:

```text
apps/mobile/build/app/outputs/flutter-apk/app-release.apk
```

Sideload onto phones (allow install from unknown sources). Optional debug run:

```bash
flutter run
# or override Worker URL:
flutter run --dart-define=MEDIA_WORKER_URL=https://gitbridge-media-upload.YOUR_SUBDOMAIN.workers.dev
```

Health check after deploy:

```bash
curl https://gitbridge-media-upload.YOUR_SUBDOMAIN.workers.dev/health
```

---

## 8. Bangla error meanings (client)

| Situation | Message |
|---|---|
| No network | ইন্টারনেট সংযোগ নেই |
| 401 from Worker | সেশন শেষ — আবার লগইন করুন |
| 403 | এই রুমে ছবি পাঠানোর অনুমতি নেই |
| 413 | ফাইল খুব বড় |
| 429 | অনেক অনুরোধ — একটু পরে চেষ্টা করুন |
| Drive/Worker down | মিডিয়া আপলোড ব্যর্থ — আবার চেষ্টা করুন |

---

## 9. Cost (free-tier oriented)

| Piece | Notes |
|---|---|
| Cloudflare Worker | Free tier OK for light chat media |
| Google Drive | ~15 GB on personal account |
| Firebase | Text chat usually within Spark; upgrade if needed |
| No VPS | Not required |
