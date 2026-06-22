# @hyperflake/slog

A lightweight, structured logger for Node.js that mimics the text output format of Go's `log`/`slog` packages. It prints a timestamp, level, message, and key/value fields on a single line, and renders the full stack trace beneath the line whenever an `Error` is logged.

## Features

- **slog-style output:** `2026/06/22 05:45:47 INFO image resized width=1920 height=1080`
- **Structured fields:** pass a plain object of key/value pairs alongside any log call.
- **Full error logging:** errors render their message inline and their stack trace indented underneath, in a single write.
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
2026/06/22 05:45:47 ERROR upload failed folder=123 image=abc.jpg error="connection refused"
    at uploadImage (upload.ts:42:11)
    at processImage (worker.ts:88:5)
```

#### Create a Child Logger with Persistent Fields

```javascript
const requestLogger = logger.with({ requestId: 'r-123' });

requestLogger.info('handling request');
requestLogger.info('request completed', { status: 200 });
```

### API

- **new Logger(options?: { level?: LogLevel; fields?: LogFields })**: Creates a logger. `level` defaults to `'info'`.
- **logger.debug/info/warn/error(message: string, fields?: LogFields)**: Logs a line at the given level, gated by the logger's minimum level.
- **logger.with(fields: LogFields)**: Returns a new `Logger` with the given fields merged into every future call. Does not mutate the original logger.
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
