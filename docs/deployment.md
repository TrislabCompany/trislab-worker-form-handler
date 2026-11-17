# Deployment

| Environment | Worker | Address | Deployed by |
| --- | --- | --- | --- |
| dev | `dev-form-handler-trislab` | `forms-dev.trislab.com` | **Deploy to dev**, on every merge to `main` |
| staging | `staging-form-handler-trislab` | `forms-staging.trislab.com` | **Deploy to staging**, after every **Release new version** |
| production | `production-form-handler-trislab` | `forms.trislab.com` | **Promote to production**, by hand, after a reviewer approves |

Never deploy from a laptop or the Cloudflare dashboard: no `wrangler deploy`, `wrangler secret` or `wrangler versions` by hand.

## Set up and tear down

`tl-cloud-infrastructure` creates everything except the code, from the entry `form-handler` in `catalog/products.yaml` (`forms: true`, one hostname per environment):

- **The Workers:** `<environment>-<product>-<tenant>`, the `name` of each environment in `wrangler.toml`. A test keeps the two equal.
- **The hostnames:** Workers Custom Domains, always public.
- **The GitHub Environments:**
  - variables `CLOUDFLARE_ACCOUNT_ID`, `WORKER_NAME`, `WORKER_URL`;
  - secret `CLOUDFLARE_API_TOKEN` (Workers Scripts Write);
  - a `TURNSTILE_SECRET_<SITE>` secret for every site with a form.
- **The tag ruleset:** `v*` tags are never moved or deleted.

Set by hand in each Environment, by devops (`gh secret set <name> --env <env>`):

- `RECIPIENTS`: JSON, form ID → addresses. Dev and staging use the Trislab test inbox.
- `MAIL_KEY_TRISLAB`: a Resend API key with sending access only, limited to `forms.trislab.com`, one per environment.

Until the Environment `dev` exists, Deploy to dev skips with a notice.

## Ship a change to dev

Merge the PR. **Deploy to dev** bundles that commit and deploys it (`worker-deploy.yml`):

1. checks that `WORKER_NAME` is the name `wrangler.toml` gives the environment;
2. uploads the bundle with the Environment's secrets (`--secrets-file`, only `TURNSTILE_SECRET_*`, `MAIL_KEY_*`, `RECIPIENTS`, `AZURE_LOGS_CLIENT_SECRET`, `TARGET_*_SECRET`) and settings (`VERSION`, `AZURE_*`, `TARGET_*_URL`);
3. waits for `GET /healthz` to answer 200 with this version. A 503 means a secret or setting is missing: the run fails, and the Worker's logs list the issues (`config.invalid`).

Each deploy is recorded as a GitHub deployment of its Environment (task `deploy:worker`).

## Release to staging

Run **Release new version** from `main` with `patch`, `minor` or `major`. It picks the next `vX.Y.Z`, runs `pnpm test`, bundles the Worker once and publishes the GitHub Release with `worker-vX.Y.Z.zip`. **Deploy to staging** then deploys that bundle.

Versions follow semantic versioning. Under `0.x`, a breaking change is a `minor`.

## Promote to production

Run **Promote to production**. It deploys the release staging runs, the same bundle, after a reviewer of the `production` Environment approves. Nobody approves their own run.

## Roll back

Production: a person rolls back to the previous version in the Cloudflare dashboard (the Worker → Deployments → Rollback). Then fix forward with a new release. A secret that was changed since stays changed: secrets are not versioned with the code.

## When a run fails

| Message | Cause |
| --- | --- |
| `the Environment <env> has no variable WORKER_NAME` | tl-cloud-infrastructure has not created the Environment yet |
| `wrangler.toml names the <env> Worker …` | The name in `wrangler.toml` and infra's differ; fix `wrangler.toml` |
| `/healthz answered 503` | A secret or setting is missing: read `config.invalid` in the Worker's logs |
| `staging has no deployment yet` | Run Release new version first |
