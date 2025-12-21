import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // In the sandboxed runner `.env.local` may be unreadable (it is commonly gitignored).
  // Point env loading to an existing directory without `.env.*` files so tests can run reliably.
  envDir: path.resolve(__dirname, "src"),
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});

