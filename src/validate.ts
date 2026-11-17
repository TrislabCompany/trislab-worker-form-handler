/**
 * Checks a submission against its form's fields (docs/architecture.md, step 6).
 * The browser checks the same rules first, so a failure here usually means a
 * bot or an altered page. The result names the fields and the rule, never the
 * values, so it can be logged.
 */
import type { FieldRule, FormConfig, Values } from "./types";

export interface FieldError {
  field: string;
  code: "required" | "too_long" | "not_a_choice" | "not_a_number" | "out_of_range" | "invalid_email" | "invalid_phone" | "consent" | "one_of" | "repeated";
}

export type ValidationResult = { ok: true; values: Values } | { ok: false; errors: FieldError[] };

// A practical check, not RFC 5322: one @, no spaces, a dot in the domain.
const EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;
// Digits with the usual separators; 6 to 20 digits.
const PHONE_CHARS = /^\+?[\d\s()./-]+$/;

export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value);
}

export function validate(form: FormConfig, data: URLSearchParams): ValidationResult {
  const errors: FieldError[] = [];
  const values: Values = {};

  for (const [name, rule] of Object.entries(form.fields)) {
    const all = data.getAll(name);
    if (all.length > 1) {
      errors.push({ field: name, code: "repeated" });
      continue;
    }
    const raw = normalise(all[0] ?? "", rule);
    if (raw === "") {
      if (rule.type === "consent") errors.push({ field: name, code: "consent" });
      else if (rule.required) errors.push({ field: name, code: "required" });
      continue;
    }
    const checked = check(rule, raw);
    if (typeof checked === "object") errors.push({ field: name, code: checked.code });
    else values[name] = checked;
  }

  for (const group of form.oneOf ?? []) {
    if (!group.some((name) => name in values) && !errors.some((e) => group.includes(e.field))) {
      errors.push({ field: group.join("|"), code: "one_of" });
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, values };
}

function normalise(raw: string, rule: FieldRule): string {
  // Unify line breaks and drop control characters other than line breaks and tabs.
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
  const single = rule.type === "text" && rule.multiline ? cleaned : cleaned.replace(/\s+/g, " ");
  return single.trim();
}

function check(rule: FieldRule, value: string): string | number | Pick<FieldError, "code"> {
  switch (rule.type) {
    case "text":
      return [...value].length <= rule.max ? value : { code: "too_long" };
    case "enum":
      return Object.hasOwn(rule.values, value) ? value : { code: "not_a_choice" };
    case "int": {
      if (!/^\d{1,9}$/.test(value)) return { code: "not_a_number" };
      const n = Number(value);
      return n >= rule.min && n <= rule.max ? n : { code: "out_of_range" };
    }
    case "email":
      return isEmail(value) ? value : { code: "invalid_email" };
    case "phone": {
      const digits = value.replace(/\D/g, "").length;
      return PHONE_CHARS.test(value) && digits >= 6 && digits <= 20 ? value : { code: "invalid_phone" };
    }
    case "consent":
      return value === rule.value ? value : { code: "consent" };
  }
}

/** The value as the e-mail shows it: the label of a choice, the value otherwise. */
export function display(rule: FieldRule | undefined, value: string | number | undefined): string {
  if (value === undefined) return "";
  if (rule?.type === "enum") return rule.values[String(value)] ?? String(value);
  if (rule?.type === "consent") return "Da";
  return String(value);
}
