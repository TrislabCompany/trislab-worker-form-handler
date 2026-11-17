/**
 * Sends a form's mail through its account (docs/mail-providers.md): one retry
 * after a retryable failure with the same idempotency key, then the fallback
 * account once if the form has one. Logs one event per attempt.
 */
import type { Config } from "../config";
import type { Env } from "../env";
import type { Logger } from "../log";
import { providers } from "./registry";
import type { Mail, SendResult } from "./types";

export interface SendOptions {
  account: string;
  fallback?: string;
  /** Wait before the retry; replaced in tests. */
  sleep?: (ms: number) => Promise<void>;
  retryDelayMs?: number;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function sendMail(mail: Mail, options: SendOptions, config: Config, env: Env, log: Logger): Promise<SendResult> {
  const sleep = options.sleep ?? wait;
  const first = await sendThrough(options.account, mail, config, env, log, 1);
  if (first.ok) return first;

  let last = first;
  if (first.retryable) {
    await sleep(options.retryDelayMs ?? 500);
    log.warn("action.retried", { action: "email", account: options.account, code: first.code });
    const second = await sendThrough(options.account, mail, config, env, log, 2);
    if (second.ok) return second;
    last = second;
  }

  if (options.fallback) {
    log.warn("action.fallback", { action: "email", account: options.fallback, code: last.code });
    return sendThrough(options.fallback, mail, config, env, log, 1);
  }
  return last;
}

async function sendThrough(accountName: string, mail: Mail, config: Config, env: Env, log: Logger, attempt: number): Promise<SendResult> {
  const account = config.accounts[accountName];
  const definition = account ? providers[account.provider] : undefined;
  if (!account || !definition) return { ok: false, provider: "none", retryable: false, code: "unknown_account" };

  const started = Date.now();
  const scoped = log.with({ account: accountName, provider: account.provider, attempt });
  const result = await definition.create(account, env, scoped).send(mail);
  const durationMs = Date.now() - started;
  if (result.ok) scoped.info("mail.sent", { messageId: result.messageId, durationMs });
  else scoped.warn("mail.failed", { code: result.code, status: result.status, retryable: result.retryable, durationMs });
  return result;
}
