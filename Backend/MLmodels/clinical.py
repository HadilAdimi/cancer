import pandas as pd
import numpy as np
import joblib

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from lifelines import CoxPHFitter

# =========================
# LOAD
# =========================
df = pd.read_csv("./data/data.tsv", sep="\t", low_memory=False, encoding="latin1")
df.columns = df.columns.str.strip()

# =========================
# CLEAN
# =========================
df = df.replace(
    ["[Not Available]", "[Unknown]", "[Not Evaluated]", "[Not Applicable]", ""],
    np.nan
)

df["age"] = pd.to_numeric(df["age_at_initial_pathologic_diagnosis"], errors="coerce")
df["weight"] = pd.to_numeric(df["weight"], errors="coerce")

df["days_to_death"] = pd.to_numeric(df["days_to_death"], errors="coerce")
df["days_to_last_followup"] = pd.to_numeric(df["days_to_last_followup"], errors="coerce")

df["survival_time"] = df["days_to_death"].fillna(df["days_to_last_followup"])
df["event"] = df["vital_status"].map({"Alive": 0, "Dead": 1})

df = df.dropna(subset=["survival_time", "event"])

# =========================
# FEATURE ENGINEERING
# =========================

# age group
df["age"] = df["age"].fillna(df["age"].median())

df["age_group"] = pd.cut(
    df["age"],
    bins=[0, 40, 60, 80, 120],
    labels=["young", "mid", "senior", "elder"]
)

df["age_group"] = df["age_group"].astype(str)
df["age_group"] = df["age_group"].replace("nan", "unknown")

# grade simplification
def simplify_grade(x):
    if pd.isna(x):
        return np.nan
    x = str(x).lower()
    if "1" in x:
        return "low"
    elif "2" in x:
        return "medium"
    elif "3" in x or "4" in x:
        return "high"
    return "unknown"

df["grade"] = df["neoplasm_histologic_grade"].apply(simplify_grade)

# yes/no cleaner
def simplify_yes_no(x):
    if pd.isna(x):
        return np.nan
    x = str(x).lower()
    if "yes" in x:
        return "yes"
    elif "no" in x:
        return "no"
    return "unknown"

for col in [
    "radiation_therapy",
    "postoperative_rx_tx",
    "targeted_molecular_therapy",
    "residual_tumor",
    "margin_status"
]:
    df[col] = df[col].apply(simplify_yes_no)

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
df["stage_score"] = df["pathologic_stage"].astype(str).str.lower().map(stage_map)
df["stage_score"] = pd.to_numeric(df["stage_score"], errors="coerce")
df["stage_score"] = df["stage_score"].fillna(0)

df["number_of_lymphnodes_positive"] = pd.to_numeric(
    df["number_of_lymphnodes_positive"],
    errors="coerce"
).fillna(0)

df["stage_ln_interaction"] = df["stage_score"] * df["number_of_lymphnodes_positive"]






# =========================
# FEATURES
# =========================
features = [
    "age",
    "weight",
    "age_group",
    "gender",
    "acronym",
    "pathologic_stage",
    "pathologic_T",
    "pathologic_N",
    "pathologic_M",
    "grade",
    "radiation_therapy",
    "postoperative_rx_tx",
    "targeted_molecular_therapy",
    "residual_tumor",
    "margin_status",
    "karnofsky_performance_score",
    "lymph_node_examined_count",
    "number_of_lymphnodes_positive",
    "stage_score",
    "stage_ln_interaction"

]

# categorical → convert to string then fill
cat_cols = [
    "gender",
    "acronym",
    "pathologic_stage",
    "pathologic_T",
    "pathologic_N",
    "pathologic_M",
    "grade",
    "radiation_therapy",
    "postoperative_rx_tx",
    "targeted_molecular_therapy",
    "residual_tumor",
    "margin_status",
    "age_group"
]

for col in cat_cols:
    df[col] = df[col].astype(str)
    df[col] = df[col].replace("nan", np.nan)  # fix string "nan"
    df[col] = df[col].fillna("unknown")

X = df[features]
print(df[cat_cols].isna().sum())

# =========================
# HANDLE RARE CATEGORIES
# =========================
def clean_category(col, min_count=30):
    counts = col.value_counts()
    rare = counts[counts < min_count].index
    return col.replace(rare, "OTHER")

cat_to_clean = [
    "acronym"
]

allowed_categories = {}

for c in cat_to_clean:
    df[c] = clean_category(df[c])
    allowed_categories[c] = df[c].unique().tolist()
    



# =========================
# PREPROCESSOR
# =========================
cat_cols = [
    "gender",
    "acronym",
    "pathologic_T",
    "pathologic_N",
    "pathologic_M",
    "age_group",
    "grade",
    "radiation_therapy",
    "postoperative_rx_tx",
    "targeted_molecular_therapy",
    "residual_tumor",
    "margin_status"
]

num_cols = [
    "age",
    "weight",
    "karnofsky_performance_score",
    "lymph_node_examined_count",
    "number_of_lymphnodes_positive",
    "stage_score",
    "stage_ln_interaction"
]

preprocessor = ColumnTransformer(
    transformers=[
        ("num", StandardScaler(), num_cols),
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols)
    ]
)

X_processed = preprocessor.fit_transform(X)

feature_names = preprocessor.get_feature_names_out()

X_df = pd.DataFrame(
    X_processed.toarray() if hasattr(X_processed, "toarray") else X_processed,
    columns=feature_names
)

X_df["time"] = df["survival_time"].values
X_df["event"] = df["event"].values

print("Any NaN left:", X_df.isna().sum().sum())
print("Shape:", X_df.shape)

# =========================
# FINAL CLEAN BEFORE MODEL
# =========================

# replace inf
X_df = X_df.replace([np.inf, -np.inf], np.nan)

# fill any remaining NaN with 0
X_df = X_df.fillna(0)

# =========================
# REMOVE LOW VARIANCE
# =========================
var = X_df.var()

low_var_cols = var[var < 1e-5].index

X_df = X_df.drop(columns=low_var_cols)

# =========================
# COX MODEL
# =========================
cox_model = CoxPHFitter(penalizer=0.01)
cox_model.fit(X_df, duration_col="time", event_col="event")

print(cox_model.summary.sort_values("coef", ascending=False).head(10))

# =========================
# SAVE
# =========================
joblib.dump(
    {
        "cox_model": cox_model,
        "preprocessor": preprocessor,
        "feature_names": X_df.columns.drop(["time", "event"]),
        "allowed_categories": allowed_categories
    },
    "cox_model.pkl"
)

print("training completed")