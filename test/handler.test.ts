import { afterEach, describe, expect, it, vi } from "vitest";
import { forms } from "../src/forms";
import type { FormConfig } from "../src/types";
import { RESEND_ACCOUNTS, resendHost, call, mockFetch, ORIGIN, post, testEnv, validFasada } from "./helpers";

const FORM = "/f/fasadanakljuc-povprasevanje";
const THANKS = `${ORIGIN}/povprasevanje/hvala`;
const FAILED = `${ORIGIN}/povprasevanje/napaka`;
const resendEnv = () => testEnv({ MAIL_ACCOUNTS: RESEND_ACCOUNTS });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a valid submission", () => {
  it("sends one mail and goes to the thank-you page", async () => {
    const fetch = mockFetch();
    const response = await call(post(FORM, validFasada), resendEnv());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(THANKS);
    const sent = fetch.to(resendHost);
    expect(sent).toHaveLength(1);
    const body = await sent[0]!.json<{ from: string; to: string[]; reply_to: string; subject: string; text: string }>();
    expect(body.from).toBe('"Fasada na ključ" <obrazec@forms.trislab.com>');
    expect(body.to).toEqual(["prejemnik@example.com"]);
    expect(body.reply_to).toBe("janez@example.com");
    expect(body.subject).toBe("Novo povpraševanje – Toplotna izolacija in nov omet, Ljubljana");
    expect(body.text).toContain("Enostanovanjska hiša");
  });

  it("checks the token with the site's secret, the visitor IP and an idempotency key", async () => {
    const fetch = mockFetch();
    await call(post(FORM, validFasada), resendEnv());
    const verify = await fetch.to("challenges.cloudflare.com")[0]!.formData();
    expect(verify.get("secret")).toBe("1x0000000000000000000000000000000AA");
    expect(verify.get("response")).toBe("token-123");
    expect(verify.get("remoteip")).toBe("203.0.113.7");
    expect(verify.get("idempotency_key")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("works with the log-only provider of the local setup", async () => {
    const fetch = mockFetch();
    const response = await call(post(FORM, validFasada), testEnv());
    expect(response.headers.get("location")).toBe(THANKS);
    expect(fetch.to(resendHost)).toHaveLength(0);
  });

  it("gives a double submit of the same page the same idempotency key", async () => {
    const fetch = mockFetch();
    await call(post(FORM, validFasada), resendEnv());
    await call(post(FORM, validFasada), resendEnv());
    const ids = fetch.to(resendHost).map((r) => r.headers.get("idempotency-key"));
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).toBe(ids[1]);
  });
});

