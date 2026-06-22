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
    test("error field renders only the message inline", () => {
        const logger = new Logger();
        const err = new Error("connection refused");
        logger.error("upload failed", { error: err });
        assert.match(errorCalls[0].split("\n")[0], /error="connection refused"$/);
    });

    test("error message with no whitespace is unquoted inline", () => {
        const logger = new Logger();
        const err = new Error("timeout");
        logger.error("upload failed", { error: err });
        assert.match(errorCalls[0].split("\n")[0], /error=timeout$/);
    });

    test("stack trace is appended as indented lines below the main line", () => {
        const logger = new Logger();
        const err = new Error("boom");
        logger.error("failed", { error: err });

        const lines = errorCalls[0].split("\n");
        assert.ok(lines.length > 1, "expected stack lines to be appended");
        for (const frame of lines.slice(1)) {
            assert.match(frame, /^ {4}at /);
        }
    });

    test("stack trace's leading 'Error: message' line is stripped", () => {
        const logger = new Logger();
        const err = new Error("boom");
        logger.error("failed", { error: err });

        const lines = errorCalls[0].split("\n");
        for (const frame of lines.slice(1)) {
            assert.doesNotMatch(frame, /^ {4}Error: boom$/);
        }
    });

    test("multiple errors each contribute their own stack block", () => {
        const logger = new Logger();
        const errA = new Error("first");
        const errB = new Error("second");
        logger.error("failed", { errA, errB });

        const lines = errorCalls[0].split("\n");
        const stackLines = lines.slice(1);
        assert.ok(stackLines.length >= 2, "expected frames from both errors");
    });

    test("error without a stack only renders the inline message", () => {
        const logger = new Logger();
        const err = new Error("no stack");
        delete (err as { stack?: string }).stack;
        logger.error("failed", { error: err });

        assert.equal(errorCalls[0].split("\n").length, 1);
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
