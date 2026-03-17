/**
 * frontend/src/pages/user/Appointments.js
 * Halaman Janji Temu untuk user:
 *  - Pilih dokter → pilih tanggal → pilih slot → booking
 *  - Lihat daftar janji aktif & riwayat
 *  - Cancel & Reschedule
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDT = (dateStr, timeStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const tgl = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    return timeStr ? `${tgl}, ${timeStr} WIB` : tgl;
};

const STATUS_CFG = {
    scheduled           : { label: '📅 Terjadwal',          color: '#1d4ed8', bg: '#eff6ff' },
    checked_in          : { label: '✅ Hadir',               color: '#166534', bg: '#dcfce7' },
    completed           : { label: '🏁 Selesai',             color: '#0e7490', bg: '#ecfeff' },
    no_show             : { label: '❌ Tidak Hadir',          color: '#b45309', bg: '#fffbeb' },
    cancelled_by_user   : { label: '🚫 Dibatalkan (Anda)',   color: '#6b7280', bg: '#f3f4f6' },
    cancelled_by_doctor : { label: '🚫 Dibatalkan Dokter',   color: '#b91c1c', bg: '#fef2f2' },
    cancelled_by_admin  : { label: '🚫 Dibatalkan Admin',    color: '#b91c1c', bg: '#fef2f2' },
};

const StatusBadge = ({ status }) => {
    const c = STATUS_CFG[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
    return (
        <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}30`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
            {c.label}
        </span>
    );
};

// ── Derive hari praktik dari schedule Map (key '1'–'5') ──────────────────────
function getPracticeDays(availability) {
    if (!availability) return [1,2,3,4,5,6];
    // availability.practiceDays (lama) atau dari schedule Map baru
    if (availability.practiceDays) return availability.practiceDays;
    if (availability.schedule) {
        return Object.entries(availability.schedule)
            .filter(([, slots]) => Array.isArray(slots) && slots.length > 0)
            .map(([day]) => Number(day));
    }
    return [1,2,3,4,5,6];
}

// ── Generate tanggal praktik dari rentang weekStart–weekEnd ──────────────────
// Menampilkan semua hari dalam rentang yang ada di practiceDays.
// Hari ini (offset=0) ditampilkan jika masih dalam rentang.
// Hari Minggu (dow=0) selalu diskip.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function generateAvailableDates(practiceDays = [1,2,3,4,5,6], weekStart = null, weekEnd = null) {
    const dates  = [];
    const nowWIB = new Date(Date.now() + WIB_OFFSET_MS);

    // Tentukan rentang: jika weekStart/weekEnd tersedia gunakan itu, else fallback 7 hari
    const startMs = weekStart ? new Date(weekStart).getTime() + WIB_OFFSET_MS : nowWIB.getTime();
    const endMs   = weekEnd   ? new Date(weekEnd).getTime()   + WIB_OFFSET_MS : nowWIB.getTime() + 7 * 24 * 60 * 60 * 1000;

    let cursor = new Date(Math.max(startMs, nowWIB.getTime())); // mulai dari hari ini atau weekStart, mana yang lebih baru
    // Set cursor ke awal hari (UTC midnight WIB)
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()));

    while (cursor.getTime() <= endMs) {
        const dow = cursor.getUTCDay();
        if (dow !== 0 && practiceDays.includes(dow)) {
            const y  = cursor.getUTCFullYear();
            const mo = String(cursor.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(cursor.getUTCDate()).padStart(2, '0');
            dates.push(`${y}-${mo}-${dd}`);
        }
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
    return dates;
}

// Semua batas (cancel & reschedule) adalah h-24 jam sebelum jadwal
const CANCEL_DEADLINE_MS = 24 * 60 * 60 * 1000;

function canCancel(scheduledAt) {
    return new Date(scheduledAt).getTime() - Date.now() > CANCEL_DEADLINE_MS;
}
function canReschedule(scheduledAt) {
    return new Date(scheduledAt).getTime() - Date.now() > CANCEL_DEADLINE_MS;
}

// Format deadline: "Senin, 23 Jun 2025 pukul 09:00 WIB"
function fmtDeadline(scheduledAt) {
    const dl = new Date(new Date(scheduledAt).getTime() - CANCEL_DEADLINE_MS);
    return dl.toLocaleString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    }) + ' WIB';
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT UTAMA
// ═══════════════════════════════════════════════════════════════════════════════
const Appointments = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [tab, setTab] = useState('book'); // 'book' | 'my'
    const [doctors, setDoctors] = useState([]);
    const [myAppointments, setMyAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Booking form state
    const [selectedDoctor,    setSelectedDoctor]    = useState(null);
    const [selectedDate,      setSelectedDate]      = useState('');
    const [selectedSlot,      setSelectedSlot]      = useState(null);
    const [complaint,         setComplaint]         = useState('');
    const [slots,             setSlots]             = useState([]);
    const [loadingSlots,      setLoadingSlots]      = useState(false);
    const [booking,           setBooking]           = useState(false);

    // Cancel modal
    const [cancelTarget,   setCancelTarget]   = useState(null);
    const [cancelReason,   setCancelReason]   = useState('');
    const [cancelling,     setCancelling]     = useState(false);

    // Reschedule modal
    const [reschedTarget,  setReschedTarget]  = useState(null);
    const [reschedDate,    setReschedDate]    = useState('');
    const [reschedSlot,    setReschedSlot]    = useState(null);
    const [reschedSlots,   setReschedSlots]   = useState([]);
    const [reschedLoading, setReschedLoading] = useState(false);
    const [rescheduling,   setRescheduling]   = useState(false);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        fetchDoctors();
        fetchMyAppointments();
    }, [user]);

    const fetchDoctors = async () => {
        try {
            const r = await api.get('/api/appointments/doctors-with-slots');
            setDoctors(r.data.doctors || []);
        } catch { toast.error('Gagal memuat daftar dokter'); }
    };

    const fetchMyAppointments = async () => {
        setLoading(true);
        try {
            const r = await api.get('/api/appointments/my');
            setMyAppointments(r.data.appointments || []);
        } catch { toast.error('Gagal memuat janji temu'); }
        finally { setLoading(false); }
    };

    // ── Fetch slots saat tanggal & dokter dipilih ──────────────────────────
    const fetchSlots = useCallback(async (doctorId, date) => {
        if (!doctorId || !date) return;
        setLoadingSlots(true);
        setSelectedSlot(null);
        try {
            const r = await api.get(`/api/appointments/slots/${doctorId}?date=${date}`);
            setSlots(r.data.slots || []);
        } catch { toast.error('Gagal memuat slot waktu'); }
        finally { setLoadingSlots(false); }
    }, []);

    useEffect(() => {
        if (selectedDoctor && selectedDate) {
            fetchSlots(selectedDoctor.doctor._id, selectedDate);
        } else {
            setSlots([]);
            setSelectedSlot(null);
        }
    }, [selectedDoctor, selectedDate, fetchSlots]);

    // ── Booking ────────────────────────────────────────────────────────────
    const handleBook = async () => {
        if (!selectedDoctor || !selectedDate || !selectedSlot) {
            toast.error('Pilih dokter, tanggal, dan slot waktu terlebih dahulu');
            return;
        }
        setBooking(true);
        try {
            await api.post('/api/appointments/book', {
                doctorId  : selectedDoctor.doctor._id,
                date      : selectedDate,
                time      : selectedSlot.startTime,
                complaint : complaint.trim(),
            });
            toast.success('Janji temu berhasil dibuat! ✅');
            setSelectedDoctor(null);
            setSelectedDate('');
            setSelectedSlot(null);
            setComplaint('');
            setSlots([]);
            fetchMyAppointments();
            setTab('my');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal membuat janji temu');
        } finally { setBooking(false); }
    };

    // ── Cancel ─────────────────────────────────────────────────────────────
    const handleCancelSubmit = async () => {
        if (!cancelReason.trim() || cancelReason.trim().length < 5) {
            toast.error('Alasan minimal 5 karakter');
            return;
        }
        setCancelling(true);
        try {
            await api.put(`/api/appointments/${cancelTarget._id}/cancel`, { reason: cancelReason });
            toast.success('Janji temu dibatalkan');
            setCancelTarget(null);
            setCancelReason('');
            fetchMyAppointments();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal membatalkan');
        } finally { setCancelling(false); }
    };

    // ── Reschedule — fetch slots ───────────────────────────────────────────
    useEffect(() => {
        if (reschedTarget && reschedDate) {
            setReschedLoading(true);
            setReschedSlot(null);
            api.get(`/api/appointments/slots/${reschedTarget.doctorId._id}?date=${reschedDate}`)
                .then(r => setReschedSlots(r.data.slots || []))
                .catch(() => toast.error('Gagal memuat slot'))
                .finally(() => setReschedLoading(false));
        }
    }, [reschedTarget, reschedDate]);

    const handleReschedSubmit = async () => {
        if (!reschedDate || !reschedSlot) { toast.error('Pilih tanggal dan slot baru'); return; }
        setRescheduling(true);
        try {
            await api.put(`/api/appointments/${reschedTarget._id}/reschedule`, {
                date : reschedDate,
                time : reschedSlot.startTime,
            });
            toast.success('Jadwal berhasil diubah ✅');
            setReschedTarget(null);
            setReschedDate('');
            setReschedSlot(null);
            fetchMyAppointments();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal reschedule');
        } finally { setRescheduling(false); }
    };

    // ── Styles ─────────────────────────────────────────────────────────────
    const s = {
        root   : { minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif", padding: '24px 16px' },
        inner  : { maxWidth: 820, margin: '0 auto' },
        card   : { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 16 },
        label  : { color: '#374151', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 },
        input  : { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#111827', outline: 'none', background: '#fff', boxSizing: 'border-box' },
        btn    : (bg) => ({ padding: '10px 20px', background: bg, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }),
        btnOut : { padding: '10px 20px', background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' },
    };

    const activeTab = (key) => ({
        flex: 1, padding: '10px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
        background: tab === key ? '#fff' : 'transparent',
        color: tab === key ? '#111827' : '#6b7280',
        boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
    });

    // ── Available dates for reschedule ─────────────────────────────────────
    const reschedDates = reschedTarget
        ? generateAvailableDates(
            getPracticeDays(reschedTarget.doctorId?.availability),
            reschedTarget.doctorId?.availability?.weekStart,
            reschedTarget.doctorId?.availability?.weekEnd
          )
        : [];

    const activeAppts  = myAppointments.filter(a => ['scheduled','checked_in'].includes(a.status));
    const historyAppts = myAppointments.filter(a => !['scheduled','checked_in'].includes(a.status));

    return (
        <div style={s.root}>
            <div style={s.inner}>

                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Janji Temu Offline</h1>
                    <p style={{ color: '#6b7280', fontSize: 14 }}>Buat dan kelola janji temu Anda di klinik</p>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 24 }}>
                    <button style={activeTab('book')} onClick={() => setTab('book')}>📅 Buat Janji</button>
                    <button style={activeTab('my')}   onClick={() => setTab('my')}>
                        📋 Janji Saya
                        {activeAppts.length > 0 && (
                            <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{activeAppts.length}</span>
                        )}
                    </button>
                </div>

                {/* ═══ TAB: BUAT JANJI ═════════════════════════════════════ */}
                {tab === 'book' && (
                    <>
                        {/* Step 1: Pilih Dokter */}
                        <div style={s.card}>
                            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: '#111827' }}>1️⃣ Pilih Dokter</div>
                            {doctors.length === 0 ? (
                                <div style={{ color: '#6b7280', fontSize: 14 }}>Belum ada dokter yang membuka jadwal janji temu offline.</div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 12 }}>
                                    {doctors.map(({ doctor, availability }) => (
                                        <div
                                            key={doctor._id}
                                            onClick={() => { setSelectedDoctor({ doctor, availability }); setSelectedDate(''); setSelectedSlot(null); setSlots([]); }}
                                            style={{
                                                border: `2px solid ${selectedDoctor?.doctor._id === doctor._id ? '#2563eb' : '#e5e7eb'}`,
                                                borderRadius: 12, padding: 14, cursor: 'pointer',
                                                background: selectedDoctor?.doctor._id === doctor._id ? '#eff6ff' : '#fff',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e5e7eb', overflow: 'hidden', flexShrink: 0 }}>
                                                    {doctor.photo
                                                        ? <img src={`${API_URL}${doctor.photo}`} alt={doctor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👨‍⚕️</div>
                                                    }
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>dr. {doctor.name}</div>
                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>{doctor.specialization}</div>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af' }}>
                                                {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].filter((_, i) => getPracticeDays(availability).includes(i)).join(', ')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Step 2: Pilih Tanggal */}
                        {selectedDoctor && (
                            <div style={s.card}>
                                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: '#111827' }}>2️⃣ Pilih Tanggal</div>
                                {!selectedDoctor.availability?.weekStart ? (
                                    <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e' }}>
                                        ⚠️ Dokter belum merilis jadwal untuk minggu ini. Silakan cek kembali beberapa saat lagi.
                                    </div>
                                ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {generateAvailableDates(
                                        getPracticeDays(selectedDoctor.availability),
                                        selectedDoctor.availability?.weekStart,
                                        selectedDoctor.availability?.weekEnd
                                    ).map(dateStr => {
                                        const [y, mo, d] = dateStr.split('-').map(Number);
                                        const dateObj = new Date(Date.UTC(y, mo - 1, d));
                                        const label   = dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
                                        const active  = selectedDate === dateStr;
                                        return (
                                            <button
                                                key={dateStr}
                                                onClick={() => setSelectedDate(dateStr)}
                                                style={{
                                                    padding: '8px 14px', borderRadius: 8, border: `2px solid ${active ? '#2563eb' : '#e5e7eb'}`,
                                                    background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#374151',
                                                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                                                }}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                                )}
                            </div>
                        )}

                        {/* Step 3: Pilih Slot */}
                        {selectedDoctor && selectedDate && (
                            <div style={s.card}>
                                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: '#111827' }}>3️⃣ Pilih Waktu</div>
                                {loadingSlots ? (
                                    <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat slot...</div>
                                ) : slots.length === 0 ? (
                                    <div style={{ color: '#6b7280', fontSize: 14 }}>Tidak ada slot tersedia untuk tanggal ini.</div>
                                ) : (
                                    <>
                                        {/* Pagi */}
                                        {slots.some(s => parseInt(s.startTime) < 12) && (
                                            <div style={{ marginBottom: 14 }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase' }}>☀️ Pagi</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                    {slots.filter(sl => parseInt(sl.startTime) < 12).map(sl => (
                                                        <SlotBtn key={sl.startTime} slot={sl} selected={selectedSlot?.startTime === sl.startTime} onSelect={setSelectedSlot} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {/* Sore */}
                                        {slots.some(s => parseInt(s.startTime) >= 13) && (
                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase' }}>🌤️ Siang/Sore</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                    {slots.filter(sl => parseInt(sl.startTime) >= 13).map(sl => (
                                                        <SlotBtn key={sl.startTime} slot={sl} selected={selectedSlot?.startTime === sl.startTime} onSelect={setSelectedSlot} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* Step 4: Keluhan & Konfirmasi */}
                        {selectedDoctor && selectedDate && selectedSlot && (
                            <div style={s.card}>
                                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: '#111827' }}>4️⃣ Keluhan & Konfirmasi</div>

                                {/* Ringkasan */}
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: '#166534', marginBottom: 6 }}>Ringkasan Janji Temu</div>
                                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
                                        <div>👨‍⚕️ <strong>Dokter</strong>: dr. {selectedDoctor.doctor.name} ({selectedDoctor.doctor.specialization})</div>
                                        <div>📅 <strong>Tanggal</strong>: {(() => { const [y,m,d] = selectedDate.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)).toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }); })()}</div>
                                        <div>🕐 <strong>Waktu</strong>: {selectedSlot.startTime} – {selectedSlot.endTime} WIB</div>
                                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>📍 Hadir langsung ke klinik dan tunjukkan nama Anda ke admin</div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: 16 }}>
                                    <label style={s.label}>Keluhan Singkat (opsional)</label>
                                    <textarea
                                        value={complaint} rows={3}
                                        onChange={e => setComplaint(e.target.value)}
                                        placeholder="Contoh: sakit kepala, demam 2 hari, nyeri perut..."
                                        style={{ ...s.input, resize: 'vertical' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={() => { setSelectedSlot(null); }} style={s.btnOut}>← Ubah Waktu</button>
                                    <button onClick={handleBook} disabled={booking} style={{ ...s.btn('#16a34a'), flex: 1, opacity: booking ? 0.6 : 1 }}>
                                        {booking ? 'Memproses...' : '✅ Konfirmasi Janji Temu'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ═══ TAB: JANJI SAYA ═════════════════════════════════════ */}
                {tab === 'my' && (
                    <>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Memuat...</div>
                        ) : myAppointments.length === 0 ? (
                            <div style={{ ...s.card, textAlign: 'center', padding: 40 }}>
                                <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
                                <div style={{ color: '#6b7280' }}>Belum ada janji temu</div>
                                <button onClick={() => setTab('book')} style={{ ...s.btn('#2563eb'), marginTop: 16 }}>Buat Janji Sekarang</button>
                            </div>
                        ) : (
                            <>
                                {activeAppts.length > 0 && (
                                    <div style={{ marginBottom: 24 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Janji Aktif</div>
                                        {activeAppts.map(a => (
                                            <AppointmentCard
                                                key={a._id} appt={a}
                                                onCancel={() => { setCancelTarget(a); setCancelReason(''); }}
                                                onReschedule={() => { setReschedTarget(a); setReschedDate(''); setReschedSlot(null); setReschedSlots([]); }}
                                            />
                                        ))}
                                    </div>
                                )}
                                {historyAppts.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Riwayat</div>
                                        {historyAppts.map(a => <AppointmentCard key={a._id} appt={a} />)}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* ── Cancel Modal ────────────────────────────────────────────── */}
            {cancelTarget && (
                <Modal onClose={() => setCancelTarget(null)} title="❌ Batalkan Janji Temu">
                    <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>
                        Janji dengan dr. {cancelTarget.doctorId?.name} pada {cancelTarget.appointmentTime} WIB akan dibatalkan. Tindakan ini tidak bisa dibatalkan.
                    </div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Alasan Pembatalan *</label>
                    <textarea
                        value={cancelReason} rows={3}
                        onChange={e => setCancelReason(e.target.value)}
                        placeholder="Masukkan alasan pembatalan..."
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button onClick={() => setCancelTarget(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
                        <button onClick={handleCancelSubmit} disabled={cancelling}
                            style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: cancelling ? 0.6 : 1 }}>
                            {cancelling ? 'Memproses...' : 'Konfirmasi Pembatalan'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── Reschedule Modal ─────────────────────────────────────────── */}
            {reschedTarget && (
                <Modal onClose={() => setReschedTarget(null)} title="🔄 Ubah Jadwal Janji">
                    <div style={{ marginBottom: 16, fontSize: 13, color: '#6b7280' }}>
                        Jadwal saat ini: <strong>{reschedTarget.appointmentTime} WIB</strong>, dr. {reschedTarget.doctorId?.name}
                    </div>

                    {/* Pilih tanggal baru */}
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Pilih Tanggal Baru</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {reschedDates.map(dateStr => {
                                const [y, mo, d] = dateStr.split('-').map(Number);
                                const label = new Date(Date.UTC(y, mo-1, d)).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
                                return (
                                    <button key={dateStr} onClick={() => setReschedDate(dateStr)}
                                        style={{ padding: '6px 12px', borderRadius: 8, border: `2px solid ${reschedDate === dateStr ? '#2563eb' : '#e5e7eb'}`, background: reschedDate === dateStr ? '#2563eb' : '#fff', color: reschedDate === dateStr ? '#fff' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Pilih slot baru */}
                    {reschedDate && (
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Pilih Waktu Baru</label>
                            {reschedLoading ? (
                                <div style={{ color: '#6b7280', fontSize: 13 }}>Memuat slot...</div>
                            ) : reschedSlots.length === 0 ? (
                                <div style={{ color: '#6b7280', fontSize: 13 }}>Tidak ada slot tersedia</div>
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {reschedSlots.map(sl => (
                                        <SlotBtn key={sl.startTime} slot={sl} selected={reschedSlot?.startTime === sl.startTime} onSelect={setReschedSlot} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setReschedTarget(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
                        <button onClick={handleReschedSubmit} disabled={rescheduling || !reschedDate || !reschedSlot}
                            style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: (!reschedDate || !reschedSlot || rescheduling) ? 0.5 : 1 }}>
                            {rescheduling ? 'Memproses...' : '✅ Konfirmasi Perubahan'}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// ── Sub-components ────────────────────────────────────────────────────────────
const SlotBtn = ({ slot, selected, onSelect }) => (
    <button
        disabled={!slot.available}
        onClick={() => slot.available && onSelect(slot)}
        style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: slot.available ? 'pointer' : 'not-allowed',
            border: `2px solid ${selected ? '#2563eb' : slot.available ? '#e5e7eb' : '#f3f4f6'}`,
            background: selected ? '#2563eb' : slot.available ? '#fff' : '#f9fafb',
            color: selected ? '#fff' : slot.available ? '#374151' : '#9ca3af',
            textDecoration: slot.isPast ? 'line-through' : 'none',
        }}
    >
        {slot.startTime}
        {!slot.available && <span style={{ fontSize: 10, marginLeft: 4 }}>{slot.isPast ? '(lewat)' : '(penuh)'}</span>}
    </button>
);

const AppointmentCard = ({ appt, onCancel, onReschedule }) => {
    const doc  = appt.doctorId;
    const isActive = ['scheduled','checked_in'].includes(appt.status);
    const showActions = appt.status === 'scheduled';
    const canAct = showActions && canCancel(appt.scheduledAt);

    return (
        <div style={{
            background: '#fff', border: `1px solid ${appt.status === 'checked_in' ? '#86efac' : '#e5e7eb'}`,
            borderRadius: 12, padding: '16px 20px', marginBottom: 10,
            borderLeft: `4px solid ${STATUS_CFG[appt.status]?.color || '#e5e7eb'}`,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>dr. {doc?.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{doc?.specialization}</div>
                </div>
                <StatusBadge status={appt.status} />
            </div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: appt.complaint ? 8 : 0 }}>
                📅 {fmtDT(appt.appointmentDate, appt.appointmentTime)}
            </div>
            {appt.complaint && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Keluhan: {appt.complaint}</div>}
            {appt.doctorNotes && <div style={{ fontSize: 12, color: '#374151', background: '#f9fafb', padding: '6px 10px', borderRadius: 6 }}>📝 Catatan Dokter: {appt.doctorNotes}</div>}
            {appt.cancelReason && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 6 }}>Alasan: {appt.cancelReason}</div>}

            {/* Timer deadline — tampilkan selama jadwal belum lewat */}
            {showActions && appt.scheduledAt && (
                <div style={{
                    marginTop: 10, padding: '8px 12px', borderRadius: 8,
                    background: canAct ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${canAct ? '#bbf7d0' : '#fecaca'}`,
                    fontSize: 12, color: canAct ? '#166534' : '#b91c1c',
                }}>
                    {canAct
                        ? <>⏰ Anda dapat mengubah atau membatalkan jadwal ini hingga: <strong>{fmtDeadline(appt.scheduledAt)}</strong></>
                        : <>🔒 Batas perubahan/pembatalan telah lewat ({fmtDeadline(appt.scheduledAt)})</>
                    }
                </div>
            )}

            {isActive && (onCancel || onReschedule) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {onReschedule && showActions && canAct && (
                        <button onClick={onReschedule}
                            style={{ padding: '6px 14px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            🔄 Reschedule
                        </button>
                    )}
                    {onCancel && showActions && canAct && (
                        <button onClick={onCancel}
                            style={{ padding: '6px 14px', background: '#fff', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            ❌ Batalkan
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const Modal = ({ children, onClose, title }) => (
    <div style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{title}</span>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            {children}
        </div>
    </div>
);

export default Appointments;