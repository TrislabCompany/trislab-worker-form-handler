import { describe, expect, it } from "vitest";
import { forms } from "../src/forms";
import { escapeHtml, render, renderSubject } from "../src/render";
import { validate } from "../src/validate";
import { validFasada } from "./helpers";

const fasada = forms["fasadanakljuc-povprasevanje"]!;
const streha = forms["strehanakljuc-povprasevanje"]!;
const params = (fields: Record<string, string>) => new URLSearchParams(fields);

describe("validate", () => {
  it("accepts the fasadanakljuc form and types its values", () => {
    const result = validate(fasada, params(validFasada));
    expect(result).toMatchObject({ ok: true, values: { povrsina: 120, ime: "Janez Novak", soglasje: "da" } });
  });

  it("accepts the strehanakljuc form with only a phone", () => {
    const result = validate(
      streha,
      params({ vrsta_del: "popravilo", obcina: "Koper", oblika_strehe: "dvokapnica", sedanja_kritina: "salonit", ime: "Ana", telefon: "+386 41 123 456", nacin_stika: "telefon", soglasje: "da" }),
    );
    expect(result.ok).toBe(true);
  });

  it("leaves out empty optional fields", () => {
    const result = validate(fasada, params({ ...validFasada, povrsina: "", sporocilo: "  " }));
    expect(result.ok && "povrsina" in result.values).toBe(false);
    expect(result.ok && "sporocilo" in result.values).toBe(false);
  });

  it("collapses whitespace in single-line fields and keeps lines in the message", () => {
    const result = validate(fasada, params({ ...validFasada, ime: "  Janez \n Novak ", sporocilo: "ena\r\ndva" }));
    expect(result).toMatchObject({ ok: true, values: { ime: "Janez Novak", sporocilo: "ena\ndva" } });
  });

  it("names every failing field and rule, without values", () => {
    const result = validate(fasada, params({ ...validFasada, ime: "", povrsina: "abc", telefon: "12", eposta: "" }));
    expect(result).toEqual({
      ok: false,
      errors: [
        { field: "povrsina", code: "not_a_number" },
        { field: "ime", code: "required" },
        { field: "telefon", code: "invalid_phone" },
      ],
    });
  });

  it("refuses a field sent twice", () => {
    const data = params(validFasada);
    data.append("ime", "Drugi");
    expect(validate(fasada, data)).toMatchObject({ ok: false, errors: [{ field: "ime", code: "repeated" }] });
  });

  it("refuses text over its limit, counted in characters", () => {
    expect(validate(fasada, params({ ...validFasada, sporocilo: "č".repeat(2000) })).ok).toBe(true);
    expect(validate(fasada, params({ ...validFasada, sporocilo: "č".repeat(2001) })).ok).toBe(false);
  });
});

describe("render", () => {
  const values = { ...(validate(fasada, params(validFasada)) as { values: Record<string, string | number> }).values };
  const meta = { submissionId: "id-1", receivedAt: new Date("2026-11-17T10:00:00Z") };

  it("shows choice labels and escapes HTML", () => {
    const mail = render(fasada, { ...values, sporocilo: "<script>alert(1)</script>" }, meta);
    expect(mail.text).toContain("Vrsta hiše:\nEnostanovanjska hiša");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).not.toContain("<script>");
    expect(mail.text).toContain("id-1");
  });

  it("keeps the subject on one line", () => {
    expect(renderSubject(fasada, { ...values, obcina: "Ljubljana\r\nBcc: x@example.com" })).not.toMatch(/[\r\n]/);
  });

  it("escapes every special character", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
