import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: {
      deny: ["**/.dev.vars*", "**/.env*", "**/.git/**", "**/*.pem", "**/*.crt"],
    },
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/API.integration.test.tsx"],
  },
});
