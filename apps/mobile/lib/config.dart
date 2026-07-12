/// App configuration — set Firebase + mediaWorkerBaseUrl after Console / wrangler setup.
///
/// Mobile uses its **own** Firebase project (not the PWA `chatapp-1dfee`) so Auth,
/// Firestore, and app IDs never collide with the web app.
class AppConfig {
  static const String appName = 'GitBridge';

  /// Dedicated mobile Firebase project (from google-services.json — not PWA).
  static const String firebaseApiKey = 'AIzaSyAj1bM3D29VgHN9m-aQPkXAt6yC2DAFpxw';
  static const String firebaseAppId =
      '1:7425661982:android:e643b57f43b479e011620f';
  static const String firebaseMessagingSenderId = '7425661982';
  static const String firebaseProjectId = 'gitbridge-mobile';
  static const String firebaseStorageBucket =
      'gitbridge-mobile.firebasestorage.app';
  static const String firebaseAuthDomain = 'gitbridge-mobile.firebaseapp.com';

  /// Cloudflare Worker base URL (no trailing slash)
  /// Example: https://gitbridge-media-upload.your-subdomain.workers.dev
  static const String mediaWorkerBaseUrl =
      String.fromEnvironment(
        'MEDIA_WORKER_URL',
        defaultValue:
            'https://gitbridge-media-upload.gitbridge-mobile.workers.dev',
      );

  static const int maxImageBytes = 2 * 1024 * 1024;
  static const int maxVideoBytes = 25 * 1024 * 1024;
  static const int compressQuality = 70;
  static const int compressMaxWidth = 1280;
}
