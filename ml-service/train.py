"""
train.py
─────────────────────────────────────────────
Jalankan sekali untuk melatih model Naive Bayes
dan menyimpannya ke model.pkl

Cara pakai:
  python train.py
"""

import pickle
import os
import csv
from sklearn.naive_bayes import MultinomialNB
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import re

def preprocess(text):
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def load_dataset(path="dataset.csv"):
    texts, labels = [], []
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            texts.append(preprocess(row["keluhan"]))
            labels.append(row["kategori"])
    return texts, labels

def train():
    print("📂 Memuat dataset...")
    texts, labels = load_dataset()
    print(f"   Total data: {len(texts)} baris")

    # TF-IDF vectorizer dengan n-gram 1-2
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=1,
        sublinear_tf=True,
    )
    X = vectorizer.fit_transform(texts)

    # Split train/test
    X_train, X_test, y_train, y_test = train_test_split(
        X, labels, test_size=0.2, random_state=42, stratify=labels
    )

    # Training Naive Bayes
    print("\n🤖 Melatih model Naive Bayes...")
    model = MultinomialNB(alpha=0.5)
    model.fit(X_train, y_train)

    # Evaluasi
    print("\n📊 Evaluasi Model:")
    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred))

    # Simpan model
    bundle = {"model": model, "vectorizer": vectorizer}
    model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(bundle, f)
    print(f"\n✅ Model disimpan ke: {model_path}")

if __name__ == "__main__":
    train()