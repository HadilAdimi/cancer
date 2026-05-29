const User = require("../models/User");
const Patient = require("../models/Patient");

const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  const { username, password } = req.body;
  
  console.log("Login attempt for:", username);

  try {
    // Check User collection first
    let user = await User.findOne({ username });

    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(400).json({ message: "Wrong password" });
      }

      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.json({
        token,
        role: user.role
      });
    }

    // Check Patient collection
    let patient = await Patient.findOne({ patientUsername: username });

    if (patient) {
      const isMatch = await bcrypt.compare(password, patient.patientPassword);

      if (!isMatch) {
        return res.status(400).json({ message: "Wrong password" });
      }

      // FIX: Use patient._id (the Patient document ID)
      const token = jwt.sign(
        { id: patientUser._id, role: "patient" },  // This should be patient._id
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      console.log("Patient found - _id:", patient._id); // Debug log
      console.log("Token created with id:", patient._id);

      return res.json({
        token,
        role: "patient"
      });
    }

    return res.status(400).json({
      message: "User not found"
    });
    
  } catch (error) {
    console.log("Login error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};