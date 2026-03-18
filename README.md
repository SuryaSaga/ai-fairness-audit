# FairAudit AI 🛡️

FairAudit AI is a full-stack application designed to audit AI models for bias using standard fairness metrics and provide actionable recommendations.

## Project Structure
- **/frontend**: React + Vite + Tailwind CSS dashboard.
- **/backend**: FastAPI + Python (Pandas/NumPy) audit engine.

## Getting Started

### 1. Backend Setup
```bash
cd backend
# Optional: Create and activate virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start Server
python -m uvicorn main:app --reload
```
The backend will be available at [http://localhost:8000](http://localhost:8000).

### 2. Database Migration (If updating from older version)
If you already have a `fairaudit.db` and need the new columns (`recommendations`, `column_mapping`), run:
```bash
python migrate_db.py
```

### 3. Frontend Setup
```bash
cd frontend
# Install dependencies
npm install

# Start development server
npm run dev
```
The frontend will be available at the URL provided by Vite (e.g., [http://localhost:5173](http://localhost:5173)).

## Features
- **Column Mapping**: Manually define column roles during upload.
- **Actionable Recommendations**: Get specific advice to mitigate detected bias.
- **Fairness Metrics**: Disparate Impact, Statistical Parity, Equal Opportunity, etc.
- **Automated Grading**: Instant A/B/C/F grade based on fairness scores.
