const User = require("../models/User");
const AssistantProfile = require("../models/AssistantProfile");
const Clinic = require("../models/Clinic");
const logger = require("../config/logger");
const mongoose = require("mongoose");

async function listUsers(filters = {}, pagination = {}) {
  const { role, approval_status, is_active } = filters;
  const { page = 1, limit = 20, sort = { createdAt: -1 } } = pagination;

  const query = {};
  if (role) query.role = role;
  if (approval_status) query.approval_status = approval_status;
  if (is_active !== undefined) query.is_active = is_active;

  const skip = (page - 1) * limit;

  const users = await User.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .select("-password_hash -refresh_tokens -__v") // Exclude sensitive fields
    .lean();

  const total = await User.countDocuments(query);

  return {
    data: users,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

async function getUserDetails(userId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new Error("Invalid user ID format.");
  }

  const user = await User.findById(userId)
    .select("-password_hash -refresh_tokens -__v")
    .lean();

  if (!user) {
    return null;
  }

  let profile = null;
  if (user.role === "assistant") {
    profile = await AssistantProfile.findOne({ user_id: userId }).lean();
  } else if (user.role === "clinic") {
    profile = await Clinic.findOne({ user_id: userId }).lean();
  }

  return { user, profile };
}

async function setUserStatus(userId, isActive, adminId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new Error("Invalid user ID format.");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  if (user._id.toString() === adminId) {
    throw new Error("Admins cannot change their own status.");
  }

  user.is_active = isActive;
  await user.save();

  logger.info({
    msg: `User status updated by admin`,
    userId,
    newStatus: isActive,
    adminId,
  });

  return { userId: user._id, isActive: user.is_active };
}

async function getAnalytics() {
  logger.info("Fetching admin analytics dashboard data.");

  const userCounts = await User.aggregate([
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);

  const userApprovalCounts = await User.aggregate([
    { $group: { _id: "$approval_status", count: { $sum: 1 } } },
  ]);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newUsersLast30Days = await User.countDocuments({
    createdAt: { $gte: thirtyDaysAgo },
  });

  const taskCounts = await Task.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const analytics = {
    users: {
      total: userCounts.reduce((acc, curr) => acc + curr.count, 0),
      byRole: userCounts.reduce(
        (acc, curr) => ({ ...acc, [curr._id]: curr.count }),
        {}
      ),
      byApprovalStatus: userApprovalCounts.reduce(
        (acc, curr) => ({ ...acc, [curr._id]: curr.count }),
        {}
      ),
      newLast30Days: newUsersLast30Days,
    },
    tasks: {
      total: taskCounts.reduce((acc, curr) => acc + curr.count, 0),
      byStatus: taskCounts.reduce(
        (acc, curr) => ({ ...acc, [curr._id]: curr.count }),
        {}
      ),
    },
  };

  return analytics;
}

module.exports = {
  listUsers,
  getUserDetails,
  setUserStatus,
  getAnalytics,
};