import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import pandas as pd
import pickle
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from torch_geometric.loader import DataLoader
from torch_geometric.data import Data, Dataset, Batch
from torch_geometric.nn import GCNConv, global_mean_pool
import warnings
warnings.filterwarnings('ignore')

# =========================
# CONFIGURATION
# =========================

GRAPH_FOLDERS = {
    'mirna': "./data/graphs_mirna_corrected",
    'gene': "./data/graphs_gene_corrected",
    'protein': "./data/graphs_protein_corrected"
}

LABELS_FILE = "./data/stage_labels.csv"
MODEL_OUTPUT = "fusion_model.pkl"

# =========================
# 1. تحميل التصنيفات
# =========================

def load_labels():
    labels_df = pd.read_csv(LABELS_FILE)
    
    # تحويل Stage -> binary (Early=0, Late=1)
    stage_mapping = {
        'Stage I': 0,
        'Stage II': 0,
        'Stage III': 1,
        'Stage IV': 1
    }
    labels_df['label'] = labels_df['Stage'].map(stage_mapping)
    labels_df = labels_df.dropna(subset=['label'])
    labels_df['label'] = labels_df['label'].astype(int)
    
    # قاموس المريض -> التصنيف
    labels_dict = dict(zip(labels_df['Patient'], labels_df['label']))
    
    print(f"✅ عدد المرضى: {len(labels_df)}")
    print(f"📊 توزيع التصنيفات:")
    print(labels_df['Stage'].value_counts())
    
    return labels_dict, labels_df

# =========================
# 2. Dataset للدمج
# =========================

class MultiOmicsFusionDataset(Dataset):
    """
    Dataset يقرأ 3 رسوم بيانية لكل مريض (mirna, gene, protein)
    """
    
    def __init__(self, graph_folders, labels_dict):
        super().__init__()
        self.graph_folders = graph_folders
        self.labels_dict = labels_dict
        
        # الحصول على قائمة المرضى المشتركين في جميع الأنواع
        self.patient_ids = []
        for patient_id in labels_dict.keys():
            all_exist = True
            for mtype, folder in graph_folders.items():
                graph_path = os.path.join(folder, f"{patient_id}.pt")
                if not os.path.exists(graph_path):
                    all_exist = False
                    break
            if all_exist:
                self.patient_ids.append(patient_id)
        
        print(f"✅ عدد المرضى الصالحين للدمج: {len(self.patient_ids)}")
    
    def len(self):
        return len(self.patient_ids)
    
    def get(self, idx):
        patient_id = self.patient_ids[idx]
        
        # تحميل الرسوم البيانية الثلاثة
        graphs = {}
        for mtype, folder in self.graph_folders.items():
            graph_path = os.path.join(folder, f"{patient_id}.pt")
            try:
                graph = torch.load(graph_path, weights_only=False)
            except:
                graph = torch.load(graph_path)
            graphs[mtype] = graph
        
        # التصنيف
        label = self.labels_dict[patient_id]
        
        return (graphs['mirna'], graphs['gene'], graphs['protein'], label)

# =========================
# 3. نموذج الدمج (Fusion Model)
# =========================

class GNNBranch(nn.Module):
    """
    فرع GNN لكل نوع من البيانات
    """
    
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
        
        # تجميع خصائص الرسم البياني
        x = global_mean_pool(x, batch)
        
        return x

