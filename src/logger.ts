type LogLevel = "debug" | "info" | "warn" | "error";

type LogValue = string | number | boolean | null | undefined | Error | object;

type LogFields = Record<string, LogValue>;

interface LoggerOptions {
    level?: LogLevel;
    fields?: LogFields;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

export class Logger {
    private readonly level: LogLevel;
    private readonly fields: LogFields;

    constructor(options: LoggerOptions = {}) {
        this.level = options.level ?? "info";
        this.fields = options.fields ?? {};
    }

    with(fields: LogFields = {}): Logger {
        return new Logger({
            level: this.level,
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

        const fieldsText = this.formatFields(fields);

        let line = fieldsText
            ? `${timestamp} ${levelText} ${message} ${fieldsText}`
            : `${timestamp} ${levelText} ${message}`;

        const stackBlocks = this.collectStackBlocks(fields);
        if (stackBlocks.length > 0) {
            line += `\n${stackBlocks.join("\n")}`;
        }

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

    private collectStackBlocks(fields: LogFields): string[] {
        const blocks: string[] = [];

        for (const value of Object.values(fields)) {
            if (!(value instanceof Error) || !value.stack) {
                continue;
            }

            const frames = value.stack
                .split("\n")
                .slice(1)
                .map((frame) => `    ${frame.trim()}`);

            if (frames.length > 0) {
                blocks.push(frames.join("\n"));
            }
        }

        return blocks;
    }

    private formatFields(fields: LogFields): string {
        return Object.entries(fields)
            .map(([key, value]) => `${key}=${this.formatValue(value)}`)
            .join(" ");
    }

    private formatValue(value: LogValue): string {
        if (value instanceof Error) {
            return this.quoteIfNeeded(value.message);
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

export type { LogLevel, LogValue, LogFields, LoggerOptions };
