/**
 * frontend/src/pages/Consultations.js
 * Updated:
 * - Menampilkan keterangan Offline untuk dokter yang belum punya jadwal
 * - Rating angka (★ 4.7) seperti Janji Temu — bukan 5 bintang penuh
 * - Tahun pengalaman di bawah rating pada card dokter
 * - Rating bisa dilakukan dari tab Riwayat (tanpa komentar)
 * - Konsultasi completed → masuk Riwayat; in_progress/ongoing → masuk Aktif
 * - Riwayat: tombol chat untuk lihat isi percakapan
 * - Riwayat: download surat sakit, resep obat
 * - Riwayat: tampil rekam medis seperti Janji Temu
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import { FaStar, FaStarHalfAlt, FaRegStar, FaImage } from 'react-icons/fa';
import { fmtDoctorName } from '../utils/format';

// ── Helpers ───────────────────────────────────────────────────────────────────
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const WIB_OFFSET = 7 * 60 * 60 * 1000;
const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const CANCEL_DEADLINE_MS = 24 * 60 * 60 * 1000;

const fmtRupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB' : '-';


const fmtDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(Date.UTC(y, m - 1, d) - WIB_OFFSET);
    const wib = new Date(dateObj.getTime() + WIB_OFFSET);
    return `${DAY_NAMES[wib.getUTCDay()]}, ${parseInt(d, 10)}/${parseInt(m, 10)}`;
};

const groupByDate = (slotsArr) => {
    const map = {};
    for (const s of slotsArr) {
        if (!map[s.date]) map[s.date] = [];
        map[s.date].push(s);
    }
    return map;
};

const STATUS_CFG = {
    draft: { color: '#6b7280', bg: '#f3f4f6', label: 'Draft' },
    pending_payment: { color: '#b45309', bg: '#fffbeb', label: 'Menunggu Pembayaran' },
    waiting_verification: { color: '#b45309', bg: '#fffbeb', label: 'Verifikasi Pembayaran' },
    confirmed: { color: '#1d4ed8', bg: '#eff6ff', label: 'Dikonfirmasi' },
    paid: { color: '#1d4ed8', bg: '#eff6ff', label: 'Dibayar' },
    scheduled: { color: '#7e22ce', bg: '#f5f3ff', label: 'Terjadwal' },
    in_progress: { color: '#15803d', bg: '#f0fdf4', label: 'Berlangsung' },
    ongoing: { color: '#15803d', bg: '#f0fdf4', label: 'Berlangsung' },
    completed: { color: '#4b5563', bg: '#f3f4f6', label: 'Selesai' },
    cancelled: { color: '#b91c1c', bg: '#fef2f2', label: 'Dibatalkan' },
    cancelled_by_user: { color: '#b91c1c', bg: '#fef2f2', label: 'Batal (Pasien)' },
    cancelled_by_doctor: { color: '#b91c1c', bg: '#fef2f2', label: 'Batal (Dokter)' },
    cancelled_by_admin: { color: '#b91c1c', bg: '#fef2f2', label: 'Batal (Admin)' },
    expired: { color: '#6b7280', bg: '#f3f4f6', label: 'Kadaluarsa' },
    rejected_payment: { color: '#b91c1c', bg: '#fef2f2', label: 'Pembayaran Ditolak' },
    no_show: { color: '#9a3412', bg: '#fef3c7', label: 'Tidak Hadir' },
    doctor_no_show: { color: '#b91c1c', bg: '#fef2f2', label: 'Dokter Tidak Hadir' },
    refund_requested: { color: '#7e22ce', bg: '#f5f3ff', label: 'Refund Diajukan' },
    refunded: { color: '#15803d', bg: '#f0fdf4', label: 'Refund Selesai' },
    refund_failed: { color: '#b91c1c', bg: '#fef2f2', label: 'Refund Ditolak' },
};

function canCancelConsultation(cons) {
    if (!['confirmed'].includes(cons.status)) return false;
    if (!cons.scheduledAt) return false;
    return new Date(cons.scheduledAt).getTime() - Date.now() > CANCEL_DEADLINE_MS;
}

function fmtCancelDeadline(scheduledAt) {
    const dl = new Date(new Date(scheduledAt).getTime() - CANCEL_DEADLINE_MS);
    return dl.toLocaleString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    }) + ' WIB';
}

// ── StarRating (display only, 5 bintang) ─────────────────────────────────────
const StarRating = ({ value = 0 }) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        if (value >= i) stars.push(<FaStar key={i} className="text-warning" />);
        else if (value >= i - 0.5) stars.push(<FaStarHalfAlt key={i} className="text-warning" />);
        else stars.push(<FaRegStar key={i} className="text-warning" />);
    }
    return <span>{stars}</span>;
};

// ── Countdown ─────────────────────────────────────────────────────────────────
const Countdown = ({ deadline, onExpired }) => {
    const [sisa, setSisa] = useState('');
    useEffect(() => {
        const tick = () => {
            const diff = new Date(deadline) - new Date();
            if (diff <= 0) { setSisa('00:00'); onExpired?.(); return; }
            const m = String(Math.floor(diff / 60000)).padStart(2, '0');
            const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
            setSisa(`${m}:${s}`);
        };
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [deadline, onExpired]);
    const isUrgent = sisa && parseInt(sisa.split(':')[0]) < 5;
    return (
        <span style={{ color: isUrgent ? '#b91c1c' : '#b45309', fontWeight: 700, fontFamily: 'monospace', fontSize: 18 }}>
            ⏱ {sisa}
        </span>
    );
};

// ── Helpers: status online/offline dokter konsultasi ─────────────────────────
// availableDays: [{ day: 'Senin', slots: [{ startTime: '08:00', endTime: '10:00', isAvailable }] }]
const DAY_NAME_TO_DOW = { 'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };
const DOW_TO_DAY_NAME = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * Cek apakah dokter konsultasi sedang online sekarang.
 * Online = ada slot hari ini (jam sekarang berada dalam salah satu slot aktif).
 */
const isConsultDocOnlineNow = (doc) => {
    try {
        const consAvailableDays = doc?.consAvailableDays;
        if (!consAvailableDays || !consAvailableDays.length) return false;

        const nowWIB  = new Date(Date.now() + 7 * 60 * 60 * 1000);
        const dow     = nowWIB.getUTCDay();
        const todayEntry = consAvailableDays.find(d => d.dow === dow);
        if (!todayEntry) return false;

        // Dokter "online" jika hari ini ada setidaknya 1 slot yang masih tersedia (belum past & belum booked)
        return (todayEntry.slots || []).some(slot => slot.isAvailable === true);
    } catch { return false; }
};

/**
 * Apakah dokter punya setidaknya satu hari dengan jadwal aktif (tidak harus hari ini).
 * Digunakan untuk membedakan "belum buat jadwal" vs "jadwal ada tapi bukan hari ini".
 */
const consultDocHasAnySchedule = (doc) => {
    // Cukup andalkan isOffline dari backend — sudah dihitung dengan benar
    return doc?.isOffline === false;
};

/**
 * Cari jadwal terdekat dokter konsultasi setelah sekarang.
 * Return: { label: "Senin, 7 Apr 2025, 08:00 WIB" } atau null.
 */
const getConsultNextAvailable = (doc) => {
    if (!doc?.nextAvailableSlot) return null;
    return { label: `${doc.nextAvailableSlot.dateLabel}, ${doc.nextAvailableSlot.startTime} WIB` };
};

// ── Animasi popup ─────────────────────────────────────────────────────────────
const POPUP_STYLE = `
@keyframes cons-backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
}
@keyframes cons-card-in {
    from { opacity: 0; transform: translateY(28px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
.cons-popup-backdrop { animation: cons-backdrop-in 0.22s ease forwards; }
.cons-popup-card     { animation: cons-card-in     0.28s cubic-bezier(.22,.68,0,1.2) forwards; }
`;

