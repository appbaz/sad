# Message schema (Firestore)

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
