/**
 * Reads and checks the Worker's configuration (docs/configuration.md).
 *
 * The check runs on the first request of each isolate, so a misconfigured
 * deploy fails its smoke test (`GET /healthz` answers 503) instead of a
 * visitor's submission. In CI, test/config-env.test.ts runs the static part of
 * it against every environment of wrangler.toml.
 */
import type { Env } from "./env";
import { named, turnstileSecretName } from "./env";
import { providers } from "./mail/registry";
import type { AccountConfig } from "./mail/types";
import { isTestSecret } from "./turnstile";
import type { FormConfig } from "./types";
import { isEmail } from "./validate";

export interface Config {
  /** Site → the origins its forms may be posted from. */
  sites: Record<string, string[]>;
  accounts: Record<string, AccountConfig>;
  /** Form ID → recipients. Empty when only the static part was checked. */
  recipients: Record<string, string[]>;
}

/** "static": only what is in git (vars and the registry). "runtime": also the secrets. */
export type CheckMode = "static" | "runtime";

export interface LoadedConfig {
  config: Config;
  /** Every problem found; the Worker refuses to work while there is one. */
  issues: string[];
}

const MAX_RECIPIENTS = 50;

export function loadConfig(env: Env, forms: Record<string, FormConfig>, mode: CheckMode): LoadedConfig {
  const issues: string[] = [];
  const production = env.ENVIRONMENT === "production";

  const sites = parseJson<Record<string, string[]>>("SITES", env.SITES, issues) ?? {};
  const accounts = parseJson<Record<string, AccountConfig>>("MAIL_ACCOUNTS", env.MAIL_ACCOUNTS, issues) ?? {};
  const recipients = mode === "runtime" ? (parseJson<Record<string, string[]>>("RECIPIENTS", env.RECIPIENTS, issues) ?? {}) : {};

  for (const [site, origins] of Object.entries(sites)) {
    if (!Array.isArray(origins) || origins.length === 0) issues.push(`SITES.${site}: needs at least one origin`);
    else for (const origin of origins) checkOrigin(site, origin, production, issues);
  }

  for (const [name, account] of Object.entries(accounts)) {
    const definition = providers[account.provider];
    if (!definition) {
      issues.push(`MAIL_ACCOUNTS.${name}: unknown provider "${account.provider}"`);
      continue;
    }
    if (production && !definition.production) issues.push(`MAIL_ACCOUNTS.${name}: provider "${account.provider}" is not allowed in production`);
    if (!Array.isArray(account.fromDomains) || account.fromDomains.length === 0) issues.push(`MAIL_ACCOUNTS.${name}: needs fromDomains`);
    if (mode === "runtime") {
      for (const needed of definition.needs(account)) {
        if (!named(env, needed)) issues.push(`MAIL_ACCOUNTS.${name}: ${needed} is not set`);
      }
    }
  }

  const sitesWithForms = new Set<string>();
  for (const [id, form] of Object.entries(forms)) {
    if (!/^[a-z0-9-]+$/.test(id)) issues.push(`form ${id}: the ID may only use a-z, 0-9 and -`);
    if (!sites[form.site]) {
      // A site may be missing from an environment on purpose: its forms are then refused there.
      continue;
    }
    sitesWithForms.add(form.site);
    for (const path of [form.successPath, form.errorPath]) {
      if (!path.startsWith("/") || path.startsWith("//")) issues.push(`form ${id}: "${path}" must be a path on the site`);
    }
    for (const group of form.oneOf ?? []) {
      for (const field of group) if (!form.fields[field]) issues.push(`form ${id}: oneOf names unknown field ${field}`);
    }
    if (form.replyToField && form.fields[form.replyToField]?.type !== "email") issues.push(`form ${id}: replyToField must be an email field`);
    for (const action of form.actions) {
      if (action.type === "http") {
        issues.push(`form ${id}: the http action is not built yet`);
        continue;
      }
      for (const accountName of [action.account, action.fallback].filter((a): a is string => Boolean(a))) {
        const account = accounts[accountName];
        if (!account) {
          issues.push(`form ${id}: unknown mail account "${accountName}"`);
          continue;
        }
        const domain = form.from.email.split("@")[1] ?? "";
        if (!account.fromDomains?.includes(domain)) issues.push(`form ${id}: sender domain ${domain} is not in ${accountName}.fromDomains`);
      }
      if (mode === "runtime") {
        const list = recipients[id];
        if (!Array.isArray(list) || list.length === 0) issues.push(`RECIPIENTS: no recipients for form ${id}`);
        else if (list.length > MAX_RECIPIENTS) issues.push(`RECIPIENTS.${id}: more than ${MAX_RECIPIENTS} recipients`);
        else if (!list.every((r) => typeof r === "string" && isEmail(r))) issues.push(`RECIPIENTS.${id}: an entry is not an e-mail address`);
      }
    }
  }

  if (mode === "runtime") {
    for (const site of sitesWithForms) {
      const name = turnstileSecretName(site);
      const secret = named(env, name);
      if (!secret) issues.push(`${name} is not set`);
      else if (production && isTestSecret(secret)) issues.push(`${name} is a Turnstile test secret`);
    }
  }

  return { config: { sites, accounts, recipients }, issues };
}

function parseJson<T>(name: string, raw: string | undefined, issues: string[]): T | undefined {
  if (!raw) {
    issues.push(`${name} is not set`);
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("not an object");
    return value as T;
  } catch {
    issues.push(`${name} is not a JSON object`);
    return undefined;
  }
}

function checkOrigin(site: string, origin: string, production: boolean, issues: string[]): void {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    issues.push(`SITES.${site}: "${origin}" is not a URL`);
    return;
  }
  if (url.origin !== origin) issues.push(`SITES.${site}: "${origin}" must be an origin (scheme and host, no path)`);
  const local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !(local && !production)) issues.push(`SITES.${site}: "${origin}" must use https`);
}

// One check per isolate: the env object stays the same for the isolate's life.
const cache = new WeakMap<object, LoadedConfig>();

export function runtimeConfig(env: Env, forms: Record<string, FormConfig>): LoadedConfig {
  let loaded = cache.get(env);
  if (!loaded) {
    loaded = loadConfig(env, forms, "runtime");
    cache.set(env, loaded);
  }
  return loaded;
}
