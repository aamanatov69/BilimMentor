import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function originFromUrl(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const apiOrigin = originFromUrl(apiUrl) ?? "http://localhost:4000";

const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const styleSrc = "style-src 'self' 'unsafe-inline'";

const connectSources = isDev
  ? ["'self'", apiOrigin, "ws://localhost:3000", "ws://127.0.0.1:3000"]
  : ["'self'", apiOrigin];

const csp = [
  "default-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  scriptSrc,
  styleSrc,
  "img-src 'self' data: https:",
  "font-src 'self'",
  `connect-src ${connectSources.join(" ")}`,
  "manifest-src 'self'",
  "frame-src 'none'",
  "worker-src 'self'",
  "upgrade-insecure-requests",
  "block-all-mixed-content",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=15552000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
