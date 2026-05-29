import { useEffect, useState } from "react";
import "./Admin.css";

export default function AdminDashboard() {

  const [users, setUsers] = useState([]);
  const [patients, setPatients] = useState([]);

  const [activePage, setActivePage] = useState("dashboard");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("doctor");

  const [editUser, setEditUser] = useState(null);

  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");

  // fetch users
  const fetchUsers = async () => {

    try {

      const res = await fetch(
        "http://localhost:5000/admin/users",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (res.status === 401) {

        localStorage.clear();

        window.location.href = "/";

        return;
      }

      const data = await res.json();

      setUsers(data);

    } catch (err) {

      console.log(err);
    }
  };

  // fetch patients
  const fetchPatients = async () => {

    try {

      const res = await fetch(
        "http://localhost:5000/patients",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (res.status === 401) {

        localStorage.clear();

        window.location.href = "/";

        return;
      }

      const data = await res.json();

      setPatients(data);

    } catch (err) {

      console.log(err);
    }
  };

  useEffect(() => {

    if (!token) {

      window.location.href = "/";

      return;
    }

    const loadData = async () => {

      await fetchUsers();

      await fetchPatients();

      setLoading(false);
    };

    loadData();

  }, []);

  // add user
  const addUser = async (e) => {

    e.preventDefault();

    try {

      const res = await fetch(
        "http://localhost:5000/admin/users",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },

          body: JSON.stringify({
            username,
            password,
            role
          })
        }
      );

      const data = await res.json();

      alert(data.message);

      fetchUsers();

      setUsername("");
      setPassword("");
      setRole("doctor");

    } catch (err) {

      console.log(err);
    }
  };

  // delete user
  const deleteUser = async (id) => {

    try {

      const res = await fetch(
        `http://localhost:5000/admin/users/${id}`,
        {
          method: "DELETE",

          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await res.json();

      alert(data.message);

      fetchUsers();

    } catch (err) {

      console.log(err);
    }
  };

  // start edit
  const startEdit = (user) => {

    setEditUser({
      ...user,
      password: ""
    });

    setUsername(user.username);

    setRole(user.role);

    setPassword("");
  };

  // update user
  const updateUser = async (e) => {

    e.preventDefault();

    try {

      const res = await fetch(
        `http://localhost:5000/admin/users/${editUser._id}`,
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },

          body: JSON.stringify({
            username: editUser.username,
            password: editUser.password,
            role: editUser.role
          })
        }
      );

      const data = await res.json();

      alert(data.message);

      setEditUser(null);

      fetchUsers();

    } catch (err) {

      console.log(err);
    }
  };

  // stats
  const doctorsCount = users.filter(
    user => user.role === "doctor"
  ).length;

  const researchersCount = users.filter(
    user => user.role === "researcher"
  ).length;

  const cancerCounts = {};

  patients.forEach((patient) => {

    const cancer = patient.cancerType;

    if (cancerCounts[cancer]) {

      cancerCounts[cancer]++;

    } else {

      cancerCounts[cancer] = 1;
    }
  });

  const mostCommonCancer =
    Object.keys(cancerCounts).length > 0
      ? Object.keys(cancerCounts).reduce((a, b) =>
          cancerCounts[a] > cancerCounts[b]
            ? a
            : b
        )
      : "No Data";

  const averageSurvivalRate =
    patients.length > 0
      ? Math.round(
          patients.reduce(
            (sum, patient) =>
              sum + Number(patient.survivalRate || 0),
            0
          ) / patients.length
        )
      : 0;

  const highRiskPatients =
    patients.filter(
      patient => patient.riskLevel === "High"
    ).length;

  if (loading) {

    return <h1>Loading...</h1>;
  }

  return (
    <div className="admin-layout">

      <aside className="sidebar">

        <div>

          <div className="sidebar-header">

            <h1 className="sidebar-title">
              Admin Panel
            </h1>

            <p className="sidebar-subtitle">
              MedIntel Management
            </p>

          </div>

          <nav className="sidebar-nav">

            <button
              className={
                activePage === "dashboard"
                  ? "sidebar-btn active-btn"
                  : "sidebar-btn"
              }
              onClick={() =>
                setActivePage("dashboard")
              }
            >
              Dashboard
            </button>

            <button
              className={
                activePage === "users"
                  ? "sidebar-btn active-btn"
                  : "sidebar-btn"
              }
              onClick={() =>
                setActivePage("users")
              }
            >
              Control Users
            </button>

            <button
              className={
                activePage === "patients"
                  ? "sidebar-btn active-btn"
                  : "sidebar-btn"
              }
              onClick={() =>
                setActivePage("patients")
              }
            >
              View All Patients
            </button>

          </nav>

        </div>

        <div className="sidebar-footer">

          <button
            className="logout-btn"
            onClick={() => {

              localStorage.clear();

              window.location.href = "/";
            }}
          >
            Logout
          </button>

        </div>

      </aside>

      <main className="main-content">


        {activePage === "dashboard" && (

          <>
            <div className="top-header">

              <div>

                <h2 className="page-title">
                  Dashboard
                </h2>

                <p className="page-subtitle">
                  MedIntel system overview
                </p>

              </div>

              <div className="admin-card">

                <img src="./imgs/admin.png" alt="admin" className="imgadmin"/>

                <p className="admin-label">
                  Logged in as
                </p>

                <p className="admin-role">
                  Admin
                </p>

              </div>

            </div>

            <div className="stats-grid">

              <div className="stat-card">

                <p className="stat-label" style={{ fontSize: "30px" }}>
                  Total Doctors
                </p>

                <h3 className="stat-number">
                  {doctorsCount}
                </h3>

              </div>

              <div className="stat-card">

                <p className="stat-label" style={{ fontSize: "30px" }}>
                  Total Researchers
                </p>

                <h3 className="stat-number">
                  {researchersCount}
                </h3>

              </div>

              <div className="stat-card">

                <p className="stat-label" style={{ fontSize: "30px" }}>
                  Total Patients
                </p>

                <h3 className="stat-number">
                  {patients.length}
                </h3>

              </div>

            </div>

            <div className="cancer-section">

              <div className="section-header">

                <h2 className="section-title">
                  Cancer Statistics
                </h2>

                <p className="page-subtitle">
                  Overview of patient cancer data
                </p>

              </div>

              <div className="cancer-grid">

                <div className="cancer-card">

                  <h3 className="cancer-title">
                    Most Common Cancer
                  </h3>

                  <p className="cancer-value">
                    {mostCommonCancer}
                  </p>

                  <span className="cancer-info">
                    {cancerCounts[mostCommonCancer] || 0} cases
                  </span>

                </div>

                <div className="cancer-card">

                  <h3 className="cancer-title">
                    Survival Rate
                  </h3>

                  <p className="cancer-value">
                    {averageSurvivalRate}%
                  </p>

                  <span className="cancer-info">
                    Average prediction
                  </span>

                </div>

                <div className="cancer-card">

                  <h3 className="cancer-title">
                    High Risk Cases
                  </h3>

                  <p className="cancer-value">
                    {highRiskPatients}
                  </p>

                  <span className="cancer-info">
                    Require attention
                  </span>

                </div>

              </div>

            </div>

          </>
        )}


        {activePage === "users" && (

          <>
            <div className="top-header">

              <div>

                <h2 className="page-title">
                  Control Users
                </h2>

                <p className="page-subtitle">
                  Manage doctors and researchers
                </p>

              </div>

            </div>

            <div className="form-card">

              <form
                className="user-form"
                onSubmit={editUser ? updateUser : addUser}
              >

                <div>

                  <label className="input-label">
                    Username
                  </label>

                  <input
                    type="text"
                    placeholder="Enter username"
                    className="form-input"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value)
                    }
                    required
                  />

                </div>

                <div>

                  <label className="input-label">
                    Password
                  </label>

                  <input
                    type="password"
                    placeholder="Enter password"
                    className="form-input"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    required={!editUser}
                  />

                </div>

                <div>

                  <label className="input-label">
                    Role
                  </label>

                  <select
                    className="form-input"
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value)
                    }
                  >

                    <option value="doctor">
                      Doctor
                    </option>

                    <option value="researcher">
                      Researcher
                    </option>

                  </select>

                </div>

                <div className="button-container">

                  <button
                    type="submit"
                    className="submit-btn"
                  >
                    {editUser ? "Update User" : "Add User"}
                  </button>

                </div>

              </form>

            </div>

            <div className="table-card">

              <h3 className="section-title">
                Doctors & Researchers List
              </h3>

              <table className="users-table">

                <thead>

                  <tr>

                    <th>
                      Username
                    </th>

                    <th>
                      Role
                    </th>

                    <th>
                      Action
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {users.map((user) => (

                    <tr key={user._id}>

                      <td className="user-info">

                        <img
                          src={
                            user.role === "doctor"
                              ? "/imgs/doctor.png"
                              : "/imgs/researcher.png"
                          }
                          alt={user.role}
                          className="user-avatar"
                        />

                        <span>
                          {user.username}
                        </span>
                        
                      </td>

                      <td>
                        {user.role}
                      </td>

                      <td>

                        <button
                          className="edit-btn"
                          onClick={() => startEdit(user)}
                        >
                          Edit
                        </button>

                        {user.role !== "admin" && (

                          <button
                            className="delete-btn"
                            onClick={() =>
                              deleteUser(user._id)
                            }
                          >
                            Delete
                          </button>

                        )}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

            {editUser && (

              <div className="modal-overlay">

                <div className="modal">

                  <h2>Edit User</h2>

                  <input
                    value={editUser.username}
                    onChange={(e) =>
                      setEditUser({
                        ...editUser,
                        username: e.target.value
                      })
                    }
                    placeholder="Username"
                  />

                  <input
                    type="password"
                    onChange={(e) =>
                      setEditUser({
                        ...editUser,
                        password: e.target.value
                      })
                    }
                    placeholder="New Password"
                  />

                  <select
                    value={editUser.role}
                    onChange={(e) =>
                      setEditUser({
                        ...editUser,
                        role: e.target.value
                      })
                    }
                  >

                    <option value="doctor">
                      Doctor
                    </option>

                    <option value="researcher">
                      Researcher
                    </option>

                  </select>

                  <div className="modal-actions">

                    <button onClick={updateUser}>
                      Save
                    </button>

                    <button onClick={() => setEditUser(null)}>
                      Cancel
                    </button>

                  </div>

                </div>

              </div>

            )}

          </>
        )}


        {activePage === "patients" && (

          <>
            <div className="top-header">

              <div>

                <h2 className="page-title">
                  All Patients
                </h2>

                <p className="page-subtitle">
                  View all patients and diagnosis
                </p>

              </div>

            </div>

            <div className="table-card">

              <table className="users-table">

                <thead>

                  <tr>

                    <th>
                      Name
                    </th>

                    <th>
                      Age
                    </th>

                    <th>
                      Diagnosis
                    </th>

                    <th>
                      Added By
                    </th>
                    

                  </tr>

                </thead>

                <tbody>

                  {patients.map((patient) => (

                    <tr key={patient._id}>


                      <td className="user-info">
                        <img
                          src="./imgs/ppat.jpg"
                          className="user-avatar"
                        />
                        <span>{patient.name}</span>
                      </td>

                      <td>
                        {patient.age}
                      </td>

                      <td>
                        {patient.cancerType} - Stage {patient.stage}
                      </td>

                      <td>
                        {patient.createdBy}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </>
        )}

      </main>

    </div>
  );
}