import { execSync } from "child_process";

function gitSha() {
  // Prefer build arg (Docker), fall back to git, then "dev"
  if (process.env.NEXT_PUBLIC_BUILD_SHA && process.env.NEXT_PUBLIC_BUILD_SHA !== "dev") {
    return process.env.NEXT_PUBLIC_BUILD_SHA;
  }
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: "standalone",
  env: {
    NEXT_PUBLIC_BUILD_SHA: gitSha(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  poweredByHeader: false,
};

export default nextConfig;
