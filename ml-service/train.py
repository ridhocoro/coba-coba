"""
train.py — Latih FastText (Lapis 2) + SVM + TF-IDF (Lapis 3)
─────────────────────────────────────────────────────────────────────
Cara pakai:
  python train.py                        → pakai dataset.csv (default)
  python train.py --data dataset_baru.csv
  python train.py --data dataset.csv --data dataset_baru.csv  → gabung

Output:
  model_char_ngram.pkl → Lapis 2 (Char N-gram + SGD, mensimulasi FastText)
  model_svm.pkl        → Lapis 3 (SVM + TF-IDF)
─────────────────────────────────────────────────────────────────────
Catatan teknis Lapis 2:
  Menggunakan SGDClassifier + TF-IDF char_wb n-gram (2,5) yang mensimulasi
  kemampuan FastText (subkata, typo-toleran, ringan di CPU ~100MB).
  Bukan library fasttext asli — dipilih karena fasttext asli membutuhkan
  ~300-500MB RAM dan compile C++, tidak cocok untuk Railway free (512MB).
  Akurasi setara untuk teks pendek 3-10 kata bahasa Indonesia.
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
from sklearn.svm import SVC
from sklearn.feature_extraction.text import TfidfVectorizer, HashingVectorizer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report
from sklearn.utils import resample
import numpy as np

# ── Augmentasi sinonim sederhana ─────────────────────────────────────
AUGMENT_SYNONYMS = {
    "anak":    ["si kecil", "buah hati", "balita", "bocah"],
    "bayi":    ["newborn", "si bayi", "anak bayi"],
    "tidak":   ["gak", "nggak", "ga", "tak"],
    "susah":   ["sulit", "kesulitan", "tidak bisa"],
    "sakit":   ["nyeri", "tidak enak", "terasa sakit"],
    "belum":   ["tidak", "masih belum"],
    "bicara":  ["ngomong", "berbicara", "berkata"],
    "kurus":   ["kering", "langsing sekali", "bb rendah", "kurang berat badan"],
    "demam":   ["panas badan", "badan panas", "suhu tinggi", "febris"],
    "mual":    ["ingin muntah", "eneg", "ingin mual"],
    "gatal":   ["gatal-gatal", "terasa gatal", "rasa gatal"],
    "pusing":  ["kepala berputar", "kepala berat", "pening"],
}

def augment_text(text: str, n: int = 2) -> list:
    """Generate n variasi teks dengan penggantian sinonim secara random."""
    results = []
    words   = text.lower().split()
    for _ in range(n):
        new_words = []
        for w in words:
            if w in AUGMENT_SYNONYMS and random.random() < 0.4:
                new_words.append(random.choice(AUGMENT_SYNONYMS[w]))
            else:
                new_words.append(w)
        results.append(" ".join(new_words))
    return results

def preprocess(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
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
def balance_dataset(texts: list, labels: list, min_samples: int = 25) -> tuple:
    """
    Pastikan setiap kategori punya minimal min_samples sampel.
    Kelas yang kurang → oversample + augmentasi sinonim.
    """
    from collections import defaultdict
    buckets = defaultdict(list)
    for t, l in zip(texts, labels):
        buckets[l].append(t)

    new_texts, new_labels = list(texts), list(labels)

    for label, items in buckets.items():
        if len(items) < min_samples:
            needed = min_samples - len(items)
            # Augmentasi dulu
            augmented = []
            for item in items:
                augmented.extend(augment_text(item, n=3))
            # Ambil secukupnya
            extras = random.choices(augmented, k=needed)
            new_texts.extend(extras)
            new_labels.extend([label] * needed)

    return new_texts, new_labels

def train(data_paths: list):
    print("\n" + "═" * 58)
    print("  TRAINING ML SERVICE v3.0")
    print("  Layer 2: FastText-style  |  Layer 3: SVM + TF-IDF")
    print("═" * 58)

    # ── Load data ─────────────────────────────────────────────────
    print("\n📂 Memuat dataset...")
    texts, labels = load_dataset(data_paths)
    if not texts:
        print("❌ Tidak ada data ditemukan. Batalkan.")
        return

    print(f"   Total data mentah: {len(texts)} baris")

    # ── Balance & augmentasi ──────────────────────────────────────
    print("\n⚖️  Menyeimbangkan dataset...")
    texts, labels = balance_dataset(texts, labels, min_samples=30)
    print(f"   Total setelah balancing: {len(texts)} baris")

    dist = Counter(labels)
    print("\n📋 Distribusi per kategori (setelah balancing):")
    for k, v in sorted(dist.items()):
        bar = "█" * (v // 2)
        print(f"   {k:30s}: {v:3d}  {bar}")

    # ── Split ─────────────────────────────────────────────────────
    min_count = min(dist.values())
    stratify  = labels if min_count >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.2, random_state=42, stratify=stratify
    )
    print(f"\n✂️  Train: {len(X_train)}  |  Test: {len(X_test)}")

    base = os.path.dirname(os.path.abspath(__file__))

    # ════════════════════════════════════════════════════════════════
    #  LAPIS 2 — FastText-style (SGD + HashingVectorizer + char n-gram)
    #  Mensimulasikan FastText:
    #    - char n-gram (2,5) → paham subkata, typo, imbuhan
    #    - word n-gram (1,2) → konteks frasa
    #    - SGDClassifier     → cepat, ringan, cocok untuk teks
    # ════════════════════════════════════════════════════════════════
    print("\n🤖 Melatih Char N-gram + SGD (Lapis 2, mensimulasi FastText)...")

    char_ngram_pipeline = Pipeline([
        # Gabungan char n-gram + word n-gram melalui TF-IDF
        ("tfidf", TfidfVectorizer(
            analyzer     = "char_wb",  # char n-gram dengan word boundary
            ngram_range  = (2, 5),     # subkata 2–5 karakter
            min_df       = 1,
            sublinear_tf = True,
            max_features = 80000,
        )),
        ("clf", SGDClassifier(
            loss             = "modified_huber",  # wajib untuk predict_proba
            penalty          = "l2",
            alpha            = 1e-4,
            max_iter         = 200,
            tol              = 1e-4,
            random_state     = 42,
            class_weight     = "balanced",        # handle imbalance otomatis
            n_jobs           = -1,
        )),
    ])

    char_ngram_pipeline.fit(X_train, y_train)

    char_ngram_preds = char_ngram_pipeline.predict(X_test)
    print("\n📊 Evaluasi Char N-gram + SGD:")
    print(classification_report(y_test, char_ngram_preds, zero_division=0))

    # Cross-val 5-fold
    cv_scores = cross_val_score(char_ngram_pipeline, texts, labels, cv=5, scoring='f1_macro', n_jobs=-1)
    print(f"   Cross-val F1 (5-fold): {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

    char_ngram_path = os.path.join(base, "model_char_ngram.pkl")
    with open(char_ngram_path, "wb") as f:
        pickle.dump(char_ngram_pipeline, f)
    print(f"✅ Char N-gram disimpan: {char_ngram_path}")

    # ════════════════════════════════════════════════════════════════
    #  LAPIS 3 — SVM + TF-IDF (word n-gram, fallback)
    # ════════════════════════════════════════════════════════════════
    print("\n🤖 Melatih SVM + TF-IDF (Lapis 3)...")

    vectorizer = TfidfVectorizer(
        ngram_range  = (1, 2),
        min_df       = 1,
        sublinear_tf = True,
        max_features = 50000,
    )
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec  = vectorizer.transform(X_test)

    svm = SVC(
        kernel       = "linear",
        C            = 1.0,
        probability  = True,
        random_state = 42,
        class_weight = "balanced",
    )
    svm.fit(X_train_vec, y_train)

    svm_preds = svm.predict(X_test_vec)
    print("\n📊 Evaluasi SVM:")
    print(classification_report(y_test, svm_preds, zero_division=0))

    svm_path = os.path.join(base, "model_svm.pkl")
    with open(svm_path, "wb") as f:
        pickle.dump({"model": svm, "vectorizer": vectorizer}, f)
    print(f"✅ SVM disimpan: {svm_path}")

    # ── Summary ───────────────────────────────────────────────────
    print("\n" + "═" * 58)
    print("🎉 Training selesai!")
    print(f"   model_char_ngram.pkl → Lapis 2 (Char N-gram + SGD, ~100MB RAM)")
    print(f"   model_svm.pkl      → Lapis 3 (SVM + TF-IDF, fallback)")
    print("═" * 58)

    # ── Quick sanity test ─────────────────────────────────────────
    print("\n🧪 Sanity test kasus yang sebelumnya salah:")
    test_cases = [
        ("anak kurus",                     "Tumbuh Kembang Anak / Malnutrisi"),
        ("anak belum bisa bicara",         "Tumbuh Kembang Anak"),
        ("anak terlambat bicara",          "Tumbuh Kembang Anak"),
        ("bayi tidak naik berat badan",    "Tumbuh Kembang Anak"),
        ("batuk dan pilek sudah 3 hari",   "ISPA"),
        ("tekanan darah tinggi",           "Hipertensi"),
        ("gigi berlubang dan sakit",       "Karies Gigi"),
        ("hamil 8 minggu mual pagi hari",  "Kehamilan"),
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
    parser = argparse.ArgumentParser(description="Train ML Service v3.0")
    parser.add_argument(
        "--data", action="append", default=None,
        help="Path ke file CSV dataset. Bisa diulang untuk merge beberapa file."
    )
    args = parser.parse_args()

    paths = args.data if args.data else ["dataset.csv"]
    train(paths)