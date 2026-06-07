import { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./Imaging.css";
import { useNavigate, useLocation } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function Imaging() {
  const navigate = useNavigate();
  const location = useLocation();
  const [fromPage, setFromPage] = useState("researcher");
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  
  const resultRef = useRef(null);
  
  const API_BASE_URL = "http://127.0.0.1:5000";

  useEffect(() => {
    const userRole = localStorage.getItem("userRole");
    const from = location.state?.from || "researcher";
    
    if (userRole === "doctor") {
      setFromPage("doctor");
    } else if (from === "doctor") {
      setFromPage("doctor");
    } else {
      setFromPage("researcher");
    }

    checkApiHealth();
  }, [location]);

  const checkApiHealth = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      setApiStatus({ status: "connected", data: response.data });
      console.log(" API connected:", response.data);
    } catch (err) {
      setApiStatus({ status: "disconnected", error: err.message });
      console.error(" API not reachable:", err);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Please upload an image smaller than 10MB.");
      return;
    }
    
    setSelectedImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
  };

  const handlePrediction = async () => {
    if (!selectedImage) {
      alert("Please upload an MRI or CT image");
      return;
    }

    if (!apiStatus || apiStatus.status !== "connected") {
      alert("AI API is not connected. Please start the API server.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("image", selectedImage);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/predict-imaging`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          },
          timeout: 30000
        }
      );

      const prediction = response.data;
      
      if (prediction.success) {
        setResult({
          prediction: prediction.prediction,
          confidence: prediction.confidence,
          risk: prediction.risk,
          heatmap: prediction.heatmap,
          message: prediction.message
        });
      } else {
        alert(`Prediction failed: ${prediction.error || "Unknown error"}`);
      }

    } catch (err) {
      console.error("Prediction error:", err);
      if (err.code === 'ECONNABORTED') {
        alert("Prediction timed out. Please try again.");
      } else if (err.response) {
        alert(`Prediction failed: ${err.response.data.detail || "Server error"}`);
      } else {
        alert("Prediction failed. Please check if the API server is running on port 5000.");
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
  if (!result) return;

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = 20;

  // Helper function to add a new page if needed
  const checkNewPage = (currentY, neededSpace = 30) => {
    if (currentY > 250) {
      pdf.addPage();
      return 20;
    }
    return currentY;
  };

  // ========== HEADER ==========
  pdf.setFillColor(10, 73, 83);
  pdf.rect(0, 0, pageWidth, 45, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.text("Cancer Imaging Report", pageWidth / 2, 25, { align: "center" });
  
  pdf.setFontSize(10);
  pdf.text(`Date: ${new Date().toLocaleString()}`, pageWidth - 20, 38, { align: "right" });
  pdf.text(`Report ID: IMG-${Date.now()}`, pageWidth - 20, 45, { align: "right" });

  // Reset text color
  pdf.setTextColor(0, 0, 0);
  y = 60;

  // ========== PATIENT INFORMATION ==========
  pdf.setFillColor(240, 248, 255);
  pdf.rect(15, y, pageWidth - 30, 35, "F");
  pdf.setFontSize(14);
  pdf.setTextColor(10, 73, 83);
  pdf.text("Patient Information", 20, y + 8);
  
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`Report generated for: Clinical Analysis`, 20, y + 20);
  pdf.text(`Test Date: ${new Date().toLocaleDateString()}`, 20, y + 28);
  
  y += 45;
  y = checkNewPage(y);

  // ========== ANALYSIS RESULTS SECTION ==========
  pdf.setFillColor(10, 73, 83);
  pdf.rect(15, y, pageWidth - 30, 12, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.text("Analysis Results", pageWidth / 2, y + 8, { align: "center" });
  
  y += 20;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(11);
  
  // Diagnosis - Label only (no background)
  pdf.text("Diagnosis:", 20, y + 8);
  pdf.setTextColor(result.prediction === "Cancer Detected" ? 220 : 40, 
                   result.prediction === "Cancer Detected" ? 53 : 167, 
                   result.prediction === "Cancer Detected" ? 69 : 69);
  pdf.setFont("helvetica", "bold");
  pdf.text(`${result.prediction}`, 75, y + 8);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont("helvetica", "normal");
  
  y += 18;
  
  // Confidence - Label only (no background)
  pdf.text("Confidence:", 20, y + 8);
  // Color the confidence value based on percentage
  let confidenceColor;
  if (result.confidence >= 80) confidenceColor = [40, 167, 69]; // Green for high confidence
  else if (result.confidence >= 60) confidenceColor = [255, 193, 7]; // Yellow/Orange for medium
  else confidenceColor = [220, 53, 69]; // Red for low confidence
  pdf.setTextColor(confidenceColor[0], confidenceColor[1], confidenceColor[2]);
  pdf.setFont("helvetica", "bold");
  pdf.text(`${result.confidence}%`, 75, y + 8);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont("helvetica", "normal");
  
  y += 18;
  
  // Risk Level - Label only (no background)
  pdf.text("Risk Level:", 20, y + 8);
  // Color the risk level text
  pdf.setTextColor(result.risk === "High Risk" ? 220 : 40, 
                   result.risk === "High Risk" ? 53 : 167, 
                   result.risk === "High Risk" ? 69 : 69);
  pdf.setFont("helvetica", "bold");
  pdf.text(`${result.risk}`, 75, y + 8);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont("helvetica", "normal");
  
  y += 25;
  y = checkNewPage(y);

  // ========== HEATMAP / DETECTED IMAGE ==========
  if (result.heatmap) {
    pdf.setFillColor(10, 73, 83);
    pdf.rect(15, y, pageWidth - 30, 12, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.text("AI Detection Visualization", pageWidth / 2, y + 8, { align: "center" });
    
    y += 18;
    
    // Create an image element from base64
    const heatmapImg = new Image();
    heatmapImg.src = `data:image/jpeg;base64,${result.heatmap}`;
    
    await new Promise((resolve) => {
      heatmapImg.onload = () => {
        const imgWidth = 100;
        const imgHeight = (heatmapImg.height / heatmapImg.width) * imgWidth;
        const imgX = (pageWidth - imgWidth) / 2;
        
        pdf.addImage(heatmapImg, "JPEG", imgX, y, imgWidth, imgHeight);
        resolve();
      };
      if (heatmapImg.complete) {
        const imgWidth = 100;
        const imgHeight = (heatmapImg.height / heatmapImg.width) * imgWidth;
        const imgX = (pageWidth - imgWidth) / 2;
        pdf.addImage(heatmapImg, "JPEG", imgX, y, imgWidth, imgHeight);
        resolve();
      }
    });
    
    y += 80;
    
    pdf.setFontSize(9);
    pdf.setTextColor(128, 128, 128);
    pdf.text("Red boxes indicate suspicious areas detected by the AI model", pageWidth / 2, y + 5, { align: "center" });
    
    y += 20;
    y = checkNewPage(y);
  }

  // ========== RECOMMENDATION SECTION ==========
  pdf.setFillColor(10, 73, 83);
  pdf.rect(15, y, pageWidth - 30, 12, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.text("Clinical Recommendation", pageWidth / 2, y + 8, { align: "center" });
  
  y += 18;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10);
  
  let recommendation = "";
  if (result.prediction === "Cancer Detected") {
    recommendation = "Immediate clinical consultation and further diagnostic tests are recommended. Please consult with an oncologist for proper evaluation. A biopsy may be necessary to confirm the diagnosis and determine the specific cancer type and grade.";
  } else {
    recommendation = "No immediate concerns detected. Continue with regular screening and healthy lifestyle. Follow up as recommended by your healthcare provider. Maintain regular check-ups and monitor for any changes in symptoms.";
  }
  
  const recommendationLines = pdf.splitTextToSize(recommendation, pageWidth - 40);
  pdf.text(recommendationLines, 20, y);
  
  y += recommendationLines.length * 6 + 15;
  y = checkNewPage(y);

  // ========== DETAILED METRICS ==========
  pdf.setFillColor(10, 73, 83);
  pdf.rect(15, y, pageWidth - 30, 12, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.text("Detailed Metrics", pageWidth / 2, y + 8, { align: "center" });
  
  y += 18;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10);
  
  // Create a metrics table with alternating row colors (light gray for even rows)
  const metrics = [
    ["Analysis Type", "Imaging Cancer Detection"],
    ["AI Model", "ResNet50 with Grad-CAM"],
    ["Input Size", "224 x 224 pixels"],
    ["Confidence Score", `${result.confidence}%`],
    ["Risk Assessment", result.risk],
    ["Analysis Date", new Date().toLocaleString()],
    ["Report Version", "1.0"]
  ];
  
  let rowY = y;
  for (let i = 0; i < metrics.length; i++) {
    // Only add background for even rows (light gray for better readability)
    if (i % 2 === 0) {
      pdf.setFillColor(248, 248, 248);
      pdf.rect(20, rowY, pageWidth - 40, 8, "F");
    }
    pdf.setFont("helvetica", "bold");
    pdf.text(metrics[i][0], 22, rowY + 5);
    pdf.setFont("helvetica", "normal");
    
    // Color specific metrics
    if (metrics[i][0] === "Confidence Score") {
      let confColor;
      if (result.confidence >= 80) confColor = [40, 167, 69];
      else if (result.confidence >= 60) confColor = [255, 193, 7];
      else confColor = [220, 53, 69];
      pdf.setTextColor(confColor[0], confColor[1], confColor[2]);
      pdf.setFont("helvetica", "bold");
      pdf.text(metrics[i][1], 90, rowY + 5);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
    } else if (metrics[i][0] === "Risk Assessment") {
      pdf.setTextColor(result.risk === "High Risk" ? 220 : 40, 
                       result.risk === "High Risk" ? 53 : 167, 
                       result.risk === "High Risk" ? 69 : 69);
      pdf.setFont("helvetica", "bold");
      pdf.text(metrics[i][1], 90, rowY + 5);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
    } else {
      pdf.text(metrics[i][1], 90, rowY + 5);
    }
    rowY += 9;
  }
  
  y = rowY + 15;

  // ========== FOOTER ==========
  if (y > 260) {
    pdf.addPage();
    y = 20;
  }
  
  pdf.setFillColor(10, 73, 83);
  pdf.rect(0, 280, pageWidth, 20, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.text("This report is AI-generated and should be reviewed by a medical professional.", pageWidth / 2, 288, { align: "center" });
  pdf.text("MedIntel Imaging Analysis System", pageWidth / 2, 295, { align: "center" });
  
  // Save the PDF
  pdf.save(`imaging_report_${Date.now()}.pdf`);
};

  const handleBack = () => {
    if (fromPage === "doctor") {
      navigate("/doctor");
    } else {
      navigate("/researcher");
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setPreview(null);
    setResult(null);
  };

  return (
    <div className="imaging-page">
      <button className="back" onClick={handleBack}>
        Back 
      </button>

      <div className="imaging-header">
        <h1>Imaging Cancer Detection</h1>
        <p>Upload MRI or CT scan images for AI analysis with cancer area highlighting</p>
        
        
      </div>

      <div className="imaging-container">
        {/* Upload Section */}
        <div className="upload-card">
          <h2>Upload Medical Image</h2>
          
          <label className="upload-box">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              hidden
            />
            <div className="upload-icon">📁</div>
            <span>
              {selectedImage ? selectedImage.name : "Choose MRI or CT Scan (max 10MB)"}
            </span>
          </label>

          {preview && (
            <div className="preview-container">
              <img src={preview} alt="Preview" className="preview-image" />
              <button className="remove-btn" onClick={handleReset}>✕</button>
            </div>
          )}

          <button
            className="predict-btn"
            onClick={handlePrediction}
            disabled={loading || !selectedImage || (apiStatus?.status !== "connected")}
          >
            {loading ? "Analyzing with AI..." : "Run Cancer Detection"}
          </button>
        </div>

        {/* Result Section */}
        <div className="result-card">
          <h2>Analysis Results</h2>

          {!loading && !result && (
            <div className="no-result">
              <p>No analysis yet</p>
              <p className="hint">Upload an image and click "Run Cancer Detection"</p>
            </div>
          )}

          {loading && (
            <div className="loading-container">
              <div className="loader"></div>
              <p>Analyzing image with imaging AI Model...</p>
            </div>
          )}

          {result && (
            <div className="result-content">
              {result.heatmap && (
                <div className="visualization-section">
                  <h3>Cancer Area Detection</h3>
                  <div className="visualization-container">
                    <img 
                      src={`data:image/jpeg;base64,${result.heatmap}`}
                      alt="Cancer detection heatmap"
                      className="visualization-image"
                    />
                  </div>
                  <p className="viz-caption">🔴 Red boxes indicate suspicious areas detected by AI</p>
                </div>
              )}

              <div className="diagnosis-section">
                <div className="result-box">
                  <h3>Diagnosis</h3>
                  <p className={`prediction ${result.prediction === "Cancer Detected" ? "cancer-detected" : "normal"}`}>
                    {result.prediction}
                  </p>
                </div>

                <div className="result-box">
                  <h3>Confidence</h3>
                  <p className="confidence">{result.confidence}%</p>
                  <div className="confidence-bar">
                    <div className="confidence-fill" style={{ width: `${result.confidence}%` }}></div>
                  </div>
                </div>

                <div className="result-box">
                  <h3>Risk Level</h3>
                  <p className={`risk-level ${result.risk === "High Risk" ? "high-risk" : "low-risk"}`}>
                    {result.risk}
                  </p>
                </div>
              </div>

              <div className="recommendation-box">
                <h3>Clinical Recommendation</h3>
                <p>
                  {result.prediction === "Cancer Detected" 
                    ? "Immediate clinical consultation and further diagnostic tests are recommended."
                    : "No immediate concerns detected. Continue with regular screening."}
                </p>
              </div>

              <button className="downlbtn" onClick={downloadPDF}>
                Download PDF Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}