/**
 * Runs a form's actions at the same time (docs/architecture.md, actions): the
 * visitor waits for the slowest action, not the sum. The submission succeeds
 * when every `required` action succeeded; a failed optional action is logged
 * as an error so it raises an alert.
 */
import type { ActionConfig } from "../types";
import { emailAction } from "./email";
import type { Action, ActionContext, ActionResult } from "./types";

export const DEFAULT_TIMEOUT_MS = 8000;

function create(config: ActionConfig): Action | undefined {
  switch (config.type) {
    case "email":
      return emailAction(config);
    case "http":
      // Phase 6. The config check refuses a form that uses it.
      return undefined;
  }
}

function label(config: ActionConfig): string {
  return config.type === "http" ? `http:${config.target}.${config.operation}` : "email";
}

export interface RunOutcome {
  ok: boolean;
  results: { action: string; required: boolean; ok: boolean; code?: string; ref?: string }[];
}

export async function runActions(actions: ActionConfig[], ctx: Omit<ActionContext, "signal">, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<RunOutcome> {
  const results = await Promise.all(
    actions.map(async (config) => {
      const name = label(config);
      const started = Date.now();
      const result = await runOne(config, ctx, timeoutMs);
      const fields = { action: name, required: config.required, durationMs: Date.now() - started };
      if (result.ok) ctx.log.info("action.succeeded", { ...fields, ref: result.ref });
      else ctx.log.error("action.failed", { ...fields, code: result.code, status: result.status });
      return { action: name, required: config.required, ok: result.ok, code: result.ok ? undefined : result.code, ref: result.ok ? result.ref : undefined };
    }),
  );
  return { ok: results.every((r) => r.ok || !r.required), results };
}

async function runOne(config: ActionConfig, ctx: Omit<ActionContext, "signal">, timeoutMs: number): Promise<ActionResult> {
  const action = create(config);
  const name = label(config);
  if (!action) return { ok: false, action: name, retryable: false, code: "not_built" };

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ActionResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, action: name, retryable: false, code: "timeout" });
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      action.run({ ...ctx, signal: controller.signal }).catch((): ActionResult => ({ ok: false, action: name, retryable: false, code: "threw" })),
      timeout,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
