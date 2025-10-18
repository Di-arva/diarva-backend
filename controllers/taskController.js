// controllers/clinicTaskController.js
const logger = require("../config/logger");
const taskService = require("../services/taskService");

// Schema enums (mirror model)
const CERT_ENUM = ["Level_I", "Level_II", "RDA", "CDA", "PDA", "Any"];
const SPEC_ENUM = [
  "Chairside Assisting",
  "Dental Radiography",
  "Infection Control",
  "Preventive Dentistry",
  "Orthodontic Assisting",
  "Surgical Assisting",
  "Pediatric Assisting",
  "Laboratory Procedures",
  "Administrative Tasks",
];
const PAY_METHOD_ENUM = ["Cash", "E-transfer", "Cheque", "Direct Deposit"];
const PAY_TERMS_ENUM = ["Immediate", "Same Day", "Next Day", "Weekly", "Bi-weekly"];
const PRIORITY_ENUM = ["low", "normal", "high", "urgent"];

// Optional: allow legacy aliases from UI if needed
const CERT_ALIASES = {
  "level-1": "Level_I",
  "level_1": "Level_I",
  "Level-1": "Level_I",
  "level-2": "Level_II",
  "level_2": "Level_II",
  "Level-2": "Level_II",
  harp: "RDA", // if you consider HARP as radiography requirement; adjust if not desired
};

const parseDate = (v) => (v instanceof Date ? v : new Date(v));

const create = async (req, res, next) => {
  const log = req.log || logger;
  const user = req.user || {};
  log.info({ msg: "clinicTaskController.create called", userId: user.sub, role: user.role });

  try {
    const body = req.body || {};
    const errors = [];

    // clinicId: from token (preferred) or payload fallback
    const clinicId = user.clinic_id || body.clinic_id;
    if (!clinicId) errors.push("clinic_id is required");

    // Top-level required
    if (!body.title) errors.push("title is required");
    if (!body.description) errors.push("description is required");

    // requirements
    const reqs = body.requirements || {};
    let cert = reqs.certification_level;
    if (CERT_ALIASES[cert]) cert = CERT_ALIASES[cert];
    if (!cert) errors.push("requirements.certification_level is required");
    else if (!CERT_ENUM.includes(cert)) {
      errors.push(`requirements.certification_level must be one of: ${CERT_ENUM.join(", ")}`);
    }

    // required_specializations (if given) must be valid
    if (Array.isArray(reqs.required_specializations)) {
      const invalidSpecs = reqs.required_specializations.filter((s) => !SPEC_ENUM.includes(s));
      if (invalidSpecs.length) {
        errors.push(`requirements.required_specializations contains invalid values: ${invalidSpecs.join(", ")}`);
      }
    }

    // schedule
    const schedule = body.schedule || {};
    if (!schedule.start_datetime) errors.push("schedule.start_datetime is required");
    if (!schedule.end_datetime) errors.push("schedule.end_datetime is required");

    let start = schedule.start_datetime ? parseDate(schedule.start_datetime) : null;
    let end = schedule.end_datetime ? parseDate(schedule.end_datetime) : null;
    if (start && isNaN(start.getTime())) errors.push("schedule.start_datetime must be a valid date");
    if (end && isNaN(end.getTime())) errors.push("schedule.end_datetime must be a valid date");
    if (start && end && end <= start) errors.push("schedule.end_datetime must be after schedule.start_datetime");

    const breakMin = Number(schedule.break_duration_minutes ?? 30);
    if (Number.isNaN(breakMin) || breakMin < 0 || breakMin > 180) {
      errors.push("schedule.break_duration_minutes must be between 0 and 180");
    }

    // location
    if (!body.location_details && !body.location) {
      // your schema uses location_details; if you still keep a plain location string elsewhere, ignore this.
      // Require at least description fields if you want; here we let location_details be optional.
    }

    // compensation
    const comp = body.compensation || {};
    const rate = Number(comp.hourly_rate);
    if (Number.isNaN(rate)) errors.push("compensation.hourly_rate must be a number");
    else if (rate < 15 || rate > 100) errors.push("compensation.hourly_rate must be between 15 and 100");

    if (comp.payment_method && !PAY_METHOD_ENUM.includes(comp.payment_method)) {
      errors.push(`compensation.payment_method must be one of: ${PAY_METHOD_ENUM.join(", ")}`);
    }
    if (comp.payment_terms && !PAY_TERMS_ENUM.includes(comp.payment_terms)) {
      errors.push(`compensation.payment_terms must be one of: ${PAY_TERMS_ENUM.join(", ")}`);
    }

    // priority
    if (body.priority && !PRIORITY_ENUM.includes(body.priority)) {
      errors.push(`priority must be one of: ${PRIORITY_ENUM.join(", ")}`);
    }

    // compute duration (server-truth)
    let durationHours = null;
    if (start && end) {
      const ms = end.getTime() - start.getTime();
      const raw = ms / (1000 * 60 * 60);
      durationHours = Math.max(0, raw - breakMin / 60); // subtract break
      // enforce schema constraints
      if (durationHours < 0.5 || durationHours > 12) {
        errors.push("Computed duration_hours must be between 0.5 and 12 (consider adjusting break or times)");
      }
    }

    if (errors.length) {
      log.warn({ msg: "clinicTaskController.create validation failed", errors });
      return res.status(422).json({ success: false, message: "Validation failed", errors });
    }

    const cleanPayload = {
      title: body.title.trim(),
      description: body.description.trim(),
      requirements: {
        certification_level: cert,
        minimum_experience: Number(reqs.minimum_experience ?? 0),
        required_specializations: Array.isArray(reqs.required_specializations)
          ? reqs.required_specializations
          : undefined,
        preferred_skills: Array.isArray(reqs.preferred_skills) ? reqs.preferred_skills : undefined,
      },
      schedule: {
        start_datetime: start,
        end_datetime: end,
        duration_hours: Math.round(durationHours * 100) / 100,
        break_duration_minutes: breakMin,
      },
      compensation: {
        hourly_rate: rate,
        currency: comp.currency || "CAD",
        // total_amount computed in service (rate * duration)
        payment_method: comp.payment_method || "E-transfer",
        payment_terms: comp.payment_terms || "Same Day",
      },
      status: body.status || "open",
      priority: body.priority || "normal",
      location_details: body.location_details || undefined,
      applications_count: Number(body.applications_count ?? 0),
      max_applications: Number(body.max_applications ?? 10),
      auto_assign: Boolean(body.auto_assign ?? false),
      requires_background_check: body.requires_background_check !== false, // default true
      application_deadline: body.application_deadline ? parseDate(body.application_deadline) : undefined,
      notes: body.notes,
    };

    const task = await taskService.createForClinic(clinicId, cleanPayload, { reqId: req.reqId, actor: user.sub });
    log.info({ msg: "clinicTaskController.create success", taskId: task._id });

    return res.status(201).json({ success: true, data: { id: task._id } });
  } catch (err) {
    log.error({ msg: "clinicTaskController.create error", error: err.message, stack: err.stack });
    next(err);
  }
};

