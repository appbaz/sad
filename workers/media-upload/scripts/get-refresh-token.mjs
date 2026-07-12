/**
 * One-time script: obtain Google Drive refresh token for the Worker.
 * Usage: node scripts/get-refresh-token.mjs
 * Requires DRIVE_CLIENT_ID and DRIVE_CLIENT_SECRET in env or prompts.
 */
import http from "node:http";
import { URL } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

const rl = createInterface({ input, output });

const CLIENT_ID =
  process.env.DRIVE_CLIENT_ID ||
  (await rl.question("OAuth Client ID: ")).trim();
const CLIENT_SECRET =
  process.env.DRIVE_CLIENT_SECRET ||
  (await rl.question("OAuth Client Secret: ")).trim();

const REDIRECT = "http://127.0.0.1:53682/oauth2callback";

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\nOpen this URL in a browser:\n");
console.log(authUrl.toString());
console.log("\nWaiting for redirect on", REDIRECT, "...\n");

const code = await new Promise((resolve, reject) => {
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, REDIRECT);
      if (u.pathname !== "/oauth2callback") {
        res.writeHead(404);
        res.end();
        return;
      }
      const c = u.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>OK — you can close this tab.</h1>");
      server.close();
      resolve(c);
    } catch (e) {
      reject(e);
    }
  });
  server.listen(53682, "127.0.0.1");
});

if (!code) {
  console.error("No code received");
  process.exit(1);
}

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT,
    grant_type: "authorization_code",
  }),
});

const tokens = await tokenRes.json();
if (!tokenRes.ok) {
  console.error(tokens);
  process.exit(1);
}

console.log("\n=== SAVE THESE AS CLOUDFLARE SECRETS ===\n");
console.log("DRIVE_CLIENT_ID=", CLIENT_ID);
console.log("DRIVE_CLIENT_SECRET=", CLIENT_SECRET);
console.log("DRIVE_REFRESH_TOKEN=", tokens.refresh_token || "(missing — revoke app access and retry with prompt=consent)");
console.log("\naccess_token received (not needed long-term):", Boolean(tokens.access_token));
rl.close();
