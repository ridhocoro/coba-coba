const express = require('express');
const router = express.Router();

// BMI Calculator - FIXED!
router.post('/calculate-bmi', (req, res) => {
    try {
        const { weight, height, unit } = req.body;
        
        // Parse ke number
        let weightKg = parseFloat(weight);
        let heightM = parseFloat(height);
        
        console.log('BMI Request:', { weight, height, unit }); // Debug
        
        // Konversi ke meter dan kg
        if (unit === 'imperial') {
            heightM = height * 0.3048;      // feet to meters
            weightKg = weight * 0.453592;    // pounds to kg
        } else if (unit === 'cm') {
            // Input dalam CM → konversi ke meter
            heightM = height / 100;
        } else if (unit === 'm') {
            // Input sudah dalam meter
            heightM = height;
        } else {
            // Default: anggap cm
            heightM = height / 100;
        }

        // Validasi
        if (weightKg <= 0 || heightM <= 0) {
            return res.status(400).json({ error: 'Berat dan tinggi harus positif' });
        }

        // Hitung BMI
        const bmi = weightKg / (heightM * heightM);
        
        // Kategori BMI (WHO)
        let category = '';
        let advice = '';
        let color = '';
        
        if (bmi < 18.5) {
            category = 'Underweight';
            advice = 'Anda kekurangan berat badan. Disarankan untuk meningkatkan asupan nutrisi.';
            color = 'warning';
        } else if (bmi >= 18.5 && bmi < 25) {
            category = 'Normal';
            advice = 'Berat badan Anda ideal. Pertahankan pola makan sehat dan olahraga teratur.';
            color = 'success';
        } else if (bmi >= 25 && bmi < 30) {
            category = 'Overweight';
            advice = 'Anda kelebihan berat badan. Disarankan untuk diet seimbang dan olahraga rutin.';
            color = 'warning';
        } else {
            category = 'Obesity';
            advice = 'Anda termasuk kategori obesitas. Konsultasikan dengan dokter untuk program penurunan berat badan.';
            color = 'danger';
        }

        const response = {
            bmi: parseFloat(bmi.toFixed(1)),
            category,
            advice,
            color
        };
        
        console.log('BMI Result:', response); // Debug
        res.json(response);
        
    } catch (error) {
        console.error('BMI Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Daily Calorie Calculator
router.post('/calculate-calories', (req, res) => {
    try {
        const { gender, age, weight, height, activityLevel } = req.body;
        
        // Mifflin-St Jeor Equation
        let bmr;
        if (gender === 'male') {
            bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
        } else {
            bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
        }

        const activityMultipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            active: 1.725,
            veryActive: 1.9
        };

        const dailyCalories = bmr * activityMultipliers[activityLevel];
        
        const recommendations = {
            maintain: Math.round(dailyCalories),
            mildLoss: Math.round(dailyCalories - 250),
            weightLoss: Math.round(dailyCalories - 500),
            mildGain: Math.round(dailyCalories + 250),
            weightGain: Math.round(dailyCalories + 500)
        };

        res.json({ 
            bmr: Math.round(bmr), 
            dailyCalories: Math.round(dailyCalories), 
            recommendations 
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Blood Pressure Checker
router.post('/check-blood-pressure', (req, res) => {
    try {
        const { systolic, diastolic } = req.body;
        
        let category = '';
        let advice = '';
        let color = '';

        // ── Hipotensi (periksa DULUAN sebelum normal) ────────────────────────────
        if (systolic < 90 || diastolic < 60) {
            category = 'Hypotension';
            advice = 'Tekanan darah Anda terlalu rendah (hipotensi). Perbanyak minum air putih, hindari berdiri terlalu cepat, dan konsultasikan dengan dokter jika disertai pusing atau pingsan.';
            color = 'info';
        }
        // ── Krisis Hipertensi (periksa SEBELUM Stage 2 agar tidak tertimpa) ────
        else if (systolic > 180 || diastolic > 120) {
            category = 'Hypertensive Crisis';
            advice = 'DARURAT! Tekanan darah Anda berada di level krisis hipertensi. Segera cari pertolongan medis atau hubungi 119 sekarang.';
            color = 'crisis';
        }
        // ── Normal ────────────────────────────────────────────────────────────
        else if (systolic < 120 && diastolic < 80) {
            category = 'Normal';
            advice = 'Tekanan darah Anda normal. Pertahankan gaya hidup sehat dengan pola makan bergizi dan olahraga teratur.';
            color = 'success';
        }
        // ── Elevated ──────────────────────────────────────────────────────────
        else if (systolic >= 120 && systolic <= 129 && diastolic < 80) {
            category = 'Elevated';
            advice = 'Tekanan darah Anda sedikit meningkat. Perhatikan pola makan, kurangi garam, dan perbanyak olahraga.';
            color = 'warning';
        }
        // ── Hipertensi Stage 1 ────────────────────────────────────────────────
        else if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) {
            category = 'High Blood Pressure (Stage 1)';
            advice = 'Anda memasuki tahap 1 hipertensi. Ubah gaya hidup dan konsultasikan dengan dokter untuk pemantauan rutin.';
            color = 'warning';
        }
        // ── Hipertensi Stage 2 ────────────────────────────────────────────────
        else if (systolic >= 140 || diastolic >= 90) {
            category = 'High Blood Pressure (Stage 2)';
            advice = 'Anda memasuki tahap 2 hipertensi. Segera konsultasi dengan dokter untuk penanganan dan kemungkinan pemberian obat.';
            color = 'danger';
        }

        res.json({ 
            systolic, 
            diastolic, 
            category, 
            advice,
            color 
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Smart Triage / Rekomendasi Poli
router.post('/recommend-poli', async (req, res) => {
    try {
        const { keluhan } = req.body;
        if (!keluhan) {
            return res.status(400).json({ success: false, message: 'Keluhan tidak boleh kosong' });
        }

        const { classifyKeluhan } = require('../utils/mlService');
        const mlResult = await classifyKeluhan(keluhan, null);
        if (!mlResult) {
            return res.status(503).json({ success: false, message: 'Layanan ML sedang tidak tersedia' });
        }

        const { kategori, confidence } = mlResult;

        let recommendedPoli = 'Poli Umum';
        let referralNote = null;
        let icon = '🩺';

        switch (kategori) {
            case 'Karies Gigi':
            case 'Sakit Gusi':
                recommendedPoli = 'Poli Gigi';
                icon = '🦷';
                break;
            case 'Kehamilan':
            case 'Gangguan Menstruasi':
                recommendedPoli = 'Poli KIA';
                icon = '🤱';
                break;
            case 'Anemia':
                recommendedPoli = 'Poli Gizi';
                icon = '🥗';
                break;
            case 'Gangguan Jantung':
                recommendedPoli = 'Poli Umum';
                referralNote = '⚠️ Peringatan: Keluhan yang mengarah ke gangguan jantung/dada akan diperiksa untuk pertolongan pertama di Poli Umum (seperti rekam jantung/EKG), namun kemungkinan besar Anda memerlukan rujukan segera ke Rumah Sakit/Dokter Spesialis.';
                icon = '⚠️';
                break;
            case 'Lainnya':
            case 'Tidak Dikenali':
                recommendedPoli = 'Poli Umum';
                referralNote = '💡 Gejala Anda tidak terlalu spesifik. Dokter di Poli Umum akan melakukan wawancara dan pemeriksaan menyeluruh untuk menentukan diagnosis.';
                icon = '🩺';
                break;
            default:
                recommendedPoli = 'Poli Umum';
                icon = '🩺';
                break;
        }

        res.json({
            success: true,
            kategori,
            confidence,
            recommendedPoli,
            icon,
            referralNote
        });
        
    } catch (error) {
        console.error('Recommend Poli Error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

module.exports = router;