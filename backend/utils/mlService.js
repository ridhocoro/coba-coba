// services/mlService.js
// Mengirim keluhan ke Python ML Service dan mengembalikan hasil klasifikasi

const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Klasifikasi satu keluhan secara real-time
 * @param {string} keluhan - teks keluhan dari user
 * @returns {{ kategori, confidence, metode } | null}
 */
const classifyKeluhan = async (keluhan) => {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/classify`,
      { keluhan },
      { timeout: 5000 }
    );
    return response.data?.data || null;
  } catch (err) {
    // Jangan crash app jika ML service down — log saja
    console.error('[mlService] classifyKeluhan error:', err.message);
    return null;
  }
};

/**
 * Klasifikasi batch (untuk data lama yang belum punya kategori)
 * @param {Array<{id, keluhan}>} items
 * @returns {Array<{id, kategori, confidence, metode}>}
 */
const classifyBatch = async (items) => {
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