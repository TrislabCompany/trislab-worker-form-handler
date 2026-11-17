/** The `email` action: the form's mail to its recipients, through its account. */
import { sendMail } from "../mail/send";
import { oneLine, render } from "../render";
import type { ActionConfig } from "../types";
import type { Action, ActionContext, ActionResult } from "./types";

export function emailAction(config: Extract<ActionConfig, { type: "email" }>): Action {
  return {
    async run(ctx: ActionContext): Promise<ActionResult> {
      const to = ctx.config.recipients[ctx.formId] ?? [];
      if (to.length === 0) return { ok: false, action: "email", retryable: false, code: "no_recipients" };

      const { subject, text, html } = render(ctx.form, ctx.values, ctx);
      const replyTo = ctx.form.replyToField ? ctx.values[ctx.form.replyToField] : undefined;
      const result = await sendMail(
        {
          from: { email: ctx.form.from.email, name: oneLine(ctx.form.from.name) },
          to,
          replyTo: typeof replyTo === "string" ? oneLine(replyTo) : undefined,
          subject,
          text,
          html,
          idempotencyKey: ctx.submissionId,
          firstSentAt: ctx.receivedAt,
        },
        { account: config.account, fallback: config.fallback },
        ctx.config,
        ctx.env,
        ctx.log,
      );
      return result.ok
        ? { ok: true, action: "email", ref: result.messageId }
        : { ok: false, action: "email", retryable: result.retryable, code: result.code, status: result.status };
    },
  };
}
