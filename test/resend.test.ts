// Contract test of the Resend adapter: the request it builds and how it reads answers.
import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../src/log";
import { resend } from "../src/mail/providers/resend";
import type { Mail } from "../src/mail/types";
import { mockFetch, RESEND_KEY, resendHost, testEnv } from "./helpers";

const account = { provider: "resend", secret: "MAIL_KEY_TRISLAB", fromDomains: ["forms.trislab.com"] };
const mail: Mail = {
  from: { email: "obrazec@forms.trislab.com", name: 'Fasada "na" ključ <x>' },
  to: ["a@example.com", "b@example.com"],
  replyTo: "visitor@example.com",
  subject: "Zadeva",
  text: "Besedilo",
  html: "<p>Besedilo</p>",
  idempotencyKey: "0f8fad5b-d9cb-469f-a165-70867728950e",
};
const provider = (env = testEnv()) => resend.create(account, env, Logger.create({}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the Resend adapter", () => {
  it("sends the mail as Resend expects", async () => {
    const fetch = mockFetch();
    expect(await provider().send(mail)).toEqual({ ok: true, provider: "resend", messageId: "resend-message-1" });

    const request = fetch.to(resendHost)[0]!;
    expect(request.url).toBe("https://api.resend.com/emails");
    expect(request.headers.get("authorization")).toBe(`Bearer ${RESEND_KEY}`);
    expect(request.headers.get("idempotency-key")).toBe(mail.idempotencyKey);
    expect(await request.json()).toEqual({
      from: '"Fasada na ključ x" <obrazec@forms.trislab.com>',
      to: ["a@example.com", "b@example.com"],
      reply_to: "visitor@example.com",
      subject: "Zadeva",
      text: "Besedilo",
      html: "<p>Besedilo</p>",
    });
  });

  it("leaves out reply_to without one", async () => {
    const fetch = mockFetch();
    await provider().send({ ...mail, replyTo: undefined });
    expect(await fetch.to(resendHost)[0]!.json()).not.toHaveProperty("reply_to");
  });

  it.each([
    [429, "rate_limit_exceeded", true],
    [500, "internal_server_error", true],
    [409, "concurrent_idempotent_requests", true],
    [409, "invalid_idempotent_request", false],
    [403, "invalid_api_key", false],
    [422, "validation_error", false],
  ])("maps HTTP %i %s to retryable=%s", async (status, name, retryable) => {
    mockFetch({ [resendHost]: () => Response.json({ statusCode: status, name, message: "x" }, { status }) });
    expect(await provider().send(mail)).toEqual({ ok: false, provider: "resend", status, retryable, code: name });
  });

  it("maps a network error to retryable", async () => {
    mockFetch({ [resendHost]: () => Promise.reject(new TypeError("network")) });
    expect(await provider().send(mail)).toMatchObject({ ok: false, retryable: true, code: "network" });
  });

  it("refuses to send without its key", async () => {
    const fetch = mockFetch();
    expect(await provider(testEnv({ MAIL_KEY_TRISLAB: undefined })).send(mail)).toMatchObject({ ok: false, retryable: false, code: "not_configured" });
    expect(fetch.calls).toHaveLength(0);
  });
});
