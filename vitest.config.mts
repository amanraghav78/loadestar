import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
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
