# Architecture

A site's form is a plain HTML form post (no JavaScript needed) to `POST /f/<form-id>`. The site is static, so it cannot hold the Turnstile secret or send mail. This Worker does both, for every site (D-32).

## The pipeline (`src/handler.ts`)

| Step | Check | When it fails |
| --- | --- | --- |
| 1 | The path is `/f/<form-id>` of a form in `src/forms.ts`, and the method is `POST` | 404 / 405 |
| 2 | `Origin` is one of the form's site's origins in this environment (`SITES`) | 403 |
| 3 | The configuration is complete (`src/config.ts`) | error page |
| 4 | A plain form post (`application/x-www-form-urlencoded`) of at most 32 KB | error page |
| 5 | The honeypot field, if the form has one, is empty | **thank-you page**, nothing sent: the bot learns nothing |
| 6 | Rate limit: 5 posts a minute per form and visitor IP | error page |
| 7 | Turnstile `siteverify` with the site's secret, the visitor IP and an idempotency key; the hostname and action must match | error page |
| 8 | The fields (`src/validate.ts`): required, choices, lengths, numbers, e-mail, phone, consent, "phone or e-mail" | error page |
| 9 | The actions, all at once | error page if a required action failed |
| 10 | 303 to the form's success page | — |

From step 3 on, every answer is a 303 to a page on the posting origin, so a person always lands on the site. The error page tells the visitor that sending failed and how else to reach the company.

The submission ID is a UUID derived from the Turnstile token. A double submit of the same page gets the same ID. Turnstile's idempotency key then gives the same answer, and ACS sends the mail once (`repeatability-request-id`).

## Actions (`src/actions/`)

A form lists its actions. They run at the same time, each with a timeout (8 s). The visitor goes to the success page when every `required` action succeeded. A failed optional action is logged as `action.failed` at level `error`, which raises the alert.

| Type | Does | State |
| --- | --- | --- |
| `email` | The submission to the form's recipients through a mail account, `Reply-To` = the visitor's e-mail. One retry on a retryable error, then the fallback account if set | Built |
| `http` | A call to an external system, such as "create an offer" in a client's CRM: one typed target file per system | Phase 6; the config check refuses it until then |

## What it does not do

- **Store anything.** The submission exists only in the request and in the mail.
- **Log personal data** ([logging.md](logging.md)).
- **Serve pages.** The thank-you and error pages are the site's.

## Code map

```
src/
  index.ts          entry point
  handler.ts        the pipeline above
  forms.ts          the form registry
  config.ts         SITES, MAIL_ACCOUNTS, RECIPIENTS, secrets; the config check
  validate.ts       field rules
  turnstile.ts      siteverify
  render.ts         the mail's subject, text and HTML (escaped)
  actions/          run.ts (parallel, timeout, outcome), email.ts
  mail/             types.ts (contract), registry.ts, send.ts (retry, fallback), providers/
  log.ts            structured logging
  azure-logs.ts     shipping to Log Analytics
```