const listForClinic = async (req, res, next) => {
  const log = req.log || logger;
  const user = req.user || {};
  log.info({ msg: "clinicTaskController.listForClinic called", userId: user.sub, role: user.role, query: req.query });

  try {
    const q = req.query || {};
    const errors = [];

    // clinic scope
    const clinicId = user.clinic_id || q.clinic_id;
    if (!clinicId) errors.push("clinic_id missing");

    // filters
    const filters = {};
    if (q.status) {
      const statuses = String(q.status).split(",").map(s=>s.trim()).filter(Boolean);
      const bad = statuses.filter(s => !STATUS_ENUM.includes(s));
      if (bad.length) errors.push(`Invalid status: ${bad.join(", ")}`);
      else filters.status = { $in: statuses };
    }

    if (q.priority) {
      if (!PRIORITY_ENUM.includes(q.priority)) errors.push(`Invalid priority: ${q.priority}`);
      else filters.priority = q.priority;
    }

    if (q.certification_level) {
      let cert = q.certification_level;
      if (CERT_ALIASES[cert]) cert = CERT_ALIASES[cert];
      if (!CERT_ENUM.includes(cert)) errors.push(`Invalid certification_level: ${q.certification_level}`);
      else filters["requirements.certification_level"] = cert;
    }

    if (q.specialization) {
      // exact match from enum list (schema will enforce)
      filters["requirements.required_specializations"] = String(q.specialization);
    }

    // date range on schedule.start_datetime
    const startFrom = q.start_from ? new Date(q.start_from) : null;
    const startTo   = q.start_to   ? new Date(q.start_to)   : null;
    if (startFrom && isNaN(startFrom.getTime())) errors.push("start_from must be a valid date");
    if (startTo && isNaN(startTo.getTime())) errors.push("start_to must be a valid date");
    if (startFrom || startTo) {
      filters["schedule.start_datetime"] = {};
      if (startFrom) filters["schedule.start_datetime"].$gte = startFrom;
      if (startTo)   filters["schedule.start_datetime"].$lte = startTo;
    }

    // pagination + sort
    const page  = Math.max(1, parseInt(q.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || "20", 10)));
    const sortField = q.sort_by || "schedule.start_datetime"; // or posted_at
    const sortDir   = (q.sort_dir || "asc").toLowerCase() === "desc" ? -1 : 1;
    const sort = { [sortField]: sortDir, _id: 1 };

    if (errors.length) {
      log.warn({ msg: "clinicTaskController.listForClinic validation failed", errors });
      return res.status(422).json({ success: false, message: "Validation failed", errors });
    }

    const result = await taskService.listForClinic(clinicId, { filters, page, limit, sort }, { reqId: req.reqId, actor: user.sub });
    log.info({ msg: "clinicTaskController.listForClinic success", total: result.total, page: result.page, pages: result.pages });

    return res.json({ success: true, ...result });
  } catch (err) {
    log.error({ msg: "clinicTaskController.listForClinic error", error: err.message, stack: err.stack });
    next(err);
  }
};

module.exports = { listForClinic, create };