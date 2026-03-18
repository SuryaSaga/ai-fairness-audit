"""
FastAPI main application - all API endpoints.
"""
import os
import json
import shutil
from typing import Optional, List
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db, init_db, User, AuditReport
from auth import (
    get_password_hash,
    authenticate_user,
    create_access_token,
    get_user_by_email,
    decode_token,
)
from audit_engine import run_audit

# ──────────────────────────────────────────────
# App setup
# ──────────────────────────────────────────────
app = FastAPI(title="FairAudit AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, you may want to restrict this to your actual Vercel domain later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.on_event("startup")
def startup_event():
    init_db()


# ──────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_name: str
    user_email: str


# ──────────────────────────────────────────────
# Auth helpers
# ──────────────────────────────────────────────
def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    email = payload.get("sub")
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


# ──────────────────────────────────────────────
# Auth endpoints
# ──────────────────────────────────────────────
@app.post("/api/auth/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if get_user_by_email(db, body.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=body.name,
        email=body.email,
        hashed_password=get_password_hash(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.email})
    return TokenResponse(access_token=token, user_name=user.name, user_email=user.email)


@app.post("/api/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token({"sub": user.email})
    return TokenResponse(access_token=token, user_name=user.name, user_email=user.email)


@app.get("/api/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "name": current_user.name, "email": current_user.email}


# ──────────────────────────────────────────────
# Dataset upload & audit endpoint
# ──────────────────────────────────────────────
@app.post("/api/audit/preview")
async def preview_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Returns column names and types for mapping."""
    if not (file.filename.endswith(".csv") or file.filename.endswith(".json")):
        raise HTTPException(status_code=400, detail="Only CSV or JSON files are supported.")

    import pandas as pd
    import io

    content = await file.read()
    if file.filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content), nrows=5)
    else:
        df = pd.read_json(io.BytesIO(content))

    columns = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        sample = df[col].dropna().iloc[0] if not df[col].dropna().empty else None
        columns.append({"name": col, "type": dtype, "sample": str(sample)})

    return {"filename": file.filename, "columns": columns}


@app.post("/api/audit/upload")
async def upload_and_audit(
    file: UploadFile = File(...),
    mapping: str = Header(None), # JSON string
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate file type
    if not (file.filename.endswith(".csv") or file.filename.endswith(".json")):
        raise HTTPException(status_code=400, detail="Only CSV or JSON files are supported.")

    # Parse mapping if provided
    column_mapping = None
    if mapping:
        try:
            column_mapping = json.loads(mapping)
        except:
            pass

    # Save file
    file_path = os.path.join(UPLOAD_DIR, f"{current_user.id}_{file.filename}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Create pending audit report
    report = AuditReport(
        user_id=current_user.id,
        dataset_name=file.filename,
        status="pending",
        column_mapping=json.dumps(column_mapping) if column_mapping else None
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Run audit
    try:
        result = run_audit(file_path, column_mapping)

        report.status = "complete"
        report.grade = result["grade"]
        report.disparate_impact = result["metrics"]["disparate_impact"]
        report.statistical_parity = result["metrics"]["statistical_parity"]
        report.equal_opportunity = result["metrics"]["equal_opportunity"]
        report.predictive_equality = result["metrics"]["predictive_equality"]
        report.treatment_equality = result["metrics"]["treatment_equality"]
        report.group_stats = json.dumps(result["group_stats"])
        report.recommendations = json.dumps(result["recommendations"])
        report.summary = (
            f"Audited {result['total_records']} records. "
            f"Sensitive attribute: '{result['group_col']}'. "
            f"Outcome column: '{result['outcome_col']}'."
        )
        db.commit()
        db.refresh(report)

        # Clean local file
        os.remove(file_path)

        return {
            "report_id": report.id,
            "dataset_name": file.filename,
            "status": "complete",
            "grade": report.grade,
            "total_records": result["total_records"],
            "outcome_col": result["outcome_col"],
            "group_col": result["group_col"],
            "metrics": result["metrics"],
            "group_stats": result["group_stats"],
            "recommendations": result["recommendations"],
            "summary": report.summary,
            "created_at": report.created_at.isoformat(),
        }

    except Exception as e:
        report.status = "failed"
        db.commit()
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=422, detail=f"Audit failed: {str(e)}")


# ──────────────────────────────────────────────
# Reports history
# ──────────────────────────────────────────────
@app.get("/api/audit/reports")
def get_reports(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reports = (
        db.query(AuditReport)
        .filter(AuditReport.user_id == current_user.id)
        .order_by(AuditReport.created_at.desc())
        .all()
    )
    return [
        {
            "report_id": r.id,
            "dataset_name": r.dataset_name,
            "status": r.status,
            "grade": r.grade,
            "metrics": {
                "disparate_impact": r.disparate_impact,
                "statistical_parity": r.statistical_parity,
                "equal_opportunity": r.equal_opportunity,
                "predictive_equality": r.predictive_equality,
                "treatment_equality": r.treatment_equality,
            },
            "group_stats": json.loads(r.group_stats) if r.group_stats else [],
            "recommendations": json.loads(r.recommendations) if r.recommendations else [],
            "column_mapping": json.loads(r.column_mapping) if r.column_mapping else None,
            "summary": r.summary,
            "created_at": r.created_at.isoformat(),
        }
        for r in reports
    ]


@app.get("/api/audit/reports/{report_id}")
def get_report(report_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.query(AuditReport).filter(AuditReport.id == report_id, AuditReport.user_id == current_user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "report_id": report.id,
        "dataset_name": report.dataset_name,
        "status": report.status,
        "grade": report.grade,
        "metrics": {
            "disparate_impact": report.disparate_impact,
            "statistical_parity": report.statistical_parity,
            "equal_opportunity": report.equal_opportunity,
            "predictive_equality": report.predictive_equality,
            "treatment_equality": report.treatment_equality,
        },
        "group_stats": json.loads(report.group_stats) if report.group_stats else [],
        "recommendations": json.loads(report.recommendations) if report.recommendations else [],
        "column_mapping": json.loads(report.column_mapping) if report.column_mapping else None,
        "summary": report.summary,
        "created_at": report.created_at.isoformat(),
    }


@app.get("/")
def root():
    return {"status": "ok", "message": "FairAudit AI Backend is running 🚀"}
