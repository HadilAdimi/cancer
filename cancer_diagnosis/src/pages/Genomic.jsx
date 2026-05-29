import { useState, useEffect } from "react";
import "./Genomics.css";
import { useNavigate, useLocation } from "react-router-dom";

export default function Genomic() {

    const navigate = useNavigate();
    const location = useLocation();

    const [fromPage, setFromPage] = useState("researcher");

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

  const [dnaSequence, setDnaSequence] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handlePrediction = async () => {

    if (!dnaSequence.trim()) {
      alert("Enter DNA sequence");
      return;
    }

    setLoading(true);

    setTimeout(() => {

      setResult({
        mutation: "TP53 mutation detected",
        risk: "High Risk",
        confidence: "92%"
      });

      setLoading(false);

    }, 2000);
  };
  const handleBack = () => {
    if (fromPage === "doctor") {
      navigate("/doctor");
    } else {
      navigate("/researcher");
    }
  };

  return (
    <div className="genomic-page">

        <button className="back" onClick={handleBack}>
        Back
      </button>

      <div className="genomic-header">
        <h1>Genomic Cancer Detection</h1>
        <p>Analyze DNA sequences for mutation-based cancer risk</p>
      </div>

      <div className="genomic-container">

        <div className="input-card">

          <h2>DNA Sequence Input</h2>

          <textarea
            placeholder="Paste DNA sequence here..."
            value={dnaSequence}
            onChange={(e) => setDnaSequence(e.target.value)}
          />

          <button onClick={handlePrediction}>
            {loading ? "Analyzing..." : "Run Analysis"}
          </button>

        </div>

        <div className="result-card">

          <h2>Prediction Result</h2>

          {!result && !loading && (
            <p>No analysis yet</p>
          )}

          {loading && (
            <div className="loader"></div>
          )}

          {result && (
            <div className="result-content">

              <div className="item">
                <span>Mutation</span>
                <strong>{result.mutation}</strong>
              </div>

              <div className="item">
                <span>Risk Level</span>
                <strong>{result.risk}</strong>
              </div>

              <div className="item">
                <span>Confidence</span>
                <strong>{result.confidence}</strong>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}