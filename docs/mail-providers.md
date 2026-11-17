# Mail providers

The handler never knows which service sends a mail. A form names an **account**; the account (in `MAIL_ACCOUNTS`) names its **provider**; the provider is one file in `src/mail/providers/`.

```jsonc
// MAIL_ACCOUNTS
{
  "trislab": { "provider": "resend", "secret": "MAIL_KEY_TRISLAB", "fromDomains": ["forms.trislab.com"] }
}
```

`secret` and `endpointVar` are the *names* of a Worker secret or var, never the values. `fromDomains` is the allowlist of sender domains verified with the provider.

## The contract (`src/mail/types.ts`)

A provider's `send(mail)` never throws: it returns `{ ok: true, messageId }` or `{ ok: false, retryable, code, status }`. `src/mail/send.ts` retries a retryable failure once after 500 ms with the same idempotency key, then tries the form's `fallback` account once, and logs every attempt.

## Providers

| Provider | Status | Notes |
| --- | --- | --- |
| `resend` | First | Resend: one JSON `POST /emails` with a sending-only key. `Idempotency-Key` makes a retry send once. The sender domain `forms.trislab.com` is verified in Resend with records in tl-cloud-infrastructure (`global/edge/records/trislab.com/`), in the EU region. Resend is a processor that every site with a form names in its privacy policy |
| `log-only` | Local and tests | Prints the mail instead of sending it. Refused in production |
| `cloudflare` | Later | Cloudflare Email Service, once it is GA and the account is on Workers Paid |

## Adding a provider

1. `src/mail/providers/<name>.ts` implementing `ProviderDefinition`: `create`, `needs` (the names it requires) and `production`. Use `fetch` only, map every error to `retryable` and `code`, and never log field values.
2. A contract test against a recorded answer, like `test/resend.test.ts`.
3. One line in `src/mail/registry.ts`.
4. An account in `MAIL_ACCOUNTS` and its secret in the GitHub Environments.
5. Point the forms at the account, and name the provider in those sites' privacy policies.

## Why not Azure Communication Services Email

D-27 and D-32 chose ACS Email. In September 2026 Microsoft announced that ACS, Email included, retires on 30 September 2028, limited new onboarding from 23 October 2026, and advised against starting new solutions on it. So the form handler starts on Resend. Cloudflare Email Service replaces it once it is GA and the account is on Workers Paid; the provider layer makes either a new file, not a rewrite.
