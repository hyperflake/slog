type LogLevel = "debug" | "info" | "warn" | "error";

type LogFormat = "logfmt" | "json";

type LogValue = string | number | boolean | null | undefined | Error | object;

type LogFields = Record<string, LogValue>;

interface LoggerOptions {
    level?: LogLevel;
    format?: LogFormat;
    fields?: LogFields;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

let globalDefaults: { level?: LogLevel; format?: LogFormat } = {};

export class Logger {
    private readonly explicitLevel?: LogLevel;
    private readonly explicitFormat?: LogFormat;
    private readonly fields: LogFields;

    constructor(options: LoggerOptions = {}) {
        this.explicitLevel = options.level;
        this.explicitFormat = options.format;
        this.fields = options.fields ?? {};
    }

    static setDefaults(defaults: { level?: LogLevel; format?: LogFormat }): void {
        globalDefaults = { ...globalDefaults, ...defaults };
    }

    private get level(): LogLevel {
        return this.explicitLevel ?? globalDefaults.level ?? "info";
    }

    private get format(): LogFormat {
        return this.explicitFormat ?? globalDefaults.format ?? "logfmt";
    }

    with(fields: LogFields = {}): Logger {
        return new Logger({
            level: this.explicitLevel,
            format: this.explicitFormat,
            fields: {
                ...this.fields,
                ...fields,
            },
        });
    }

    debug(message: string, fields?: LogFields) {
        this.log("debug", message, fields);
    }

    info(message: string, fields?: LogFields) {
        this.log("info", message, fields);
    }

    warn(message: string, fields?: LogFields) {
        this.log("warn", message, fields);
    }

    error(message: string, fields?: LogFields) {
        this.log("error", message, fields);
    }

    private log(level: LogLevel, message: string, callFields: LogFields = {}) {
        if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.level]) {
            return;
        }

        const timestamp = this.formatDate(new Date());
        const levelText = level.toUpperCase();

        const fields = {
            ...this.fields,
            ...callFields,
        };

        const line =
            this.format === "json"
                ? this.formatJsonLine(timestamp, levelText, message, fields)
                : this.formatLogfmtLine(timestamp, levelText, message, fields);

        if (level === "error") {
            console.error(line);
            return;
        }

        if (level === "warn") {
            console.warn(line);
            return;
        }

        console.log(line);
    }

    private formatLogfmtLine(timestamp: string, levelText: string, message: string, fields: LogFields): string {
        const fieldsText = this.formatFields(fields);

        return fieldsText ? `${timestamp} ${levelText} ${message} ${fieldsText}` : `${timestamp} ${levelText} ${message}`;
    }

    private formatJsonLine(timestamp: string, levelText: string, message: string, fields: LogFields): string {
        const record: Record<string, unknown> = {
            time: timestamp,
            level: levelText,
            msg: message,
        };

        for (const [key, value] of Object.entries(fields)) {
            record[key] = this.toJsonValue(value);
        }

        return JSON.stringify(record);
    }

    private toJsonValue(value: LogValue): unknown {
        if (value instanceof Error) {
            return {
                message: value.message,
                ...(value.stack ? { stack: value.stack } : {}),
            };
        }

        return value;
    }

    private formatFields(fields: LogFields): string {
        return Object.entries(fields)
            .map(([key, value]) => `${key}=${this.formatValue(value)}`)
            .join(" ");
    }

    private formatValue(value: LogValue): string {
        if (value instanceof Error) {
            return this.quoteIfNeeded(this.formatError(value));
        }

        if (typeof value === "string") {
            return this.quoteIfNeeded(value);
        }

        if (typeof value === "number" || typeof value === "boolean") {
            return String(value);
        }

        if (value === null) {
            return "null";
        }

        if (value === undefined) {
            return "undefined";
        }

        return this.quoteIfNeeded(JSON.stringify(value));
    }

    private formatError(error: Error): string {
        if (!error.stack) {
            return error.message;
        }

        const frames = error.stack
            .split("\n")
            .slice(1)
            .map((frame) => frame.trim());

        if (frames.length === 0) {
            return error.message;
        }

        return [error.message, ...frames].join("\n");
    }

    private quoteIfNeeded(value: string): string {
        if (value === "") {
            return `""`;
        }

        if (/\s/.test(value)) {
            return JSON.stringify(value);
        }

        return value;
    }

    private formatDate(date: Date): string {
        const pad = (value: number) => String(value).padStart(2, "0");

        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());

        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());

        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    }
}

export const logger = new Logger();

export type { LogLevel, LogFormat, LogValue, LogFields, LoggerOptions };
