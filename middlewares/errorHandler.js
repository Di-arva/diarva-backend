const logger = require("../config/logger");

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode || 500;
    this.isOperational = true;
  }
}

const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.isOperational ? err.message : "Internal Server Error",
  });
};

module.exports = { errorHandler, AppError };