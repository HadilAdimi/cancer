
export const loginUser = async (
  username,
  password
) => {

  const res = await fetch(
    "http://localhost:5000/auth/login",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        username: username,
        password: password
      })
    }
  );

  const data = await res.json();

  if (!res.ok) {

    throw new Error(
      data.message
    );
  }

  return data;
};

import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000"
});

API.interceptors.request.use((req) => {

  const token = localStorage.getItem("token");

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  return req;
});

export default API;