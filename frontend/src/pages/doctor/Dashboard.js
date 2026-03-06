import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toMinutes = (hhmm) => {
    const [h, m] = (hhmm || '00:00').split(':').map(Number);
    return h * 60 + m;
};

const generatePreviewSlots = (startTime, endTime, lunchStart, lunchEnd) => {
    const slots = [];
    const SESSION = 30, INTERVAL = 60;
    let cur = toMinutes(startTime);
    const end = toMinutes(endTime);
    const lS = toMinutes(lunchStart);
    const lE = toMinutes(lunchEnd);
    while (cur + SESSION <= end) {
        if (cur >= lS && cur < lE) { cur = lE; continue; }
        if (cur < lS && cur + SESSION > lS) { cur = lE; continue; }
        if (cur + SESSION > end) break;
        const h = Math.floor(cur / 60), m = cur % 60;
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        cur += INTERVAL;
    }
    return slots;
};

const fmtDT = (d) => d ? new Date(d).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
}) + ' WIB' : '—';

const fmtRupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

const DAYS = [
    { v: 0, l: 'Min' }, { v: 1, l: 'Sen' }, { v: 2, l: 'Sel' },
    { v: 3, l: 'Rab' }, { v: 4, l: 'Kam' }, { v: 5, l: 'Jum' }, { v: 6, l: 'Sab' },
];

const DAY_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const DEFAULT_AVAIL = {
    practiceDays: [1, 2, 3, 4, 5],
    startTime: '08:00', endTime: '16:00',
    lunchBreakStart: '12:00', lunchBreakEnd: '13:00',
    isActive: true,
};

// ─── Status configs ───────────────────────────────────────────────────────────
const CONS_STATUS = {
    confirmed: { label: 'Terkonfirmasi', color: '#1d4ed8', bg: '#eff6ff' },
    in_progress: { label: '🟢 Berlangsung', color: '#15803d', bg: '#f0fdf4' },
    completed: { label: 'Selesai', color: '#0e7490', bg: '#ecfeff' },
    no_show: { label: 'Tidak Hadir', color: '#b45309', bg: '#fffbeb' },
    doctor_no_show: { label: 'Dokter Absen', color: '#b91c1c', bg: '#fef2f2' },
    pending_payment: { label: 'Menunggu Bayar', color: '#92400e', bg: '#fffbeb' },
    expired: { label: 'Kadaluarsa', color: '#6b7280', bg: '#f3f4f6' },
    scheduled: { label: 'Terjadwal', color: '#6d28d9', bg: '#f5f3ff' },
    ongoing: { label: '🟢 Berlangsung', color: '#15803d', bg: '#f0fdf4' },
    paid: { label: 'Terkonfirmasi', color: '#1d4ed8', bg: '#eff6ff' },
};

