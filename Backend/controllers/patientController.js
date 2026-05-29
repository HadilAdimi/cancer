const Patient = require("../models/Patient");

const User = require("../models/User");

const bcrypt = require("bcryptjs");


// doctor adds patient
exports.addPatient = async (req, res) => {
  try {
    const {
      name,
      age,
      weight,
      cancerType,
      stage,
      treatmentStarted,
      patientUsername,
      patientPassword
    } = req.body;

    // Check if username already exists
    const existingUser = await User.findOne({
      username: patientUsername
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Username already exists"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(patientPassword, 10);

    // Create patient user account
    const patientUser = new User({
      username: patientUsername,
      password: hashedPassword,
      role: "patient"
    });

    await patientUser.save();
    
    console.log("Created patient user with ID:", patientUser._id);
    console.log("Doctor ID (req.user.id):", req.user.id);

    // Create patient profile - MAKE SURE doctorId is included
    const newPatient = new Patient({
      name,
      age,
      weight,
      cancerType,
      stage,
      treatmentStarted,
      createdBy: req.user.id,
      doctorId: req.user.id,  // ← This is CRITICAL for messages
      patientUserId: patientUser._id,
      patientUsername,
      patientPassword: hashedPassword
    });

    await newPatient.save();
    
    console.log("Created patient profile with ID:", newPatient._id);
    console.log("doctorId saved as:", newPatient.doctorId);

    res.json({
      message: "Patient added successfully",
      patientId: newPatient._id,
      userId: patientUser._id
    });

  } catch (error) {
    console.log("Error adding patient:", error);
    res.status(500).json({
      message: "Error adding patient",
      error: error.message
    });
  }
};

// get patients of logged doctor
exports.getMyPatients = async (req, res) => {

  try {

    const patients = await Patient.find({
      createdBy: req.user.id
    });

    res.json(patients);

  } catch (error) {

    res.status(500).json({
      message: "Error fetching patients"
    });
  }
};


// admin gets all patients
exports.getAllPatients = async (req, res) => {

  try {

    const patients = await Patient.find()
      .populate("createdBy", "username");

    const formattedPatients = patients.map(
      (patient) => ({
        ...patient._doc,
        createdBy: patient.createdBy.username
      })
    );

    res.json(formattedPatients);

  } catch (error) {

    res.status(500).json({
      message: "Error fetching patients"
    });
  }
};



exports.updatePatient = async (req, res) => {

  try {

    const patient = await Patient.findById(req.params.id);

    if (!patient) {

      return res.status(404).json({
        message: "Patient not found"
      });
    }

    const {
      name,
      age,
      weight,
      cancerType,
      stage,
      treatmentStarted,
      patientUsername,
      patientPassword
    } = req.body;

    patient.name = name;
    patient.age = age;
    patient.weight = weight;
    patient.cancerType = cancerType;
    patient.stage = stage;
    patient.treatmentStarted = treatmentStarted;

    if (patientUsername) {
      patient.patientUsername = patientUsername;
    }

    if (patientPassword) {
      patient.patientPassword = await bcrypt.hash(
        patientPassword,
        10
      );
    }

    await patient.save();

    res.json({
      message: "Patient updated and login synced"
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Error updating patient"
    });
  }
};


// delete patient
exports.deletePatient = async (req, res) => {

  try {

    const patient = await Patient.findById(
      req.params.id
    );

    if (!patient) {

      return res.status(404).json({
        message: "Patient not found"
      });
    }

    // delete patient account
    await User.findByIdAndDelete(
      patient.patientUserId
    );

    // delete patient profile
    await Patient.findByIdAndDelete(
      req.params.id
    );

    res.json({
      message: "Patient deleted"
    });

  } catch (error) {

    res.status(500).json({
      message: "Error deleting patient"
    });
  }
};


// patient sees his own data
exports.getPatientProfile = async (req, res) => {
  try {
    console.log("getPatientProfile - req.user.id:", req.user.id);
    
    let patient;
    
    // First try to find by patientUserId (since token contains User ID)
    patient = await Patient.findOne({ patientUserId: req.user.id });
    
    // If not found, try by _id (for backward compatibility)
    if (!patient) {
      patient = await Patient.findById(req.user.id);
    }
    
    console.log("Found patient:", patient ? patient.name : "NO PATIENT FOUND");
    
    if (!patient) {
      return res.status(404).json({
        message: "Patient profile not found. Please contact your doctor."
      });
    }

    // Return patient data (excluding sensitive fields)
    res.json({
      _id: patient._id,
      name: patient.name,
      age: patient.age,
      weight: patient.weight,
      cancerType: patient.cancerType,
      stage: patient.stage,
      treatmentStarted: patient.treatmentStarted,
      treatments: patient.treatments || []
    });
    
  } catch (error) {
    console.log("Error in getPatientProfile:", error);
    res.status(500).json({
      message: "Error fetching profile",
      error: error.message
    });
  }
};


exports.addTreatment = async (req, res) => {

  console.log("treatment rout hit")

  try {

    const patient = await Patient.findById(
      req.params.id
    );

    patient.treatments.push({
      type: req.body.type,
      date: new Date().toLocaleString()
    });

    await patient.save();

    res.json({
      message: "Treatment added"
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Error adding treatment"
    });
  }
};


exports.updateTreatment = async (req, res) => {

  try {

    const patient = await Patient.findById(
      req.params.id
    );

    const treatment =
      patient.treatments.id(
        req.params.treatmentId
      );

    treatment.type = req.body.type;

    await patient.save();

    res.json({
      message: "Treatment updated"
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Error updating treatment"
    });
  }
};


exports.deleteTreatment = async (req, res) => {

  try {

    const patient = await Patient.findById(
      req.params.id
    );

    patient.treatments =
      patient.treatments.filter(
        (t) =>
          t._id.toString() !==
          req.params.treatmentId
      );

    await patient.save();

    res.json({
      message: "Treatment deleted"
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Error deleting treatment"
    });
  }
};

// send treatment to patient
exports.sendTreatmentToPatient = async (req, res) => {
  try {
    console.log("Sending treatment to patient");
    console.log("Patient ID:", req.params.id);
    console.log("Treatment ID:", req.params.treatmentId);
    
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      console.log("Patient not found");
      return res.status(404).json({ message: "Patient not found" });
    }
    
    const treatment = patient.treatments.id(req.params.treatmentId);
    
    if (!treatment) {
      console.log("Treatment not found");
      return res.status(404).json({ message: "Treatment not found" });
    }
    
    console.log("Treatment found:", treatment.type);
    
    treatment.sentToPatient = true;
    await patient.save();
    
    console.log("Treatment marked as sent to patient");
    
    res.json({ 
      message: "Treatment sent to patient",
      treatment: treatment
    });
  } catch (error) {
    console.log("Error in sendTreatmentToPatient:", error);
    res.status(500).json({ 
      message: "Error sending treatment",
      error: error.message 
    });
  }
};
