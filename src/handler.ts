/**
 * The request pipeline (docs/architecture.md):
 *
 *   POST /f/<form-id>   a form submission → 303 to the form's success or error page
 *   GET  /healthz       200 when the configuration is complete, 503 when not
 *
 * Until the origin is known to be one of the form's sites the answers are
 * plain status codes; after that every outcome is a redirect back to the site,
 * so a person always lands on a page.
 */
import { runActions } from "./actions/run";
import { azureLogsEnabled, shipToAzure } from "./azure-logs";
import { runtimeConfig } from "./config";
import type { Env } from "./env";
import { named, turnstileSecretName } from "./env";
import { forms as registry } from "./forms";
import { Logger } from "./log";
import { verifyTurnstile } from "./turnstile";
import type { FormConfig } from "./types";
import { validate } from "./validate";

export const MAX_BODY_BYTES = 32 * 1024;
const FORM_PATH = /^\/f\/([a-z0-9-]{1,64})$/;

export interface HandlerOptions {
  forms?: Record<string, FormConfig>;
  actionTimeoutMs?: number;
}

export async function handle(request: Request, env: Env, ctx: ExecutionContext, options: HandlerOptions = {}): Promise<Response> {
  const forms = options.forms ?? registry;
  const url = new URL(request.url);
  const log = Logger.create({
    service: "form-handler",
    env: env.ENVIRONMENT,
    version: env.VERSION,
    requestId: request.headers.get("cf-ray") ?? crypto.randomUUID(),
  });

  try {
    if (url.pathname === "/healthz") {
      if (request.method !== "GET" && request.method !== "HEAD") return text(405, "Method Not Allowed", { allow: "GET, HEAD" });
      const { issues } = runtimeConfig(env, forms);
      if (issues.length > 0) log.error("config.invalid", { issues });
      return Response.json({ ok: issues.length === 0, env: env.ENVIRONMENT, version: env.VERSION }, { status: issues.length === 0 ? 200 : 503 });
    }

    const match = FORM_PATH.exec(url.pathname);
    if (!match) return text(404, "Not Found");
    const formId = match[1] ?? "";
    const form = Object.hasOwn(forms, formId) ? forms[formId] : undefined;
    if (!form) return text(404, "Not Found");
    if (request.method !== "POST") return text(405, "Method Not Allowed", { allow: "POST" });

    return await submit(request, env, form, formId, forms, log.with({ form: formId, site: form.site }), options);
  } finally {
    if (azureLogsEnabled(env)) ctx.waitUntil(shipToAzure(env, log.entries));
  }
}

async function submit(request: Request, env: Env, form: FormConfig, formId: string, forms: Record<string, FormConfig>, baseLog: Logger, options: HandlerOptions): Promise<Response> {
  const receivedAt = new Date();
  const { config, issues } = runtimeConfig(env, forms);

  // 1. The origin: one of this form's site's origins in this environment.
  const origins = config.sites[form.site] ?? [];
  const origin = request.headers.get("origin");
  if (!origin || !origins.includes(origin)) {
    baseLog.warn("submission.rejected", { reason: "origin" });
    return text(403, "Forbidden");
  }
  const back = (path: string) => new Response(null, { status: 303, headers: { location: new URL(path, origin).toString(), "cache-control": "no-store" } });
  const fail = (log: Logger, reason: string, fields: Record<string, unknown> = {}) => {
    log.warn("submission.rejected", { reason, ...fields });
    return back(form.errorPath);
  };

  if (issues.length > 0) {
    baseLog.error("config.invalid", { issues });
    return back(form.errorPath);
  }

  // 2. The body: a plain HTML form post, at most 32 KB.
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/x-www-form-urlencoded")) return fail(baseLog, "content_type");
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) return fail(baseLog, "too_large");
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) return fail(baseLog, "too_large");
  const data = new URLSearchParams(new TextDecoder().decode(bytes));
  const token = data.get("cf-turnstile-response") ?? "";

  // The submission ID comes from the Turnstile token: a double submit of the
  // same page gets the same ID, and the mail provider sends it once.
  const submissionId = await uuidFrom(token || crypto.randomUUID());
  const log = baseLog.with({ submissionId, country: (request.cf?.country as string | undefined) ?? undefined });
  log.info("submission.received");

  // 3. The honeypot: a filled one is a bot. It is told all went well.
  if (form.honeypot && (data.get(form.honeypot) ?? "") !== "") {
    log.warn("submission.rejected", { reason: "honeypot" });
    return back(form.successPath);
  }

  // 4. The rate limit, per form and visitor.
  const ip = request.headers.get("cf-connecting-ip") ?? undefined;
  if (env.RATE_LIMITER && ip) {
    const { success } = await env.RATE_LIMITER.limit({ key: `${formId}:${ip}` });
    if (!success) return fail(log, "rate_limit");
  }

  // 5. Turnstile.
  const turnstile = await verifyTurnstile({
    secret: named(env, turnstileSecretName(form.site)) ?? "",
    token,
    ip,
    idempotencyKey: submissionId,
    hostnames: origins.map((o) => new URL(o).hostname),
    action: form.turnstileAction,
  });
  if (!turnstile.ok) return fail(log, "turnstile", { code: turnstile.code });

  // 6. The fields.
  const checked = validate(form, data);
  if (!checked.ok) return fail(log, "validation", { errors: checked.errors });

  // 7. The actions, all at once.
  const outcome = await runActions(form.actions, { formId, form, values: checked.values, submissionId, receivedAt, config, env, log }, options.actionTimeoutMs);
  log.info("submission.completed", { outcome: outcome.ok ? "success" : "error", results: outcome.results, durationMs: Date.now() - receivedAt.getTime() });
  return back(outcome.ok ? form.successPath : form.errorPath);
}

function text(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", ...headers } });
}

/** A UUID (version 8 layout) from the SHA-256 of the input. */
async function uuidFrom(input: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))).slice(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
