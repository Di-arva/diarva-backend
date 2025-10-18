const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { errorHandler } = require("../middlewares/errorHandler");
const logger = require("../config/logger");
const authRoutes = require("../routes/authRoutes");
const adminRoutes = require("../routes/adminRoutes")
const clinicRoutes = require("../routes/clinicRoutes")

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true, 
}));
app.use( morgan("dev", { stream: { write: (message) => logger.info(message.trim())}}));
app.use(errorHandler);

//routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/clinic", clinicRoutes);

module.exports = app;