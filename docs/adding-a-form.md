# Adding a form or a site

1. **Infra PR** (`tl-cloud-infrastructure`): `turnstile: true` on the site's environments in `catalog/products.yaml`. The widget is created, its secret goes to this repository's Environments as `TURNSTILE_SECRET_<SITE>`, and its site key goes to the site.
2. **This repository, one PR:**
   - the site and its origins in `SITES` of every environment in `wrangler.toml` (local: its `astro dev` port);
   - the form in `src/forms.ts`: ID `<site-slug>-<form>`, the site, the Turnstile action the page uses, the sender (a domain in the account's `fromDomains`), the subject, every field with its rule and label, `oneOf`, `replyToField`, the two pages, the actions;
   - the local test secret in `.dev.vars.example`;
   - a test of a valid post and of a rejected one.
3. **By hand, devops:** add the form's recipients to the `RECIPIENTS` secret of each Environment. Dev and staging use the Trislab test inbox; production uses the company's mailbox. Then re-run the deploy, and check `/healthz`.
4. **The site's PR:** the form's `action` (this Worker's address per environment), the Turnstile site key, the form page's Content-Security-Policy (`challenges.cloudflare.com` in `script-src` and `frame-src`, this Worker's origin in `form-action`), and the privacy policy (Cloudflare and the mail provider as processors; the data is e-mailed, not stored). See `docs/forms.md` in `tl-template-website`.

## Field rules

| Type | Posted as | Checks |
| --- | --- | --- |
| `text` | `<input>`, `<textarea>` (`multiline: true` keeps line breaks) | `max` characters |
| `enum` | `<select>`, radio group | the value is a key of `values`; the e-mail shows its label |
| `int` | `<input type="number">` | whole number between `min` and `max` |
| `email` | `<input type="email">` | an address |
| `phone` | `<input type="tel">` | 6–20 digits and the usual separators |
| `consent` | checkbox | exactly `value`; always required |

The rules must match the page: the browser checks first, and the Worker refuses anything the page would not send.
