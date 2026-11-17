# Deployment

| Environment | Worker | Address | Sites |
| --- | --- | --- | --- |
| dev | `dev-form-handler-trislab` | `forms-dev.trislab.com` | `dev.<site>` |
| staging | `staging-form-handler-trislab` | `forms-staging.trislab.com` | `staging.<site>` |
| production | `production-form-handler-trislab` | `forms.trislab.com` | `production.<site>`, and the site's own domain from its cutover |

`tl-cloud-infrastructure` creates the Workers (named `<environment>-<product>-<tenant>`, the `name` of each environment in `wrangler.toml`), their hostnames as Workers Custom Domains, the GitHub Environments with `CLOUDFLARE_ACCOUNT_ID`, `WORKER_NAME`, `WORKER_URL`, the deploy token `CLOUDFLARE_API_TOKEN` and the `TURNSTILE_SECRET_<SITE>` secrets (tl-cloud-infrastructure #144 and the PR after it). A name that differs from `WORKER_NAME` would deploy a second, unrouted Worker, so the deploy workflow checks that they match.

## Still to come

Once infra has created the above, the deploy workflows follow the website template's flow:

- **Deploy to dev** on every merge to `main`;
- **Release new version** tags `vX.Y.Z`;
- **Deploy to staging** deploys that tag;
- **Promote to production** deploys it after an Environment reviewer approves.

Each deploy runs `wrangler deploy --env <env>`, then writes the Environment's secrets with `wrangler secret bulk`, then checks `GET /healthz`. A 503 there fails the deploy.

Until then, nothing deploys. Never deploy from a laptop.
