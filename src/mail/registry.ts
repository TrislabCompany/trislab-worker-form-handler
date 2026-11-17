/**
 * Every mail provider the Worker knows. Adding one is a file in providers/ and
 * a line here (docs/mail-providers.md).
 */
import { logOnly } from "./providers/log-only";
import { resend } from "./providers/resend";
import type { ProviderDefinition } from "./types";

export const providers: Record<string, ProviderDefinition> = {
  resend,
  "log-only": logOnly,
};
