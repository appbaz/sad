# Private Chat

দুজনের জন্য প্রাইভেট চ্যাট রুম — **শেয়ারেবল লিংক** দিয়ে যোগ দিন, **শুধু ইউজারনেম** দিয়ে চ্যাট করুন।

## ফিচার

- রুম তৈরি + শেয়ার লিংক (`#/room/abc123`)
- প্রতি রুমে সর্বোচ্চ ২ জন
- শুধু ইউজারনেম দিয়ে লগইন (সিক্রেট নেই)
- PWA — হোম স্ক্রিনে ইনস্টল
- অফলাইন মেসেজ সিঙ্ক

## Firebase সেটআপ

1. Firestore + **Anonymous Auth** enable করুন
2. `js/firebase-config.js` — আপনার config
3. [`firestore.rules`](firestore.rules) Firebase Console-এ **Publish** করুন
4. Authorized domains: `localhost`, আপনার GitHub Pages ডোমেইন

> পুরনো `config/app`, `members`, `conversations` collection আর ব্যবহার হয় না।

## Firestore Collections

```
rooms/{roomId}
  ├── memberCount, status, createdAt
  ├── members/{username}   — প্রোফাইল
  └── messages/{msgId}     — চ্যাট মেসেজ

users/{uid}                — online status (roomId + username)
```

## ব্যবহার

### রুম তৈরি
1. অ্যাপ খুলুন → **নতুন চ্যাট রুম তৈরি করুন**
2. শেয়ার লিংক কপি করে সঙ্গীকে পাঠান
3. ইউজারনেম + নাম দিয়ে রেজিস্টার করুন

### সঙ্গী যোগ দেয়
1. লিংক খুলুন
2. ইউজারনেম + নাম দিয়ে রেজিস্টার করুন
3. চ্যাট শুরু

### পরবর্তী প্রবেশ
- লিংক খুলে শুধু ইউজারনেম দিয়ে প্রবেশ করুন

## লোকাল টেস্ট

```bash
python -m http.server 8080
```

দুই ব্রাউজার/Incognito-তে টেস্ট করুন।