class FusionGNN(nn.Module):
    """
    نموذج يدمج 3 رسوم بيانية (miRNA, Gene, Protein)
    """
    
    def __init__(self, dim_mirna, dim_gene, dim_protein, hidden_dim=64, output_dim=2, dropout=0.3):
        super().__init__()
        
        self.dropout = dropout
        
        # GNN لكل نوع
        self.gnn_mirna = GNNBranch(dim_mirna, hidden_dim, dropout)
        self.gnn_gene = GNNBranch(dim_gene, hidden_dim, dropout)
        self.gnn_protein = GNNBranch(dim_protein, hidden_dim, dropout)
        
        # طبقة الدمج والتصنيف النهائي
        self.fc1 = nn.Linear(hidden_dim * 3, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, output_dim)
        
    def forward(self, data_mirna, data_gene, data_protein):
        # تمرير كل رسم بياني في GNN الخاص به
        x_m = self.gnn_mirna(data_mirna)
        x_g = self.gnn_gene(data_gene)
        x_p = self.gnn_protein(data_protein)
        
        # دمج المتجهات (concatenate)
        x = torch.cat([x_m, x_g, x_p], dim=1)
        
        # طبقات التصنيف النهائية
        x = F.relu(self.fc1(x))
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.fc2(x)
        
        return x

# =========================
# 4. دالة تدريب النموذج
# =========================

