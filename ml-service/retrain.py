import os
import csv
from pymongo import MongoClient
import pandas as pd
from datetime import datetime
from train import train

MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://klinik_app:s4tO2sYw8i1o8G1n@cluster0.abcde.mongodb.net/klinik_db")

def run_active_learning():
    print("═" * 58)
    print("  MEMULAI PROSES ACTIVE LEARNING (RETRAIN)")
    print("═" * 58)
    
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client.get_database()
        collection = db.prediction_logs
    except Exception as e:
        print(f"❌ Gagal koneksi ke MongoDB: {e}")
        return

    # Ambil data yang belum diproses
    logs = list(collection.find({"is_trained": {"$ne": True}}))
    
    if not logs:
        print("✅ Tidak ada data koreksi baru. Retrain dibatalkan.")
        return
        
    print(f"📥 Mengambil {len(logs)} data koreksi dokter baru dari database...")
    
    # Format ke list of dict sesuai dataset.csv (text, label)
    new_data = []
    log_ids = []
    for log in logs:
        if log.get("keluhan") and log.get("koreksi_dokter"):
            new_data.append({
                "text": log["keluhan"].strip(),
                "label": log["koreksi_dokter"].strip()
            })
            log_ids.append(log["_id"])
            
    if not new_data:
        print("❌ Data koreksi tidak valid.")
        return
        
    # Tulis ke temp csv
    temp_csv = "dataset_koreksi.csv"
    df_new = pd.DataFrame(new_data)
    df_new.to_csv(temp_csv, index=False)
    
    print(f"📝 Menyimpan data koreksi sementara ke {temp_csv}")
    
    # Jalankan proses latih ulang gabungan
    print("🚀 Melatih ulang model dengan dataset asli + dataset koreksi...")
    try:
        train(["dataset.csv", temp_csv])
    except Exception as e:
        print(f"❌ Pelatihan gagal: {e}")
        return
    
    # Tandai sebagai is_trained
    print("🔄 Menandai data di database sebagai telah dilatih...")
    collection.update_many(
        {"_id": {"$in": log_ids}},
        {"$set": {"is_trained": True, "trained_at": datetime.utcnow()}}
    )
    
    # Bersihkan file temp
    if os.path.exists(temp_csv):
        os.remove(temp_csv)
        
    print("✅ PROSES ACTIVE LEARNING SELESAI!")

if __name__ == "__main__":
    run_active_learning()
