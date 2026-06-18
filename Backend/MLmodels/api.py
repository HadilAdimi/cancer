from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.data import Data
from torch_geometric.nn import GCNConv, global_mean_pool
from torchvision import transforms, models
from PIL import Image
import cv2
import numpy as np
import base64
import os
import io
import pandas as pd
import pickle
import joblib
import warnings
from typing import Optional, List, Dict, Any

warnings.filterwarnings('ignore')

app = FastAPI(title="Cancer Diagnosis API", description="Combined Imaging, Clinical, and Genomic Analysis API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== DEVICE CONFIGURATION ====================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

# ==================== GENOMIC MODEL SECTION ====================

# GNN Branch Definition
class GNNBranch(torch.nn.Module):
    def __init__(self, input_dim, hidden_dim=64, dropout=0.3):
        super().__init__()
        self.conv1 = GCNConv(input_dim, hidden_dim)
        self.conv2 = GCNConv(hidden_dim, hidden_dim)
        self.conv3 = GCNConv(hidden_dim, hidden_dim)
        self.dropout = dropout
        
    def forward(self, data):
        x, edge_index, batch = data.x, data.edge_index, data.batch
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv2(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv3(x, edge_index)
        x = F.relu(x)
        x = global_mean_pool(x, batch)
        return x

class FusionGNN(torch.nn.Module):
    def __init__(self, dim_mirna, dim_gene, dim_protein, hidden_dim=64, output_dim=2, dropout=0.3):
        super().__init__()
        self.gnn_mirna = GNNBranch(dim_mirna, hidden_dim, dropout)
        self.gnn_gene = GNNBranch(dim_gene, hidden_dim, dropout)
        self.gnn_protein = GNNBranch(dim_protein, hidden_dim, dropout)
        self.fc1 = torch.nn.Linear(hidden_dim * 3, hidden_dim)
        self.fc2 = torch.nn.Linear(hidden_dim, output_dim)
        self.dropout = dropout
        
    def forward(self, data_mirna, data_gene, data_protein):
        x_m = self.gnn_mirna(data_mirna)
        x_g = self.gnn_gene(data_gene)
        x_p = self.gnn_protein(data_protein)
        x = torch.cat([x_m, x_g, x_p], dim=1)
        x = F.relu(self.fc1(x))
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.fc2(x)
        return x

# Load Genomic Model
GENOMIC_MODEL_PATH = "fusion_model.pkl"
genomic_model = None
genomic_checkpoint = None
edge_mirna = None
edge_gene = None
edge_protein = None
GRAPH_FOLDERS = {
    'mirna': "./data/graphs_mirna_corrected",
    'gene': "./data/graphs_gene_corrected",
    'protein': "./data/graphs_protein_corrected"
}

def load_edge_structure(folder):
    """Load edge structure from graph folder"""
    if not os.path.exists(folder):
        print(f"⚠️ Warning: Folder {folder} not found")
        return None
    
    for f in os.listdir(folder):
        if f.endswith('.pt'):
            graph_path = os.path.join(folder, f)
            try:
                graph = torch.load(graph_path, weights_only=False)
            except:
                graph = torch.load(graph_path)
            return graph.edge_index
    return None

def load_genomic_model():
    """Load the genomic fusion model"""
    global genomic_model, genomic_checkpoint, edge_mirna, edge_gene, edge_protein
    
    try:
        if not os.path.exists(GENOMIC_MODEL_PATH):
            print(f"⚠️ Warning: {GENOMIC_MODEL_PATH} not found")
            return False
        
        with open(GENOMIC_MODEL_PATH, 'rb') as f:
            checkpoint = pickle.load(f)
        
        genomic_checkpoint = checkpoint
        
        # Create model
        model = FusionGNN(
            dim_mirna=checkpoint['dim_mirna'],
            dim_gene=checkpoint['dim_gene'],
            dim_protein=checkpoint['dim_protein'],
            hidden_dim=checkpoint['hidden_dim'],
            output_dim=checkpoint['output_dim'],
            dropout=checkpoint['dropout']
        )
        model.load_state_dict(checkpoint['model_state_dict'])
        model.eval()
        model = model.to(device)
        genomic_model = model
        
        # Load edge structures
        for folder_path in GRAPH_FOLDERS.values():
            if not os.path.exists(folder_path):
                print(f"⚠️ Warning: Graph folder {folder_path} not found")
                return False
        
        edge_mirna = load_edge_structure(GRAPH_FOLDERS['mirna'])
        edge_gene = load_edge_structure(GRAPH_FOLDERS['gene'])
        edge_protein = load_edge_structure(GRAPH_FOLDERS['protein'])
        
        if all([edge_mirna is not None, edge_gene is not None, edge_protein is not None]):
            print("✅ Genomic model loaded successfully!")
            print(f"   - Best validation accuracy: {checkpoint.get('best_val_acc', 'N/A')}")
            return True
        else:
            print("❌ Failed to load edge structures")
            return False
            
    except Exception as e:
        print(f"❌ Error loading genomic model: {e}")
        import traceback
        traceback.print_exc()
        return False

# Load genomic model
GENOMIC_MODEL_LOADED = load_genomic_model()

def values_to_graph(values, edge_index):
    """Convert values to graph data structure"""
    arr = np.array(values).reshape(1, -1)
    norm = np.linalg.norm(arr)
    if norm == 0:
        norm = 1
    arr_norm = arr / norm
    sim_matrix = np.dot(arr_norm.T, arr_norm)
    np.fill_diagonal(sim_matrix, 0)
    x = torch.tensor(sim_matrix, dtype=torch.float)
    return Data(x=x, edge_index=edge_index, num_nodes=len(values))

# ==================== IMAGING MODEL SECTION ====================

# Load imaging model
imaging_model = models.resnet50(weights=None)
imaging_model.fc = nn.Sequential(
    nn.Linear(imaging_model.fc.in_features, 256),
    nn.ReLU(),
    nn.Dropout(0.5),
    nn.Linear(256, 2)
)

IMAGING_MODEL_LOADED = False
if os.path.exists("image_model.pth"):
    imaging_model.load_state_dict(torch.load("image_model.pth", map_location=device))
    imaging_model.to(device)
    imaging_model.eval()
    IMAGING_MODEL_LOADED = True
    print("✅ Imaging model loaded successfully")
else:
    print("⚠️ Warning: image_model.pth not found! Using untrained model.")
    IMAGING_MODEL_LOADED = False

# Transform for imaging
imaging_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

# Grad-CAM + BOX for imaging
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

# ==================== CLINICAL MODEL SECTION ====================

# Load clinical model
cox_model = None
preprocessor = None
clinical_feature_names = None
allowed_categories = None
CLINICAL_MODEL_LOADED = False

try:
    model_path = "cox_model.pkl"
    if os.path.exists(model_path):
        bundle = joblib.load(model_path)
        print(f"✅ Loaded clinical model bundle from {model_path}")
        
        if isinstance(bundle, dict):
            cox_model = bundle.get("cox_model")
            preprocessor = bundle.get("preprocessor")
            clinical_feature_names = bundle.get("feature_names")
            allowed_categories = bundle.get("allowed_categories")
            
            if cox_model is not None:
                CLINICAL_MODEL_LOADED = True
                print("✅ Clinical model ready")
            else:
                print("⚠️ Could not extract model from bundle")
        else:
            cox_model = bundle
            CLINICAL_MODEL_LOADED = True
            print("✅ Clinical model loaded as direct object")
    else:
        print(f"⚠️ Warning: {model_path} not found")
        
except Exception as e:
    print(f"❌ Error loading clinical model: {e}")

# ==================== PYDANTIC MODELS ====================

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

class GenomicPredictionRequest(BaseModel):
    patient_id: Optional[str] = None
    mirna_values: Optional[List[float]] = None
    gene_values: Optional[List[float]] = None
    protein_values: Optional[List[float]] = None
    mirna_names: Optional[List[str]] = None
    gene_names: Optional[List[str]] = None
    protein_names: Optional[List[str]] = None

class ClinicalPredictionResponse(BaseModel):
    success: bool
    type: str
    hazard_score: float
    risk_score: float
    risk_level: str
    median_survival_days: int
    survival_probability_percent: Dict[str, float]

# ==================== HELPER FUNCTIONS ====================

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
        "version": "3.0",
        "status": "running",
        "endpoints": {
            "imaging": "/predict-imaging",
            "clinical": "/predict-clinical",
            "genomic": "/predict-genomic",
            "genomic_csv": "/predict-genomic-csv",
            "health": "/health"
        },
        "models": {
            "imaging_model_loaded": IMAGING_MODEL_LOADED,
            "clinical_model_loaded": CLINICAL_MODEL_LOADED,
            "genomic_model_loaded": GENOMIC_MODEL_LOADED
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "imaging_model_loaded": IMAGING_MODEL_LOADED,
        "clinical_model_loaded": CLINICAL_MODEL_LOADED,
        "genomic_model_loaded": GENOMIC_MODEL_LOADED,
        "device": str(device)
    }

# ==================== IMAGING ENDPOINT ====================

@app.post("/predict-imaging")
async def predict_imaging(image: UploadFile = File(...)):
    if not IMAGING_MODEL_LOADED:
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
    if not CLINICAL_MODEL_LOADED:
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

# ==================== GENOMIC ENDPOINTS ====================

@app.post("/predict-genomic")
async def predict_genomic(request: GenomicPredictionRequest):
    """
    Predict cancer stage from genomic data (miRNA, Gene, Protein)
    
    Either provide patient_id to load pre-saved graphs,
    or provide the actual values directly.
    """
    if not GENOMIC_MODEL_LOADED:
        raise HTTPException(status_code=503, detail="Genomic model not loaded")
    
    try:
        # Case 1: Use patient_id to load pre-saved graphs
        if request.patient_id:
            graphs = {}
            for mtype, folder in GRAPH_FOLDERS.items():
                graph_path = os.path.join(folder, f"{request.patient_id}.pt")
                if not os.path.exists(graph_path):
                    raise HTTPException(
                        status_code=404,
                        detail=f"Graph file not found: {graph_path} for type: {mtype}"
                    )
                try:
                    graph = torch.load(graph_path, weights_only=False)
                except:
                    graph = torch.load(graph_path)
                graphs[mtype] = graph.to(device)
            
            # Make prediction
            with torch.no_grad():
                out = genomic_model(graphs['mirna'], graphs['gene'], graphs['protein'])
                pred = out.argmax(dim=1).item()
                probs = torch.softmax(out, dim=1).cpu().numpy()[0]
            
            stage = "Late" if pred == 1 else "Early"
            stage_full = "Late (Stage III-IV)" if pred == 1 else "Early (Stage I-II)"
            
            return {
                "success": True,
                "type": "genomic",
                "patient_id": request.patient_id,
                "prediction": pred,
                "stage": stage,
                "stage_full": stage_full,
                "confidence": float(max(probs)),
                "probabilities": {
                    "Early": float(probs[0]),
                    "Late": float(probs[1])
                },
                "method": "patient_id"
            }
        
        # Case 2: Use provided values
        elif all([request.mirna_values, request.gene_values, request.protein_values]):
            # Validate lengths
            if len(request.mirna_values) != 49:
                raise HTTPException(400, f"Expected 49 miRNA values, got {len(request.mirna_values)}")
            if len(request.gene_values) != 50:
                raise HTTPException(400, f"Expected 50 Gene values, got {len(request.gene_values)}")
            if len(request.protein_values) != 50:
                raise HTTPException(400, f"Expected 50 Protein values, got {len(request.protein_values)}")
            
            # Convert to graphs
            graph_mirna = values_to_graph(request.mirna_values, edge_mirna).to(device)
            graph_gene = values_to_graph(request.gene_values, edge_gene).to(device)
            graph_protein = values_to_graph(request.protein_values, edge_protein).to(device)
            
            # Make prediction
            with torch.no_grad():
                out = genomic_model(graph_mirna, graph_gene, graph_protein)
                pred = out.argmax(dim=1).item()
                probs = torch.softmax(out, dim=1).cpu().numpy()[0]
            
            stage = "Late" if pred == 1 else "Early"
            stage_full = "Late (Stage III-IV)" if pred == 1 else "Early (Stage I-II)"
            
            response = {
                "success": True,
                "type": "genomic",
                "prediction": pred,
                "stage": stage,
                "stage_full": stage_full,
                "confidence": float(max(probs)),
                "probabilities": {
                    "Early": float(probs[0]),
                    "Late": float(probs[1])
                },
                "method": "values",
                "feature_names": {
                    "mirna": request.mirna_names or [f"miRNA_{i+1}" for i in range(49)],
                    "gene": request.gene_names or [f"Gene_{i+1}" for i in range(50)],
                    "protein": request.protein_names or [f"Protein_{i+1}" for i in range(50)]
                }
            }
            
            # Include values if they were provided
            if request.mirna_values:
                response["values"] = {
                    "mirna": request.mirna_values,
                    "gene": request.gene_values,
                    "protein": request.protein_values
                }
            
            return response
        
        else:
            raise HTTPException(
                status_code=400,
                detail="Either provide 'patient_id' or all of: 'mirna_values', 'gene_values', 'protein_values'"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Genomic prediction failed: {str(e)}")

@app.post("/predict-genomic-csv")
async def predict_genomic_csv(file: UploadFile = File(...)):
    """
    Predict cancer stage from CSV file containing genomic data
    
    CSV format must have columns: Feature, Type, Value
    - Type values: 'mirna', 'gene', 'protein'
    - 49 miRNA features, 50 Gene features, 50 Protein features
    """
    if not GENOMIC_MODEL_LOADED:
        raise HTTPException(status_code=503, detail="Genomic model not loaded")
    
    try:
        # Read CSV
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        # Validate columns
        required_cols = ['Feature', 'Type', 'Value']
        for col in required_cols:
            if col not in df.columns:
                raise HTTPException(
                    400,
                    f"Missing column: {col}. Expected columns: {', '.join(required_cols)}"
                )
        
        # Extract values by type
        mirna_df = df[df['Type'].str.lower() == 'mirna']
        gene_df = df[df['Type'].str.lower() == 'gene']
        protein_df = df[df['Type'].str.lower() == 'protein']
        
        # Validate counts
        if len(mirna_df) != 49:
            raise HTTPException(400, f"Expected 49 miRNA values, got {len(mirna_df)}")
        if len(gene_df) != 50:
            raise HTTPException(400, f"Expected 50 Gene values, got {len(gene_df)}")
        if len(protein_df) != 50:
            raise HTTPException(400, f"Expected 50 Protein values, got {len(protein_df)}")
        
        # Extract values and names
        mirna_values = mirna_df['Value'].values.tolist()
        gene_values = gene_df['Value'].values.tolist()
        protein_values = protein_df['Value'].values.tolist()
        mirna_names = mirna_df['Feature'].values.tolist()
        gene_names = gene_df['Feature'].values.tolist()
        protein_names = protein_df['Feature'].values.tolist()
        
        # Convert to graphs
        graph_mirna = values_to_graph(mirna_values, edge_mirna).to(device)
        graph_gene = values_to_graph(gene_values, edge_gene).to(device)
        graph_protein = values_to_graph(protein_values, edge_protein).to(device)
        
        # Make prediction
        with torch.no_grad():
            out = genomic_model(graph_mirna, graph_gene, graph_protein)
            pred = out.argmax(dim=1).item()
            probs = torch.softmax(out, dim=1).cpu().numpy()[0]
        
        stage = "Late" if pred == 1 else "Early"
        stage_full = "Late (Stage III-IV)" if pred == 1 else "Early (Stage I-II)"
        
        return {
            "success": True,
            "type": "genomic",
            "prediction": pred,
            "stage": stage,
            "stage_full": stage_full,
            "confidence": float(max(probs)),
            "probabilities": {
                "Early": float(probs[0]),
                "Late": float(probs[1])
            },
            "features": {
                "mirna": list(zip(mirna_names, mirna_values)),
                "gene": list(zip(gene_names, gene_values)),
                "protein": list(zip(protein_names, protein_values))
            },
            "summary": {
                "total_features": len(df),
                "mirna_count": len(mirna_df),
                "gene_count": len(gene_df),
                "protein_count": len(protein_df)
            },
            "method": "csv"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"CSV prediction failed: {str(e)}")

# ==================== DEBUG ENDPOINTS ====================

@app.get("/clinical/debug")
async def clinical_debug():
    """Debug endpoint to check clinical model status"""
    return {
        "model_loaded": CLINICAL_MODEL_LOADED,
        "file_exists": os.path.exists("cox_model.pkl"),
        "current_directory": os.getcwd(),
        "files_in_directory": [f for f in os.listdir(".") if f.endswith('.pkl')],
        "preprocessor_available": preprocessor is not None,
        "feature_names_available": clinical_feature_names is not None,
        "model_type": str(type(cox_model)) if cox_model else None
    }

@app.get("/genomic/debug")
async def genomic_debug():
    """Debug endpoint to check genomic model status"""
    return {
        "model_loaded": GENOMIC_MODEL_LOADED,
        "model_path": GENOMIC_MODEL_PATH,
        "file_exists": os.path.exists(GENOMIC_MODEL_PATH),
        "graph_folders": GRAPH_FOLDERS,
        "graph_folders_exist": {
            name: os.path.exists(path) for name, path in GRAPH_FOLDERS.items()
        },
        "edge_mirna_loaded": edge_mirna is not None,
        "edge_gene_loaded": edge_gene is not None,
        "edge_protein_loaded": edge_protein is not None,
        "model_type": str(type(genomic_model)) if genomic_model else None,
        "checkpoint_keys": list(genomic_checkpoint.keys()) if genomic_checkpoint else None,
        "best_val_acc": genomic_checkpoint.get('best_val_acc', 'N/A') if genomic_checkpoint else None
    }

# ==================== MAIN ====================

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print("🚀 Starting Cancer Diagnosis API Server v3.0")
    print("="*50)
    print(f"📍 Server running at: http://127.0.0.1:8000")
    print(f"📡 Endpoints:")
    print(f"   POST /predict-imaging     - Imaging analysis")
    print(f"   POST /predict-clinical    - Clinical analysis")
    print(f"   POST /predict-genomic     - Genomic analysis (JSON)")
    print(f"   POST /predict-genomic-csv - Genomic analysis (CSV file)")
    print(f"   GET  /health              - Health check")
    print(f"   GET  /clinical/debug      - Clinical model debug")
    print(f"   GET  /genomic/debug       - Genomic model debug")
    print("="*50)
    print(f"📊 Model Status:")
    print(f"   Imaging: {'✅ Loaded' if IMAGING_MODEL_LOADED else '❌ Not loaded'}")
    print(f"   Clinical: {'✅ Loaded' if CLINICAL_MODEL_LOADED else '❌ Not loaded'}")
    print(f"   Genomic: {'✅ Loaded' if GENOMIC_MODEL_LOADED else '❌ Not loaded'}")
    print("="*50 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)