// ── DoctorProfileModal (Konsultasi) ──────────────────────────────────────────
const DoctorProfileModal = ({ doc, onClose }) => {
    const online = isConsultDocOnlineNow(doc);
    const hasAnySchedule = consultDocHasAnySchedule(doc);
    const noSchedule  = doc?.isOffline === true;
    const fullyBooked = doc?.isFullyBooked === true;
    const showOnline  = !noSchedule && !fullyBooked && online;
    const nextAvail   = (!showOnline && !noSchedule && !fullyBooked) ? getConsultNextAvailable(doc) : null;

    return (
        <>
            <style>{POPUP_STYLE}</style>
            <div className="cons-popup-backdrop"
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
                }}
                onClick={onClose}>
                <div className="cons-popup-card"
                    style={{
                        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 400,
                        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.25)'
                    }}
                    onClick={e => e.stopPropagation()}>

                    {/* Header foto */}
                    <div style={{
                        position: 'relative', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                        borderRadius: '20px 20px 0 0', padding: '32px 24px 24px', textAlign: 'center'
                    }}>
                        <button onClick={onClose}
                            style={{
                                position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.8)',
                                border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: 18,
                                cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                            ×
                        </button>

                        {/* Foto besar */}
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <div style={{
                                width: 96, height: 96, borderRadius: '50%', background: '#e5e7eb',
                                overflow: 'hidden', margin: '0 auto', border: '4px solid #fff',
                                boxShadow: '0 4px 16px rgba(0,0,0,.12)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', fontSize: 42
                            }}>
                                {doc?.photo
                                    ? <img src={(doc.photo.startsWith('http') ? doc.photo : `${API_URL}${doc.photo}`)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : '👨‍⚕️'}
                            </div>
                            {/* Badge online/offline */}
                            <span style={{
                                position: 'absolute', bottom: 4, right: 4,
                                background: showOnline ? '#22c55e' : '#ef4444',
                                color: '#fff', fontSize: 10, fontWeight: 700,
                                padding: '2px 7px', borderRadius: 20,
                                border: '2px solid #fff', whiteSpace: 'nowrap',
                            }}>
                                {showOnline ? '● Online' : '● Offline'}
                            </span>
                        </div>

                        <div style={{ marginTop: 14 }}>
                            <div style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>{fmtDoctorName(doc)}</div>
                            <div style={{ fontSize: 14, color: '#2563eb', fontWeight: 600, marginTop: 4 }}>Dokter {doc?.specialization}</div>
                        </div>
                    </div>

                    {/* Body info */}
                    <div style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* Keterangan tersedia lagi */}
                        {!showOnline && fullyBooked && (
                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 16 }}>📅</span>
                                <div>
                                    <div style={{ fontSize: 11, color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>Jadwal Penuh</div>
                                    <div style={{ fontSize: 13, color: '#991b1b', fontWeight: 600 }}>Semua jadwal minggu ini telah dipesan</div>
                                </div>
                            </div>
                        )}
                        {!showOnline && !fullyBooked && !noSchedule && nextAvail && (
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 16 }}>🕐</span>
                                <div>
                                    <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>Tersedia jadwal untuk</div>
                                    <div style={{ fontSize: 13, color: '#78350f', fontWeight: 600 }}>{nextAvail.label}</div>
                                </div>
                            </div>
                        )}
                        {/* Rating */}
                        {doc?.rating != null && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 14, color: '#f59e0b', fontWeight: 700 }}>★</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>{Number(doc.rating).toFixed(1)}</span>
                                {doc.totalReviews > 0 && <span style={{ fontSize: 12, color: '#9ca3af' }}>({doc.totalReviews} ulasan)</span>}
                            </div>
                        )}

                        {/* Pengalaman */}
                        {doc?.experience != null && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f9fafb', borderRadius: 10 }}>
                                <span style={{ fontSize: 20 }}>🏥</span>
                                <div>
                                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>PENGALAMAN</div>
                                    <div style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>{doc.experience} tahun</div>
                                </div>
                            </div>
                        )}

                        {/* Alumnus */}
                        {doc?.alumnus && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f9fafb', borderRadius: 10 }}>
                                <span style={{ fontSize: 20 }}>🎓</span>
                                <div>
                                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>ALUMNUS</div>
                                    <div style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>{doc.alumnus}</div>
                                </div>
                            </div>
                        )}

                        {/* Lokasi Praktik */}
                        {doc?.practiceLocation && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f9fafb', borderRadius: 10 }}>
                                <span style={{ fontSize: 20 }}>📍</span>
                                <div>
                                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>LOKASI PRAKTIK</div>
                                    <div style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>{doc.practiceLocation}</div>
                                </div>
                            </div>
                        )}

                        {/* Nomor STR */}
                        {doc?.strNumber && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10 }}>
                                <span style={{ fontSize: 20 }}>📋</span>
                                <div>
                                    <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 600 }}>NOMOR STR</div>
                                    <div style={{ fontSize: 13, color: '#1e40af', fontWeight: 700, fontFamily: 'monospace', letterSpacing: .5 }}>{doc.strNumber}</div>
                                </div>
                            </div>
                        )}

                        {/* Bio */}
                        {doc?.bio && (
                            <div style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 10 }}>
                                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 6 }}>TENTANG DOKTER</div>
                                <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>{doc.bio}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

// ── Modal Wrapper ─────────────────────────────────────────────────────────────
const Modal = ({ children, onClose, title, maxWidth = 480 }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        onClick={onClose}>
        <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{title}</span>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }}>×</button>
            </div>
            {children}
        </div>
    </div>
);

const Card = ({ children }) => (
    <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-4">{children}</div>
    </div>
);

// ── PaymentForm ───────────────────────────────────────────────────────────────
const PaymentForm = ({ consultation, amount, deadline, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handlePay = async () => {
        setLoading(true); setError(null);
        try {
            const res = await api.post(`/api/xendit/initiate-payment/${consultation._id}`);
            if (res.data.invoiceUrl) window.location.href = res.data.invoiceUrl;
            else throw new Error('Gagal mendapatkan URL pembayaran');
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Terjadi kesalahan');
            setLoading(false);
        }
    };

    return (
        <div style={{ fontFamily: "'Inter', sans-serif" }}>
            {deadline && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, textAlign: 'center' }}>
                    <div style={{ color: '#92400e', fontSize: 12, marginBottom: 4 }}>Selesaikan pembayaran dalam</div>
                    <Countdown deadline={deadline} onExpired={() => { toast.error('Waktu habis, silakan booking ulang'); onClose(); }} />
                    <div style={{ color: '#92400e', fontSize: 11, marginTop: 4 }}>Slot dibebaskan jika tidak dibayar tepat waktu</div>
                </div>
            )}
            <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Ringkasan</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
                    <span>Layanan</span><span style={{ fontWeight: 600 }}>Konsultasi Online</span>
                </div>
                {consultation?.doctorId?.name && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
                        <span>Dokter</span><span style={{ fontWeight: 600 }}>{fmtDoctorName(consultation.doctorId)}</span>
                    </div>
                )}
                {consultation?.scheduledAt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
                        <span>Jadwal</span>
                        <span style={{ fontWeight: 600 }}>
                            {new Date(consultation.scheduledAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB
                        </span>
                    </div>
                )}
                <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Total</span>
                    <span style={{ fontWeight: 800, fontSize: 20, color: '#059669' }}>{fmtRupiah(amount)}</span>
                </div>
            </div>
            <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>METODE TERSEDIA</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {['VA BCA/BRI/BNI/Mandiri', 'QRIS', 'OVO', 'DANA', 'ShopeePay', 'Alfamart/Indomaret'].map(m => (
                        <span key={m} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 9px', fontSize: 11, color: '#374151' }}>{m}</span>
                    ))}
                </div>
            </div>
            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 14 }}>
                    ⚠️ {error}
                </div>
            )}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1d4ed8', marginBottom: 16 }}>
                🔒 Anda akan diarahkan ke halaman Xendit yang aman. Konfirmasi <strong>otomatis</strong> setelah bayar.
            </div>
            <button onClick={handlePay} disabled={loading} style={{
                width: '100%', padding: '13px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 15,
                background: loading ? '#94a3b8' : 'linear-gradient(135deg,#1d4ed8,#2563eb)',
                color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
                {loading ? <>
                    <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.35)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block', animation: 'xspin 1s linear infinite' }} />
                    Mengarahkan ke Xendit...
                </> : '💳 Bayar Sekarang via Xendit'}
                <style>{`@keyframes xspin{to{transform:rotate(360deg)}}`}</style>
            </button>
            <button onClick={onClose} style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 14 }}>
                Batal
            </button>
        </div>
    );
};

