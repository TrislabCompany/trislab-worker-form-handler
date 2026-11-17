/**
 * Ships a request's log events to Azure Log Analytics through the Logs
 * Ingestion API (docs/logging.md, option B): table FormHandler_CL on
 * log-platform, stream Custom-FormHandler. Runs after the response in
 * `waitUntil`, never blocks the visitor, and is off until every AZURE_* value
 * is set. A failure is logged to Workers Logs only.
 */
import type { Env } from "./env";
import type { LogEntry } from "./log";

const STREAM = "Custom-FormHandler";
const API_VERSION = "2023-01-01";
const TIMEOUT_MS = 5000;

let token: { value: string; expires: number } | undefined;

export function azureLogsEnabled(env: Env): boolean {
  return Boolean(env.AZURE_TENANT_ID && env.AZURE_LOGS_CLIENT_ID && env.AZURE_LOGS_CLIENT_SECRET && env.AZURE_LOGS_DCE && env.AZURE_LOGS_DCR_ID);
}

export async function shipToAzure(env: Env, entries: LogEntry[]): Promise<void> {
  if (!azureLogsEnabled(env) || entries.length === 0) return;
  try {
    const bearer = await accessToken(env);
    const url = `${env.AZURE_LOGS_DCE}/dataCollectionRules/${env.AZURE_LOGS_DCR_ID}/streams/${STREAM}?api-version=${API_VERSION}`;
    const rows = entries.map(({ ts, ...rest }) => ({ TimeGenerated: ts, ...rest }));
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`ingestion_http_${response.status}`);
  } catch (error) {
    // Not through Logger: this event must not be shipped again.
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({ ts: new Date().toISOString(), level: "warn", service: "form-handler", event: "log.ship_failed", code: error instanceof Error ? error.message : "unknown" }));
  }
}

async function accessToken(env: Env): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const body = new URLSearchParams({
    client_id: env.AZURE_LOGS_CLIENT_ID ?? "",
    client_secret: env.AZURE_LOGS_CLIENT_SECRET ?? "",
    scope: "https://monitor.azure.com//.default",
    grant_type: "client_credentials",
  });
  const response = await fetch(`https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`token_http_${response.status}`);
  const result = await response.json<{ access_token: string; expires_in: number }>();
  token = { value: result.access_token, expires: Date.now() + result.expires_in * 1000 };
  return token.value;
}

/** For tests: forget the cached token. */
export function resetAzureToken(): void {
  token = undefined;
}
