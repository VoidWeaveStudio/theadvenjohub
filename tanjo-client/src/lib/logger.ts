//tanjo-client\src\lib\logger.ts
const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const noop = () => { };

export const logger: Logger = isDev
  ? {
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  }
  : {
    debug: noop,
    info: noop,
    warn: noop,
    error: console.error.bind(console),
  };

export const log = logger;