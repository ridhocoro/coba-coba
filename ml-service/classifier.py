"""
classifier.py
─────────────────────────────────────────────────────────────────────
Sistem klasifikasi keluhan pasien TIGA LAPIS (v3.1):
  Lapis 1 → Rule-Based + Context Booster
  Lapis 2 → Char N-gram + SGD  (mensimulasi FastText, ringan ~100MB)
  Lapis 3 → SVM + TF-IDF (fallback terakhir)

Catatan teknis Lapis 2:
  Bukan FastText asli (fasttext library), melainkan SGDClassifier
  dengan TF-IDF char_wb n-gram (2,5) yang mensimulasi kemampuan
  FastText: paham subkata, tidak sensitif typo, ringan di CPU.
  Dipilih karena fasttext asli ~300-500MB RAM (OOM di Railway 0.5GB),
  sedangkan implementasi ini hanya ~100MB.

Perubahan dari v3.0 (revisi DeepSeek):
  - CONFIDENCE_RULE: multi-hit=1.0, single-hit=0.95 (lebih akurat)
  - CHAR_NGRAM_THRESHOLD: 0.60 → 0.70 (lebih aman untuk klinik)
  - SVM fallback: jika conf < SVM_THRESHOLD → "Tidak Dikenali"
  - Rename ft_pipeline → char_ngram_pipeline (jujur secara akademik)
  - Rename _fasttext_model → _char_ngram_model
─────────────────────────────────────────────────────────────────────
"""

import re
import pickle
import os

