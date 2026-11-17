/**
 * Azure Communication Services Email (D-27, D-32): REST `emails:send`, signed
 * with the resource's access key (HMAC-SHA256). The request is asynchronous:
 * a 202 means ACS accepted the mail and queued it.
 *
 * The sender's display name is set on the sender username in Azure, not per
 * message, so `from.name` is not sent.
 *
 * https://learn.microsoft.com/rest/api/communication/dataplane/email/send
 * https://learn.microsoft.com/azure/communication-services/tutorials/hmac-header-tutorial
 */
import type { Env } from "../../env";
import { named } from "../../env";
import type { AccountConfig, Mail, MailProvider, ProviderDefinition, SendResult } from "../types";

const API_VERSION = "2023-03-31";
const TIMEOUT_MS = 8000;

export const acs: ProviderDefinition = {
  production: true,
  needs: (account) => [account.endpointVar ?? "(endpointVar)", account.secret ?? "(secret)"],
  create(account: AccountConfig, env: Env): MailProvider {
    const endpoint = account.endpointVar ? named(env, account.endpointVar) : undefined;
    const key = account.secret ? named(env, account.secret) : undefined;
    return {
      name: "acs",
      async send(mail: Mail): Promise<SendResult> {
        if (!endpoint || !key) return { ok: false, provider: "acs", retryable: false, code: "not_configured" };
        try {
          return await sendAcs(endpoint, key, mail);
        } catch {
          return { ok: false, provider: "acs", retryable: true, code: "network" };
        }
      },
    };
  },
};

async function sendAcs(endpoint: string, key: string, mail: Mail): Promise<SendResult> {
  const url = new URL(`/emails:send?api-version=${API_VERSION}`, endpoint);
  const body = JSON.stringify({
    senderAddress: mail.from.email,
    recipients: { to: mail.to.map((address) => ({ address })) },
    content: { subject: mail.subject, plainText: mail.text, html: mail.html },
    ...(mail.replyTo ? { replyTo: [{ address: mail.replyTo }] } : {}),
    userEngagementTrackingDisabled: true,
  });

  const date = new Date().toUTCString();
  const contentHash = await sha256Base64(body);
  const toSign = `POST\n${url.pathname}${url.search}\n${date};${url.host};${contentHash}`;
  const signature = await hmacBase64(key, toSign);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ms-date": date,
      "x-ms-content-sha256": contentHash,
      authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
      // ACS sends a repeated request with the same ID only once.
      "repeatability-request-id": mail.idempotencyKey,
      "repeatability-first-sent": mail.firstSentAt.toUTCString(),
    },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (response.status === 202) {
    const result = await response.json<{ id?: string }>().catch(() => ({}) as { id?: string });
    return { ok: true, provider: "acs", messageId: result.id ?? response.headers.get("operation-id") ?? undefined };
  }
  const error = await response.json<{ error?: { code?: string } }>().catch(() => ({}) as { error?: { code?: string } });
  return {
    ok: false,
    provider: "acs",
    status: response.status,
    retryable: response.status === 429 || response.status >= 500,
    code: error.error?.code ?? `http_${response.status}`,
  };
}

async function sha256Base64(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return toBase64(new Uint8Array(digest));
}

async function hmacBase64(base64Key: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", fromBase64(base64Key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return toBase64(new Uint8Array(signature));
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
