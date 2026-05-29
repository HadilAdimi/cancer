import { useState } from "react";
import { loginUser } from "../services/api";
import "./Login.css";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    console.log("sending request");

    const data = await loginUser(username.trim(), password.trim());

    console.log(data);

    if (data.token) {
    
      localStorage.setItem("token", data.token);
    
      localStorage.setItem("role", data.role);
    
      redirectUser(data.role);
    
    } else {
    
      alert("Login failed");
    }

  } catch (err) {
    alert(err.message || "An error occurred");
  }
};

  const redirectUser = (role) => {

  if (role === "admin") {
    window.location.href = "/admin";
  }

  if (role === "doctor") {
    window.location.href = "/doctor";
  }

  if (role === "researcher") {
    window.location.href = "/researcher";
  }

  if (role === "patient") {
    window.location.href = "/patient";
  }
};


  return (
    <div className="login-page">
      <div >
        <button onClick={() => window.history.back()} className="back-btn">
          &larr; Home
        </button>
      </div>

      <div className="img">
        <img src="/imgs/login4.png" className="img" />
      </div>

      <div className="login-card">

        <h1 className="login-title">Welcome Back</h1>
        <p className="login-subtitle">Log in to your account</p>

        <form className="login-form" onSubmit={handleSubmit}>

          <input
            type="text"
            placeholder="User Name"
            className="login-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="login-options">
            <label>
              <input type="checkbox" />
              Remember me
            </label>

          </div>

          <button type="submit" className="loginbtn">
            Log in
          </button>

        </form>

      </div>
    </div>
  );
};

export default Login;