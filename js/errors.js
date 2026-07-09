export function formatFirebaseError(err) {
  const code = err?.code || "";
  const message = err?.message || String(err || "অজানা ত্রুটি");

  if (message.includes("রুম পূর্ণ") || message.includes("রুম পাওয়া যায়নি")) {
    return message;
  }

  switch (code) {
    case "permission-denied":
      return "Firestore অনুমতি নেই — Anonymous Auth চালু করুন এবং firestore.rules Publish করুন";
    case "auth/operation-not-allowed":
      return "Anonymous Authentication Firebase-এ enable করুন";
    case "auth/unauthorized-domain":
      return "Firebase Console → Authentication → Settings → Authorized domains-এ localhost যোগ করুন";
    case "auth/network-request-failed":
      return "ইন্টারনেট সংযোগ সমস্যা — আবার চেষ্টা করুন";
    case "unavailable":
      return "Firebase সাময়িকভাবে unavailable — কিছুক্ষণ পর চেষ্টা করুন";
    case "failed-precondition":
      return "Firestore index লাগতে পারে — Console-এর লিংক থেকে index তৈরি করুন";
    case "invalid-argument":
      return "অবৈধ ডেটা — সব ফিল্ড সঠিকভাবে পূরণ করুন";
    case "storage/unauthorized":
    case "storage/unauthenticated":
      return "ছবি আপলোডের অনুমতি নেই — লগইন করে আবার চেষ্টা করুন";
    case "storage/bucket-not-found":
    case "storage/object-not-found":
      return "Firebase Storage চালু নেই বা bucket সঠিক নয় — Console → Storage → Get started, তারপর storage.rules deploy করুন";
    case "storage/canceled":
      return "আপলোড বাতিল হয়েছে";
    case "storage/quota-exceeded":
      return "Storage সীমা পূর্ণ — পুরনো ফাইল মুছুন বা প্ল্যান আপগ্রেড করুন";
    default:
      break;
  }

  if (code.startsWith("storage/") || message.includes("Firebase Storage")) {
    if (/404|not found/i.test(message)) {
      return "Firebase Storage bucket পাওয়া যায়নি — Console → Storage চালু করুন এবং js/firebase-config.js-এ সঠিক storageBucket দিন";
    }
    return "ছবি আপলোড ব্যর্থ — Storage rules deploy করুন: firebase deploy --only storage";
  }

  if (/https?:\/\//.test(message) && message.length > 120) {
    return "Firebase কনফিগারেশন ত্রুটি — Anonymous Auth ও Firestore rules যাচাই করুন";
  }

  return message;
}
