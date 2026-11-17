/**
 * Resend (docs/mail-providers.md): one JSON POST with a bearer key. The
 * `Idempotency-Key` header makes a retry with the same key send once (Resend
 * keeps keys for 24 hours). The key is a sending-only key per environment,
 * limited to the sender domain.
 *
 * https://resend.com/docs/api-reference/emails/send-email
 * https://resend.com/docs/api-reference/errors
 */
import { named } from "../../env";
import type { Mail, ProviderDefinition, SendResult } from "../types";

const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 8000;

export const resend: ProviderDefinition = {
  production: true,
  needs: (account) => [account.secret ?? "(secret)"],
  create(account, env) {
    const key = account.secret ? named(env, account.secret) : undefined;
    return {
      name: "resend",
      async send(mail: Mail): Promise<SendResult> {
        if (!key) return { ok: false, provider: "resend", retryable: false, code: "not_configured" };
        try {
          return await sendResend(key, mail);
        } catch {
          return { ok: false, provider: "resend", retryable: true, code: "network" };
        }
      },
    };
  },
};

async function sendResend(key: string, mail: Mail): Promise<SendResult> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "idempotency-key": mail.idempotencyKey,
    },
    body: JSON.stringify({
      from: address(mail.from.email, mail.from.name),
      to: mail.to,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (response.ok) {
    const result = await response.json<{ id?: string }>().catch(() => ({}) as { id?: string });
    return { ok: true, provider: "resend", messageId: result.id };
  }
  const error = await response.json<{ name?: string }>().catch(() => ({}) as { name?: string });
  const code = error.name ?? `http_${response.status}`;
  return {
    ok: false,
    provider: "resend",
    status: response.status,
    // 409 concurrent_idempotent_requests: the same key is still being sent; a retry gets its answer.
    retryable: response.status === 429 || response.status >= 500 || code === "concurrent_idempotent_requests",
    code,
  };
}

/** `"Name" <email>`, with the characters that would break the header removed from the name. */
function address(email: string, name?: string): string {
  const clean = (name ?? "").replace(/["\\<>\r\n]/g, "").trim();
  return clean ? `"${clean}" <${email}>` : email;
}
