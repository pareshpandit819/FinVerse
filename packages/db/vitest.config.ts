import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    // RLS tests are integration tests — skip in unit mode unless DATABASE_URL is set
    include: ["src/__tests__/**/*.test.ts"],
  },
});
