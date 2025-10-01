const mongoose = require("mongoose");
const logger = require("./logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.DB_URI);

    logger.info(`Database Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on("connected", () => {
  logger.info("Database connection established.");
});

mongoose.connection.on("error", (err) => {
  logger.error(`Database connection error: ${err}`);
});

mongoose.connection.on("disconnected", () => {
  logger.warn("Database connection lost.");
});

process.on("SIGINT", async () => {
  await mongoose.connection.close();
  logger.info("Database connection closed on app termination.");
  process.exit(0);
});

module.exports = connectDB;