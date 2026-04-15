import winston from "winston";
import { env, isProd } from "../config/env.js";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  if (stack) {
    return `${ts} [${level}] ${message}\n${stack}`;
  }
  return `${ts} [${level}] ${message}`;
});

export const logger = winston.createLogger({
  level: isProd() ? "info" : "debug",
  format: combine(errors({ stack: true }), timestamp(), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), logFormat),
    }),
  ],
});

export function logHttp(message: string, meta?: Record<string, unknown>): void {
  logger.info(message, meta);
}
