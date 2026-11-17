// Contract test of the ACS adapter: the request it builds and how it reads answers.
import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../src/log";
import { acs } from "../src/mail/providers/acs";
import type { Mail } from "../src/mail/types";
import { ACS_ENDPOINT, acsHost, mockFetch, testEnv } from "./helpers";

const account = { provider: "acs", endpointVar: "MAIL_ENDPOINT_TRISLAB", secret: "MAIL_KEY_TRISLAB", fromDomains: ["forms.trislab.com"] };
const mail: Mail = {
  from: { email: "obrazec@forms.trislab.com", name: "Fasada na ključ" },
  to: ["a@example.com", "b@example.com"],
  replyTo: "visitor@example.com",
  subject: "Zadeva",
  text: "Besedilo",
  html: "<p>Besedilo</p>",
  idempotencyKey: "0f8fad5b-d9cb-469f-a165-70867728950e",
  firstSentAt: new Date("2026-11-17T10:00:00Z"),
};
const provider = () => acs.create(account, testEnv(), Logger.create({}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the ACS adapter", () => {
  it("signs the request as ACS expects", async () => {
    const fetch = mockFetch();
    const result = await provider().send(mail);
    expect(result).toEqual({ ok: true, provider: "acs", messageId: "acs-message-1" });

    const request = fetch.to(acsHost)[0]!;
    expect(request.url).toBe(`${ACS_ENDPOINT}/emails:send?api-version=2023-03-31`);
    const body = await request.text();
    const hash = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)))));
    expect(request.headers.get("x-ms-content-sha256")).toBe(hash);

    const date = request.headers.get("x-ms-date")!;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("k".repeat(32)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const toSign = `POST\n/emails:send?api-version=2023-03-31\n${date};${acsHost};${hash}`;
    const signature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(toSign)))));
    expect(request.headers.get("authorization")).toBe(`HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`);

    expect(request.headers.get("repeatability-request-id")).toBe(mail.idempotencyKey);
    expect(request.headers.get("repeatability-first-sent")).toBe("Tue, 17 Nov 2026 10:00:00 GMT");
    expect(JSON.parse(body)).toEqual({
      senderAddress: "obrazec@forms.trislab.com",
      recipients: { to: [{ address: "a@example.com" }, { address: "b@example.com" }] },
      content: { subject: "Zadeva", plainText: "Besedilo", html: "<p>Besedilo</p>" },
      replyTo: [{ address: "visitor@example.com" }],
      userEngagementTrackingDisabled: true,
    });
  });

  it.each([
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [401, false],
  ])("maps HTTP %i to retryable=%s", async (status, retryable) => {
    mockFetch({ [acsHost]: () => Response.json({ error: { code: `Code${status}` } }, { status }) });
    expect(await provider().send(mail)).toEqual({ ok: false, provider: "acs", status, retryable, code: `Code${status}` });
  });

  it("maps a network error to retryable", async () => {
    mockFetch({ [acsHost]: () => Promise.reject(new TypeError("network")) });
    expect(await provider().send(mail)).toMatchObject({ ok: false, retryable: true, code: "network" });
  });

  it("refuses to send without its endpoint or key", async () => {
    const fetch = mockFetch();
    const unconfigured = acs.create(account, testEnv({ MAIL_KEY_TRISLAB: undefined }), Logger.create({}));
    expect(await unconfigured.send(mail)).toMatchObject({ ok: false, retryable: false, code: "not_configured" });
    expect(fetch.calls).toHaveLength(0);
  });
});
