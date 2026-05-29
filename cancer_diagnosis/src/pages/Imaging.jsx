import { useState, useEffect } from "react";
import axios from "axios";
import "./Imaging.css";
import { useNavigate, useLocation } from "react-router-dom";
import jsPDF from "jspdf";

export default function Imaging() {

  const navigate = useNavigate();
  const location = useLocation();

  const [fromPage, setFromPage] = useState("researcher");

  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const userRole = localStorage.getItem("userRole");
    const from = location.state?.from || "researcher";
    
    // Check if user is doctor
    if (userRole === "doctor") {
      setFromPage("doctor");
    } else if (from === "doctor") {
      setFromPage("doctor");
    } else {
      setFromPage("researcher");
    }
  }, [location]);

  // Upload Image
  const handleImageChange = (e) => {

    const file = e.target.files[0];

    if (!file) return;

    setSelectedImage(file);

    setPreview(URL.createObjectURL(file));

    setResult(null);
  };

  // Run Prediction
  const handlePrediction = async () => {

    if (!selectedImage) {
      alert("Please upload an MRI or CT image");
      return;
    }

    setLoading(true);

    const formData = new FormData();

    formData.append("file", selectedImage);

    try {

      const res = await axios.post(
        "http://127.0.0.1:8000/predict-image",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );

      const prediction = res.data.class;
      const confidence = res.data.confidence;

      setResult({
        cancer: prediction,
        confidence: confidence.toFixed(2),
        status: prediction === "malignant"
          ? "High Risk"
          : "Low Risk"
      });

    } catch (err) {

      console.log(err);

      alert("Prediction failed");

    } finally {

      setLoading(false);
    }
  };

  // Download PDF Report
  const downloadPDF = () => {

    if (!result) return;

    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.text("Cancer Imaging Report", 20, 25);

    doc.setFontSize(14);

    doc.text(`Prediction: ${result.cancer}`, 20, 60);

    doc.text(`Confidence: ${result.confidence}%`, 20, 80);

    doc.text(`Risk Status: ${result.status}`, 20, 100);

    doc.save("imaging_report.pdf");
  };
  const handleBack = () => {
    if (fromPage === "doctor") {
      navigate("/doctor");
    } else {
      navigate("/researcher");
    }
  };

  return (

    <div className="imaging-page">

      <button
        className="back"
        onClick={handleBack}
      >
        Back
      </button>

      <div className="imaging-header">

        <h1>Imaging Cancer Detection</h1>

        <p>
          Upload MRI or CT scan images for AI analysis
        </p>

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

            <span>Choose MRI or CT Scan</span>

          </label>

          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="preview-image"
            />
          )}

          <button
            className="predict-btn"
            onClick={handlePrediction}
            disabled={loading}
          >
            {loading ? "Analyzing..." : "Run Detection"}
          </button>

        </div>

        {/* Result Section */}
        <div className="result-card">

          <h2>Prediction Result</h2>

          {!loading && !result && (
            <p>No prediction yet</p>
          )}

          {loading && (
            <div className="loader"></div>
          )}

          {result && (

            <div className="result-content">

              <div className="result-box">

                <h3>Prediction</h3>

                <p className="prediction">
                  {result.cancer}
                </p>

              </div>

              <div className="result-box">

                <h3>Confidence</h3>

                <p>
                  {result.confidence}%
                </p>

              </div>

              <div className="result-box">

                <h3>Status</h3>

                <p
                  className={
                    result.status === "High Risk"
                      ? "high-risk"
                      : "low-risk"
                  }
                >
                  {result.status}
                </p>

              </div>

              <button
                className="download-btn"
                onClick={downloadPDF}
              >
                Download Report
              </button>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}