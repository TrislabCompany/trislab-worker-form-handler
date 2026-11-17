// Runs once per deployed environment of wrangler.toml (vitest.config.ts): what
// is in git must be consistent. The secrets are checked by the deployed Worker
// itself, on /healthz after each deploy.
import { env } from "cloudflare:test";
import { expect, it } from "vitest";
import { loadConfig } from "../src/config";
import type { Env } from "../src/env";
import { forms } from "../src/forms";

it("the environment's vars fit the form registry", () => {
  const vars = env as unknown as Env;
  expect(["dev", "staging", "production"]).toContain(vars.ENVIRONMENT);
  expect(loadConfig(vars, forms, "static").issues).toEqual([]);
  // Every form's site is served in every deployed environment.
  for (const form of Object.values(forms)) expect(JSON.parse(vars.SITES)).toHaveProperty([form.site]);
});
