/**
 * The mail a form sends, the same for every provider: a plain-text body and an
 * HTML table. Every value is escaped in the HTML; the subject and header
 * values lose line breaks so they cannot add headers.
 */
import type { FormConfig, Values } from "./types";
import { display } from "./validate";

export interface Rendered {
  subject: string;
  text: string;
  html: string;
}

const MAX_SUBJECT = 200;

export function render(form: FormConfig, values: Values, meta: { submissionId: string; receivedAt: Date }): Rendered {
  const rows = Object.entries(form.fields)
    .filter(([name]) => values[name] !== undefined)
    .map(([name, rule]) => ({ label: rule.label, value: display(rule, values[name]) }));
  const received = new Intl.DateTimeFormat("sl-SI", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Ljubljana" }).format(meta.receivedAt);
  const footer = `Prejeto ${received}. Oznaka povpraševanja: ${meta.submissionId}.`;
  const replyNote = form.replyToField && values[form.replyToField] ? "Za odgovor stranki kliknite Odgovori." : "Stranka ni pustila e-pošte; pokličite jo po telefonu.";

  const text = [form.title, "", ...rows.map((r) => `${r.label}:\n${r.value}\n`), replyNote, "", footer].join("\n");

  const html = `<!doctype html><html lang="sl"><body style="font-family:system-ui,sans-serif;color:#111">
<h1 style="font-size:18px">${escapeHtml(form.title)}</h1>
<table cellpadding="6" style="border-collapse:collapse">
${rows.map((r) => `<tr><th align="left" valign="top" style="border-bottom:1px solid #ddd">${escapeHtml(r.label)}</th><td style="border-bottom:1px solid #ddd;white-space:pre-wrap">${escapeHtml(r.value)}</td></tr>`).join("\n")}
</table>
<p>${escapeHtml(replyNote)}</p>
<p style="color:#555;font-size:12px">${escapeHtml(footer)}</p>
</body></html>`;

  return { subject: renderSubject(form, values), text, html };
}

export function renderSubject(form: FormConfig, values: Values): string {
  const subject = form.subject.replace(/\{(\w+)\}/g, (_, name: string) => display(form.fields[name], values[name]) || "—");
  return oneLine(subject).slice(0, MAX_SUBJECT);
}

export function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, " ").trim();
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
