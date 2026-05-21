"""
classifier.py
─────────────────────────────────────────────
Sistem klasifikasi keluhan pasien tiga lapis:
  Lapis 1 → Rule-Based (keyword matching)
  Lapis 2 → SVM + TF-IDF (utama)
  Lapis 3 → Naive Bayes (fallback)

Gender digunakan sebagai fitur tambahan untuk
meningkatkan akurasi klasifikasi.
"""

import re
import pickle
import os

# ─── Keyword rules per kategori ──────────────────────────────
RULES = {
    # Poli Umum
    "ISPA": [
        "batuk", "pilek", "demam", "flu", "influenza",
        "hidung tersumbat", "hidung meler", "bersin", "radang tenggorokan",
        "tenggorokan sakit", "suara serak", "badan panas", "panas dingin",
        "kepala pusing", "badan lemas demam", "meriang", "badan meriang",
        "tenggorokan gatal", "suara hilang", "batuk berdahak", "batuk kering",
    ],
    "Hipertensi": [
        "tekanan darah tinggi", "darah tinggi", "hipertensi", "tensi tinggi",
        "tensi", "tekanan darah", "kepala berat", "leher kaku",
        "kepala bagian belakang sakit", "telinga berdengung", "wajah panas memerah",
        "pandangan berkunang", "leher tegang",
    ],
    "Diabetes": [
        "gula darah", "diabetes", "sering buang air kecil", "sering haus",
        "luka susah sembuh", "berat badan turun", "sering lapar", "kesemutan di kaki",
        "mulut kering", "sering kencing malam", "gula darah fluktuatif",
    ],
    "Gangguan Pencernaan": [
        "mual", "muntah", "diare", "sakit perut", "perut kembung",
        "perut mulas", "maag", "ulu hati", "sembelit", "tidak bisa bab",
        "buang air besar", "bab berdarah", "tidak nafsu makan",
        "asam lambung", "perut melilit", "perut terasa penuh", "sendawa berbau",
        "lambung perih",
    ],
    "Penyakit Kulit": [
        "kulit gatal", "gatal gatal", "ruam", "bintik merah", "eksim",
        "alergi kulit", "kulit kering", "kulit mengelupas", "jerawat", "bentol",
        "kulit bersisik", "biduran", "bercak putih", "kulit kepala gatal",
        "kulit terbakar", "kulit memerah",
    ],
    "Gangguan Jantung": [
        "nyeri dada", "jantung berdebar", "dada tertekan", "detak jantung",
        "dada sakit", "jantung berdegup", "nyeri dada menjalar",
        "dada berdebar", "keringat dingin tiba tiba",
    ],
    "Gangguan Paru": [
        "sesak napas", "sesak nafas", "asma", "batuk kronis", "nafas berbunyi",
        "mengi", "batuk darah", "napas pendek", "napas berbunyi ngik",
        "sulit bernapas", "dada terasa penuh",
    ],
    "Gangguan Saraf": [
        "kesemutan", "migrain", "kepala berdenyut", "wajah kaku", "tangan gemetar",
        "kaki kebas", "vertigo", "kepala berputar", "kebas",
        "kaki seperti ditusuk jarum", "migrain sebelah",
    ],
    "Gangguan Mata": [
        "mata merah", "mata gatal", "penglihatan kabur", "mata berair",
        "mata silau", "mata bengkak", "mata mengganjal", "mata perih",
        "penglihatan dobel", "mata kering", "kotoran kuning mata",
        "kelopak mata bengkak",
    ],
    "Gangguan Ginjal": [
        "nyeri pinggang", "urin keruh", "kaki bengkak", "sakit buang air kecil",
        "pinggang sakit", "urin berbau", "buang air kecil nyeri",
        "urin merah", "urin berbusa", "batu ginjal",
    ],
    "Gangguan Mental": [
        "cemas", "sulit tidur", "tidak bisa tidur", "susah tidur", "stres",
        "depresi", "sedih", "serangan panik", "mudah marah", "tidak bersemangat",
        "sulit konsentrasi", "overthinking", "mood turun", "hampa", "putus asa",
        "tidak punya motivasi",
    ],
    # Poli Gigi
    "Karies Gigi": [
        "sakit gigi", "gigi berlubang", "gigi bolong", "gigi ngilu",
        "nyeri gigi", "gigi hitam", "gigi geraham sakit",
        "gigi sakit saat minum", "gigi sakit saat makan",
        "bau mulut gigi berlubang", "gigi nyut nyutan",
    ],
    "Sakit Gusi": [
        "gusi bengkak", "gusi berdarah", "gusi merah", "gusi sakit",
        "gusi nyeri", "gusi lunak", "gusi sensitif", "gusi perih", "gusi kemerahan",
    ],
    "Abses Gigi": [
        "abses gigi", "benjolan di gusi", "gusi bernanah", "nanah gigi",
        "gigi berdenyut nyeri", "pipi bengkak gigi", "infeksi gigi",
        "rahang bengkak", "rahang membengkak",
    ],
    "Gigi Sensitif": [
        "gigi sensitif saat dingin", "ngilu gigi panas dingin",
        "gigi ngilu tiba tiba", "saraf gigi sensitif", "gigi ngilu sikat gigi",
    ],
    "Gigi Bungsu": [
        "gigi bungsu", "gigi geraham belakang tumbuh", "gigi bungsu tumbuh",
        "gigi bungsu miring", "rahang belakang sakit gigi baru", "gigi bungsu bengkak",
    ],
    # Poli Gizi
    "Malnutrisi": [
        "berat badan kurang", "tubuh kurus", "kekurangan gizi",
        "badan kurus drastis", "makan sedikit tidak bertenaga",
        "kurang makan lemas", "anak susah makan berat badan",
        "gizi kurang", "rambut rontok gizi", "kuku rapuh gizi",
    ],
    "Obesitas": [
        "berat badan berlebih", "gemuk", "kelebihan berat badan",
        "obesitas", "badan berat aktivitas", "perut buncit",
        "program penurunan berat badan", "diet konsultasi", "badan gemuk kolesterol",
    ],
    "Anemia": [
        "kurang darah", "anemia", "hemoglobin rendah", "muka pucat",
        "lemas kurang darah", "mata berkunang anemia",
        "pingsan lemas anemia", "darah rendah pusing", "kuku pucat anemia",
    ],
    "Gangguan Makan": [
        "tidak nafsu makan", "susah makan", "mual melihat makanan",
        "makan berlebihan bersalah", "takut gemuk tidak mau makan",
        "pola makan tidak teratur", "porsi makan tidak terkontrol",
    ],
    "Defisiensi Vitamin": [
        "kurang vitamin", "kekurangan vitamin", "kurang kalsium",
        "kurang vitamin d", "kram otot magnesium", "kulit kusam vitamin b",
        "kekurangan zat besi", "imun lemah vitamin", "sariawan kurang vitamin c",
    ],
    # Poli KIA
    "Kehamilan": [
        "hamil", "morning sickness", "mual pagi hamil",
        "kontrol kehamilan", "trimester", "janin", "kehamilan",
        "telat haid mual", "bercak darah hamil", "kaki bengkak hamil",
        "tekanan darah hamil",
    ],
    "Gangguan Menstruasi": [
        "haid tidak teratur", "nyeri haid", "haid tidak lancar",
        "darah haid banyak", "haid telat", "kram haid",
        "menstruasi sedikit", "haid tidak berhenti", "siklus haid tidak teratur",
    ],
    "Kontrasepsi": [
        "kb", "kontrasepsi", "iud", "pil kb", "suntik kb",
        "implan kb", "metode kontrasepsi", "berhenti kb", "efek samping kb",
    ],
    "Tumbuh Kembang Anak": [
        "anak tidak mau makan", "anak terlambat bicara",
        "pertumbuhan anak lambat", "anak sering sakit",
        "bayi tidak naik berat badan", "anak demam rewel",
        "balita berat badan", "anak susah makan",
    ],
    "Imunisasi": [
        "imunisasi", "vaksin", "vaksinasi", "imun anak",
        "jadwal imunisasi", "booster vaksin", "efek samping vaksin",
        "imunisasi lengkap", "vaksin bayi",
    ],
}

