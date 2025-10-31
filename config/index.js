const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { errorHandler } = require("../middlewares/errorHandler");
const logger = require("../config/logger");
const authRoutes = require("../routes/authRoutes");
const adminRoutes = require("../routes/adminRoutes");
const clinicRoutes = require("../routes/clinicRoutes");
const applicationRoutes = require("../routes/applicationRoutes");
const assistantRoutes = require("../routes/assistantRoutes");
const workHistoryRoutes = require("../routes/workHistoryRoutes"); 
const visitorContactRoutes = require("../routes/visitorContact")

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true,
}));
app.use(morgan("dev", { stream: { write: (message) => logger.info(message.trim()) } }));

//routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/clinic", clinicRoutes);
app.use("/api/v1/applications", applicationRoutes);
app.use("/api/v1/assistant", assistantRoutes);
app.use("/api/v1/work-history", workHistoryRoutes);
app.use("/api/v1", visitorContactRoutes);


app.use(errorHandler);

module.exports = app;