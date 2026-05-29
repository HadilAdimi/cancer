const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const Patient = require("../models/Patient");
const User = require("../models/User");
const Report = require("../models/Report");
const ResearchReport = require("../models/ResearchReport");

// Get all patients for research (with separate research ID and real ID for viewing)
router.get("/patients", auth, role("researcher"), async (req, res) => {
  try {
    const patients = await Patient.find({})
      .select("_id name age cancerType stage treatmentStarted treatments createdAt")
      .lean();
    
    const patientsWithResearchId = patients.map(patient => ({
      researchId: `P-${patient._id.toString().slice(-8)}`,
      realId: patient._id,
      name: patient.name,
      age: patient.age,
      cancerType: patient.cancerType,
      stage: patient.stage,
      treatmentStarted: patient.treatmentStarted,
      treatmentsCount: patient.treatments?.length || 0
    }));
    
    res.json(patientsWithResearchId);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get research statistics
router.get("/statistics", auth, role("researcher"), async (req, res) => {
  try {
    const totalPatients = await Patient.countDocuments();
    const byCancerType = await Patient.aggregate([
      { $group: { _id: "$cancerType", count: { $sum: 1 } } }
    ]);
    const byStage = await Patient.aggregate([
      { $group: { _id: "$stage", count: { $sum: 1 } } }
    ]);
    const avgAge = await Patient.aggregate([
      { $group: { _id: null, avg: { $avg: "$age" } } }
    ]);
    
    res.json({
      totalPatients,
      byCancerType,
      byStage,
      averageAge: avgAge[0]?.avg || 0
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get doctor view data (read-only)
router.get("/doctor-view/:patientId", auth, role("researcher"), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId)
      .select("-patientPassword -patientUsername -patientUserId");
    
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    
    res.json(patient);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get patient view data (read-only)
router.get("/patient-view/:patientId", auth, role("researcher"), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId);
    
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    
    res.json({
      name: patient.name,
      age: patient.age,
      weight: patient.weight,
      cancerType: patient.cancerType,
      stage: patient.stage,
      treatmentStarted: patient.treatmentStarted,
      treatments: patient.treatments.filter(t => t.sentToPatient === true),
      _id: patient._id
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Export data for research
router.get("/export", auth, role("researcher"), async (req, res) => {
  try {
    const patients = await Patient.find({})
      .select("age cancerType stage treatmentStarted treatments createdAt");
    
    res.json({
      exportedAt: new Date(),
      totalRecords: patients.length,
      data: patients
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============ RESEARCH REPORTS CRUD ============

// Get all researcher reports
router.get("/reports", auth, role("researcher"), async (req, res) => {
  try {
    const reports = await ResearchReport.find({ 
      researcherId: req.user.id 
    }).sort({ createdAt: -1 });
    console.log("Fetched reports:", reports.length);
    res.json(reports);
  } catch (err) {
    console.log("Error fetching reports:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Create a new research report
router.post("/reports", auth, role("researcher"), async (req, res) => {
  try {
    console.log("Creating report with data:", req.body);
    const { title, cancerType, content, tags } = req.body;
    
    const report = new ResearchReport({
      title,
      cancerType,
      content,
      tags: tags || [],
      researcherId: req.user.id
    });
    
    await report.save();
    console.log("Report created:", report._id);
    res.json({ message: "Report created successfully", report });
  } catch (err) {
    console.log("Error creating report:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Update a research report
router.put("/reports/:id", auth, role("researcher"), async (req, res) => {
  try {
    console.log("Updating report:", req.params.id);
    const { title, cancerType, content, tags } = req.body;
    
    const report = await ResearchReport.findOneAndUpdate(
      { _id: req.params.id, researcherId: req.user.id },
      { title, cancerType, content, tags },
      { new: true }
    );
    
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    
    res.json({ message: "Report updated successfully", report });
  } catch (err) {
    console.log("Error updating report:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Delete a research report
router.delete("/reports/:id", auth, role("researcher"), async (req, res) => {
  try {
    console.log("Deleting report:", req.params.id);
    
    const report = await ResearchReport.findOneAndDelete({
      _id: req.params.id,
      researcherId: req.user.id
    });
    
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    
    res.json({ message: "Report deleted successfully" });
  } catch (err) {
    console.log("Error deleting report:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});
// Fetch research articles from PubMed
router.get("/pubmed-search", auth, role("researcher"), async (req, res) => {
  try {
    const query = req.query.q || "cancer research";
    const limit = parseInt(req.query.limit) || 12;
    
    console.log("Searching PubMed for:", query);
    
    // Step 1: Search for article IDs
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&sort=relevance&format=json`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.esearchresult?.idlist?.length) {
      return res.json({ articles: [] });
    }
    
    const articleIds = searchData.esearchresult.idlist.join(",");
    
    // Step 2: Fetch detailed article information
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${articleIds}&format=json`;
    
    const summaryResponse = await fetch(summaryUrl);
    const summaryData = await summaryResponse.json();
    
    // Step 3: Format the articles
    const articles = [];
    
    for (const [id, article] of Object.entries(summaryData.result)) {
      if (id === "uids") continue;
      
      // Get authors
      let authors = "Unknown";
      if (article.authors && article.authors.length > 0) {
        authors = article.authors.slice(0, 3).map(a => a.name).join(", ");
        if (article.authors.length > 3) authors += " et al.";
      }
      
      // Get publication date
      let year = "N/A";
      if (article.pubdate) {
        const yearMatch = article.pubdate.match(/\d{4}/);
        if (yearMatch) year = yearMatch[0];
      }
      
      articles.push({
        id: id,
        title: article.title || "Untitled",
        authors: authors,
        year: year,
        abstract: article.abstract || "Abstract not available",
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        source: "PubMed",
        journal: article.source || "Unknown Journal"
      });
    }
    
    console.log(`Found ${articles.length} articles for query: ${query}`);
    res.json({ articles, count: articles.length, query });
    
  } catch (err) {
    console.error("Error fetching PubMed articles:", err);
    res.status(500).json({ 
      message: "Error fetching research articles", 
      error: err.message,
      articles: []
    });
  }
});

module.exports = router;