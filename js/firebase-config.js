// Firebase config — chatapp-1dfee
// Storage bucket: Firebase Console → Storage → Files tab-এর উপরে দেখানো নাম কপি করুন
export const firebaseConfig = {
  apiKey: "AIzaSyB_xlo1Q1ONi4y_BNHAt21OxnnZhoOJoQo",
  authDomain: "chatapp-1dfee.firebaseapp.com",
  projectId: "chatapp-1dfee",
  storageBucket: "chatapp-1dfee.appspot.com",
  messagingSenderId: "664932100818",
  appId: "1:664932100818:web:5257de63529200c6aa5b0b",
};

/** Fallback if primary bucket 404 — Console-এ যেটা আছে সেটি firebaseConfig.storageBucket-এ দিন */
export const STORAGE_BUCKET_FALLBACKS = [
  "chatapp-1dfee.firebasestorage.app",
];
