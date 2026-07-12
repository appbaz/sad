# Continuation checklist — reopen on another drive

Use this after copying/moving the repo to a new disk. Do **not** re-implement the Flutter/Drive/Worker code unless something is missing.

## Already implemented in this repo

- [x] Firestore rules: Drive / workers.dev URLs + `video` type — `firestore.rules`
- [x] Cloudflare Worker — `workers/media-upload/` (upload + thumb proxy + JWT + rate limit)
- [x] Drive OAuth helper — `workers/media-upload/scripts/get-refresh-token.mjs`
- [x] Flutter app — `apps/mobile/` (login m1/m2, text chat, image/video → Worker → Drive)
- [x] Docs — `docs/SETUP.md`, `docs/SECURITY.md`, `docs/SCHEMA.md`

## Progress on this machine (2026-07-12)

- [x] Repo on ext4 disk
- [x] Node.js 20 + Worker `npm i` (wrangler 4.86.0)
- [x] Flutter 3.44.6 stable at `~/flutter` + `flutter pub get` + analyze clean
- [x] Android SDK + cmdline-tools + licenses (`ANDROID_HOME=~/Android/Sdk`)
- [x] Firebase CLI 15.23.0 (`firebase-tools`)
- [ ] Create **separate** Firebase project for mobile (not `chatapp-1dfee`) + deploy rules
- [ ] Real `google-services.json` + fill `config.dart` (still placeholders)
- [ ] Drive OAuth secrets
- [ ] Cloudflare `wrangler login` + secrets + deploy
- [ ] Set `mediaWorkerBaseUrl` / `MEDIA_WORKER_URL`
- [ ] Release APK

PATH helpers were appended to `~/.bashrc` (`~/flutter/bin`, `ANDROID_HOME`).

## On the new machine / drive — do this in order

### 1. Copy the whole project

Copy the entire repo folder (including `apps/`, `workers/`, `docs/`, `firestore.rules`).

Prefer an **ext4/NTFS with symlink support** disk for `npm install` (FAT/exFAT USB often fails with `EPERM symlink`).

### 2. Install tools

- Flutter SDK (stable) + Android SDK / Android Studio  
- Node.js 20+  
- Firebase CLI (optional): `npm i -g firebase-tools`  
- Cloudflare: `npx wrangler` (via Worker folder deps)

```bash
cd apps/mobile && flutter pub get
cd ../../workers/media-upload && npm i   # if EPERM → see SETUP / Worker README (use ~/.cache path)
```

### 3. Firebase — **new mobile project** (not PWA) — **YOU next**

PWA stays on `chatapp-1dfee`. Flutter uses a **separate** project (suggested ID `gitbridge-mobile`) so nothing conflicts.

1. Firebase Console → **Add project** (do not reuse PWA)  
2. Anonymous Auth + Firestore on that project  
3. Add Android app `com.gitbridge.gitbridge_mobile` → download real `google-services.json`  
4. Fill `apps/mobile/lib/config.dart` from that file (apiKey, appId, projectId, …)  
5. Service account from **mobile** project → Worker secret `FIREBASE_SERVICE_ACCOUNT`  
6. Deploy rules to **mobile** only:

```bash
firebase login
cp .firebaserc.example .firebaserc   # edit project id if different
firebase use mobile
firebase deploy --only firestore:rules
```

Also set `FIREBASE_PROJECT_ID` in `workers/media-upload/wrangler.toml` to the same mobile project ID.

### 4. Google Drive (one account for all chat media) — **YOU next**

1. Enable Drive API + OAuth Desktop client  
2. Run: `node workers/media-upload/scripts/get-refresh-token.mjs`  
3. Store as Wrangler secrets: `DRIVE_CLIENT_ID`, `DRIVE_CLIENT_SECRET`, `DRIVE_REFRESH_TOKEN`

### 5. Deploy Cloudflare Worker — **YOU next**

```bash
cd workers/media-upload
npx wrangler login
npx wrangler secret put DRIVE_CLIENT_ID
npx wrangler secret put DRIVE_CLIENT_SECRET
npx wrangler secret put DRIVE_REFRESH_TOKEN
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
npx wrangler deploy
```

If npm fails on this disk:

```bash
mkdir -p ~/.cache/gitbridge-media-upload && cp package.json ~/.cache/gitbridge-media-upload/
cd ~/.cache/gitbridge-media-upload && npm i
cd /path/to/repo/workers/media-upload
npx --prefix ~/.cache/gitbridge-media-upload wrangler deploy
```

### 6. Point Flutter at Worker

Set `mediaWorkerBaseUrl` in `apps/mobile/lib/config.dart`  
**or** run with:

```bash
flutter run --dart-define=MEDIA_WORKER_URL=https://YOUR_SUBDOMAIN.workers.dev
```

### 7. Build & install APK

```bash
export PATH="$HOME/flutter/bin:$PATH"
export ANDROID_HOME="$HOME/Android/Sdk"
cd apps/mobile
flutter build apk --release
# APK: build/app/outputs/flutter-apk/app-release.apk
```

Sideload on phones; create rooms/members in the **mobile** Firestore (not the PWA project).

## Do not commit

- `google-services.json` (real)  
- `*-service-account.json`  
- Drive refresh token / `.dev.vars`  
- See root `.gitignore`

## Architecture reminder

| Surface | Firebase |
|---|---|
| PWA (`js/`) | `chatapp-1dfee` — do not change for mobile |
| Flutter + Worker | Separate project (`gitbridge-mobile` or yours) |

| Data | Where |
|---|---|
| Chat text | Mobile Firestore only |
| Images/videos | Your Google Drive via Worker |
| App | Flutter APK (no VPS required) |

## Full guides

- Setup: `docs/SETUP.md`  
- Security: `docs/SECURITY.md`  
- Schema: `docs/SCHEMA.md`
