const express = require("express");

const router = express.Router();

const multer = require("multer");

const Report = require("../models/Report");
const auth = require("../middleware/auth");

const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {

    cb(
      null,
      Date.now() + "-" + file.originalname
    );
  }
});

const upload = multer({ storage });

router.post(
  "/",
  upload.single("file"),

  async (req, res) => {

    try {

      const report = new Report({

        patientId: req.body.patientId,

        text: req.body.text,

        file: req.file
          ? req.file.filename
          : ""
      });

      await report.save();

      res.json({
        message: "Report saved"
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message: "Server error"
      });
    }
  }
);

router.get(
  "/patient/:patientId",

  async (req, res) => {

    try {

      const reports = await Report.find({
        patientId: req.params.patientId
      }).sort({ createdAt: -1 });

      res.json(reports);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message: "Server error"
      });
    }
  }
);

router.delete("/:id", auth, async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);

    res.json({
      message: "Report deleted"
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.put("/:id/send", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        message: "Report not found",
      });
    }

    report.sendToPatient = true;
    await report.save();

    // Return the updated report
    res.json({
      message: "Report sent to patient",
      report: report  // Send back the updated report
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;