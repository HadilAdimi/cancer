import { useState } from "react";

export default function ResearchReportModal({ report, onClose, onSave, cancerTypes }) {
  const [formData, setFormData] = useState({
    title: report?.title || "",
    cancerType: report?.cancerType || "",
    content: report?.content || "",
    tags: report?.tags?.join(", ") || ""
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const tagsArray = formData.tags.split(",").map(tag => tag.trim()).filter(tag => tag);
      await onSave({
        title: formData.title,
        cancerType: formData.cancerType,
        content: formData.content,
        tags: tagsArray
      });
      onClose();
    } catch (err) {
      console.error("Error saving report:", err);
      alert("Failed to save report. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{report ? "Edit Research Report" : "New Research Report"}</h2>
          <button className="close-modal" onClick={onClose}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="report-form">
          <div className="form-group">
            <label>Report Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
              placeholder="Enter report title"
            />
          </div>

          <div className="form-group">
            <label>Cancer Type *</label>
            <select
              value={formData.cancerType}
              onChange={(e) => setFormData({...formData, cancerType: e.target.value})}
              required
            >
              <option value="">Select Cancer Type</option>
              <option value="Brain Tumor">Brain Tumor</option>
              <option value="Lung Cancer">Lung Cancer</option>
              <option value="Breast Cancer">Breast Cancer</option>
              <option value="Colon Cancer">Colon Cancer</option>
              <option value="Prostate Cancer">Prostate Cancer</option>
              <option value="Liver Cancer">Liver Cancer</option>
              <option value="Pancreatic Cancer">Pancreatic Cancer</option>
              <option value="Ovarian Cancer">Ovarian Cancer</option>
              <option value="Skin Cancer">Skin Cancer</option>
              <option value="Leukemia">Leukemia</option>
              <option value="Kidney Cancer">Kidney Cancer</option>
              <option value="Bladder Cancer">Bladder Cancer</option>
              <option value="Cervical Cancer">Cervical Cancer</option>
              <option value="Uterine Cancer">Uterine Cancer</option>
              <option value="Thyroid Cancer">Thyroid Cancer</option>
            </select>
          </div>

          <div className="form-group">
            <label>Report Content *</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              required
              rows={8}
              placeholder="Write your research findings here..."
            />
          </div>

          <div className="form-group">
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({...formData, tags: e.target.value})}
              placeholder="e.g., immunotherapy, clinical trial, biomarkers"
            />
            <small>Separate multiple tags with commas</small>
          </div>

          <div className="modal-actions">
            <button type="submit" className="save-btn" disabled={saving}>
              {saving ? "Saving..." : "Save Report"}
            </button>
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}