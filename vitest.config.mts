import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws unless the bundler resolves the react-server
      // condition. Next does; vitest doesn't, so point at the no-op build the
      // package ships for exactly this case.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: {
      SKIP_ENV_VALIDATION: "1",
      ADMIN_USER: "admin",
      ADMIN_PASS: "correct-horse-battery",
    },
  },
});
