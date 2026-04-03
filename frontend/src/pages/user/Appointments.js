/**
 * frontend/src/pages/user/Appointments.js
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import io from 'socket.io-client';
import { FaStar, FaStarHalfAlt, FaRegStar } from 'react-icons/fa';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ── Helpers ───────────────────────────────────────────────────────────────────
const WIB_OFFSET        = 7 * 60 * 60 * 1000;
const DAY_NAMES         = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const CANCEL_DEADLINE_MS = 24 * 60 * 60 * 1000;

const fmtDT = (dateStr, timeStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const tgl = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    return timeStr ? `${tgl}, ${timeStr} WIB` : tgl;
};

const fmtDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(Date.UTC(y, m - 1, d) - WIB_OFFSET);
    const wib = new Date(dateObj.getTime() + WIB_OFFSET);
    return `${DAY_NAMES[wib.getUTCDay()]}, ${parseInt(d, 10)}/${parseInt(m, 10)}`;
};

const fmtDeadline = (scheduledAt) => {
    const dl = new Date(new Date(scheduledAt).getTime() - CANCEL_DEADLINE_MS);
    return dl.toLocaleString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    }) + ' WIB';
};

const canCancelOrReschedule = (scheduledAt) =>
    new Date(scheduledAt).getTime() - Date.now() > CANCEL_DEADLINE_MS;

const groupByDate = (slotsArr) => {
    const map = {};
    for (const s of slotsArr) {
        if (!map[s.date]) map[s.date] = [];
        map[s.date].push(s);
    }
    return map;
};

// ── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
    scheduled           : { label: '📅 Terjadwal',          color: '#1d4ed8', bg: '#eff6ff' },
    checked_in          : { label: '✅ Hadir',              color: '#166534', bg: '#dcfce7' },
    completed           : { label: '🏁 Selesai',            color: '#4b5563', bg: '#f3f4f6' },
    no_show             : { label: '⚠️ Tidak Hadir',        color: '#9a3412', bg: '#fef3c7' },
    cancelled_by_user   : { label: '❌ Batal (Pasien)',     color: '#b91c1c', bg: '#fef2f2' },
    cancelled_by_doctor : { label: '❌ Batal (Dokter)',     color: '#b91c1c', bg: '#fef2f2' },
    cancelled_by_admin  : { label: '❌ Batal (Admin)',      color: '#b91c1c', bg: '#fef2f2' },
    doctor_no_show      : { label: '😔 Dokter Tdk Hadir',  color: '#b91c1c', bg: '#fef2f2' },
};

// ── StarRating (display only) ─────────────────────────────────────────────────
const StarRating = ({ value = 0 }) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        if (value >= i)            stars.push(<FaStar key={i} className="text-warning" />);
        else if (value >= i - 0.5) stars.push(<FaStarHalfAlt key={i} className="text-warning" />);
        else                       stars.push(<FaRegStar key={i} className="text-warning" />);
    }
    return <span>{stars}</span>;
};

// ── Reusable Modal ────────────────────────────────────────────────────────────
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

// ── Card wrapper ──────────────────────────────────────────────────────────────
const Card = ({ children }) => (
    <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-4">{children}</div>
    </div>
);

// ── RatingModal — hanya bintang, tanpa komentar ───────────────────────────────
const RatingModal = ({ appointmentId, doctorName, onClose, onSuccess }) => {
    const [rating, setRating]   = useState(0);
    const [hovered, setHovered] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!rating) { toast.error('Pilih rating terlebih dahulu'); return; }
        setSubmitting(true);
        try {
            await api.post(`/api/appointments/${appointmentId}/rating`, { rating });
            toast.success('Terima kasih atas rating Anda!');
            onSuccess(); onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal kirim rating');
        } finally { setSubmitting(false); }
    };

    return (
        <Modal title="⭐ Beri Rating" onClose={onClose} maxWidth={380}>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
                Bagaimana pengalaman janji temu dengan dr. {doctorName}?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
                {[1,2,3,4,5].map(i => (
                    <span key={i}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(0)}
                        onClick={() => setRating(i)}
                        style={{ fontSize: 40, cursor: 'pointer', transition: 'transform 0.1s', transform: i <= (hovered || rating) ? 'scale(1.25)' : 'scale(1)' }}>
                        {i <= (hovered || rating) ? '⭐' : '☆'}
                    </span>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose}
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>
                    Batal
                </button>
                <button onClick={handleSubmit} disabled={!rating || submitting}
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#854d0e,#ca8a04)', color: '#fff', fontWeight: 700, cursor: rating ? 'pointer' : 'not-allowed', opacity: rating ? 1 : 0.5 }}>
                    {submitting ? 'Mengirim...' : 'Kirim Rating'}
                </button>
            </div>
        </Modal>
    );
};

// ── ApptCard ──────────────────────────────────────────────────────────────────
const ApptCard = ({ appt, onCancel, onReschedule, onRate, showActions }) => {
    const c = STATUS_CFG[appt.status] || { label: appt.status, color: '#6b7280', bg: '#f3f4f6' };
    const canAct         = appt.status === 'scheduled';
    const showDeadline   = appt.status === 'scheduled' && appt.scheduledAt;
    const canActDeadline = showDeadline && canCancelOrReschedule(appt.scheduledAt);
    
    // Rating terbuka untuk Selesai dan pembatalan sepihak (dokter/admin/no show)
    const canRate = ['completed', 'doctor_no_show', 'cancelled_by_doctor', 'cancelled_by_admin'].includes(appt.status) && !appt.rating;

    return (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, overflow: 'hidden', flexShrink: 0 }}>
                        {appt.doctorId?.photo
                            ? <img src={`${API_URL}${appt.doctorId.photo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : '🏥'}
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>dr. {appt.doctorId?.name || '-'}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{appt.doctorId?.specialization || 'Umum'}</div>
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
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Jadwal</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                            {fmtDT(appt.appointmentDate, appt.appointmentTime)}
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Keluhan</div>
                    <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>{appt.complaint || '—'}</div>
                </div>

                {/* Deadline cancel/reschedule */}
                {showDeadline && (
                    <div style={{
                        marginBottom: 14, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                        background: canActDeadline ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${canActDeadline ? '#bbf7d0' : '#fecaca'}`,
                        color: canActDeadline ? '#166534' : '#b91c1c',
                    }}>
                        {canActDeadline
                            ? <>⏰ Dapat diubah/dibatalkan hingga: <strong>{fmtDeadline(appt.scheduledAt)}</strong></>
                            : <>🔒 Batas perubahan/pembatalan telah lewat ({fmtDeadline(appt.scheduledAt)})</>}
                    </div>
                )}

                {appt.cancelReason && (
                    <div style={{ marginBottom: 14, padding: 10, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', fontSize: 12, color: '#991b1b' }}>
                        <strong>Alasan batal:</strong> {appt.cancelReason}
                    </div>
                )}

                {/* Rekam Medis */}
                {appt.medicalRecord?.isCompleted && (
                    <div style={{ marginTop: 4, paddingTop: 14, borderTop: '1px dashed #e5e7eb' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>
                            📋 Rekam Medis & Catatan Dokter
                        </div>
                        <div style={{ fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 8, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                            {appt.medicalRecord.assessment && <div><span style={{ fontWeight: 600, color: '#111827' }}>Diagnosis:</span><br />{appt.medicalRecord.assessment}</div>}
                            {appt.medicalRecord.plan && <div><span style={{ fontWeight: 600, color: '#111827' }}>Rencana Terapi:</span><br />{appt.medicalRecord.plan}</div>}
                            {appt.medicalRecord.doctorNotes && <div><span style={{ fontWeight: 600, color: '#111827' }}>Catatan Tambahan:</span><br />{appt.medicalRecord.doctorNotes}</div>}
                        </div>
                    </div>
                )}

                {/* Surat Sakit */}
                {appt.sickLetter && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13, color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div><strong>📄 Surat Keterangan Sakit</strong></div>
                        <a href={`${API_URL}/api/appointments/${appt._id}/sick-letter/pdf`} target="_blank" rel="noreferrer"
                            style={{ color: '#15803d', fontWeight: 700, textDecoration: 'none', background: '#dcfce7', padding: '4px 10px', borderRadius: 6 }}>
                            ⬇ Download PDF
                        </a>
                    </div>
                )}

                {/* Rating yang sudah diberikan */}
                {appt.rating && (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#6b7280', fontSize: 12 }}>Rating Anda: </span>
                        <StarRating value={appt.rating} />
                    </div>
                )}
            </div>

            {/* Action Bar */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f3f4f6', background: '#f9fafb', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {showActions && canAct && canActDeadline && (!appt.rescheduleCount || appt.rescheduleCount < 1) && onReschedule && (
                    <button onClick={onReschedule}
                        style={{ padding: '6px 14px', background: '#fff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        🔄 Reschedule
                    </button>
                )}
                {showActions && canAct && canActDeadline && onCancel && (
                    <button onClick={onCancel}
                        style={{ padding: '6px 14px', background: '#fff', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        ❌ Batalkan
                    </button>
                )}
                {canRate && onRate && (
                    <button onClick={onRate}
                        style={{ background: 'linear-gradient(135deg,#854d0e,#ca8a04)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        ⭐ Beri Rating
                    </button>
                )}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const Appointments = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('aktif');

    const [doctors, setDoctors]           = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading]           = useState(true);

    // Modal states
    const [modalLogin, setModalLogin]   = useState(false);
    const [ratingModal, setRatingModal] = useState(null); // { id, doctorName }

    // Booking
    const [modalBook, setModalBook]         = useState(false);
    const [bookDocId, setBookDocId]         = useState('');
    const [bookDocInfo, setBookDocInfo]     = useState(null);
    const [bookDate, setBookDate]           = useState('');
    const [bookTime, setBookTime]           = useState('');
    const [bookComplaint, setBookComplaint] = useState('');
    const [slots, setSlots]                 = useState([]);
    const [loadingSlots, setLoadingSlots]   = useState(false);
    const [booking, setBooking]             = useState(false);

    // Cancel
    const [modalCancel, setModalCancel]     = useState(false);
    const [cancelId, setCancelId]           = useState('');
    const [cancelReason, setCancelReason]   = useState('');
    const [cancelling, setCancelling]       = useState(false);

    // Reschedule
    const [modalReschedule, setModalReschedule] = useState(false);
    const [resId, setResId]       = useState('');
    const [resDate, setResDate]   = useState('');
    const [resTime, setResTime]   = useState('');
    const [resSlots, setResSlots] = useState([]);
    const [rescheduling, setRescheduling] = useState(false);


    // ── loadData ──────────────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const docRes = await api.get('/api/appointments/doctors-with-slots');
            setDoctors(docRes.data.doctors || []);

            if (user) {
                const apptRes = await api.get('/api/appointments/my');
                setAppointments(apptRes.data.appointments || []);
            }
        } catch {
            toast.error('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) setActiveTab('buat_janji');
        else setActiveTab('aktif');
        loadData();
    }, [user, loadData]);

    // Auto-refresh 10 detik saat ada appointment scheduled
    useEffect(() => {
        const hasPending = appointments.some(a => a.status === 'scheduled');
        if (!hasPending) return;
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, [appointments, loadData]);

    // Refresh saat window fokus
    useEffect(() => {
        if (!user) return;
        const onFocus = () => loadData();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [loadData, user]);

    // Socket.IO real-time
    useEffect(() => {
        if (!user) return;
        const sock = io(API_URL, {
            auth: { token: localStorage.getItem('token') },
            query: { userId: user.id },
        });
        sock.emit('join-user', user.id);
        
        sock.on('new-notification', (n) => {
            // Notifikasi Batal, Selesai, Dikonfirmasi
            if (n.type === 'appointment_cancelled') {
                toast.error(n.message || 'Janji temu dibatalkan', { icon: '🚫' });
            } else if (n.message) {
                toast.success(n.message);
            }

            if (['appointment_confirmed', 'appointment_cancelled', 'appointment_completed'].includes(n.type)) {
                loadData();
            }
        });
        sock.on('appointment-status-update', () => loadData());
        return () => sock.close();
    }, [user, loadData]);

    // ── Slot helpers ──────────────────────────────────────────────────────────
    const fetchSlots = async (docId) => {
        setLoadingSlots(true);
        setBookTime('');
        try {
            const r = await api.get('/api/appointments/slots/' + docId);
            const slotData = r.data.slots || [];
            setSlots(slotData);
            const dates = [...new Set(slotData.map(s => s.date))].sort();
            setBookDate(dates.length > 0 ? dates[0] : '');
        } catch {
            toast.error('Gagal memuat jadwal dokter');
            setSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    };

    const fetchSlotsRes = async (docId) => {
        setLoadingSlots(true);
        setResTime('');
        try {
            const r = await api.get('/api/appointments/slots/' + docId);
            setResSlots(r.data.slots || []);
            const dates = [...new Set((r.data.slots || []).map(s => s.date))].sort();
            setResDate(dates.length > 0 ? dates[0] : '');
        } catch {
            toast.error('Gagal memuat slot reschedule');
            setResSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    };

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleBookStart = (doc) => {
        if (!user) { setModalLogin(true); return; }
        const docId = doc.doctor?.id || doc._id;
        setBookDocId(docId);
        setBookDocInfo(doc.doctor || doc);
        setBookDate(''); setBookTime(''); setBookComplaint('');
        setModalBook(true);
        fetchSlots(docId);
    };

    const submitBooking = async () => {
        if (!bookDate || !bookTime) return toast.error('Pilih tanggal dan waktu terlebih dahulu');
        if (!bookComplaint.trim()) return toast.error('Mohon isi keluhan Anda');
        setBooking(true);
        try {
            await api.post('/api/appointments/book', {
                doctorId: bookDocId,
                date: bookDate,
                time: bookTime,
                complaint: bookComplaint,
            });
            toast.success('Janji temu berhasil dibuat!');
            setModalBook(false);
            setActiveTab('aktif');
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal membuat janji temu');
        } finally {
            setBooking(false);
        }
    };

    const handleCancelStart = (appt) => {
        setCancelId(appt._id);
        setCancelReason('');
        setModalCancel(true);
    };

    const submitCancel = async () => {
        if (cancelReason.trim().length < 5) return toast.error('Alasan minimal 5 karakter');
        setCancelling(true);
        try {
            await api.put(`/api/appointments/${cancelId}/cancel`, { reason: cancelReason });
            toast.success('Janji temu dibatalkan');
            setModalCancel(false);
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal membatalkan janji');
        } finally {
            setCancelling(false);
        }
    };

    const handleRescheduleStart = (appt) => {
        setResId(appt._id);
        const did = appt.doctorId?._id || appt.doctorId?.id || appt.doctorId;
        setResDate(''); setResTime('');
        setModalReschedule(true);
        fetchSlotsRes(did);
    };

    const submitReschedule = async () => {
        if (!resDate || !resTime) return toast.error('Pilih tanggal dan waktu baru');
        setRescheduling(true);
        try {
            await api.put(`/api/appointments/${resId}/reschedule`, { date: resDate, time: resTime });
            toast.success('Jadwal berhasil diubah!');
            setModalReschedule(false);
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal mengubah jadwal');
        } finally {
            setRescheduling(false);
        }
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    
    // Status aktif yang tampil di tab Janji Aktif
    const activeAppts = user ? appointments.filter(a => ['scheduled', 'checked_in'].includes(a.status)) : [];
    
    // Status selain aktif masuk ke tab Riwayat & Rekam Medis
    const pastAppts = user ? appointments.filter(a => !['scheduled', 'checked_in'].includes(a.status)) : [];

    const groupedBookSlots = groupByDate(slots);
    const bookDates        = Object.keys(groupedBookSlots).sort();
    const groupedResSlots  = groupByDate(resSlots);
    const resDates         = Object.keys(groupedResSlots).sort();

    // ── RENDER ────────────────────────────────────────────────────────────────
    return (
        <div className="container py-4" style={{ maxWidth: 1000, fontFamily: "'Inter', sans-serif" }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h4 style={{ color: '#111827', fontWeight: 800, marginBottom: 2 }}>Janji Temu Klinik</h4>
                    <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Buat janji temu offline dan hindari antrean panjang di klinik.</p>
                </div>
            </div>

            {/* Tab Nav */}
            {user && (
                <div className="d-flex border-bottom mb-4" style={{ gap: '1.5rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                    {[
                        { id: 'aktif',      label: '🕒 Janji Aktif' },
                        { id: 'buat_janji', label: '➕ Buat Janji Baru' },
                        { id: 'riwayat',    label: '📖 Riwayat & Rekam Medis' },
                    ].map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className="bg-transparent border-0 pb-2 px-1"
                            style={{
                                borderBottom: activeTab === t.id ? '2px solid #2563eb' : '2px solid transparent',
                                color: activeTab === t.id ? '#2563eb' : '#6b7280',
                                fontWeight: 600, fontSize: '0.95rem', transition: 'color 0.2s, border-color 0.2s',
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

                    {/* ── TAB 1: JANJI AKTIF ── */}
                    {user && activeTab === 'aktif' && (
                        <div>
                            {/* Aktif */}
                            {activeAppts.length > 0 && (
                                <div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                                        {activeAppts.map(a => (
                                            <ApptCard key={a._id} appt={a}
                                                showActions={true}
                                                onCancel={() => handleCancelStart(a)}
                                                onReschedule={() => handleRescheduleStart(a)}
                                                onRate={() => setRatingModal({ id: a._id, doctorName: a.doctorId?.name })}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeAppts.length === 0 && (
                                <Card>
                                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                        <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                                        <h3 style={{ color: '#111827', fontSize: 16, marginBottom: 8 }}>Belum Ada Janji Temu Aktif</h3>
                                        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>Anda belum membuat janji temu dengan dokter untuk waktu mendatang.</p>
                                        <button onClick={() => setActiveTab('buat_janji')}
                                            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                                            Buat Janji Sekarang
                                        </button>
                                    </div>
                                </Card>
                            )}
                        </div>
                    )}

                    {/* ── TAB 2: BUAT JANJI (juga muncul untuk guest) ── */}
                    {(!user || activeTab === 'buat_janji') && (
                        <div>
                            {user && <h5 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Pilih Dokter</h5>}

                            {/* Banner info untuk guest */}
                            {!user && (
                                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                                    <span style={{ fontSize: 18 }}>ℹ️</span>
                                    <span style={{ color: '#1e40af' }}>
                                        Pilih dokter dan klik <strong>Pilih Jadwal</strong> untuk mulai — perlu login terlebih dahulu.
                                    </span>
                                </div>
                            )}

                            {doctors.length === 0 ? (
                                <Card>
                                    <p style={{ textAlign: 'center', color: '#6b7280', margin: 0, padding: '20px 0' }}>
                                        Belum ada dokter yang membuka jadwal untuk minggu ini.
                                    </p>
                                </Card>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                    {doctors.map(d => {
                                        const doc = d.doctor || d;
                                        const docId = doc.id || doc._id;
                                        const rating = doc.rating;
                                        return (
                                            <div key={docId} style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
                                                    {/* Foto dengan fallback emoji */}
                                                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f3f4f6', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                                                        {doc.photo
                                                            ? <img src={`${API_URL}${doc.photo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            : '👨‍⚕️'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>dr. {doc.name}</div>
                                                        <div style={{ fontSize: 13, color: '#6b7280' }}>{doc.specialization}</div>
                                                        {/* Rating angka (misal ★ 4.7) */}
                                                        {rating != null && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                                                <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>★</span>
                                                                <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
                                                                    {Number(rating).toFixed(1)}
                                                                </span>
                                                                {doc.totalReviews != null && (
                                                                    <span style={{ fontSize: 11, color: '#9ca3af' }}>({doc.totalReviews})</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {/* Tahun pengalaman di bawah rating */}
                                                        {doc.experience != null && (
                                                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                                                                {doc.experience} tahun pengalaman
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                                                    <button onClick={() => handleBookStart(d)}
                                                        style={{ padding: '8px 16px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'background .2s' }}
                                                        onMouseEnter={e => e.target.style.background = '#dbeafe'}
                                                        onMouseLeave={e => e.target.style.background = '#eff6ff'}>
                                                        Pilih Jadwal
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
                            {pastAppts.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                                    {pastAppts.map(a => (
                                        <ApptCard key={a._id} appt={a}
                                            showActions={false}
                                            onRate={() => setRatingModal({ id: a._id, doctorName: a.doctorId?.name })}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <Card>
                                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                        <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
                                        <h3 style={{ color: '#111827', fontSize: 16, marginBottom: 8 }}>Belum Ada Riwayat</h3>
                                        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 0 }}>Riwayat janji temu dan rekam medis Anda akan muncul di sini setelah sesi selesai.</p>
                                    </div>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                MODALS
            ══════════════════════════════════════════════════════════ */}

            {/* Modal Login (guest) */}
            {modalLogin && (
                <Modal title="🔐 Login Diperlukan" onClose={() => setModalLogin(false)} maxWidth={400}>
                    <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                            Silakan login atau daftar akun untuk melihat jadwal dan membuat janji temu.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button onClick={() => setModalLogin(false)}
                                style={{ padding: '10px 20px', background: '#f3f4f6', color: '#4b5563', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                                Batal
                            </button>
                            <button onClick={() => navigate('/login')}
                                style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                                Login Sekarang
                            </button>
                        </div>
                        <button onClick={() => navigate('/register')}
                            style={{ marginTop: 10, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                            Belum punya akun? Daftar Gratis →
                        </button>
                    </div>
                </Modal>
            )}

            {/* Modal Booking */}
            {modalBook && (
                <Modal title="📅 Buat Janji Temu Baru" onClose={() => setModalBook(false)}>
                    {/* Info dokter */}
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#f3f4f6', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                            {bookDocInfo?.photo
                                ? <img src={`${API_URL}${bookDocInfo.photo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : '👨‍⚕️'}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>dr. {bookDocInfo?.name}</div>
                            <div style={{ fontSize: 13, color: '#6b7280' }}>{bookDocInfo?.specialization}</div>
                        </div>
                    </div>

                    {/* Pills Tanggal */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#374151' }}>Pilih Tanggal</label>
                        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                            {loadingSlots ? (
                                <div style={{ fontSize: 13, color: '#6b7280' }}>Memuat jadwal...</div>
                            ) : bookDates.length === 0 ? (
                                <div style={{ fontSize: 13, color: '#ef4444' }}>Tidak ada jadwal tersedia minggu ini.</div>
                            ) : bookDates.map(d => (
                                <button key={d} onClick={() => { setBookDate(d); setBookTime(''); }}
                                    style={{
                                        padding: '8px 14px', borderRadius: 10, flexShrink: 0,
                                        border: `1px solid ${bookDate === d ? '#2563eb' : '#e5e7eb'}`,
                                        background: bookDate === d ? '#eff6ff' : '#fff',
                                        color: bookDate === d ? '#1d4ed8' : '#4b5563',
                                        fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                                    }}>
                                    {fmtDateLabel(d)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid Waktu */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#374151' }}>Pilih Waktu (WIB)</label>
                        {loadingSlots ? (
                            <div style={{ fontSize: 13, color: '#6b7280' }}>Memuat waktu...</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                                {(groupedBookSlots[bookDate] || []).length === 0 ? (
                                    <div style={{ fontSize: 13, color: '#6b7280', gridColumn: '1/-1' }}>
                                        {bookDate ? 'Tidak ada slot tersedia di tanggal ini.' : 'Pilih tanggal terlebih dahulu.'}
                                    </div>
                                ) : (groupedBookSlots[bookDate] || []).map(s => (
                                    <button key={s.startTime} disabled={!s.available} onClick={() => setBookTime(s.startTime)}
                                        style={{
                                            padding: '10px 0', borderRadius: 10, textAlign: 'center',
                                            border: `1px solid ${bookTime === s.startTime ? '#3b82f6' : s.available ? '#d1d5db' : '#f3f4f6'}`,
                                            background: bookTime === s.startTime ? '#eff6ff' : s.available ? '#fff' : '#f9fafb',
                                            color: bookTime === s.startTime ? '#2563eb' : s.available ? '#374151' : '#9ca3af',
                                            fontWeight: 600, fontSize: 13,
                                            cursor: s.available ? 'pointer' : 'not-allowed', transition: 'all .2s',
                                        }}>
                                        {s.startTime}
                                        {!s.available && <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 400 }}>Penuh</div>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Keluhan */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                            Keluhan Utama <span style={{ color: '#b91c1c' }}>*</span>
                        </label>
                        <textarea value={bookComplaint} onChange={e => setBookComplaint(e.target.value)} rows={3}
                            placeholder="Sebutkan keluhan yang Anda rasakan..."
                            style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>

                    <button onClick={submitBooking} disabled={!bookDate || !bookTime || !bookComplaint.trim() || booking}
                        style={{
                            width: '100%', padding: 14, borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 700,
                            background: (!bookDate || !bookTime || !bookComplaint.trim() || booking) ? '#9ca3af' : 'linear-gradient(135deg,#1d4ed8,#2563eb)',
                            color: '#fff', cursor: (!bookDate || !bookTime || !bookComplaint.trim() || booking) ? 'not-allowed' : 'pointer',
                        }}>
                        {booking ? 'Memproses...' : 'Konfirmasi Janji Temu ✓'}
                    </button>
                </Modal>
            )}

            {/* Modal Cancel */}
            {modalCancel && (
                <Modal title="❌ Batalkan Janji Temu" onClose={() => setModalCancel(false)}>
                    <div style={{ background: '#fef2f2', padding: 14, borderRadius: 10, marginBottom: 18, fontSize: 13, color: '#991b1b' }}>
                        Apakah Anda yakin ingin membatalkan janji temu ini? <strong>Tindakan ini tidak dapat diurungkan.</strong>
                    </div>
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Alasan Pembatalan</label>
                        <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
                            placeholder="Mengapa Anda membatalkan janji ini?"
                            style={{
                                width: '100%', padding: '10px 14px',
                                border: `1px solid ${cancelReason.trim().length > 0 && cancelReason.trim().length < 5 ? '#ef4444' : '#d1d5db'}`,
                                borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                            }} />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setModalCancel(false)}
                            style={{ flex: 1, padding: 12, background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                            Kembali
                        </button>
                        <button onClick={submitCancel} disabled={cancelReason.trim().length < 5 || cancelling}
                            style={{
                                flex: 1, padding: 12,
                                background: (cancelReason.trim().length < 5 || cancelling) ? '#fca5a5' : '#ef4444',
                                color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                                cursor: (cancelReason.trim().length < 5 || cancelling) ? 'not-allowed' : 'pointer',
                            }}>
                            {cancelling ? 'Memproses...' : 'Ya, Batalkan'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Modal Reschedule */}
            {modalReschedule && (
                <Modal title="🔄 Ubah Jadwal Janji Temu" onClose={() => setModalReschedule(false)}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#374151' }}>Pilih Tanggal Baru</label>
                        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                            {loadingSlots ? (
                                <div style={{ fontSize: 13, color: '#6b7280' }}>Memuat tanggal...</div>
                            ) : resDates.length === 0 ? (
                                <div style={{ fontSize: 13, color: '#ef4444' }}>Tidak ada jadwal tersedia.</div>
                            ) : resDates.map(d => (
                                <button key={d} onClick={() => { setResDate(d); setResTime(''); }}
                                    style={{
                                        padding: '8px 14px', borderRadius: 10, flexShrink: 0,
                                        border: `1px solid ${resDate === d ? '#2563eb' : '#e5e7eb'}`,
                                        background: resDate === d ? '#eff6ff' : '#fff',
                                        color: resDate === d ? '#1d4ed8' : '#4b5563',
                                        fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                                    }}>
                                    {fmtDateLabel(d)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#374151' }}>Pilih Waktu Baru (WIB)</label>
                        {loadingSlots ? (
                            <div style={{ fontSize: 13, color: '#6b7280' }}>Memuat waktu...</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                                {(groupedResSlots[resDate] || []).length === 0 ? (
                                    <div style={{ fontSize: 13, color: '#6b7280', gridColumn: '1/-1' }}>
                                        {resDate ? 'Tidak ada slot tersedia.' : 'Pilih tanggal terlebih dahulu.'}
                                    </div>
                                ) : (groupedResSlots[resDate] || []).map(s => (
                                    <button key={s.startTime} disabled={!s.available} onClick={() => setResTime(s.startTime)}
                                        style={{
                                            padding: '10px 0', borderRadius: 10, textAlign: 'center',
                                            border: `1px solid ${resTime === s.startTime ? '#3b82f6' : s.available ? '#d1d5db' : '#f3f4f6'}`,
                                            background: resTime === s.startTime ? '#eff6ff' : s.available ? '#fff' : '#f9fafb',
                                            color: resTime === s.startTime ? '#2563eb' : s.available ? '#374151' : '#9ca3af',
                                            fontWeight: 600, fontSize: 13,
                                            cursor: s.available ? 'pointer' : 'not-allowed', transition: 'all .2s',
                                        }}>
                                        {s.startTime}
                                        {!s.available && <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 400 }}>Penuh</div>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setModalReschedule(false)}
                            style={{ flex: 1, padding: 12, background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                            Kembali
                        </button>
                        <button onClick={submitReschedule} disabled={!resDate || !resTime || rescheduling}
                            style={{
                                flex: 1, padding: 12,
                                background: (!resDate || !resTime || rescheduling) ? '#9ca3af' : '#2563eb',
                                color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                                cursor: (!resDate || !resTime || rescheduling) ? 'not-allowed' : 'pointer',
                            }}>
                            {rescheduling ? 'Memproses...' : 'Simpan Perubahan'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Modal Rating — hanya bintang */}
            {ratingModal && (
                <RatingModal
                    appointmentId={ratingModal.id}
                    doctorName={ratingModal.doctorName}
                    onClose={() => setRatingModal(null)}
                    onSuccess={loadData}
                />
            )}
        </div>
    );
};

export default Appointments;