const StatusBadge = ({ status }) => {
    const c = CONS_STATUS[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
    return (
        <span style={{
            background: c.bg, color: c.color, border: `1px solid ${c.color}30`,
            borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700,
            whiteSpace: 'nowrap',
        }}>{c.label}</span>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

.dd-root * { box-sizing: border-box; }
.dd-root { font-family: 'DM Sans', sans-serif; background: #f1f5f9; min-height: 100vh; }
.dd-sidebar { width: 240px; min-height: 100vh; background: #0f172a; position: fixed; top: 0; left: 0; z-index: 100; display: flex; flex-direction: column; }
.dd-sidebar-logo { padding: 28px 24px 20px; border-bottom: 1px solid rgba(255,255,255,.06); }
.dd-sidebar-logo h2 { color: #fff; font-size: 16px; font-weight: 700; margin: 0; letter-spacing: -.3px; }
.dd-sidebar-logo p { color: #64748b; font-size: 11px; margin: 0; }
.dd-nav { padding: 16px 12px; flex: 1; }
.dd-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; color: #94a3b8; font-size: 13px; font-weight: 500; cursor: pointer; text-decoration: none; transition: all .15s; margin-bottom: 2px; border: none; background: none; width: 100%; }
.dd-nav-item:hover { background: rgba(255,255,255,.06); color: #e2e8f0; }
.dd-nav-item.active { background: #1e40af; color: #fff; }
.dd-nav-item .badge { margin-left: auto; background: #ef4444; color: #fff; border-radius: 10px; padding: 1px 7px; font-size: 10px; }
.dd-main { margin-left: 240px; padding: 28px 28px 40px; }
.dd-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
.dd-header h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0; }
.dd-header p { font-size: 13px; color: #64748b; margin: 0; }
.dd-card { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; }
.dd-stat { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 18px 20px; }
.dd-stat-val { font-size: 28px; font-weight: 800; color: #0f172a; font-family: 'DM Mono', monospace; line-height: 1; }
.dd-stat-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }
.dd-stat-icon { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 10px; }
.dd-tab { display: flex; gap: 2px; background: #f1f5f9; border-radius: 10px; padding: 3px; margin-bottom: 20px; }
.dd-tab-btn { flex: 1; padding: 9px 8px; border-radius: 7px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; transition: all .15s; background: transparent; color: #64748b; }
.dd-tab-btn.active { background: #fff; color: #0f172a; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
.dd-input { width: 100%; border: 1.5px solid #e2e8f0; border-radius: 9px; padding: 9px 12px; font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; transition: border .15s; background: #fff; }
.dd-input:focus { border-color: #3b82f6; }
.dd-day-btn { border-radius: 8px; padding: 8px 0; font-size: 12px; font-weight: 700; cursor: pointer; border: 1.5px solid #e2e8f0; background: #f8fafc; color: #64748b; transition: all .15s; flex: 1; text-align: center; }
.dd-day-btn.on { background: #1e40af; border-color: #1e40af; color: #fff; }
.dd-slot-chip { padding: 5px 11px; border-radius: 7px; background: #eff6ff; color: #1d4ed8; font-size: 12px; font-weight: 700; font-family: 'DM Mono', monospace; border: 1px solid #bfdbfe; }
.dd-btn-primary { background: #1e40af; color: #fff; border: none; border-radius: 9px; padding: 10px 24px; font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background .15s; display: inline-flex; align-items: center; gap: 8px; }
.dd-btn-primary:hover { background: #1d3a99; }
.dd-btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
.dd-btn-ghost { background: none; border: 1.5px solid #e2e8f0; border-radius: 9px; padding: 8px 16px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; color: #374151; transition: all .15s; }
.dd-btn-ghost:hover { border-color: #94a3b8; background: #f8fafc; }
.dd-toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
.dd-toggle input { opacity: 0; width: 0; height: 0; }
.dd-toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #cbd5e1; border-radius: 24px; transition: .3s; }
.dd-toggle-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
.dd-toggle input:checked + .dd-toggle-slider { background: #22c55e; }
.dd-toggle input:checked + .dd-toggle-slider:before { transform: translateX(20px); }
.dd-cons-card { border: 1px solid #e2e8f0; border-radius: 11px; padding: 14px 16px; margin-bottom: 10px; transition: box-shadow .15s; }
.dd-cons-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,.07); }
.dd-cons-card.live { border-color: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.1); }
.dd-alert-banner { border-radius: 10px; padding: 12px 16px; font-size: 13px; display: flex; align-items: flex-start; gap: 10px; margin-bottom: 16px; }
.dd-avail-not-set { background: #fffbeb; border: 1px solid #fcd34d; }
.dd-avail-inactive { background: #fef2f2; border: 1px solid #fca5a5; }
@media (max-width: 768px) {
  .dd-sidebar { display: none; }
  .dd-main { margin-left: 0; padding: 16px; }
}
`;

// ─── Component ────────────────────────────────────────────────────────────────
const DoctorDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Dashboard data
    const [stats, setStats] = useState({ todayConsultations: 0, confirmedToday: 0, totalPatients: 0, inProgress: 0 });
    const [todayList, setTodayList] = useState([]);
    const [activeConsultations, setActiveConsultations] = useState([]);
    const [loadingDash, setLoadingDash] = useState(true);

    // Availability
    const [avail, setAvail] = useState(DEFAULT_AVAIL);
    const [availForm, setAvailForm] = useState(DEFAULT_AVAIL);
    const [availIsNew, setAvailIsNew] = useState(false);
    const [availLoading, setAvailLoading] = useState(true);
    const [availSaving, setAvailSaving] = useState(false);

    // Session actions
    const [processing, setProcessing] = useState({});

    // Active tab
    const [tab, setTab] = useState('overview');

    // ── Fetch dashboard data ────────────────────────────────────────────────────
    const fetchDash = useCallback(async () => {
        setLoadingDash(true);
        try {
            const [apptRes, consRes] = await Promise.allSettled([
                api.get('/api/appointments/doctor/stats'),
                api.get('/api/consultations/doctor/pending'),
            ]);

            if (apptRes.status === 'fulfilled') {
                const d = apptRes.value.data;
                setStats(prev => ({
                    ...prev,
                    todayConsultations: d.stats?.todayAppointments ?? 0,
                    totalPatients: d.stats?.totalPatients ?? 0,
                }));
                setTodayList(d.todaySchedule || []);
            }

            if (consRes.status === 'fulfilled') {
                const list = consRes.value.data?.consultations || [];
                const live = list.filter(c => ['in_progress', 'ongoing'].includes(c.status)).length;
                const conf = list.filter(c => c.status === 'confirmed').length;
                setStats(prev => ({ ...prev, inProgress: live, confirmedToday: conf }));
                setActiveConsultations(list.slice(0, 8));
            }
        } catch {
            // silent
        } finally {
            setLoadingDash(false);
        }
    }, []);

    // ── Fetch availability ──────────────────────────────────────────────────────
    const fetchAvail = useCallback(async () => {
        setAvailLoading(true);
        try {
            const r = await api.get('/api/availability/my');
            const a = r.data.availability;
            if (!a || a._isDefault) {
                setAvailIsNew(true);
                setAvail(DEFAULT_AVAIL);
                setAvailForm(DEFAULT_AVAIL);
            } else {
                setAvailIsNew(false);
                const parsed = {
                    practiceDays: a.practiceDays || [1, 2, 3, 4, 5],
                    startTime: a.startTime || '08:00',
                    endTime: a.endTime || '16:00',
                    lunchBreakStart: a.lunchBreakStart || '12:00',
                    lunchBreakEnd: a.lunchBreakEnd || '13:00',
                    isActive: a.isActive !== false,
                };
                setAvail(parsed);
                setAvailForm(parsed);
            }
        } catch {
            toast.error('Gagal memuat jadwal');
        } finally {
            setAvailLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDash();
        fetchAvail();
    }, [fetchDash, fetchAvail]);

    // ── Save availability ───────────────────────────────────────────────────────
    const handleSaveAvail = async () => {
        if (availForm.practiceDays.length === 0) return toast.error('Pilih minimal satu hari');
        if (toMinutes(availForm.startTime) >= toMinutes(availForm.endTime)) return toast.error('Jam mulai harus sebelum jam selesai');
        if (previewSlots.length === 0) return toast.error('Pengaturan tidak menghasilkan slot apapun');

        setAvailSaving(true);
        try {
            await api.put('/api/availability/my', availForm);
            setAvail(availForm);
            setAvailIsNew(false);
            toast.success('✅ Jadwal praktik berhasil disimpan!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menyimpan jadwal');
        } finally {
            setAvailSaving(false);
        }
    };

    const toggleDay = (d) => {
        setAvailForm(f => ({
            ...f,
            practiceDays: f.practiceDays.includes(d)
                ? f.practiceDays.filter(x => x !== d)
                : [...f.practiceDays, d].sort(),
        }));
    };

    // ── Session actions ─────────────────────────────────────────────────────────
    const handleStart = async (id) => {
        setProcessing(p => ({ ...p, [id]: 'start' }));
        try {
            await api.put(`/api/consultations/${id}/start`);
            toast.success('Sesi dimulai');
            fetchDash();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal memulai sesi');
        } finally {
            setProcessing(p => ({ ...p, [id]: null }));
        }
    };

    const handleEnd = async (id) => {
        if (!window.confirm('Akhiri sesi? Status akan ditentukan dari respons pasien.')) return;
        setProcessing(p => ({ ...p, [id]: 'end' }));
        try {
            const r = await api.put(`/api/consultations/${id}/end`);
            const s = r.data.consultation?.status;
            toast.success(s === 'no_show' ? 'Sesi selesai — pasien tidak hadir' : '✅ Sesi selesai');
            fetchDash();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal mengakhiri sesi');
        } finally {
            setProcessing(p => ({ ...p, [id]: null }));
        }
    };

    const previewSlots = generatePreviewSlots(
        availForm.startTime, availForm.endTime,
        availForm.lunchBreakStart, availForm.lunchBreakEnd
    );

    const formChanged = JSON.stringify(availForm) !== JSON.stringify(avail);

    // ── Nav items ───────────────────────────────────────────────────────────────
    const navItems = [
        { key: 'overview', icon: '📊', label: 'Overview' },
        { key: 'consultations', icon: '🩺', label: 'Konsultasi', badge: activeConsultations.filter(c => ['confirmed','in_progress','ongoing'].includes(c.status)).length },
        { key: 'availability', icon: '📅', label: 'Jadwal Praktik', alert: availIsNew || !avail.isActive },
        { key: 'appointments', icon: '🗓️', label: 'Janji Temu', external: '/doctor/appointments' },
        { key: 'patients', icon: '👥', label: 'Pasien', external: '/doctor/patients' },
        { key: 'sick-letters', icon: '📄', label: 'Surat Sakit', external: '/doctor/sick-letters' },
    ];

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            <style>{css}</style>
            <div className="dd-root">

                {/* Sidebar */}
                <aside className="dd-sidebar">
                    <div className="dd-sidebar-logo">
                        <h2>⚕️ Klinik IPB</h2>
                        <p>dr. {user?.name || '—'}</p>
                    </div>
                    <nav className="dd-nav">
                        {navItems.map(item => (
                            item.external
                                ? <Link key={item.key} to={item.external} className="dd-nav-item">
                                    <span>{item.icon}</span>
                                    <span>{item.label}</span>
                                </Link>
                                : <button key={item.key}
                                    className={`dd-nav-item ${tab === item.key ? 'active' : ''}`}
                                    onClick={() => setTab(item.key)}>
                                    <span>{item.icon}</span>
                                    <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                                    {item.badge > 0 && <span className="badge">{item.badge}</span>}
                                    {item.alert && !item.badge && (
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                                    )}
                                </button>
                        ))}
                    </nav>
                    <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
                        <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>Status menerima pasien</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <label className="dd-toggle">
                                <input type="checkbox" checked={availForm.isActive}
                                    onChange={async (e) => {
                                        const newVal = e.target.checked;
                                        setAvailForm(f => ({ ...f, isActive: newVal }));
                                        try {
                                            await api.put('/api/availability/my', { ...availForm, isActive: newVal });
                                            setAvail(f => ({ ...f, isActive: newVal }));
                                            toast.success(newVal ? '✅ Sekarang menerima pasien' : '⏸ Tidak menerima pasien sementara');
                                        } catch {
                                            setAvailForm(f => ({ ...f, isActive: !newVal }));
                                            toast.error('Gagal mengubah status');
                                        }
                                    }} />
                                <span className="dd-toggle-slider" />
                            </label>
                            <span style={{ fontSize: 12, color: availForm.isActive ? '#22c55e' : '#94a3b8', fontWeight: 600 }}>
                                {availForm.isActive ? 'Aktif' : 'Nonaktif'}
                            </span>
                        </div>
                    </div>
                </aside>

                {/* Main */}
                <main className="dd-main">

                    {/* ══ TAB: OVERVIEW ══════════════════════════════════════════ */}
                    {tab === 'overview' && (
                        <>
                            <div className="dd-header">
                                <div>
                                    <h1>Selamat datang 👋</h1>
                                    <p>dr. {user?.name} · {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                </div>
                                <button className="dd-btn-ghost" onClick={() => { fetchDash(); fetchAvail(); }}>🔄 Refresh</button>
                            </div>

                            {/* Alert jika jadwal belum diatur */}
                            {availIsNew && (
                                <div className="dd-alert-banner dd-avail-not-set">
                                    <span style={{ fontSize: 20 }}>⚠️</span>
                                    <div>
                                        <strong>Jadwal belum diatur.</strong> Pasien belum bisa melihat slot konsultasi Anda.
                                        <button onClick={() => setTab('availability')}
                                            style={{ marginLeft: 10, background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                            Atur Sekarang →
                                        </button>
                                    </div>
                                </div>
                            )}
                            {!availIsNew && !avail.isActive && (
                                <div className="dd-alert-banner dd-avail-inactive">
                                    <span style={{ fontSize: 20 }}>⏸</span>
                                    <div>
                                        Anda sedang <strong>tidak menerima pasien baru</strong>.
                                        <button onClick={() => setTab('availability')}
                                            style={{ marginLeft: 10, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                            Aktifkan →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                                {[
                                    { icon: '🗓️', val: stats.confirmedToday, lbl: 'Terkonfirmasi', color: '#eff6ff', iconBg: '#dbeafe' },
                                    { icon: '🟢', val: stats.inProgress, lbl: 'Berlangsung', color: '#f0fdf4', iconBg: '#bbf7d0' },
                                    { icon: '📅', val: stats.todayConsultations, lbl: 'Janji Hari Ini', color: '#faf5ff', iconBg: '#e9d5ff' },
                                    { icon: '👥', val: stats.totalPatients, lbl: 'Total Pasien', color: '#fff7ed', iconBg: '#fed7aa' },
                                ].map((s, i) => (
                                    <div key={i} className="dd-stat" style={{ background: s.color }}>
                                        <div className="dd-stat-icon" style={{ background: s.iconBg }}>{s.icon}</div>
                                        <div className="dd-stat-val">{loadingDash ? '—' : s.val}</div>
                                        <div className="dd-stat-lbl">{s.lbl}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                {/* Konsultasi aktif */}
                                <div className="dd-card" style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>🩺 Konsultasi Aktif</span>
                                        <button className="dd-btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setTab('consultations')}>Lihat Semua</button>
                                    </div>
                                    {loadingDash ? <p style={{ color: '#94a3b8', fontSize: 13 }}>Memuat...</p>
                                        : activeConsultations.filter(c => ['confirmed', 'in_progress', 'ongoing', 'paid', 'scheduled'].includes(c.status)).length === 0
                                            ? <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Tidak ada konsultasi aktif</p>
                                            : activeConsultations
                                                .filter(c => ['confirmed', 'in_progress', 'ongoing', 'paid', 'scheduled'].includes(c.status))
                                                .slice(0, 4)
                                                .map(c => (
                                                    <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{c.userId?.name || 'Pasien'}</div>
                                                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDT(c.scheduledAt)}</div>
                                                        </div>
                                                        <StatusBadge status={c.status} />
                                                    </div>
                                                ))
                                    }
                                </div>

                                {/* Jadwal praktik summary */}
                                <div className="dd-card" style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>📅 Jadwal Praktik</span>
                                        <button className="dd-btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setTab('availability')}>Edit</button>
                                    </div>
                                    {availLoading ? <p style={{ color: '#94a3b8', fontSize: 13 }}>Memuat...</p> : (
                                        <>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                                                {DAYS.map(d => (
                                                    <span key={d.v} style={{
                                                        padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                                                        background: avail.practiceDays.includes(d.v) ? '#1e40af' : '#f1f5f9',
                                                        color: avail.practiceDays.includes(d.v) ? '#fff' : '#94a3b8',
                                                    }}>{d.l}</span>
                                                ))}
                                            </div>
                                            <div style={{ fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <div>🕐 <strong>{avail.startTime}</strong> – <strong>{avail.endTime}</strong> WIB</div>
                                                <div>☕ Break: <strong>{avail.lunchBreakStart}</strong> – <strong>{avail.lunchBreakEnd}</strong></div>
                                                <div>📆 <strong>{generatePreviewSlots(avail.startTime, avail.endTime, avail.lunchBreakStart, avail.lunchBreakEnd).length} slot</strong> per hari</div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ══ TAB: CONSULTATIONS ═════════════════════════════════════ */}
                    {tab === 'consultations' && (
                        <>
                            <div className="dd-header">
                                <div><h1>Konsultasi Online</h1><p>Kelola sesi konsultasi pasien</p></div>
                                <button className="dd-btn-ghost" onClick={fetchDash}>🔄 Refresh</button>
                            </div>

                            {/* Sub-tabs */}
                            <div className="dd-tab" style={{ maxWidth: 500 }}>
                                {['Aktif & Upcoming', 'Riwayat'].map((t, i) => (
                                    <button key={i} className={`dd-tab-btn ${i === 0 ? 'active' : ''}`}>{t}</button>
                                ))}
                            </div>

                            {loadingDash ? (
                                <p style={{ color: '#94a3b8' }}>Memuat...</p>
                            ) : activeConsultations.length === 0 ? (
                                <div className="dd-card" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                                    <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                                    Tidak ada konsultasi aktif
                                </div>
                            ) : (
                                activeConsultations.map(c => {
                                    const canStart = ['confirmed', 'paid', 'scheduled'].includes(c.status);
                                    const canEnd   = ['in_progress', 'ongoing'].includes(c.status);
                                    const canChat  = ['confirmed', 'in_progress', 'completed', 'paid', 'scheduled', 'ongoing'].includes(c.status);
                                    const isLive   = ['in_progress', 'ongoing'].includes(c.status);
                                    const proc     = processing[c._id];

                                    return (
                                        <div key={c._id} className={`dd-cons-card ${isLive ? 'live' : ''}`}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                                <div>
                                                    <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{c.userId?.name || 'Pasien'}</span>
                                                    <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{c.userId?.email}</span>
                                                </div>
                                                <StatusBadge status={c.status} />
                                            </div>
                                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                                <span>📅 {fmtDT(c.scheduledAt)}</span>
                                                <span>⏱ Selesai: {fmtDT(c.scheduledEnd)}</span>
                                                {c.consultationType && <span>{c.consultationType === 'video_call' ? '📹 Video Call' : '💬 Chat'}</span>}
                                            </div>
                                            {c.symptoms && (
                                                <div style={{ fontSize: 12, color: '#374151', background: '#f8fafc', borderRadius: 7, padding: '7px 10px', marginBottom: 10 }}>
                                                    <strong>Keluhan:</strong> {c.symptoms.slice(0, 120)}{c.symptoms.length > 120 ? '…' : ''}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {canStart && (
                                                    <button disabled={!!proc} onClick={() => handleStart(c._id)}
                                                        style={{ padding: '6px 14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: proc ? .6 : 1 }}>
                                                        {proc === 'start' ? '...' : '▶ Mulai Sesi'}
                                                    </button>
                                                )}
                                                {canEnd && (
                                                    <button disabled={!!proc} onClick={() => handleEnd(c._id)}
                                                        style={{ padding: '6px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: proc ? .6 : 1 }}>
                                                        {proc === 'end' ? '...' : '⏹ Akhiri Sesi'}
                                                    </button>
                                                )}
                                                {canChat && (
                                                    <button onClick={() => navigate(`/consultations/${c._id}`)}
                                                        style={{ padding: '6px 14px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                                        💬 Buka Chat
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </>
                    )}

                    {/* ══ TAB: AVAILABILITY ══════════════════════════════════════ */}
                    {tab === 'availability' && (
                        <>
                            <div className="dd-header">
                                <div>
                                    <h1>Jadwal Praktik</h1>
                                    <p>Slot dibuat otomatis 7 hari ke depan · 30 mnt sesi + 30 mnt buffer</p>
                                </div>
                                {formChanged && (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="dd-btn-ghost" onClick={() => setAvailForm(avail)}>Batalkan</button>
                                        <button className="dd-btn-primary" disabled={availSaving} onClick={handleSaveAvail}>
                                            {availSaving ? '⏳ Menyimpan...' : '💾 Simpan Jadwal'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {availIsNew && (
                                <div className="dd-alert-banner dd-avail-not-set">
                                    <span style={{ fontSize: 20 }}>⚠️</span>
                                    <strong>Jadwal belum diatur.</strong> Pasien belum bisa melihat atau memilih slot konsultasi Anda. Isi pengaturan di bawah lalu klik <strong>Simpan Jadwal</strong>.
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                {/* Kiri: form */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                                    {/* Hari Praktik */}
                                    <div className="dd-card" style={{ padding: 20 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>📅 Hari Praktik</div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {DAYS.map(d => (
                                                <button key={d.v} className={`dd-day-btn ${availForm.practiceDays.includes(d.v) ? 'on' : ''}`}
                                                    onClick={() => toggleDay(d.v)}>
                                                    {d.l}
                                                </button>
                                            ))}
                                        </div>
                                        {availForm.practiceDays.length === 0 && (
                                            <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8, marginBottom: 0 }}>Pilih minimal satu hari</p>
                                        )}
                                        <p style={{ fontSize: 12, color: '#64748b', marginTop: 10, marginBottom: 0 }}>
                                            Dipilih: <strong>{availForm.practiceDays.map(d => DAY_FULL[d]).join(', ') || '—'}</strong>
                                        </p>
                                    </div>

                                    {/* Jam praktik */}
                                    <div className="dd-card" style={{ padding: 20 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>🕐 Jam Praktik (WIB)</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div>
                                                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Jam Mulai</label>
                                                <input type="time" className="dd-input" value={availForm.startTime}
                                                    onChange={e => setAvailForm(f => ({ ...f, startTime: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Jam Selesai</label>
                                                <input type="time" className="dd-input" value={availForm.endTime}
                                                    onChange={e => setAvailForm(f => ({ ...f, endTime: e.target.value }))} />
                                            </div>
                                        </div>
                                        {toMinutes(availForm.startTime) >= toMinutes(availForm.endTime) && (
                                            <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8, marginBottom: 0 }}>Jam mulai harus sebelum jam selesai</p>
                                        )}
                                    </div>

                                    {/* Break siang */}
                                    <div className="dd-card" style={{ padding: 20 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>☕ Break Siang</div>
                                        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>Slot pada jam ini tidak tersedia untuk pasien</p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div>
                                                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Mulai Break</label>
                                                <input type="time" className="dd-input" value={availForm.lunchBreakStart}
                                                    onChange={e => setAvailForm(f => ({ ...f, lunchBreakStart: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Selesai Break</label>
                                                <input type="time" className="dd-input" value={availForm.lunchBreakEnd}
                                                    onChange={e => setAvailForm(f => ({ ...f, lunchBreakEnd: e.target.value }))} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status aktif */}
                                    <div className="dd-card" style={{ padding: 20 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>✅ Terima Pasien Baru</div>
                                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Nonaktifkan untuk sementara berhenti menerima booking</div>
                                            </div>
                                            <label className="dd-toggle">
                                                <input type="checkbox" checked={availForm.isActive}
                                                    onChange={e => setAvailForm(f => ({ ...f, isActive: e.target.checked }))} />
                                                <span className="dd-toggle-slider" />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Save button */}
                                    <button
                                        className="dd-btn-primary"
                                        style={{ width: '100%', justifyContent: 'center', padding: 13 }}
                                        disabled={availSaving || availForm.practiceDays.length === 0 || previewSlots.length === 0}
                                        onClick={handleSaveAvail}>
                                        {availSaving ? '⏳ Menyimpan...' : '💾 Simpan Jadwal Praktik'}
                                    </button>
                                </div>

                                {/* Kanan: preview */}
                                <div>
                                    <div className="dd-card" style={{ padding: 20, position: 'sticky', top: 20 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>👁 Preview Slot per Hari</div>
                                        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                                            Slot yang akan tersedia untuk pasien setiap hari praktik
                                        </p>

                                        {previewSlots.length === 0 ? (
                                            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 9, padding: '12px 16px', fontSize: 13, color: '#991b1b' }}>
                                                ⚠️ Pengaturan ini tidak menghasilkan slot apapun
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                                    {previewSlots.map(s => (
                                                        <span key={s} className="dd-slot-chip">{s}</span>
                                                    ))}
                                                </div>
                                                <div style={{ background: '#f8fafc', borderRadius: 9, padding: '12px 14px', fontSize: 12, color: '#475569' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <span>Total slot/hari</span><strong>{previewSlots.length} slot</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <span>Durasi sesi</span><strong>30 menit</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <span>Buffer antar sesi</span><strong>30 menit</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>Break siang</span><strong>{availForm.lunchBreakStart}–{availForm.lunchBreakEnd}</strong>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Simulasi timeline */}
                                        {previewSlots.length > 0 && (
                                            <div style={{ marginTop: 16 }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Timeline Hari Contoh</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    {previewSlots.slice(0, 6).map((s, i) => {
                                                        const [h, m] = s.split(':').map(Number);
                                                        const endMin = h * 60 + m + 30;
                                                        const endH = Math.floor(endMin / 60), endM = endMin % 60;
                                                        return (
                                                            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <span style={{ width: 32, fontSize: 10, color: '#94a3b8', fontFamily: 'DM Mono, monospace', textAlign: 'right' }}>{s}</span>
                                                                <div style={{ flex: 1, height: 22, background: '#dbeafe', borderRadius: 5, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                                                                    <span style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 600 }}>
                                                                        Sesi {i + 1} · {s}–{String(endH).padStart(2,'0')}:{String(endM).padStart(2,'0')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {previewSlots.length > 6 && (
                                                        <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', margin: '4px 0 0' }}>
                                                            +{previewSlots.length - 6} slot lagi
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </>
    );
};

export default DoctorDashboard;
