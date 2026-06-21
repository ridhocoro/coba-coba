"""
app.py — FastAPI ML Service v2.0
Cara menjalankan: uvicorn app:app --host 0.0.0.0 --port 8000 --reload
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from classifier import classify, load_models_sync
from typing import List, Optional
from contextlib import asynccontextmanager
import os
from datetime import datetime
from pymongo import MongoClient

# Initialize MongoDB Client
MONGO_URI = os.getenv("MONGO_URI", "")
db_client = None
if MONGO_URI:
    try:
        # Use a short timeout so it doesn't block startup if DB is down
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db_client = client.get_default_database()
    except Exception as e:
        print(f"⚠ [ML-Service] Gagal setup MongoDB: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 [ML-Service] Memuat model ke memori...")
    load_models_sync()
    print("✅ [ML-Service] Model siap melayani request!")
    if db_client is not None:
        print("✅ [ML-Service] Terhubung ke MongoDB untuk logging")
    yield
    print("🛑 [ML-Service] Shutting down...")

app = FastAPI(title="Klinik ML Service", version="4.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class KeluhanInput(BaseModel):
    keluhan: str
    gender: Optional[str] = None  # dari profil user: 'laki-laki'|'perempuan'|null

class KeluhanBatchInput(BaseModel):
    data: List[dict]  # [{ id, keluhan, gender? }, ...]

def normalize_gender(raw):
    if not raw:
        return None
    g = str(raw).lower().strip()
    if g in ("male", "laki-laki", "laki laki", "pria", "l"):
        return "male"
    if g in ("female", "perempuan", "wanita", "p"):
        return "female"
    return None

@app.post("/classify")
def classify_keluhan(body: KeluhanInput):
    if not body.keluhan or len(body.keluhan.strip()) < 3:
        raise HTTPException(status_code=400, detail="Keluhan terlalu pendek")
    result = classify(body.keluhan, gender=normalize_gender(body.gender))
    return {"success": True, "data": result}

@app.post("/classify/batch")
def classify_batch(body: KeluhanBatchInput):
    results = []
    for item in body.data:
        if not item.get("keluhan"):
            results.append({**item, "kategori": "Lainnya", "confidence": 0, "metode": "skip", "gender": None})
            continue
        result = classify(item["keluhan"], gender=normalize_gender(item.get("gender")))
        results.append({"id": item.get("id"), **result})
    return {"success": True, "data": results}

@app.get("/health")
def health():
    return {"status": "ok", "service": "klinik-ml", "version": "4.0.0"}

@app.get("/metrics")
def get_metrics():
    import json
    base = os.path.dirname(os.path.abspath(__file__))
    metrics_path = os.path.join(base, "metrics.json")
    if os.path.exists(metrics_path):
        with open(metrics_path, "r", encoding="utf-8") as f:
            metrics = json.load(f)
        return {"success": True, "data": metrics}
    else:
        return {"success": False, "message": "Metrics not found"}

class FeedbackInput(BaseModel):
    keluhan: str
    prediksi_sistem: str
    koreksi_dokter: str

@app.post("/feedback")
def submit_feedback(body: FeedbackInput):
    if db_client is not None:
        try:
            db_client.prediction_logs.insert_one({
                "keluhan": body.keluhan,
                "prediksi_sistem": body.prediksi_sistem,
                "koreksi_dokter": body.koreksi_dokter,
                "timestamp": datetime.utcnow()
            })
            return {"success": True, "message": "Feedback saved to MongoDB"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        print(f"Feedback received (No DB): {body.dict()}")
        return {"success": True, "message": "Feedback received but DB not configured"}

import subprocess
@app.post("/retrain")
def trigger_retrain(background_tasks: BackgroundTasks):
    def run_retrain():
        try:
            print("[Active Learning] Memulai retrain model...")
            subprocess.run(["python", "retrain.py"], check=True)
            print("[Active Learning] Retrain selesai, memuat model baru...")
            load_models_sync() # Reload the model in memory
        except Exception as e:
            print(f"[Active Learning] Retrain gagal: {e}")
            
    background_tasks.add_task(run_retrain)
    return {"success": True, "message": "Retrain dimulai di background"}
