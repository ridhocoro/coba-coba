/**
 * BookingSlot.jsx
 * Halaman booking konsultasi online:
 *  1. User pilih dokter (di-pass via state/params)
 *  2. Tampilkan slot 7 hari ke depan dari DoctorAvailability
 *  3. User isi keluhan → submit → sistem lock slot (pending_payment)
 *  4. Redirect ke Xendit invoice URL
 *
 * Route: /consultations/book/:doctorId
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { fmtDoctorName } from '../../utils/format';

// ── Helpers ───────────────────────────────────────────────────────────────────
const WIB_OFFSET = 7 * 60 * 60 * 1000;

const fmtRupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;


const toWIBDate = (utcStr) => new Date(new Date(utcStr).getTime() + WIB_OFFSET);

const DAY_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

const groupByDate = (slots) => {
    const map = {};
    for (const s of slots) {
        if (!map[s.date]) map[s.date] = [];
        map[s.date].push(s);
    }
    return map;
};

const fmtDateLabel = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (+dt === +today) return 'Hari ini';
    if (+dt === +tomorrow) return 'Besok';
    return `${DAY_NAMES[dt.getDay()]}, ${d} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][m-1]}`;
};

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
    page     : { minHeight: '100vh', background: '#f8fafc', padding: '24px 16px', fontFamily: "'Inter', sans-serif" },
    card     : { background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '24px', marginBottom: 20 },
    title    : { fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 },
    subtitle : { fontSize: 13, color: '#6b7280', marginBottom: 20 },
    label    : { fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' },
    input    : { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', resize: 'vertical' },
    slot     : (available, selected, isPast) => ({
        padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
        cursor: available ? 'pointer' : 'not-allowed',
        border: selected ? '2px solid #2563eb' : '1px solid #d1d5db',
        background: selected ? '#eff6ff' : available ? '#fff' : isPast ? '#fafafa' : '#f3f4f6',
        color: selected ? '#2563eb' : available ? '#374151' : isPast ? '#d1d5db' : '#9ca3af',
        textDecoration: isPast ? 'line-through' : 'none',
        transition: 'all .15s',
    }),
    btnPrimary: (disabled) => ({
        width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? '#9ca3af' : '#2563eb', color: '#fff', fontSize: 15, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }),
    dateTab  : (active) => ({
        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        background: active ? '#2563eb' : '#f3f4f6', color: active ? '#fff' : '#374151',
        border: 'none', whiteSpace: 'nowrap',
    }),
};

// ── Component ─────────────────────────────────────────────────────────────────
const BookingSlot = () => {
    const { doctorId }  = useParams();
    const navigate      = useNavigate();
    const location      = useLocation();

    // Jika ada rescheduleId di query string → mode reschedule (bukan booking baru)
    const rescheduleId  = new URLSearchParams(location.search).get('rescheduleId') || null;

    const [doctor, setDoctor]         = useState(null);
    const [slots, setSlots]           = useState([]);
    const [grouped, setGrouped]       = useState({});
    const [activeDateIdx, setActiveDateIdx] = useState(0);
    const [selectedSlot, setSelectedSlot]   = useState(null);
    const [consultType, setConsultType]     = useState('chat');
    const [symptoms, setSymptoms]     = useState('');
    const [medHistory, setMedHistory] = useState('');
    const [attachments, setAttachments] = useState([]); // { file, name, size, type }
    const [loading, setLoading]       = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [noAvailability, setNoAvailability] = useState(false);
    const [notReleasedMsg, setNotReleasedMsg] = useState('');
    const fileInputRef = React.useRef(null);

    // Fetch doctor & slots
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [docRes, slotRes] = await Promise.all([
                api.get(`/api/doctors/${doctorId}`),
                api.get(`/api/availability/slots/${doctorId}`),
            ]);
            setDoctor(docRes.data);

            const allSlots = slotRes.data.slots || [];
            if (slotRes.data.notReleased) {
                setNotReleasedMsg(slotRes.data.message || 'Dokter belum merilis jadwal untuk minggu ini. Silakan cek kembali beberapa saat lagi.');
                setNoAvailability(true);
            } else if (allSlots.length === 0) {
                setNotReleasedMsg('');
                setNoAvailability(true);
            } else {
                setNotReleasedMsg('');
                setSlots(allSlots);
                const g = groupByDate(allSlots);
                setGrouped(g);
                setActiveDateIdx(0);
            }
        } catch (err) {
            if (err.response?.status === 404 || err.response?.data?.message?.includes('belum')) {
                setNoAvailability(true);
            } else {
                toast.error('Gagal memuat data dokter');
            }
        } finally {
            setLoading(false);
        }
    }, [doctorId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const dates    = Object.keys(grouped);
    const activeDate = dates[activeDateIdx];
    const daySlots = grouped[activeDate] || [];

    const handleFileAdd = (e) => {
        const files = Array.from(e.target.files);
        const allowed = ['image/jpeg','image/jpg','image/png','image/gif','image/webp','application/pdf'];
        const MAX_SIZE = 10 * 1024 * 1024; // 10MB
        const remaining = 5 - attachments.length;
        if (remaining <= 0) { toast.error('Maksimal 5 lampiran'); return; }
        const toAdd = files.slice(0, remaining).filter(f => {
            if (!allowed.includes(f.type)) { toast.error(`${f.name}: tipe file tidak didukung (hanya gambar/PDF)`); return false; }
            if (f.size > MAX_SIZE) { toast.error(`${f.name}: ukuran melebihi 10MB`); return false; }
            return true;
        });
        setAttachments(prev => [...prev, ...toAdd.map(f => ({ file: f, name: f.name, size: f.size, type: f.type }))]);
        e.target.value = '';
    };
    const removeAttachment = (idx) => setAttachments(prev => prev.filter((_,i) => i !== idx));
    const fmtSize = (b) => b < 1024*1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/1024/1024).toFixed(1)} MB`;

    const handleSubmit = async () => {
        if (!selectedSlot) return toast.error('Pilih slot waktu terlebih dahulu');
        if (!rescheduleId && !symptoms.trim()) return toast.error('Keluhan wajib diisi');

        setSubmitting(true);
        try {
            if (rescheduleId) {
                // ── Mode Reschedule ────────────────────────────────────────────
                await api.put(`/api/consultations/${rescheduleId}/reschedule`, {
                    scheduledAt  : selectedSlot.startUtc,
                    scheduledEnd : selectedSlot.endUtc,
                });
                toast.success('Jadwal konsultasi berhasil diubah ✅');
                navigate('/consultations');
                return;
            }

            // ── Mode Booking Baru ──────────────────────────────────────────────
            // Step 1: Buat konsultasi (lock slot)
            const fd = new FormData();
            fd.append('doctorId', doctorId);
            fd.append('consultationType', consultType);
            fd.append('scheduledAt',  selectedSlot.startUtc);
            fd.append('scheduledEnd', selectedSlot.endUtc);
            fd.append('symptoms', symptoms);
            fd.append('medicalHistory', medHistory);
            attachments.forEach(a => fd.append('attachments', a.file));

            const createRes = await api.post('/api/consultations/create', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const { consultation } = createRes.data;

            // Step 2: Buat Xendit invoice
            const payRes = await api.post(`/api/consultations/${consultation._id}/initiate-payment`);

            if (payRes.data.invoiceUrl) {
                toast.success('Slot berhasil dikunci! Mengarahkan ke halaman pembayaran...');
                // Redirect ke Xendit
                setTimeout(() => { window.location.href = payRes.data.invoiceUrl; }, 1000);
            } else {
                throw new Error('Gagal mendapatkan URL pembayaran');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            if (err.response?.status === 409) {
                toast.error('Slot ini baru saja diambil orang lain. Pilih slot lain.');
                fetchData(); // Refresh slot
                setSelectedSlot(null);
            } else {
                toast.error('Gagal booking: ' + msg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTop: '4px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ color: '#6b7280', fontSize: 14 }}>Memuat jadwal dokter...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        </div>
    );

    return (
        <div style={S.page}>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>

                {/* Back button */}
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ← Kembali
                </button>

                {/* Doctor Info */}
                {doctor && (
                    <div style={{ ...S.card, display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                            👨‍⚕️
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>{fmtDoctorName(doctor)}</div>
                            <div style={{ fontSize: 13, color: '#6b7280' }}>{doctor.specialization}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#059669', marginTop: 4 }}>
                                {fmtRupiah(doctor.consultationFee)} / sesi
                            </div>
                        </div>
                    </div>
                )}

                {noAvailability ? (
                    <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>{notReleasedMsg ? '📋' : '📅'}</div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#374151', marginBottom: 8 }}>
                            {notReleasedMsg ? 'Jadwal Belum Dirilis' : 'Jadwal Belum Tersedia'}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: 14 }}>
                            {notReleasedMsg || 'Dokter belum mengatur jadwal praktik atau tidak ada slot tersedia.'}
                        </div>
                        <button onClick={() => navigate(-1)} style={{ marginTop: 20, padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                            Kembali
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Banner mode reschedule */}
                        {rescheduleId && (
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 22 }}>🔄</span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1d4ed8' }}>Mode Reschedule</div>
                                    <div style={{ fontSize: 13, color: '#3b82f6' }}>Pilih jadwal baru di bawah. Tidak ada biaya tambahan — konsultasi sebelumnya sudah lunas.</div>
                                </div>
                            </div>
                        )}

                        {/* Tipe konsultasi — hanya untuk booking baru */}
                        {!rescheduleId && <div style={S.card}>
                            <div style={S.title}>Tipe Konsultasi</div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                {[{v:'chat', l:'💬 Chat'}, {v:'video_call', l:'📹 Video Call'}].map(t => (
                                    <button key={t.v} onClick={() => setConsultType(t.v)}
                                        style={{ ...S.dateTab(consultType === t.v), flex: 1, padding: '10px' }}>
                                        {t.l}
                                    </button>
                                ))}
                            </div>
                        </div>}

                        {/* Pilih Slot */}
                        <div style={S.card}>
                            <div style={S.title}>Pilih Jadwal</div>
                            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                                Durasi sesi: 30 menit · Slot tersedia 7 hari ke depan · Hanya slot hijau yang bisa dipilih
                            </div>

                            {/* Date tabs */}
                            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
                                {dates.map((date, idx) => (
                                    <button key={date} style={S.dateTab(activeDateIdx === idx)} onClick={() => { setActiveDateIdx(idx); setSelectedSlot(null); }}>
                                        {fmtDateLabel(date)}
                                    </button>
                                ))}
                            </div>

                            {/* Slots grid */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {daySlots.map(slot => {
                                    const isSel = selectedSlot?.startUtc === slot.startUtc;
                                    return (
                                        <button key={slot.startUtc}
                                            style={S.slot(slot.available, isSel, slot.isPast)}
                                            disabled={!slot.available}
                                            onClick={() => slot.available && setSelectedSlot(slot)}>
                                            {slot.startTime}
                                            {slot.isPast   && <span style={{ fontSize: 10, display: 'block', fontWeight: 400 }}>Lewat</span>}
                                            {slot.isBooked && !slot.isPast && <span style={{ fontSize: 10, display: 'block', fontWeight: 400 }}>Penuh</span>}
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedSlot && (
                                <div style={{ marginTop: 14, background: '#eff6ff', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>
                                    ✅ Dipilih: {fmtDateLabel(activeDate)}, {selectedSlot.startTime}–{selectedSlot.endTime} WIB
                                </div>
                            )}
                        </div>

                        {/* Keluhan — hanya untuk booking baru */}
                        {!rescheduleId && <div style={S.card}>
                            <div style={S.title}>Keluhan & Riwayat</div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={S.label}>Keluhan Utama <span style={{ color: '#ef4444' }}>*</span></label>
                                <textarea
                                    style={{ ...S.input, minHeight: 90 }}
                                    placeholder="Deskripsikan keluhan yang Anda rasakan..."
                                    value={symptoms}
                                    onChange={e => setSymptoms(e.target.value)}
                                />
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={S.label}>Riwayat Penyakit / Alergi (opsional)</label>
                                <textarea
                                    style={{ ...S.input, minHeight: 70 }}
                                    placeholder="Riwayat penyakit, obat yang sedang diminum, alergi, dll."
                                    value={medHistory}
                                    onChange={e => setMedHistory(e.target.value)}
                                />
                            </div>

                            {/* Lampiran */}
                            <div>
                                <label style={S.label}>
                                    Lampiran Medis (opsional)
                                    <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 12, marginLeft: 6 }}>
                                        Foto, hasil lab, atau dokumen (PDF/gambar, maks 5 file × 10MB)
                                    </span>
                                </label>

                                {/* File list */}
                                {attachments.length > 0 && (
                                    <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {attachments.map((a, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                                                <span style={{ fontSize: 18 }}>{a.type === 'application/pdf' ? '📄' : '🖼️'}</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 13, color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                                                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtSize(a.size)}</div>
                                                </div>
                                                <button onClick={() => removeAttachment(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {attachments.length < 5 && (
                                    <>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
                                            style={{ display: 'none' }}
                                            onChange={handleFileAdd}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', border: '1.5px dashed #d1d5db', borderRadius: 8, background: '#fafafa', color: '#6b7280', fontSize: 13, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                                            📎 Tambah Lampiran ({attachments.length}/5)
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>}

                        {/* Ringkasan & Bayar */}
                        <div style={S.card}>
                            <div style={S.title}>{rescheduleId ? 'Ringkasan Reschedule' : 'Ringkasan Booking'}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: '#374151', marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Dokter</span><strong>{fmtDoctorName(doctor)}</strong>
                                </div>
                                {!rescheduleId && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Tipe</span><strong>{consultType === 'chat' ? 'Chat' : 'Video Call'}</strong>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Jadwal Baru</span>
                                    <strong>{selectedSlot ? `${fmtDateLabel(activeDate)}, ${selectedSlot.startTime} WIB` : '—'}</strong>
                                </div>
                                {!rescheduleId && (
                                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, color: '#059669' }}>
                                        <span>Total</span><span>{fmtRupiah(doctor?.consultationFee)}</span>
                                    </div>
                                )}
                                {rescheduleId && (
                                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, color: '#2563eb' }}>
                                        <span>Biaya Tambahan</span><span>Gratis</span>
                                    </div>
                                )}
                            </div>

                            {rescheduleId ? (
                                <div style={{ background: '#eff6ff', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1d4ed8', marginBottom: 16 }}>
                                    🔄 Mode Reschedule — Tidak ada biaya tambahan. Konsultasi sebelumnya tetap aktif.
                                </div>
                            ) : (
                                <div style={{ background: '#fefce8', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', marginBottom: 16 }}>
                                    ⏱ Slot akan dikunci selama <strong>15 menit</strong> setelah klik bayar. Selesaikan pembayaran sebelum waktu habis.
                                </div>
                            )}

                            <button
                                style={S.btnPrimary(!selectedSlot || (!rescheduleId && !symptoms.trim()) || submitting)}
                                disabled={!selectedSlot || (!rescheduleId && !symptoms.trim()) || submitting}
                                onClick={handleSubmit}>
                                {submitting
                                    ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} /> Memproses...</>
                                    : rescheduleId ? '🔄 Konfirmasi Jadwal Baru' : '🔒 Kunci Slot & Bayar via Xendit'}
                            </button>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BookingSlot;