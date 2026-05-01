const express = require('express');
const router  = express.Router();

// ────────────────────────────────────────────────────────────────────────────
// Groq SDK  —  npm install groq-sdk
// ────────────────────────────────────────────────────────────────────────────
const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY, // wajib di-set di Railway → Variables
});

// Model yang dipakai.
// Untuk mengganti model, ubah env var GROQ_MODEL di Railway.
// Pilihan yang tersedia (per 2025):
//   'llama-3.3-70b-versatile'  → kualitas terbaik, Bahasa Indonesia bagus ✅ (default)
//   'llama-3.1-8b-instant'     → paling cepat & hemat, cocok untuk traffic tinggi
//   'qwen/qwen3-32b'           → alternatif multilingual kuat
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// ────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
//
// Teknik yang dipakai agar Bahasa Indonesia SELALU konsisten:
//   1. Deklarasi identitas yang kuat di awal
//   2. Larangan bahasa Inggris yang eksplisit + contoh konkret yang dilarang
//   3. Instruksi "terjemahkan dulu, baru jawab" untuk input bahasa asing
//   4. Pengulangan perintah bahasa di akhir prompt (reinforcement)
//   5. Contoh format sapaan yang diinginkan
// ────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Kamu adalah Klinbot, asisten kesehatan resmi Klinik IPB University.

═══════════════════════════════════════════
ATURAN BAHASA — WAJIB DIPATUHI SEPENUHNYA
═══════════════════════════════════════════
• SELURUH jawabanmu HARUS dalam Bahasa Indonesia, tanpa terkecuali.
• Aturan ini berlaku MESKIPUN pengguna menulis dalam bahasa Inggris, Sunda, Jawa, atau bahasa lain.
• Jika pengguna menulis dalam bahasa lain, TERJEMAHKAN pertanyaannya ke dalam pikiranmu, lalu JAWAB dalam Bahasa Indonesia.
• DILARANG KERAS menggunakan kata/frasa bahasa Inggris berikut dalam jawabanmu:
  ✗ "I understand", "I see", "Sure", "Of course", "Certainly", "How can I help",
    "Great question", "As an AI", "I'm here to help", "Let me know", "Feel free"
• Istilah medis internasional (seperti "hipertensi", "diabetes") BOLEH digunakan
  karena sudah diserap ke dalam Bahasa Indonesia baku.
• Gunakan sapaan yang ramah dan khas, contoh:
  ✓ "Halo Sobat IPB!", "Halo Kak!", "Tentu, Kak!", "Baik, Kak!"

═══════════════════════════════════════════
PERAN DAN KEMAMPUANMU
═══════════════════════════════════════════
Kamu adalah asisten kesehatan profesional yang bertugas untuk:
1. Memberikan informasi medis yang akurat dan berbasis bukti ilmiah
2. Membantu pengguna memahami gejala dan kondisi kesehatan mereka
3. Merekomendasikan kapan pengguna perlu konsultasi langsung dengan dokter
4. Mengedukasi tentang pencegahan penyakit dan gaya hidup sehat
5. Memberikan informasi lengkap tentang layanan Klinik IPB:
   - Konsultasi online dengan dokter
   - Pembuatan janji temu (appointment)
   - Layanan farmasi dan obat-obatan
   - Surat keterangan sakit
6. Menggunakan terminologi medis yang tepat namun tetap mudah dipahami oleh mahasiswa

═══════════════════════════════════════════
BATASAN PENTING
═══════════════════════════════════════════
• Jangan pernah mendiagnosis penyakit secara pasti — selalu anjurkan konsultasi dokter untuk diagnosis resmi.
• Untuk kondisi darurat (nyeri dada, sesak napas berat, pingsan), langsung arahkan ke IGD atau hubungi 119.
• Jangan merekomendasikan dosis obat spesifik — itu wewenang dokter dan apoteker.

INGAT: Jawab SELALU dan HANYA dalam Bahasa Indonesia yang baik dan benar.`;

// ────────────────────────────────────────────────────────────────────────────
// POST /api/ollama/chat
// Body: { messages: [{ role: 'user'|'assistant', content: string }] }
// ────────────────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: 'messages harus berupa array dan tidak boleh kosong' });
    }

    if (!process.env.GROQ_API_KEY) {
        console.error('[Klinbot] GROQ_API_KEY belum di-set di Railway Variables!');
        return res.status(500).json({ message: 'Konfigurasi AI belum lengkap. Hubungi administrator.' });
    }

    try {
        const groqMessages = [
            // System prompt sebagai instruksi utama
            { role: 'system', content: SYSTEM_PROMPT },

            // Riwayat percakapan dari frontend
            ...messages.map(msg => ({
                role: msg.role,      // 'user' | 'assistant'
                content: msg.content,
            })),

            // Reinforcement: instruksi bahasa diulang tepat sebelum model menjawab.
            // Trik ini sangat efektif untuk mencegah model "lupa" instruksi bahasa
            // di tengah percakapan panjang.
            {
                role: 'system',
                content: 'PENGINGAT: Jawab pesan terakhir pengguna di atas HANYA dalam Bahasa Indonesia.',
            },
        ];

        const completion = await groq.chat.completions.create({
            model:       GROQ_MODEL,
            messages:    groqMessages,
            temperature: 0.7,   // 0 = deterministik, 1 = kreatif. 0.7 cocok untuk chatbot medis
            max_tokens:  1024,  // cukup untuk jawaban medis yang detail
        });

        const reply = completion.choices[0]?.message?.content?.trim()
            || 'Maaf, saya tidak dapat memproses permintaan ini saat ini. Silakan coba beberapa saat lagi.';

        return res.json({ reply });

    } catch (err) {
        console.error('[Klinbot/Groq Error]', err.message);

        if (err.status === 401) {
            return res.status(500).json({ message: 'Konfigurasi AI tidak valid. Hubungi administrator.' });
        }
        if (err.status === 429) {
            return res.status(429).json({ message: 'Layanan AI sedang sibuk. Mohon coba lagi dalam beberapa saat.' });
        }

        return res.status(err.status || 500).json({
            message: 'Gagal menghubungi layanan AI. Mohon coba lagi.',
        });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/ollama/status
// Health check — cocok untuk monitoring dan debugging di Railway
// ────────────────────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
    if (!process.env.GROQ_API_KEY) {
        return res.status(503).json({
            status:  'error',
            message: 'GROQ_API_KEY belum di-set di Railway Variables',
        });
    }

    try {
        const models     = await groq.models.list();
        const modelNames = models.data.map(m => m.id);

        return res.json({
            status:           'ok',
            provider:         'Groq (Free Tier)',
            model_aktif:      GROQ_MODEL,
            available_models: modelNames,
        });
    } catch (err) {
        return res.status(503).json({
            status:  'error',
            message: 'Tidak dapat terhubung ke Groq API',
            error:   err.message,
        });
    }
});

module.exports = router;