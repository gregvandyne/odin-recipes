import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/lib/risk/**/*.ts"],
      thresholds: {
        // The risk scoring engine is held to 90%+. Hard gate.
        lines: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
