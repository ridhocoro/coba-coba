/**
 * Format nama dokter lengkap dengan gelar depan & belakang.
 * @param {object|null} doctor - Object dokter dengan field titlePrefix, name, titleSuffix
 * @returns {string}
 */
const fmtDoctorName = (doctor) => {
    if (!doctor) return 'Dokter';
    const parts = [doctor.titlePrefix, doctor.name, doctor.titleSuffix].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : (doctor.name || 'Dokter');
};

module.exports = fmtDoctorName;