# Gender bias: kategori yang lebih relevan per gender
GENDER_BIAS = {
    "female": {
        "Kehamilan":            3,
        "Gangguan Menstruasi":  3,
        "Kontrasepsi":          3,
        "Anemia":               1,
    },
    "male": {},
}

CONFIDENCE_RULE = 0.92
SVM_CONFIDENCE_THRESHOLD = 0.55

# ─── Preprocessing ───────────────────────────────────────────
def preprocess(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# ─── Lapis 1: Rule-Based ─────────────────────────────────────
def rule_based_classify(text: str, gender: str = None):
    clean = preprocess(text)
    scores = {}
    for kategori, keywords in RULES.items():
        hit = sum(1 for kw in keywords if kw in clean)
        if hit > 0:
            scores[kategori] = hit
    if not scores:
        return None, 0.0
    if gender and gender.lower() in GENDER_BIAS:
        for kat, bonus in GENDER_BIAS[gender.lower()].items():
            if kat in scores:
                scores[kat] += bonus
    best = max(scores, key=scores.get)
    top_score = scores[best]
    tied = [k for k, v in scores.items() if v == top_score]
    if len(tied) > 1 and "Gangguan Pencernaan" in tied:
        tied.remove("Gangguan Pencernaan")
        best = tied[0]
    return best, CONFIDENCE_RULE

# ─── Load models ─────────────────────────────────────────────
_svm_model = None
_svm_vectorizer = None
_nb_model = None
_nb_vectorizer = None

def _load_models():
    global _svm_model, _svm_vectorizer, _nb_model, _nb_vectorizer
    base = os.path.dirname(__file__)
    svm_path = os.path.join(base, "model_svm.pkl")
    if os.path.exists(svm_path):
        with open(svm_path, "rb") as f:
            b = pickle.load(f)
            _svm_model, _svm_vectorizer = b["model"], b["vectorizer"]
    nb_path = os.path.join(base, "model_nb.pkl")
    if os.path.exists(nb_path):
        with open(nb_path, "rb") as f:
            b = pickle.load(f)
            _nb_model, _nb_vectorizer = b["model"], b["vectorizer"]

# ─── Lapis 2: SVM ────────────────────────────────────────────
def svm_classify(text: str, gender: str = None):
    global _svm_model, _svm_vectorizer
    if _svm_model is None:
        _load_models()
    if _svm_model is None:
        return None, 0.0
    clean = preprocess(text)
    X = _svm_vectorizer.transform([clean])
    proba = _svm_model.predict_proba(X)[0].copy()
    if gender and gender.lower() in GENDER_BIAS:
        classes = list(_svm_model.classes_)
        for kat, bonus in GENDER_BIAS[gender.lower()].items():
            if kat in classes:
                proba[classes.index(kat)] = min(1.0, proba[classes.index(kat)] + bonus * 0.05)
    idx = proba.argmax()
    return _svm_model.classes_[idx], round(float(proba[idx]), 4)

# ─── Lapis 3: Naive Bayes ────────────────────────────────────
def nb_classify(text: str, gender: str = None):
    global _nb_model, _nb_vectorizer
    if _nb_model is None:
        _load_models()
    if _nb_model is None:
        return "Lainnya", 0.5
    clean = preprocess(text)
    X = _nb_vectorizer.transform([clean])
    proba = _nb_model.predict_proba(X)[0].copy()
    if gender and gender.lower() in GENDER_BIAS:
        classes = list(_nb_model.classes_)
        for kat, bonus in GENDER_BIAS[gender.lower()].items():
            if kat in classes:
                proba[classes.index(kat)] = min(1.0, proba[classes.index(kat)] + bonus * 0.05)
    idx = proba.argmax()
    return _nb_model.classes_[idx], round(float(proba[idx]), 4)

# ─── Main classifier ─────────────────────────────────────────
def classify(text: str, gender: str = None) -> dict:
    """
    Klasifikasi 3 lapis: Rule-Based → SVM → Naive Bayes
    gender: 'male' | 'female' | None (dari profil user)
    """
    # Lapis 1
    kategori, conf = rule_based_classify(text, gender)
    if kategori:
        return {"kategori": kategori, "confidence": conf, "metode": "rule-based", "gender": gender}
    # Lapis 2
    kategori, conf = svm_classify(text, gender)
    if kategori and conf >= SVM_CONFIDENCE_THRESHOLD:
        return {"kategori": kategori, "confidence": conf, "metode": "svm", "gender": gender}
    # Lapis 3
    kategori, conf = nb_classify(text, gender)
    return {"kategori": kategori, "confidence": conf, "metode": "naive-bayes", "gender": gender}
