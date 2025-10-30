const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    clinic_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },

    title: { type: String, required: true, trim: true, maxlength: 100 },


    requirements: {
      certification_level: {
        type: String,
        enum: ["Level_I", "Level_II", "HARP"],
        required: false,
      },
      minimum_experience: { type: Number, min: 0, default: 0 },
      required_specializations: [
        {
          type: String,
          enum: [
            "Chairside Assisting",
            "Dental Radiography",
            "Infection Control",
            "Preventive Dentistry",
            "Orthodontic Assisting",
            "Surgical Assisting",
            "Pediatric Assisting",
            "Laboratory Procedures",
            "Administrative Tasks",
          ],
        },
      ],
      preferred_skills: [String],
    },

    schedule: {
      start_datetime: { type: Date, required: true },
      end_datetime: { type: Date, required: true },
      duration_hours: { type: Number, min: 0.5, max: 12, required: true },
      break_duration_minutes: { type: Number, default: 30 },
    },

    compensation: {
      hourly_rate: { type: Number },
      percentage_pay: { 
        percentage: { type: Number},
        pay_type: { type: String, enum: ["collection", "production"]}
      },
      currency: { type: String, default: "CAD" },
      total_amount: Number,
      payment_method: {
        type: String,
        enum: ["Cash", "E-transfer", "Cheque", "Direct Deposit"],
        default: "E-transfer",
      },
      payment_terms: {
        type: String,
        enum: ["Immediate", "Same Day", "Next Day", "Weekly", "Bi-weekly"],
        default: "Same Day",
      },
    },

    status: {
      type: String,
      enum: [
        "draft",
        "open",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      default: "open",
    },

    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },

    assignment: {
      assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      assigned_at: Date,
      accepted_at: Date,
      started_at: Date,
      completed_at: Date,
    },

    location_details: {
      specific_instructions: String,
      parking_info: String,
      entrance_info: String,
      contact_person: {
        name: String,
        phone: String,
        role: String,
      },
    },

    applications_count: { type: Number, default: 0 },
    max_applications: { type: Number, default: 10 },
    auto_assign: { type: Boolean, default: false },
    requires_background_check: { type: Boolean, default: true },

    application_deadline: Date,
    posted_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },

    cancellation_reason: String,

    feedback: {
      clinic_rating: { type: Number, min: 1, max: 5 },
      assistant_rating: { type: Number, min: 1, max: 5 },
      clinic_comments: String,
      assistant_comments: String,
    },
  },
  { timestamps: true }
);

taskSchema.index({ clinic_id: 1, status: 1 });
taskSchema.index({ status: 1, "schedule.start_datetime": 1 });
taskSchema.index({ "requirements.certification_level": 1, status: 1 });
taskSchema.index({ priority: 1, "schedule.start_datetime": 1 });
taskSchema.index({ posted_at: -1 });

const Task = mongoose.model("Task", taskSchema);
module.exports = Task;
