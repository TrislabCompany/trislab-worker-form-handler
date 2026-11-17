import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { workerName } from "./worker-name.mjs";

const toml = `name = "local"
[[ratelimits]]
name = "RATE_LIMITER"

[env.dev]
name = "dev-form-handler-trislab"

[[env.dev.ratelimits]]
name = "RATE_LIMITER"

[env.staging]
[env.staging.vars]
name = "not-this"
`;

test("reads the name right under [env.<environment>]", () => {
  assert.equal(workerName(toml, "dev"), "dev-form-handler-trislab");
});

test("stops at the next table", () => {
  assert.equal(workerName(toml, "staging"), undefined);
  assert.equal(workerName(toml, "production"), undefined);
});

test("every deployed environment of wrangler.toml is <environment>-form-handler-trislab, as infra names it", () => {
  const real = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  for (const environment of ["dev", "staging", "production"]) {
    assert.equal(workerName(real, environment), `${environment}-form-handler-trislab`);
  }
});
