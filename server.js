require("dotenv").config();
const app = require("./config/index");
const logger = require("./config/logger");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 1080;

connectDB();

app.listen(PORT, () => {
  logger.info(`Diarva server running on port ${PORT}`);
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || "Something went wrong";
  res.status(status).json({ success: false, message });
});
