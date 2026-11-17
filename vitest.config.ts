// The tests run inside workerd, the Workers runtime (@cloudflare/vitest-plugin).
// Project "unit" uses the local setup of wrangler.toml; the "config-*" projects
// load each deployed environment and run its static config check.
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const environments = ["dev", "staging", "production"];

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.toml" } })],
        test: { name: "unit", include: ["test/**/*.test.ts"], exclude: ["test/config-env.test.ts"] },
      },
      ...environments.map((environment) => ({
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.toml", environment } })],
        test: { name: `config-${environment}`, include: ["test/config-env.test.ts"] },
      })),
    ],
  },
});
