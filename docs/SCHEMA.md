# Firestore schema (mobile project)

PWA uses a different Firebase project. Mobile data lives only under the Flutter project (e.g. `gitbridge-mobile`).

## Room

`rooms/{roomId}`

| Field | Type | Notes |
|---|---|---|
| memberCount | number | usually `2` |
| status | string | `active` |

`roomId` must match app validation (see SETUP §6a).

## Members

`rooms/{roomId}/members/{username}` — document IDs typically `m1` and `m2`

| Field | Type | Notes |
|---|---|---|
| id | string | same as document id (`m1` / `m2`) |
| name | string | display name |
| passwordHash | string | SHA-256 hex of plain password (`echo -n 'pass' \| sha256sum`) |

How to create in Console: `docs/SETUP.md` §6.

## Messages

Collection: `rooms/{roomId}/messages/{msgId}`

| Field | Type | Notes |
|---|---|---|
| type | string | `text` \| `image` \| `video` \| `link` \| `system` |
| text | string | ≤1000 |
| senderId | string | `m1` / `m2` |
| senderName | string | display name |
| senderUid | string | Firebase Auth uid |
| imageUrl | string? | Drive / Worker HTTPS (or legacy data URL on web) |
| imageThumbUrl | string? | usually Worker thumb URL |
| videoUrl | string? | Drive view URL |
| videoThumbUrl | string? | Worker thumb |
| driveFileId | string? | Google Drive file id |
| createdAt | timestamp | server |
| readBy / deliveredBy / reactions | map | optional |

Media files on Drive: `GitBridge/{roomId}/{yyyy}/{mm}/…`
