# Logging

Every event is one JSON line through `src/log.ts`, with the same base fields: `ts`, `level`, `service`, `env`, `version`, `requestId`, and for a submission `form`, `site`, `submissionId` and `country`. One query on `submissionId` shows everything that happened to one submission.

| Event | Level | Fields |
| --- | --- | --- |
| `submission.received` | info | |
| `submission.rejected` | warn | `reason`: `origin`, `content_type`, `too_large`, `honeypot`, `rate_limit`, `turnstile` (+ `code`), `validation` (+ `errors`: field names and rules) |
| `mail.sent` / `mail.failed` | info / warn | `account`, `provider`, `attempt`, `messageId` or `code`/`status`/`retryable`, `durationMs` |
| `action.retried` / `action.fallback` | warn | `action`, `account`, `code` |
| `action.succeeded` / `action.failed` | info / **error** | `action`, `required`, `ref` or `code`, `durationMs` |
| `submission.completed` | info | `outcome`: `success` or `error`, `results`, `durationMs` |
| `config.invalid` | error | `issues` |

**Never logged:** field values, names, e-mail addresses, phone numbers, IP addresses, the Turnstile token, recipients. A test checks this.

## Where the logs go

- **Workers Logs** (`[observability]` in `wrangler.toml`): always on. Use it for live debugging in the Cloudflare dashboard.
- **Azure Log Analytics** (`src/azure-logs.ts`): the request's events are sent to the Logs Ingestion API after the response (`waitUntil`), into table `FormHandler_CL` on `log-platform`, stream `Custom-FormHandler`. It is off until every `AZURE_*` value is set ([configuration.md](configuration.md)). A failure is logged to Workers Logs as `log.ship_failed` and never affects the visitor.

Alerts (in tl-cloud-infrastructure): `action.failed` > 0 in 15 minutes, a spike in `submission.rejected`, and no `submission.completed` for many days.
