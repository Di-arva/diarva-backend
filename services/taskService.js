// services/taskService.js
const logger = require("../config/logger");
const Task = require("../models/Task");
const mongoose = require("mongoose");

async function createForClinic(clinicId, payload, ctx = {}) {
  const log = logger.child({ reqId: ctx.reqId || "n/a", actor: ctx.actor || "n/a", clinicId });
  log.info({ msg: "taskService.createForClinic called" });

  let totalAmount;
  if (payload?.compensation?.hourly_rate != null && payload?.schedule?.duration_hours != null) {
    totalAmount = Math.round(
      Number(payload.compensation.hourly_rate) * Number(payload.schedule.duration_hours) * 100
    ) / 100;
  }

  const doc = {
    clinic_id: new mongoose.Types.ObjectId(clinicId),

    title: payload.title,
    description: payload.description,

    requirements: {
      certification_level: payload.requirements.certification_level,
      minimum_experience: payload.requirements.minimum_experience ?? 0,
      required_specializations: payload.requirements.required_specializations || [],
      preferred_skills: payload.requirements.preferred_skills || [],
    },

    schedule: {
      start_datetime: payload.schedule.start_datetime,
      end_datetime: payload.schedule.end_datetime,
      duration_hours: payload.schedule.duration_hours,
      break_duration_minutes: payload.schedule.break_duration_minutes ?? 30,
    },

    compensation: {
      hourly_rate: payload.compensation.hourly_rate,
      currency: payload.compensation.currency || "CAD",
      total_amount: totalAmount,
      payment_method: payload.compensation.payment_method || "E-transfer",
      payment_terms: payload.compensation.payment_terms || "Same Day",
    },

    status: payload.status || "open",
    priority: payload.priority || "normal",

    assignment: payload.assignment || undefined,

    location_details: payload.location_details || undefined,

    applications_count: payload.applications_count ?? 0,
    max_applications: payload.max_applications ?? 10,
    auto_assign: payload.auto_assign ?? false,
    requires_background_check: payload.requires_background_check ?? true,

    application_deadline: payload.application_deadline || undefined,
    // posted_at/updated_at handled by schema defaults/timestamps
    notes: payload.notes,
  };

  const t0 = Date.now();
  const task = await Task.create(doc);
  log.info({
    msg: "db.insert Task",
    collection: "tasks",
    op: "insertOne",
    docId: task._id,
    duration_ms: Date.now() - t0,
    total_amount: doc.compensation.total_amount
  });

  log.info({ msg: "taskService.createForClinic success", taskId: task._id });
  return task;
}

async function listForClinic(clinicId, opts, ctx = {}) {
  const log = logger.child({ reqId: ctx.reqId || "n/a", actor: ctx.actor || "n/a", clinicId });
  const { filters = {}, page = 1, limit = 20, sort = { "schedule.start_datetime": 1 } } = opts || {};

  const query = { ...filters, clinic_id: new mongoose.Types.ObjectId(clinicId) };
  const skip = (page - 1) * limit;

  log.info({ msg: "taskService.listForClinic called", page, limit, sort, filters });

  const tCount = Date.now();
  const total = await Task.countDocuments(query);
  log.debug({ msg: "db.count Task", duration_ms: Date.now() - tCount, total });

  const tList = Date.now();
  const items = await Task.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .select({
      title: 1,
      status: 1,
      priority: 1,
      "requirements.certification_level": 1,
      "requirements.required_specializations": 1,
      "schedule.start_datetime": 1,
      "schedule.end_datetime": 1,
      "schedule.duration_hours": 1,
      "compensation.hourly_rate": 1,
      "compensation.currency": 1,
      posted_at: 1,
      applications_count: 1,
      max_applications: 1,
    })
    .lean();
  log.info({ msg: "db.find Task", duration_ms: Date.now() - tList, count: items.length });

  const pages = Math.max(1, Math.ceil(total / limit));

  return {
    total,
    page,
    pages,
    limit,
    data: items,
  };
}

async function getByIdForClinic(taskId, scope, ctx = {}) {
  const log = logger.child({ reqId: ctx.reqId || "n/a", actor: ctx.actor || "n/a", taskId });
  const { clinicId, isAdmin } = scope || {};
  log.info({ msg: "taskService.getByIdForClinic called", clinicId, isAdmin });

  const query = { _id: new mongoose.Types.ObjectId(taskId) };
  if (!isAdmin) {
    query.clinic_id = new mongoose.Types.ObjectId(clinicId);
  }

  const t0 = Date.now();
  const task = await Task.findOne(query).lean(); 
  log.info({
    msg: "db.findOne Task",
    collection: "tasks",
    duration_ms: Date.now() - t0,
    found: !!task,
  });

  return task || null;
}

module.exports = { createForClinic, listForClinic, getByIdForClinic };