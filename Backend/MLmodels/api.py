from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image
import cv2
import numpy as np
import base64
import os
import io
import pandas as pd
import joblib

app = FastAPI(title="Cancer Diagnosis API", description="Combined Imaging and Clinical Analysis API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== IMAGING API SECTION ====================

# 🔥 Device for imaging model
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device for imaging: {device}")

# 🔥 Load imaging model
print("Loading imaging model...")
imaging_model = models.resnet50(weights=None)
imaging_model.fc = nn.Sequential(
    nn.Linear(imaging_model.fc.in_features, 256),
    nn.ReLU(),
    nn.Dropout(0.5),
    nn.Linear(256, 2)
)

# Check if imaging model file exists
if os.path.exists("image_model.pth"):
    imaging_model.load_state_dict(torch.load("image_model.pth", map_location=device))
    print("✅ Imaging model loaded successfully")
else:
    print("⚠️ Warning: image_model.pth not found! Using untrained model.")

imaging_model.to(device)
imaging_model.eval()

# 🔥 Transform for imaging
imaging_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

# 🔥 Grad-CAM + BOX for imaging
def generate_box(model, img_tensor):
    gradients = []
    activations = []

    def forward_hook(module, input, output):
        activations.append(output)

    def backward_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0])

    target_layer = model.layer4

    handle_f = target_layer.register_forward_hook(forward_hook)
    handle_b = target_layer.register_backward_hook(backward_hook)

    output = model(img_tensor)
    pred_class = output.argmax(dim=1)

    model.zero_grad()
    output[0, pred_class].backward()

    handle_f.remove()
    handle_b.remove()

    grads = gradients[0].cpu().data.numpy()[0]
    acts = activations[0].cpu().data.numpy()[0]

    weights = np.mean(grads, axis=(1, 2))
    cam = np.zeros(acts.shape[1:], dtype=np.float32)

    for i, w in enumerate(weights):
        cam += w * acts[i]

    cam = np.maximum(cam, 0)
    cam = cv2.resize(cam, (224, 224))
    
    if cam.max() > 0:
        cam = cam - cam.min()
        cam = cam / cam.max()

    cam_binary = np.uint8(255 * cam)
    _, thresh = cv2.threshold(cam_binary, 100, 255, cv2.THRESH_BINARY)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    return contours, cam

# ==================== CLINICAL API SECTION ====================

# 🔥 Load clinical model
print("Loading clinical model...")
cox_model = None
preprocessor = None
clinical_feature_names = None
allowed_categories = None

try:
    model_path = "cox_model.pkl"
    if os.path.exists(model_path):
        bundle = joblib.load(model_path)
        print(f"✅ Loaded bundle from {model_path}")
        print(f"   Bundle type: {type(bundle)}")
        
        if isinstance(bundle, dict):
            print(f"   Keys in bundle: {list(bundle.keys())}")
            # Match the keys from your training code
            cox_model = bundle.get("cox_model")
            preprocessor = bundle.get("preprocessor")
            clinical_feature_names = bundle.get("feature_names")
            allowed_categories = bundle.get("allowed_categories")
            
            print(f"   - cox_model: {'Yes' if cox_model else 'No'}")
            print(f"   - preprocessor: {'Yes' if preprocessor else 'No'}")
            print(f"   - feature_names: {'Yes' if clinical_feature_names is not None else 'No'}")
        else:
            cox_model = bundle
            print("   Loaded as direct model object")
            
        if cox_model is not None:
            print("✅ Clinical model ready")
        else:
            print("⚠️ Could not extract model from bundle")
    else:
        print(f"⚠️ Warning: {model_path} not found in {os.getcwd()}")
        print(f"   Current directory contents: {os.listdir('.')}")
        
except Exception as e:
    print(f"❌ Error loading clinical model: {e}")
    import traceback
    traceback.print_exc()

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

def preprocess_clinical(data: Patient):
    """Preprocess clinical data to match training format"""
    
    # Create DataFrame with one row
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

    # Age group (must match training)
    X["age_group"] = pd.cut(
        X["age"],
        bins=[0, 40, 60, 80, 120],
        labels=["young", "mid", "senior", "elder"]
    ).astype(str)

    X["age_group"] = X["age_group"].replace("nan", "unknown")

    # Stage score
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

    # Clean numeric columns
    X["number_of_lymphnodes_positive"] = pd.to_numeric(
        X["number_of_lymphnodes_positive"],
        errors="coerce"
    ).fillna(0)

    # Create interaction feature (matches training)
    X["stage_ln_interaction"] = (
        X["stage_score"] * X["number_of_lymphnodes_positive"]
    )

    # Clean categorical columns
    cat_cols = [
        "gender", "acronym", "pathologic_T", "pathologic_N", "pathologic_M",
        "age_group", "grade", "radiation_therapy", "postoperative_rx_tx",
        "targeted_molecular_therapy", "residual_tumor", "margin_status"
    ]
    
    for col in cat_cols:
        X[col] = X[col].fillna("unknown")
        X[col] = X[col].astype(str)

    # Select features in correct order (matches training)
    features = [
        "age", "weight", "age_group", "gender", "acronym",
        "pathologic_stage", "pathologic_T", "pathologic_N", "pathologic_M",
        "grade", "radiation_therapy", "postoperative_rx_tx",
        "targeted_molecular_therapy", "residual_tumor", "margin_status",
        "karnofsky_performance_score", "lymph_node_examined_count",
        "number_of_lymphnodes_positive", "stage_score", "stage_ln_interaction"
    ]
    
    X = X[features]

    # Apply preprocessor if available
    if preprocessor is not None:
        try:
            X_processed = preprocessor.transform(X)
            
            # Get feature names
            if hasattr(preprocessor, 'get_feature_names_out'):
                feature_names_out = preprocessor.get_feature_names_out()
            else:
                feature_names_out = [f"feature_{i}" for i in range(X_processed.shape[1])]
            
            # Create DataFrame
            if hasattr(X_processed, "toarray"):
                X_processed = X_processed.toarray()
            
            X_df = pd.DataFrame(X_processed, columns=feature_names_out)
            
            # Ensure all expected features are present
            if clinical_feature_names is not None:
                for col in clinical_feature_names:
                    if col not in X_df.columns:
                        X_df[col] = 0
                X_df = X_df[clinical_feature_names]
            
            return X_df
        except Exception as e:
            print(f"Error in preprocessing: {e}")
            raise
    else:
        return X

