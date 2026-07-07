# Private Chat — Admin Panel

অ্যাডমিন প্যানেল দিয়ে চ্যাট রুম তৈরি করুন, সদস্য যোগ করুন, লিংক + পাসওয়ার্ড শেয়ার করুন।

## Firebase সেটআপ

1. Firestore + **Anonymous Auth** enable করুন
2. `config/admin` document:

```json
{ "passwordHash": "sha256-hash-of-admin-password" }
```

3. [`firestore.rules`](firestore.rules) Publish করুন

## ব্যবহার

**অ্যাডমিন:** হোম → পাসওয়ার্ড → রুম তৈরি → সদস্য যোগ → লিংক + রুম পাসওয়ার্ড শেয়ার

**চ্যাট ইউজার:** `#/room/{id}` লিংক → **ইউজারনেম + রুম পাসওয়ার্ড** → চ্যাট
