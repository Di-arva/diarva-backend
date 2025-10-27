const mongoose = require("mongoose");

const assistantProfileSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    professional_info: {
      certificates: { type: [String], default: [] },
      certification_level: {
        type: String,
        required: true,
      },
      provincial_licenses: [
        {
          province: {
            type: String,
            enum: [
              "AB", "BC", "MB", "NB", "NL", "NS", "ON",
              "PE", "QC", "SK", "NT", "NU", "YT",
            ],
          },
          license_number: String,
          expiry_date: Date,
          status: {
            type: String,
            enum: ["active", "expired", "suspended"],
            default: "active",
          },
        },
      ],
      experience_years: { type: Number, min: 0, max: 50, required: true },
      specializations: [
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
            "Hygenist"
          ],
        },
      ],
    },

    work_preferences: {
      hourly_rate: {
        min: { type: Number},
        max: { type: Number},
      },
      currency: { type: String, default: "CAD" },
      travel_radius_km: { type: Number, min: 5, max: 100, default: 25 },
      preferred_work_types: [
        {
          type: String,
          enum: ["Full-time", "Part-time", "Temporary", "Contract", "Emergency"],
        },
      ],
      minimum_hours_per_shift: { type: Number, min: 1, max: 12, default: 4 },
    },

    availability: [
      {
        day_of_week: { type: Number, min: 0, max: 6, required: true },
        is_available: { type: Boolean, default: true },
        time_slots: [
          {
            start_time: {
              type: String,
              match: [/^([^01]?\d|2[0-3]):[0-5]\d$/, "Invalid time format"],
              required: true,
            },
            end_time: {
              type: String,
              match: [/^([^01]?\d|2[0-3]):[0-5]\d$/, "Invalid time format"],
              required: true,
            },
          },
        ],
      },
    ],

    unavailable_dates: [
      {
        start_date: { type: Date, required: true },
        end_date: { type: Date, required: true },
        reason: String,
      },
    ],

    performance_metrics: {
      rating: {
        average: { type: Number, min: 0, max: 5, default: 0 },
        count: { type: Number, default: 0 },
      },
      completed_tasks: { type: Number, default: 0 },
      no_show_count: { type: Number, default: 0 },
      punctuality_score: { type: Number, min: 0, max: 100, default: 100 },
      reliability_score: { type: Number, min: 0, max: 100, default: 100 },
    },

    background_check: {
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "expired"],
        default: "pending",
      },
      completed_date: Date,
      expiry_date: Date,
      report_id: String,
    },

    emergency_contact: {
      name: String,
      relationship: String,
      phone: String,
      email: String,
    },

    is_active: { type: Boolean, default: true },

    profile_completion: { type: Number, min: 0, max: 100, default: 0 },
  },
  { timestamps: true }
);

assistantProfileSchema.index(
  { "professional_info.certification_level": 1, is_active: 1 }
);
assistantProfileSchema.index({ "performance_metrics.rating.average": -1 });
assistantProfileSchema.index({
  "work_preferences.hourly_rate.min": 1,
  "work_preferences.hourly_rate.max": 1,
});

const AssistantProfile = mongoose.model("AssistantProfile", assistantProfileSchema);
module.exports = AssistantProfile;