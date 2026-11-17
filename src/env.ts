/**
 * The Worker's bindings and settings (docs/configuration.md).
 *
 * Vars come from wrangler.toml; secrets are Worker secrets that the deploy
 * workflow writes from the GitHub Environment. Secrets that are looked up by
 * name (`TURNSTILE_SECRET_<SITE>`, an account's `secret` or `endpointVar`)
 * are read through {@link named}, so they need no field here.
 */
export interface Env {
  /** "local", "dev", "staging" or "production". */
  ENVIRONMENT: string;
  /** The release this Worker runs (vX.Y.Z), set by the deploy workflow. */
  VERSION?: string;
  /** JSON: site → the origins its forms are posted from. */
  SITES: string;
  /** JSON: mail account → provider and settings (src/mail/accounts.ts). */
  MAIL_ACCOUNTS: string;
  /** Secret, JSON: form ID → recipient addresses. Personal data: never in git. */
  RECIPIENTS?: string;
  /** Workers Rate Limiting binding. */
  RATE_LIMITER?: RateLimit;

  /** Azure Monitor Logs Ingestion (src/azure-logs.ts). Off unless all are set. */
  AZURE_TENANT_ID?: string;
  AZURE_LOGS_CLIENT_ID?: string;
  AZURE_LOGS_CLIENT_SECRET?: string;
  AZURE_LOGS_DCE?: string;
  AZURE_LOGS_DCR_ID?: string;
}

/** Reads a var or secret by name, such as `TURNSTILE_SECRET_<SITE>`. */
export function named(env: Env, name: string): string | undefined {
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** The name of a site's Turnstile secret: `TURNSTILE_SECRET_` + the site in upper snake case. */
export function turnstileSecretName(site: string): string {
  return `TURNSTILE_SECRET_${site.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}
