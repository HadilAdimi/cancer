const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({

  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient"
  },

  text: String,

  file: String,

  createdAt: {
    type: Date,
    default: Date.now
  },
  sendToPatient: {
    type: Boolean,
    default: false,
  },
    

},
{timestamps: true});

module.exports =
  mongoose.model("Report", reportSchema);