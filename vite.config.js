import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// vite.config.js
//
// The E*TRADE proxy signs every request with OAuth 1.0a before forwarding it
// to the sandbox.  Your CONSUMER_SECRET and ACCESS_TOKEN_SECRET stay here —
// they are NEVER sent to the browser.
//
// Required .env (or .env.local) variables:
//   VITE_ETRADE_CONSUMER_KEY      e.g. abc123def456
//   ETRADE_CONSUMER_SECRET        e.g. SECRET_VALUE_HERE
//   ETRADE_ACCESS_TOKEN           e.g. your_access_token
//   ETRADE_ACCESS_TOKEN_SECRET    e.g. your_access_token_secret
// ─────────────────────────────────────────────────────────────────────────────

export default defineConfig(({ mode }) => {
  // Load env — including non-VITE_ variables for server-side use
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],

    server: {
      proxy: {
        "/etrade": {
          target: "https://apisb.etrade.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/etrade/, ""),
          secure: true,

          // configure() runs once; use `proxyReq` event to sign each request
          configure(proxy) {
            proxy.on("proxyReq", (proxyReq, req) => {
              const method = req.method ?? "GET";

              // Reconstruct the full target URL for signature base string
              const targetBase = "https://apisb.etrade.com";
              const fullUrl = targetBase + proxyReq.path; // includes query string

              // Split URL into base + params
              const [baseUrl, queryString] = fullUrl.split("?");
              const queryParams = Object.fromEntries(
                new URLSearchParams(queryString ?? "")
              );

              const authHeader = buildOAuth1Header({
                method,
                url: baseUrl,
                queryParams,
                consumerKey:       env.VITE_ETRADE_CONSUMER_KEY,
                consumerSecret:    env.ETRADE_CONSUMER_SECRET,
                accessToken:       env.ETRADE_ACCESS_TOKEN,
                accessTokenSecret: env.ETRADE_ACCESS_TOKEN_SECRET,
              });

              proxyReq.setHeader("Authorization", authHeader);
              proxyReq.setHeader("Accept", "application/json");
            });

            proxy.on("error", (err, _req, res) => {
              console.error("[etrade-proxy] error:", err.message);
              if (res && !res.headersSent) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "E*TRADE proxy error", detail: err.message }));
              }
            });
          },
        },
      },
    },

    build: {
      // Increase chunk size warning threshold — the app is intentionally large
      chunkSizeWarningLimit: 1200,
    },
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// OAuth 1.0a signature builder
// Spec: https://oauth.net/core/1.0a/#signing_process
// ─────────────────────────────────────────────────────────────────────────────
function buildOAuth1Header({
  method,
  url,
  queryParams = {},
  consumerKey,
  consumerSecret,
  accessToken,
  accessTokenSecret,
}) {
  const oauthParams = {
    oauth_consumer_key:     consumerKey,
    oauth_token:            accessToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
    oauth_nonce:            crypto.randomBytes(16).toString("hex"),
    oauth_version:          "1.0",
  };

  // Collect all params (OAuth + query) for the signature base string
  const allParams = { ...queryParams, ...oauthParams };

  // Percent-encode keys and values, sort lexicographically
  const encoded = Object.entries(allParams)
    .map(([k, v]) => [pct(k), pct(v)])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const signatureBase = [
    method.toUpperCase(),
    pct(url),
    pct(encoded),
  ].join("&");

  const signingKey = `${pct(consumerSecret)}&${pct(accessTokenSecret)}`;
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBase)
    .digest("base64");

  oauthParams.oauth_signature = signature;

  // Build Authorization header value
  const headerValue =
    "OAuth " +
    Object.entries(oauthParams)
      .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
      .join(", ");

  return headerValue;
}

// RFC 3986 percent-encoding (stricter than encodeURIComponent)
function pct(str) {
  return encodeURIComponent(String(str ?? "")).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
