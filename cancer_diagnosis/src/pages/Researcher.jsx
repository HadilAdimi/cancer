import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Researcher.css";

export default function Researcher() {
  const [activePage, setActivePage] = useState("overview");
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [cancerTypes, setCancerTypes] = useState([]);
  const [selectedCancerType, setSelectedCancerType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [researchPapers, setResearchPapers] = useState([]);
  const [researchLoading, setResearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [editReport, setEditReport] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    fetchResearcherData();
    fetchRecentResearch("cancer research breakthrough 2024");
  }, [token, navigate]);

  const fetchResearcherData = async () => {
    try {
      setLoading(true);
      // Fetch researcher's reports
      const reportsRes = await fetch("http://localhost:5000/researcher/reports", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData);
        setFilteredReports(reportsData);
        
        // Get unique cancer types from reports
        const uniqueTypes = [...new Set(reportsData.map(r => r.cancerType).filter(Boolean))];
        setCancerTypes(uniqueTypes);
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Error fetching researcher data:", err);
      setLoading(false);
    }
  };

  const fetchRecentResearch = async (query = "") => {
    try {
      setResearchLoading(true);
      const searchQuery = query || "cancer research breakthrough";
      
      const response = await fetch(
        `http://localhost:5000/researcher/pubmed-search?q=${encodeURIComponent(searchQuery)}&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.articles && data.articles.length > 0) {
          setResearchPapers(data.articles);
        } else {
          setResearchPapers([]);
        }
      } else {
        setResearchPapers([]);
      }
      
      setResearchLoading(false);
    } catch (err) {
      console.error("Error fetching PubMed research:", err);
      setResearchLoading(false);
      setResearchPapers([]);
    }
  };

  const handleSearchResearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      alert("Please enter a search term");
      return;
    }
    fetchRecentResearch(searchQuery);
  };

  const filterReportsByCancerType = (cancerType) => {
    setSelectedCancerType(cancerType);
    if (cancerType === "all") {
      setFilteredReports(reports);
    } else {
      setFilteredReports(reports.filter(r => r.cancerType === cancerType));
    }
  };

  const addReport = async (reportData) => {
    try {
      const res = await fetch("http://localhost:5000/researcher/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(reportData)
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "Report created successfully");
        fetchResearcherData();
        setShowAddModal(false);
      } else {
        alert("Failed to create report");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create report");
    }
  };

  const updateReport = async (id, reportData) => {
    try {
      const res = await fetch(`http://localhost:5000/researcher/reports/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(reportData)
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "Report updated successfully");
        fetchResearcherData();
        setEditReport(null);
      } else {
        alert("Failed to update report");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update report");
    }
  };

  const deleteReport = async (id) => {
    if (!window.confirm("Are you sure you want to delete this report?")) return;
    
    try {
      const res = await fetch(`http://localhost:5000/researcher/reports/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "Report deleted successfully");
        fetchResearcherData();
      } else {
        alert("Failed to delete report");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete report");
    }
  };

  if (loading) {
    return <div className="researcher-loading">Loading Researcher Dashboard...</div>;
  }

  return (
    <div className="researcher-layout">
      <aside className="researcher-sidebar">
        <div className="side">
          <h2 className="researcher-title">Research Panel</h2>
          <p style={{ fontSize: "14px", color: "#b0bbca", textAlign: "center" }}>
            Cancer Research & Clinical Studies
          </p>
        </div>

        <button
          className={activePage === "overview" ? "researcher-sidebar-b active-btn" : "researcher-sidebar-b"}
          onClick={() => setActivePage("overview")}
        >
           Research Overview
        </button>

        <button
          className={activePage === "testing" ? "researcher-sidebar-b active-btn" : "researcher-sidebar-b"}
          onClick={() => setActivePage("testing")}
        >
           Cancer Testing
        </button>

        <button
          className={activePage === "reports" ? "researcher-sidebar-b active-btn" : "researcher-sidebar-b"}
          onClick={() => setActivePage("reports")}
        >
           Research Reports
        </button>

        <button
          className={activePage === "research" ? "researcher-sidebar-b active-btn" : "researcher-sidebar-b"}
          onClick={() => setActivePage("research")}
        >
           Recent Research
        </button>

        <button
          className="logout-btn"
          onClick={() => {
            localStorage.clear();
            navigate("/");
          }}
        >
           Logout
        </button>
      </aside>

      <main className="researcher-main">
        
        {activePage === "overview" && (
          <div>
            <div className="top-header">
            <h1>Research Dashboard</h1>
            
            <div className="admin-card">

                <img src="./imgs/researcher.png" alt="admin" className="imgadmin"/>

                <p className="admin-label">
                  Logged in as
                </p>

                <p className="admin-role">
                  Researcher
                </p>

              </div>
              </div>
            
            <div className="stats-cards-research">
              <div className="stat-card-research">
                <h3>{reports.length}</h3>
                <p>Total Reports</p>
              </div>
              <div className="stat-card-research">
                <h3>{cancerTypes.length}</h3>
                <p>Cancer Types</p>
              </div>
              <div className="stat-card-research">
                <h3>{researchPapers.length}</h3>
                <p>Recent Papers</p>
              </div>
            </div>

            <div className="research-highlights">
              <div className="highlight-card">
                <img src="./imgs/research.jpg" className="re-im" />
                <h3 style={{ textAlign: "center" }}> Research Focus</h3>
                <p>Conducting clinical research on cancer diagnosis using AI and multi-modal data analysis.</p>
              </div>
              <div className="highlight-card">
                <img src="./imgs/studies.jpg" className="re-im"/>
                <h3 style={{ textAlign: "center" }}>Active Studies</h3>
                <p>Active clinical trials, and genomic analysis for many enrolled patients.</p>
              </div>
              <div className="highlight-card">
                <img src="./imgs/collaboration.jpg" className="re-im"  />
                <h3 style={{ textAlign: "center" }}> Collaborations</h3>
                <p>Partnered with Setif Anti Cancer Center:"CAC" </p>
              </div>
            </div>
          </div>
        )}

        {activePage === "testing" && (
          <div>
            <h1>Cancer Testing & Diagnosis</h1>
            <p className="tab-description">Advanced diagnostic AI tools for cancer detection and analysis</p>

            <div className="testing-grid-research">
              <Link to="/Imaging" state={{ from: "researcher" }} className="testing-card-research">
                <img src="./imgs/imaging.jpg" className="iim" />
                <h2>Imaging Testing</h2>
                <p>MRI, CT, and X-ray analysis for cancer detection using computer vision</p>
                <button className="testing-btn">Start Analysis</button>
              </Link>

              <Link to="/Clinical" state={{ from: "researcher" }} className="testing-card-research">
                <img src="./imgs/clinical.jpg" className="iim" />
                <h2>Clinical Testing</h2>
                <p>Clinical data analysis for cancer diagnosis.</p>
                <button className="testing-btn">View Clinical Data</button>
              </Link>

              <Link to="/Genomic" state={{ from: "researcher" }} className="testing-card-research">
                 <img src="./imgs/genomic.jpg" className="iim" />
                <h2>Genomic Testing</h2>
                <p>RNA-seq analysis and genomic marker identification for precision oncology</p>
                <button className="testing-btn">Analyze Genomics</button>
              </Link>
            </div>
          </div>
        )}

        {activePage === "reports" && (
          <div>
            <div className="reports-header">
              <h1>Research Reports</h1>
              <button className="add-report-btn" onClick={() => setShowAddModal(true)}>
                Add new Report
              </button>
            </div>

            <div className="filter-section">
              <label>Filter by Cancer Type:</label>
              <div className="filter-buttons">
                <button
                  className={`filter-btn ${selectedCancerType === "all" ? "active-filter" : ""}`}
                  onClick={() => filterReportsByCancerType("all")}
                >
                  All
                </button>
                {cancerTypes.map((type, idx) => (
                  <button
                    key={idx}
                    className={`filter-btn ${selectedCancerType === type ? "active-filter" : ""}`}
                    onClick={() => filterReportsByCancerType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Reports List */}
            <div className="research-reports-list">
              {filteredReports.length === 0 ? (
                <div className="empty-reports">
                  <p>No reports found. Click "New Report" to create your first research report.</p>
                </div>
              ) : (
                filteredReports.map((report) => (
                  <div key={report._id} className="research-report-card">
                    <div className="report-card-header">
                      <img src="./imgs/reports.jpg" className="rep-im"/>
                      <h3>{report.title}</h3>
                      <div className="report-actions">
                        <button className="edit-report-btn" onClick={() => setEditReport(report)}>
                           Edit
                        </button>
                        <button className="delete-report-btn" onClick={() => deleteReport(report._id)}>
                           Delete
                        </button>
                      </div>
                    </div>
                    <div className="report-card-body">
                      <p className="report-cancer-type">
                        <strong>Cancer Type:</strong> {report.cancerType}
                      </p>
                      <p className="report-content">{report.content}</p>
                      <div className="report-meta">
                        <small>Created: {new Date(report.createdAt).toLocaleDateString()}</small>
                        {report.tags && report.tags.length > 0 && (
                          <div className="report-tags">
                            {report.tags.map((tag, idx) => (
                              <span key={idx} className="tag">#{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activePage === "research" && (
          <div>
            <h1>Recent Cancer Research from PubMed Studies</h1>
            
            {/* Search Bar */}
            <form onSubmit={handleSearchResearch} className="research-search">
              <input
                type="text"
                placeholder="Search PubMed for cancer research papers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="search-btn" disabled={researchLoading}>
                {researchLoading ? "Searching..." : "Search"}
              </button>
            </form>

            {/* Quick Suggestions */}
            <div className="search-suggestions">
              <small>Quick searches:</small>
              <button type="button" onClick={() => {
                setSearchQuery("lung cancer");
                fetchRecentResearch("lung cancer");
              }}>Lung Cancer</button>
              <button type="button" onClick={() => {
                setSearchQuery("breast cancer");
                fetchRecentResearch("breast cancer");
              }}>Breast Cancer</button>
              <button type="button" onClick={() => {
                setSearchQuery("genomic profiling in cancer");
                fetchRecentResearch("genomic profiling in cancer");
              }}>Genomic Sequencing</button>
              <button type="button" onClick={() => {
                setSearchQuery("Clinical trials in oncology");
                fetchRecentResearch("Clinical trials in oncology");
              }}>Clinical Trials</button>
            </div>

            {/* Research Papers List */}
            <div className="research-papers-list">
              {researchLoading ? (
                <div className="loading-papers">
                  <div className="spinner"></div>
                  <p>Searching PubMed database...</p>
                </div>
              ) : researchPapers.length === 0 ? (
                <div className="empty-papers">
                  <p>No research papers found. Try a different search term.</p>
                  <small>Example: "immunotherapy", "biomarkers", "genomic profiling", "clinical trials"</small>
                </div>
              ) : (
                <>
                  <p className="results-count">Found {researchPapers.length} articles</p>
                  {researchPapers.map((paper) => (
                    <div key={paper.id} className="research-paper-card">
                      <h3>{paper.title}</h3>
                      <div className="paper-meta">
                        <span className="paper-authors">👥 {paper.authors}</span>
                        <span className="paper-year">📅 {paper.year}</span>
                        <span className="paper-journal">📖 {paper.journal}</span>
                      </div>
                      <p className="paper-abstract">{paper.abstract?.substring(0, 300)}...</p>
                      <a 
                        href={paper.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="read-more-btn"
                      >
                        Read on PubMed →
                      </a>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Add Report Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Research Report</h2>
              <button className="close-modal" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              addReport({
                title: formData.get("title"),
                cancerType: formData.get("cancerType"),
                content: formData.get("content"),
                tags: formData.get("tags") ? formData.get("tags").split(",").map(t => t.trim()) : []
              });
            }} className="report-form">
              <div className="form-group">
                <label>Report Title *</label>
                <input type="text" name="title" required placeholder="Enter report title" />
              </div>
              <div className="form-group">
                <label>Cancer Type *</label>
                <select name="cancerType" required>
                  <option value="">Select Cancer Type</option>
                  <option value="Brain Tumor">Glioblastoma multiforme : Brain</option>
                  <option value="Brain Tumor">Lower grade glioma : Brain</option>
                  <option value="Lung Cancer">Lung adenocarcinoma : Lung</option>
                  <option value="Lung Cancer">Lung squamous cell carcinoma : Lung</option>
                  <option value="Breast Cancer">Breast invasive carcinoma : Breast</option>
                  <option value="Stomach Cancer">Stomach adenocarcinoma : Stomach</option>
                  <option value="Colon Cancer">Colon adenocarcinoma : Colon</option>
                  <option value="Rectum Cancer">Rectum adenocarcinoma : Rectum</option>
                  <option value="Kidney Cancer">kidney chromophobe : Kidney</option>
                  <option value="Kidney Cancer">Kidney renal clear cell carcinoma : Kidney</option>
                  <option value="Kidney Cancer">Kidney renal papillary cell carcinoma : Kidney</option>
                  <option value="Esophagus Cancer">Esophageal carcinoma : Esophagus</option>
                  <option value="Liver Cancer">Liver hepatocellular carcinoma : Liver</option>
                  <option value="Liver Cancer">Cholangiocarcinoma : Bile Duct in liver</option>
                  <option value="Pancreas">Pancreatic adenocarcinoma : Pancreas</option>
                  <option value="Ovary Cancer">Ovarian serous cystadenocarcinoma : Ovary</option>
                  <option value="Cervix Cancer">Cervical squamous cell carcinoma and endocervical adenocarcinoma : Cervix</option>
                  <option value="Uterus Cancer">Uterine corpus endometrial carcinoma : Uterus</option>
                  <option value="Uterus Cancer"> Uterine corpus endometrial carcinoma : Uterus lining</option>
                  <option value="Bladder Cancer">Bladder urothelial carcinoma : Bladder</option>
                  <option value="Testicles Cancer">Testicular germ cell tumors : Testicals</option>                  
                  <option value="Prostate Cancer">Prostate adenocarcinoma : Prostate</option>
                  <option value="Thyroid Cancer">Thyroid carcinoma : Thyroid</option>
                  <option value="Adrenal gland">Thyroid carcinoma : ThyroidPheochromocytoma and paraganglioma : Adrenal gland and nearby nerve tissue</option>
                  <option value="Adrenal gland">Adrenocortical carcinoma : Adrenal gland</option>
                  <option value="Skin Cancer">Skin cutaneous melanoma : Skin</option>
                  <option value="Head and Neck Cancer">Head and Neck squamous cell carcinoma : Mouth, throat, larynx</option>
                  <option value="Chest Cancer">Mesothelioma : Lining of lungs and chest wall</option>
                  <option value="Chest Cancer">Thymoma : Thymus gland in chest</option>
                  <option value="Soft tissue and bone Cancer">Sarcoma : Connective soft tissues and bone</option>
                  <option value="Lymph Cancer"> Diffuse large B-cell lymphoma : Lymph nodes and lymphatic system</option>
                  <option value="Eye Cancer">Uveal melanoma : Eye</option>
                </select>
              </div>
              <div className="form-group">
                <label>Report Content *</label>
                <textarea name="content" required rows={8} placeholder="Write your research findings here..." />
              </div>
              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input type="text" name="tags" placeholder="e.g., immunotherapy, clinical trial" />
              </div>
              <div className="modal-actions">
                <button type="submit" className="save-btn">Save Report</button>
                <button type="button" className="cancel-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Report Modal */}
      {editReport && (
        <div className="modal-overlay" onClick={() => setEditReport(null)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Research Report</h2>
              <button className="close-modal" onClick={() => setEditReport(null)}>✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              updateReport(editReport._id, {
                title: formData.get("title"),
                cancerType: formData.get("cancerType"),
                content: formData.get("content"),
                tags: formData.get("tags") ? formData.get("tags").split(",").map(t => t.trim()) : []
              });
            }} className="report-form">
              <div className="form-group">
                <label>Report Title *</label>
                <input type="text" name="title" defaultValue={editReport.title} required />
              </div>
              <div className="form-group">
                <label>Cancer Type *</label>
                <select name="cancerType" defaultValue={editReport.cancerType} required>
                  <option value="">Select Cancer Type</option>
                  <option value="Brain Tumor">Glioblastoma multiforme : Brain</option>
                  <option value="Brain Tumor">Lower grade glioma : Brain</option>
                  <option value="Lung Cancer">Lung adenocarcinoma : Lung</option>
                  <option value="Lung Cancer">Lung squamous cell carcinoma : Lung</option>
                  <option value="Breast Cancer">Breast invasive carcinoma : Breast</option>
                  <option value="Stomach Cancer">Stomach adenocarcinoma : Stomach</option>
                  <option value="Colon Cancer">Colon adenocarcinoma : Colon</option>
                  <option value="Rectum Cancer">Rectum adenocarcinoma : Rectum</option>
                  <option value="Kidney Cancer">kidney chromophobe : Kidney</option>
                  <option value="Kidney Cancer">Kidney renal clear cell carcinoma : Kidney</option>
                  <option value="Kidney Cancer">Kidney renal papillary cell carcinoma : Kidney</option>
                  <option value="Esophagus Cancer">Esophageal carcinoma : Esophagus</option>
                  <option value="Liver Cancer">Liver hepatocellular carcinoma : Liver</option>
                  <option value="Liver Cancer">Cholangiocarcinoma : Bile Duct in liver</option>
                  <option value="Pancreas">Pancreatic adenocarcinoma : Pancreas</option>
                  <option value="Ovary Cancer">Ovarian serous cystadenocarcinoma : Ovary</option>
                  <option value="Cervix Cancer">Cervical squamous cell carcinoma and endocervical adenocarcinoma : Cervix</option>
                  <option value="Uterus Cancer">Uterine corpus endometrial carcinoma : Uterus</option>
                  <option value="Uterus Cancer"> Uterine corpus endometrial carcinoma : Uterus lining</option>
                  <option value="Bladder Cancer">Bladder urothelial carcinoma : Bladder</option>
                  <option value="Testicles Cancer">Testicular germ cell tumors : Testicals</option>                  
                  <option value="Prostate Cancer">Prostate adenocarcinoma : Prostate</option>
                  <option value="Thyroid Cancer">Thyroid carcinoma : Thyroid</option>
                  <option value="Adrenal gland">Thyroid carcinoma : ThyroidPheochromocytoma and paraganglioma : Adrenal gland and nearby nerve tissue</option>
                  <option value="Adrenal gland">Adrenocortical carcinoma : Adrenal gland</option>
                  <option value="Skin Cancer">Skin cutaneous melanoma : Skin</option>
                  <option value="Head and Neck Cancer">Head and Neck squamous cell carcinoma : Mouth, throat, larynx</option>
                  <option value="Chest Cancer">Mesothelioma : Lining of lungs and chest wall</option>
                  <option value="Chest Cancer">Thymoma : Thymus gland in chest</option>
                  <option value="Soft tissue and bone Cancer">Sarcoma : Connective soft tissues and bone</option>
                  <option value="Lymph Cancer"> Diffuse large B-cell lymphoma : Lymph nodes and lymphatic system</option>
                  <option value="Eye Cancer">Uveal melanoma : Eye</option>
                </select>
              </div>
              <div className="form-group">
                <label>Report Content *</label>
                <textarea name="content" required rows={8} defaultValue={editReport.content} />
              </div>
              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input type="text" name="tags" defaultValue={editReport.tags?.join(", ")} placeholder="e.g., immunotherapy, clinical trial" />
              </div>
              <div className="modal-actions">
                <button type="submit" className="save-btn">Update Report</button>
                <button type="button" className="cancel-btn" onClick={() => setEditReport(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}