import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

// Version-skew protection: scripts/deploy.sh writes a fresh id to .deployment-id before each build.
// Tabs left open across a deploy then do a full reload on their next navigation instead of asking
// for files from the old build (which showed "This page couldn't load").
let deploymentId: string | undefined;
try {
  deploymentId = readFileSync(".deployment-id", "utf8").trim() || undefined;
} catch {
  deploymentId = undefined;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  deploymentId,
  // Dev only: let phones on the same Wi-Fi load the dev server's scripts via the LAN IP.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
};

export default nextConfig;
