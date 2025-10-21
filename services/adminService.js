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
    if (user.role === 'assistant') {
        profile = await AssistantProfile.findOne({ user_id: userId }).lean();
    } else if (user.role === 'clinic') {
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

module.exports = {
    listUsers,
    getUserDetails,
    setUserStatus,
};