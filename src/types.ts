/** Types shared by the registry, the validator and the actions. */

interface BaseField {
  /** The field's name in the e-mail. */
  label: string;
  required?: boolean;
}

export type FieldRule =
  | (BaseField & { type: "text"; max: number; multiline?: boolean })
  | (BaseField & { type: "enum"; values: Record<string, string> })
  | (BaseField & { type: "int"; min: number; max: number })
  | (BaseField & { type: "email" })
  | (BaseField & { type: "phone" })
  /** A checkbox that must be ticked with exactly this value. Always required. */
  | (Omit<BaseField, "required"> & { type: "consent"; value: string });

export type ActionConfig =
  | {
      type: "email";
      /** An account in MAIL_ACCOUNTS (src/mail/accounts.ts). */
      account: string;
      /** Another account, tried once when the first fails after its retry. */
      fallback?: string;
      required: boolean;
    }
  | {
      /** A call to an external system (docs/architecture.md, phase 6). Not built yet. */
      type: "http";
      target: string;
      operation: string;
      required: boolean;
    };

export interface FormConfig {
  /** The site's repository, a key of the SITES var. */
  site: string;
  /** The first line of the e-mail. */
  title: string;
  /** Must equal the `action` the page gives the Turnstile widget. */
  turnstileAction: string;
  /** The sender. Its domain must be in the account's `fromDomains`. */
  from: { email: string; name: string };
  /** The subject; `{field}` is replaced by the field's value or choice label. */
  subject: string;
  fields: Record<string, FieldRule>;
  /** Groups of fields of which at least one must be filled, such as phone or e-mail. */
  oneOf?: string[][];
  /** A hidden field that people leave empty; a filled one marks a bot. */
  honeypot?: string;
  /** The e-mail field whose value becomes the mail's Reply-To. */
  replyToField?: string;
  /** Paths on the posting origin the visitor is sent to. */
  successPath: string;
  errorPath: string;
  /** What a valid submission does, all at once (src/actions/run.ts). */
  actions: ActionConfig[];
}

/** Validated values: text and choices as strings, numbers as numbers; empty optional fields are absent. */
export type Values = Record<string, string | number>;
