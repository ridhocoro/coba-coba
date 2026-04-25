/**
 * backend/utils/cloudinary-xendit-helper.js
 * Helper untuk delete video Cloudinary & process Xendit disbursement
 */

const axios = require('axios');
const { cloudinary } = require('../config/cloudinary');

/**
 * Delete file dari Cloudinary berdasarkan public_id
 */
async function deleteFromCloudinary(publicId, resourceType = 'video') {
    try {
        if (!publicId) {
            console.warn('[Cloudinary] No publicId provided, skipping delete');
            return false;
        }
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
        });
        if (result.result === 'ok' || result.result === 'not found') {
            console.log(`[Cloudinary] Deleted: ${publicId} (${result.result})`);
            return true;
        }
        console.warn(`[Cloudinary] Delete failed for ${publicId}:`, result);
        return false;
    } catch (err) {
        console.error(`[Cloudinary] Error deleting ${publicId}:`, err.message);
        return false;
    }
}

/**
 * Process Xendit disbursement untuk refund obat
 */
async function processXenditDisbursement({ amount, bankCode, accountNumber, accountName, orderId, description }) {
    try {
        if (!amount || !bankCode || !accountNumber || !accountName) {
            return { success: false, error: 'Missing required fields' };
        }

        const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
        if (!XENDIT_SECRET_KEY) return { success: false, error: 'XENDIT_SECRET_KEY not configured' };

        const externalId = `DISB-REFUND-${orderId}-${Date.now()}`;
        const auth = 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64');

        const response = await axios.post(
            'https://api.xendit.co/disbursements',
            {
                external_id: externalId,
                bank_code: bankCode.toUpperCase(),
                account_holder_name: accountName,
                account_number: accountNumber,
                amount: Math.round(amount),
                description: description || `Refund Pesanan`,
            },
            {
                headers: {
                    'Authorization': auth,
                    'Content-Type': 'application/json',
                    'X-IDEMPOTENCY-KEY': externalId,
                },
                timeout: 15000,
            }
        );

        return {
            success: true,
            disbursementId: response.data.id,
            externalId: response.data.external_id,
            amount: response.data.amount,
            status: response.data.status,
        };
    } catch (err) {
        const errorData = err.response?.data || {};
        console.error('[Xendit] Disbursement error:', errorData);
        return {
            success: false,
            errorCode: errorData.error_code || 'UNKNOWN_ERROR',
            error: errorData.message || err.message,
        };
    }
}

/**
 * Validasi bank code dengan Xendit
 */
async function validateBankCode(bankCode) {
    try {
        const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
        const auth = 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64');
        const response = await axios.get('https://api.xendit.co/available_disbursements_banks', {
            headers: { 'Authorization': auth },
            timeout: 5000,
        });
        const validCodes = (response.data || []).map(b => b.bank_code);
        return validCodes.includes(bankCode.toUpperCase());
    } catch (err) {
        console.error('[Xendit] Error validating bank code:', err.message);
        // Jika gagal validasi, return true agar tidak block user
        return true;
    }
}

/**
 * Get list of available banks dari Xendit
 */
async function getAvailableBanks() {
    try {
        const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
        const auth = 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64');
        const response = await axios.get('https://api.xendit.co/available_disbursements_banks', {
            headers: { 'Authorization': auth },
            timeout: 5000,
        });
        return response.data || [];
    } catch (err) {
        console.error('[Xendit] Error getting bank list:', err.message);
        // Fallback ke daftar bank umum
        return [
            { bank_code: 'BCA', name: 'Bank Central Asia' },
            { bank_code: 'BNI', name: 'Bank Negara Indonesia' },
            { bank_code: 'BRI', name: 'Bank Rakyat Indonesia' },
            { bank_code: 'MANDIRI', name: 'Bank Mandiri' },
            { bank_code: 'BSI', name: 'Bank Syariah Indonesia' },
            { bank_code: 'CIMB', name: 'CIMB Niaga' },
            { bank_code: 'PERMATA', name: 'Bank Permata' },
            { bank_code: 'DANAMON', name: 'Bank Danamon' },
            { bank_code: 'BTN', name: 'Bank Tabungan Negara' },
            { bank_code: 'OCBC', name: 'OCBC NISP' },
        ];
    }
}

module.exports = {
    deleteFromCloudinary,
    processXenditDisbursement,
    validateBankCode,
    getAvailableBanks,
};