// ── RatingModal — hanya bintang, tanpa komentar ───────────────────────────────
const RatingModal = ({ consultationId, doctor, onClose, onSuccess }) => {
    const [rating, setRating] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!rating) { toast.error('Pilih rating terlebih dahulu'); return; }
        setSubmitting(true);
        try {
            await api.post(`/api/consultations/${consultationId}/rating`, { rating });
            toast.success('Terima kasih atas rating Anda!');
            onSuccess(); onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal kirim rating');
        } finally { setSubmitting(false); }
    };

    return (
        <Modal title="⭐ Beri Rating" onClose={onClose} maxWidth={380}>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
                Bagaimana pengalaman konsultasi dengan {fmtDoctorName(doctor)}?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
                {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(0)}
                        onClick={() => setRating(i)}
                        style={{ fontSize: 40, cursor: 'pointer', transition: 'transform 0.1s', transform: i <= (hovered || rating) ? 'scale(1.25)' : 'scale(1)' }}>
                        {i <= (hovered || rating) ? '⭐' : '☆'}
                    </span>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>Batal</button>
                <button onClick={handleSubmit} disabled={!rating || submitting}
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#854d0e,#ca8a04)', color: '#fff', fontWeight: 700, cursor: rating ? 'pointer' : 'not-allowed', opacity: rating ? 1 : 0.5 }}>
                    {submitting ? 'Mengirim...' : 'Kirim Rating'}
                </button>
            </div>
        </Modal>
    );
};

