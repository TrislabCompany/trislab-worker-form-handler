/** The action contract (docs/architecture.md, actions). */
import type { Config } from "../config";
import type { Env } from "../env";
import type { Logger } from "../log";
import type { ActionConfig, FormConfig, Values } from "../types";

export interface ActionContext {
  formId: string;
  form: FormConfig;
  values: Values;
  /** A UUID per submission; every action uses it as its idempotency key. */
  submissionId: string;
  receivedAt: Date;
  config: Config;
  env: Env;
  log: Logger;
  /** Aborted when the action's time is up. */
  signal: AbortSignal;
}

export type ActionResult =
  | { ok: true; action: string; ref?: string }
  | { ok: false; action: string; retryable: boolean; code: string; status?: number };

export interface Action {
  /** Never throws: every error becomes an ActionResult. */
  run(ctx: ActionContext): Promise<ActionResult>;
}

export type ActionFactory = (config: ActionConfig) => Action;
