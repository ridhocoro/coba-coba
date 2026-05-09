"""
app.py
─────────────────────────────────────────────
FastAPI ML Service — endpoint klasifikasi keluhan

Cara menjalankan:
  uvicorn app:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from classifier import classify
from collections import Counter
from typing import List
import re

app = FastAPI(title="Klinik ML Service", version="1.0.0")

# Allow Express backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Schema ───────────────────────────────────────────────────
class KeluhanInput(BaseModel):
    keluhan: str

class KeluhanBatchInput(BaseModel):
    data: List[dict]   # [{ id, keluhan }, ...]

# ─── Endpoint 1: Klasifikasi satu keluhan (real-time) ─────────
@app.post("/classify")
def classify_keluhan(body: KeluhanInput):
    """
    Input : { "keluhan": "kepala pusing dan mual" }
    Output: { "kategori": "ISPA", "confidence": 0.92, "metode": "rule-based" }
    """
    if not body.keluhan or len(body.keluhan.strip()) < 3:
        raise HTTPException(status_code=400, detail="Keluhan terlalu pendek")

    result = classify(body.keluhan)
    return {"success": True, "data": result}

# ─── Endpoint 2: Klasifikasi batch (untuk data lama) ──────────
@app.post("/classify/batch")
def classify_batch(body: KeluhanBatchInput):
    """
    Input : { "data": [{ "id": 1, "keluhan": "..." }, ...] }
    Output: { "success": true, "data": [{ "id": 1, "kategori": "...", ... }] }
    """
    results = []
    for item in body.data:
        if not item.get("keluhan"):
            results.append({**item, "kategori": "Lainnya", "confidence": 0, "metode": "skip"})
            continue
        result = classify(item["keluhan"])
        results.append({"id": item.get("id"), **result})
    return {"success": True, "data": results}

# ─── Endpoint 3: Health check ─────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "klinik-ml"}