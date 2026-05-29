import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Doctor.css";
import { useNavigate} from "react-router-dom";
import ReportModal from "../components/ReportModal";
import MessageModal from "../components/MessageModal";


export default function Doctor() {

  const [activePage, setActivePage] = useState("overview");

  const [patients, setPatients] = useState([]);

  const [editPatient, setEditPatient] = useState(null);

  const token = localStorage.getItem("token");

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    weight: "",
    cancerType: "",
    stage: "Stage I",
    treatmentStarted: "No",
    patientUsername: "",
    patientPassword: ""
  });

  const [unreadCounts, setUnreadCounts] = useState({});

  const [selectedPatientForMessage, setSelectedPatientForMessage] = useState(null);

  const navigate = useNavigate();

  const [selectedTreatment, setSelectedTreatment] =
  useState("Chemotherapy");

  const [editTreatment, setEditTreatment] =
  useState(null);

  

  const addTreatment = async (patientId) => {

  console.log(patientId);

  try {

    const res = await fetch(
      `http://localhost:5000/patients/${patientId}/treatment`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },

        body: JSON.stringify({
          type: selectedTreatment
        })
      }
    );

    const data = await res.json();

    alert(data.message);

    fetchPatients();

  } catch (err) {

    console.log(err);
  }
};


const updateTreatment = async () => {

  try {

    const res = await fetch(
      `http://localhost:5000/patients/${editTreatment.patientId}/treatment/${editTreatment._id}`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },

        body: JSON.stringify({
          type: editTreatment.type
        })
      }
    );

    const data = await res.json();

    alert(data.message);

    setEditTreatment(null);

    fetchPatients();

  } catch (err) {

    console.log(err);
  }
};


const deleteTreatment = async (
  patientId,
  treatmentId
) => {

  try {

    const res = await fetch(
      `http://localhost:5000/patients/${patientId}/treatment/${treatmentId}`,
      {
        method: "DELETE",

        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await res.json();

    alert(data.message);

    fetchPatients();

  } catch (err) {

    console.log(err);
  }
};

  useEffect(() => {

    if (!token) {

      window.location.href = "/";

      return;
    }

    fetchPatients();
    fetchUnreadCounts();

    const interval = setInterval(() => {
      fetchUnreadCounts();
    }, 10000);
    
    return () => clearInterval(interval);

  }, []);

  const fetchPatients = async () => {

    try {

      const res = await fetch(
        "http://localhost:5000/patients/my-patients",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await res.json();

      setPatients(data);

    } catch (err) {

      console.log(err);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const res = await fetch(
        "http://localhost:5000/patients/messages/unread-counts",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      const data = await res.json();
      setUnreadCounts(data);
    } catch (err) {
      console.log(err);
    }
  };

  const handleChange = (e) => {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const addPatient = async (e) => {

    e.preventDefault();

    try {

      const res = await fetch(
        "http://localhost:5000/patients",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },

          body: JSON.stringify(formData)
        }
      );

      const data = await res.json();

      alert(data.message);

      fetchPatients();

      setFormData({
        name: "",
        age: "",
        weight: "",
        cancerType: "",
        stage: "Stage I",
        treatmentStarted: "No",
        patientUsername: "",
        patientPassword: "" 
      });

    } catch (err) {

      console.log(err);
    }
  };

  const deletePatient = async (id) => {

    try {

      const res = await fetch(
        `http://localhost:5000/patients/${id}`,
        {
          method: "DELETE",

          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await res.json();

      alert(data.message);

      fetchPatients();

    } catch (err) {

      console.log(err);
    }
  };


  const downloadReport = (patientName) => {

    const blob = new Blob(
      [`Cancer diagnosis report for ${patientName}`],
      { type: "text/plain" }
    );

    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);

    link.download = `${patientName}-report.txt`;

    link.click();
  };
  const [editForm, setEditForm] = useState(null);
  const handleEditChange = (e) => {

    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value
    });
  };
  const updatePatient = async () => {

  try {

    const {patientPassword, ...cleanData} = editForm;

    const res = await fetch(
      `http://localhost:5000/patients/${editForm._id}`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },

        body: JSON.stringify(cleanData)
      }
    );

    const data = await res.json();

    alert(data.message);

    setEditForm(null);

    fetchPatients();

  } catch (err) {

    console.log(err);
  }
};



