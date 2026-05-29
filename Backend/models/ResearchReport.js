const mongoose = require("mongoose");

const researchReportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  cancerType: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  tags: [{
    type: String
  }],
  researcherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("ResearchReport", researchReportSchema);