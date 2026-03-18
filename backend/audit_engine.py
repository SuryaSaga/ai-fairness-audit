"""
Core audit engine: computes fairness metrics from uploaded CSV/JSON datasets.
No external ML fairness libraries needed - pure pandas + numpy math.
"""
import pandas as pd
import numpy as np
import json
from typing import Dict, Any, Tuple, List


def compute_disparate_impact(df: pd.DataFrame, outcome_col: str, group_col: str) -> float:
    """
    Disparate Impact = P(positive outcome | unprivileged) / P(positive outcome | privileged)
    Value of 1.0 = perfect fairness; < 0.8 = potential disparate impact.
    """
    groups = df[group_col].unique()
    if len(groups) < 2:
        return 1.0

    rates = {}
    for g in groups:
        subset = df[df[group_col] == g]
        rates[g] = subset[outcome_col].mean()

    if len(rates) == 0 or max(rates.values()) == 0:
        return 1.0

    min_rate = min(rates.values())
    max_rate = max(rates.values())
    return round(float(min_rate / max_rate), 4) if max_rate > 0 else 1.0


def compute_statistical_parity(df: pd.DataFrame, outcome_col: str, group_col: str) -> float:
    """
    Statistical Parity Difference: difference in positive outcome rates between groups.
    Value of 0 = perfect fairness; negative = disadvantaged group.
    Returns 1 - abs(diff) normalized to [0,1] scale for consistent display.
    """
    groups = df[group_col].unique()
    if len(groups) < 2:
        return 1.0

    rates = [df[df[group_col] == g][outcome_col].mean() for g in groups]
    max_diff = max(rates) - min(rates)
    return round(float(1.0 - max_diff), 4)


def compute_equal_opportunity(df: pd.DataFrame, outcome_col: str, group_col: str, label_col: str = None) -> float:
    """
    Equal Opportunity: true positive rates across groups are equal.
    If label_col not present, approximates using outcome_col itself.
    Returns avg TPR-gap normalized.
    """
    if label_col and label_col in df.columns:
        groups = df[group_col].unique()
        tprs = []
        for g in groups:
            subset = df[df[group_col] == g]
            tp = ((subset[outcome_col] == 1) & (subset[label_col] == 1)).sum()
            fn = ((subset[outcome_col] == 0) & (subset[label_col] == 1)).sum()
            tpr = tp / (tp + fn) if (tp + fn) > 0 else 0
            tprs.append(tpr)
        if tprs:
            return round(float(1.0 - (max(tprs) - min(tprs))), 4)
    # Fallback: same as statistical parity
    return compute_statistical_parity(df, outcome_col, group_col)


def compute_predictive_equality(df: pd.DataFrame, outcome_col: str, group_col: str, label_col: str = None) -> float:
    """
    Predictive Equality: false positive rates across groups are equal.
    """
    if label_col and label_col in df.columns:
        groups = df[group_col].unique()
        fprs = []
        for g in groups:
            subset = df[df[group_col] == g]
            fp = ((subset[outcome_col] == 1) & (subset[label_col] == 0)).sum()
            tn = ((subset[outcome_col] == 0) & (subset[label_col] == 0)).sum()
            fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
            fprs.append(fpr)
        if fprs:
            return round(float(1.0 - (max(fprs) - min(fprs))), 4)
    return compute_statistical_parity(df, outcome_col, group_col)


def compute_treatment_equality(df: pd.DataFrame, outcome_col: str, group_col: str, label_col: str = None) -> float:
    """
    Treatment Equality: ratio of FN to FP per group should be equal.
    """
    if label_col and label_col in df.columns:
        groups = df[group_col].unique()
        ratios = []
        for g in groups:
            subset = df[df[group_col] == g]
            fp = ((subset[outcome_col] == 1) & (subset[label_col] == 0)).sum()
            fn = ((subset[outcome_col] == 0) & (subset[label_col] == 1)).sum()
            ratio = fn / fp if fp > 0 else fn
            ratios.append(ratio)
        if len(ratios) > 1:
            max_ratio = max(ratios) if max(ratios) > 0 else 1
            min_ratio = min(ratios) if min(ratios) > 0 else 0
            norm = min_ratio / max_ratio if max_ratio > 0 else 1.0
            return round(float(norm), 4)
    return compute_statistical_parity(df, outcome_col, group_col)


def compute_grade(metrics: Dict[str, float]) -> str:
    """
    Compute A/B/C/F grade based on combined metric scores.
    """
    vals = list(metrics.values())
    avg = np.mean(vals)
    di = metrics.get("disparate_impact", 1.0)

    # Grade logic
    if avg >= 0.92 and di >= 0.90:
        return "A"
    elif avg >= 0.82 and di >= 0.80:
        return "B+"
    elif avg >= 0.75 and di >= 0.75:
        return "B"
    elif avg >= 0.65 and di >= 0.65:
        return "C"
    else:
        return "F"


def compute_group_stats(df: pd.DataFrame, outcome_col: str, group_col: str) -> List[Dict]:
    """Compute per-group stats for the bar chart."""
    groups = df[group_col].unique()
    result = []
    for g in groups:
        subset = df[df[group_col] == g]
        rate = round(float(subset[outcome_col].mean() * 100), 2)
        result.append({
            "group": str(g),
            "approval_rate": rate,
            "count": int(len(subset))
        })
    return result


