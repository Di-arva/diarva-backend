const mongoose = require("mongoose");
const AssistantProfile = require("../models/AssistantProfile");

const Application = require("../models/Application");
const Task = require("../models/Task");
const User = require("../models/User");
const logger = require("../config/logger");
const { sendEmail, sendSms } = require("./commService");


async function listApplicationsForTask(taskId, clinicId) {
  logger.info(`Listing applications for task ${taskId} for clinic ${clinicId}`);
  const task = await Task.findOne({ _id: taskId, clinic_id: clinicId });
  if (!task) {
    throw new Error(
      "Task not found or does not belong to the specified clinic."
    );
  }
  return Application.find({ task_id: taskId }).populate(
    "applicant_id",
    "first_name last_name email mobile"
  );
}

async function acceptApplication(applicationId, clinicId, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const application = await Application.findById(applicationId)
      .session(session)
      .populate("applicant_id");
    if (!application) throw new Error("Application not found.");

    const task = await Task.findById(application.task_id).session(session);
    if (!task || task.clinic_id.toString() !== clinicId) {
      throw new Error("Task not found or does not belong to the clinic.");
    }

    if (task.status !== "open") {
      throw new Error(
        `Task cannot be assigned because its current status is '${task.status}'. It must be 'open'.`
      );
    }

    // 1. Update application status to 'accepted'
    application.status = "accepted";
    application.reviewed_at = new Date();
    application.reviewed_by = adminId;
    await application.save({ session });

    // 2. Update task status to 'assigned'
    task.status = "assigned";
    task.assignment = {
      assigned_to: application.applicant_id._id,
      assigned_at: new Date(),
    };
    await task.save({ session });

    // 3. Reject all other pending applications for this task
    const otherApplications = await Application.find({
      task_id: task._id,
      status: "pending",
    })
      .session(session)
      .populate("applicant_id");
    await Application.updateMany(
      { task_id: task._id, status: "pending" },
      {
        $set: {
          status: "rejected",
          reviewed_at: new Date(),
          reviewed_by: adminId,
        },
      },
      { session }
    );

    await session.commitTransaction();

    await sendEmail({
      to: application.applicant_id.email,
      subject: `Congratulations! Your application for "${task.title}" has been accepted.`,
      text: `Your application for the task "${task.title}" has been accepted. Please log in to your dashboard for more details.`,
    }).catch((err) =>
      logger.error(
        `Failed to send acceptance email to ${application.applicant_id.email}`,
        err
      )
    );

    const mobile = application.applicant_id.mobile;
    const message = `Congratulations! Your application for "${task.title}" has been accepted.`

    await sendSms(mobile, message).catch((err) =>
      logger.error(
        `Failed to send acceptance sms to ${mobile}`,
        err
      )
    );

    // Notify rejected assistants
    otherApplications.forEach((app) => {
      sendEmail({
        to: app.applicant_id.email,
        subject: `Update on your application for "${task.title}"`,
        text: `Thank you for your interest in the task "${task.title}". The position has now been filled. We encourage you to apply for other open tasks.`,
      }).catch((err) =>
        logger.error(
          `Failed to send rejection email to ${app.applicant_id.email}`,
          err
        )
      );
    });

    return { taskId: task._id, acceptedApplicationId: application._id };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function rejectApplication(applicationId, clinicId) {
  const application = await Application.findById(applicationId).populate(
    "applicant_id"
  );
  if (!application) throw new Error("Application not found.");

  const task = await Task.findById(application.task_id);
  if (!task || task.clinic_id.toString() !== clinicId) {
    throw new Error("Task not found or does not belong to the clinic.");
  }

  application.status = "rejected";
  await application.save();

  // Send notification
  sendEmail({
    to: application.applicant_id.email,
    subject: `Update on your application for "${task.title}"`,
    text: `Thank you for your interest in the task "${task.title}". After careful consideration, we have decided to move forward with other candidates. We encourage you to apply for other open tasks.`,
  }).catch((err) =>
    logger.error(
      `Failed to send rejection email to ${application.applicant_id.email}`,
      err
    )
  );

  return { applicationId: application._id };
}

async function withdrawApplication(applicationId, applicantId) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const application = await Application.findOne({
      _id: applicationId,
      applicant_id: applicantId,
    }).session(session);
    if (!application)
      throw new Error(
        "Application not found or you do not have permission to withdraw it."
      );

    if (!["pending", "under_review"].includes(application.status)) {
      throw new Error(
        `Application cannot be withdrawn because its status is '${application.status}'.`
      );
    }

    application.status = "withdrawn";
    await application.save({ session });

    await Task.findByIdAndUpdate(
      application.task_id,
      { $inc: { applications_count: -1 } },
      { session }
    );

    await session.commitTransaction();

    // Optional: Notify clinic of withdrawal
    logger.info(
      `Application ${applicationId} withdrawn by user ${applicantId}.`
    );

    return { applicationId: application._id };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function getAssistantContext(userId, log) {
  // Pull user + assistant profile (cert level, specialization, province/city if needed)
  const t0 = Date.now();
  const [user, profile] = await Promise.all([
    User.findById(userId).lean(),
    AssistantProfile.findOne({ user_id: userId }).lean(),
  ]);
  log.info({
    msg: "assistant context fetched",
    duration_ms: Date.now() - t0,
    hasUser: !!user,
    hasProfile: !!profile,
  });

  if (
    !user ||
    user.role !== "assistant" ||
    user.approval_status !== "approved" ||
    !user.is_active
  ) {
    return {
      ok: false,
      status: 403,
      message: "Assistant is not active or approved",
    };
  }

  const cert = profile?.professional_info?.certification_level || null;
  const specs = profile?.professional_info?.specializations || [];
  const province = user.province; // if you want to filter by province later
  const city = user.city;

  return { ok: true, user, profile, cert, specs, province, city };
}

async function discoverForAssistant(userId, opts, ctx = {}) {
  const log = logger.child({
    reqId: ctx.reqId || "n/a",
    actor: ctx.actor || "n/a",
    userId,
  });

  const context = await getAssistantContext(userId, log);
  if (!context.ok)
    return { total: 0, page: 1, pages: 1, limit: opts?.limit || 20, data: [] };

  const { cert, specs } = context;
  const {
    page = 1,
    limit = 20,
    sort = { "schedule.start_datetime": 1 },
    filters = {},
  } = opts || {};
  const query = { ...filters, status: { $in: ["open"] } };

  // specialization match (if task requires any and assistant has any overlap)
  // If the filter already set specialization, we keep it; otherwise ensure overlap if field exists
  if (
    !filters["requirements.required_specializations"] &&
    Array.isArray(specs) &&
    specs.length > 0
  ) {
    query.$and = [
      {
        $or: [
          { "requirements.required_specializations": { $exists: false } },
          { "requirements.required_specializations": { $size: 0 } },
          { "requirements.required_specializations": { $in: specs } },
        ],
      },
    ];
  }

  // Exclude tasks past deadline or already started
  const now = new Date();
  query["schedule.start_datetime"] = query["schedule.start_datetime"] || {};
  query["schedule.start_datetime"].$gte =
    query["schedule.start_datetime"].$gte || now;
  query.$and = query.$and || [];
  query.$and.push({
    $or: [
      { application_deadline: { $exists: false } },
      { application_deadline: { $gte: now } },
    ],
  });

  const skip = (page - 1) * limit;

  const tCount = Date.now();
  const total = await Task.countDocuments(query);
  log.info({
    msg: "db.count Task discover",
    duration_ms: Date.now() - tCount,
    total,
  });

  const tList = Date.now();
  const items = await Task.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .select({
      title: 1,
      clinic_id: 1,
      status: 1,
      priority: 1,
      "requirements.required_specializations": 1,
      "schedule.start_datetime": 1,
      "schedule.end_datetime": 1,
      "schedule.duration_hours": 1,
      "compensation.hourly_rate": 1,
      "compensation.currency": 1,
      applications_count: 1,
      max_applications: 1,
      posted_at: 1,
    })
    .lean();
  log.info({
    msg: "db.find Task discover",
    duration_ms: Date.now() - tList,
    count: items.length,
  });

  const pages = Math.max(1, Math.ceil(total / limit));
  return { total, page, pages, limit, data: items };
}

async function apply(userId, taskId, ctx = {}) {
  const log = logger.child({
    reqId: ctx.reqId || "n/a",
    actor: ctx.actor || "n/a",
    userId,
    taskId,
  });

  // Ensure assistant is active/approved
  const context = await getAssistantContext(userId, log);
  if (!context.ok)
    return {
      ok: false,
      status: context.status,
      message: context.message,
      reason: "assistant_not_active",
    };

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Load task (must be open, not started, capacity available)
    const t0 = Date.now();
    const task = await Task.findOne({
      _id: new mongoose.Types.ObjectId(taskId),
      status: "open",
      "schedule.start_datetime": { $gt: new Date() },
      $expr: { $lt: ["$applications_count", "$max_applications"] },
    }).session(session);

    log.info({
      msg: "db.findOne Task for apply",
      duration_ms: Date.now() - t0,
      found: !!task,
    });

    if (!task) {
      await session.abortTransaction();
      session.endSession();
      return {
        ok: false,
        status: 404,
        message: "Task not available",
        reason: "task_not_available",
      };
    }

    // Prevent duplicate application
    const t1 = Date.now();
    const dup = await Application.findOne({
      task_id: task._id,
      applicant_id: new mongoose.Types.ObjectId(userId),
      status: { $in: ["pending", "under_review", "accepted", "assigned"] },
    }).session(session);
    log.info({
      msg: "db.findOne Application duplicate check",
      duration_ms: Date.now() - t1,
      found: !!dup,
    });

    if (dup) {
      await session.abortTransaction();
      session.endSession();
      return {
        ok: false,
        status: 409,
        message: "Already applied for this task",
        reason: "duplicate_application",
      };
    }

    // Create application
    const appDoc = new Application({
      task_id: task._id,
      applicant_id: new mongoose.Types.ObjectId(userId),
      clinic_id: task.clinic_id,
      status: "pending",
      availability_confirmation: true,
      applied_at: new Date(),
    });

    const t2 = Date.now();
    await appDoc.save({ session });
    log.info({
      msg: "db.insert Application",
      duration_ms: Date.now() - t2,
      applicationId: appDoc._id,
    });

    // Atomically increment applications_count (guard against race)
    const t3 = Date.now();
    const incRes = await Task.updateOne(
      { _id: task._id, applications_count: { $lt: task.max_applications } },
      { $inc: { applications_count: 1 } }
    ).session(session);
    log.info({
      msg: "db.updateOne Task inc applications_count",
      duration_ms: Date.now() - t3,
      matched: incRes.matchedCount,
      modified: incRes.modifiedCount,
    });

    if (incRes.modifiedCount === 0) {
      await session.abortTransaction();
      session.endSession();
      return {
        ok: false,
        status: 409,
        message: "Task application limit reached",
        reason: "limit_reached",
      };
    }

    await session.commitTransaction();
    session.endSession();

    return { ok: true, applicationId: appDoc._id };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    log.error({
      msg: "assistantTaskService.apply error",
      error: err.message,
      stack: err.stack,
    });
    throw err;
  }
}

module.exports = {
  listApplicationsForTask,
  acceptApplication,
  rejectApplication,
  withdrawApplication,
  discoverForAssistant,
  apply
};
