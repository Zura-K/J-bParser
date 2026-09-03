import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["**/*.{ts,tsx}"],
      exclude: ["dist/**", "**/*.test.{ts,tsx}", "vite.config.ts", "eslint.config.js"],
    },
  },
})
