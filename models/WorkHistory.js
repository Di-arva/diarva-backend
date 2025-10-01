const mongoose = require("mongoose");

const workHistorySchema = new mongoose.Schema(
  {
    task_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
      unique: true,
    },
    assistant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clinic_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },

    work_details: {
      actual_start_time: Date,
      actual_end_time: Date,
      actual_duration_hours: Number,
      break_duration_minutes: Number,
      work_performed: String,
      complications_notes: String,
    },

    payment_info: {
      agreed_rate: { type: Number, required: true },
      actual_hours: { type: Number, required: true },
      total_amount: { type: Number, required: true },
      currency: { type: String, default: "CAD" },
      payment_method: { type: String },
      payment_reference: { type: String }, // e.g., transaction ID
      taxes: {
        gst_hst: Number,
        pst: Number,
        total_tax: Number,
      },
    },

    confirmation_status: {
      assistant_confirmed: {
        status: { type: Boolean, default: false },
        confirmed_at: Date,
        signature: String, // could store digital signature / code
      },
      clinic_confirmed: {
        status: { type: Boolean, default: false },
        confirmed_at: Date,
        confirmed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        signature: String,
      },
      payment_confirmed: {
        status: { type: Boolean, default: false },
        confirmed_at: Date,
        payment_proof: String,
      },
    },

    performance_review: {
      clinic_rating: {
        overall: { type: Number, min: 1, max: 5 },
        punctuality: { type: Number, min: 1, max: 5 },
        professionalism: { type: Number, min: 1, max: 5 },
        technical_skills: { type: Number, min: 1, max: 5 },
        communication: { type: Number, min: 1, max: 5 },
        comments: String,
        would_hire_again: Boolean,
      },
      assistant_rating: {
        overall: { type: Number, min: 1, max: 5 },
        work_environment: { type: Number, min: 1, max: 5 },
        communication: { type: Number, min: 1, max: 5 },
        payment_promptness: { type: Number, min: 1, max: 5 },
        would_work_again: Boolean,
        comments: String,
      },
    },

    disputes: [
      {
        raised_by: { type: String, enum: ["assistant", "clinic"] },
        dispute_type: {
          type: String,
          enum: ["payment", "hours", "performance", "no_show", "other"],
        },
        description: String,
        raised_at: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["open", "under_review", "resolved", "escalated"],
          default: "open",
        },
        resolution: String,
        resolved_at: Date,
      },
    ],

    completion_status: {
      type: String,
      enum: ["completed", "incomplete", "cancelled", "no_show"],
      required: true,
      default: "completed",
    },
  },
  { timestamps: true }
);

workHistorySchema.index({ assistant_id: 1, created_at: -1 });
workHistorySchema.index({ clinic_id: 1, created_at: -1 });
workHistorySchema.index({ "confirmation_status.payment_confirmed.status": 1 });

const WorkHistory = mongoose.model("WorkHistory", workHistorySchema);
module.exports = WorkHistory;