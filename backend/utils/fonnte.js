const fmtDoctorName = require('./fmtDoctorName');
/**
 * fonnte.js — helper kirim WhatsApp via Fonnte API
 * Docs: https://fonnte.com/docs
 */
const axios = require('axios');

const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

// ── Kirim pesan WhatsApp ──────────────────────────────────────────────────────
async function sendWhatsApp(phone, message) {
    if (!FONNTE_TOKEN) {
        console.warn('[Fonnte] FONNTE_TOKEN tidak dikonfigurasi — skip kirim WA');
        return { success: false, reason: 'no_token' };
    }
    if (!phone) {
        console.warn('[Fonnte] Nomor HP tidak tersedia — skip kirim WA');
        return { success: false, reason: 'no_phone' };
    }
    const target = String(phone).replace(/^\+/, '');
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

// ── Format helper ─────────────────────────────────────────────────────────────
function fmtWIB(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    }) + ' WIB';
}
function fmtRp(amount) { return 'Rp ' + Number(amount || 0).toLocaleString('id-ID'); }

// ── Template: Konfirmasi Konsultasi Online ────────────────────────────────────
async function waKonfirmasiKonsultasi(user, doctor, consultation) {
    const msg =
`✅ *Konfirmasi Konsultasi Online*
Klinik Pratama IPB

Halo, *${user.name}*!
Pembayaran konsultasi Anda telah dikonfirmasi.

📋 *Detail:*
• Dokter  : ${fmtDoctorName(doctor)}
• Jadwal  : ${fmtWIB(consultation.scheduledAt)}
• Tipe    : ${consultation.consultationType === 'video_call' ? 'Video Call' : 'Chat'}

Buka aplikasi → Konsultasi → *Buka Room* saat waktunya tiba.
Pastikan koneksi internet Anda stabil.

_Klinik Pratama IPB_ 🏥`;
    return sendWhatsApp(user.phone, msg);
}

// ── Template: Reminder Konsultasi H-1 Jam ────────────────────────────────────
async function waReminderKonsultasi(user, doctor, consultation) {
    const msg =
`⏰ *Pengingat Konsultasi — 1 Jam Lagi*
Klinik Pratama IPB

Halo, *${user.name}*!
Konsultasi Anda dengan ${fmtDoctorName(doctor)} dimulai *1 jam lagi*.

📅 Jadwal : ${fmtWIB(consultation.scheduledAt)}
💬 Tipe   : ${consultation.consultationType === 'video_call' ? 'Video Call' : 'Chat'}

Silakan buka aplikasi dan masuk ke room tepat waktu.

_Klinik Pratama IPB_ 🏥`;
    return sendWhatsApp(user.phone, msg);
}

// ── Template: Konfirmasi Janji Temu ──────────────────────────────────────────
async function waKonfirmasiJanjiTemu(user, doctor, appointment) {
    const tgl = appointment.appointmentDate
        ? new Date(appointment.appointmentDate).toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
          })
        : '-';
    const msg =
`✅ *Konfirmasi Janji Temu*
Klinik Pratama IPB

Halo, *${user.name}*!
Janji temu Anda telah berhasil didaftarkan.

📋 *Detail:*
• Dokter  : ${fmtDoctorName(doctor)}
• Tanggal : ${tgl}
• Pukul   : ${appointment.appointmentTime} WIB
• Lokasi  : Klinik Pratama IPB, Kampus IPB Darmaga

⚠️ Harap datang *10 menit sebelum jadwal*.
Reschedule/batalkan minimal 24 jam sebelumnya lewat aplikasi.

_Klinik Pratama IPB_ 🏥`;
    return sendWhatsApp(user.phone, msg);
}

// ── Template: Reminder Janji Temu H-24 ───────────────────────────────────────
async function waReminderJanjiTemu(user, doctor, appointment) {
    const tgl = appointment.appointmentDate
        ? new Date(appointment.appointmentDate).toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
          })
        : '-';
    const msg =
`⏰ *Pengingat Janji Temu Besok*
Klinik Pratama IPB

Halo, *${user.name}*!
Anda memiliki janji temu *besok*.

📋 *Detail:*
• Dokter  : ${fmtDoctorName(doctor)}
• Tanggal : ${tgl}
• Pukul   : ${appointment.appointmentTime} WIB
• Lokasi  : Klinik Pratama IPB, Kampus IPB Darmaga

⚠️ Harap datang *10 menit sebelum jadwal*.

_Klinik Pratama IPB_ 🏥`;
    return sendWhatsApp(user.phone, msg);
}

// ── Template: Notif ke Dokter (Booking Baru) ──────────────────────────────────
async function waDokterBookingBaru(doctorPhone, doctorName, patientName, jadwal, tipe) {
    const msg =
`📅 *Booking Baru Masuk*
Klinik Pratama IPB

Halo, dr. *${doctorName}*!
Ada pasien baru yang memesan konsultasi dengan Anda.

👤 Pasien : ${patientName}
📅 Jadwal : ${jadwal}
💬 Tipe   : ${tipe}

Cek dashboard dokter untuk detail lengkap.

_Klinik Pratama IPB_ 🏥`;
    return sendWhatsApp(doctorPhone, msg);
}

// ── Template: Refund Diproses ─────────────────────────────────────────────────
async function waRefundDiproses(user, amount, referenceId) {
    const msg =
`💰 *Refund Sedang Diproses*
Klinik Pratama IPB

Halo, *${user.name}*!
Refund sebesar *${fmtRp(amount)}* sedang diproses dan akan masuk ke rekening Anda dalam 1×24 jam.

📋 Referensi: ${referenceId || '-'}
_Biaya layanan payment gateway tidak termasuk dalam refund._

_Klinik Pratama IPB_ 🏥`;
    return sendWhatsApp(user.phone, msg);
}

// ── Template: Konsultasi/Janji Dibatalkan ─────────────────────────────────────
async function waKonsultasiDibatalkan(user, doctorName, alasan) {
    const msg =
`❌ *Konsultasi Dibatalkan*
Klinik Pratama IPB

Halo, *${user.name}*!
Konsultasi Anda dengan ${doctorName} telah dibatalkan.${alasan ? '\nAlasan: ' + alasan : ''}

Jika sudah membayar, refund akan diproses dalam 1×24 jam.

_Klinik Pratama IPB_ 🏥`;
    return sendWhatsApp(user.phone, msg);
}

module.exports = {
    sendWhatsApp,
    waKonfirmasiKonsultasi,
    waReminderKonsultasi,
    waKonfirmasiJanjiTemu,
    waReminderJanjiTemu,
    waDokterBookingBaru,
    waRefundDiproses,
    waKonsultasiDibatalkan,
};