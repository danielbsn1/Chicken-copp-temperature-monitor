import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { parseEnv } from "./src/config/env.ts";

export default defineConfig(({ command, mode }) => {
  // O build de produção falha se as variáveis VITE_* não passarem na validação.
  if (command === "build" && mode === "production") {
    parseEnv(loadEnv(mode, process.cwd(), "VITE_"));
  }

  return {
    plugins: [react()],
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/shared/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      testTimeout: 15_000,
      env: {
        VITE_API_URL: "http://localhost:3333/api",
      },
      coverage: {
        provider: "v8",
        include: ["src/**/*.hooks.ts", "src/**/*.schemas.ts", "src/shared/format/**"],
        exclude: ["src/**/*.test.{ts,tsx}"],
        thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
      },
    },
  };
});
