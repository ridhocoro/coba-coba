const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL || 'mistral';

// ────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT - KLINIK IPB (BAHASA INDONESIA, MEDICAL-FOCUSED)
// ────────────────────────────────────────────────────────────────────────────
const CLINIC_SYSTEM_PROMPT = `Kamu adalah Klinbot, asisten kesehatan profesional untuk Klinik IPB.

ATURAN BAHASA SANGAT KETAT:
1. WAJIB 100% menggunakan Bahasa Indonesia.
2. JANGAN PERNAH menggunakan istilah "I understand", "How can I help", atau bahasa Inggris lainnya meskipun User bertanya dalam bahasa Inggris.
3. Gunakan sapaan khas mahasiswa IPB yang sopan seperti "Halo Sobat IPB" atau "Halo Kak".

PERAN KAMU:
Kamu adalah asisten kesehatan yang:
1. Memberikan informasi medis yang akurat dan berbasis bukti
2. Membantu pasien memahami gejala dan kondisi kesehatan mereka
3. Merekomendasikan kapan harus konsultasi dengan dokter
4. Mengedukasi tentang pencegahan penyakit dan gaya hidup sehat
5. Memberi informasi tentang layanan Klinik IPB (konsultasi online, janji temu, farmasi, dll)
6. Menggunakan terminologi medis yang tepat namun mudah dimengerti

Sekarang, jawab pertanyaan user dengan profesional, empati, dan SELALU dalam BAHASA INDONESIA.`;

/**
 * POST /api/ollama/chat
 * Body: { messages: [{ role: 'user'|'assistant', content: string }] }
 */
router.post('/chat', async (req, res) => {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: 'messages harus berupa array dan tidak boleh kosong' });
    }

    try {
        // Build context from chat history
        let context = CLINIC_SYSTEM_PROMPT + '\n\n';
        
        for (const msg of messages) {
            if (msg.role === 'user') {
                context += `User: ${msg.content}\n`;
            } else if (msg.role === 'assistant') {
                context += `Assistant: ${msg.content}\n`;
            }
        }

        context += `Assistant: `;

        // Call Ollama API
        const response = await axios.post(
            `${OLLAMA_BASE_URL}/api/generate`,
            {
                model: OLLAMA_MODEL,
                prompt: context,
                stream: false,
                temperature: 0.7,
            },
            { timeout: 120000 } // 120 detik timeout (lebih lama untuk jawaban detail)
        );

        const reply = response.data?.response?.trim() || 'Maaf, saya tidak dapat memproses permintaan ini.';

        return res.json({ reply });
    } catch (err) {
        console.error('[Ollama Proxy Error]', err.message);

        if (err.code === 'ECONNREFUSED') {
            return res.status(503).json({
                message: `Ollama tidak berjalan di ${OLLAMA_BASE_URL}. Pastikan Ollama sudah di-install dan di-start.`
            });
        }

        const errMsg = err.response?.data?.message || err.message || 'Gagal menghubungi Ollama';
        return res.status(err.response?.status || 500).json({ message: errMsg });
    }
});

/**
 * GET /api/ollama/status
 * Check if Ollama is running
 */
router.get('/status', async (req, res) => {
    try {
        const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
        const models = response.data?.models || [];
        const modelNames = models.map(m => m.name);
        
        return res.json({
            status: 'ok',
            model: OLLAMA_MODEL,
            available_models: modelNames,
            url: OLLAMA_BASE_URL,
        });
    } catch (err) {
        return res.status(503).json({
            status: 'error',
            message: `Ollama tidak berjalan di ${OLLAMA_BASE_URL}`,
            error: err.message,
        });
    }
});

module.exports = router;