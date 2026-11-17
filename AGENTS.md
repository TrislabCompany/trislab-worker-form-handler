# This repository

> Trislab's shared form handler: one Cloudflare Worker that receives the forms of Trislab's websites, checks Turnstile and the fields, sends the submission by e-mail, stores nothing, and sends the visitor back to the site's thank-you or error page. Start with [README.md](README.md); the detail is in [docs/](docs/).

This file is the guide for every AI coding tool (Claude Code, Cursor, Codex, …). `CLAUDE.md` only imports it: edit conventions here.

## Repository map

| Path | What |
| --- | --- |
| `src/handler.ts` | The request pipeline: route, origin, body, honeypot, rate limit, Turnstile, fields, actions, redirect ([docs/architecture.md](docs/architecture.md)) |
| `src/forms.ts` | The form registry: every form's fields, subject, sender, pages and actions ([docs/adding-a-form.md](docs/adding-a-form.md)) |
| `src/config.ts` | Reads `SITES`, `MAIL_ACCOUNTS`, `RECIPIENTS` and the secrets, and checks them ([docs/configuration.md](docs/configuration.md)) |
| `src/actions/` | What a submission does, all at once: `email` now, `http` (external systems) later |
| `src/mail/` | The mail providers behind one contract: `acs` (Azure Communication Services Email), `log-only` ([docs/mail-providers.md](docs/mail-providers.md)) |
| `src/log.ts`, `src/azure-logs.ts` | Structured logs to Workers Logs and Azure Log Analytics ([docs/logging.md](docs/logging.md)) |
| `wrangler.toml` | The local setup and the `dev`, `staging` and `production` Workers, with their public vars |
| `worker-configuration.d.ts` | Runtime types from `pnpm types`; regenerate after changing `compatibility_date` or wrangler |
| `test/` | Vitest inside workerd (`@cloudflare/vitest-plugin`), outbound `fetch` mocked |

## Rules

- **Run `pnpm test` before every push.** It runs lint, the type check and the tests, among them the config check of every environment in `wrangler.toml`. The required check `ci / ci` runs the same.
- **Never log personal data.** No field values, names, e-mail addresses, phone numbers, IP addresses or Turnstile tokens in logs, errors, tests' snapshots or PRs. Log through `src/log.ts` only; ESLint refuses `console` elsewhere. The test "logs no field values" must keep passing.
- **The repository is public.** Recipients, keys and secrets are never in git: they are Worker secrets from the GitHub Environments ([docs/configuration.md](docs/configuration.md)). No client contracts, prices or internal addresses either.
- **Dependencies stay pinned and current.** Renovate proposes updates weekly. Add a package only with a reason in the PR, pin it exactly, and never take a release younger than 3 days. Outbound calls use the platform `fetch`, not vendor SDKs.
- **Every change is a PR** to `main`, merged after `ci / ci` passes and a code owner approves.
- **Deploy only with the workflows,** never `wrangler deploy` or `wrangler secret` from a laptop or through the Cloudflare dashboard ([docs/deployment.md](docs/deployment.md)).
- **Hostnames, routes, DNS, the deploy token and the Turnstile widgets** belong to `tl-cloud-infrastructure`, not to this repository.
- **A new form, mail provider or external system** follows its checklist ([docs/adding-a-form.md](docs/adding-a-form.md), [docs/mail-providers.md](docs/mail-providers.md)), including the sites' privacy policies.

## Skills

None yet. The `release` skill comes with the deploy workflows ([docs/deployment.md](docs/deployment.md)).
