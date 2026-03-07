/**
 * frontend/src/pages/doctor/AppointmentSchedule.js
 *
 * Halaman dokter untuk:
 *  1. Setting availability janji temu offline
 *  2. Melihat daftar janji hari ini & upcoming
 *  3. Check-in, Complete, Cancel pasien
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDT = (dateStr, timeStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const tgl = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return timeStr ? `${tgl}, ${timeStr} WIB` : tgl;
};

const STATUS_CFG = {
    scheduled           : { label: '📅 Terjadwal',        color: '#1d4ed8', bg: '#eff6ff' },
    checked_in          : { label: '✅ Hadir',             color: '#166534', bg: '#dcfce7' },
    completed           : { label: '🏁 Selesai',           color: '#0e7490', bg: '#ecfeff' },
    no_show             : { label: '❌ Tidak Hadir',        color: '#b45309', bg: '#fffbeb' },
    cancelled_by_user   : { label: '🚫 Dibatalkan User',   color: '#6b7280', bg: '#f3f4f6' },
    cancelled_by_doctor : { label: '🚫 Dibatalkan Dokter', color: '#b91c1c', bg: '#fef2f2' },
    cancelled_by_admin  : { label: '🚫 Dibatalkan Admin',  color: '#b91c1c', bg: '#fef2f2' },
};

const StatusBadge = ({ status }) => {
    const c = STATUS_CFG[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
    return (
        <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}30`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
            {c.label}
        </span>
    );
};

const DAYS = [
    { val: 1, label: 'Senin' },
    { val: 2, label: 'Selasa' },
    { val: 3, label: 'Rabu' },
    { val: 4, label: 'Kamis' },
    { val: 5, label: 'Jumat' },
];

// Generate HH:MM options (menit :00 dan :30 saja, 07:00–17:30)
const TIME_OPTIONS = [];
for (let h = 7; h <= 17; h++) {
    TIME_OPTIONS.push(`${String(h).padStart(2,'0')}:00`);
    TIME_OPTIONS.push(`${String(h).padStart(2,'0')}:30`);
}
TIME_OPTIONS.push('18:00');

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const AppointmentSchedule = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [tab, setTab] = useState('appointments'); // 'appointments' | 'settings'

    // Availability form
    const [avail, setAvail] = useState(null);
    const [form, setForm]   = useState({
        practiceDays   : [1, 2, 3, 4, 5],
        morningStart   : '08:30',
        morningEnd     : '11:30',
        afternoonStart : '13:30',
        afternoonEnd   : '16:30',
        isActive       : true,
    });
    const [saving, setSaving] = useState(false);
    const [loadingAvail, setLoadingAvail] = useState(true);

    // Appointments list
    const [appointments, setAppointments] = useState([]);
    const [loadingAppts, setLoadingAppts] = useState(true);
    const [filterDate,   setFilterDate]   = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [processing,   setProcessing]   = useState({});

    // Complete modal
    const [completeTarget, setCompleteTarget] = useState(null);
    const [completeNotes,  setCompleteNotes]  = useState('');
    const [completing,     setCompleting]     = useState(false);

    // Cancel modal
    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelling,   setCancelling]   = useState(false);

    useEffect(() => {
        if (!user || user.role !== 'doctor') { toast.error('Akses ditolak'); navigate('/'); return; }
        fetchAvailability();
        fetchAppointments();
    }, [user]);

    const fetchAvailability = async () => {
        setLoadingAvail(true);
        try {
            const r = await api.get('/api/appointments/doctor/availability');
            if (r.data.availability) {
                const a = r.data.availability;
                setAvail(a);
                setForm({
                    practiceDays   : a.practiceDays,
                    morningStart   : a.morningStart,
                    morningEnd     : a.morningEnd,
                    afternoonStart : a.afternoonStart,
                    afternoonEnd   : a.afternoonEnd,
                    isActive       : a.isActive,
                });
            }
        } catch { toast.error('Gagal memuat availability'); }
        finally { setLoadingAvail(false); }
    };

    const fetchAppointments = useCallback(async () => {
        setLoadingAppts(true);
        try {
            const params = new URLSearchParams();
            if (filterDate)   params.append('date', filterDate);
            if (filterStatus !== 'all') params.append('status', filterStatus);
            const r = await api.get(`/api/appointments/doctor/list?${params}`);
            setAppointments(r.data.appointments || []);
        } catch { toast.error('Gagal memuat janji'); }
        finally { setLoadingAppts(false); }
    }, [filterDate, filterStatus]);

    useEffect(() => { fetchAppointments(); }, [filterDate, filterStatus]);

    // ── Save availability ──────────────────────────────────────────────────
    const handleSaveAvail = async () => {
        if (form.practiceDays.length === 0) { toast.error('Pilih minimal 1 hari praktik'); return; }
        setSaving(true);
        try {
            await api.put('/api/appointments/doctor/availability', form);
            toast.success('Jadwal offline berhasil disimpan ✅');
            fetchAvailability();
        } catch (err) {
            const msg = err.response?.data?.message || 'Gagal menyimpan';
            if (err.response?.data?.overlapping) {
                toast.error(`${msg}\nSlot bentrok: ${err.response.data.overlapping.join(', ')}`);
            } else {
                toast.error(msg);
            }
        } finally { setSaving(false); }
    };

    const toggleDay = (day) => {
        setForm(f => ({
            ...f,
            practiceDays: f.practiceDays.includes(day)
                ? f.practiceDays.filter(d => d !== day)
                : [...f.practiceDays, day].sort(),
        }));
    };

    // ── Check-in ───────────────────────────────────────────────────────────
    const handleCheckin = async (id) => {
        setProcessing(p => ({ ...p, [id]: 'checkin' }));
        try {
            await api.put(`/api/appointments/doctor/${id}/checkin`);
            toast.success('Check-in berhasil ✅');
            fetchAppointments();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal check-in'); }
        finally { setProcessing(p => ({ ...p, [id]: null })); }
    };

    // ── Complete ───────────────────────────────────────────────────────────
    const handleComplete = async () => {
        setCompleting(true);
        try {
            await api.put(`/api/appointments/doctor/${completeTarget._id}/complete`, { notes: completeNotes });
            toast.success('Janji temu selesai ✅');
            setCompleteTarget(null);
            setCompleteNotes('');
            fetchAppointments();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal menyelesaikan'); }
        finally { setCompleting(false); }
    };

    // ── Cancel ─────────────────────────────────────────────────────────────
    const handleCancel = async () => {
        if (!cancelReason.trim() || cancelReason.length < 5) { toast.error('Alasan minimal 5 karakter'); return; }
        setCancelling(true);
        try {
            await api.put(`/api/appointments/doctor/${cancelTarget._id}/cancel`, { reason: cancelReason });
            toast.success('Janji temu dibatalkan');
            setCancelTarget(null);
            setCancelReason('');
            fetchAppointments();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal membatalkan'); }
        finally { setCancelling(false); }
    };

    // ── Styles ─────────────────────────────────────────────────────────────
    const s = {
        root  : { minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif", padding: '24px 16px' },
        inner : { maxWidth: 860, margin: '0 auto' },
        card  : { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 16 },
        label : { color: '#374151', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 },
        sel   : { border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#111827', background: '#fff', cursor: 'pointer' },
        btn   : (bg, disabled) => ({ padding: '10px 20px', background: disabled ? '#9ca3af' : bg, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer' }),
    };

    const tabStyle = (key) => ({
        flex: 1, padding: '10px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
        background: tab === key ? '#fff' : 'transparent',
        color: tab === key ? '#111827' : '#6b7280',
        boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
    });

    // Stats
    const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
    const todayAppts = appointments.filter(a => {
        const d = new Date(a.appointmentDate);
        return d.toLocaleDateString('sv-SE') === todayStr;
    });
    const stats = {
        scheduled  : appointments.filter(a => a.status === 'scheduled').length,
        checked_in : appointments.filter(a => a.status === 'checked_in').length,
        today      : todayAppts.length,
    };

    return (
        <div style={s.root}>
            <div style={s.inner}>

                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Janji Temu Offline</h1>
                    <p style={{ color: '#6b7280', fontSize: 14 }}>Kelola jadwal dan kehadiran pasien klinik</p>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Hari Ini',      val: stats.today,      color: '#7c3aed' },
                        { label: 'Terjadwal',     val: stats.scheduled,  color: '#2563eb' },
                        { label: 'Sudah Hadir',   val: stats.checked_in, color: '#16a34a' },
                    ].map(s => (
                        <div key={s.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '14px 20px', flex: '1 1 120px' }}>
                            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 24 }}>
                    <button style={tabStyle('appointments')} onClick={() => setTab('appointments')}>📋 Daftar Janji</button>
                    <button style={tabStyle('settings')}    onClick={() => setTab('settings')}>⚙️ Atur Jadwal</button>
                </div>

                {/* ═══ TAB: DAFTAR JANJI ══════════════════════════════════ */}
                {tab === 'appointments' && (
                    <>
                        {/* Filter */}
                        <div style={s.card}>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div>
                                    <label style={s.label}>Tanggal</label>
                                    <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                                        style={{ ...s.sel, padding: '8px 12px' }} />
                                </div>
                                <div>
                                    <label style={s.label}>Status</label>
                                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={s.sel}>
                                        <option value="all">Semua Status</option>
                                        <option value="scheduled">Terjadwal</option>
                                        <option value="checked_in">Hadir</option>
                                        <option value="completed">Selesai</option>
                                        <option value="no_show">Tidak Hadir</option>
                                        <option value="cancelled_by_user">Dibatalkan User</option>
                                        <option value="cancelled_by_doctor">Dibatalkan Dokter</option>
                                    </select>
                                </div>
                                <button onClick={() => { setFilterDate(''); setFilterStatus('all'); }} style={{ padding: '9px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13 }}>
                                    Reset
                                </button>
                                <button onClick={fetchAppointments} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                                    🔄 Refresh
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        {loadingAppts ? (
                            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Memuat...</div>
                        ) : appointments.length === 0 ? (
                            <div style={{ ...s.card, textAlign: 'center', padding: 40 }}>
                                <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
                                <div style={{ color: '#6b7280' }}>Tidak ada janji temu ditemukan</div>
                            </div>
                        ) : (
                            appointments.map(a => {
                                const isProc   = processing[a._id];
                                const canCI    = a.status === 'scheduled';
                                const canComp  = a.status === 'checked_in';
                                const canCancl = a.status === 'scheduled';
                                const canCancelNow = new Date(a.scheduledAt).getTime() - Date.now() > 2 * 60 * 60 * 1000;

                                return (
                                    <div key={a._id} style={{
                                        background: '#fff', border: `1px solid ${a.status === 'checked_in' ? '#86efac' : '#e5e7eb'}`,
                                        borderRadius: 12, padding: '16px 20px', marginBottom: 10,
                                        borderLeft: `4px solid ${STATUS_CFG[a.status]?.color || '#e5e7eb'}`,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{a.userId?.name || '-'}</div>
                                                <div style={{ fontSize: 12, color: '#6b7280' }}>{a.userId?.phone || a.userId?.email || ''}</div>
                                            </div>
                                            <StatusBadge status={a.status} />
                                        </div>

                                        <div style={{ fontSize: 13, color: '#374151', marginBottom: a.complaint ? 6 : 0 }}>
                                            🕐 {fmtDT(a.appointmentDate, a.appointmentTime)}
                                        </div>
                                        {a.complaint && (
                                            <div style={{ fontSize: 12, color: '#6b7280', background: '#f9fafb', padding: '6px 10px', borderRadius: 6, marginTop: 6 }}>
                                                Keluhan: {a.complaint}
                                            </div>
                                        )}
                                        {a.cancelReason && (
                                            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 6 }}>Alasan: {a.cancelReason}</div>
                                        )}

                                        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                            {canCI && (
                                                <button disabled={!!isProc} onClick={() => handleCheckin(a._id)}
                                                    style={{ padding: '7px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: isProc ? 0.6 : 1 }}>
                                                    {isProc === 'checkin' ? '...' : '✅ Check-in Pasien'}
                                                </button>
                                            )}
                                            {canComp && (
                                                <button onClick={() => { setCompleteTarget(a); setCompleteNotes(''); }}
                                                    style={{ padding: '7px 16px', background: '#0e7490', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                                                    🏁 Selesaikan
                                                </button>
                                            )}
                                            {canCancl && canCancelNow && (
                                                <button onClick={() => { setCancelTarget(a); setCancelReason(''); }}
                                                    style={{ padding: '7px 16px', background: '#fff', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                                    ❌ Batalkan
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </>
                )}

                {/* ═══ TAB: ATUR JADWAL ══════════════════════════════════ */}
                {tab === 'settings' && (
                    <div style={s.card}>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: '#111827' }}>⚙️ Jadwal Janji Temu Offline</div>
                        <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
                            Konfigurasi ini berbeda dengan jadwal konsultasi online. Slot hanya bisa di menit :00 atau :30.
                        </p>

                        {loadingAvail ? (
                            <div style={{ color: '#6b7280' }}>Memuat...</div>
                        ) : (
                            <>
                                {/* Aktif/Non-aktif */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, background: form.isActive ? '#f0fdf4' : '#f9fafb', border: `1px solid ${form.isActive ? '#86efac' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 16px' }}>
                                    <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                                        style={{ width: 18, height: 18, cursor: 'pointer' }} />
                                    <label htmlFor="isActive" style={{ fontWeight: 600, fontSize: 14, color: form.isActive ? '#166534' : '#6b7280', cursor: 'pointer' }}>
                                        {form.isActive ? '🟢 Jadwal offline aktif — pasien bisa booking' : '⚫ Jadwal offline dinonaktifkan'}
                                    </label>
                                </div>

                                {/* Hari Praktik */}
                                <div style={{ marginBottom: 20 }}>
                                    <label style={s.label}>Hari Praktik</label>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {DAYS.map(day => {
                                            const active = form.practiceDays.includes(day.val);
                                            return (
                                                <button key={day.val} onClick={() => toggleDay(day.val)}
                                                    style={{ padding: '8px 16px', borderRadius: 8, border: `2px solid ${active ? '#2563eb' : '#e5e7eb'}`, background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                                                    {day.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Sesi Pagi */}
                                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: '#92400e', marginBottom: 12 }}>☀️ Sesi Pagi</div>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                        <div>
                                            <label style={s.label}>Mulai</label>
                                            <select value={form.morningStart} onChange={e => setForm(f => ({ ...f, morningStart: e.target.value }))} style={s.sel}>
                                                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={s.label}>Selesai</label>
                                            <select value={form.morningEnd} onChange={e => setForm(f => ({ ...f, morningEnd: e.target.value }))} style={s.sel}>
                                                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Break */}
                                <div style={{ background: '#f1f5f9', borderRadius: 8, padding: '10px 16px', marginBottom: 14, fontSize: 13, color: '#64748b' }}>
                                    🍽️ Break siang: <strong>12:00 – 13:00</strong> (tidak dapat diubah)
                                </div>

                                {/* Sesi Sore */}
                                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1e40af', marginBottom: 12 }}>🌤️ Sesi Siang/Sore</div>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                        <div>
                                            <label style={s.label}>Mulai</label>
                                            <select value={form.afternoonStart} onChange={e => setForm(f => ({ ...f, afternoonStart: e.target.value }))} style={s.sel}>
                                                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={s.label}>Selesai</label>
                                            <select value={form.afternoonEnd} onChange={e => setForm(f => ({ ...f, afternoonEnd: e.target.value }))} style={s.sel}>
                                                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Preview slot */}
                                <SlotPreview form={form} />

                                <button onClick={handleSaveAvail} disabled={saving}
                                    style={{ padding: '12px 28px', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', marginTop: 8 }}>
                                    {saving ? 'Menyimpan...' : '💾 Simpan Jadwal'}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Complete Modal ─────────────────────────────────────────── */}
            {completeTarget && (
                <ModalBox onClose={() => setCompleteTarget(null)} title="🏁 Selesaikan Janji Temu">
                    <div style={{ marginBottom: 14, fontSize: 13, color: '#374151' }}>
                        Pasien: <strong>{completeTarget.userId?.name}</strong> — {completeTarget.appointmentTime} WIB
                    </div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                        Catatan Dokter (opsional)
                    </label>
                    <textarea value={completeNotes} rows={3} onChange={e => setCompleteNotes(e.target.value)}
                        placeholder="Hasil pemeriksaan, rekomendasi, atau catatan singkat..."
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button onClick={() => setCompleteTarget(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
                        <button onClick={handleComplete} disabled={completing}
                            style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#0e7490', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: completing ? 0.6 : 1 }}>
                            {completing ? 'Memproses...' : '✅ Tandai Selesai'}
                        </button>
                    </div>
                </ModalBox>
            )}

            {/* ── Cancel Modal ─────────────────────────────────────────── */}
            {cancelTarget && (
                <ModalBox onClose={() => setCancelTarget(null)} title="❌ Batalkan Janji Temu">
                    <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>
                        Pasien: <strong>{cancelTarget.userId?.name}</strong> — {cancelTarget.appointmentTime} WIB akan dibatalkan.
                    </div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Alasan Pembatalan *</label>
                    <textarea value={cancelReason} rows={3} onChange={e => setCancelReason(e.target.value)}
                        placeholder="Masukkan alasan pembatalan..."
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button onClick={() => setCancelTarget(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
                        <button onClick={handleCancel} disabled={cancelling}
                            style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: cancelling ? 0.6 : 1 }}>
                            {cancelling ? 'Memproses...' : 'Konfirmasi Pembatalan'}
                        </button>
                    </div>
                </ModalBox>
            )}
        </div>
    );
};

// ── SlotPreview: preview slot yang akan di-generate ───────────────────────────
const SlotPreview = ({ form }) => {
    const toMin  = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
    const toHHMM = (m)    => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

    const slots = [];
    const sessions = [
        { start: form.morningStart, end: form.morningEnd },
        { start: form.afternoonStart, end: form.afternoonEnd },
    ];
    for (const ses of sessions) {
        let cur = toMin(ses.start);
        const end = toMin(ses.end);
        while (cur + 30 <= end) {
            const mins = cur % 60;
            if (mins !== 0 && mins !== 30) { cur += 30; continue; }
            slots.push({ start: toHHMM(cur), end: toHHMM(cur + 30) });
            cur += 30;
        }
    }

    if (slots.length === 0) return null;

    return (
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' }}>
                Preview Slot ({slots.length} slot/hari)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {slots.map(sl => (
                    <span key={sl.start} style={{ padding: '4px 10px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, color: '#374151', fontWeight: 500 }}>
                        {sl.start}
                    </span>
                ))}
            </div>
        </div>
    );
};

const ModalBox = ({ children, onClose, title }) => (
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

export default AppointmentSchedule;