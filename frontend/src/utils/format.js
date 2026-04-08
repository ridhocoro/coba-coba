/**
 * utils/format.js
 * Satu tempat untuk semua fungsi formatting yang dipakai lintas halaman.
 */

/**
 * Format nama dokter lengkap dengan gelar depan dan belakang.
 * Contoh: "dr. Budi Santoso, Sp.PD"
 * @param {object|null} doc - object dokter dengan field titlePrefix, name, titleSuffix
 * @returns {string}
 */
export const fmtDoctorName = (doc) => {
    if (!doc) return '-';
    const parts = [doc.titlePrefix, doc.name, doc.titleSuffix].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : (doc.name || '-');
};
