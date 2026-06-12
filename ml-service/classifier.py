"""
classifier.py
─────────────────────────────────────────────────────────────────────
Sistem klasifikasi keluhan pasien (v4.0):
  - Prior Booster: Rule-based + Context digabung dengan probabilitas ML
  - Unified Pipeline: TF-IDF Char + Word + SGDClassifier
  - Gender di-inject sebagai fitur eksplisit (__gender_female__, dll)
─────────────────────────────────────────────────────────────────────
"""

import re
import pickle
import os
import numpy as np

# ════════════════════════════════════════════════════════════════════
#  LAPIS 1 — RULES (sebagai Prior Booster)
# ════════════════════════════════════════════════════════════════════
RULES = {
    # ── Poli Umum ─────────────────────────────────────────────────
    "ISPA": [
        "batuk", "pilek", "demam", "flu", "influenza",
        "hidung tersumbat", "hidung meler", "bersin", "radang tenggorokan",
        "tenggorokan sakit", "suara serak", "badan panas", "panas dingin",
        "kepala pusing", "badan lemas demam", "meriang", "badan meriang",
        "tenggorokan gatal", "suara hilang", "batuk berdahak", "batuk kering",
        "hidung gatal", "hidung berair", "tenggorokan kering",
        "batuk terus", "batuk tidak berhenti",
        "sesak napas", "sesak nafas", "asma", "nafas berbunyi",
        "mengi", "napas pendek", "sulit bernapas", "napas ngos ngosan",
    ],
    "Hipertensi": [
        "tekanan darah tinggi", "darah tinggi", "hipertensi", "tensi tinggi",
        "tensi", "tekanan darah", "kepala berat", "leher kaku",
        "kepala bagian belakang sakit", "telinga berdengung", "wajah panas memerah",
        "pandangan berkunang", "leher tegang", "pusing tengkuk",
    ],
    "Diabetes": [
        "gula darah", "diabetes", "sering buang air kecil", "sering haus",
        "luka susah sembuh", "berat badan turun", "sering lapar", "kesemutan di kaki",
        "mulut kering", "sering kencing malam", "gula darah fluktuatif",
        "gula darah tinggi", "kadar gula",
    ],
    "Gangguan Pencernaan": [
        "mual", "muntah", "diare", "sakit perut", "perut kembung",
        "perut mulas", "maag", "ulu hati", "sembelit", "tidak bisa bab",
        "buang air besar", "bab berdarah", "tidak nafsu makan",
        "asam lambung", "perut melilit", "perut terasa penuh", "sendawa berbau",
        "lambung perih", "perut sakit", "mencret", "berak cair",
    ],
    "Penyakit Kulit": [
        "kulit gatal", "gatal gatal", "ruam", "bintik merah", "eksim",
        "alergi kulit", "kulit kering", "kulit mengelupas", "jerawat", "bentol",
        "kulit bersisik", "biduran", "bercak putih", "kulit kepala gatal",
        "kulit terbakar", "kulit memerah", "gatal di kulit", "kulit bernanah",
    ],
    "Gangguan Jantung": [
        "nyeri dada", "jantung berdebar", "dada tertekan", "detak jantung",
        "dada sakit", "jantung berdegup", "nyeri dada menjalar",
        "dada berdebar", "keringat dingin tiba tiba", "jantung tidak teratur",
    ],
    "Gangguan Saraf": [
        "kesemutan", "migrain", "kepala berdenyut", "wajah kaku", "tangan gemetar",
        "kaki kebas", "vertigo", "kepala berputar", "kebas", "berputar",
        "kaki seperti ditusuk jarum", "migrain sebelah", "tangan kebas",
        "badan kesemutan", "pusing berputar",
    ],
    "Gangguan Mata": [
        "mata merah", "mata gatal", "penglihatan kabur", "mata berair",
        "mata silau", "mata bengkak", "mata mengganjal", "mata perih",
        "penglihatan dobel", "mata kering", "kotoran kuning mata",
        "kelopak mata bengkak", "penglihatan buram", "mata tidak jelas",
    ],
    "Gangguan Ginjal": [
        "nyeri pinggang", "urin keruh", "kaki bengkak", "sakit buang air kecil",
        "pinggang sakit", "urin berbau", "buang air kecil nyeri",
        "urin merah", "urin berbusa", "batu ginjal", "pipis nyeri",
        "kencing nyeri", "kencing berdarah",
    ],
    "Gangguan Gigi & Mulut": [
        "sakit gigi", "gigi berlubang", "gigi bolong", "gigi ngilu",
        "nyeri gigi", "gigi hitam", "gigi geraham sakit",
        "gigi sakit saat minum", "gigi sakit saat makan",
        "bau mulut gigi berlubang", "gigi nyut nyutan", "gigi sakit berdenyut",
        "gusi bengkak", "gusi berdarah", "gusi merah", "gusi sakit",
        "gusi nyeri", "gusi sensitif", "gusi perih", "gusi membengkak",
        "abses gigi", "benjolan di gusi", "gusi bernanah", "nanah gigi",
        "pipi bengkak gigi", "infeksi gigi", "rahang bengkak",
        "gigi sensitif", "ngilu gigi panas dingin", "saraf gigi sensitif",
        "gigi ngilu minum es", "gigi ngilu kena angin",
        "gigi bungsu", "gigi geraham belakang tumbuh",
        "gigi bungsu miring", "gigi paling belakang sakit",
        "sariawan", "luka di mulut", "mulut perih", "bibir pecah pecah",
        "mulut kering gigi", "bau mulut", "napas berbau",
    ],
    "Malnutrisi": [
        "berat badan kurang", "tubuh kurus", "kekurangan gizi",
        "badan kurus drastis", "makan sedikit tidak bertenaga",
        "kurang makan lemas", "anak susah makan berat badan",
        "gizi kurang", "rambut rontok gizi", "kuku rapuh gizi",
        "kurus", "badannya kurus", "sangat kurus", "terlalu kurus",
        "kurang gizi", "gizi buruk", "bb rendah", "berat badan rendah",
        "tidak gemuk", "susah gemuk", "berat badan kurang ideal",
    ],
    "Obesitas": [
        "berat badan berlebih", "gemuk", "kelebihan berat badan",
        "obesitas", "badan berat aktivitas", "perut buncit",
        "program penurunan berat badan", "diet konsultasi",
        "badan gemuk kolesterol", "terlalu gemuk", "overweight",
    ],
    "Anemia": [
        "kurang darah", "anemia", "hemoglobin rendah", "muka pucat",
        "lemas kurang darah", "mata berkunang anemia",
        "pingsan lemas anemia", "darah rendah pusing", "kuku pucat anemia",
        "wajah pucat lemas", "hb rendah",
    ],
    "Gangguan Makan": [
        "tidak nafsu makan", "susah makan", "mual melihat makanan",
        "makan berlebihan bersalah", "takut gemuk tidak mau makan",
        "pola makan tidak teratur", "porsi makan tidak terkontrol",
        "anoreksia", "bulimia", "makan tidak terkontrol",
    ],
    "Defisiensi Vitamin": [
        "kurang vitamin", "kekurangan vitamin", "kurang kalsium",
        "kurang vitamin d", "kram otot magnesium", "kulit kusam vitamin b",
        "kekurangan zat besi", "imun lemah vitamin",
        "sariawan kurang vitamin c", "tulang keropos kalsium",
    ],
    "Kehamilan": [
        "hamil", "morning sickness", "mual pagi hamil",
        "kontrol kehamilan", "trimester", "janin", "kehamilan",
        "telat haid mual", "bercak darah hamil", "kaki bengkak hamil",
        "tekanan darah hamil", "cek kehamilan", "usg kandungan",
    ],
    "Gangguan Menstruasi": [
        "haid tidak teratur", "nyeri haid", "haid tidak lancar",
        "darah haid banyak", "haid telat", "kram haid",
        "menstruasi sedikit", "haid tidak berhenti",
        "siklus haid tidak teratur", "menstruasi terlambat",
        "haid tidak datang", "mens tidak lancar", "haid", "mens",
    ],
    "Kontrasepsi": [
        "kb", "kontrasepsi", "iud", "pil kb", "suntik kb",
        "implan kb", "metode kontrasepsi", "berhenti kb",
        "efek samping kb", "pasang kb", "lepas kb",
    ],
    "Tumbuh Kembang Anak": [
        "anak tidak mau makan", "anak terlambat bicara",
        "pertumbuhan anak lambat", "anak sering sakit",
        "bayi tidak naik berat badan", "anak demam rewel",
        "balita berat badan", "anak susah makan",
        "anak belum bisa bicara", "anak belum bicara",
        "belum bisa bicara", "belum lancar bicara",
        "anak lambat bicara", "telat bicara",
        "anak belum jalan", "anak belum bisa jalan",
        "tumbuh kembang", "perkembangan anak",
        "anak kurus", "bayi kurus", "balita kurus",
        "bb anak tidak naik", "berat badan anak turun",
        "anak rewel", "anak tidak berkembang",
        "perkembangan terlambat", "anak autis",
        "anak hiperaktif", "anak sulit fokus",
        "motorik anak lambat", "bicara tidak jelas",
    ],
    "Imunisasi": [
        "imunisasi", "vaksin", "vaksinasi", "imun anak",
        "jadwal imunisasi", "booster vaksin", "efek samping vaksin",
        "imunisasi lengkap", "vaksin bayi", "suntik vaksin",
        "vaksin anak", "imunisasi bayi", "vaksinasi anak",
    ],
}

