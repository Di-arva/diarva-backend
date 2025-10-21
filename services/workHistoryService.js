const WorkHistory = require("../models/WorkHistory");
const Task = require("../models/Task");
const logger = require("../config/logger");
const mongoose = require("mongoose");

async function createFromTask(task, session) {
  if (
    !task ||
    task.status !== "completed" ||
    !task.assignment ||
    !task.assignment.assigned_to
  ) {
    throw new Error(
      "Task must be completed and assigned to create work history."
    );
  }

  // Check if a WorkHistory record already exists for this task to prevent duplicates
  const existingHistory = await WorkHistory.findOne({
    task_id: task._id,
  }).session(session);
  if (existingHistory) {
    logger.warn(
      `WorkHistory record for task ${task._id} already exists. Skipping creation.`
    );
    return existingHistory;
  }

  const doc = {
    task_id: task._id,
    assistant_id: task.assignment.assigned_to,
    clinic_id: task.clinic_id,
    work_details: {
      actual_start_time:
        task.assignment.started_at || task.schedule.start_datetime,
      actual_end_time:
        task.assignment.completed_at || task.schedule.end_datetime,
      actual_duration_hours: task.schedule.duration_hours,
      break_duration_minutes: task.schedule.break_duration_minutes,
    },
    payment_info: {
      agreed_rate: task.compensation.hourly_rate,
      actual_hours: task.schedule.duration_hours,
      total_amount: task.compensation.total_amount,
      currency: task.compensation.currency,
      payment_method: task.compensation.payment_method,
    },
    completion_status: "completed",
  };

  const [workHistory] = await WorkHistory.create([doc], { session });
  logger.info(
    `Successfully created WorkHistory record ${workHistory._id} for Task ${task._id}`
  );

  return workHistory;
}

async function listForClinic(clinicId, pagination = {}) {
  const { page = 1, limit = 20 } = pagination;
  const query = { clinic_id: clinicId };

  const histories = await WorkHistory.find(query)
    .populate("assistant_id", "first_name last_name")
    .populate("task_id", "title schedule.start_datetime")
    .sort({ "work_details.actual_start_time": -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await WorkHistory.countDocuments(query);

  return { data: histories, total, page, pages: Math.ceil(total / limit) };
}

async function listForAssistant(assistantId, pagination = {}) {
  const { page = 1, limit = 20 } = pagination;
  const query = { assistant_id: assistantId };

  const histories = await WorkHistory.find(query)
    .populate("clinic_id", "clinic_name")
    .populate("task_id", "title schedule.start_datetime")
    .sort({ "work_details.actual_start_time": -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await WorkHistory.countDocuments(query);

  return { data: histories, total, page, pages: Math.ceil(total / limit) };
}

module.exports = {
  createFromTask,
  listForClinic,
  listForAssistant,
};