/**
 * Every mail provider the Worker knows. Adding one is a file in providers/ and
 * a line here (docs/mail-providers.md).
 */
import { acs } from "./providers/acs";
import { logOnly } from "./providers/log-only";
import type { ProviderDefinition } from "./types";

export const providers: Record<string, ProviderDefinition> = {
  acs,
  "log-only": logOnly,
};
