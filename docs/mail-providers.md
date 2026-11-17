# Mail providers

The handler never knows which service sends a mail. A form names an **account**; the account (in `MAIL_ACCOUNTS`) names its **provider**; the provider is one file in `src/mail/providers/`.

```jsonc
// MAIL_ACCOUNTS
{
  "trislab": { "provider": "acs", "endpointVar": "MAIL_ENDPOINT_TRISLAB", "secret": "MAIL_KEY_TRISLAB", "fromDomains": ["forms.trislab.com"] }
}
```

`secret` and `endpointVar` are the *names* of a Worker secret or var, never the values. `fromDomains` is the allowlist of sender domains verified with the provider.

## The contract (`src/mail/types.ts`)

A provider's `send(mail)` never throws: it returns `{ ok: true, messageId }` or `{ ok: false, retryable, code, status }`. `src/mail/send.ts` retries a retryable failure once after 500 ms with the same idempotency key, then tries the form's `fallback` account once, and logs every attempt.

## Providers

| Provider | Status | Notes |
| --- | --- | --- |
| `acs` | First, as D-27, D-32 and D-33 decided | Azure Communication Services Email, EU data location. REST `emails:send` signed with HMAC-SHA256 using the access key. `repeatability-request-id` makes a retry send once. The sender's display name is set on the sender username in Azure, not per mail |
| `log-only` | Local and tests | Prints the mail instead of sending it. Refused in production |
| `cloudflare` | Later | Cloudflare Email Service, once it is GA and the account is on Workers Paid |

## Adding a provider

1. `src/mail/providers/<name>.ts` implementing `ProviderDefinition`: `create`, `needs` (the names it requires) and `production`. Use `fetch` only, map every error to `retryable` and `code`, and never log field values.
2. A contract test against a recorded answer, like `test/acs.test.ts`.
3. One line in `src/mail/registry.ts`.
4. An account in `MAIL_ACCOUNTS` and its secret in the GitHub Environments.
5. Point the forms at the account, and name the provider in those sites' privacy policies.
