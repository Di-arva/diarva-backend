const { createLogger, format, transports } = require("winston");
const path = require("path");

const logFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

const logger = createLogger({
  level: "info",
  format: logFormat,
  defaultMeta: { service: "dental-clinic-service" },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, stack }) => {
          return `${timestamp} [${level}] : ${stack || message}`;
        })
      ),
    }),
    new transports.File({
      filename: path.join(__dirname, "../logs/error.log"),
      level: "error",
    }),
    new transports.File({
      filename: path.join(__dirname, "../logs/combined.log"),
    }),
  ],
});

module.exports = logger;