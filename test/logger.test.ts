import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Logger } from "../src/logger.js";

const TIMESTAMP = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/;

let logCalls: string[];
let warnCalls: string[];
let errorCalls: string[];

let originalLog: typeof console.log;
let originalWarn: typeof console.warn;
let originalError: typeof console.error;

beforeEach(() => {
    logCalls = [];
    warnCalls = [];
    errorCalls = [];

    originalLog = console.log;
    originalWarn = console.warn;
    originalError = console.error;

    console.log = (line: string) => logCalls.push(line);
    console.warn = (line: string) => warnCalls.push(line);
    console.error = (line: string) => errorCalls.push(line);
});

afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
});

describe("level filtering", () => {
    test("default level is info: debug is suppressed", () => {
        const logger = new Logger();
        logger.debug("hidden");
        assert.equal(logCalls.length, 0);
    });

    test("default level is info: info/warn/error are emitted", () => {
        const logger = new Logger();
        logger.info("shown");
        logger.warn("shown");
        logger.error("shown");
        assert.equal(logCalls.length, 1);
        assert.equal(warnCalls.length, 1);
        assert.equal(errorCalls.length, 1);
    });

    test("custom level 'warn' suppresses info", () => {
        const logger = new Logger({ level: "warn" });
        logger.info("hidden");
        logger.warn("shown");
        assert.equal(logCalls.length, 0);
        assert.equal(warnCalls.length, 1);
    });

    test("custom level 'debug' allows debug", () => {
        const logger = new Logger({ level: "debug" });
        logger.debug("shown");
        assert.equal(logCalls.length, 1);
    });
});

describe("message formatting", () => {
    test("message without fields", () => {
        const logger = new Logger();
        logger.info("plain message");
        assert.equal(logCalls.length, 1);
        assert.match(logCalls[0], TIMESTAMP);
        assert.match(logCalls[0], /^\S+ \S+ INFO plain message$/);
    });

    test("level text is uppercased", () => {
        const logger = new Logger({ level: "debug" });
        logger.debug("msg");
        assert.match(logCalls[0], / DEBUG msg$/);
    });
});

describe("field value formatting", () => {
    test("string without whitespace is unquoted", () => {
        const logger = new Logger();
        logger.info("msg", { folder: "abc123" });
        assert.match(logCalls[0], /folder=abc123$/);
    });

    test("string with whitespace is JSON-quoted", () => {
        const logger = new Logger();
        logger.info("msg", { note: "hello world" });
        assert.match(logCalls[0], /note="hello world"$/);
    });

    test("empty string is rendered as empty quotes", () => {
        const logger = new Logger();
        logger.info("msg", { note: "" });
        assert.match(logCalls[0], /note=""$/);
    });

    test("numbers and booleans render as-is", () => {
        const logger = new Logger();
        logger.info("msg", { width: 1920, ok: true });
        assert.match(logCalls[0], /width=1920 ok=true$/);
    });

    test("null and undefined render as literal text", () => {
        const logger = new Logger();
        logger.info("msg", { a: null, b: undefined });
        assert.match(logCalls[0], /a=null b=undefined$/);
    });

    test("plain objects are JSON-stringified", () => {
        const logger = new Logger();
        logger.info("msg", { meta: { width: 10, height: 20 } });
        assert.match(logCalls[0], /meta={"width":10,"height":20}$/);
    });

    test("objects whose JSON contains whitespace get quoted", () => {
        const logger = new Logger();
        logger.info("msg", { meta: { note: "hi there" } });
        assert.match(logCalls[0], /meta="\{\\"note\\":\\"hi there\\"\}"$/);
    });

    test("multiple fields are joined in insertion order", () => {
        const logger = new Logger();
        logger.info("msg", { folder: 123, image: "abc.jpg" });
        assert.match(logCalls[0], /msg folder=123 image=abc\.jpg$/);
    });
});

