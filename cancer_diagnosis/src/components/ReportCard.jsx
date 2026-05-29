import API from "../services/api";

export default function ReportCard({ report, onDelete, onSend }) {  // Add onSend prop

  const deleteReport = async () => {
    try {
      await API.delete(`/reports/${report._id}`);

      if (onDelete) onDelete(report._id);
    } catch (err) {
      console.log(err);
      alert("Delete failed");
    }
  };

  const sendToPatient = async () => {
    try {
      const response = await API.put(`/reports/${report._id}/send`);
      
      alert("Report sent to patient");
      
      // Call the onSend callback if provided
      if (onSend) {
        onSend(response.data.report); // Pass the updated report
      }
      
    } catch (err) {
      console.log(err);
      alert("Send failed");
    }
  };

  return (
    <div className="report">
      <div className="reporrt">
        <small>
          {new Date(report.createdAt).toLocaleString()}
        </small>

        {!report.sendToPatient && (
          <button className="sen" onClick={sendToPatient}>
            Send to patient
          </button>
        )}

        {report.sendToPatient && (
          <span className="sent-badge">✓ Sent to patient</span>
        )}

        <button className="delete-btn" onClick={deleteReport}>
          Delete
        </button>
      </div>

      <p className="report-text">
        {report.text}
      </p>

      {report.file && (
        <a
          href={`http://localhost:5000/uploads/${report.file}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View file
        </a>
      )}
    </div>
  );
}