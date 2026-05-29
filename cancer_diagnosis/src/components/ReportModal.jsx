import { useState } from "react";
import API from "../services/api";

export default function ReportModal({ patientId, onClose, onSaved }) {

  const [text, setText] = useState("");
  const [file, setFile] = useState(null);

  const submitReport = async () => {

  try {

    const formData = new FormData();

    formData.append("patientId", patientId);

    formData.append("text", text);

    if (file) {

      formData.append("file", file);
    }

    const res = await API.post(
      "/reports",
      formData,
      {
        headers: {
          "Content-Type":
            "multipart/form-data"
        }
      }
    );
    
    if (onSaved) onSaved();

    alert("Report saved");

    console.log(res.data);

    setText("");

    setFile(null);

    onClose();

  } catch (err) {

    console.log(err);

    console.log(err.response?.data);

    alert("Failed to save report");
  }
};

  return (
    <div className="modal-overlay">

      <div className="modal">

        <h2>Create Report</h2>

        <textarea
          placeholder="Write clinical notes"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <div className="modal-actions">

          <button onClick={submitReport}>
            Save
          </button>

          <button onClick={onClose}>
            Cancel
          </button>

        </div>

      </div>

    </div>
  );
}