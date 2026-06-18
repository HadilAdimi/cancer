import { useState, useEffect } from "react";
import axios from "axios";
import "./Genomics.css";
import { useNavigate, useLocation } from "react-router-dom";

export default function Genomic() {
    const navigate = useNavigate();
    const location = useLocation();

    const [fromPage, setFromPage] = useState("researcher");
    
    // Server status
    const [serverStatus, setServerStatus] = useState("Checking...");
    
    // File upload state
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState("");
    
    // Result and loading states
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");

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

        // Check server health
        checkServerHealth();
    }, [location]);

    // Check server health
    const checkServerHealth = async () => {
        try {
            await axios.get("http://127.0.0.1:8000/health");
            setServerStatus(" Connected");
        } catch (error) {
            setServerStatus("Disconnected");
        }
    };

    // Handle file selection
    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            setFile(selected);
            setFileName(selected.name);
            setResult(null);
            setError("");
        }
    };

    // Predict from CSV file
    const handlePredictFile = async () => {
        if (!file) {
            alert("Please select a CSV file first!");
            return;
        }

        setLoading(true);
        setError("");
        setResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await axios.post(
                "http://127.0.0.1:8000/predict-genomic-csv",
                formData,
                { headers: { "Content-Type": "multipart/form-data" } }
            );

            if (res.data.success) {
                setResult(res.data);
            } else {
                setError(res.data.error || "Prediction failed");
            }
        } catch (err) {
            setError(err.response?.data?.detail || "Connection error");
        }

        setLoading(false);
    };

    // Navigate back
    const handleBack = () => {
        if (fromPage === "doctor") {
            navigate("/doctor");
        } else {
            navigate("/researcher");
        }
    };

    // Render result
    const renderResult = () => {
        if (!result) return null;

        const isEarly = result.stage === "Early";
        const stageColor = isEarly ? "#4CAF50" : "#f44336";
        

        return (
            <div className="genomic-result-card">
                <div className="genomic-result-header">
                    <h3> Prediction Result</h3>
                    <span className="genomic-result-badge">FusionGNN</span>
                </div>

                <div className="genomic-stage-main">
                    <div className="genomic-stage-circle" style={{ borderColor: stageColor }}>
                        <span className="genomic-stage-text" style={{ color: stageColor }}>
                            {result.stage}
                        </span>
                    </div>
                    <div className="genomic-stage-confidence">
                        <span className="genomic-confidence-label">Confidence</span>
                        <span className="genomic-confidence-value">
                            {(result.confidence * 100).toFixed(2)}%
                        </span>
                    </div>
                </div>

                <div className="genomic-result-details">
                    <div className="genomic-detail-item">
                        <span className="genomic-detail-label"> Full Stage</span>
                        <span className="genomic-detail-value">{result.stage_full || result.stage}</span>
                    </div>
                    <div className="genomic-detail-item">
                        <span className="genomic-detail-label"> Model</span>
                        <span className="genomic-detail-value">FusionGNN</span>
                    </div>
                </div>

                <div className="genomic-probabilities-section">
                    <h4> Probabilities Distribution</h4>
                    
                    <div className="genomic-bar-group">
                        <div className="genomic-bar-item">
                            <div className="genomic-bar-label-group">
                                <span className="genomic-bar-dot early-dot">●</span>
                                <span className="genomic-bar-label">Early</span>
                            </div>
                            <div className="genomic-bar-track">
                                <div 
                                    className="genomic-bar-fill early-fill" 
                                    style={{ width: `${(result.probabilities.Early * 100).toFixed(0)}%` }}
                                >
                                    <span className="genomic-bar-percent">
                                        {(result.probabilities.Early * 100).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="genomic-bar-item">
                            <div className="genomic-bar-label-group">
                                <span className="genomic-bar-dot late-dot">●</span>
                                <span className="genomic-bar-label">Late</span>
                            </div>
                            <div className="genomic-bar-track">
                                <div 
                                    className="genomic-bar-fill late-fill" 
                                    style={{ width: `${(result.probabilities.Late * 100).toFixed(0)}%` }}
                                >
                                    <span className="genomic-bar-percent">
                                        {(result.probabilities.Late * 100).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="genomic-probabilities-numbers">
                        <div className="genomic-prob-number early-num">
                            <span className="genomic-num-label">Early</span>
                            <span className="genomic-num-value">{(result.probabilities.Early * 100).toFixed(2)}%</span>
                        </div>
                        <div className="genomic-prob-number late-num">
                            <span className="genomic-num-label">Late</span>
                            <span className="genomic-num-value">{(result.probabilities.Late * 100).toFixed(2)}%</span>
                        </div>
                    </div>
                </div>

                {/* Features Summary */}
                {result.features && (
                    <div className="genomic-features">
                        <h4> Features Summary</h4>
                        <div className="genomic-features-grid">
                            <div className="genomic-feature-group">
                                <h5 style={{ color: "#e74c3c" }}>miRNA ({result.features.mirna.length})</h5>
                                <div className="genomic-feature-list">
                                    {result.features.mirna.slice(0, 5).map(([name, value], idx) => (
                                        <span key={idx} className="genomic-feature-item">
                                            {name}: {value.toFixed(4)}
                                        </span>
                                    ))}
                                    {result.features.mirna.length > 5 && (
                                        <span className="genomic-feature-more">+ {result.features.mirna.length - 5} more</span>
                                    )}
                                </div>
                            </div>
                            <div className="genomic-feature-group">
                                <h5 style={{ color: "#2ecc71" }}>Gene ({result.features.gene.length})</h5>
                                <div className="genomic-feature-list">
                                    {result.features.gene.slice(0, 5).map(([name, value], idx) => (
                                        <span key={idx} className="genomic-feature-item">
                                            {name}: {value.toFixed(4)}
                                        </span>
                                    ))}
                                    {result.features.gene.length > 5 && (
                                        <span className="genomic-feature-more">+ {result.features.gene.length - 5} more</span>
                                    )}
                                </div>
                            </div>
                            <div className="genomic-feature-group">
                                <h5 style={{ color: "#3498db" }}>Protein ({result.features.protein.length})</h5>
                                <div className="genomic-feature-list">
                                    {result.features.protein.slice(0, 5).map(([name, value], idx) => (
                                        <span key={idx} className="genomic-feature-item">
                                            {name}: {value.toFixed(4)}
                                        </span>
                                    ))}
                                    {result.features.protein.length > 5 && (
                                        <span className="genomic-feature-more">+ {result.features.protein.length - 5} more</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="genomic-model-info">
                    <p> Input: 49 miRNA + 50 Gene + 50 Protein values</p>
                    <p> Test Accuracy: 69.11%</p>
                </div>
            </div>
        );
    };

    return (
        <div className="genomic-page">
            <button className="back-btn" onClick={handleBack}>
                Back
            </button>

            <div className="genomic-header">
                <h1> Multi-Omics Cancer Predictor</h1>
                <p>miRNA + Gene + Protein Fusion Model for Early and Late Stage Classification</p>
            </div>

            <div className="genomic-container">
                <div className="genomic-card">
                    {/* CSV Upload Section - Only Tab */}
                    <div className="genomic-upload-section">
                        <div className="genomic-tab-header">
                            <h3> Upload CSV File</h3>
                            <p className="genomic-hint">
                                CSV with columns: Feature, Type, Value
                            </p>
                        </div>

                        <div className="genomic-upload-area">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="genomic-file-input"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" className="genomic-file-label">
                                {fileName ? `📄 ${fileName}` : "📁 Choose CSV File"}
                            </label>
                        </div>

                        <button
                            onClick={handlePredictFile}
                            disabled={loading || !file}
                            className="genomic-predict-btn"
                        >
                            {loading ? " Analyzing..." : " Predict Stage"}
                        </button>
                    </div>

                    {loading && (
                        <div className="genomic-loading">
                            <div className="genomic-spinner"></div>
                            <p> Analyzing multi-omics data...</p>
                        </div>
                    )}

                    {error && (
                        <div className="genomic-error">
                            <p> {error}</p>
                        </div>
                    )}

                    {renderResult()}
                </div>
            </div>
        </div>
    );
}