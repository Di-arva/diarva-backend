const mongoose = require("mongoose");

const clinicSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    clinic_name: { type: String, required: true, trim: true, maxlength: 100 },
    business_number: { type: String, unique: true, sparse: true },

    address: {
      street: { type: String, required: true, trim: true },
      unit: { type: String, trim: true },
      city: { type: String, required: true, trim: true },
      province: {
        type: String,
        required: true,
        enum: [
          "AB", "BC", "MB", "NB", "NL", "NS", "ON",
          "PE", "QC", "SK", "NT", "NU", "YT",
        ],
      },
      postal_code: {
        type: String,
        required: true,
        uppercase: true,
        match: [/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, "Invalid postal code"],
      },
      coordinates: {
        latitude: { type: Number, min: -90, max: 90 },
        longitude: { type: Number, min: -180, max: 180 },
      },
    },

    contact: {
      phone: { type: String, required: true },
      fax: { type: String },
      website: { type: String },
    },

    operating_hours: [
      {
        day: { type: Number, min: 0, max: 6, required: true },
        is_open: { type: Boolean, default: true },
        open_time: {
          type: String,
          match: [/^([^01]?\d|2[0-3]):[0-5]\d$/, "Invalid time format"],
          required: function () {
            return this.is_open;
          },
        },
        close_time: {
          type: String,
          match: [/^([^01]?\d|2[0-3]):[0-5]\d$/, "Invalid time format"],
          required: function () {
            return this.is_open;
          },
        },
      },
    ],

    specializations: [
      {
        type: String,
        enum: [
          "General Dentistry",
          "Orthodontics",
          "Periodontics",
          "Endodontics",
          "Oral Surgery",
          "Pediatric Dentistry",
          "Prosthodontics",
          "Oral Pathology",
          "Cosmetic Dentistry",
        ],
      },
    ],

    payment_methods: [
      { type: String, enum: ["Cash", "Credit Card", "Debit Card", "Insurance", "E-transfer"] },
    ],

    rating: {
      average: { type: Number, min: 0, max: 5, default: 0 },
      count: { type: Number, default: 0 },
    },

    verification_status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },

    license_info: {
      license_number: String,
      issuing_province: String,
      expiry_date: Date,
      verification_documents: [String],
    },

    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

clinicSchema.index({ "address.city": 1, "address.province": 1 });
clinicSchema.index({ is_active: 1, verification_status: 1 });
clinicSchema.index({ "address.coordinates": "2dsphere" });

const Clinic = mongoose.model("Clinic", clinicSchema);
module.exports = Clinic;