const applicationService = require("../services/applicationService");
const logger = require("../config/logger");
const mongoose = require("mongoose");

const STATUS_ENUM = ["open"]; // discover only “open” tasks by default
const CERT_ENUM = ["Level_I", "Level_II","HARP"];
const SPEC_ENUM = [
  "Chairside Assisting","Dental Radiography","Infection Control","Preventive Dentistry",
  "Orthodontic Assisting","Surgical Assisting","Pediatric Assisting","Laboratory Procedures",
  "Administrative Tasks",
];
const CERT_ALIASES = {
  "level-1":"Level_I","Level-1":"Level_I","level_1":"Level_I",
  "level-2":"Level_II","Level-2":"Level_II","level_2":"Level_II",
  harp:"HARP"
};

const listForTask = async (req, res, next) => {
    const log = req.log || logger;
    const user = req.user || {};
    const { id } = req.params || {};
    log.info({ msg: "applicationController.listForTask called", userId: user.sub, role: user.role, taskId: id });

    try {
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: "Invalid task id" });
        }
        const clinicId = user.clinic_id;
        if (!clinicId && user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const applications = await applicationService.listApplicationsForTask(id, clinicId);
        res.json({ success: true, data: applications });

    } catch (err) {
        log.error({ msg: "applicationController.listForTask error", error: err.message, stack: err.stack });
        next(err);
    }
};

const accept = async (req, res, next) => {
    const log = req.log || logger;
    const user = req.user || {};
    const { id } = req.params || {};
    log.info({ msg: "applicationController.accept called", userId: user.sub, role: user.role, applicationId: id });

    try {
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: "Invalid application id" });
        }

        const clinicId = user.clinic_id;
        const result = await applicationService.acceptApplication(id, clinicId, user.sub);
        res.json({ success: true, message: "Application accepted successfully.", data: result });

    } catch (err) {
        log.error({ msg: "applicationController.accept error", error: err.message, stack: err.stack });
        next(err);
    }
};

const reject = async (req, res, next) => {
    const log = req.log || logger;
    const user = req.user || {};
    const { id } = req.params || {};
    log.info({ msg: "applicationController.reject called", userId: user.sub, role: user.role, applicationId: id });

    try {
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: "Invalid application id" });
        }

        const clinicId = user.clinic_id;
        const result = await applicationService.rejectApplication(id, clinicId);
        res.json({ success: true, message: "Application rejected.", data: result });
    } catch (err) {
        log.error({ msg: "applicationController.reject error", error: err.message, stack: err.stack });
        next(err);
    }
};

const withdraw = async (req, res, next) => {
    const log = req.log || logger;
    const user = req.user || {};
    const { id } = req.params || {};
    log.info({ msg: "applicationController.withdraw called", userId: user.sub, role: user.role, applicationId: id });

    try {
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: "Invalid application id" });
        }
        
        const result = await applicationService.withdrawApplication(id, user.sub);
        res.json({ success: true, message: "Application withdrawn successfully.", data: result });

    } catch (err) {
        log.error({ msg: "applicationController.withdraw error", error: err.message, stack: err.stack });
        next(err);
    }
};

