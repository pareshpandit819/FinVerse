import pino from "pino";

const REDACTED_PATHS = [
  "*.password",
  "*.accessToken",
  "*.encryptedAccessToken",
  "*.secret",
  "*.encryptedSecret",
  "*.sessionToken",
  "*.Authorization",
  "*.authorization",
  "req.headers.cookie",
  "req.headers.authorization",
];

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  redact: {
    paths: REDACTED_PATHS,
    censor: "[REDACTED]",
  },
  ...(process.env["NODE_ENV"] !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});

export type Logger = typeof logger;
