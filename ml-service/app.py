"""
app.py — FastAPI ML Service v2.0
Cara menjalankan: uvicorn app:app --host 0.0.0.0 --port 8000 --reload
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from classifier import classify
from typing import List, Optional

app = FastAPI(title="Klinik ML Service", version="2.0.0")
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
    return {"status": "ok", "service": "klinik-ml", "version": "2.0.0"}
