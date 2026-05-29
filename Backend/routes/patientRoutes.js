const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const role = require("../middleware/role");

const Patient = require("../models/Patient");
const Message = require("../models/Message");
const Report = require("../models/Report");

const {
  addPatient,
  getMyPatients,
  getAllPatients,
  updatePatient,
  deletePatient,
  getPatientProfile,
  addTreatment,
  updateTreatment,
  deleteTreatment,
  sendTreatmentToPatient
} = require("../controllers/patientController");


router.get(
  "/profile/me",
  auth,
  role("patient"),
  getPatientProfile
);


router.get("/messages/patient", auth, role("patient"), async (req, res) => {
  try {
    console.log("=== GET /messages/patient ===");
    console.log("req.user:", req.user);
    
    let patient;
    
    // Try to find by _id first
    patient = await Patient.findById(req.user.id);
    console.log("Found by _id:", patient ? patient.name : "No");
    
    // If not found, try by patientUserId
    if (!patient) {
      patient = await Patient.findOne({ patientUserId: req.user.id });
      console.log("Found by patientUserId:", patient ? patient.name : "No");
    }
    
    if (!patient) {
      console.log("Patient not found for user:", req.user.id);
      return res.status(404).json({ message: "Patient not found" });
    }
    
    console.log("Patient found:", patient.name, "ID:", patient._id);
    
    const messages = await Message.find({
      patientId: patient._id
    }).sort({ createdAt: 1 });
    
    console.log("Messages found:", messages.length);
    
    res.json(messages);
  } catch (err) {
    console.error("Error in GET /messages/patient:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});



router.post("/messages/patient", auth, role("patient"), async (req, res) => {
  try {
    console.log("=== POST /messages/patient ===");
    console.log("req.user:", req.user);
    console.log("req.body:", req.body);
    
    let patient;
    
    patient = await Patient.findById(req.user.id);
    console.log("Found by _id:", patient ? patient.name : "No");
    
    if (!patient) {
      patient = await Patient.findOne({ patientUserId: req.user.id });
      console.log("Found by patientUserId:", patient ? patient.name : "No");
    }
    
    if (!patient) {
      console.log("Patient not found for user:", req.user.id);
      return res.status(404).json({ message: "Patient profile not found" });
    }
    
    console.log("Patient found:", patient.name);
    console.log("Patient doctorId:", patient.doctorId);
    
    if (!patient.doctorId) {
      console.log("Patient has no doctor assigned");
      return res.status(400).json({ message: "No doctor assigned to this patient" });
    }
    
    const message = new Message({
      patientId: patient._id,
      doctorId: patient.doctorId,
      sender: "patient",
      text: req.body.text
    });
    
    await message.save();
    console.log("Message saved:", message._id);
    
    res.json(message);
  } catch (err) {
    console.error("Error in POST /messages/patient:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});





router.put("/messages/:messageId/read", auth, async (req, res) => {
  try {
    await Message.findByIdAndUpdate(req.params.messageId, { read: true });
    res.json({ message: "Message marked as read" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});




router.get("/messages/unread-counts", auth, role("doctor"), async (req, res) => {
  try {
    const patients = await Patient.find({ doctorId: req.user.id });
    
    const unreadCounts = {};
    
    for (const patient of patients) {
      const count = await Message.countDocuments({
        patientId: patient._id,
        sender: "patient",
        read: false
      });
      unreadCounts[patient._id] = count;
    }
    
    res.json(unreadCounts);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/messages/doctor/:patientId", auth, role("doctor"), async (req, res) => {
  try {
    const messages = await Message.find({
      patientId: req.params.patientId
    }).sort({ createdAt: 1 });
    
    res.json(messages);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});


router.put("/messages/doctor/:patientId/read", auth, role("doctor"), async (req, res) => {
  try {
    await Message.updateMany(
      {
        patientId: req.params.patientId,
        sender: "patient",
        read: false
      },
      { read: true }
    );
    
    res.json({ message: "Messages marked as read" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/messages/doctor/:patientId", auth, role("doctor"), async (req, res) => {
  try {
    const message = new Message({
      patientId: req.params.patientId,
      doctorId: req.user.id,
      sender: "doctor",
      text: req.body.text
    });
    
    await message.save();
    res.json({ message: "Reply sent", data: message });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id/treatment/:treatmentId/send", auth, role("doctor"), sendTreatmentToPatient);


router.get("/:id/treatments", auth, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    res.json(patient.treatments || []);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/treatment", auth, role("doctor"), addTreatment);

router.put("/:id/treatment/:treatmentId", auth, role("doctor"), updateTreatment);

router.delete("/:id/treatment/:treatmentId", auth, role("doctor"), deleteTreatment);



router.post("/", auth, role("doctor"), addPatient);

router.get("/my-patients", auth, role("doctor"), getMyPatients);

router.get("/", auth, role("admin"), getAllPatients);

router.put("/:id", auth, role("doctor"), updatePatient);

router.delete("/:id", auth, role("doctor"), deletePatient);


router.get("/reports/:patientId", auth, async (req, res) => {
  try {
    const reports = await Report.find({
      patientId: req.params.patientId
    }).sort({ createdAt: -1 });

    res.json(reports);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;