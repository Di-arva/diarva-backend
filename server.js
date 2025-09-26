const app = require("./config/index");
const logger = require("./config/logger");

const PORT = process.env.PORT || 1080;

app.listen(PORT, () => {
  logger.info(`Diarva server running on port ${PORT}`);
});
