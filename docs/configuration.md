# Configuration

Everything public is in git; everything secret or personal is a Worker secret. The deploy workflow writes the secrets from the GitHub Environment (`dev`, `staging`, `production`) on every deploy, so GitHub stays the single source.

| Name | Secret? | Where it is set | Who sets it | What |
| --- | --- | --- | --- | --- |
| `ENVIRONMENT` | No | `wrangler.toml` | this repo | `local`, `dev`, `staging`, `production` |
| `VERSION` | No | deploy workflow | CI | The release (`vX.Y.Z`) |
| `SITES` | No | `wrangler.toml` | this repo (later from the infra catalog) | JSON: site → its origins. A form's site missing in an environment means its form is refused there |
| `MAIL_ACCOUNTS` | No | `wrangler.toml` | this repo | JSON: account → `provider`, `fromDomains`, and the *names* of its `secret` and `endpointVar` |
| `RECIPIENTS` | **Yes, personal data** | GitHub Environment secret | devops, by hand (`gh secret set RECIPIENTS --env <env>`) | JSON: form ID → addresses (at most 50). Dev and staging point at a Trislab test inbox |
| `TURNSTILE_SECRET_<SITE>` | Yes | GitHub Environment secret | tl-cloud-infrastructure, from `turnstile_secrets` | One per site, for example `TURNSTILE_SECRET_ASTRAGROUP_WEBSITE_FASADANAKLJUC` |
| `MAIL_ENDPOINT_TRISLAB` | No | GitHub Environment variable | tl-cloud-infrastructure | The ACS resource endpoint, `https://<name>.<region>.communication.azure.com` |
| `MAIL_KEY_TRISLAB` | Yes | GitHub Environment secret | tl-cloud-infrastructure | The ACS access key |
| `AZURE_TENANT_ID`, `AZURE_LOGS_CLIENT_ID`, `AZURE_LOGS_DCE`, `AZURE_LOGS_DCR_ID` | No | GitHub Environment variables | tl-cloud-infrastructure | Log Analytics shipping ([logging.md](logging.md)) |
| `AZURE_LOGS_CLIENT_SECRET` | Yes | GitHub Environment secret | tl-cloud-infrastructure | Same |
| `RATE_LIMITER` | — | `wrangler.toml` binding | this repo | 5 posts a minute per form and IP |

## The config check

`src/config.ts` checks the whole configuration on the first request of each isolate, and `GET /healthz` answers 503 while anything is wrong, so a deploy's smoke test catches it before a visitor does. It checks:

- `SITES`: every origin is an origin; https only (http://localhost is allowed outside production);
- `MAIL_ACCOUNTS`: a known provider; `fromDomains` is set; `log-only` is not allowed in production;
- every form: its accounts exist; its sender's domain is in the account's `fromDomains`; its pages are paths; the `http` action is refused until it is built;
- at runtime only: every named secret and endpoint is set; `RECIPIENTS` has 1–50 valid addresses for every form; no Turnstile test secret in production.

The static part runs in CI for every environment of `wrangler.toml` (`test/config-env.test.ts`).

## Local

`.dev.vars` (copied from `.dev.vars.example`, never committed) holds Turnstile's test secrets and test recipients. The local mail account is `log-only`.

Changing recipients needs no release: `gh secret set RECIPIENTS --env production`, then re-run the deploy.
