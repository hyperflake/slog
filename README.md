# @hyperflake/slog

A lightweight, structured logger for Node.js that mimics the text output format of Go's `log`/`slog` packages. It prints a timestamp, level, message, and key/value fields on a single line, and renders the full stack trace beneath the line whenever an `Error` is logged.

## Features

- **slog-style output:** `2026/06/22 05:45:47 INFO image resized width=1920 height=1080`
- **JSON output:** switch a logger to emit one JSON object per line instead, e.g. for log pipelines that expect structured input.
- **Structured fields:** pass a plain object of key/value pairs alongside any log call.
- **Full error logging:** errors render their message and full stack trace on a single line (escaped in logfmt, structured in JSON) — one log line in, one in your shipper.
- **Child loggers:** attach persistent fields to a logger with `with()` without mutating the original.
- **Level filtering:** `debug`, `info`, `warn`, `error`, each gated by a configurable minimum level.

## Installation

Install the package using npm:

```bash
npm install @hyperflake/slog
```

## Usage

### Basic Setup

#### Use the Default Logger

```javascript
import { logger } from '@hyperflake/slog';

logger.info('image resized', { width: 1920, height: 1080 });
// 2026/06/22 05:45:47 INFO image resized width=1920 height=1080
```

#### Create a Custom Logger Instance

```javascript
import { Logger } from '@hyperflake/slog';

const log = new Logger({ level: 'debug' });

log.debug('cache miss', { key: 'user:42' });
```

#### Log an Error with its Stack Trace

```javascript
try {
    uploadImage();
} catch (err) {
    logger.error('upload failed', { folder: 123, image: 'abc.jpg', error: err });
}
```

```
2026/06/22 05:45:47 ERROR upload failed folder=123 image=abc.jpg error="connection refused\nat uploadImage (upload.ts:42:11)\nat processImage (worker.ts:88:5)"
```

The message and full stack trace are escaped onto that single line, so each error is still exactly one line in your log output (handy for log shippers, e.g. Docker's log driver, that read one line at a time).

#### Use JSON Output Instead of logfmt

```javascript
import { Logger } from '@hyperflake/slog';

const log = new Logger({ format: 'json' });

log.info('image resized', { width: 1920, height: 1080 });
// {"time":"2026/06/22 05:45:47","level":"INFO","msg":"image resized","width":1920,"height":1080}

log.error('upload failed', { error: err });
// {"time":"2026/06/22 05:45:47","level":"ERROR","msg":"upload failed","error":{"message":"connection refused","stack":"Error: connection refused\n    at uploadImage (upload.ts:42:11)..."}}
```

#### Set a Global Default Format or Level

```javascript
import { Logger, logger } from '@hyperflake/slog';

// Mirrors Go's slog.SetDefault: affects any Logger (including the
// exported `logger` singleton) that didn't explicitly set its own option.
Logger.setDefaults({ format: 'json', level: 'debug' });

logger.info('now emitted as JSON');
```

An explicit `format`/`level` passed to `new Logger({...})` always takes priority over `Logger.setDefaults()`.

#### Create a Child Logger with Persistent Fields

```javascript
const requestLogger = logger.with({ requestId: 'r-123' });

requestLogger.info('handling request');
requestLogger.info('request completed', { status: 200 });
```

### API

- **new Logger(options?: { level?: LogLevel; format?: LogFormat; fields?: LogFields })**: Creates a logger. `level` defaults to `'info'`, `format` defaults to `'logfmt'`.
- **logger.debug/info/warn/error(message: string, fields?: LogFields)**: Logs a line at the given level, gated by the logger's minimum level.
- **logger.with(fields: LogFields)**: Returns a new `Logger` with the given fields merged into every future call. Does not mutate the original logger.
- **Logger.setDefaults({ level?: LogLevel; format?: LogFormat })**: Sets process-wide defaults used by any logger that didn't explicitly set that option itself (including the `logger` singleton), similar to Go's `slog.SetDefault`.
- **logger** (named export): A ready-to-use default `Logger` instance at level `'info'`.

## Examples

Here's a complete example combining child loggers and error logging:

```javascript
import { logger } from '@hyperflake/slog';

const jobLogger = logger.with({ job: 'image-resize' });

jobLogger.info('job started');

try {
    resizeImage();
} catch (err) {
    jobLogger.error('job failed', { error: err });
}
```

## Repository

Find the source code and contribute on [GitHub](https://github.com/hyperflake/slog).

## License

This project is licensed under the ISC License - see the LICENSE file for details.
