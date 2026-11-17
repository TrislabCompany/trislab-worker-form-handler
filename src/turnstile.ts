/**
 * Server-side Turnstile check (docs/architecture.md, step 5): the token the
 * widget put into `cf-turnstile-response` goes to Cloudflare's siteverify API
 * with the site environment's secret. Only this proves a person sent the form.
 */
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;

/** Cloudflare's test secrets (1x… passes, 2x… fails, 3x… token spent). Never valid in production. */
export function isTestSecret(secret: string): boolean {
  return /^\dx0+AA$/.test(secret);
}

export interface TurnstileCheck {
  secret: string;
  token: string;
  ip?: string;
  idempotencyKey: string;
  /** Hostnames the widget may have run on (the hosts of the site's origins). */
  hostnames: string[];
  action: string;
}

export type TurnstileResult = { ok: true } | { ok: false; code: string };

interface SiteverifyResponse {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

export async function verifyTurnstile(check: TurnstileCheck): Promise<TurnstileResult> {
  if (check.token === "" || check.token.length > 2048) return { ok: false, code: "missing_token" };

  const body = new FormData();
  body.set("secret", check.secret);
  body.set("response", check.token);
  body.set("idempotency_key", check.idempotencyKey);
  if (check.ip) body.set("remoteip", check.ip);

  let result: SiteverifyResponse;
  try {
    const response = await fetch(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return { ok: false, code: `siteverify_http_${response.status}` };
    result = await response.json<SiteverifyResponse>();
  } catch {
    return { ok: false, code: "siteverify_unreachable" };
  }

  if (!result.success) return { ok: false, code: result["error-codes"]?.[0] ?? "rejected" };
  // The test secrets answer with a fixed hostname and no action, so only real secrets check them.
  if (!isTestSecret(check.secret)) {
    if (!result.hostname || !check.hostnames.includes(result.hostname)) return { ok: false, code: "hostname_mismatch" };
    if (result.action !== check.action) return { ok: false, code: "action_mismatch" };
  }
  return { ok: true };
}
