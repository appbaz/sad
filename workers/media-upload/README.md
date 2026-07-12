# GitBridge Media Upload Worker

Uploads chat images/videos to **your** Google Drive after verifying a Firebase ID token and room membership.

Uses the **Flutter mobile** Firebase project (`FIREBASE_PROJECT_ID` in `wrangler.toml`), not the PWA project `chatapp-1dfee`.

## Endpoints

| Method | Path | Auth |
|---|---|---|
| GET | `/health` | no |
| POST | `/v1/media` | Bearer Firebase ID token |
| GET | `/v1/media/:fileId/thumb` | Bearer Firebase ID token |

## Secrets

```bash
npx wrangler secret put DRIVE_CLIENT_ID
npx wrangler secret put DRIVE_CLIENT_SECRET
npx wrangler secret put DRIVE_REFRESH_TOKEN
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
```

See [docs/SETUP.md](../../docs/SETUP.md) and [docs/SECURITY.md](../../docs/SECURITY.md).

## Deploy

```bash
npm i
npx wrangler deploy
```

If `npm install` fails with `EPERM symlink` (common on FAT/exFAT USB drives), install deps on an ext4 path instead:

```bash
mkdir -p ~/.cache/gitbridge-media-upload
cp package.json ~/.cache/gitbridge-media-upload/
cd ~/.cache/gitbridge-media-upload && npm i
cd /path/to/repo/workers/media-upload
npx --prefix ~/.cache/gitbridge-media-upload wrangler deploy
```
