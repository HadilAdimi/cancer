import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Patient.css";

export default function Patient() {
  const [patientData, setPatientData] = useState(null);
  const [reports, setReports] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef(null);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchPatientData = useCallback(async () => {
    if (!token) return;
    
    try {
      console.log("Fetching patient data...");
      
      const profileRes = await fetch("http://localhost:5000/patients/profile/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!profileRes.ok) {
        throw new Error("Failed to fetch profile");
      }
      
      const profileData = await profileRes.json();
      console.log("Profile data:", profileData);
      setPatientData(profileData);

      if (profileData && profileData._id) {
        const reportsRes = await fetch(`http://localhost:5000/reports/patient/${profileData._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const allReports = await reportsRes.json();
        const sentReports = allReports.filter(r => r.sendToPatient === true);
        setReports(sentReports);

        const treatmentsRes = await fetch(`http://localhost:5000/patients/${profileData._id}/treatments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const allTreatments = await treatmentsRes.json();
        const sentTreatments = allTreatments.filter(t => t.sentToPatient === true);
        setTreatments(sentTreatments);

        const messagesRes = await fetch("http://localhost:5000/patients/messages/patient", {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!messagesRes.ok) {
          throw new Error(`Failed to fetch messages: ${messagesRes.status}`);
        }

        const messagesData = await messagesRes.json();
        setMessages(Array.isArray(messagesData) ? messagesData : []);
      }
    } catch (err) {
      console.error("Error fetching patient data:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    fetchPatientData();
    
    const interval = setInterval(() => {
      console.log("Auto-refreshing patient data...");
      fetchPatientData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [token, navigate, fetchPatientData]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    setSending(true);
    
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      text: messageText,
      sender: "patient",
      createdAt: new Date().toISOString(),
      read: false
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    
    try {
      console.log("Sending message:", messageText);
      
      const response = await fetch("http://localhost:5000/patients/messages/patient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: messageText })
      });
      
      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      
      const savedMessage = await response.json();
      console.log("Saved message:", savedMessage);
      
      setMessages(prev => prev.map(msg => 
        msg._id === tempId ? savedMessage : msg
      ));
      
    } catch (err) {
      console.error("Send message error:", err);
      setMessages(prev => prev.filter(msg => msg._id !== tempId));
      alert(`Failed to send message: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  

  if (loading) {
    return <div className="patient-loading">Loading your dashboard...</div>;
  }

  if (!patientData) {
    return <div className="patient-error">Failed to load patient data</div>;
  }

  return (
    <div className="patientlayout">
      <aside className="patientsidebar">
        <div className="side">
          <h2 className="patienttitle">Patient Portal</h2>
          <p style={{ fontSize: "14px", color: "#b0bbca", textAlign: "center" }}>
            Welcome, {patientData.name}
          </p>
        </div>

        <button
          className={activeTab === "overview" ? "patientsidebar-b activebtn" : "patientsidebar-b"}
          onClick={() => setActiveTab("overview")}
        >
          Health Overview
        </button>

        <button
          className={activeTab === "reports" ? "patientsidebar-b activebtn" : "patientsidebar-b"}
          onClick={() => setActiveTab("reports")}
        >
          Medical Reports
          {reports.length > 0 && <span className="notification-badge">{reports.length}</span>}
        </button>

        <button
          className={activeTab === "treatments" ? "patientsidebar-b activebtn" : "patientsidebar-b"}
          onClick={() => setActiveTab("treatments")}
        >
          Treatment Plan
          {treatments.length > 0 && <span className="notification-badge">{treatments.length}</span>}
        </button>

        <button
          className={activeTab === "messages" ? "patientsidebar-b activebtn" : "patientsidebar-b"}
          onClick={() => setActiveTab("messages")}
        >
          Messages
          {messages.filter(m => m.sender === "doctor" && !m.read).length > 0 && (
            <span className="notification-badge">{messages.filter(m => m.sender === "doctor" && !m.read).length}</span>
          )}
        </button>

        
        <button
          className="logoutbtn"
          onClick={() => {
            localStorage.clear();
            navigate("/");
          }}
        >
          Logout
        </button>
      </aside>

      <main className="patientmain">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
          <div className="top-header">
            <h1>My Health Overview</h1>
            <div className="admin-card">

                <img src="./imgs/ppat.jpg" alt="admin" className="imgadmin"/>

                <p className="admin-label">
                  Logged in as
                </p>

                <p className="admin-role">
                  Patient
                </p>

              </div></div>
            
            <div className="healthcard">
              <div className="healthheader">
                <img src="/imgs/patienti.png" alt="patient" className="patientavatar-large" />
                <div className="healthtitle">
                  <h2>{patientData.name}</h2>
                  <p className="patientid-text">Patient ID: {patientData._id}</p>
                </div>
              </div>
              
              <div className="healthdetails-grid">
                <div className="detailitem">
                  <span className="detaillabel">Age</span>
                  <span className="detailvalue">{patientData.age} years</span>
                </div>
                <div className="detailitem">
                  <span className="detaillabel">Weight</span>
                  <span className="detailvalue">{patientData.weight} kg</span>
                </div>
                <div className="detailitem">
                  <span className="detaillabel">Cancer Type</span>
                  <span className="detailvalue cancertype">{patientData.cancerType}</span>
                </div>
                <div className="detailitem">
                  <span className="detaillabel">Stage</span>
                  <span className="detailvalue stagebadge">{patientData.stage}</span>
                </div>
                <div className="detailitem">
                  <span className="detaillabel">Treatment Started</span>
                  <span className={`detailvalue ${patientData.treatmentStarted === "Yes" ? "statusyes" : "statusno"}`}>
                    {patientData.treatmentStarted}
                  </span>
                </div>
              </div>
            </div>

            <div className="statsgrid">
              <div className="statcard">
                <h3>{reports.length}</h3>
                <p>Medical Reports</p>
              </div>
              <div className="statcard">
                <h3>{treatments.length}</h3>
                <p>Treatments</p>
              </div>
              <div className="statcard">
                <h3>{messages.filter(m => m.sender === "doctor").length}</h3>
                <p>Messages from Doctor</p>
              </div>
            </div>
          </>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <>
            <h1>My Medical Reports</h1>
            <p className="tabdescription">Reports shared by your doctor</p>
            
            {reports.length === 0 ? (
              <div className="emptystate">
                <img src="/imgs/no-reports.png" alt="no reports" className="emptyimg" />
                <p>No reports have been shared with you yet.</p>
                <small>When your doctor shares reports, they will appear here.</small>
                <button onClick={refreshData} className="emptybtn">Check for new reports</button>
              </div>
            ) : (
              <div className="reportstimeline">
                {reports.map((report) => (
                  <div key={report._id} className="reporttimeline-item">
                    <div className="reporttimeline-header">
                      <span className="reportdate">
                         {new Date(report.createdAt).toLocaleDateString()}
                      </span>
                      <span className="reportbadge">Medical Report</span>
                    </div>
                    <div className="reporttimeline-content">
                      <p>{report.text}</p>
                      {report.file && (
                        <a 
                          href={`http://localhost:5000/uploads/${report.file}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="reportfile-link"
                        >
                          Download Attachment
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Treatments Tab */}
        {activeTab === "treatments" && (
          <>
            <h1>My Treatment Plan</h1>
            <p className="tabdescription">Treatments shared by your doctor</p>
            
            {treatments.length === 0 ? (
              <div className="emptystate">
                <img src="/imgs/no-treatments.png" alt="no treatments" className="emptyimg" />
                <p>No treatments have been shared with you yet.</p>
                <small>Your doctor will share treatment information here.</small>
                <button onClick={refreshData} className="emptybtn">Check for new treatments</button>
              </div>
            ) : (
              <div className="treatmentsgrid">
                {treatments.map((treatment, index) => (
                  <div key={treatment._id} className="treatmentplan-card">
                    <div className="treatmentplan-header">
                      <span className="treatmentnumber">Treatment #{index + 1}</span>
                      <span className="treatmentdate">{treatment.date}</span>
                    </div>
                    <div className="treatmentplan-body">
                      <div className="treatmenticon">
                        {treatment.type === "Chemotherapy" && (
                          <img src="/imgs/chemotherapy.png"  className="treatmenticon-img" />
                        )}
                        {treatment.type === "Radiotherapy" && (
                          <img src="/imgs/radiotherapy.png"  className="treatmenticon-img" />
                        )}
                        {treatment.type === "Immunotherapy" && (
                          <img src="/imgs/immunotherapy.png"  className="treatmenticon-img" />
                        )}
                        {treatment.type === "Surgery" && (
                          <img src="/imgs/surgery.png"  className="treatmenticon-img" />
                        )}
                      </div>
                      <div className="treatmentinfo">
                        <h3>{treatment.type}</h3>
                        <p>This treatment has been prescribed as part of your care plan.</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Messages Tab */}
        {activeTab === "messages" && (
          <>
            <h1>Messages with Your Doctor</h1>
            
            <div className="chatcontainer">
              <div className="chatmessages">
                {messages.length === 0 ? (
                  <div className="emptychat">
                    <p>No messages yet.</p>
                    <small>Send a message to your doctor to start the conversation.</small>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div 
                      key={message._id} 
                      className={`chatbubble ${message.sender === "patient" ? "sent" : "received"}`}
                    >
                      <div className="chatsender">
                        {message.sender === "patient" ? "You" : "Doctor"}
                      </div>
                      <div className="chattext">{message.text || "No content"}</div>
                      <div className="chattime">
                        {message.createdAt ? new Date(message.createdAt).toLocaleString() : "Just now"}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <form onSubmit={sendMessage} className="chatinput-form">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="chatinput"
                  disabled={sending}
                />
                <button type="submit" className="chatsend-btn" disabled={sending}>
                  {sending ? "Sending..." : "Send 📤"}
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}