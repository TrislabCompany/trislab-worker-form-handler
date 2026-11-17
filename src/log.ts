/**
 * Structured logging (docs/logging.md): one JSON object per line, which
 * Workers Logs parses into fields. Every event of a request shares the base
 * fields (service, env, version, requestId, submissionId, form, site), and the
 * logger keeps the events so they can also be shipped to Azure Log Analytics.
 *
 * Never log field values, names, e-mail addresses, phone numbers, IP
 * addresses or the Turnstile token. This is the only file that uses `console`.
 */
export type Level = "info" | "warn" | "error";
export type Fields = Record<string, unknown>;
export type LogEntry = Fields & { ts: string; level: Level; event: string };

export class Logger {
  private constructor(
    private readonly base: Fields,
    readonly entries: LogEntry[],
  ) {}

  static create(base: Fields): Logger {
    return new Logger(base, []);
  }

  /** A logger with more base fields that shares this logger's entries. */
  with(fields: Fields): Logger {
    return new Logger({ ...this.base, ...fields }, this.entries);
  }

  info(event: string, fields: Fields = {}): void {
    this.write("info", event, fields);
  }

  warn(event: string, fields: Fields = {}): void {
    this.write("warn", event, fields);
  }

  error(event: string, fields: Fields = {}): void {
    this.write("error", event, fields);
  }

  private write(level: Level, event: string, fields: Fields): void {
    const entry: LogEntry = { ts: new Date().toISOString(), level, ...this.base, event, ...fields };
    this.entries.push(entry);
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }
}
