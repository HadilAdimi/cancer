import React from 'react'
import Home from './pages/Home';
import Login from './pages/Login';
import { Routes, Route } from "react-router-dom";
import Admin from './pages/Admin';
import Doctor from './pages/Doctor';
import Patient from './pages/Patient';
import Imaging from './pages/Imaging';
import Genomic from './pages/Genomic';
import Clinical from './pages/Clinical';
import PatientTimeline from './pages/PatientTimeline';
import Researcher from './pages/Researcher';


export default function App() {
  return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/doctor" element={<Doctor />} />
        <Route path="/patient" element={<Patient />} />
        <Route path="/imaging" element={<Imaging />} />
        <Route path="/Genomic" element={<Genomic />} />
        <Route path="/Clinical" element={<Clinical />} />
        <Route path="/reports/:patientId" element={<PatientTimeline />} />
        <Route path="/researcher" element={<Researcher />} />
      </Routes>
  );
}