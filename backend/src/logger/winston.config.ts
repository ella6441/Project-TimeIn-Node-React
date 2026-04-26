import * as winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, context }) => {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const ctx = context !== undefined ? `[${String(context)}] ` : '';
  const msg = String((stack as string | undefined) ?? message);
  return `${String(timestamp)} ${level.toUpperCase().padEnd(5)} ${ctx}${msg}`;
});

export const winstonConfig: winston.LoggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat,
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(
        errors({ stack: true }),
        timestamp(),
        winston.format.json(),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: combine(
        errors({ stack: true }),
        timestamp(),
        winston.format.json(),
      ),
    }),
  ],
};
