# trislab-worker-form-handler

Trislab's shared form handler: a Cloudflare Worker that receives the forms of Trislab's websites (decisions D-32 and D-33 in `tl-product-ideas`). For each submission it:

1. checks that the post comes from one of the form's sites;
2. checks the Turnstile token with the site's secret;
3. checks the fields against the form's rules;
4. sends the submission by e-mail through the form's mail account (Resend);
5. sends the visitor back to the site's thank-you page, or to its error page.

It stores nothing. The logs hold no personal data.

```
POST https://forms.trislab.com/f/<form-id>    a form submission → 303
GET  https://forms.trislab.com/healthz        200 when the configuration is complete
```

## Work on it

Node 22 and pnpm (Corepack):

```sh
corepack enable
pnpm install
cp .dev.vars.example .dev.vars   # Turnstile test secrets, test recipients
pnpm dev                          # http://localhost:8787; mail is printed, not sent
pnpm test                         # lint, types, tests in workerd, config check
```

Try it with a post as the site would send it:

```sh
curl -i -X POST localhost:8787/f/fasadanakljuc-povprasevanje \
  -H "Origin: http://localhost:4321" \
  -d "primer=prenova&vrsta_hise=vrstna&starost_hise=ne-vem&obcina=Maribor&vrsta_del=izolacija&rok=letos&subvencija=ne&ime=Test&eposta=test@example.com&soglasje=da&cf-turnstile-response=x"
```

## Docs

| | |
| --- | --- |
| [architecture.md](docs/architecture.md) | The pipeline, the actions, what the visitor sees |
| [configuration.md](docs/configuration.md) | Every var and secret, where it lives and who sets it |
| [adding-a-form.md](docs/adding-a-form.md) | A new site or form, step by step |
| [mail-providers.md](docs/mail-providers.md) | The provider contract, Resend, adding a provider |
| [logging.md](docs/logging.md) | The events, Workers Logs and Log Analytics |
| [deployment.md](docs/deployment.md) | Environments and the deploy workflows |

## Licence

Proprietary: [LICENSE](LICENSE). The code is public to read, but it belongs to Trislab d.o.o., and only Trislab, and the clients of the applications Trislab delivers under a written agreement, may use it. Cloning or forking it for use, copying, redistribution and training AI models on it are not allowed. Material of others, such as the dependencies and a client's texts, logos and photos, keeps its owner's rights and its own licence.