# Hapus tumpang tindih dengan menyatukan ke RULES. 
# Jika ada konteks khusus seperti "anak", kita distribusikan bobotnya secara eksplisit.
CONTEXT_BOOSTERS = {
    "anak":   {"Tumbuh Kembang Anak": 2, "Imunisasi": 1},
    "bayi":   {"Tumbuh Kembang Anak": 2, "Imunisasi": 2},
    "balita": {"Tumbuh Kembang Anak": 2, "Imunisasi": 1},
}

SLANG_MAP = {
    'bgt': 'sangat', 'lemes': 'lemas', 'puyeng': 'pusing',
    'gak': 'tidak', 'ga': 'tidak', 'blm': 'belum', 'blom': 'belum', 'belom': 'belum',
    'sm': 'sama', 'hri': 'hari', 'udah': 'sudah', 'sdh': 'sudah',
    'dah': 'sudah', 'bnyk': 'banyak', 'gatel': 'gatal', 'bb': 'berat badan',
    'byi': 'bayi', 'dok': ''
}

ALPHA_PRIOR = 0.3

# ════════════════════════════════════════════════════════════════════
#  PREPROCESSING
# ════════════════════════════════════════════════════════════════════
def preprocess(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    
    # Normalize slang
    words = text.split()
    normalized = [SLANG_MAP.get(w, w) for w in words]
    text = " ".join(normalized)
    
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# ════════════════════════════════════════════════════════════════════
#  LAPIS 1 — GET RULE SCORES
# ════════════════════════════════════════════════════════════════════
def get_rule_scores(text: str):
    clean = preprocess(text)
    scores = {}

    for trigger, boosts in CONTEXT_BOOSTERS.items():
        if re.search(rf'\b{trigger}\b', clean):
            for kat, bonus in boosts.items():
                scores[kat] = scores.get(kat, 0) + bonus

    for kategori, keywords in RULES.items():
        hit = sum(1 for kw in keywords if kw in clean)
        if hit > 0:
            scores[kategori] = scores.get(kategori, 0) + hit

    return scores

# ════════════════════════════════════════════════════════════════════
#  MODEL LOADING
# ════════════════════════════════════════════════════════════════════
_unified_model = None

def _load_models():
    """Load model_unified.pkl (saat dipanggil manual atau via lifespan)"""
    global _unified_model
    base = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base, "model_unified.pkl")
    if os.path.exists(model_path):
        with open(model_path, "rb") as f:
            _unified_model = pickle.load(f)
            
