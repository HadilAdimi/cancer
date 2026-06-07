from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image
import cv2
import numpy as np
import base64
import os
import io

app = FastAPI(title="Cancer Imaging API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔥 Device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

# 🔥 Load model
print("Loading model...")
model = models.resnet50(weights=None)
model.fc = nn.Sequential(
    nn.Linear(model.fc.in_features, 256),
    nn.ReLU(),
    nn.Dropout(0.5),
    nn.Linear(256, 2)
)

# Check if model file exists
if os.path.exists("image_model.pth"):
    model.load_state_dict(torch.load("image_model.pth", map_location=device))
    print("✅ Model loaded successfully")
else:
    print("⚠️ Warning: image_model.pth not found! Using untrained model.")

model.to(device)
model.eval()

# 🔥 Transform
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

# 🔥 Grad-CAM + BOX
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

@app.get("/")
async def root():
    return {
        "name": "Cancer Imaging API",
        "version": "1.0",
        "status": "running",
        "model_loaded": os.path.exists("image_model.pth")
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": os.path.exists("image_model.pth"),
        "device": str(device)
    }

@app.post("/predict-imaging")
async def predict_imaging(image: UploadFile = File(...)):
    try:
        # Read image
        contents = await image.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        img_resized = img.resize((224, 224))

        img_tensor = transform(img).unsqueeze(0).to(device)

        # 🔥 Prediction
        with torch.no_grad():
            output = model(img_tensor)
            probs = torch.softmax(output, dim=1)
            confidence, pred = torch.max(probs, 1)

        # Adjust labels based on your model's training
        if pred.item() == 0:
            label = "Cancer Detected"
            risk = "High Risk"
        else:
            label = "Normal / Benign"
            risk = "Low Risk"

        # 🔥 Grad-CAM box
        contours, cam = generate_box(model, img_tensor)

        # Convert PIL to numpy for drawing
        img_np = np.array(img_resized)
        img_np_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

        # Draw contours and bounding boxes
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            cv2.rectangle(img_np_bgr, (x, y), (x + w, y + h), (0, 0, 255), 2)
            cv2.putText(img_np_bgr, "Suspicious Area", (x, y - 5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

        # Add heatmap overlay
        cam_resized = cv2.resize(cam, (224, 224))
        cam_colored = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(img_np_bgr, 0.6, cam_colored, 0.4, 0)
        
        final_image = overlay

        # 🔥 Convert to base64
        _, buffer = cv2.imencode('.jpg', final_image)
        img_base64 = base64.b64encode(buffer).decode('utf-8')

        confidence_percentage = round(float(confidence.item()) * 100, 2)

        return JSONResponse(content={
            "success": True,
            "prediction": label,
            "risk": risk,
            "confidence": confidence_percentage,
            "confidence_percentage": confidence_percentage,
            "heatmap": img_base64,
            "message": f"Analysis complete: {label} with {confidence_percentage}% confidence"
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)