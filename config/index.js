const express = require("express");
const { errorHandler } = require("../middlewares/errorHandler");
const logger = require("../config/logger");
const morgan = require("morgan");
const app = express();

app.use(express.json());
app.use( morgan("dev", { stream: { write: (message) => logger.info(message.trim())}}));

app.use(errorHandler);

module.exports = app;