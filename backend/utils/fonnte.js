/**
 * fonnte.js — helper kirim WhatsApp via Fonnte API
 * Docs: https://fonnte.com/docs
 */
const axios = require('axios');

const FONNTE_TOKEN = process.env.FONNTE_TOKEN; // token dari dashboard fonnte.com

/**
 * Kirim pesan WhatsApp via Fonnte
 * @param {string} phone  - nomor tujuan format +62xxx
 * @param {string} message - teks pesan
 */
async function sendWhatsApp(phone, message) {
    if (!FONNTE_TOKEN) {
        console.warn('[Fonnte] FONNTE_TOKEN tidak dikonfigurasi — skip kirim WA');
        return { success: false, reason: 'no_token' };
    }

    // Fonnte menerima format lokal (08xxx) atau internasional (+62xxx / 62xxx)
    // Kita kirim tanpa tanda + karena Fonnte lebih stabil dengan format 62xxx
    const target = phone.replace(/^\+/, '');

    try {
        const res = await axios.post(
            'https://api.fonnte.com/send',
            { target, message, countryCode: '62' },
            { headers: { Authorization: FONNTE_TOKEN } }
        );
        console.log(`[Fonnte] WA terkirim ke ${target}:`, res.data?.detail || 'ok');
        return { success: true, data: res.data };
    } catch (err) {
        console.error('[Fonnte] Gagal kirim WA:', err.response?.data || err.message);
        return { success: false, reason: err.message };
    }
}

module.exports = { sendWhatsApp };