def detect_columns(df: pd.DataFrame) -> Tuple[str, str, str]:
    """
    Auto-detect outcome column, sensitive group column, and optional label column.
    """
    all_cols = [c.lower() for c in df.columns]
    col_map = {c.lower(): c for c in df.columns}

    # Detect outcome/prediction column
    outcome_keywords = ["shortlisted", "hired", "selected", "prediction", "predicted", "outcome", "label", "decision", "approved", "result", "score"]
    outcome_col = None
    for kw in outcome_keywords:
        for c in all_cols:
            if kw in c:
                outcome_col = col_map[c]
                break
        if outcome_col:
            break
    if not outcome_col:
        # Fall back to first binary column
        for c in df.columns:
            if df[c].dtype in [np.int64, np.float64] and df[c].nunique() <= 2:
                outcome_col = c
                break
    if not outcome_col:
        outcome_col = df.columns[0]

    # Detect group/sensitive attribute column
    group_keywords = ["race", "gender", "sex", "age_group", "ethnicity", "nationality", "group", "protected"]
    group_col = None
    for kw in group_keywords:
        for c in all_cols:
            if kw in c and col_map[c] != outcome_col:
                group_col = col_map[c]
                break
        if group_col:
            break
    if not group_col:
        for c in df.columns:
            if c != outcome_col and df[c].dtype == object:
                group_col = c
                break
    if not group_col:
        group_col = [c for c in df.columns if c != outcome_col][0] if len(df.columns) > 1 else outcome_col

    # Detect true label column
    label_keywords = ["actual", "true_label", "ground_truth", "real"]
    label_col = None
    for kw in label_keywords:
        for c in all_cols:
            if kw in c and col_map[c] not in [outcome_col, group_col]:
                label_col = col_map[c]
                break
        if label_col:
            break

    return outcome_col, group_col, label_col


def generate_recommendations(metrics: Dict[str, float], group_stats: List[Dict]) -> List[str]:
    """Generates simple actionable recommendations based on audit metrics."""
    recs = []
    di = metrics.get("disparate_impact", 1.0)
    sp = metrics.get("statistical_parity", 1.0)
    eo = metrics.get("equal_opportunity", 1.0)

    if di < 0.8:
        recs.append("🔴 Significant Disparate Impact detected. Consider re-balancing training data or using post-processing techniques like 'Reject Option Classification'.")
    elif di < 0.9:
        recs.append("🟡 Slight Disparate Impact. Monitor the model's approval rates for minority groups.")

    if sp < 0.8:
        recs.append("🔴 Statistical Parity is low. Certain groups have much lower selection rates regardless of qualifications. Review global selection criteria.")

    if eo < 0.8:
        recs.append("🔴 Equal Opportunity gap is high. The model may be more 'strict' on qualified individuals from certain groups. Check for group-specific feature importance.")

    if len(recs) == 0:
        recs.append("🟢 Metrics look healthy. Continue regular auditing with new production data.")

    return recs


def run_audit(file_path: str, custom_mapping: Dict[str, str] = None) -> Dict[str, Any]:
    """
    Main entry point: loads file, runs all fairness metrics, returns results dict.
    """
    # Load file
    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path)
    elif file_path.endswith(".json"):
        df = pd.read_json(file_path)
    else:
        raise ValueError("Unsupported file format. Use CSV or JSON.")

    if df.empty:
        raise ValueError("Dataset is empty.")

    # Detect or use custom columns
    if custom_mapping:
        outcome_col = custom_mapping.get("outcome")
        group_col = custom_mapping.get("group")
        label_col = custom_mapping.get("label")
        if not outcome_col or outcome_col not in df.columns:
            raise ValueError(f"Outcome column '{outcome_col}' not found in dataset.")
        if not group_col or group_col not in df.columns:
            raise ValueError(f"Group column '{group_col}' not found in dataset.")
    else:
        outcome_col, group_col, label_col = detect_columns(df)

    # Binarize outcome column if needed
    if pd.api.types.is_numeric_dtype(df[outcome_col]):
        df[outcome_col] = (df[outcome_col] > df[outcome_col].median()).astype(int)
    else:
        df[outcome_col] = (df[outcome_col].astype(str).str.lower().isin(["yes", "true", "1", "approved", "positive", "shortlisted", "selected", "hired"])).astype(int)

    # Compute metrics
    metrics = {
        "disparate_impact": compute_disparate_impact(df, outcome_col, group_col),
        "statistical_parity": compute_statistical_parity(df, outcome_col, group_col),
        "equal_opportunity": compute_equal_opportunity(df, outcome_col, group_col, label_col),
        "predictive_equality": compute_predictive_equality(df, outcome_col, group_col, label_col),
        "treatment_equality": compute_treatment_equality(df, outcome_col, group_col, label_col),
    }

    grade = compute_grade(metrics)
    group_stats = compute_group_stats(df, outcome_col, group_col)
    recommendations = generate_recommendations(metrics, group_stats)

    return {
        "outcome_col": outcome_col,
        "group_col": group_col,
        "total_records": len(df),
        "grade": grade,
        "metrics": metrics,
        "group_stats": group_stats,
        "recommendations": recommendations,
        "label_col": label_col
    }