def train_fusion_model():
    """
    تدريب نموذج الدمج
    """
    
    print("="*60)
    print("🧬 تدريب نموذج الدمج (Multi-Omics Fusion)")
    print("="*60)
    
    # تحميل التصنيفات
    labels_dict, labels_df = load_labels()
    
    # إنشاء Dataset
    dataset = MultiOmicsFusionDataset(GRAPH_FOLDERS, labels_dict)
    
    if len(dataset) == 0:
        print("❌ لا توجد بيانات صالحة للتدريب!")
        return None
    
    # تقسيم البيانات
    labels_for_split = [dataset[i][3] for i in range(len(dataset))]
    
    train_idx, temp_idx = train_test_split(
        range(len(dataset)),
        test_size=0.3,
        random_state=42,
        stratify=labels_for_split
    )
    
    val_idx, test_idx = train_test_split(
        temp_idx,
        test_size=0.5,
        random_state=42,
        stratify=[labels_for_split[i] for i in temp_idx]
    )
    
    train_dataset = torch.utils.data.Subset(dataset, train_idx)
    val_dataset = torch.utils.data.Subset(dataset, val_idx)
    test_dataset = torch.utils.data.Subset(dataset, test_idx)
    
    print(f"\n📊 تقسيم البيانات:")
    print(f"  - تدريب: {len(train_dataset)}")
    print(f"  - تحقق: {len(val_dataset)}")
    print(f"  - اختبار: {len(test_dataset)}")
    
    # أبعاد المدخلات
    sample = dataset[0]
    dim_mirna = sample[0].x.shape[1]
    dim_gene = sample[1].x.shape[1]
    dim_protein = sample[2].x.shape[1]
    
    print(f"\n📐 أبعاد المدخلات:")
    print(f"  - mirna: {dim_mirna}")
    print(f"  - gene: {dim_gene}")
    print(f"  - protein: {dim_protein}")
    
    # إنشاء النموذج
    model = FusionGNN(
        dim_mirna=dim_mirna,
        dim_gene=dim_gene,
        dim_protein=dim_protein,
        hidden_dim=64,
        output_dim=2,
        dropout=0.3
    )
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)
    print(f"\n🚀 التدريب على: {device}")
    print("="*60)
    
    # المحسن
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=5e-4)
    criterion = nn.CrossEntropyLoss()
    
    # دورات التدريب
    epochs = 50
    best_val_acc = 0
    best_epoch = 0
    train_losses = []
    val_accuracies = []
    val_losses = []
    
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        
        # تدريب
        for idx in range(0, len(train_dataset), 16):
            batch_indices = range(idx, min(idx + 16, len(train_dataset)))
            
            batch_mirna = []
            batch_gene = []
            batch_protein = []
            batch_labels = []
            
            for i in batch_indices:
                g_m, g_g, g_p, label = train_dataset[i]
                batch_mirna.append(g_m.to(device))
                batch_gene.append(g_g.to(device))
                batch_protein.append(g_p.to(device))
                batch_labels.append(label)
            
            # تجميع الرسوم البيانية في Batch
            batch_mirna = Batch.from_data_list(batch_mirna)
            batch_gene = Batch.from_data_list(batch_gene)
            batch_protein = Batch.from_data_list(batch_protein)
            batch_labels = torch.tensor(batch_labels, dtype=torch.long).to(device)
            
            optimizer.zero_grad()
            out = model(batch_mirna, batch_gene, batch_protein)
            loss = criterion(out, batch_labels)
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        train_loss = total_loss / max(1, len(train_dataset) // 16)
        train_losses.append(train_loss)
        
        # تقييم على Validation
        model.eval()
        val_preds = []
        val_labels = []
        val_loss = 0
        
        with torch.no_grad():
            for idx in range(0, len(val_dataset), 16):
                batch_indices = range(idx, min(idx + 16, len(val_dataset)))
                
                batch_mirna = []
                batch_gene = []
                batch_protein = []
                batch_labels = []
                
                for i in batch_indices:
                    g_m, g_g, g_p, label = val_dataset[i]
                    batch_mirna.append(g_m.to(device))
                    batch_gene.append(g_g.to(device))
                    batch_protein.append(g_p.to(device))
                    batch_labels.append(label)
                
                batch_mirna = Batch.from_data_list(batch_mirna)
                batch_gene = Batch.from_data_list(batch_gene)
                batch_protein = Batch.from_data_list(batch_protein)
                batch_labels = torch.tensor(batch_labels, dtype=torch.long).to(device)
                
                out = model(batch_mirna, batch_gene, batch_protein)
                loss = criterion(out, batch_labels)
                val_loss += loss.item()
                
                pred = out.argmax(dim=1)
                val_preds.extend(pred.cpu().numpy())
                val_labels.extend(batch_labels.cpu().numpy())
        
        val_loss = val_loss / max(1, len(val_dataset) // 16)
        val_losses.append(val_loss)
        
        val_acc = accuracy_score(val_labels, val_preds)
        val_accuracies.append(val_acc)
        
        # حفظ أفضل نموذج فقط
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_epoch = epoch + 1
            # حفظ النموذج كـ .pkl
            with open(MODEL_OUTPUT, 'wb') as f:
                pickle.dump({
                    'model_state_dict': model.state_dict(),
                    'dim_mirna': dim_mirna,
                    'dim_gene': dim_gene,
                    'dim_protein': dim_protein,
                    'hidden_dim': 64,
                    'output_dim': 2,
                    'dropout': 0.3,
                    'best_val_acc': best_val_acc,
                    'best_epoch': best_epoch
                }, f)
        
        # عرض التقدم كل 5 epochs
        if (epoch + 1) % 5 == 0:
            print(f'Epoch {epoch+1:3d}/{epochs} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.4f} | Best: {best_val_acc:.4f}')
    
    print("="*60)
    print(f"✅ أفضل دقة على التحقق: {best_val_acc:.4f} (Epoch {best_epoch})")
    print(f"💾 تم حفظ النموذج في: {MODEL_OUTPUT}")
    
    # اختبار النموذج
    print("\n📊 اختبار النموذج...")
    model.eval()
    test_preds = []
    test_labels = []
    
    with torch.no_grad():
        for idx in range(0, len(test_dataset), 16):
            batch_indices = range(idx, min(idx + 16, len(test_dataset)))
            
            batch_mirna = []
            batch_gene = []
            batch_protein = []
            batch_labels = []
            
            for i in batch_indices:
                g_m, g_g, g_p, label = test_dataset[i]
                batch_mirna.append(g_m.to(device))
                batch_gene.append(g_g.to(device))
                batch_protein.append(g_p.to(device))
                batch_labels.append(label)
            
            batch_mirna = Batch.from_data_list(batch_mirna)
            batch_gene = Batch.from_data_list(batch_gene)
            batch_protein = Batch.from_data_list(batch_protein)
            batch_labels = torch.tensor(batch_labels, dtype=torch.long).to(device)
            
            out = model(batch_mirna, batch_gene, batch_protein)
            pred = out.argmax(dim=1)
            test_preds.extend(pred.cpu().numpy())
            test_labels.extend(batch_labels.cpu().numpy())
    
    test_acc = accuracy_score(test_labels, test_preds)
    test_precision = precision_score(test_labels, test_preds, average='binary')
    test_recall = recall_score(test_labels, test_preds, average='binary')
    test_f1 = f1_score(test_labels, test_preds, average='binary')
    
    print(f"\n📊 نتائج الاختبار:")
    print(f"  - الدقة: {test_acc:.4f}")
    print(f"  - Precision: {test_precision:.4f}")
    print(f"  - Recall: {test_recall:.4f}")
    print(f"  - F1-Score: {test_f1:.4f}")
    
    return model

# =========================
# 5. تحميل النموذج للتنبؤ
# =========================

def load_fusion_model(model_path=MODEL_OUTPUT):
    """
    تحميل النموذج المدرب من ملف .pkl
    """
    with open(model_path, 'rb') as f:
        checkpoint = pickle.load(f)
    
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
    
    print(f"✅ تم تحميل النموذج من: {model_path}")
    print(f"   - أفضل دقة تحقق: {checkpoint.get('best_val_acc', 'N/A')}")
    print(f"   - أفضل Epoch: {checkpoint.get('best_epoch', 'N/A')}")
    
    return model

# =========================
# 6. دالة التنبؤ (للاستخدام في المنصة)
# =========================

def predict_fusion(patient_id, graph_folders=GRAPH_FOLDERS, model_path=MODEL_OUTPUT):
    """
    التنبؤ بمريض جديد باستخدام النموذج المدمج
    """
    # تحميل النموذج
    model = load_fusion_model(model_path)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)
    
    # تحميل الرسوم البيانية للمريض
    graphs = {}
    for mtype, folder in graph_folders.items():
        graph_path = os.path.join(folder, f"{patient_id}.pt")
        if not os.path.exists(graph_path):
            return {'error': f'File not found: {graph_path}'}
        try:
            graph = torch.load(graph_path, weights_only=False)
        except:
            graph = torch.load(graph_path)
        graphs[mtype] = graph.to(device)
    
    # التنبؤ
    with torch.no_grad():
        out = model(graphs['mirna'], graphs['gene'], graphs['protein'])
        pred = out.argmax(dim=1).item()
        probs = torch.softmax(out, dim=1).cpu().numpy()[0]
    
    stage = 'Late' if pred == 1 else 'Early'
    confidence = max(probs)
    
    return {
        'patient_id': patient_id,
        'stage': stage,
        'confidence': float(confidence),
        'probabilities': {'Early': float(probs[0]), 'Late': float(probs[1])}
    }

# =========================
# 7. MAIN
# =========================

if __name__ == "__main__":
    # تدريب النموذج
    model = train_fusion_model()
    
    if model is not None:
        print("\n" + "="*60)
        print("✅ النموذج المدمج جاهز!")
        print(f"📁 تم حفظ النموذج في: {MODEL_OUTPUT}")
        print("\n💡 مثال للتنبؤ:")
        print("result = predict_fusion('TCGA-OR-A5J1')")
        print("print(result)")
        
        # اختبار التنبؤ
        print("\n🔬 اختبار التنبؤ بمريض:")
        try:
            test_patient = "TCGA-OR-A5J1"
            result = predict_fusion(test_patient)
            if 'error' not in result:
                print(f"  - المريض: {result['patient_id']}")
                print(f"  - المرحلة المتوقعة: {result['stage']}")
                print(f"  - الثقة: {result['confidence']:.2%}")
                print(f"  - الاحتمالات: Early={result['probabilities']['Early']:.2%}, Late={result['probabilities']['Late']:.2%}")
            else:
                print(f"  ⚠️ {result['error']}")
        except Exception as e:
            print(f"  ⚠️ خطأ في التنبؤ: {e}")
        
        print("="*60)