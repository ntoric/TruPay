import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the app to be accessed through tunnel/dev domains in development.
  // Without this, Next.js dev blocks cross-origin dev resources (HMR + client
  // bundles), which breaks client hydration (e.g. login form falls back to a
  // native GET submit instead of calling signIn).
  allowedDevOrigins: [
    "ngui.mohammedshahid.in",
    "localhost:6000",
    "localhost:6001",
  ],
};

export default nextConfig;
