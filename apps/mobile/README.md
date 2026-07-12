# GitBridge Mobile (Flutter)

Secure 1-to-1 chat: **Firestore** for text, **Google Drive** (via Cloudflare Worker) for media.

Uses a **dedicated Firebase project** (not the PWA `chatapp-1dfee`) so web and Android never conflict.

## Quick start

1. Follow [docs/SETUP.md](../../docs/SETUP.md) — create the **mobile** Firebase project, Drive OAuth, Worker secrets.
2. Put the real `google-services.json` from that project in `android/app/` and fill `lib/config.dart`.
3. Set Worker URL in `lib/config.dart` (`mediaWorkerBaseUrl`) or:

```bash
flutter run --dart-define=MEDIA_WORKER_URL=https://YOUR_WORKER.workers.dev
```

4. Create a room + `m1`/`m2` in the **mobile** Firestore (not PWA): see [docs/SETUP.md §6](../../docs/SETUP.md).
5. Build / run:

```bash
flutter pub get
flutter run
flutter build apk --release
# APK: build/app/outputs/flutter-apk/app-release.apk
```

Full checklist after Worker deploy: [docs/CONTINUATION.md](../../docs/CONTINUATION.md) §7–8.

## Security

- No Drive tokens in this app
- Uploads require Firebase ID token; Worker checks room membership
- See `docs/SECURITY.md`