describe("rejected without sending", () => {
  it("an unknown form: 404", async () => {
    mockFetch();
    expect((await call(post("/f/no-such-form", validFasada), resendEnv())).status).toBe(404);
    expect((await call(post("/other", validFasada), resendEnv())).status).toBe(404);
  });

  it("a GET to a form: 405", async () => {
    const response = await call(new Request(`https://forms.test${FORM}`), resendEnv());
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("a wrong or missing origin: 403", async () => {
    const fetch = mockFetch();
    expect((await call(post(FORM, validFasada, { origin: "https://evil.example" }), resendEnv())).status).toBe(403);
    expect((await call(post(FORM, validFasada, { origin: "http://localhost:4322" }), resendEnv())).status).toBe(403);
    expect(fetch.calls).toHaveLength(0);
  });

  it("a token Turnstile refuses", async () => {
    const fetch = mockFetch({ "challenges.cloudflare.com": () => Response.json({ success: false, "error-codes": ["invalid-input-response"] }) });
    const response = await call(post(FORM, validFasada), resendEnv());
    expect(response.headers.get("location")).toBe(FAILED);
    expect(fetch.to(resendHost)).toHaveLength(0);
  });

  it("a missing token, without asking Turnstile", async () => {
    const fetch = mockFetch();
    const fields = { ...validFasada, "cf-turnstile-response": "" };
    const response = await call(post(FORM, fields), resendEnv());
    expect(response.headers.get("location")).toBe(FAILED);
    expect(fetch.calls).toHaveLength(0);
  });

  it.each([
    ["a missing required field", { ime: "" }],
    ["a value that is not a choice", { vrsta_hise: "grad" }],
    ["no consent", { soglasje: "" }],
    ["neither phone nor e-mail", { telefon: "", eposta: "" }],
    ["a bad e-mail", { eposta: "janez@" }],
    ["an area out of range", { povrsina: "99999" }],
  ])("%s", async (_name, change) => {
    const fetch = mockFetch();
    const response = await call(post(FORM, { ...validFasada, ...change }), resendEnv());
    expect(response.headers.get("location")).toBe(FAILED);
    expect(fetch.to(resendHost)).toHaveLength(0);
  });

  it("a body over 32 KB", async () => {
    const fetch = mockFetch();
    const response = await call(post(FORM, { ...validFasada, sporocilo: "x".repeat(40_000) }), resendEnv());
    expect(response.headers.get("location")).toBe(FAILED);
    expect(fetch.calls).toHaveLength(0);
  });

  it("a post that is not a plain form post", async () => {
    mockFetch();
    const response = await call(post(FORM, validFasada, { "content-type": "application/json" }), resendEnv());
    expect(response.headers.get("location")).toBe(FAILED);
  });

  it("too many posts from one visitor", async () => {
    const fetch = mockFetch();
    const env = testEnv({ MAIL_ACCOUNTS: RESEND_ACCOUNTS, RATE_LIMITER: { limit: async () => ({ success: false }) } });
    const response = await call(post(FORM, validFasada), env);
    expect(response.headers.get("location")).toBe(FAILED);
    expect(fetch.calls).toHaveLength(0);
  });

  it("a filled honeypot looks like success to the bot", async () => {
    const fetch = mockFetch();
    const withHoneypot: Record<string, FormConfig> = { "test-form": { ...forms["fasadanakljuc-povprasevanje"]!, honeypot: "website" } };
    const env = testEnv({ MAIL_ACCOUNTS: RESEND_ACCOUNTS, RECIPIENTS: JSON.stringify({ "test-form": ["prejemnik@example.com"] }) });
    const response = await call(post("/f/test-form", { ...validFasada, website: "http://spam" }), env, { forms: withHoneypot });
    expect(response.headers.get("location")).toBe(THANKS);
    expect(fetch.calls).toHaveLength(0);
  });

  it("an incomplete configuration sends to the error page and fails /healthz", async () => {
    const fetch = mockFetch();
    const env = testEnv({ MAIL_ACCOUNTS: RESEND_ACCOUNTS, RECIPIENTS: undefined });
    expect((await call(post(FORM, validFasada), env)).headers.get("location")).toBe(FAILED);
    expect(fetch.calls).toHaveLength(0);
    expect((await call(new Request("https://forms.test/healthz"), env)).status).toBe(503);
  });
});

describe("when the provider fails", () => {
  it("retries once with the same key, then goes to the error page", async () => {
    const fetch = mockFetch({ [resendHost]: () => Response.json({ statusCode: 503, name: "internal_server_error" }, { status: 503 }) });
    const response = await call(post(FORM, validFasada), resendEnv());
    expect(response.headers.get("location")).toBe(FAILED);
    const attempts = fetch.to(resendHost);
    expect(attempts).toHaveLength(2);
    expect(attempts[0]!.headers.get("idempotency-key")).toBe(attempts[1]!.headers.get("idempotency-key"));
  });

  it("does not retry an error that will not go away", async () => {
    const fetch = mockFetch({ [resendHost]: () => Response.json({ statusCode: 401, name: "missing_api_key" }, { status: 401 }) });
    await call(post(FORM, validFasada), resendEnv());
    expect(fetch.to(resendHost)).toHaveLength(1);
  });

  it("sends through the fallback account", async () => {
    const fetch = mockFetch({ [resendHost]: () => new Response("", { status: 401 }) });
    const withFallback: Record<string, FormConfig> = {
      "fasadanakljuc-povprasevanje": { ...forms["fasadanakljuc-povprasevanje"]!, actions: [{ type: "email", account: "trislab", fallback: "backup", required: true }] },
    };
    const response = await call(post(FORM, validFasada), resendEnv(), { forms: withFallback });
    expect(response.headers.get("location")).toBe(THANKS);
    expect(fetch.to(resendHost)).toHaveLength(1);
  });

  it("an optional action that fails does not fail the submission", async () => {
    mockFetch({ [resendHost]: () => new Response("", { status: 401 }) });
    const twoActions: Record<string, FormConfig> = {
      "fasadanakljuc-povprasevanje": {
        ...forms["fasadanakljuc-povprasevanje"]!,
        actions: [
          { type: "email", account: "backup", required: true },
          { type: "email", account: "trislab", required: false },
        ],
      },
    };
    const response = await call(post(FORM, validFasada), resendEnv(), { forms: twoActions });
    expect(response.headers.get("location")).toBe(THANKS);
  });

  it("a provider that does not answer in time", async () => {
    mockFetch({ [resendHost]: () => new Promise<Response>(() => {}) });
    const response = await call(post(FORM, validFasada), resendEnv(), { actionTimeoutMs: 50 });
    expect(response.headers.get("location")).toBe(FAILED);
  });
});

describe("/healthz", () => {
  it("answers 200 with a complete configuration", async () => {
    const response = await call(new Request("https://forms.test/healthz"), resendEnv());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, env: "local" });
  });
});

describe("logging", () => {
  it("logs no field values", async () => {
    mockFetch();
    const lines: string[] = [];
    for (const method of ["log", "warn", "error"] as const) {
      vi.spyOn(console, method).mockImplementation((line: string) => void lines.push(line));
    }
    await call(post(FORM, { ...validFasada, eposta: "bad" }), resendEnv());
    await call(post(FORM, validFasada), resendEnv());
    const all = lines.join("\n");
    expect(all).toContain("submission.completed");
    for (const value of ["Janez", "janez@example.com", "041 123 456", "Ljubljana", "203.0.113.7", "token-123", "prejemnik@example.com"]) {
      expect(all).not.toContain(value);
    }
  });
});
