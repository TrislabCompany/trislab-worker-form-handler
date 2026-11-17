# Deployment

| Environment | Worker | Address | Sites |
| --- | --- | --- | --- |
| dev | `form-handler-dev` | `forms-dev.trislab.com` | `dev.<site>` |
| staging | `form-handler-staging` | `forms-staging.trislab.com` | `staging.<site>` |
| production | `form-handler-production` | `forms.trislab.com` | `production.<site>`, and the site's own domain from its cutover |

The hostnames and routes, the GitHub Environments, the deploy token and the Turnstile secrets come from `tl-cloud-infrastructure`. They do not exist yet.

## Still to come

Once infra has created the above, the deploy workflows follow the website template's flow:

- **Deploy to dev** on every merge to `main`;
- **Release new version** tags `vX.Y.Z`;
- **Deploy to staging** deploys that tag;
- **Promote to production** deploys it after an Environment reviewer approves.

Each deploy runs `wrangler deploy --env <env>`, then writes the Environment's secrets with `wrangler secret bulk`, then checks `GET /healthz`. A 503 there fails the deploy.

Until then, nothing deploys. Never deploy from a laptop.
