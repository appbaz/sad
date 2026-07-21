/** Web Push public config — private VAPID key lives only on the free Deno sender. */
export const VAPID_PUBLIC_KEY =
  "BEdsY9WoY3hrZFe1qJiMCqIROdsYm2D9hMK6-jXWW04fRSl5qKPsCNGXrDG5vyTsSaMevhvkkCiLIKp4B7eJlR4";

/** Cloudflare Worker push sender (m1 + m2). No trailing slash. */
export const PUSH_SENDER_URL = "https://gitbridge-push.gitbridge-mobile.workers.dev";

export const DEFAULT_PUSH_NOTIFY_TEXT = "Today is rainy day";
