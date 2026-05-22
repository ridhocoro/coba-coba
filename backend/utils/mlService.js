// utils/mlService.js
const axios = require('axios');

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || '').trim();

// Validasi URL saat startup
if (!ML_SERVICE_URL) {
  console.warn('[mlService] ⚠️  ML_SERVICE_URL tidak di-set. Klasifikasi penyakit dinonaktifkan.');
} else {
  try {
    new URL(ML_SERVICE_URL);
    console.log('[mlService] ✅ ML_SERVICE_URL:', ML_SERVICE_URL);
  } catch {
    console.error('[mlService] ❌ ML_SERVICE_URL tidak valid:', ML_SERVICE_URL, '— pastikan diawali https://');
  }
}

/**
 * Klasifikasi satu keluhan secara real-time
 * @param {string} keluhan - teks keluhan dari user
 * @param {string|null} gender - 'laki-laki' | 'perempuan' | null (dari profil user)
 * @returns {{ kategori, confidence, metode, gender } | null}
 */
const classifyKeluhan = async (keluhan, gender = null) => {
  if (!ML_SERVICE_URL) return null;
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/classify`,
      { keluhan, gender },
      { timeout: 5000 }
    );
    return response.data?.data || null;
  } catch (err) {
    console.error('[mlService] classifyKeluhan error:', err.message);
    return null;
  }
};

/**
 * Klasifikasi batch (untuk data lama yang belum punya kategori)
 * @param {Array<{id, keluhan, gender?}>} items
 * @returns {Array<{id, kategori, confidence, metode, gender}>}
 */
const classifyBatch = async (items) => {
  if (!ML_SERVICE_URL) return [];
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/classify/batch`,
      { data: items },
      { timeout: 30000 }
    );
    return response.data?.data || [];
  } catch (err) {
    console.error('[mlService] classifyBatch error:', err.message);
    return [];
  }
};

module.exports = { classifyKeluhan, classifyBatch };
