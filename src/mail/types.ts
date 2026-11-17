/** The mail provider contract (docs/mail-providers.md). */
import type { Env } from "../env";
import type { Logger } from "../log";

export interface Mail {
  from: { email: string; name?: string };
  /** At most 50, checked by the config check. */
  to: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  /** A UUID per submission: a provider that supports it sends a repeated request once. */
  idempotencyKey: string;
  /** When the first attempt was made; repeated with the key on a retry. */
  firstSentAt: Date;
}

export type SendResult =
  | { ok: true; provider: string; messageId?: string }
  | { ok: false; provider: string; retryable: boolean; code: string; status?: number };

export interface MailProvider {
  readonly name: string;
  /** Never throws: every error becomes a SendResult. */
  send(mail: Mail): Promise<SendResult>;
}

/** One entry of the MAIL_ACCOUNTS var. Public: secrets are named, never included. */
export interface AccountConfig {
  provider: string;
  /** Sender domains verified with the provider; a form's `from` must be in one. */
  fromDomains: string[];
  /** The Worker secret holding the API key, if the provider needs one. */
  secret?: string;
  /** The var or secret holding the provider endpoint, if it differs per account. */
  endpointVar?: string;
}

export interface ProviderDefinition {
  create(account: AccountConfig, env: Env, log: Logger): MailProvider;
  /** What the account needs set, as names of vars or secrets. */
  needs(account: AccountConfig): string[];
  /** Whether the provider may run in production. */
  production: boolean;
}
