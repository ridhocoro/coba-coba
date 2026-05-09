"""
classifier.py
─────────────────────────────────────────────
Sistem klasifikasi keluhan pasien dua lapis:
  Lapis 1 → Rule-Based (keyword matching)
  Lapis 2 → Naive Bayes (fallback)
"""

import re
import pickle
import os

# ─── Keyword rules per kategori ──────────────────────────────
RULES = {
    "ISPA": [
        "batuk", "pilek", "demam", "flu", "influenza",
        "hidung tersumbat", "hidung meler", "bersin", "radang tenggorokan",
        "tenggorokan sakit", "suara serak", "badan panas", "panas dingin",
        "kepala pusing", "badan lemas demam",
    ],
    "Hipertensi": [
        "tekanan darah tinggi", "darah tinggi", "hipertensi", "tensi tinggi",
        "tensi", "tekanan darah", "kepala berat", "leher kaku",
    ],
    "Diabetes": [
        "gula darah", "diabetes", "sering buang air kecil", "sering haus",
        "luka susah sembuh", "berat badan turun", "sering lapar", "kesemutan di kaki",
    ],
    "Gangguan Pencernaan": [
        "mual", "muntah", "diare", "sakit perut", "perut kembung",
        "perut mulas", "maag", "ulu hati", "sembelit", "tidak bisa bab",
        "buang air besar", "bab berdarah", "tidak nafsu makan",
    ],
    "Penyakit Kulit": [
        "kulit gatal", "gatal gatal", "ruam", "bintik merah", "eksim",
        "alergi kulit", "kulit kering", "kulit mengelupas", "jerawat", "bentol",
        "kulit bersisik",
    ],
    "Gangguan Jantung": [
        "nyeri dada", "jantung berdebar", "dada tertekan", "detak jantung",
        "dada sakit", "jantung berdegup", "nyeri dada menjalar",
    ],
    "Gangguan Paru": [
        "sesak napas", "sesak nafas", "asma", "batuk kronis", "nafas berbunyi",
        "mengi", "batuk darah", "napas pendek",
    ],
    "Gangguan Saraf": [
        "kesemutan", "migrain", "kepala berdenyut", "wajah kaku", "tangan gemetar",
        "kaki kebas", "vertigo", "kepala berputar", "kebas",
    ],
    "Gangguan Mata": [
        "mata merah", "mata gatal", "penglihatan kabur", "mata berair",
        "mata silau", "mata bengkak", "mata mengganjal", "mata perih",
    ],
    "Gangguan Ginjal": [
        "nyeri pinggang", "urin keruh", "kaki bengkak", "sakit buang air kecil",
        "pinggang sakit", "urin berbau", "buang air kecil nyeri",
    ],
    "Gangguan Mental": [
        "cemas", "sulit tidur", "tidak bisa tidur", "susah tidur", "stres",
        "depresi", "sedih", "serangan panik", "mudah marah", "tidak bersemangat",
        "sulit konsentrasi",
    ],
}

CONFIDENCE_RULE = 0.92   # confidence tetap jika rule cocok
CONFIDENCE_NB   = None   # diisi dari probabilitas model

# ─── Preprocessing ───────────────────────────────────────────
def preprocess(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# ─── Lapis 1: Rule-Based ─────────────────────────────────────
def rule_based_classify(text: str):
    """
    Cocokkan keyword. Kembalikan (kategori, confidence)
    atau (None, 0) jika tidak ada yang cocok.
    """
    clean = preprocess(text)
    scores = {}

    for kategori, keywords in RULES.items():
        hit = sum(1 for kw in keywords if kw in clean)
        if hit > 0:
            scores[kategori] = hit

    if not scores:
        return None, 0.0

    # Ambil kategori dengan hit terbanyak
    # Jika seri, prioritaskan kategori yang lebih spesifik
    # (Gangguan Pencernaan kalah jika ada hit di kategori lain)
    best = max(scores, key=scores.get)

    # Jika skor seri antara dua kategori, hindari Gangguan Pencernaan
    # ketika "mual" muncul bersama gejala kategori lain
    top_score = scores[best]
    tied = [k for k, v in scores.items() if v == top_score]
    if len(tied) > 1 and "Gangguan Pencernaan" in tied:
        tied.remove("Gangguan Pencernaan")
        best = tied[0]

    return best, CONFIDENCE_RULE

# ─── Lapis 2: Naive Bayes ────────────────────────────────────
_model      = None
_vectorizer = None

def _load_model():
    global _model, _vectorizer
    model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
    if os.path.exists(model_path):
        with open(model_path, "rb") as f:
            bundle = pickle.load(f)
            _model      = bundle["model"]
            _vectorizer = bundle["vectorizer"]

def nb_classify(text: str):
    """
    Klasifikasi dengan Naive Bayes.
    Kembalikan (kategori, confidence).
    """
    global _model, _vectorizer
    if _model is None:
        _load_model()
    if _model is None:
        return "Lainnya", 0.5   # fallback jika model belum ada

    clean = preprocess(text)
    X = _vectorizer.transform([clean])
    proba = _model.predict_proba(X)[0]
    idx   = proba.argmax()
    return _model.classes_[idx], round(float(proba[idx]), 4)

# ─── Main classifier (gabungan) ──────────────────────────────
def classify(text: str) -> dict:
    """
    Klasifikasi utama.
    Kembalikan dict: { kategori, confidence, metode }
    """
    # Lapis 1
    kategori, conf = rule_based_classify(text)
    if kategori:
        return {
            "kategori":   kategori,
            "confidence": conf,
            "metode":     "rule-based",
        }

    # Lapis 2 (fallback)
    kategori, conf = nb_classify(text)
    return {
        "kategori":   kategori,
        "confidence": conf,
        "metode":     "naive-bayes",
    }