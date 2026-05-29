const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    age: {
      type: Number,
      required: true
    },

    weight: {
      type: Number,
      required: true
    },

    cancerType: {
      type: String,
      required: true
    },

    stage: {
      type: String,
      required: true
    },

    treatmentStarted: {
      type: String,
      enum: ["Yes", "No"],
      default: "No"
    },

    treatments: [
  {
    type: {
      type: String
    },

    date: {
      type: String,
      default: () =>
        new Date().toLocaleDateString()
    },
    sentToPatient: {
      type: Boolean,
      default: false
    }
  }
],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    patientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    patientUsername: {
      type: String,
      required: true,
      unique: true
    },

    patientPassword: {
      type: String,
      required: true
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "Patient",
  patientSchema
);