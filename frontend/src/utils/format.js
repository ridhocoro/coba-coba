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
// Normalisasi gelar depan: "dr" -> "dr.", "drg" -> "drg.", "Prof" -> "Prof.", dst.
// Normalisasi gelar depan: tambah titik di akhir jika belum ada.
// Casing dipertahankan persis seperti input user.
function normalizeTitlePrefix(prefix) {
    if (!prefix) return '';
    const t = prefix.trim();
    return t.endsWith('.') ? t : t + '.';
}

export const fmtDoctorName = (doc) => {
    if (!doc) return '-';
    const rawPrefix = doc.titlePrefix || doc.title_prefix || '';
    const suffix    = doc.titleSuffix || doc.title_suffix || '';
    const prefix    = normalizeTitlePrefix(rawPrefix);
    let name = '';
    if (prefix) name += prefix + ' ';
    name += doc.name || '';
    if (suffix) name += ', ' + suffix;
    return name.trim() || '-';
};