describe("error formatting", () => {
    test("error field renders the message and escaped stack inline, on one line", () => {
        const logger = new Logger();
        const err = new Error("connection refused");
        logger.error("upload failed", { error: err });
        assert.equal(errorCalls[0].split("\n").length, 1);
        assert.match(errorCalls[0], /error="connection refused\\nat /);
    });

    test("error without a stack renders just the message, quoted only if needed", () => {
        const logger = new Logger();
        const err = new Error("timeout");
        delete (err as { stack?: string }).stack;
        logger.error("upload failed", { error: err });
        assert.match(errorCalls[0], /error=timeout$/);
    });

    test("stack trace is escaped into the error field, keeping the whole entry on one line", () => {
        const logger = new Logger();
        const err = new Error("boom");
        logger.error("failed", { error: err });

        assert.equal(errorCalls[0].split("\n").length, 1);
        assert.match(errorCalls[0], /error="boom\\nat /);
    });

    test("stack trace's leading 'Error: message' line is stripped before escaping", () => {
        const logger = new Logger();
        const err = new Error("boom");
        logger.error("failed", { error: err });

        assert.doesNotMatch(errorCalls[0], /\\nError: boom\\n/);
    });

    test("multiple errors each contribute their own escaped stack", () => {
        const logger = new Logger();
        const errA = new Error("first");
        const errB = new Error("second");
        logger.error("failed", { errA, errB });

        assert.equal(errorCalls[0].split("\n").length, 1);
        assert.match(errorCalls[0], /errA="first\\nat /);
        assert.match(errorCalls[0], /errB="second\\nat /);
    });

    test("error without a stack only renders the inline message", () => {
        const logger = new Logger();
        const err = new Error("no stack");
        delete (err as { stack?: string }).stack;
        logger.error("failed", { error: err });

        assert.equal(errorCalls[0].split("\n").length, 1);
    });
});

describe("json format", () => {
    afterEach(() => {
        Logger.setDefaults({ level: "info", format: "logfmt" });
    });

    test("emits one JSON object per line with time, level, msg, and fields flattened", () => {
        const logger = new Logger({ format: "json" });
        logger.info("image resized", { width: 1920, height: 1080 });

        const parsed = JSON.parse(logCalls[0]);
        assert.match(parsed.time, TIMESTAMP);
        assert.equal(parsed.level, "INFO");
        assert.equal(parsed.msg, "image resized");
        assert.equal(parsed.width, 1920);
        assert.equal(parsed.height, 1080);
    });

    test("error fields become a structured { message, stack } object", () => {
        const logger = new Logger({ format: "json" });
        const err = new Error("boom");
        logger.error("failed", { error: err });

        const parsed = JSON.parse(errorCalls[0]);
        assert.equal(parsed.error.message, "boom");
        assert.match(parsed.error.stack, /^Error: boom/);
    });

    test("Logger.setDefaults({ format: 'json' }) affects loggers with no explicit format", () => {
        Logger.setDefaults({ format: "json" });
        const logger = new Logger();
        logger.info("msg");

        const parsed = JSON.parse(logCalls[0]);
        assert.equal(parsed.msg, "msg");
    });

    test("an explicit per-instance format overrides the global default", () => {
        Logger.setDefaults({ format: "json" });
        const logger = new Logger({ format: "logfmt" });
        logger.info("msg");

        assert.match(logCalls[0], /^\S+ \S+ INFO msg$/);
    });

    test("with() children resolve format live against the global default", () => {
        const child = new Logger().with({ a: 1 });
        Logger.setDefaults({ format: "json" });
        child.info("msg");

        const parsed = JSON.parse(logCalls[0]);
        assert.equal(parsed.a, 1);
    });
});

describe("with() child loggers", () => {
    test("merges fields into every subsequent call", () => {
        const base = new Logger();
        const child = base.with({ requestId: "r1" });
        child.info("step one");
        child.info("step two", { extra: 1 });

        assert.match(logCalls[0], /requestId=r1$/);
        assert.match(logCalls[1], /requestId=r1 extra=1$/);
    });

    test("does not mutate the parent logger", () => {
        const base = new Logger();
        base.with({ requestId: "r1" });
        base.info("no fields here");

        assert.match(logCalls[0], /^\S+ \S+ INFO no fields here$/);
    });

    test("chained with() calls accumulate fields", () => {
        const logger = new Logger().with({ a: 1 }).with({ b: 2 });
        logger.info("msg");
        assert.match(logCalls[0], /a=1 b=2$/);
    });

    test("call-site fields override inherited fields with the same key", () => {
        const logger = new Logger().with({ folder: "old" });
        logger.info("msg", { folder: "new" });
        assert.match(logCalls[0], /folder=new$/);
    });

    test("inherits the level from the parent", () => {
        const logger = new Logger({ level: "warn" }).with({ a: 1 });
        logger.info("hidden");
        logger.warn("shown");
        assert.equal(logCalls.length, 0);
        assert.equal(warnCalls.length, 1);
    });
});
