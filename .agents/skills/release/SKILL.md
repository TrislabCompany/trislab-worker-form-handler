---
name: release
description: Deploy, release or promote the form handler Worker, or show which version runs where. Follows a merged change to dev, runs Release new version to tag and bundle the next vX.Y.Z and deploy it to staging, runs Promote to production, and explains a rollback, following docs/deployment.md. Use when the user asks to deploy, release, tag, promote, roll back, ship to production, or where a version runs.
metadata:
  owner: project
---

# release

Runs the steps of [docs/deployment.md](../../../docs/deployment.md) with `gh`. The workflows do the work: this skill checks the preconditions, starts them, watches them and reports. It never edits a workflow, never tags and never deploys by hand.

## Commands

| Command | Does |
| --- | --- |
| `release status` | Each Environment's newest `deploy:worker` deployment and its state: `gh api "repos/{owner}/{repo}/deployments?environment=<env>&task=deploy:worker&per_page=1"`, then its statuses, and `curl -s <WORKER_URL>/healthz` |
| `release deploy` | Finds the *Deploy to dev* run of the newest commit of `main`, watches it and reports |
| `release new [patch\|minor\|major]` | Checks the preconditions below, proposes the bump, and after a yes runs *Release new version*, then watches it and *Deploy to staging* |
| `release promote` | Runs *Promote to production* for the version staging runs, after a yes |
| `release rollback` | Explains the rollback in [Roll back](../../../docs/deployment.md#roll-back), which only a person does |

## Steps

1. **Read the state:** `git fetch origin --tags`, then `release status`.
2. **Check the preconditions,** and stop with the reason when one fails:
   - `deploy`: the newest commit of `origin/main` has a *Deploy to dev* run.
   - `new`: on `main` and up to date; a commit since the newest `vX.Y.Z` tag; dev runs the newest commit of `main` and its deploy succeeded; `ci` passed on it; no other *Release new version* run is queued or running. Propose the bump from the commits: `major` breaks a site's form posts, `minor` adds a feature, `patch` fixes. Under `0.x` a breaking change is a `minor`.
   - `promote`: staging's newest `deploy:worker` deployment succeeded and its ref is a tag `vX.Y.Z`. Say which version will be promoted.
3. **Show what will happen** and **ask for a yes** before `new` and `promote`.
4. **Run it:** `gh workflow run release.yml -f bump=<bump>`, or `gh workflow run promote.yml`. Never run `worker-deploy.yml` directly.
5. **Watch it:** `gh run list --workflow <file> --limit 1`, then `gh run watch <run id> --exit-status`. *Promote to production* waits for a reviewer of `production`: say so; nobody approves their own run.
6. **Report** each run's result and link, and each Environment's version. On a failure, read `gh run view <run id> --log-failed` and match it to [When a run fails](../../../docs/deployment.md#when-a-run-fails).

## Rules

- Never create, move, delete or push a tag. Only *Release new version* creates one.
- Never deploy by other means: `wrangler` from a laptop or the Cloudflare dashboard. The one dashboard step is the production rollback, done by a person.
- Never set or print a secret's value. Setting `RECIPIENTS` or `MAIL_KEY_*` is a person's step.
