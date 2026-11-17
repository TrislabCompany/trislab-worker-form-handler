import { createExecutionContext, env as baseEnv, waitOnExecutionContext } from "cloudflare:test";
import { vi } from "vitest";
import type { Env } from "../src/env";
import { handle, type HandlerOptions } from "../src/handler";

export const ORIGIN = "http://localhost:4321";
export const TURNSTILE_PASS = "1x0000000000000000000000000000000AA";
export const ACS_ENDPOINT = "https://acs-test.europe.communication.azure.com";
// A made-up key: base64 of 32 bytes.
export const ACS_KEY = btoa("k".repeat(32));

export const ACS_ACCOUNTS = JSON.stringify({
  trislab: { provider: "acs", endpointVar: "MAIL_ENDPOINT_TRISLAB", secret: "MAIL_KEY_TRISLAB", fromDomains: ["forms.trislab.com"] },
  backup: { provider: "log-only", fromDomains: ["forms.trislab.com"] },
});

/** The local env of wrangler.toml plus the secrets a working Worker has. */
export function testEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    ...(baseEnv as unknown as Env),
    RECIPIENTS: JSON.stringify({
      "fasadanakljuc-povprasevanje": ["prejemnik@example.com"],
      "strehanakljuc-povprasevanje": ["prejemnik@example.com"],
    }),
    TURNSTILE_SECRET_ASTRAGROUP_WEBSITE_FASADANAKLJUC: TURNSTILE_PASS,
    TURNSTILE_SECRET_ASTRAGROUP_WEBSITE_STREHANAKLJUC: TURNSTILE_PASS,
    MAIL_ENDPOINT_TRISLAB: ACS_ENDPOINT,
    MAIL_KEY_TRISLAB: ACS_KEY,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    ...overrides,
  } as Env;
}

export const validFasada: Record<string, string> = {
  primer: "prenova",
  vrsta_hise: "enostanovanjska",
  starost_hise: "pred-1980",
  povrsina: "120",
  obcina: "Ljubljana",
  vrsta_del: "izolacija",
  rok: "letos",
  subvencija: "da",
  sporocilo: "Fasada je stara 40 let.\nOkna so nova.",
  ime: "Janez Novak",
  telefon: "041 123 456",
  eposta: "janez@example.com",
  soglasje: "da",
  "cf-turnstile-response": "token-123",
};

export function post(path: string, fields: Record<string, string>, headers: Record<string, string> = {}): Request {
  return new Request(`https://forms.test${path}`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": "203.0.113.7", ...headers },
    body: new URLSearchParams(fields).toString(),
  });
}

export async function call(request: Request, env: Env, options?: HandlerOptions): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await handle(request, env, ctx, options);
  await waitOnExecutionContext(ctx);
  return response;
}

type Route = (request: Request) => Response | Promise<Response>;

export interface FetchMock {
  calls: Request[];
  to(host: string): Request[];
}

/**
 * Replaces the global fetch. Siteverify passes by default; `routes` adds or
 * overrides answers by host. Any other host fails the test.
 */
export function mockFetch(routes: Record<string, Route> = {}): FetchMock {
  const calls: Request[] = [];
  const all: Record<string, Route> = {
    "challenges.cloudflare.com": () => Response.json({ success: true, hostname: "localhost", action: "povprasevanje" }),
    [new URL(ACS_ENDPOINT).host]: () => Response.json({ id: "acs-message-1", status: "Running" }, { status: 202 }),
    ...routes,
  };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    calls.push(request.clone());
    const route = all[new URL(request.url).host];
    if (!route) throw new Error(`unexpected fetch to ${request.url}`);
    return route(request);
  });
  return { calls, to: (host) => calls.filter((r) => new URL(r.url).host === host) };
}

export const acsHost = new URL(ACS_ENDPOINT).host;
