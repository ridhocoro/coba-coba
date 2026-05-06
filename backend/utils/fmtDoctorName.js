/**
 * Format nama dokter lengkap dengan gelar depan & belakang.
 * @param {object|null} doctor - Object dokter dengan field titlePrefix, name, titleSuffix
 * @returns {string}  Contoh: "dr. Bigmo, S.Pd"
 */

// Normalisasi gelar depan: tambah titik di akhir jika belum ada.
// Casing dipertahankan persis seperti input user.
// Contoh: "dr" -> "dr.", "Dr" -> "Dr.", "dr." -> "dr." (tidak berubah)
function normalizeTitlePrefix(prefix) {
    if (!prefix) return '';
    const t = prefix.trim();
    return t.endsWith('.') ? t : t + '.';
}

const fmtDoctorName = (doctor) => {
    if (!doctor) return 'Dokter';
    const rawPrefix = doctor.titlePrefix || doctor.title_prefix || '';
    const suffix    = doctor.titleSuffix || doctor.title_suffix || '';
    const prefix    = normalizeTitlePrefix(rawPrefix);
    let name = '';
    if (prefix) name += prefix + ' ';
    name += doctor.name || '';
    if (suffix) name += ', ' + suffix;
    return name.trim() || 'Dokter';
};

module.exports = fmtDoctorName;