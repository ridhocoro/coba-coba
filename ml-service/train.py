"""
train.py — Latih Unified Pipeline (Char + Word) dengan Simulasi Pasien Nyata
─────────────────────────────────────────────────────────────────────
Cara pakai:
  python train.py                        → pakai dataset.csv (default)
  python train.py --data dataset_baru.csv
  python train.py --data dataset.csv --data dataset_baru.csv  → gabung

Output:
  model_unified.pkl → Unified Pipeline (TF-IDF Char + Word + SGDClassifier)
─────────────────────────────────────────────────────────────────────
"""

import pickle
import os
import csv
import re
import argparse
import random
from collections import Counter

from sklearn.linear_model import SGDClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report
import numpy as np

# ── Augmentasi Sinonim & Slang ───────────────────────────────────────
AUGMENT_SYNONYMS = {
    "anak":    ["si kecil", "buah hati", "balita", "bocah"],
    "bayi":    ["newborn", "si bayi", "anak bayi"],
    "tidak":   ["gak", "nggak", "ga", "tak", "ndak"],
    "susah":   ["sulit", "kesulitan", "tidak bisa", "payah"],
    "sakit":   ["nyeri", "tidak enak", "terasa sakit", "sakit banget"],
    "belum":   ["tidak", "masih belum", "blom", "belom"],
    "bicara":  ["ngomong", "berbicara", "berkata"],
    "kurus":   ["kering", "langsing sekali", "bb rendah", "kurang berat badan"],
    "demam":   ["panas badan", "badan panas", "suhu tinggi", "febris", "meriang"],
    "mual":    ["ingin muntah", "eneg", "ingin mual", "enek"],
    "gatal":   ["gatal-gatal", "terasa gatal", "rasa gatal", "gatel"],
    "pusing":  ["kepala berputar", "kepala berat", "pening", "puyeng"],
    "sudah":   ["udah", "dah", "sdh"],
    "sangat":  ["banget", "bgt", "sekali"],
}

SLANG_SUFFIXES = [" nih", " dok", " ya", " sih", " dong", " banget"]
SLANG_PREFIXES = ["dok ", "hallo dok ", "tolong ", "gimana ya "]

def inject_typo(text: str) -> str:
    """Mensimulasikan salah ketik (typo) secara acak pada teks."""
    if len(text) < 5 or random.random() > 0.4:
        return text # 60% chance tidak diubah
        
    chars = list(text)
    idx = random.randint(0, len(chars)-2)
    
    # 3 jenis typo: hapus huruf, tukar huruf, atau duplikasi huruf
    typo_type = random.choice(['drop', 'swap', 'double'])
    if typo_type == 'drop' and chars[idx] != ' ':
        chars.pop(idx)
    elif typo_type == 'swap' and chars[idx] != ' ' and chars[idx+1] != ' ':
        chars[idx], chars[idx+1] = chars[idx+1], chars[idx]
    elif typo_type == 'double' and chars[idx] != ' ':
        chars.insert(idx, chars[idx])
        
    return "".join(chars)

def augment_text(text: str, n: int = 2) -> list:
    """Generate n variasi teks dengan sinonim, slang, dan typo."""
    results = []
    words   = text.lower().split()
    for _ in range(n):
        new_words = []
        for w in words:
            if w in AUGMENT_SYNONYMS and random.random() < 0.5:
                new_words.append(random.choice(AUGMENT_SYNONYMS[w]))
            else:
                new_words.append(w)
        
        sentence = " ".join(new_words)
        
        # Tambah slang
        if random.random() < 0.3:
            sentence = random.choice(SLANG_PREFIXES) + sentence
        if random.random() < 0.3:
            sentence = sentence + random.choice(SLANG_SUFFIXES)
            
        # Tambah typo
        sentence = inject_typo(sentence)
        results.append(sentence)
    return results

SLANG_MAP = {
    'bgt': 'sangat', 'lemes': 'lemas', 'puyeng': 'pusing',
    'gak': 'tidak', 'ga': 'tidak', 'blm': 'belum', 'blom': 'belum', 'belom': 'belum',
    'sm': 'sama', 'hri': 'hari', 'udah': 'sudah', 'sdh': 'sudah',
    'dah': 'sudah', 'bnyk': 'banyak', 'gatel': 'gatal', 'bb': 'berat badan',
    'byi': 'bayi', 'dok': ''
}

