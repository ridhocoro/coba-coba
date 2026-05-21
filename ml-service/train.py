"""
train.py — Latih SVM + Naive Bayes sekaligus
Hasil: model_svm.pkl (utama) + model_nb.pkl (fallback)
Cara pakai: python train.py
"""
import pickle, os, csv, re
from sklearn.svm import SVC
from sklearn.naive_bayes import MultinomialNB
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from collections import Counter

def preprocess(text):
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()

def load_dataset(path="dataset.csv"):
    texts, labels = [], []
    with open(path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            texts.append(preprocess(row["keluhan"]))
            labels.append(row["kategori"])
    return texts, labels

def train():
    print("📂 Memuat dataset...")
    texts, labels = load_dataset()
    print(f"   Total data: {len(texts)} baris")
    dist = Counter(labels)
    print("\n📋 Distribusi per kategori:")
    for k, v in sorted(dist.items()):
        print(f"   {k:30s}: {v} sampel")

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)
    X = vectorizer.fit_transform(texts)

    min_count = min(dist.values())
    stratify = labels if min_count >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, labels, test_size=0.2, random_state=42, stratify=stratify
    )

    # SVM
    print("\n🤖 Melatih SVM...")
    svm = SVC(kernel='linear', C=1.0, probability=True, random_state=42)
    svm.fit(X_train, y_train)
    print("\n📊 Evaluasi SVM:")
    print(classification_report(y_test, svm.predict(X_test), zero_division=0))
    svm_path = os.path.join(os.path.dirname(__file__), "model_svm.pkl")
    with open(svm_path, "wb") as f:
        pickle.dump({"model": svm, "vectorizer": vectorizer}, f)
    print(f"✅ SVM disimpan: {svm_path}")

    # Naive Bayes
    print("\n🤖 Melatih Naive Bayes...")
    nb = MultinomialNB(alpha=0.5)
    nb.fit(X_train, y_train)
    print("\n📊 Evaluasi Naive Bayes:")
    print(classification_report(y_test, nb.predict(X_test), zero_division=0))
    nb_path = os.path.join(os.path.dirname(__file__), "model_nb.pkl")
    with open(nb_path, "wb") as f:
        pickle.dump({"model": nb, "vectorizer": vectorizer}, f)
    print(f"✅ Naive Bayes disimpan: {nb_path}")

    print("\n🎉 Training selesai!")
    print("   model_svm.pkl → Lapis 2 (utama)")
    print("   model_nb.pkl  → Lapis 3 (fallback)")

if __name__ == "__main__":
    train()