def load_models_sync():
    """Fungsi public untuk dipanggil di app.py lifespan"""
    _load_models()

# ════════════════════════════════════════════════════════════════════
#  MAIN CLASSIFIER (Gabungan ML + Rule Prior Booster)
# ════════════════════════════════════════════════════════════════════
def classify(text: str, gender: str = None) -> dict:
    global _unified_model
    if _unified_model is None:
        _load_models()
        
    clean = preprocess(text)
    
    # 1. Hitung rule-based scores
    rule_scores = get_rule_scores(text)
    
    if _unified_model is None:
        # Fallback jika model gagal diload
        if not rule_scores:
            return {"kategori": "Tidak Dikenali", "confidence": 0.0, "metode": "fallback", "gender": gender}
        best = max(rule_scores, key=rule_scores.get)
        return {"kategori": best, "confidence": 0.8, "metode": "rule-only-fallback", "gender": gender}

    # 2. Inject gender token konsisten
    if gender == "female":
        clean += " __gender_female__"
    elif gender == "male":
        clean += " __gender_male__"
    else:
        clean += " __gender_unknown__"

    # 3. Prediksi ML
    try:
        ml_proba = _unified_model.predict_proba([clean])[0].copy()
        classes = list(_unified_model.classes_)
        
        # 4. Terapkan Prior Booster
        # combine = ml_proba + alpha * rule_vector
        combined_proba = ml_proba.copy()
        for idx, cls_name in enumerate(classes):
            if cls_name in rule_scores:
                combined_proba[idx] += ALPHA_PRIOR * rule_scores[cls_name]
                
        # Normalisasi softmax sederhana atau ambil max langsung
        best_idx = combined_proba.argmax()
        best_cat = classes[best_idx]
        
        # Estimasi confidence yang wajar
        # Karena kita menambah skor, confidence asli (ml_proba) bisa jadi representasi terbaik
        # Atau bisa menggunakan probabilitas baru setelah dinormalisasi
        final_conf = combined_proba[best_idx] / combined_proba.sum()
        
        if final_conf < 0.35 and max(rule_scores.values() or [0]) == 0:
            return {
                "kategori": "Tidak Dikenali",
                "confidence": round(float(final_conf), 4),
                "metode": "ml-low-confidence",
                "gender": gender,
                "pesan": "Keluhan tidak dikenali sistem."
            }
            
        return {
            "kategori": best_cat,
            "confidence": round(float(final_conf), 4),
            "metode": "unified-prior-booster",
            "gender": gender,
        }
        
    except Exception as e:
        return {"kategori": "Error", "confidence": 0.0, "metode": "error", "pesan": str(e), "gender": gender}