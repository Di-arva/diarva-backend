// services/taskService.js
const logger = require("../config/logger");
const Task = require("../models/Task");
const mongoose = require("mongoose");
const { sendEmail } = require("./commService");

const stateTransitionRules = {
  draft: ["open", "cancelled"],
  open: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["completed", "no_show", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
};

async function createForClinic(clinicId, payload, ctx = {}) {
  const log = logger.child({
    reqId: ctx.reqId || "n/a",
    actor: ctx.actor || "n/a",
    clinicId,
  });
  log.info({ msg: "taskService.createForClinic called" });

  let totalAmount;
  if (
    payload?.compensation?.hourly_rate != null &&
    payload?.schedule?.duration_hours != null
  ) {
    totalAmount =
      Math.round(
        Number(payload.compensation.hourly_rate) *
          Number(payload.schedule.duration_hours) *
          100
      ) / 100;
  }

  const doc = {
    clinic_id: new mongoose.Types.ObjectId(clinicId),

    title: payload.title,
    description: payload.description,

    requirements: {
      certification_level: payload.requirements.certification_level,
      minimum_experience: payload.requirements.minimum_experience ?? 0,
      required_specializations:
        payload.requirements.required_specializations || [],
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
    total_amount: doc.compensation.total_amount,
  });

  log.info({ msg: "taskService.createForClinic success", taskId: task._id });
  return task;
}

async function listForClinic(clinicId, opts, ctx = {}) {
  const log = logger.child({
    reqId: ctx.reqId || "n/a",
    actor: ctx.actor || "n/a",
    clinicId,
  });
  const {
    filters = {},
    page = 1,
    limit = 20,
    sort = { "schedule.start_datetime": 1 },
  } = opts || {};

  const query = {
    ...filters,
    clinic_id: new mongoose.Types.ObjectId(clinicId),
  };
  const skip = (page - 1) * limit;

  log.info({
    msg: "taskService.listForClinic called",
    page,
    limit,
    sort,
    filters,
  });

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
  log.info({
    msg: "db.find Task",
    duration_ms: Date.now() - tList,
    count: items.length,
  });

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
  const log = logger.child({
    reqId: ctx.reqId || "n/a",
    actor: ctx.actor || "n/a",
    taskId,
  });
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

async function updateForClinic(taskId, opts, ctx = {}) {
  const log = logger.child({
    reqId: ctx.reqId || "n/a",
    actor: ctx.actor || "n/a",
    taskId,
    clinicId: ctx.clinicId,
    isAdmin: ctx.isAdmin,
  });

  const {
    update = {},
    recomputeDuration = false,
    touchComp = false,
  } = opts || {};

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const query = { _id: new mongoose.Types.ObjectId(taskId) };
    if (!ctx.isAdmin) {
      if (!ctx.clinicId)
        throw new Error("Clinic ID is required for this operation.");
      query.clinic_id = new mongoose.Types.ObjectId(ctx.clinicId);
    }

    const current = await Task.findOne(query).session(session);
    if (!current) {
      throw new Error(
        "Task not found or you do not have permission to modify it."
      );
    }

    if (update.status && current.status !== update.status) {
      const fromStatus = current.status;
      const toStatus = update.status;
      const allowedTransitions = stateTransitionRules[fromStatus];
      if (!allowedTransitions || !allowedTransitions.includes(toStatus)) {
        throw new Error(
          `Invalid status transition from '${fromStatus}' to '${toStatus}'.`
        );
      }
    }

    const fieldsToUpdate = [
      "title",
      "description",
      "status",
      "priority",
      "location_details",
      "max_applications",
      "auto_assign",
      "requires_background_check",
      "application_deadline",
      "notes",
    ];

    fieldsToUpdate.forEach((field) => {
      if (update[field] !== undefined) {
        current[field] = update[field];
      }
    });

    if (update.requirements) {
      current.requirements = {
        ...current.requirements,
        ...update.requirements,
      };
    }
    if (update.schedule) {
      current.schedule = { ...current.schedule, ...update.schedule };
    }
    if (update.compensation) {
      current.compensation = {
        ...current.compensation,
        ...update.compensation,
      };
    }

    if (recomputeDuration) {
      const start = current.schedule.start_datetime;
      const end = current.schedule.end_datetime;
      const breakMin = current.schedule.break_duration_minutes ?? 30;

      if (
        start instanceof Date &&
        !isNaN(start) &&
        end instanceof Date &&
        !isNaN(end)
      ) {
        const rawHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const duration = Math.max(0, rawHours - breakMin / 60);
        current.schedule.duration_hours = Math.round(duration * 100) / 100;
        log.info({
          msg: "Recomputed duration_hours",
          taskId: current._id,
          newDuration: current.schedule.duration_hours,
        });
      } else {
        log.warn({
          msg: "Could not recompute duration due to invalid dates",
          taskId: current._id,
        });
      }
    }

    if (touchComp || recomputeDuration) {
      const rate = current.compensation.hourly_rate;
      const duration = current.schedule.duration_hours;

      if (typeof rate === "number" && typeof duration === "number") {
        current.compensation.total_amount =
          Math.round(rate * duration * 100) / 100;
        log.info({
          msg: "Recomputed total_amount",
          taskId: current._id,
          newTotalAmount: current.compensation.total_amount,
        });
      } else {
        log.warn({
          msg: "Could not recompute total_amount due to invalid rate/duration",
          taskId: current._id,
        });
      }
    }

    current.updated_at = new Date();
    await current.save({ session });

    if (current.status === "completed") {
      await workHistoryService.createFromTask(current, session);
    }

    await session.commitTransaction();

    log.info({ msg: "Task update successful", taskId: current._id });

    return { ok: true, id: current._id };
  } catch (error) {
    await session.abortTransaction();
    log.error({
      msg: "taskService.updateForClinic error",
      error: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    session.endSession();
  }
}

async function cancelForClinic(taskId, clinicId, reason, ctx = {}) {
  const log = logger.child({
    reqId: ctx.reqId || "n/a",
    actor: ctx.actor || "n/a",
    taskId,
  });
  log.info({ msg: "taskService.cancelForClinic called" });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const task = await Task.findOne({
      _id: taskId,
      clinic_id: clinicId,
    }).session(session);

    if (!task) {
      throw new Error(
        "Task not found or you do not have permission to cancel it."
      );
    }

    // Check against the state machine
    const fromStatus = task.status;
    const toStatus = "cancelled";
    const allowedTransitions = stateTransitionRules[fromStatus];
    if (!allowedTransitions || !allowedTransitions.includes(toStatus)) {
      throw new Error(
        `Cannot cancel task from its current status of '${fromStatus}'.`
      );
    }

    // Update the task's status and reason
    task.status = "cancelled";
    task.cancellation_reason = reason;
    await task.save({ session });

    // Find all applicants for this task to notify them
    const applicants = await Application.find({ task_id: taskId })
      .session(session)
      .populate("applicant_id", "email first_name");

    await session.commitTransaction();

    // Send notifications outside of the transaction
    if (applicants.length > 0) {
      log.info(
        `Notifying ${applicants.length} applicant(s) about task cancellation.`
      );
      const subject = `Update: Task "${task.title}" has been cancelled`;
      const textBody = `
        <p>Hi there,</p>
        <p>Please be advised that the task "${
          task.title
        }", scheduled for ${task.schedule.start_datetime.toDateString()}, has been cancelled by the clinic.</p>
        <p>Reason: ${reason || "No reason provided."}</p>
        <p>No further action is required from you. We encourage you to browse and apply for other available tasks.</p>
        <p>Thank you,<br>The Di'arva Team</p>
      `;

      for (const app of applicants) {
        if (app.applicant_id && app.applicant_id.email) {
          sendEmail({
            to: app.applicant_id.email,
            subject: subject,
            html: textBody,
            text: `The task "${task.title}" has been cancelled.`,
          }).catch((err) =>
            log.error(
              `Failed to send cancellation email to ${app.applicant_id.email}`,
              err
            )
          );
        }
      }
    }

    return { taskId: task._id, status: task.status };
  } catch (error) {
    await session.abortTransaction();
    log.error({
      msg: "taskService.cancelForClinic error",
      error: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = {
  createForClinic,
  listForClinic,
  getByIdForClinic,
  updateForClinic,
  cancelForClinic,
};