const discover = async (req, res, next) => {
  const log = req.log || logger;
  const user = req.user || {};
  log.info({ msg: "assistantTaskController.discover called", userId: user.sub, q: req.query });

  try {
    const q = req.query || {};
    const errors = [];

    // Pagination/sort
    const page  = Math.max(1, parseInt(q.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || "20", 10)));
    const sortField = q.sort_by || "schedule.start_datetime";
    const sortDir   = (q.sort_dir || "asc").toLowerCase() === "desc" ? -1 : 1;
    const sort = { [sortField]: sortDir, _id: 1 };

    // Optional filters
    const filters = { status: { $in: STATUS_ENUM } };

    // certification_level (if provided)
    if (q.certification_level) {
      let cert = q.certification_level;
      if (CERT_ALIASES[cert]) cert = CERT_ALIASES[cert];
      if (!CERT_ENUM.includes(cert)) errors.push(`Invalid certification_level: ${q.certification_level}`);
      else filters["requirements.certification_level"] = cert; // note: service will also match Any
    }

    // specialization (single)
    if (q.specialization) {
      if (!SPEC_ENUM.includes(q.specialization)) errors.push(`Invalid specialization: ${q.specialization}`);
      else filters["requirements.required_specializations"] = q.specialization;
    }

    // Date window (start_datetime)
    const startFrom = q.start_from ? new Date(q.start_from) : null;
    const startTo   = q.start_to   ? new Date(q.start_to)   : null;
    if (startFrom && isNaN(startFrom)) errors.push("start_from must be a valid date");
    if (startTo && isNaN(startTo)) errors.push("start_to must be a valid date");
    if (startFrom || startTo) {
      filters["schedule.start_datetime"] = {};
      if (startFrom) filters["schedule.start_datetime"].$gte = startFrom;
      if (startTo)   filters["schedule.start_datetime"].$lte = startTo;
    }

    if (errors.length) {
      log.warn({ msg: "assistantTaskController.discover validation failed", errors });
      return res.status(422).json({ success: false, message: "Validation failed", errors });
    }

    const result = await applicationService.discoverForAssistant(
      user.sub,
      { page, limit, sort, filters },
      { reqId: req.reqId, actor: user.sub }
    );

    log.info({ msg: "assistantTaskController.discover success", total: result.total, page: result.page, pages: result.pages });
    return res.json({ success: true, ...result });
  } catch (err) {
    log.error({ msg: "assistantTaskController.discover error", error: err.message, stack: err.stack });
    next(err);
  }
};

const applyToTask = async (req, res, next) => {
  const log = req.log || logger;
  const user = req.user || {};
  const { id } = req.params || {};
  log.info({ msg: "assistantTaskController.applyToTask called", userId: user.sub, taskId: id });

  try {
    if (!mongoose.isValidObjectId(id)) {
      log.warn({ msg: "Invalid task id", id });
      return res.status(400).json({ success: false, message: "Invalid task id" });
    }

    const result = await applicationService.apply(user.sub, id, { reqId: req.reqId, actor: user.sub });
    if (!result?.ok) {
      log.warn({ msg: "applyToTask failed", reason: result?.reason });
      return res.status(result?.status || 400).json({ success: false, message: result?.message || "Unable to apply" });
    }

    log.info({ msg: "assistantTaskController.applyToTask success", taskId: id, applicationId: result.applicationId });
    return res.status(201).json({ success: true, data: { application_id: result.applicationId } });
  } catch (err) {
    log.error({ msg: "assistantTaskController.applyToTask error", error: err.message, stack: err.stack });
    next(err);
  }
};

//get applications made by Nishi

const getMyApplications = async (req, res, next) => {
  const log = req.log || logger;
  const user = req.user || {};
  log.info({ msg: "applicationController.getMyApplications called", userId: user.sub });

  try {
    const q = req.query || {};
    
    // Pagination
    const page = Math.max(1, parseInt(q.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || "20", 10)));
    const skip = (page - 1) * limit;

    // Build query
    const query = { applicant_id: user.sub };
    
    // Optional status filter
    if (q.status && ["pending", "under_review", "accepted", "rejected", "withdrawn"].includes(q.status)) {
      query.status = q.status;
    }

    // Get applications with populated data
    const applications = await mongoose.model("Application")
      .find(query)
      .populate("task_id", "title schedule compensation requirements status clinic_id")
      .populate("clinic_id", "name address city province phone email")
      .sort({ applied_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await mongoose.model("Application").countDocuments(query);

    log.info({ 
      msg: "applicationController.getMyApplications success", 
      total, 
      page, 
      returned: applications.length 
    });

    res.json({
      success: true,
      data: applications,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    });

  } catch (err) {
    log.error({ 
      msg: "applicationController.getMyApplications error", 
      error: err.message, 
      stack: err.stack 
    });
    next(err);
  }
};


module.exports = {
    listForTask,
    accept,
    reject,
    withdraw,
    discover,
    applyToTask,
  getMyApplications
};