# ==================== API ENDPOINTS ====================

@app.get("/")
async def root():
    return {
        "name": "Cancer Diagnosis API",
        "version": "2.0",
        "status": "running",
        "endpoints": {
            "imaging": "/predict-imaging",
            "clinical": "/predict-clinical",
            "health": "/health"
        },
        "models": {
            "imaging_model_loaded": os.path.exists("image_model.pth"),
            "clinical_model_loaded": cox_model is not None
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "imaging_model_loaded": os.path.exists("image_model.pth"),
        "clinical_model_loaded": cox_model is not None,
        "device": str(device)
    }

# ==================== IMAGING ENDPOINT ====================

@app.post("/predict-imaging")
async def predict_imaging(image: UploadFile = File(...)):
    if not os.path.exists("image_model.pth"):
        raise HTTPException(status_code=503, detail="Imaging model not loaded")
    
    try:
        contents = await image.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        img_resized = img.resize((224, 224))

        img_tensor = imaging_transform(img).unsqueeze(0).to(device)

        with torch.no_grad():
            output = imaging_model(img_tensor)
            probs = torch.softmax(output, dim=1)
            confidence, pred = torch.max(probs, 1)

        if pred.item() == 0:
            label = "Cancer Detected"
            risk = "High Risk"
        else:
            label = "Normal / Benign"
            risk = "Low Risk"

        contours, cam = generate_box(imaging_model, img_tensor)

        img_np = np.array(img_resized)
        img_np_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            cv2.rectangle(img_np_bgr, (x, y), (x + w, y + h), (0, 0, 255), 2)

        cam_resized = cv2.resize(cam, (224, 224))
        cam_colored = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(img_np_bgr, 0.6, cam_colored, 0.4, 0)
        
        _, buffer = cv2.imencode('.jpg', overlay)
        img_base64 = base64.b64encode(buffer).decode('utf-8')

        confidence_percentage = round(float(confidence.item()) * 100, 2)

        return JSONResponse(content={
            "success": True,
            "type": "imaging",
            "prediction": label,
            "risk": risk,
            "confidence": confidence_percentage,
            "heatmap": img_base64,
            "message": f"Analysis complete: {label} with {confidence_percentage}% confidence"
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ==================== CLINICAL ENDPOINT ====================

@app.post("/predict-clinical")
async def predict_clinical(data: Patient):
    if cox_model is None:
        raise HTTPException(status_code=503, detail=f"Clinical model not loaded. File exists: {os.path.exists('cox_model.pkl')}")
    
    try:
        print(f"Received clinical data for prediction")
        
        # Preprocess the input data
        X = preprocess_clinical(data)
        print(f"Preprocessed data shape: {X.shape}")
        
        # Make prediction
        if hasattr(cox_model, 'predict_partial_hazard'):
            hazard = float(cox_model.predict_partial_hazard(X).values[0])
        else:
            hazard = float(cox_model.predict(X)[0])
        
        # Get survival function
        if hasattr(cox_model, 'predict_survival_function'):
            surv = cox_model.predict_survival_function(X)
            times = surv.index.values
            probs = surv.values.flatten()
            
            # Get survival probabilities at specific times
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
                "success": True,
                "type": "clinical",
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
        else:
            # Fallback if survival function not available
            return {
                "success": True,
                "type": "clinical",
                "hazard_score": round(hazard, 3),
                "risk_score": round(hazard * 100, 2),
                "risk_level": "medium" if hazard > 1 else "low",
                "median_survival_days": 365,
                "survival_probability_percent": {
                    "1_year": 70.0,
                    "3_year": 50.0,
                    "5_year": 30.0
                },
                "message": "Limited prediction - survival function not available"
            }
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.get("/clinical/debug")
async def clinical_debug():
    """Debug endpoint to check clinical model status"""
    return {
        "model_loaded": cox_model is not None,
        "file_exists": os.path.exists("cox_model.pkl"),
        "current_directory": os.getcwd(),
        "files_in_directory": [f for f in os.listdir(".") if f.endswith('.pkl')],
        "preprocessor_available": preprocessor is not None,
        "feature_names_available": clinical_feature_names is not None,
        "model_type": str(type(cox_model)) if cox_model else None
    }

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print("🚀 Starting Cancer Diagnosis API Server")
    print("="*50)
    print(f"📍 Server running at: http://127.0.0.1:5000")
    print(f"📍 Imaging endpoint: http://127.0.0.1:5000/predict-imaging")
    print(f"📍 Clinical endpoint: http://127.0.0.1:5000/predict-clinical")
    print(f"📍 Health check: http://127.0.0.1:5000/health")
    print(f"📍 Debug: http://127.0.0.1:5000/clinical/debug")
    print("="*50 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=5000)