const handleMessageClick = (patient) => {
    setSelectedPatientForMessage(patient);
  };

  const handleMessageSent = () => {
    fetchUnreadCounts();
  };

  const getTotalUnreadCount = () => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  };

const [selectedPatient, setSelectedPatient] = useState(null);

  return (
    <div className="doctor-layout">

      <aside className="doctor-sidebar">

        <div className="side">

        <h2 className="doctor-title">
          Doctor Panel
        </h2>
        <p style={{fontSize: "14px", color: "#b0bbca", textAlign: "center"}}>
          Clinical overview and patient management
        </p>
        </div>

        <button
        className={
                activePage === "overview"
                  ? "doctor-sidebar-b active-btn"
                  : "doctor-sidebar-b"
              } onClick={() => setActivePage("overview")}>
          Patients Overview
          {getTotalUnreadCount() > 0 && (
            <span className="notification-badge-sidebar">
              {getTotalUnreadCount()}
            </span>
          )}
        </button>

        <button
          className={
            activePage === "manage"
              ? "doctor-sidebar-b active-btn"
              : "doctor-sidebar-b"
          }
          onClick={() => setActivePage("manage")}
        >
          Manage Patients
        </button>

        <button
          className={
            activePage === "testing"
              ? "doctor-sidebar-b active-btn"
              : "doctor-sidebar-b"
          }
          onClick={() => setActivePage("testing")}
        >
          Testing for Cancer
        </button>

        <button
          className={
            activePage === "reports"
              ? "doctor-sidebar-b active-btn"
              : "doctor-sidebar-b"
          }
          onClick={() => setActivePage("reports")}
        >
          Reports
        </button>

        <button
          className={
            activePage === "treatment"
              ? "doctor-sidebar-b active-btn"
              : "doctor-sidebar-b"
          }
          onClick={() => setActivePage("treatment")}
        >
          Treatment Follow Up
        </button>

        <button
          className="logout-btn"
          onClick={() => {

            localStorage.clear();

            window.location.href = "/";
          }}
        >
          Logout
        </button>

      </aside>

      <main className="doctor-main">

        {activePage === "overview" && (

          <>
          <div className="top-header">
            <h1>
              My Patients
            </h1>
            <div className="admin-card">

                <img src="./imgs/doctor.png" alt="admin" className="imgadmin"/>

                <p className="admin-label">
                  Logged in as
                </p>

                <p className="admin-role">
                  Doctor
                </p>

              </div>
              </div>

            <div className="patients-grid">

              {patients.map((patient) => (

                <div
                  className="patient-card"
                  key={patient._id}
                >
                  <div className="patient-card-header">

                  <img
                    src="/imgs/patient.png"
                    alt="patient"
                    className="patient-avatar"
                  />
                  {unreadCounts[patient._id] > 0 && (
                      <button
                        className="message-bell"
                        onClick={() => handleMessageClick(patient)}
                      >
                        🔔
                        <span className="message-count">
                          {unreadCounts[patient._id]}
                        </span>
                      </button>
                    )}
                    {(!unreadCounts[patient._id] || unreadCounts[patient._id] === 0) && (
                      <button
                        className="message-bell no-message"
                        onClick={() => handleMessageClick(patient)}
                      >
                        <img src="./imgs/message.png" className="mes" />
                      </button>
                    )}
                  </div>

                  <h3>
                    {patient.name}
                  </h3>

                  <p>
                    Age: {patient.age}
                  </p>

                  <p>
                    Weight: {patient.weight} kg
                  </p>

                  <p>
                    Cancer: {patient.cancerType}
                  </p>

                  <p>
                    Stage: {patient.stage}
                  </p>

                  <p>
                    Treatment Started: {patient.treatmentStarted}
                  </p>

                </div>

              ))}

            </div>

          </>
        )}

        {activePage === "manage" && (

          <>
            <h1>
              Manage Patients
            </h1>

            <form
              className="patient-form"
              onSubmit={addPatient}
            >
              <div className="form-group">

                <label htmlFor="name">Patient Name</label>

              <input
                type="text"
                placeholder="Patient Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
              </div>

              <div className="form-group">
                <label htmlFor="age">Age</label>
                <input
                  type="number"
                  placeholder="Age"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="weight">Weight</label>
                <input
                  type="number"
                  placeholder="Weight"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="cancerType">Cancer Type</label>
                <select
                  name="cancerType"
                  value={formData.cancerType}
                  onChange={handleChange}
                  required
                >

                <option value="">
                  Select Cancer Type
                </option>

                <option value="Brain Tumor">
                  Glioblastoma multiforme : Brain
                </option>

                <option value="Brain Tumor">
                  Lower grade glioma : Brain
                </option>

                <option value="Lung Cancer">
                  Lung adenocarcinoma : Lung
                </option>

                <option value="Lung Cancer">
                  Lung squamous cell carcinoma : Lung
                </option>

                <option value="kidney Cancer">
                  kidney chromophobe : Kidney
                </option>

                <option value="kidney Cancer">
                  Kidney renal clear cell carcinoma : Kidney
                </option>

                <option value="kidney Cancer">
                  Kidney renal papillary cell carcinoma : Kidney
                </option>

                <option value="Esphagus">
                  Esophageal carcinoma : Esophagus
                </option>

                <option value="Colon">
                  Colon adenocarcinoma : Colon
                </option>

                <option value="Stomach">
                  Stomach adenocarcinoma : Stomach
                </option>

                <option value="Rectum">
                  Rectum adenocarcinoma : Rectum
                </option>

                <option value="Liver">
                  Liver hepatocellular carcinoma : Liver
                </option>

                <option value="Liver">
                  Cholangiocarcinoma : Bile Duct in liver
                </option>

                <option value="Pancreas">
                  Pancreatic adenocarcinoma : Pancreas
                </option>

                <option value="Breast Cancer">
                  Breast invasive carcinoma : Breast
                </option>

                <option value="Ovary Cancer">
                  Ovarian serous cystadenocarcinoma : Ovary
                </option>

                <option value="Cervix Cancer">
                  Cervical squamous cell carcinoma and endocervical adenocarcinoma : Cervix
                </option>

                <option value="Uterus Cancer">
                  Uterine corpus endometrial carcinoma : Uterus
                </option>

                <option value="Uterus Cancer">
                  Uterine corpus endometrial carcinoma : Uterus lining
                </option>

                <option value="Bladder Cancer">
                  Bladder urothelial carcinoma : Bladder
                </option>

                <option value="Testicles Cancer">
                  Testicular germ cell tumors : Testicals
                </option>

                <option value="Prostate Cancer">
                  Prostate adenocarcinoma : Prostate
                </option>

                <option value="Thyroid gland">
                  Thyroid carcinoma : Thyroid
                </option>

                <option value="Adrenal gland">
                  Thyroid carcinoma : ThyroidPheochromocytoma and paraganglioma : Adrenal gland and nearby nerve tissue
                </option>

                <option value="Adrenal gland">
                  Adrenocortical carcinoma : Adrenal gland
                </option>

                <option value="Skin Cancer">
                  Skin cutaneous melanoma : Skin
                </option>

                <option value="Head and Neck Cancer">
                  Head and Neck squamous cell carcinoma : Mouth, throat, larynx
                </option>

                <option value="Chest Cancer">
                  Mesothelioma : Lining of lungs and chest wall
                </option>

                <option value="Chest Cancer">
                  Thymoma : Thymus gland in chest
                </option>

                <option value="Soft tissue and bone Cancer">
                  Sarcoma : Connective soft tissues and bone
                </option>

                <option value="Lymph Cancer">
                  Diffuse large B-cell lymphoma : Lymph nodes and lymphatic system
                </option>

                <option value="Eye Cancer">
                  Uveal melanoma : Eye
                </option>

              </select>
              </div>

              <div className="form-group">
                <label htmlFor="stage">Stage</label>
                <select
                  name="stage"
                  value={formData.stage}
                  onChange={handleChange}
              >

                <option>
                  Stage I
                </option>

                <option>
                  Stage II
                </option>

                <option>
                  Stage III
                </option>

                <option>
                  Stage IV
                </option>

              </select>
              </div>

              <div className="form-group">
                <label htmlFor="treatmentStarted">Treatment Started</label>
                <select
                  name="treatmentStarted"
                  value={formData.treatmentStarted}
                  onChange={handleChange}
              >

                <option>
                  Yes
                </option>

                <option>
                  No
                </option>

              </select>
              </div>

              <div className="form-group">
                <label htmlFor="patientUsername">Patient Username</label>
                <input
                  type="text"
                  placeholder="Patient Username"
                  name="patientUsername"
                  value={formData.patientUsername}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="patientPassword">Patient Password</label>
                <input
                  type="password"
                  placeholder="Patient Password"
                  name="patientPassword"
                  value={formData.patientPassword}
                  onChange={handleChange}
                  required
                />
              </div>


              <button type="submit">
                Add Patient
              </button>
              

            </form>

            <table className="patients-table">

              <thead>

                <tr>

                  <th>
                    Name
                  </th>

                  <th>
                    Cancer
                  </th>

                  <th>
                    Stage
                  </th>

                  <th>
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody>

                {patients.map((patient) => (

                  <tr key={patient._id}>

                    <td>
                      {patient.name}
                    </td>

                    <td>
                      {patient.cancerType}
                    </td>

                    <td>
                      {patient.stage}
                    </td>

                    <td>

                      <button
                        className="report-btn"
                        onClick={() => setSelectedPatient(patient._id)}
                        
                        >
                          Report
                        </button>

                      <button
                        className="edit-btn"
                        onClick={() => setEditForm(patient)}
                      >
                        Edit
                      </button>

                      <button
                        className="delete-btn"
                        onClick={() => deletePatient(patient._id)}
                      >
                        Delete
                      </button>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </>
        )}

        {activePage === "testing" && (

          <>
            <h1>
              Testing and cancer diagnosis
            </h1>

            <div className="testing-grid">

              <Link to="/Imaging" state={{ from: "doctor" }} className="testing-card">

              <img src="./imgs/imaging.jpg" className="iim" />

                <h2>
                  Imaging Testing
                </h2>

                <p>
                  cancer scan analysis: MRI and CT
                </p>

                <button className="bb">
                  insert scan data
                </button>

              </Link>

              <Link to="/Clinical" state={{ from: "doctor" }} className="testing-card">

              <img src="./imgs/clinical.jpg" className="iim" />

                <h2>
                  Clinical Testing
                </h2>

                <p>
                  Overall survival prediction based on clinical data
                </p>

                <button className="bb">
                  insert clinical data
                </button>

              </Link>

              <Link to="/Genomic" state={{ from: "doctor" }} className="testing-card">

              <img src="./imgs/genomic.jpg" className="iim" />

                <h2>
                  Genomic Testing
                </h2>

                <p>
                  cancer diagnosis based on genomic data: testing on RNA seq data
                </p>

                <button className="bb">
                  insert genomic data
                </button>

              </Link>

            </div>

          </>
        )}

        {activePage === "reports" && (

          <>
            <h1>
              Reports
            </h1>

            <div className="reports-grid">

              {patients.map((patient) => (

                <div
                  className="report-card"
                  key={patient._id}
                >

                  <img src="./imgs/report.png" className="rep" />

                  <h3>
                    {patient.name}
                  </h3>

                  <p>
                    Cancer: {patient.cancerType}
                  </p>

                  <p>
                    Stage: {patient.stage}
                  </p>

                  <p>
                    Treatment Started: {patient.treatmentStarted}
                  </p>

                  <button
                    onClick={() =>
                          navigate(`/reports/${patient._id}`)
                        }
                  >
                    View Report
                  </button>

                </div>

              ))}

            </div>

          </>
        )}

        {activePage === "treatment" && (

          <>
            <h1>
              Treatment Follow Up
            </h1>

            <div className="treatment-grid">

              {patients.map((patient) => (

                <div
                  className="treatment-card"
                  key={patient._id}
                >

                  <h3>
                    {patient.name}
                  </h3>

                  <p>
                    {patient.cancerType}
                  </p>

                  <select onChange={(e) => setSelectedTreatment(e.target.value)}>

                    <option>
                      Chemotherapy
                    </option>

                    <option>
                      Radiotherapy
                    </option>

                    <option>
                      Immunotherapy
                    </option>

                    <option>
                      Surgery
                    </option>

                  </select>

                  <div className="treatment-actions">

                    <button type="button" className="a" onClick={() => addTreatment(patient._id)}>
                      Add
                    </button>

                    <div className="treatment-list">

                     {patient.treatments?.map((t) => (
                        
                       <div
                         key={t._id}
                         className="single-treatment"
                       >
                          
                         <p>
                           {t.type}
                         </p>
                        
                         <small>
                           {t.date}
                         </small>
                        
                         <div className="treatment-actions">
                        
                           <button type="button" className="e"
                             onClick={() =>
                               setEditTreatment({
                                 patientId: patient._id,
                                 _id: t._id,
                                 type: t.type
                               })
                             }
                           >
                             Edit
                           </button>
                              
                           <button type="button" className="d"
                             onClick={() =>
                               deleteTreatment(
                                 patient._id,
                                 t._id
                               )
                             }
                           >
                             Delete
                           </button>
                              
                         </div>
                              
                       </div>
            
                     ))}
            
                   </div>

                  </div>

                </div>

              ))}

            </div>

          </>
        )}

        {editForm && (
          <div className="modal-overlay">

    <div className="modal">

      <h2>Edit Patient</h2>

      <input
        name="name"
        value={editForm.name}
        onChange={handleEditChange}
      />

      <input
        name="age"
        type="number"
        value={editForm.age}
        onChange={handleEditChange}
      />

      <input
        name="weight"
        type="number"
        value={editForm.weight}
        onChange={handleEditChange}
      />

      <input
        name="cancerType"
        value={editForm.cancerType}
        onChange={handleEditChange}
      />

      <select
        name="stage"
        value={editForm.stage}
        onChange={handleEditChange}
      >
        <option>Stage I</option>
        <option>Stage II</option>
        <option>Stage III</option>
        <option>Stage IV</option>
      </select>

      <select
        name="treatmentStarted"
        value={editForm.treatmentStarted}
        onChange={handleEditChange}
      >
        <option>Yes</option>
        <option>No</option>
      </select>

      <input
        name="patientUsername"
        value={editForm.patientUsername}
        onChange={handleEditChange}
      />

      

      <div className="modal-actions">

        <button onClick={updatePatient}>
          Save
        </button>

        <button onClick={() => setEditForm(null)}>
          Cancel
        </button>

      </div>

    </div>

          </div>
        )}

        {editTreatment && (

  <div className="modal-overlay">

    <div className="modal">

      <h2>
        Edit Treatment
      </h2>

      <select
        value={editTreatment.type}
        onChange={(e) =>
          setEditTreatment({
            ...editTreatment,
            type: e.target.value
          })
        }
      >

        <option>
          Chemotherapy
        </option>

        <option>
          Radiotherapy
        </option>

        <option>
          Immunotherapy
        </option>

        <option>
          Surgery
        </option>

      </select>

      <div className="modal-actions">

        <button
          onClick={updateTreatment}
        >
          Save
        </button>

        <button
          onClick={() =>
            setEditTreatment(null)
          }
        >
          Cancel
        </button>

      </div>

    </div>

  </div>
)}

{selectedPatient && (
  <ReportModal
    patientId={selectedPatient}
    onClose={() => setSelectedPatient(null)}
    onSaved={() => fetchPatients()}
  />
)}

{selectedPatientForMessage && (
          <MessageModal
            patient={selectedPatientForMessage}
            token={token}
            onClose={() => setSelectedPatientForMessage(null)}
            onMessageSent={handleMessageSent}
          />
        )}

      </main>

    </div>
  );
}