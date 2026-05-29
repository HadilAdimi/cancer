import React, { useState, useEffect } from "react";
import axios from "axios";
import "./Clinical.css";
import { useNavigate, useLocation } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line
} from "recharts";

export default function Clinical() {

  const navigate = useNavigate();
  const location = useLocation();
  const [fromPage, setFromPage] = useState("researcher"); // Default to researcher

  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState(null);

  useEffect(() => {
    const userRole = localStorage.getItem("userRole");
    const from = location.state?.from || "researcher";
    
    // Check if user is doctor
    if (userRole === "doctor") {
      setFromPage("doctor");
    } else if (from === "doctor") {
      setFromPage("doctor");
    } else {
      setFromPage("researcher");
    }
  }, [location]);

  const [form, setForm] = useState({
    age: "",
    weight: "",
    gender: "",
    acronym: "",
    pathologic_stage: "",
    pathologic_T: "",
    pathologic_N: "",
    pathologic_M: "",
    grade: "unknown",
    radiation_therapy: "unknown",
    postoperative_rx_tx: "unknown",
    targeted_molecular_therapy: "unknown",
    residual_tumor: "unknown",
    margin_status: "unknown",
    karnofsky_performance_score: "",
    lymph_node_examined_count: 0,
    number_of_lymphnodes_positive: 0
  });

  const setField = (key, value) => {

    const updated = { ...form, [key]: value };

    if (key === "pathologic_stage" || key === "pathologic_M") {
      const stage = (updated.pathologic_stage || "").toLowerCase();
      const m = (updated.pathologic_M || "").toLowerCase();

      const earlyStage = ["stage i", "stage ii"].includes(stage);

      if (earlyStage && m === "m1") {
        updated.pathologic_M = "m0";
      }
    }

    setForm(updated);
  };

  const submit = async () => {
  setLoading(true);

  const payload = {
    ...form,
    age: Number(form.age || 0),
    weight: Number(form.weight || 0),
    karnofsky_performance_score: Number(form.karnofsky_performance_score || 50),
    lymph_node_examined_count: Number(form.lymph_node_examined_count || 0),
    number_of_lymphnodes_positive: Number(form.number_of_lymphnodes_positive || 0)
  };

  try {
    const res = await axios.post(
      "http://127.0.0.1:8000/predict",
      payload
    );

    setResult(res.data);
  } catch (err) {
    console.log(err.response?.data);
    alert("Prediction failed");
  } finally {
    setLoading(false);
  }
};

  const survivalData = result
    ? [
        {
          name: "1 Year",
          value: result.survival_probability_percent?.["1_year"] || 0
        },
        {
          name: "3 Years",
          value: result.survival_probability_percent?.["3_year"] || 0
        },
        {
          name: "5 Years",
          value: result.survival_probability_percent?.["5_year"] || 0
        }
      ]
    : [];

    const isValidCombination = () => {
    const stage = (form.pathologic_stage || "").toLowerCase();
    const m = (form.pathologic_M || "").toLowerCase();

    if (!stage || !m) return true;

    const earlyStage = ["stage i", "stage ii"].includes(stage);

    if (earlyStage && m === "m1") {
      return false;
    }

    return true;
  };

  const valid = isValidCombination();

  const genderOptions = ["unknown", "male", "female"];

  const cancerOptions = [
    "Glioblastoma multiforme : Brain",
    "Lower grade glioma : Brain",
    "Lung adenocarcinoma : Lung",
    "Lung squamous cell carcinoma : Lung",
    "kidney chromophobe : Kidney",
    "Kidney renal clear cell carcinoma : Kidney",
    "Kidney renal papillary cell carcinoma : Kidney",
    "Esophageal carcinoma : Esophagus",
    "Colon adenocarcinoma : Colon",
    "Stomack adenocarcinoma : Stomach",
    "Rectum adenocarcinoma : Rectum",
    "Liver hepatocellular carcinoma : Liver",
    "Cholangiocarcinoma : Bile Duct in liver",
    "Pancreatic adenocarcinoma : Pancreas",
    "Breast invasive carcinoma : Breast",
    "Ovarian serous cystadenocarcinoma : Ovary",
    "Cervical squamous cell carcinoma and endocervical adenocarcinoma : Cervix",
    "Uterine corpus endometrial carcinoma : Uterus",
    "Uterine corpus endometrial carcinoma : Uterus lining",
    "Bladder urothelial carcinoma : Bladder",
    "Testicular germ cell tumors : Testicals",
    "Prostate adenocarcinoma : Prostate",
    "Thyroid carcinoma : Thyroid gland",
    "Pheochromocytoma and paraganglioma : Adrenal gland and nearby nerve tissue",
    "Adrenocortical carcinoma : Adrenal gland",
    "Skin cutaneous melanoma : Skin",
    "Head and Neck squamous cell carcinoma : Mouth, throat, larynx",
    "Mesothelioma : Lining of lungs and chest wall",
    "Sarcoma : Connective soft tissues and bone ",
    "Thymoma : Thymus gland in chest",
    "Diffuse large B-cell lymphoma : Lymph nodes and lymphatic system",
    "Uveal melanoma : Eye"
  ];

  const karnofsky =[
    {label:"100 : Normal life", value:100},
    {label:"90,70 : Can take care of him self", value:80},
    {label:"60,40 : Need help with daily tasks", value:50},
    {label:"30,10 : Very sick", value:20},
    {label:"0 : Death", value:0}
  ];

  const yesNoUnknown = [
    "yes",
    "no",
    "unknown"
  ];

  const stageOptions = ["stage i", "stage ii", "stage iii", "stage iv"];

  const tOptions = ["t1", "t2", "t3", "t4", "unknown"];
  const nOptions = ["n0", "n1", "n2", "n3", "unknown"];
  const mOptions = ["m0", "m1"];

  const gradeOptions = ["low", "medium", "high", "unknown"];

  const getRiskColor = (value) => {

    if (value < 30) return "#4cde82";

    if (value < 70) return "#ebb251";

    return "#eb4848";
  };

  const getRiskColorH = (value) => {

    if (value < 3) return "#4cde82";

    if (value < 6) return "#ebb251";

    return "#eb4848";
  };

  const getRiskColorS = (value) => {

    if (value < 40) return " #eb4848";

    if (value < 70) return "#ebb251";

    return "#4cde82";
  };

  const downloadPDF = async () => {

  if (!result) return;

  const pdf = new jsPDF("p", "mm", "a4");

  let y = 20;

  pdf.setFontSize(22);
  pdf.text("Clinical Cancer Prediction Report", 20, y);

  y += 15;

  pdf.setFontSize(13);

  pdf.text(`Age: ${form.age}`, 20, y);
  y += 8;

  pdf.text(`Weight: ${form.weight}`, 20, y);
  y += 8;

  pdf.text(`Gender: ${form.gender}`, 20, y);
  y += 8;

  pdf.text(`Cancer Type: ${form.acronym}`, 20, y);
  y += 8;

  pdf.text(`Stage: ${form.pathologic_stage}`, 20, y);
  y += 8;

  pdf.text(
    `TNM: ${form.pathologic_T} ${form.pathologic_N} ${form.pathologic_M}`,
    20,
    y
  );

  y += 15;

  const hazardChart = document.getElementById("hazard-chart");
  const riskChart = document.getElementById("risk-chart");
  const survivalChart = document.getElementById("survival-chart");

  const hazardCanvas = await html2canvas(hazardChart);
  const riskCanvas = await html2canvas(riskChart);
  const survivalCanvas = await html2canvas(survivalChart);

  const hazardImg = hazardCanvas.toDataURL("image/png");
  const riskImg = riskCanvas.toDataURL("image/png");
  const survivalImg = survivalCanvas.toDataURL("image/png");

  pdf.setFontSize(18);
  pdf.text("Prediction Charts", 20, y);

  y += 10;

  pdf.addImage(hazardImg, "PNG", 15, y, 80, 60);

  pdf.addImage(riskImg, "PNG", 110, y, 80, 60);

  y += 70;

  pdf.addImage(survivalImg, "PNG", 15, y, 180, 80);

  y += 90;

  pdf.setFontSize(14);

  pdf.text(
    `Median Survival: ${result.median_survival_days} days`,
    20,
    y
  );

  pdf.save("clinical_prediction_report.pdf");
};
const handleBack = () => {
    if (fromPage === "doctor") {
      navigate("/doctor");
    } else {
      navigate("/researcher");
    }
  };

  return (
    <div className="clinical-page">

      <button
        className="back"
        onClick={handleBack}
      >
        Back
      </button>

      <div className="clinical-header">

        <h1>
          Clinical Cancer Prediction
        </h1>

        <p>
          Predict cancer risk and survival probability
        </p>

      </div>

      <div className="clinical-card">

        <div className="clinical-form">

          <div className="field">

            <label>
              Age
            </label>

            <input
              type="number"
              value={form.age}
              onChange={(e) =>
                setField("age", Number(e.target.value))
              }
            />

          </div>

          <div className="field">

            <label>
              Weight
            </label>

            <input
              type="number"
              value={form.weight}
              min="30"
              max="150"
              onChange={(e) =>
                setField("weight", Number(e.target.value))
              }
            />

          </div>

          <div className="field">

            <label>
              Gender
            </label>

            <select
              value={form.gender}
              onChange={(e) =>
                setField("gender", e.target.value)
              }
            >

              <option value="">
                Select
              </option>

              {genderOptions.map((x) => (

                <option key={x}>
                  {x}
                </option>

              ))}

            </select>

          </div>


          <div className="field">

            <label>
              Cancer Type
            </label>

            <select
              value={form.acronym}
              onChange={(e) =>
                setField("acronym", e.target.value)
              }
            >

              <option value="">
                Select
              </option>

              {cancerOptions.map((x) => (

                <option key={x}>
                  {x}
                </option>

              ))}

            </select>

          </div>

          <div className="field">

            <label>
              Stage
            </label>

            <select
              value={form.pathologic_stage}
              onChange={(e) =>
                setField(
                  "pathologic_stage",
                  e.target.value
                )
              }
            >

              <option value="">
                Select
              </option>

              {stageOptions.map((x) => (

                <option key={x}>
                  {x}
                </option>
              ))}

            </select>

          </div>

          <div className="field">

            <label>
              TNM Staging
            </label>

            <div className="tnm-grid">

              <select
                value={form.pathologic_T}
                onChange={(e) =>
                  setField(
                    "pathologic_T",
                    e.target.value
                  )
                }
              >

                <option value="">
                  T
                </option>

                {tOptions.map((x) => (

                  <option key={x}>
                    {x}
                  </option>

                ))}

              </select>

              <select
                value={form.pathologic_N}
                onChange={(e) =>
                  setField(
                    "pathologic_N",
                    e.target.value
                  )
                }
              >

                <option value="">
                  N
                </option>

                {nOptions.map((x) => (

                  <option key={x}>
                    {x}
                  </option>

                ))}

              </select>

              <select
                value={form.pathologic_M}
                onChange={(e) =>
                  setField(
                    "pathologic_M",
                    e.target.value
                  )
                }
              >

                <option value="">
                  M
                </option>

                {mOptions.map((x) => (

                  <option key={x}>
                    {x}
                  </option>
                ))}

              </select>


            </div>

          </div>
          <div className="field">

          <label>
            Karnofsky performance score: how well the patient can perform daily activities
          </label>
          <select value={form.karnofsky_performance_score}
         onChange={(e) => setField("karnofsky_performance_score", Number(e.target.value))}>
          <option value="">Select</option>
          {karnofsky.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
         </select>
        </div>

          <div className="field">

            <label>
              Grade: how aggressive is the tumor?
            </label>

            <select
              value={form.grade}
              onChange={(e) =>
                setField("grade", e.target.value)
              }
            >

              {gradeOptions.map((x) => (

                <option key={x}>
                  {x}
                </option>
              ))}

            </select>

          </div>

          <div className="field">

            <label>
              Radiation Therapy
            </label>

            <select
              value={form.radiation_therapy}
              onChange={(e) =>
                setField(
                  "radiation_therapy",
                  e.target.value
                )
              }
            >

              {yesNoUnknown.map((x) => (

                <option key={x}>
                  {x}
                </option>

              ))}

            </select>

          </div>

          <div className="field">

            <label>
              Postoperative Therapy
            </label>

            <select
              value={form.postoperative_rx_tx}
              onChange={(e) =>
                setField(
                  "postoperative_rx_tx",
                  e.target.value
                )
              }
            >

              {yesNoUnknown.map((x) => (

                <option key={x}>
                  {x}
                </option>

              ))}

            </select>

          </div>

          <div className="field">

            <label>
              Targeted Therapy
            </label>

            <select
              value={form.targeted_molecular_therapy}
              onChange={(e) =>
                setField(
                  "targeted_molecular_therapy",
                  e.target.value
                )
              }
            >

              {yesNoUnknown.map((x) => (

                <option key={x}>
                  {x}
                </option>

              ))}

            </select>

          </div>

          <div className="field">
            <label>
              Lymph nodes examined
            </label>
            <input
          type="number"
          min="0"
          max="50"
          step="1"
          value={form.lymph_node_examined_count}
          onChange={(e) =>
            setField("lymph_node_examined_count", Number(e.target.value))
          }
        />
          </div>

          <div className="field">
            <label>
              Positive lymph nodes
            </label>
            <input
          type="number"
          min="0"
          max={form.lymph_node_examined_count}
          value={form.number_of_lymphnodes_positive}
          onChange={(e) =>
            setField("number_of_lymphnodes_positive", Number(e.target.value))
          }
        />
          </div>

          <div className="field">

            <label>
              Residual Tumor: is there any tumor left?
            </label>

            <select
              value={form.residual_tumor}
              onChange={(e) =>
                setField(
                  "residual_tumor",
                  e.target.value
                )
              }
            >

              {yesNoUnknown.map((x) => (

                <option key={x}>
                  {x}
                </option>

              ))}

            </select>

          </div>

          <div className="field">

            <label>
              Margin Status: is the tumor completely removed?
            </label>

            <select
              value={form.margin_status}
              onChange={(e) =>
                setField(
                  "margin_status",
                  e.target.value
                )
              }
            >

              {yesNoUnknown.map((x) => (

                <option key={x}>
                  {x}
                </option>

              ))}

            </select>

          </div>

          {!valid && (
          <p className="errorText">
            M1 cannot be used with stage I or II
          </p>
        )}

          <button
            className="predict-btn"
            onClick={submit}
            disabled={loading}
          >
            {loading ? "Processing..." : "Predict"}
          </button>

        </div>

      </div>

      {result && (

        <div className="result-overlay">

          <div className="result-modal" id="result-card">

            <div className="btns">

              <button
              className="close-btn"
              onClick={() => setResult(null)}
            >
              Close
            </button>

            
            <button className="download-btn" onClick={downloadPDF}>
              Download
            </button>

            
            </div>

            <h2>
              Prediction Results
            </h2>

           

            <div className="charts-grid">

              <div id="hazard-chart" className="chart-card" style={{ border: `1px solid ${getRiskColor(result.risk_score)}` }}>

                <h3>
                  Hazard Score
                </h3>

                <ResponsiveContainer width="100%" height={220}>

                  <BarChart
                    data={[
                      {
                        name: "Hazard",
                        value: result.hazard_score
                      }
                    ]}
                  >

                    <XAxis dataKey="name" />

                    <YAxis domain={[0, 10]} />

                    <Tooltip />

                    <Bar
                      dataKey="value"
                      fill={getRiskColorH(result.hazard_score)}
                    />

                  </BarChart>

                </ResponsiveContainer>

              </div>

              <div id="risk-chart" className="chart-card" style={{ border: `1px solid ${getRiskColor(result.risk_score)}` }}>

                <h3>
                  Risk Score
                </h3>

                <ResponsiveContainer width="100%" height={220}>

                  <RadialBarChart
                    innerRadius="70%"
                    outerRadius="100%"
                    data={[
                      {
                        name: "Risk",
                        value: result.risk_score
                      }
                    ]}
                    startAngle={180}
                    endAngle={0}
                  >

                    <PolarAngleAxis
                      type="number"
                      domain={[0, 100]}
                      tick={false}
                    />

                    <RadialBar
                      dataKey="value"
                      fill={getRiskColor(result.risk_score)}
                    />

                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                      {result.risk_score}%
                    </text>

                  </RadialBarChart>

                </ResponsiveContainer>

                <div className="riskLevel" data-level={result.risk_level}>
              {result.risk_level}
            </div>

              </div>

              <div id="survival-chart" className="chart-card full-width" style={{ border: `1px solid ${getRiskColor(result.risk_score)}` }}>

                <h3>
                  Survival Probability
                </h3>

                <ResponsiveContainer width="100%" height={250}>

                  <LineChart data={survivalData}>

                    <XAxis dataKey="name" />

                    <YAxis domain={[0, 100]} />

                    <Tooltip />

                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3ca787"
                      strokeWidth={3}
                    />

                  </LineChart>

                </ResponsiveContainer>

              </div>

            </div>

            <div className="survival-box">

              <h3>
                Median Survival
              </h3>

              <p>
                {result.median_survival_days} days
              </p>

            </div>

             

            

          </div>

        </div>

      )}

    </div>
  );
}