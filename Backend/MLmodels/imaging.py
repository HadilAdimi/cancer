import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms, models
from sklearn.metrics import classification_report, confusion_matrix
from torch.utils.data import WeightedRandomSampler

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

train_transform = transforms.Compose([
    transforms.Resize((224,224)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(15),
    transforms.ColorJitter(0.3,0.3,0.3),
    transforms.ToTensor(),
    transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])
])

val_transform = transforms.Compose([
    transforms.Resize((224,224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])
])

train_data = datasets.ImageFolder("dataset/train", transform=train_transform)
val_data = datasets.ImageFolder("dataset/val", transform=val_transform)

class_counts = [0] * len(train_data.classes)
for _, label in train_data:
    class_counts[label] += 1

class_weights = 1. / torch.tensor(class_counts, dtype=torch.float)
samples_weights = [class_weights[label] for _, label in train_data]

sampler = WeightedRandomSampler(samples_weights, len(samples_weights))

train_loader = torch.utils.data.DataLoader(
    train_data, batch_size=16, sampler=sampler
)

val_loader = torch.utils.data.DataLoader(
    val_data, batch_size=16, shuffle=False
)

model = models.resnet50(weights="DEFAULT")

for param in model.parameters():
    param.requires_grad = False

# Fine-tune deeper layers
for param in model.layer3.parameters():
    param.requires_grad = True

for param in model.layer4.parameters():
    param.requires_grad = True

model.fc = nn.Sequential(
    nn.Linear(model.fc.in_features, 256),
    nn.ReLU(),
    nn.Dropout(0.6),
    nn.Linear(256, 2)
)

model = model.to(device)

criterion = nn.CrossEntropyLoss(weight=class_weights.to(device))
optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=0.0001)

scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=5, gamma=0.5)

best_acc = 0
patience = 5
counter = 0

for epoch in range(50):

    model.train()
    train_correct, train_total = 0, 0

    for images, labels in train_loader:
        images, labels = images.to(device), labels.to(device)

        outputs = model(images)
        loss = criterion(outputs, labels)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        _, preds = torch.max(outputs, 1)
        train_total += labels.size(0)
        train_correct += (preds == labels).sum().item()

    train_acc = 100 * train_correct / train_total

    model.eval()
    val_correct, val_total = 0, 0

    all_preds = []
    all_labels = []

    with torch.no_grad():
        for images, labels in val_loader:
            images, labels = images.to(device), labels.to(device)

            outputs = model(images)
            probs = torch.softmax(outputs, dim=1)  
            _, preds = torch.max(probs, 1)

            val_total += labels.size(0)
            val_correct += (preds == labels).sum().item()

            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

    val_acc = 100 * val_correct / val_total

    print(f"\n Epoch {epoch+1}")
    print(f"Train Accuracy: {train_acc:.2f}%")
    print(f"Validation Accuracy: {val_acc:.2f}%")

    print("\nClassification Report:")
    print(classification_report(all_labels, all_preds))

    cm = confusion_matrix(all_labels, all_preds)
    print("Confusion Matrix:")
    print(cm)

    if val_acc > best_acc:
        best_acc = val_acc
        torch.save(model.state_dict(), "image_model.pth")
        print(" Best Model Saved")
        counter = 0
    else:
        counter += 1

    if counter >= patience:
        print(" Early Stopping Activated")
        break

    scheduler.step()

print("\n Training Finished - Model Ready!")