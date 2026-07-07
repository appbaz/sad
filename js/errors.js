export function formatFirebaseError(err) {
  const code = err?.code || "";
  const message = err?.message || String(err || "অজানা ত্রুটি");

  if (message.includes("রুম পূর্ণ") || message.includes("রুম পাওয়া যায়নি")) {
    return message;
  }

  switch (code) {
    case "permission-denied":
      return "Firestore অনুমতি নেই — Firebase Console থেকে firestore.rules Publish করুন";
    case "auth/operation-not-allowed":
      return "Anonymous Authentication Firebase-এ enable করুন";
    case "auth/network-request-failed":
      return "ইন্টারনেট সংযোগ সমস্যা — আবার চেষ্টা করুন";
    case "unavailable":
      return "Firebase সাময়িকভাবে unavailable — কিছুক্ষণ পর চেষ্টা করুন";
    case "failed-precondition":
      return "Firestore index লাগতে পারে — Console-এর লিংক থেকে index তৈরি করুন";
    default:
      break;
  }

  return message;
}
