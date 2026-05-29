import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../services/api";
import ReportCard from "../components/ReportCard";
import jsPDF from "jspdf";

export default function PatientTimeline() {
  const { patientId } = useParams();
  const [reports, setReports] = useState([]);
  const [treatments, setTreatments] = useState([]);

  const fetchData = async () => {
    try {
      const reportsRes = await API.get(`/reports/patient/${patientId}`);
      setReports(reportsRes.data || []);

      const treatmentsRes = await API.get(`/patients/${patientId}/treatments`);
      setTreatments(treatmentsRes.data || []);
    } catch (err) {
      console.log(err);
      alert("Failed to fetch reports");
    }
  };

  useEffect(() => {
    fetchData();
  }, [patientId]);
  
  const handleDelete = (id) => {
    setReports(prev => prev.filter(r => r._id !== id));
  };

  const handleSend = (updatedReport) => {
    // Update the specific report in the state
    setReports(prev => 
      prev.map(r => 
        r._id === updatedReport._id ? updatedReport : r
      )
    );
  };

  const downloadGeneralReport = () => {
    const doc = new jsPDF();
    let y = 10;

    doc.setFontSize(14);
    doc.text("Patient Full Medical Report", 10, y);
    y += 10;

    reports.forEach((r, index) => {
      const date = new Date(r.createdAt).toLocaleString();

      doc.setFontSize(10);
      doc.text(`Report ${index + 1}`, 10, y);
      y += 6;
      doc.text(`Date: ${date}`, 10, y);
      y += 6;

      const textLines = doc.splitTextToSize(r.text || "", 180);
      doc.text(textLines, 10, y);
      y += textLines.length * 5 + 4;

      if (r.file) {
        doc.text(`File: http://localhost:5000/uploads/${r.file}`, 10, y);
        y += 8;
      }

      y += 5;

      if (y > 270) {
        doc.addPage();
        y = 10;
      }
    });

    doc.save(`patient-${patientId}-report.pdf`);
  };


  return (
    <div className="timeline-page">
      <h1 className="timeline-title">Patient Reports Timeline</h1>

      {reports.length === 0 && (
        <p style={{textAlign: "center"}}>No reports yet</p>
      )}

      <div className="btns">
        <button className="babtn" onClick={() => window.history.back()}>Back</button>
        <button className="dobtn" onClick={downloadGeneralReport}>Download full report</button>
      </div>
      
      <div className="reportgrid">
        {reports.map((r) => (
          <ReportCard 
            key={r._id} 
            report={r} 
            onDelete={handleDelete}
            onSend={handleSend}  
          />
        ))}

        {treatments.map((t) => (
          <div key={t._id} className="treatment-report-card">
            <div className="report-top">
              <small>{new Date(t.date).toLocaleString()}</small>
              <span className="treatment-badge">Treatment</span>
            </div>
            <div className="treatmentmiddle">
              <div>
                <h4>{t.type}</h4>
                <p>Treatment added to patient follow up</p>
              </div>
              {!t.sentToPatient && (
                <button
                  className="sent"
                  onClick={async () => {
                    try {
                      console.log("Sending treatment - Patient ID:", patientId);
                      console.log("Treatment ID:", t._id);
                      console.log("Token exists:", !!localStorage.getItem("token"));

                      // Use fetch directly to see the error
                      const token = localStorage.getItem("token");
                      const response = await fetch(`http://localhost:5000/patients/${patientId}/treatment/${t._id}/send`, {
                        method: "PUT",
                        headers: {
                          "Authorization": `Bearer ${token}`,
                          "Content-Type": "application/json"
                        }
                      });

                      console.log("Response status:", response.status);

                      if (!response.ok) {
                        const errorData = await response.json();
                        console.error("Error response:", errorData);
                        throw new Error(errorData.message || "Failed to send treatment");
                      }

                      const data = await response.json();
                      alert("Treatment sent to patient successfully!");

                      // Refresh treatments list
                      const treatmentsRes = await API.get(`/patients/${patientId}/treatments`);
                      setTreatments(treatmentsRes.data || []);

                    } catch (err) {
                      console.error("Error sending treatment:", err);
                      alert("Failed to send treatment: " + err.message);
                    }
                  }}
                >
                  Send to patient
                </button>
              )}
              {t.sentToPatient && (
                <span className="sent-badge">✓ Sent</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}