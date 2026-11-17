import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { forms } from "../src/forms";
import type { FormConfig } from "../src/types";
import { ACS_ACCOUNTS, testEnv } from "./helpers";

const fasada = forms["fasadanakljuc-povprasevanje"]!;
const one = (form: Partial<FormConfig>) => ({ "fasadanakljuc-povprasevanje": { ...fasada, ...form } });

describe("the config check", () => {
  it("passes for the local setup with its secrets", () => {
    expect(loadConfig(testEnv(), forms, "runtime").issues).toEqual([]);
  });

  it("finds a sender outside the account's domains", () => {
    const { issues } = loadConfig(testEnv(), one({ from: { email: "info@trislab.com", name: "x" } }), "static");
    expect(issues).toContain("form fasadanakljuc-povprasevanje: sender domain trislab.com is not in trislab.fromDomains");
  });

  it("finds an unknown account and an unknown provider", () => {
    const env = testEnv({ MAIL_ACCOUNTS: JSON.stringify({ trislab: { provider: "carrier-pigeon", fromDomains: ["forms.trislab.com"] } }) });
    const { issues } = loadConfig(env, one({ actions: [{ type: "email", account: "other", required: true }] }), "static");
    expect(issues).toContain('MAIL_ACCOUNTS.trislab: unknown provider "carrier-pigeon"');
    expect(issues).toContain('form fasadanakljuc-povprasevanje: unknown mail account "other"');
  });

  it("refuses the http action until it is built", () => {
    const { issues } = loadConfig(testEnv(), one({ actions: [{ type: "http", target: "crm", operation: "createOffer", required: false }] }), "static");
    expect(issues).toContain("form fasadanakljuc-povprasevanje: the http action is not built yet");
  });

  it("finds missing secrets and recipients at runtime only", () => {
    const env = testEnv({ MAIL_ACCOUNTS: ACS_ACCOUNTS, MAIL_KEY_TRISLAB: undefined, TURNSTILE_SECRET_ASTRAGROUP_WEBSITE_FASADANAKLJUC: undefined, RECIPIENTS: JSON.stringify({}) });
    expect(loadConfig(env, forms, "static").issues).toEqual([]);
    const { issues } = loadConfig(env, forms, "runtime");
    expect(issues).toContain("MAIL_ACCOUNTS.trislab: MAIL_KEY_TRISLAB is not set");
    expect(issues).toContain("TURNSTILE_SECRET_ASTRAGROUP_WEBSITE_FASADANAKLJUC is not set");
    expect(issues).toContain("RECIPIENTS: no recipients for form fasadanakljuc-povprasevanje");
  });

  it("refuses log-only, test secrets and plain http in production", () => {
    const env = testEnv({ ENVIRONMENT: "production" });
    const { issues } = loadConfig(env, forms, "runtime");
    expect(issues).toContain('MAIL_ACCOUNTS.trislab: provider "log-only" is not allowed in production');
    expect(issues).toContain("TURNSTILE_SECRET_ASTRAGROUP_WEBSITE_FASADANAKLJUC is a Turnstile test secret");
    expect(issues).toContain('SITES.astragroup-website-fasadanakljuc: "http://localhost:4321" must use https');
  });

  it("refuses a recipient that is not an address", () => {
    const env = testEnv({ RECIPIENTS: JSON.stringify({ "fasadanakljuc-povprasevanje": ["not-an-address"], "strehanakljuc-povprasevanje": ["a@example.com"] }) });
    expect(loadConfig(env, forms, "runtime").issues).toEqual(["RECIPIENTS.fasadanakljuc-povprasevanje: an entry is not an e-mail address"]);
  });
});
