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

```bash
cd apps/mobile
flutter pub get
# Place google-services.json
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

## 6. Room usage (mobile Firebase only)

Rooms live in the **mobile** Firestore project — they are **not** shared with the PWA.

1. Create room + members `m1` / `m2` with passwords in the mobile project's Firestore (same schema as web; see `docs/SCHEMA.md`).  
2. Install APK on both phones.  
3. Enter room code + member password.  
4. Chat text goes to mobile Firestore; media goes to Drive under `GitBridge/{roomId}/YYYY/MM/`.

---

## 7. Bangla error meanings (client)

| Situation | Message |
|---|---|
| No network | ইন্টারনেট সংযোগ নেই |
| 401 from Worker | সেশন শেষ — আবার লগইন করুন |
| 403 | এই রুমে ছবি পাঠানোর অনুমতি নেই |
| 413 | ফাইল খুব বড় |
| 429 | অনেক অনুরোধ — একটু পরে চেষ্টা করুন |
| Drive/Worker down | মিডিয়া আপলোড ব্যর্থ — আবার চেষ্টা করুন |

---

## 8. Cost (free-tier oriented)

| Piece | Notes |
|---|---|
| Cloudflare Worker | Free tier OK for light chat media |
| Google Drive | ~15 GB on personal account |
| Firebase | Text chat usually within Spark; upgrade if needed |
| No VPS | Not required |
