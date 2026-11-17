/**
 * The form registry (docs/adding-a-form.md): every form this Worker accepts,
 * keyed by the ID in its address `POST /f/<form-id>`.
 *
 * Public and in git: no recipients, no secrets, no personal data. Recipients
 * are the `RECIPIENTS` secret and the allowed origins are the `SITES` var, both
 * per environment (docs/configuration.md).
 */
import type { FormConfig } from "./types";

/** Choices of a select or radio group: the posted value → the label in the e-mail. */
type Choices = Record<string, string>;

const fasadaKind: Choices = {
  prenova: "Prenova fasade obstoječe hiše",
  "nova-fasada": "Fasada na novi hiši",
  "ne-vem": "Še ne vem",
};
const fasadaHouseTypes: Choices = {
  enostanovanjska: "Enostanovanjska hiša",
  dvostanovanjska: "Dvostanovanjska hiša",
  vrstna: "Vrstna ali dvojna hiša",
  drugo: "Drugo",
};
const fasadaAges: Choices = {
  "pred-1980": "Pred letom 1980",
  "1980-2010": "Od 1980 do sredine 2010",
  "po-2010": "Po sredini 2010",
  "v-gradnji": "Še se gradi",
  "ne-vem": "Ne vem",
};
const fasadaWorks: Choices = {
  izolacija: "Toplotna izolacija in nov omet",
  "omet-barva": "Samo popravilo ometa in barva",
  prezracevana: "Prezračevana fasada",
  "ne-vem": "Še ne vem",
};
const fasadaTimeframes: Choices = {
  "3-mesece": "V treh mesecih",
  letos: "Letos",
  "naslednje-leto": "Naslednje leto",
  "ne-vem": "Še ne vem",
};
const yesNoUnsure: Choices = { da: "Da", ne: "Ne", "ne-vem": "Še ne vem" };

const strehaWorks: Choices = {
  prenova: "Prenova strehe",
  "nova-streha": "Nova streha na ključ",
  "ravna-streha": "Ravna streha ali terasa",
  popravilo: "Popravilo strehe",
};
const strehaShapes: Choices = {
  dvokapnica: "Dvokapnica",
  stirikapnica: "Štirikapnica",
  enokapnica: "Enokapnica",
  ravna: "Ravna streha ali terasa",
  drugo: "Drugo ali ne vem",
};
const strehaCoverings: Choices = {
  opecna: "Opečna",
  betonska: "Betonska",
  plocevina: "Pločevina",
  salonit: "Salonitne plošče",
  membrana: "Membrana ali bitumen",
  brez: "Še ni strehe (novogradnja)",
  "ne-vem": "Ne vem",
};
const strehaContact: Choices = { telefon: "Po telefonu", "e-posta": "Po e-pošti" };

export const forms: Record<string, FormConfig> = {
  // astragroup-website-fasadanakljuc, src/components/QuoteForm.astro
  "fasadanakljuc-povprasevanje": {
    site: "astragroup-website-fasadanakljuc",
    title: "Povpraševanje s strani fasadanakljuc.si",
    turnstileAction: "povprasevanje",
    from: { email: "obrazec@forms.trislab.com", name: "Fasada na ključ" },
    subject: "Novo povpraševanje – {vrsta_del}, {obcina}",
    fields: {
      primer: { type: "enum", label: "Kaj potrebuje", values: fasadaKind, required: true },
      vrsta_hise: { type: "enum", label: "Vrsta hiše", values: fasadaHouseTypes, required: true },
      starost_hise: { type: "enum", label: "Kdaj je bila hiša zgrajena", values: fasadaAges, required: true },
      povrsina: { type: "int", label: "Površina fasade (m²)", min: 1, max: 10000 },
      obcina: { type: "text", label: "Občina", max: 100, required: true },
      vrsta_del: { type: "enum", label: "Vrsta del", values: fasadaWorks, required: true },
      rok: { type: "enum", label: "Želeni rok", values: fasadaTimeframes, required: true },
      subvencija: { type: "enum", label: "Subvencija Eko sklada", values: yesNoUnsure, required: true },
      sporocilo: { type: "text", label: "Sporočilo", max: 2000, multiline: true },
      ime: { type: "text", label: "Ime in priimek", max: 200, required: true },
      telefon: { type: "phone", label: "Telefon" },
      eposta: { type: "email", label: "E-pošta" },
      soglasje: { type: "consent", label: "Soglasje k obdelavi podatkov", value: "da" },
    },
    oneOf: [["telefon", "eposta"]],
    replyToField: "eposta",
    successPath: "/povprasevanje/hvala",
    errorPath: "/povprasevanje/napaka",
    actions: [{ type: "email", account: "trislab", required: true }],
  },

  // astragroup-website-strehanakljuc, src/components/QuoteForm.astro
  "strehanakljuc-povprasevanje": {
    site: "astragroup-website-strehanakljuc",
    title: "Povpraševanje s strani strehanakljuc.si",
    turnstileAction: "povprasevanje",
    from: { email: "obrazec@forms.trislab.com", name: "Streha na ključ" },
    subject: "Novo povpraševanje – {vrsta_del}, {obcina}",
    fields: {
      vrsta_del: { type: "enum", label: "Kaj potrebuje", values: strehaWorks, required: true },
      obcina: { type: "text", label: "Občina", max: 100, required: true },
      povrsina: { type: "int", label: "Površina strehe (m²)", min: 1, max: 10000 },
      oblika_strehe: { type: "enum", label: "Oblika strehe", values: strehaShapes, required: true },
      sedanja_kritina: { type: "enum", label: "Sedanja kritina", values: strehaCoverings, required: true },
      sporocilo: { type: "text", label: "Sporočilo", max: 2000, multiline: true },
      ime: { type: "text", label: "Ime in priimek", max: 200, required: true },
      telefon: { type: "phone", label: "Telefon" },
      eposta: { type: "email", label: "E-pošta" },
      nacin_stika: { type: "enum", label: "Želeni način stika", values: strehaContact, required: true },
      soglasje: { type: "consent", label: "Soglasje k obdelavi podatkov", value: "da" },
    },
    oneOf: [["telefon", "eposta"]],
    replyToField: "eposta",
    successPath: "/povprasevanje/hvala",
    errorPath: "/povprasevanje/napaka",
    actions: [{ type: "email", account: "trislab", required: true }],
  },
};
