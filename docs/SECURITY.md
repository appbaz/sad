# Security model — GitBridge Flutter + Drive Worker

## Trust boundaries

| Component | Trusted with |
|---|---|
| Flutter APK | User session only (Firebase ID token). **Never** Drive refresh tokens. |
| Cloudflare Worker | Drive OAuth secrets + Firebase service account. Verifies every upload. |
| Firestore rules | Room membership for message R/W. |
| Google Drive | Media bytes under `GitBridge/{roomId}/…` |

## Threats mitigated

1. **Stolen APK** — attacker cannot upload to your Drive without a valid Firebase session of a room member.  
2. **Forged uploads** — Worker verifies Firebase JWT signature (JWKS) + Firestore user profile + member doc.  
3. **Cross-room access** — `roomId` in request must match `users/{uid}.roomId`; Drive `appProperties.roomId` checked on thumb.  
4. **Secret leakage via git** — `.gitignore` excludes service account JSON, `.dev.vars`, secrets.  
5. **Oversized abuse** — MIME allowlist + max bytes + in-memory rate limit.  

## Residual risks

- **Anyone-with-link** Drive files: anyone who obtains the file URL can view the media. Mitigate in phase 2 with private files + authenticated Worker proxy only.  
- **Member password strength** — weak room passwords allow login as m1/m2.  
- **Unverified Google OAuth app** — refresh token tied to your Cloud project; keep client secret only in Worker.  

## Do not

- Commit `FIREBASE_SERVICE_ACCOUNT` JSON  
- Put `DRIVE_REFRESH_TOKEN` in Flutter or GitHub Actions plaintext without secrets store  
- Disable Worker auth for “testing” in production  

## Release hardening

- Sign release APK with your keystore (replace debug signing in `build.gradle.kts`)  
- ProGuard rules included for Firebase  
- `usesCleartextTraffic=false`  
- Rotate Drive refresh token if leaked  
