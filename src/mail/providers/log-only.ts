/**
 * Sends nothing: logs that a mail would have been sent. For `pnpm dev` and the
 * tests. Locally it also logs the whole mail so it can be read in the terminal;
 * anywhere else only counts, because the mail holds personal data. Refused in
 * production by the config check.
 */
import type { ProviderDefinition } from "../types";

export const logOnly: ProviderDefinition = {
  production: false,
  needs: () => [],
  create(_account, env, log) {
    return {
      name: "log-only",
      async send(mail) {
        const messageId = `log-only-${mail.idempotencyKey}`;
        if (env.ENVIRONMENT === "local") {
          log.info("mail.logged", { messageId, mail: { ...mail, html: undefined } });
        } else {
          log.info("mail.logged", { messageId, recipients: mail.to.length });
        }
        return { ok: true, provider: "log-only", messageId };
      },
    };
  },
};