// ── ConsultationCard ──────────────────────────────────────────────────────────
const ConsultationCard = ({
    cons, onPay, onChat, onDownload, onDownloadPrescription,
    onDownloadMedRecord, onDownloadReferral, onRate, onRefund, onCancel, onPostCancel, onReschedule,
    showChat = false,
}) => {
    const c = STATUS_CFG[cons.status] || { label: cons.status, color: '#6b7280', bg: '#f3f4f6' };
    const needsPay = cons.status === 'pending_payment';
    const canChat = ['confirmed', 'paid', 'scheduled', 'in_progress', 'ongoing'].includes(cons.status);
    // Rating bisa dari Riwayat
    const canRate = ['completed', 'doctor_no_show', 'cancelled_by_doctor', 'cancelled_by_admin'].includes(cons.status) && !cons.rating;
    const hasSickLetter = cons.sickLetter?.status === 'issued';
    const hasReferralLetter = cons.referralLetter?.status === 'issued';
    const hasPrescription = !!(cons.prescriptionData?.prescriptionNumber || cons.prescription);
    const hasMedRecord = !!cons.medicalRecord?.isCompleted;
    const canRefund = ['cancelled_by_doctor', 'doctor_no_show'].includes(cons.status);
    const isRefundPending = cons.status === 'refund_requested';
    const isRefundFailed = cons.status === 'refund_failed';
    const showCancelBtn = canCancelConsultation(cons);
    const canReschedule = cons.status === 'confirmed' && showCancelBtn;
    const needsPostCancelAction = ['doctor_no_show', 'cancelled_by_doctor', 'cancelled_by_admin'].includes(cons.status)
        && !cons.postCancelChoice && cons.paidAt;

    return (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, overflow: 'hidden', flexShrink: 0, border: '2px solid #e0eaff' }}>
                        {cons.doctorId?.photo
                            ? <img src={cons.doctorId.photo.startsWith('http') ? cons.doctorId.photo : `${API_URL}${cons.doctorId.photo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : (cons.status === 'completed' ? '📝' : '👨‍⚕️')
                        }
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{fmtDoctorName(cons.doctorId) || '-'}</div>
                        <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>Dokter {cons.doctorId?.specialization || 'Umum'}</div>
                    </div>
                </div>
                <div style={{ background: c.bg, color: c.color, padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                    {c.label}
                </div>
            </div>

            {/* Body */}
            <div style={{ padding: 20, flex: 1 }}>
                <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Tanggal & Tipe</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                            {fmtDate(cons.createdAt)} · {cons.consultationType === 'chat' ? '💬 Chat' : '📹 Video'}
                        </div>
                    </div>
                    {cons.scheduledAt && (
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Jadwal</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{fmtDateTime(cons.scheduledAt)}</div>
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Keluhan</div>
                    <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>{cons.symptoms || '—'}</div>
                </div>

                {cons.disease_category && (
                    <div style={{ marginTop: 8 }}>
                        {cons.disease_category === 'Tidak Dikenali' ? (
                            <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: 8,
                                background: '#fef9c3', border: '1px solid #fde68a',
                                borderRadius: 8, padding: '8px 12px',
                            }}>
                                <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e', lineHeight: 1.5 }}>
                                    Keluhan belum teridentifikasi — dokter akan mendiagnosis saat konsultasi
                                </span>
                            </div>
                        ) : (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                background: '#f0fdf4', border: '1px solid #bbf7d0',
                                borderRadius: 20, padding: '3px 12px',
                            }}>
                                <span style={{ fontSize: 11 }}>🤖</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#166534' }}>
                                    Terdeteksi: {cons.disease_category}
                                </span>
                                {cons.category_confidence && (
                                    <span style={{ fontSize: 10, color: '#64748b' }}>
                                        ({Math.round(cons.category_confidence * 100)}% akurasi)
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}


                {needsPay && cons.paymentDeadline && (
                    <div style={{ marginBottom: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#92400e', fontSize: 12, fontWeight: 600 }}>Batas bayar:</span>
                        <Countdown deadline={cons.paymentDeadline} />
                    </div>
                )}

                {cons.status === 'confirmed' && cons.scheduledAt && (
                    <div style={{
                        marginBottom: 14, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                        background: showCancelBtn ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${showCancelBtn ? '#bbf7d0' : '#fecaca'}`,
                        color: showCancelBtn ? '#166534' : '#b91c1c',
                    }}>
                        {showCancelBtn
                            ? <>⏰ Dapat dibatalkan hingga: <strong>{fmtCancelDeadline(cons.scheduledAt)}</strong></>
                            : <>🔒 Batas pembatalan telah lewat ({fmtCancelDeadline(cons.scheduledAt)})</>
                        }
                    </div>
                )}

                {/* Rekam Medis — tampil di card seperti Janji Temu */}
                {hasMedRecord && (
                    <div style={{ marginTop: 4, paddingTop: 14, borderTop: '1px dashed #e5e7eb' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>
                            📋 Rekam Medis & Diagnosis
                        </div>
                        <div style={{ fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 8, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                            {cons.medicalRecord.assessment && <div><span style={{ fontWeight: 600, color: '#111827' }}>Diagnosis:</span><br />{cons.medicalRecord.assessment}</div>}
                            {cons.medicalRecord.plan && <div><span style={{ fontWeight: 600, color: '#111827' }}>Rencana Terapi:</span><br />{cons.medicalRecord.plan}</div>}
                            {cons.medicalRecord.doctorNotes && <div><span style={{ fontWeight: 600, color: '#111827' }}>Catatan Tambahan:</span><br />{cons.medicalRecord.doctorNotes}</div>}
                        </div>
                    </div>
                )}

                {/* Resep */}
                {(cons.prescriptionData?.medicines?.length > 0 || cons.prescription) && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13 }}>
                        <div style={{ color: '#15803d', fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>
                            💊 Resep Obat {cons.prescriptionData ? `— No. ${cons.prescriptionData.prescriptionNumber}` : ''}
                        </div>
                        {cons.prescriptionData?.medicines?.slice(0, 3).map((m, i) => (
                            <div key={i} style={{ color: '#166534' }}>{i + 1}. {m.name} {m.dose || ''} — {m.frequency}</div>
                        ))}
                        {cons.prescriptionData?.medicines?.length > 3 && (
                            <div style={{ color: '#166534', fontSize: 11, marginTop: 4 }}>+{cons.prescriptionData.medicines.length - 3} obat lainnya</div>
                        )}
                        {!cons.prescriptionData && <div style={{ color: '#166534' }}>{cons.prescription}</div>}
                    </div>
                )}

                {/* Rating yang sudah diberikan */}
                {cons.rating && (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#6b7280', fontSize: 12 }}>Rating Anda: </span>
                        <StarRating value={cons.rating} />
                    </div>
                )}

                {isRefundPending && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: '#f5f3ff', borderRadius: 8, border: '1px solid #ddd6fe', fontSize: 13, color: '#7c3aed', fontWeight: 600 }}>
                        ⏳ Permintaan refund sedang diproses
                    </div>
                )}
                {isRefundFailed && cons.refund?.failReason && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', fontSize: 12, color: '#b91c1c' }}>
                        ❌ Refund ditolak: {cons.refund.failReason}
                    </div>
                )}
            </div>

            {/* Action Bar */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f3f4f6', background: '#f9fafb', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {needsPay && <button onClick={onPay} style={{ background: 'linear-gradient(135deg,#b45309,#d97706)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>💳 Bayar Sekarang</button>}
                {/* Chat: muncul saat konsultasi aktif ATAU dari riwayat (showChat) */}
                {(canChat || showChat) && onChat && (
                    <button onClick={onChat} style={{ background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        💬 {cons.status === 'ongoing' ? 'Lanjutkan Chat' : showChat ? 'Lihat Chat' : 'Buka Room'}
                    </button>
                )}
                {showCancelBtn && onCancel && <button onClick={onCancel} style={{ background: '#fff', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>❌ Batalkan & Refund</button>}
                {canReschedule && onReschedule && <button onClick={onReschedule} style={{ background: '#fff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🔄 Reschedule</button>}
                {needsPostCancelAction && onPostCancel && <button onClick={onPostCancel} style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🔄 Pilih Refund / Reschedule</button>}
                {canRate && onRate && <button onClick={onRate} style={{ background: 'linear-gradient(135deg,#854d0e,#ca8a04)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>⭐ Beri Rating</button>}
                {hasSickLetter && onDownload && <button onClick={onDownload} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📄 Surat Sakit</button>}
                {hasReferralLetter && onDownloadReferral && <button onClick={onDownloadReferral} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🔀 Surat Rujukan</button>}
                {hasPrescription && onDownloadPrescription && <button onClick={onDownloadPrescription} style={{ background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>💊 Resep PDF</button>}
                {hasMedRecord && onDownloadMedRecord && <button onClick={onDownloadMedRecord} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📋 Rekam Medis PDF</button>}
                {canRefund && onRefund && <button onClick={onRefund} style={{ background: 'linear-gradient(135deg,#6d28d9,#7c3aed)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>💸 Ajukan Refund</button>}
            </div>
        </div>
    );
};

// ── RefundModal ───────────────────────────────────────────────────────────────
const RefundModal = ({ consultation, onClose, onSuccess }) => {
    const [bankCode, setBankCode]           = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountHolder, setAccountHolder] = useState('');
    const [bankList, setBankList]           = useState([]);
    const [submitting, setSubmitting]       = useState(false);

    React.useEffect(() => {
        api.get('/api/pharmacy/refund-banks')
            .then(r => setBankList(r.data.banks || []))
            .catch(() => setBankList([
                { code: 'BCA',     name: 'Bank Central Asia' },
                { code: 'BNI',     name: 'Bank Negara Indonesia' },
                { code: 'BRI',     name: 'Bank Rakyat Indonesia' },
                { code: 'MANDIRI', name: 'Bank Mandiri' },
                { code: 'BSI',     name: 'Bank Syariah Indonesia' },
                { code: 'CIMB',    name: 'CIMB Niaga' },
                { code: 'PERMATA', name: 'Bank Permata' },
                { code: 'DANAMON', name: 'Bank Danamon' },
                { code: 'BTN',     name: 'Bank Tabungan Negara' },
            ]));
    }, []);

    const handleSubmit = async () => {
        if (!bankCode || !accountNumber || !accountHolder) {
            toast.error('Lengkapi semua field yang wajib diisi'); return;
        }
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('bankCode', bankCode);
            fd.append('accountNumber', accountNumber);
            fd.append('accountName', accountHolder);
            await api.post(`/api/consultations/${consultation._id}/refund-request`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success('Refund berhasil diproses!');
            onSuccess(); onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal mengajukan refund');
        } finally { setSubmitting(false); }
    };

    const cancelReason = {
        cancelled_by_doctor: 'Konsultasi dibatalkan oleh dokter',
        doctor_no_show: 'Dokter tidak hadir dalam 15 menit setelah jadwal',
    }[consultation.status] || 'Konsultasi dibatalkan';

    const inputStyle = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' };

    return (
        <Modal title="💸 Ajukan Refund" onClose={onClose}>
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                <strong>Alasan refund:</strong> {cancelReason}
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#166534' }}>
                ✅ Refund akan langsung diproses ke rekening Anda setelah submit.
            </div>

            <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#374151', fontWeight: 600, display: 'block', marginBottom: 5 }}>Bank *</label>
                <select value={bankCode} onChange={e => setBankCode(e.target.value)} style={inputStyle}>
                    <option value="">— Pilih Bank —</option>
                    {bankList.map(b => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
                </select>
            </div>
            <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#374151', fontWeight: 600, display: 'block', marginBottom: 5 }}>Nomor Rekening *</label>
                <input value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 1234567890" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, color: '#374151', fontWeight: 600, display: 'block', marginBottom: 5 }}>Atas Nama *</label>
                <input value={accountHolder} onChange={e => setAccountHolder(e.target.value)}
                    placeholder="Sesuai buku tabungan" style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>Batal</button>
                <button onClick={handleSubmit} disabled={submitting || !bankCode || !accountNumber || !accountHolder}
                    style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: (!bankCode || !accountNumber || !accountHolder) ? '#c4b5fd' : '#7c3aed', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? '⏳ Memproses...' : '✓ Proses Refund Sekarang'}
                </button>
            </div>
        </Modal>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const Consultations = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('aktif');
    const [consultations, setConsultations] = useState([]);
    // Preload dari sessionStorage agar list dokter langsung muncul
    const [doctors, setDoctors] = useState(() => {
        try {
            const c = sessionStorage.getItem('cache:doctors-list');
            return c ? JSON.parse(c) : [];
        } catch { return []; }
    });
    const [loading, setLoading] = useState(() => {
        try { return !sessionStorage.getItem('cache:doctors-list'); }
        catch { return true; }
    });

    const [modalLogin, setModalLogin] = useState(false);
    const [doctorProfileModal, setDoctorProfileModal] = useState(null); // doc yang diklik
    const [payModal, setPayModal] = useState(null);
    const [ratingModal, setRatingModal] = useState(null);
    const [refundModal, setRefundModal] = useState(null);
    const [cancelModal, setCancelModal] = useState(null);
    const [cancelling, setCancelling] = useState(false);

    // Booking
    const [modalBook, setModalBook] = useState(false);
    const [bookDocId, setBookDocId] = useState('');
    const [bookType, setBookType] = useState('chat');
    const [bookDate, setBookDate] = useState('');
    const [bookTime, setBookTime] = useState('');
    const [bookSlotUtc, setBookSlotUtc] = useState(null);
    const [bookComplaint, setBookComplaint] = useState('');
    const [bookMedHistory, setBookMedHistory] = useState('');
    const [bookAttachments, setBookAttachments] = useState([]);
    const [slots, setSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [booking, setBooking] = useState(false);

    // Cancel bank info
    const [needsBankInfo, setNeedsBankInfo] = useState(false);
    const [bankCode, setBankCode] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [bankList, setBankList] = useState([]);

    // Post-cancel
    const [postCancelModal, setPostCancelModal] = useState(null);
    const [postCancelChoice, setPostCancelChoice] = useState(null);
    const [postCancelBankCode, setPostCancelBankCode] = useState('');
    const [postCancelAccount, setPostCancelAccount] = useState('');
    const [postCancelAccountName, setPostCancelAccountName] = useState('');
    const [postCancelProcessing, setPostCancelProcessing] = useState(false);

    useEffect(() => {
        api.get('/api/xendit/banks').then(r => setBankList(r.data.banks || [])).catch(() => { });
    }, []);

    const loadData = useCallback(async (background = false) => {
        if (!background) setLoading(true);
        try {
            let docs = [];
            if (user) {
                const [docRes, r] = await Promise.all([
                    api.get('/api/doctors'),
                    api.get('/api/consultations/my-consultations')
                ]);
                docs = docRes.data || [];
                setConsultations(r.data || []);
            } else {
                const docRes = await api.get('/api/doctors');
                docs = docRes.data || [];
            }
            setDoctors(docs);
            // Simpan ke sessionStorage agar next visit langsung tampil
            try { sessionStorage.setItem('cache:doctors-list', JSON.stringify(docs)); } catch (_) {}
        } catch { if (!background) toast.error('Gagal memuat data'); }
        finally { if (!background) setLoading(false); }
    }, [user]);

    useEffect(() => {
        if (!user) setActiveTab('buat_janji');
        else setActiveTab('aktif');
        const hasCache = (() => { try { return !!sessionStorage.getItem('cache:doctors-list'); } catch { return false; } })();
        loadData(hasCache);
    }, [user, loadData]);

    useEffect(() => {
        const hasPending = consultations.some(c => c.status === 'pending_payment');
        if (!hasPending) return;
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, [consultations, loadData]);

    useEffect(() => {
        if (!user) return;
        const onFocus = () => loadData(true);
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [loadData, user]);

    useEffect(() => {
        if (!user) return;
        const sock = io(API_URL, { auth: { token: localStorage.getItem('token') }, query: { userId: user.id } });
        sock.emit('join-user', user.id);
        sock.on('new-notification', (n) => {
            if (['payment_verified', 'consultation_started', 'consultation_ended'].includes(n.type)) loadData();
        });
        sock.on('consultation-status-update', () => loadData());
        return () => sock.close();
    }, [user, loadData]);

    const downloadFile = async (url, filename) => {
        try {
            const r = await api.get(url, { responseType: 'blob' });
            const u = window.URL.createObjectURL(new Blob([r.data]));
            const a = document.createElement('a'); a.href = u; a.download = filename;
            document.body.appendChild(a); a.click(); a.remove();
            toast.success('Berhasil diunduh');
        } catch { toast.error('Gagal mengunduh file'); }
    };

    const fetchSlots = async (docId) => {
        setLoadingSlots(true);
        setBookTime(''); setBookSlotUtc(null); setSlots([]);
        try {
            const r = await api.get(`/api/availability/slots/${docId}`);
            const slotData = r.data.slots || [];
            setSlots(slotData);
            const dates = [...new Set(slotData.map(s => s.date))].sort();
            setBookDate(dates.length > 0 ? dates[0] : '');
        } catch { toast.error('Gagal memuat jadwal dokter'); }
        finally { setLoadingSlots(false); }
    };

    const handleBookStart = (doc) => {
        if (!user) { setModalLogin(true); return; }
        setBookDocId(doc._id || doc.id);
        setBookType('chat');
        setBookDate(''); setBookTime(''); setBookSlotUtc(null);
        setBookComplaint(''); setBookMedHistory(''); setBookAttachments([]);
        setModalBook(true);
        fetchSlots(doc._id || doc.id);
    };

    const submitBooking = async () => {
        if (!bookDate || !bookTime || !bookSlotUtc) return toast.error('Pilih tanggal dan waktu terlebih dahulu');
        if (!bookComplaint.trim()) return toast.error('Mohon isi keluhan Anda');
        setBooking(true);
        try {
            const fd = new FormData();
            fd.append('doctorId', bookDocId);
            fd.append('consultationType', bookType);
            fd.append('scheduledAt', bookSlotUtc.startUtc);
            fd.append('scheduledEnd', bookSlotUtc.endUtc);
            fd.append('symptoms', bookComplaint);
            fd.append('medicalHistory', bookMedHistory);
            bookAttachments.forEach(f => fd.append('attachments', f));

            const r = await api.post('/api/consultations/create', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setModalBook(false);
            setActiveTab('aktif');
            loadData();

            const res = await api.post(`/api/xendit/initiate-payment/${r.data.consultation._id}`);
            if (res.data.invoiceUrl) {
                toast.success('Slot dikunci! Mengarahkan ke pembayaran...');
                setTimeout(() => { window.location.href = res.data.invoiceUrl; }, 700);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal membuat konsultasi');
        } finally { setBooking(false); }
    };

    const handleCancelConsultation = async () => {
        if (!cancelModal) return;
        setCancelling(true);
        try {
            const payload = { reason: 'Dibatalkan oleh pasien' };
            if (needsBankInfo) {
                if (!bankCode || !accountNumber || !accountName) {
                    toast.error('Data rekening wajib diisi untuk menerima refund');
                    setCancelling(false); return;
                }
                payload.bankCode = bankCode; payload.accountNumber = accountNumber; payload.accountName = accountName;
            }
            const r = await api.put(`/api/consultations/${cancelModal._id}/cancel`, payload);
            if (r.data.needsBankInfo) { setNeedsBankInfo(true); setCancelling(false); return; }
            toast.success('Konsultasi dibatalkan. Refund akan diproses dalam 1x24 jam.');
            setCancelModal(null); setNeedsBankInfo(false);
            setBankCode(''); setAccountNumber(''); setAccountName('');
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Gagal membatalkan konsultasi');
        } finally { setCancelling(false); }
    };

    const handlePostCancelChoice = async () => {
        if (!postCancelModal || !postCancelChoice) return;
        setPostCancelProcessing(true);
        try {
            if (postCancelChoice === 'refund') {
                const fd2 = new FormData();
                if (postCancelBankCode) fd2.append('bankCode', postCancelBankCode);
                if (postCancelAccount) fd2.append('accountNumber', postCancelAccount);
                if (postCancelAccountName) fd2.append('accountName', postCancelAccountName);
                await api.post(`/api/consultations/${postCancelModal._id}/refund-request`, fd2);
                toast.success('Permintaan refund dikirim. Dana akan masuk dalam 1×24 jam.');
                setPostCancelModal(null); loadData();
            } else if (postCancelChoice === 'reschedule') {
                navigate(`/consultations/book/${postCancelModal.doctorId?._id || postCancelModal.doctorId}?rescheduleId=${postCancelModal._id}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal memproses pilihan');
        } finally { setPostCancelProcessing(false); }
    };

    // ── Derived data ──────────────────────────────────────────────────────────
    // Aktif: termasuk in_progress dan ongoing
    const active = consultations.filter(c =>
        ['pending_payment', 'waiting_verification', 'confirmed', 'paid', 'scheduled', 'in_progress', 'ongoing'].includes(c.status)
    );
    // Perlu tindakan (tidak masuk riwayat biasa)
    const needsAction = consultations.filter(c =>
        ['cancelled_by_doctor', 'cancelled_by_admin', 'cancelled_by_user', 'doctor_no_show', 'refund_requested', 'refund_failed'].includes(c.status)
    );
    // Riwayat: completed + cancelled/expired + refunded — tidak duplikat dengan needsAction
    const history = consultations.filter(c =>
        ['completed', 'cancelled', 'expired', 'rejected_payment', 'no_show', 'refunded',
            'cancelled_by_user', 'cancelled_by_admin', 'cancelled_by_doctor'].includes(c.status)
        && !needsAction.find(n => n._id === c._id)
    );

    const groupedBookSlots = groupByDate(slots);
    const bookDates = Object.keys(groupedBookSlots).sort();
    const selectedDoc = doctors.find(d => d._id === bookDocId || d.id === bookDocId);

    // ── RENDER ────────────────────────────────────────────────────────────────
    return (
        <div className="container py-4" style={{ maxWidth: 1000, fontFamily: "'Inter', sans-serif" }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h4 style={{ color: '#111827', fontWeight: 800, marginBottom: 2 }}>Konsultasi Online</h4>
                    <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Konsultasi dengan dokter berpengalaman dari rumah.</p>
                </div>
            </div>

            {/* Tab Navigation */}
            {user && (
                <div className="d-flex border-bottom mb-4" style={{ gap: '1.5rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                    {[
                        { id: 'aktif', label: '🕒 Konsultasi Aktif' },
                        { id: 'buat_janji', label: '➕ Konsultasi Baru' },
                        { id: 'riwayat', label: '📖 Riwayat & Rekam Medis' },
                    ].map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className="bg-transparent border-0 pb-2 px-1"
                            style={{
                                borderBottom: activeTab === t.id ? '2px solid #2563eb' : '2px solid transparent',
                                color: activeTab === t.id ? '#2563eb' : '#6b7280',
                                fontWeight: 600, fontSize: '0.95rem', transition: 'color 0.2s, border-color 0.2s'
                            }}>
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="text-muted mt-3">Memuat data...</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

                    {/* ── TAB 1: KONSULTASI AKTIF ── */}
                    {user && activeTab === 'aktif' && (
                        <div>
                            {needsAction.length > 0 && (
                                <div style={{ marginBottom: 24 }}>
                                    <h5 style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>⚠️ Perlu Tindakan ({needsAction.length})</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                                        {needsAction.map(cons => (
                                            <ConsultationCard key={cons._id} cons={cons}
                                                onChat={() => navigate(`/consultations/${cons._id}`)}
                                                onRefund={() => setRefundModal(cons)}
                                                onDownload={() => downloadFile(`/api/consultations/${cons._id}/sick-letter/pdf`, `surat-sakit-${cons._id}.pdf`)}
                                                onDownloadReferral={() => downloadFile(`/api/consultations/${cons._id}/referral-letter/pdf`, `surat-rujukan-${cons._id}.pdf`)}
                                                onDownloadPrescription={() => downloadFile(`/api/consultations/${cons._id}/prescription/pdf`, `resep-${cons._id}.pdf`)}
                                                onDownloadMedRecord={() => downloadFile(`/api/consultations/${cons._id}/medical-record/pdf`, `rekam-medis-${cons._id}.pdf`)}
                                                onRate={() => setRatingModal({ id: cons._id, doctor: cons.doctorId })}
                                                onPostCancel={() => { setPostCancelModal(cons); setPostCancelChoice(null); setPostCancelBankCode(''); setPostCancelAccount(''); setPostCancelAccountName(''); }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {active.length > 0 && (
                                <div>
                                    <h5 style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>⚡ Aktif ({active.length})</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                                        {active.map(cons => (
                                            <ConsultationCard key={cons._id} cons={cons}
                                                onPay={() => setPayModal({ consultation: cons, amount: cons.doctorId?.consultationFee, deadline: cons.paymentDeadline })}
                                                onChat={() => navigate(`/consultations/${cons._id}`)}
                                                onDownload={() => downloadFile(`/api/consultations/${cons._id}/sick-letter/pdf`, `surat-sakit-${cons._id}.pdf`)}
                                                onDownloadReferral={() => downloadFile(`/api/consultations/${cons._id}/referral-letter/pdf`, `surat-rujukan-${cons._id}.pdf`)}
                                                onDownloadPrescription={() => downloadFile(`/api/consultations/${cons._id}/prescription/pdf`, `resep-${cons._id}.pdf`)}
                                                onDownloadMedRecord={() => downloadFile(`/api/consultations/${cons._id}/medical-record/pdf`, `rekam-medis-${cons._id}.pdf`)}
                                                onRate={() => setRatingModal({ id: cons._id, doctor: cons.doctorId })}
                                                onRefund={() => setRefundModal(cons)}
                                                onCancel={() => setCancelModal(cons)}
                                                onReschedule={() => navigate(`/consultations/book/${cons.doctorId?._id || cons.doctorId}?rescheduleId=${cons._id}`)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {needsAction.length === 0 && active.length === 0 && (
                                <Card>
                                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                        <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                                        <h3 style={{ color: '#111827', fontSize: 16, marginBottom: 8 }}>Belum Ada Konsultasi Aktif</h3>
                                        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>Anda belum memiliki sesi konsultasi yang sedang berjalan.</p>
                                        <button onClick={() => setActiveTab('buat_janji')} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                                            Konsultasi Sekarang
                                        </button>
                                    </div>
                                </Card>
                            )}
                        </div>
                    )}

                    {/* ── TAB 2: KONSULTASI BARU ── */}
                    {(!user || activeTab === 'buat_janji') && (
                        <div>
                            {user && <h5 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Pilih Dokter</h5>}
                            {!user && (
                                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                                    <span style={{ fontSize: 18 }}>ℹ️</span>
                                    <span style={{ color: '#1e40af' }}>Pilih dokter dan klik <strong>Pilih Jadwal</strong> untuk mulai — perlu login terlebih dahulu.</span>
                                </div>
                            )}
                            {doctors.length === 0 ? (
                                <Card><p style={{ textAlign: 'center', color: '#6b7280', margin: 0, padding: '20px 0' }}>Belum ada dokter yang tersedia.</p></Card>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                    {doctors.map(doc => {
                                        const online = isConsultDocOnlineNow(doc);
                                        const hasAnySchedule = consultDocHasAnySchedule(doc);
                                        const noSchedule  = doc.isOffline === true;
                                        const fullyBooked = doc.isFullyBooked === true;
                                        const showOnline  = !noSchedule && !fullyBooked && online;
                                        // Bisa diklik jika ada jadwal dan belum penuh semua
                                        const canBook   = !noSchedule && !fullyBooked;
                                        // Keterangan "Tersedia lagi" hanya jika offline tapi ada slot tersisa
                                        const nextAvail = (!showOnline && !noSchedule && !fullyBooked) ? getConsultNextAvailable(doc) : null;

                                        return (
                                            <div key={doc._id} style={{
                                                background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb',
                                                display: 'flex', flexDirection: 'column',
                                                opacity: noSchedule ? 0.6 : 1, filter: noSchedule ? 'grayscale(40%)' : 'none',
                                                transition: 'all 0.2s'
                                            }}>
                                                <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
                                                    <div onClick={() => setDoctorProfileModal(doc)}
                                                        style={{ width: 56, height: 56, borderRadius: '50%', background: '#f3f4f6', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                                                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,99,235,0.18)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}>
                                                        {doc.photo
                                                            ? <img src={(doc.photo.startsWith('http') ? doc.photo : `${API_URL}${doc.photo}`)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            : '👨‍⚕️'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                                                            {fmtDoctorName(doc)}
                                                        </div>
                                                        <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, marginTop: 2 }}>Dokter {doc.specialization}</div>

                                                        {/* Badge Online / Offline / Jadwal Penuh */}
                                                        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                                <span style={{
                                                                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                                                                    background: showOnline ? '#dcfce7' : '#fee2e2',
                                                                    color: showOnline ? '#166534' : '#b91c1c',
                                                                    border: `1px solid ${showOnline ? '#bbf7d0' : '#fecaca'}`,
                                                                    whiteSpace: 'nowrap',
                                                                }}>
                                                                    {showOnline ? 'Online' : 'Offline'}
                                                                </span>
                                                            </div>
                                                            {/* Keterangan sub-status */}
                                                            {!showOnline && fullyBooked && (
                                                                <div style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>
                                                                    Jadwal telah penuh
                                                                </div>
                                                            )}
                                                            {!showOnline && !fullyBooked && !noSchedule && nextAvail && (
                                                                <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                    <span>🕐</span>
                                                                    <span>Tersedia {nextAvail.label}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Rating angka (★ 4.7) */}
                                                        {doc.rating != null && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                                                <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>★</span>
                                                                <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
                                                                    {Number(doc.rating).toFixed(1)}
                                                                </span>
                                                                {doc.totalReviews != null && (
                                                                    <span style={{ fontSize: 11, color: '#9ca3af' }}>({doc.totalReviews})</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {/* Tahun pengalaman */}
                                                        {doc.experience != null && (
                                                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                                                                {doc.experience} tahun pengalaman
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                                    <span style={{ color: noSchedule ? '#9ca3af' : '#2563eb', fontWeight: 700, fontSize: 14 }}>
                                                        {fmtRupiah(doc.consultationFee)}
                                                    </span>
                                                    <button
                                                        disabled={!canBook}
                                                        onClick={() => canBook && handleBookStart(doc)}
                                                        style={{
                                                            padding: '8px 16px',
                                                            background: noSchedule ? '#f3f4f6' : '#eff6ff',
                                                            color: noSchedule ? '#9ca3af' : '#2563eb',
                                                            border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
                                                            cursor: canBook ? 'pointer' : 'not-allowed',
                                                            transition: 'background .2s'
                                                        }}
                                                        onMouseEnter={e => { if (canBook) e.target.style.background = '#dbeafe' }}
                                                        onMouseLeave={e => { if (canBook) e.target.style.background = '#eff6ff' }}>
                                                        {noSchedule ? 'Tidak Tersedia' : fullyBooked ? 'Jadwal Penuh' : 'Pilih Jadwal'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TAB 3: RIWAYAT & REKAM MEDIS ── */}
                    {user && activeTab === 'riwayat' && (
                        <div>
                            {history.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                                    {history.map(cons => (
                                        <ConsultationCard key={cons._id} cons={cons}
                                            showChat={true}
                                            onChat={() => navigate(`/consultations/${cons._id}`)}
                                            onRate={() => setRatingModal({ id: cons._id, doctor: cons.doctorId })}
                                            onDownload={() => downloadFile(`/api/consultations/${cons._id}/sick-letter/pdf`, `surat-sakit-${cons._id}.pdf`)}
                                            onDownloadReferral={() => downloadFile(`/api/consultations/${cons._id}/referral-letter/pdf`, `surat-rujukan-${cons._id}.pdf`)}
                                            onDownloadPrescription={() => downloadFile(`/api/consultations/${cons._id}/prescription/pdf`, `resep-${cons._id}.pdf`)}
                                            onDownloadMedRecord={() => downloadFile(`/api/consultations/${cons._id}/medical-record/pdf`, `rekam-medis-${cons._id}.pdf`)}
                                            onRefund={() => setRefundModal(cons)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <Card>
                                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                        <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
                                        <h3 style={{ color: '#111827', fontSize: 16, marginBottom: 8 }}>Belum Ada Riwayat</h3>
                                        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 0 }}>Riwayat konsultasi dan rekam medis Anda akan muncul di sini setelah sesi selesai.</p>
                                    </div>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ══ MODAL BOOKING ══ */}
            {modalBook && (
                <Modal title="📅 Buat Konsultasi Baru" onClose={() => setModalBook(false)} maxWidth={560}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#f3f4f6', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                            {selectedDoc?.photo
                                ? <img src={(selectedDoc.photo.startsWith('http') ? selectedDoc.photo : `${API_URL}${selectedDoc.photo}`)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : '👨‍⚕️'}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{fmtDoctorName(selectedDoc)}</div>
                            <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 600 }}>Dokter {selectedDoc?.specialization}</div>
                            <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 700, marginTop: 2 }}>{fmtRupiah(selectedDoc?.consultationFee)}</div>
                        </div>
                    </div>

                    {/* Tipe Konsultasi */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#374151' }}>Tipe Konsultasi</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[
                                { val: 'chat', icon: '💬', label: 'Chat', key: 'allowChat' },
                                { val: 'video_call', icon: '📹', label: 'Video Call', key: 'allowVideoCall' },
                            ].map(opt => {
                                const isAllowed = selectedDoc?.[opt.key] !== false;
                                return (
                                    <button key={opt.val} disabled={!isAllowed} onClick={() => setBookType(opt.val)}
                                        style={{
                                            flex: 1, padding: '10px 0', borderRadius: 10,
                                            border: `1px solid ${bookType === opt.val ? '#2563eb' : '#e5e7eb'}`,
                                            background: bookType === opt.val ? '#eff6ff' : isAllowed ? '#fff' : '#f9fafb',
                                            color: bookType === opt.val ? '#1d4ed8' : isAllowed ? '#4b5563' : '#9ca3af',
                                            fontWeight: 600, fontSize: 13, cursor: isAllowed ? 'pointer' : 'not-allowed',
                                            opacity: isAllowed ? 1 : 0.5, transition: 'all 0.2s'
                                        }}>
                                        {opt.icon} {opt.label}
                                        {!isAllowed && <div style={{ fontSize: 10, fontWeight: 400 }}>Tidak tersedia</div>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Grid Hari Senin–Sabtu */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#374151' }}>Pilih Hari</label>
                        {loadingSlots ? (
                            <div style={{ fontSize: 13, color: '#6b7280' }}>Memuat jadwal...</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                                {[
                                    { label: 'Sen' }, { label: 'Sel' }, { label: 'Rab' },
                                    { label: 'Kam' }, { label: 'Jum' }, { label: 'Sab' },
                                ].map(({ label }, i) => {
                                    const targetDow = i + 1;
                                    const matchDate = bookDates.find(d => {
                                        const [y, m, day] = d.split('-');
                                        const wib = new Date(Date.UTC(+y, +m - 1, +day) + 7 * 60 * 60 * 1000);
                                        return wib.getUTCDay() === targetDow;
                                    });
                                    const isSelected = matchDate && bookDate === matchDate;
                                    const hasSlot = !!matchDate;
                                    const dateNum = matchDate ? matchDate.slice(8).replace(/^0/, '') : null;
                                    const monthAbbr = matchDate ? ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][+matchDate.slice(5, 7)] : null;
                                    return (
                                        <button key={label}
                                            disabled={!hasSlot}
                                            onClick={() => { if (hasSlot) { setBookDate(matchDate); setBookTime(''); setBookSlotUtc(null); } }}
                                            style={{
                                                padding: '12px 4px 10px',
                                                borderRadius: 12,
                                                textAlign: 'center',
                                                border: `2px solid ${isSelected ? '#2563eb' : hasSlot ? '#e5e7eb' : '#f3f4f6'}`,
                                                background: isSelected ? 'linear-gradient(135deg,#eff6ff,#dbeafe)' : hasSlot ? '#fff' : '#f9fafb',
                                                color: isSelected ? '#1d4ed8' : hasSlot ? '#374151' : '#cbd5e1',
                                                fontWeight: 700, fontSize: 13,
                                                cursor: hasSlot ? 'pointer' : 'not-allowed',
                                                transition: 'all 0.15s',
                                                boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.15)' : 'none',
                                                lineHeight: 1.3,
                                            }}>
                                            <div>{label}</div>
                                            {hasSlot ? (
                                                <div style={{ fontSize: 10, fontWeight: 500, color: isSelected ? '#2563eb' : '#9ca3af', marginTop: 3 }}>
                                                    {dateNum} {monthAbbr}
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: 9, color: '#cbd5e1', marginTop: 3 }}>—</div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Grid Waktu */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#374151' }}>Pilih Waktu (WIB)</label>
                        {loadingSlots ? (
                            <div style={{ fontSize: 13, color: '#6b7280' }}>Memuat waktu...</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                                {(groupedBookSlots[bookDate] || []).length === 0 ? (
                                    <div style={{ fontSize: 13, color: '#6b7280', gridColumn: '1/-1' }}>
                                        {bookDate ? 'Tidak ada slot tersedia di tanggal ini.' : 'Pilih tanggal terlebih dahulu.'}
                                    </div>
                                ) : (groupedBookSlots[bookDate] || []).map(s => (
                                    <button key={s.startTime} disabled={!s.available} onClick={() => { setBookTime(s.startTime); setBookSlotUtc(s); }}
                                        style={{
                                            padding: '10px 4px', borderRadius: 10, textAlign: 'center',
                                            border: `2px solid ${bookTime === s.startTime ? '#2563eb' : s.available ? '#e5e7eb' : '#f3f4f6'}`,
                                            background: bookTime === s.startTime ? 'linear-gradient(135deg,#eff6ff,#dbeafe)' : s.available ? '#fff' : '#f9fafb',
                                            color: bookTime === s.startTime ? '#1d4ed8' : s.available ? '#374151' : '#9ca3af',
                                            fontWeight: 700, fontSize: 13,
                                            cursor: s.available ? 'pointer' : 'not-allowed',
                                            transition: 'all 0.15s',
                                            boxShadow: bookTime === s.startTime ? '0 2px 8px rgba(37,99,235,0.15)' : 'none',
                                            lineHeight: 1.3,
                                        }}>
                                        <div>{s.startTime}</div>
                                        <div style={{
                                            fontSize: 9, fontWeight: 500, marginTop: 2,
                                            color: bookTime === s.startTime ? '#2563eb' : s.available ? '#9ca3af' : '#d1d5db'
                                        }}>
                                            {!s.available ? 'Penuh' : `s/d ${s.endTime}`}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Keluhan */}
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                            Keluhan Utama <span style={{ color: '#b91c1c' }}>*</span>
                        </label>
                        <textarea value={bookComplaint} onChange={e => setBookComplaint(e.target.value)} rows={3}
                            placeholder="Ceritakan gejala yang Anda alami secara detail..."
                            style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>

                    {/* Riwayat Penyakit */}
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Riwayat Penyakit</label>
                        <textarea value={bookMedHistory} onChange={e => setBookMedHistory(e.target.value)} rows={2}
                            placeholder="Penyakit sebelumnya, alergi obat, dll. (opsional)"
                            style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>

                    {/* Lampiran Foto */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Lampiran Foto (opsional, maks 5)</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', border: '1px dashed #d1d5db', borderRadius: 10, cursor: 'pointer' }}>
                            <FaImage style={{ color: '#2563eb' }} />
                            <span style={{ color: '#6b7280', fontSize: 13 }}>
                                {bookAttachments.length > 0 ? `${bookAttachments.length} file dipilih` : 'Pilih foto keluhan...'}
                            </span>
                            <input type="file" accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple style={{ display: 'none' }}
                                onChange={e => setBookAttachments(Array.from(e.target.files).slice(0, 5))} />
                        </label>
                    </div>

                    {/* Ringkasan */}
                    {bookSlotUtc && (
                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                            <div style={{ color: '#1d4ed8', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>RINGKASAN PESANAN</div>
                            {[
                                ['Dokter', fmtDoctorName(selectedDoc)],
                                ['Tipe', bookType === 'chat' ? '💬 Chat' : '📹 Video Call'],
                                ['Jadwal', `${fmtDateLabel(bookDate)}, ${bookSlotUtc.startTime}–${bookSlotUtc.endTime} WIB`],
                                ['Biaya', fmtRupiah(selectedDoc?.consultationFee)],
                            ].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ color: '#6b7280', fontSize: 13 }}>{k}</span>
                                    <span style={{ color: '#111827', fontSize: 13, fontWeight: 600 }}>{v}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <button onClick={submitBooking} disabled={!bookDate || !bookTime || !bookComplaint.trim() || booking}
                        style={{
                            width: '100%', padding: 14, borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 700,
                            background: (!bookDate || !bookTime || !bookComplaint.trim() || booking) ? '#9ca3af' : 'linear-gradient(135deg,#1d4ed8,#2563eb)',
                            color: '#fff', cursor: (!bookDate || !bookTime || !bookComplaint.trim() || booking) ? 'not-allowed' : 'pointer'
                        }}>
                        {booking ? 'Memproses...' : 'Lanjut ke Pembayaran 💳'}
                    </button>
                </Modal>
            )}

            {/* Modal Profil Dokter */}
            {doctorProfileModal && (
                <DoctorProfileModal
                    doc={doctorProfileModal}
                    onClose={() => setDoctorProfileModal(null)}
                />
            )}

            {/* Modal Login */}
            {modalLogin && (
                <Modal title="🔐 Login Diperlukan" onClose={() => setModalLogin(false)} maxWidth={400}>
                    <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                            Silakan login atau daftar akun untuk melihat jadwal dan mulai berkonsultasi.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button onClick={() => setModalLogin(false)} style={{ padding: '10px 20px', background: '#f3f4f6', color: '#4b5563', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer' }}>Batal</button>
                            <button onClick={() => navigate('/login')} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer' }}>Login Sekarang</button>
                        </div>
                        <button onClick={() => navigate('/register')} style={{ marginTop: 10, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                            Belum punya akun? Daftar Gratis →
                        </button>
                    </div>
                </Modal>
            )}

            {/* Payment Modal */}
            {payModal && (
                <Modal title="💳 Pembayaran Konsultasi" onClose={() => setPayModal(null)}>
                    <PaymentForm
                        consultation={payModal.consultation}
                        amount={payModal.amount}
                        deadline={payModal.deadline}
                        onClose={() => setPayModal(null)}
                    />
                </Modal>
            )}

            {/* Refund Modal */}
            {refundModal && (
                <RefundModal
                    consultation={refundModal}
                    onClose={() => setRefundModal(null)}
                    onSuccess={loadData}
                />
            )}

            {/* Cancel Modal */}
            {cancelModal && (
                <Modal title="❌ Batalkan Konsultasi" onClose={() => { setCancelModal(null); setNeedsBankInfo(false); setBankCode(''); setAccountNumber(''); setAccountName(''); }}>
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#b91c1c', marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Perhatian</div>
                        <div>Pembatalan akan memicu <strong>refund otomatis</strong> ke rekening Anda dalam <strong>1x24 jam</strong>.</div>
                        <div style={{ marginTop: 4, color: '#991b1b' }}>Catatan: biaya layanan payment gateway tidak termasuk dalam refund.</div>
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', marginBottom: 16, lineHeight: 1.7 }}>
                        <div>👨‍⚕️ <strong>Dokter:</strong> {fmtDoctorName(cancelModal.doctorId)}</div>
                        <div>📅 <strong>Jadwal:</strong> {fmtDateTime(cancelModal.scheduledAt)}</div>
                    </div>
                    {needsBankInfo && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#92400e', marginBottom: 4 }}>💳 Masukkan data rekening untuk menerima refund</div>
                            <div style={{ fontSize: 12, color: '#b45309', marginBottom: 10 }}>Metode pembayaran tidak mendukung refund otomatis. Dana dikirim ke rekening dalam 1x24 jam.</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <select value={bankCode} onChange={e => setBankCode(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                                    <option value="">— Pilih Bank —</option>
                                    {bankList.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                                </select>
                                <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Nomor Rekening" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                                <input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Nama Pemilik Rekening" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                            </div>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => { setCancelModal(null); setNeedsBankInfo(false); setBankCode(''); setAccountNumber(''); setAccountName(''); }}
                            style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>
                            Kembali
                        </button>
                        <button onClick={handleCancelConsultation} disabled={cancelling}
                            style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: cancelling ? 0.6 : 1 }}>
                            {cancelling ? 'Memproses...' : needsBankInfo ? 'Konfirmasi & Refund' : 'Ya, Batalkan & Refund'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Post-Cancel Modal */}
            {postCancelModal && (
                <Modal title={postCancelModal.status === 'doctor_no_show' ? '😔 Dokter Tidak Hadir' : '🚫 Konsultasi Dibatalkan'} onClose={() => setPostCancelModal(null)}>
                    <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>
                        Konsultasi Anda dengan <strong>{fmtDoctorName(postCancelModal.doctorId)}</strong> tidak dapat dilanjutkan. Pilih tindakan selanjutnya:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                        {[
                            { val: 'reschedule', icon: '🔄', label: 'Reschedule', desc: 'Pilih jadwal baru dengan dokter yang sama. Tidak dikenakan biaya tambahan.' },
                            { val: 'refund', icon: '💰', label: 'Refund 100%', desc: 'Dana dikembalikan dalam 1x24 jam. Biaya payment gateway tidak termasuk.' },
                        ].map(opt => (
                            <label key={opt.val} style={{ border: `2px solid ${postCancelChoice === opt.val ? '#2563eb' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', background: postCancelChoice === opt.val ? '#eff6ff' : '#fff' }}>
                                <input type="radio" value={opt.val} checked={postCancelChoice === opt.val} onChange={() => setPostCancelChoice(opt.val)} style={{ marginRight: 8 }} />
                                <strong style={{ color: '#111827' }}>{opt.icon} {opt.label}</strong>
                                <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0 20px' }}>{opt.desc}</p>
                            </label>
                        ))}
                    </div>
                    {postCancelChoice === 'refund' && (() => {
                        const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
                        const needsBank = !postCancelModal.paidAt || (Date.now() - new Date(postCancelModal.paidAt).getTime()) >= REFUND_WINDOW_MS;
                        return needsBank ? (
                            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: '#92400e', marginBottom: 10 }}>💳 Masukkan data rekening untuk refund</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <select value={postCancelBankCode} onChange={e => setPostCancelBankCode(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                                        <option value="">— Pilih Bank —</option>
                                        {bankList.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                                    </select>
                                    <input value={postCancelAccount} onChange={e => setPostCancelAccount(e.target.value)} placeholder="Nomor Rekening" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                                    <input value={postCancelAccountName} onChange={e => setPostCancelAccountName(e.target.value)} placeholder="Nama Pemilik Rekening" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                                </div>
                            </div>
                        ) : null;
                    })()}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setPostCancelModal(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>Nanti</button>
                        <button onClick={handlePostCancelChoice} disabled={!postCancelChoice || postCancelProcessing}
                            style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: !postCancelChoice ? '#9ca3af' : '#2563eb', color: '#fff', fontWeight: 700, cursor: !postCancelChoice ? 'not-allowed' : 'pointer', opacity: postCancelProcessing ? 0.6 : 1 }}>
                            {postCancelProcessing ? 'Memproses...' : postCancelChoice === 'reschedule' ? 'Pilih Jadwal Baru →' : postCancelChoice === 'refund' ? 'Konfirmasi Refund' : 'Pilih Tindakan'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Rating Modal */}
            {ratingModal && (
                <RatingModal
                    consultationId={ratingModal.id}
                    doctor={ratingModal.doctor}
                    onClose={() => setRatingModal(null)}
                    onSuccess={loadData}
                />
            )}
        </div>
    );
};

export default Consultations;