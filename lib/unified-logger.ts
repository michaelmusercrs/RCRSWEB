// Minimal logger shim. Exists so draft modules that import from
// './unified-logger' compile. Swap for a real structured logger when needed.

type Meta = Record<string, unknown> | undefined;

export const logger = {
  debug(msg: string, meta?: Meta) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(msg, meta ?? '');
    }
  },
  info(msg: string, meta?: Meta) {
    console.log(msg, meta ?? '');
  },
  warn(msg: string, meta?: Meta) {
    console.warn(msg, meta ?? '');
  },
  error(msg: string, err?: unknown, meta?: Meta) {
    console.error(msg, err ?? '', meta ?? '');
  },
};
