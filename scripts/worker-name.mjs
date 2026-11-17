// The name wrangler.toml gives the Worker of an environment, for the deploy
// workflow's check against the Environment's WORKER_NAME (docs/deployment.md):
//
//   node scripts/worker-name.mjs <environment>     prints e.g. dev-form-handler-trislab
//
// Reads only the `name = "…"` line right under [env.<environment>], which is
// how wrangler.toml writes it.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** The name under [env.<environment>], or undefined. */
export function workerName(toml, environment) {
  const lines = toml.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `[env.${environment}]`);
  if (start === -1) return undefined;
  for (const line of lines.slice(start + 1)) {
    if (line.trim().startsWith("[")) return undefined;
    const m = /^name\s*=\s*"([^"]+)"\s*$/.exec(line.trim());
    if (m) return m[1];
  }
  return undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const name = workerName(readFileSync("wrangler.toml", "utf8"), process.argv[2] ?? "");
  if (!name) {
    console.error(`wrangler.toml has no name under [env.${process.argv[2]}]`);
    process.exit(1);
  }
  process.stdout.write(name);
}
