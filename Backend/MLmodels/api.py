from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
import pandas as pd
import joblib
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

bundle = joblib.load("cox_model.pkl")
cox_model = bundle["cox_model"]
preprocessor = bundle["preprocessor"]
feature_names = bundle["feature_names"]
allowed_categories = bundle["allowed_categories"]


class Patient(BaseModel):
    age: float
    weight: float
    gender: str
    acronym: str
    pathologic_stage: str
    pathologic_T: str
    pathologic_N: str
    pathologic_M: str
    grade: str = "unknown"
    radiation_therapy: str = "unknown"
    postoperative_rx_tx: str = "unknown"
    targeted_molecular_therapy: str = "unknown"
    residual_tumor: str = "unknown"
    margin_status: str = "unknown"
    karnofsky_performance_score: float = 50
    lymph_node_examined_count: float = 0
    number_of_lymphnodes_positive: float = 0


def clean_cat(value):
    if value is None:
        return "unknown"
    value = str(value).strip()
    if value == "" or value.lower() == "nan":
        return "unknown"
    return value


def preprocess(data: Patient):

    X = pd.DataFrame([{
        "age": data.age,
        "weight": data.weight,
        "gender": clean_cat(data.gender),
        "acronym": clean_cat(data.acronym),
        "pathologic_stage": clean_cat(data.pathologic_stage),
        "pathologic_T": clean_cat(data.pathologic_T),
        "pathologic_N": clean_cat(data.pathologic_N),
        "pathologic_M": clean_cat(data.pathologic_M),
        "grade": clean_cat(data.grade),
        "radiation_therapy": clean_cat(data.radiation_therapy),
        "postoperative_rx_tx": clean_cat(data.postoperative_rx_tx),
        "targeted_molecular_therapy": clean_cat(data.targeted_molecular_therapy),
        "residual_tumor": clean_cat(data.residual_tumor),
        "margin_status": clean_cat(data.margin_status),
        "karnofsky_performance_score": data.karnofsky_performance_score,
        "lymph_node_examined_count": data.lymph_node_examined_count,
        "number_of_lymphnodes_positive": data.number_of_lymphnodes_positive
    }])

    # -------------------------
    # AGE GROUP (must match training)
    # -------------------------
    X["age_group"] = pd.cut(
        X["age"],
        bins=[0, 40, 60, 80, 120],
        labels=["young", "mid", "senior", "elder"]
    ).astype(str)

    X["age_group"] = X["age_group"].replace("nan", "unknown")

    # -------------------------
    # STAGE SCORE (MISSING FIX)
    # -------------------------
    stage_map = {
        "stage i": 1,
        "stage ii": 2,
        "stage iii": 3,
        "stage iv": 4,
        "i": 1,
        "ii": 2,
        "iii": 3,
        "iv": 4
    }

    X["stage_score"] = X["pathologic_stage"].astype(str).str.lower().map(stage_map)
    X["stage_score"] = pd.to_numeric(X["stage_score"], errors="coerce").fillna(0)

    # -------------------------
    # NUMERIC CLEAN
    # -------------------------
    X["number_of_lymphnodes_positive"] = pd.to_numeric(
        X["number_of_lymphnodes_positive"],
        errors="coerce"
    ).fillna(0)

    X["stage_ln_interaction"] = (
        X["stage_score"] * X["number_of_lymphnodes_positive"]
    )

    # -------------------------
    # TRANSFORM
    # -------------------------
    X_processed = preprocessor.transform(X)

    feature_names = preprocessor.get_feature_names_out()

    df_x = pd.DataFrame(
        X_processed.toarray() if hasattr(X_processed, "toarray") else X_processed,
        columns=feature_names
    )

    return df_x


@app.post("/predict")
def predict(data: Patient):

    X = preprocess(data)

    hazard = float(cox_model.predict_partial_hazard(X).values[0])

    surv = cox_model.predict_survival_function(X)

    times = surv.index.values
    probs = surv.values.flatten()

    prob_365 = surv.loc[365].values[0] if 365 in surv.index else probs[-1]

    risk_score = float((1 - prob_365) * 100)

    if risk_score < 30:
        risk_level = "low"
    elif risk_score < 70:
        risk_level = "medium"
    else:
        risk_level = "high"

    median = np.interp(0.5, probs[::-1], times[::-1])

    survival_1y = float(surv.loc[365].values[0]) if 365 in surv.index else float(probs[-1])
    survival_3y = float(surv.loc[365 * 3].values[0]) if (365 * 3) in surv.index else float(probs[-1])
    survival_5y = float(surv.loc[365 * 5].values[0]) if (365 * 5) in surv.index else float(probs[-1])

    return {
        "hazard_score": round(hazard, 3),
        "risk_score": round(risk_score, 2),
        "risk_level": risk_level,
        "median_survival_days": int(median),

        "survival_probability_percent": {
            "1_year": round(survival_1y * 100, 2),
            "3_year": round(survival_3y * 100, 2),
            "5_year": round(survival_5y * 100, 2)
        }
    }


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)