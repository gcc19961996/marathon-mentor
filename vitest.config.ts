// Unit tests run on plain functions in src/lib, so they skip the app's Vite
// setup (TanStack Start, Nitro, Tailwind) and only need the @ path alias.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
