import { defineConfig } from "vitest/config";
import path from "node:path";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env");
} catch {}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { include: ["tests/live/**/*.live.ts"], environment: "node" },
});
