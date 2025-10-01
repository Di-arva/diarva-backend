const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    task_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    applicant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clinic_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },

    application_message: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    proposed_rate: {
      type: Number,
      min: 15,
      max: 100,
    },

    availability_confirmation: {
      type: Boolean,
      required: true,
      default: true,
    },

    status: {
      type: String,
      enum: ["pending", "under_review", "accepted", "rejected", "withdrawn"],
      default: "pending",
    },

    review_notes: String,

    applied_at: { type: Date, default: Date.now },
    reviewed_at: Date,
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    response_deadline: Date,

    auto_match_score: { type: Number, min: 0, max: 100 },
    match_criteria: {
      location_score: Number,
      experience_score: Number,
      certification_score: Number,
      rating_score: Number,
      availability_score: Number,
    },
  },
  { timestamps: true }
);

applicationSchema.index({ task_id: 1, applicant_id: 1 }, { unique: true });
applicationSchema.index({ applicant_id: 1, status: 1, applied_at: -1 });
applicationSchema.index({ clinic_id: 1, status: 1, applied_at: -1 });
applicationSchema.index({ auto_match_score: -1 });

const Application = mongoose.model("Application", applicationSchema);
module.exports = Application;