def preprocess(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    
    # Normalize slang
    words = text.split()
    normalized = [SLANG_MAP.get(w, w) for w in words]
    text = " ".join(normalized)
    
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# ── Load & merge dataset ──────────────────────────────────────────────
def load_dataset(paths: list) -> tuple:
    texts, labels = [], []
    for path in paths:
        if not os.path.exists(path):
            print(f"⚠  File tidak ditemukan: {path} — dilewati")
            continue
        with open(path, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                t = row.get("keluhan", "").strip()
                l = row.get("kategori", "").strip()
                if t and l:
                    texts.append(preprocess(t))
                    labels.append(l)
        print(f"✅ Loaded: {path}")
    return texts, labels

# ── Oversample kelas minoritas + augmentasi ───────────────────────────
FEMALE_CLASSES = ["Kehamilan", "Gangguan Menstruasi", "Kontrasepsi"]

def inject_gender_token(text, label):
    if label in FEMALE_CLASSES:
        token = "__gender_female__"
    else:
        token = random.choice(["__gender_female__", "__gender_male__", "__gender_unknown__"])
    return text + " " + token

def balance_dataset(texts: list, labels: list, target_samples: int = 150) -> tuple:
    """
    Semua kelas di-augmentasi hingga mencapai target_samples (termasuk kelas besar seperti ISPA).
    Ini memastikan SEMUA penyakit mendapat porsi latihan bahasa informal dan typo.
    """
    from collections import defaultdict
    buckets = defaultdict(list)
    for t, l in zip(texts, labels):
        buckets[l].append(t)

    new_texts, new_labels = list(texts), list(labels)

    for label, items in buckets.items():
        if len(items) < target_samples:
            needed = target_samples - len(items)
            augmented = []
            # Augmentasi setiap item beberapa kali untuk mendapatkan variasi slang/typo
            for item in items:
                augmented.extend(augment_text(item, n=max(2, needed // len(items) + 1)))
            
    # Ambil acak sesuai kebutuhan
            extras = random.choices(augmented, k=needed)
            new_texts.extend(extras)
            new_labels.extend([label] * needed)

    # Shuffle and inject gender tokens
    combined = list(zip(new_texts, new_labels))
    random.shuffle(combined)
    
    final_texts = [inject_gender_token(t, l) for t, l in combined]
    final_labels = [l for t, l in combined]
    return final_texts, final_labels

def train(data_paths: list):
    print("\n" + "═" * 58)
    print("  TRAINING ML SERVICE v4.0")
    print("  Unified Pipeline: Char + Word TF-IDF + SGD")
    print("═" * 58)

    # ── Load data ─────────────────────────────────────────────────
    print("\n📂 Memuat dataset...")
    texts, labels = load_dataset(data_paths)
    if not texts:
        print("❌ Tidak ada data ditemukan. Batalkan.")
        return

    print(f"   Total data mentah: {len(texts)} baris")

    # ── Split Dulu ────────────────────────────────────────────────
    dist = Counter(labels)
    min_count = min(dist.values())
    stratify  = labels if min_count >= 2 else None
    
    X_train_raw, X_test_raw, y_train_raw, y_test_raw = train_test_split(
        texts, labels, test_size=0.2, random_state=42, stratify=stratify
    )
    print(f"\n✂️  Train raw: {len(X_train_raw)}  |  Test raw: {len(X_test_raw)}")

    # ── Balance & augmentasi HANYA pada Train Set ────────────────
    print("\n⚖️  Menyeimbangkan train set dan menyuntikkan pasien sintetis...")
    X_train, y_train = balance_dataset(X_train_raw, y_train_raw, target_samples=150)
    print(f"   Total Train setelah balancing: {len(X_train)} baris")
    
    dist_train = Counter(y_train)
    print("\n📋 Distribusi per kategori di Train Set (setelah balancing):")
    for k, v in sorted(dist_train.items()):
        bar = "█" * (v // 5)
        print(f"   {k:30s}: {v:3d}  {bar}")

    # ── Inject token gender pada Test Set (Tanpa augmentasi) ───────
    X_test = [inject_gender_token(t, l) for t, l in zip(X_test_raw, y_test_raw)]
    y_test = y_test_raw

    base = os.path.dirname(os.path.abspath(__file__))

    # ════════════════════════════════════════════════════════════════
    #  UNIFIED PIPELINE
    #  Gabungan Char N-Gram (untuk toleransi Typo) + Word N-gram (Konteks)
    # ════════════════════════════════════════════════════════════════
    print("\n🤖 Melatih Unified Pipeline (TF-IDF Char + Word) ...")

    pipeline = Pipeline([
        ('features', FeatureUnion([
            ('char_tfidf', TfidfVectorizer(
                analyzer     = "char_wb",
                ngram_range  = (2, 5),
                min_df       = 1,
                sublinear_tf = True,
                max_features = 40000,
            )),
            ('word_tfidf', TfidfVectorizer(
                analyzer     = "word",
                ngram_range  = (1, 3),
                min_df       = 1,
                sublinear_tf = True,
                max_features = 20000,
            ))
        ])),
        ("clf", SGDClassifier(
            loss             = "log_loss",
            penalty          = "l2",
            alpha            = 1e-4,
            max_iter         = 250,
            tol              = 1e-4,
            random_state     = 42,
            class_weight     = "balanced", 
            n_jobs           = -1,
        )),
    ])

    pipeline.fit(X_train, y_train)

    preds = pipeline.predict(X_test)
    print("\n📊 Evaluasi Model Unified:")
    print(classification_report(y_test, preds, zero_division=0))

    # Cross-val 5-fold pada data RAW (sebelum augmentasi, tapi dengan gender token)
    cv_texts = [inject_gender_token(t, l) for t, l in zip(texts, labels)]
    cv_scores = cross_val_score(pipeline, cv_texts, labels, cv=5, scoring='f1_macro', n_jobs=-1)
    print(f"   Cross-val F1 (5-fold raw data): {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

    model_path = os.path.join(base, "model_unified.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(pipeline, f)
    print(f"✅ Model disimpan: {model_path}")
    
    # Hapus model lama agar tidak pusing
    for old_file in ["model_char_ngram.pkl", "model_svm.pkl"]:
        old_path = os.path.join(base, old_file)
        if os.path.exists(old_path):
            os.remove(old_path)
            print(f"🗑️  Menghapus model lama: {old_file}")

    # ── Summary ───────────────────────────────────────────────────
    print("\n" + "═" * 58)
    print("🎉 Training selesai!")
    print(f"   model_unified.pkl → Pipeline Tunggal (~80-150MB RAM)")
    print("═" * 58)

    # ── Quick sanity test ─────────────────────────────────────────
    print("\n🧪 Sanity test kasus dengan typo dan slang:")
    test_cases = [
        ("anak kurus bgt",                     "Tumbuh Kembang Anak / Malnutrisi"),
        ("anak blom bisa ngomong dok",         "Tumbuh Kembang Anak"),
        ("byi ga naik bb nya",                 "Tumbuh Kembang Anak"),
        ("batuk sm pilek udah 3 hri",          "ISPA"),
        ("kepala puyeng mual",                 "Hipertensi / Kehamilan / ISPA"),
        ("gigi lobang sakitttt bgt",           "Gangguan Gigi & Mulut / Karies Gigi"),
        ("telat mens mual mual pagi hari",     "Kehamilan"),
        ("badan gatel gatel bentol",           "Penyakit Kulit"),
    ]
    # Reload classifier setelah model baru tersimpan
    import importlib, classifier as clf_module
    importlib.reload(clf_module)
    from classifier import classify
    for keluhan, expected in test_cases:
        result = classify(keluhan)
        got    = result["kategori"]
        icon   = "✅" if any(e.strip() in got or got in e for e in expected.split("/")) else "❌"
        print(f"  {icon} '{keluhan}'")
        print(f"       → {result['kategori']} ({result['confidence']:.2f}) via {result['metode']}{chr(32) + result.get('pesan','') if result.get('pesan') else ''}")
        print(f"       expected: {expected}")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train ML Service v4.0")
    parser.add_argument(
        "--data", action="append", default=None,
        help="Path ke file CSV dataset. Bisa diulang untuk merge beberapa file."
    )
    args = parser.parse_args()

    paths = args.data if args.data else ["dataset.csv"]
    train(paths)