# ════════════════════════════════════════════════════════════════════
#  LAPIS 1 — RULES (diperluas dengan sinonim & variasi frasa)
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
        # dari Gangguan Paru
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
    # Gangguan Paru tidak ada di dataset v2 — keyword dipindah ke ISPA & Gangguan Jantung
    "Gangguan Saraf": [
        "kesemutan", "migrain", "kepala berdenyut", "wajah kaku", "tangan gemetar",
        "kaki kebas", "vertigo", "kepala berputar", "kebas",
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
    # Gangguan Mental tidak ada di dataset v2 — dihapus dari RULES
    # Jika ingin ditambahkan kembali, tambah data training terlebih dahulu
    # ── Poli Gigi ─────────────────────────────────────────────────
    "Gangguan Gigi & Mulut": [
        # Karies & nyeri gigi
        "sakit gigi", "gigi berlubang", "gigi bolong", "gigi ngilu",
        "nyeri gigi", "gigi hitam", "gigi geraham sakit",
        "gigi sakit saat minum", "gigi sakit saat makan",
        "bau mulut gigi berlubang", "gigi nyut nyutan", "gigi sakit berdenyut",
        # Gusi
        "gusi bengkak", "gusi berdarah", "gusi merah", "gusi sakit",
        "gusi nyeri", "gusi sensitif", "gusi perih", "gusi membengkak",
        # Abses & infeksi
        "abses gigi", "benjolan di gusi", "gusi bernanah", "nanah gigi",
        "pipi bengkak gigi", "infeksi gigi", "rahang bengkak",
        # Gigi sensitif
        "gigi sensitif", "ngilu gigi panas dingin", "saraf gigi sensitif",
        "gigi ngilu minum es", "gigi ngilu kena angin",
        # Gigi bungsu
        "gigi bungsu", "gigi geraham belakang tumbuh",
        "gigi bungsu miring", "gigi paling belakang sakit",
        # Mulut & sariawan
        "sariawan", "luka di mulut", "mulut perih", "bibir pecah pecah",
        "mulut kering gigi", "bau mulut", "napas berbau",
    ],
    # ── Poli Gizi ─────────────────────────────────────────────────
    "Malnutrisi": [
        "berat badan kurang", "tubuh kurus", "kekurangan gizi",
        "badan kurus drastis", "makan sedikit tidak bertenaga",
        "kurang makan lemas", "anak susah makan berat badan",
        "gizi kurang", "rambut rontok gizi", "kuku rapuh gizi",
        # ── TAMBAHAN SINONIM ──
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
    # ── Poli KIA ──────────────────────────────────────────────────
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
        "haid tidak datang", "mens tidak lancar",
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
        # ── TAMBAHAN SINONIM KRITIS ──
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

# ════════════════════════════════════════════════════════════════════
#  CONTEXT BOOSTERS
#  Jika teks mengandung kata trigger → naikkan skor kategori tertentu
#  SEBELUM pengecekan RULES, agar intent anak/bayi/balita diprioritaskan
# ════════════════════════════════════════════════════════════════════
CONTEXT_BOOSTERS = {
    # Kata konteks → {kategori: bonus_score}
    "anak":   {"Tumbuh Kembang Anak": 2, "Imunisasi": 1},
    "bayi":   {"Tumbuh Kembang Anak": 2, "Imunisasi": 2},
    "balita": {"Tumbuh Kembang Anak": 2, "Imunisasi": 1},
    "hamil":  {"Kehamilan": 3},
    "haid":   {"Gangguan Menstruasi": 2},
    "mens":   {"Gangguan Menstruasi": 2},
    "kb":     {"Kontrasepsi": 3},
}

# Gender bias scores
GENDER_BIAS = {
    "female": {
        "Kehamilan":           3,
        "Gangguan Menstruasi": 3,
        "Kontrasepsi":         3,
        "Anemia":              1,
    },
    "male": {},
}

CONFIDENCE_RULE_MULTI   = 1.00   # Rule-Based: >=2 keyword cocok -> sangat yakin
CONFIDENCE_RULE_SINGLE  = 0.95   # Rule-Based: 1 keyword cocok -> hampir pasti
CHAR_NGRAM_THRESHOLD    = 0.70   # Char N-gram: dinaikkan dari 0.60 (lebih aman klinik)
SVM_THRESHOLD           = 0.50   # SVM: di bawah ini -> 'Tidak Dikenali'

# ════════════════════════════════════════════════════════════════════
#  PREPROCESSING
# ════════════════════════════════════════════════════════════════════
def preprocess(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# ════════════════════════════════════════════════════════════════════
#  LAPIS 1 — RULE-BASED + CONTEXT BOOSTER
# ════════════════════════════════════════════════════════════════════
def rule_based_classify(text: str, gender: str = None):
    clean = preprocess(text)
    scores = {}

    # 1a. Context booster terlebih dahulu
    for trigger, boosts in CONTEXT_BOOSTERS.items():
        if re.search(rf'\b{trigger}\b', clean):
            for kat, bonus in boosts.items():
                scores[kat] = scores.get(kat, 0) + bonus

    # 1b. Keyword matching
    for kategori, keywords in RULES.items():
        hit = sum(1 for kw in keywords if kw in clean)
        if hit > 0:
            scores[kategori] = scores.get(kategori, 0) + hit

    if not scores:
        return None, 0.0

    # 1c. Gender bias
    if gender and gender.lower() in GENDER_BIAS:
        for kat, bonus in GENDER_BIAS[gender.lower()].items():
            if kat in scores:
                scores[kat] += bonus

    best = max(scores, key=scores.get)
    top  = scores[best]

    # 1d. Tie-breaking: hindari Gangguan Pencernaan menang karena "mual" saja
    #     jika ada kontestan lain
    tied = [k for k, v in scores.items() if v == top]
    if len(tied) > 1 and "Gangguan Pencernaan" in tied:
        tied.remove("Gangguan Pencernaan")
        best = tied[0]

    # Confidence berbeda tergantung jumlah keyword yang cocok
    raw_hits = scores[best]
    conf = CONFIDENCE_RULE_MULTI if raw_hits >= 2 else CONFIDENCE_RULE_SINGLE
    return best, conf

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
#  LAPIS 2 — UNIFIED ML PIPELINE (Char + Word N-gram)
# ════════════════════════════════════════════════════════════════════
def unified_classify(text: str, gender: str = None):
    global _unified_model
    if _unified_model is None:
        _load_models()
    if _unified_model is None:
        return None, 0.0

    clean = preprocess(text)
    try:
        # Pipeline FeatureUnion mengurus tfidf & SGD langsung
        proba = _unified_model.predict_proba([clean])[0].copy()
        classes = list(_unified_model.classes_)

        # Gender bias
        if gender and gender.lower() in GENDER_BIAS:
            for kat, bonus in GENDER_BIAS[gender.lower()].items():
                if kat in classes:
                    idx = classes.index(kat)
                    proba[idx] = min(1.0, proba[idx] + bonus * 0.05)

        idx = proba.argmax()
        return classes[idx], round(float(proba[idx]), 4)
    except Exception:
        return None, 0.0

# ════════════════════════════════════════════════════════════════════
#  MAIN CLASSIFIER
#  Alur: Rule-Based → Unified ML Pipeline
# ════════════════════════════════════════════════════════════════════
def classify(text: str, gender: str = None) -> dict:
    """
    Klasifikasi keluhan 2 lapis (v4.0):
      Lapis 1 → Rule-Based + Context Booster (keyword eksak + konteks)
      Lapis 2 → Unified Pipeline ML (SGDClassifier dengan Char + Word N-Gram)
      Fallback → "Tidak Dikenali" jika ML ragu
    """
    # ── Lapis 1: Rule-Based ─────────────────────────────────────
    kategori, conf = rule_based_classify(text, gender)
    if kategori:
        return {
            "kategori":   kategori,
            "confidence": conf,
            "metode":     "rule-based",
            "gender":     gender,
        }

    # ── Lapis 2: Unified ML ──────────────────────────────
    kategori, conf = unified_classify(text, gender)
    if kategori and conf >= 0.50: # Threshold lebih rendah sedikit karena gabungan
        return {
            "kategori":   kategori,
            "confidence": conf,
            "metode":     "unified-ml",
            "gender":     gender,
        }

    # ── Fallback: ragu ───────────────────────────────
    return {
        "kategori":   "Tidak Dikenali",
        "confidence": conf,
        "metode":     "ml-low-confidence",
        "gender":     gender,
        "pesan":      "Keluhan tidak dikenali sistem. Silakan konsultasi langsung ke klinik.",
    }