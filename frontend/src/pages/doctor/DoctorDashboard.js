/**
 * DoctorDashboard.jsx  v2
 * Satu file untuk seluruh halaman dokter.
 * Tidak menggunakan Navbar — sidebar menggantikan navigasi.
 *
 * Sections:
 *  Beranda       — analytics 8 card + jadwal hari ini + reminder
 *  Janji Temu    — daftar + checkin/complete/cancel + realtime notif
 *  Konsultasi    — aktif/hari ini/riwayat + mulai/akhiri sesi + socket
 *  Pasien        — rekam medis (sub-tab: konsultasi | janji temu)
 *  Resep Obat    — buat resep per konsultasi + download PDF
 *  Surat Sakit   — buat/terbitkan/download PDF
 *  Atur Jadwal   — konsultasi online + janji temu (range waktu fixed)
 *  Pengaturan    — allowChat / allowVideoCall
 *  Profile       — nama, spesialisasi, pendidikan, gender, foto
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate }    from 'react-router-dom';
import { useAuth }        from '../../context/AuthContext';
import api                from '../../utils/api';
import { toast }          from 'react-hot-toast';

// ─── Config ────────────────────────────────────────────────────────────────────
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : '—';
const fmtDT = (d) => d
    ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB'
    : '—';
const toMin  = (t) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };
const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// ─── Schedule: fixed slot lists ────────────────────────────────────────────────
// Konsultasi online — 7 slot fixed (setiap jam :30)
const CONS_SLOTS = ['08:30','09:30','10:30','11:30','13:30','14:30','15:30'];
// Janji temu offline — 7 slot fixed (setiap jam tepat)
const APPT_SLOTS = ['08:00','09:00','10:00','11:00','13:00','14:00','15:00'];

const DAYS_INFO = [
    { val: 1, label: 'Senin' },
    { val: 2, label: 'Selasa' },
    { val: 3, label: 'Rabu' },
    { val: 4, label: 'Kamis' },
    { val: 5, label: 'Jumat' },
    { val: 6, label: 'Sabtu' },
];

// Default schedule — semua hari kosong (Senin–Sabtu, key '1'–'6')
const makeEmptySchedule = () => ({ '1':[],'2':[],'3':[],'4':[],'5':[],'6':[] });

const DEF_CONS = {
    schedule: makeEmptySchedule(),
    isActive: true,
};
const DEF_APPT = {
    schedule: makeEmptySchedule(),
    isActive: true,
};

// ─── Status maps ───────────────────────────────────────────────────────────────
const CONS_STATUS = {
    pending_payment    : { label: 'Menunggu Bayar',    color: '#b45309', bg: '#fffbeb' },
    confirmed          : { label: 'Terkonfirmasi',     color: '#1d4ed8', bg: '#eff6ff' },
    in_progress        : { label: '🟢 Berlangsung',    color: '#15803d', bg: '#f0fdf4' },
    completed          : { label: 'Selesai',           color: '#0e7490', bg: '#ecfeff' },
    no_show            : { label: 'Tdk Hadir',         color: '#b45309', bg: '#fffbeb' },
    cancelled_by_doctor: { label: 'Dibatalkan',        color: '#b91c1c', bg: '#fef2f2' },
    expired            : { label: 'Kadaluarsa',        color: '#6b7280', bg: '#f3f4f6' },
    paid               : { label: 'Terkonfirmasi',     color: '#1d4ed8', bg: '#eff6ff' },
    scheduled          : { label: 'Terjadwal',         color: '#7e22ce', bg: '#f5f3ff' },
    ongoing            : { label: '🟢 Berlangsung',    color: '#15803d', bg: '#f0fdf4' },
};
const APPT_STATUS = {
    scheduled           : { label: '📅 Terjadwal',    color: '#1d4ed8', bg: '#eff6ff' },
    checked_in          : { label: '✅ Hadir',         color: '#166534', bg: '#dcfce7' },
    completed           : { label: '🏁 Selesai',       color: '#0e7490', bg: '#ecfeff' },
    no_show             : { label: '❌ Tdk Hadir',     color: '#b45309', bg: '#fffbeb' },
    cancelled_by_user   : { label: '🚫 Batal (User)',  color: '#6b7280', bg: '#f3f4f6' },
    cancelled_by_doctor : { label: '🚫 Batal (Dokter)',color: '#b91c1c', bg: '#fef2f2' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

const colors = {
    primary : '#2563eb', primaryDark: '#1d4ed8',
    success : '#059669', successDark: '#047857',
    danger  : '#ef4444', dangerDark : '#dc2626',
    warning : '#f59e0b',
    sidebar : '#0f172a', sidebarHover: '#1e293b',
    bg      : '#f8fafc', card: '#ffffff',
    text    : '#0f172a', muted: '#64748b', subtle: '#94a3b8',
    border  : '#e2e8f0',
};

const Card = ({ children, style = {} }) => (
    <div style={{ background: colors.card, borderRadius: 14, border: `1px solid ${colors.border}`, ...style }}>
        {children}
    </div>
);

const Btn = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, style = {}, type = 'button' }) => {
    const base = {
        display: 'inline-flex', alignItems: 'center', gap: 6,
        border: 'none', borderRadius: 9, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', transition: 'opacity .15s',
        opacity: disabled ? 0.55 : 1,
        padding: size === 'sm' ? '5px 13px' : size === 'lg' ? '12px 26px' : '8px 18px',
        fontSize: size === 'sm' ? 12 : size === 'lg' ? 15 : 13,
    };
    const variants = {
        primary : { background: colors.primary, color: '#fff' },
        success : { background: colors.success, color: '#fff' },
        danger  : { background: colors.danger,  color: '#fff' },
        warning : { background: colors.warning, color: '#fff' },
        ghost   : { background: '#f1f5f9', color: colors.text },
        outline : { background: 'transparent', color: colors.primary, border: `1px solid ${colors.primary}` },
        red_outline: { background: 'transparent', color: colors.danger, border: `1px solid ${colors.danger}` },
    };
    return (
        <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...(variants[variant] || variants.primary), ...style }}>
            {children}
        </button>
    );
};

const Spinner = ({ size = 32 }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: size, height: size, border: `3px solid ${colors.border}`, borderTopColor: colors.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
);

const Empty = ({ icon = '📭', text = 'Tidak ada data' }) => (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: colors.muted }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>{icon}</div>
        <div style={{ fontSize: 14 }}>{text}</div>
    </div>
);

const SBadge = ({ status, map }) => {
    const cfg = map[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
    return (
        <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}25`, borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {cfg.label}
        </span>
    );
};

const Toggle = ({ checked, onChange, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onChange}>
        <div style={{
            width: 44, height: 24, borderRadius: 12, position: 'relative', transition: 'background .2s',
            background: checked ? colors.success : '#cbd5e1',
        }}>
            <div style={{
                width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute',
                top: 3, left: checked ? 23 : 3, transition: 'left .2s',
                boxShadow: '0 1px 3px rgba(0,0,0,.25)',
            }} />
        </div>
        {label && <span style={{ fontSize: 13, fontWeight: 600, color: checked ? colors.success : colors.muted }}>{label}</span>}
    </div>
);

const Modal = ({ open, onClose, title, children, width = 520 }) => {
    if (!open) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,.22)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: colors.text }}>{title}</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: colors.muted, lineHeight: 1 }}>×</button>
                </div>
                {children}
            </div>
        </div>
    );
};

const SectionHeader = ({ title, subtitle, action }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.text }}>{title}</h2>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.muted }}>{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
    </div>
);

/**
 * ScheduleGrid — per-hari slot toggler
 * schedule: { "1": ["08:30","09:30"], "2": [], ... }
 * allowedSlots: ["08:30","09:30",...]
 * onChange(dayVal: string, slot: string) — toggle satu slot
 * color: warna aktif
 */
const ScheduleGrid = ({ schedule, allowedSlots, onChange, color = colors.primary }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DAYS_INFO.map(day => {
            const key       = String(day.val);
            const activeSet = new Set(schedule[key] || []);
            const hasAny    = activeSet.size > 0;
            return (
                <div key={day.val} style={{
                    display: 'grid', gridTemplateColumns: '72px 1fr',
                    alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10,
                    background: hasAny ? `${color}08` : '#f8fafc',
                    border: `1px solid ${hasAny ? color + '30' : colors.border}`,
                    transition: 'all .15s',
                }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: hasAny ? color : colors.muted }}>{day.label}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {allowedSlots.map(slot => {
                            const active = activeSet.has(slot);
                            return (
                                <button key={slot} type="button" onClick={() => onChange(key, slot)} style={{
                                    padding: '5px 11px', borderRadius: 7, fontFamily: 'inherit',
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                                    border: `2px solid ${active ? color : colors.border}`,
                                    background: active ? color : '#fff',
                                    color: active ? '#fff' : colors.muted,
                                }}>
                                    {slot}
                                </button>
                            );
                        })}
                    </div>
                </div>
            );
        })}
    </div>
);

/**
 * SchedulePreview — ringkasan jadwal per hari
 */
const SchedulePreview = ({ schedule, color = colors.primary }) => {
    const activeDays = DAYS_INFO.filter(d => (schedule[String(d.val)] || []).length > 0);
    if (activeDays.length === 0) return (
        <div style={{ fontSize: 12, color: colors.danger, padding: '10px 0' }}>⚠ Belum ada slot yang dipilih</div>
    );
    const total = activeDays.reduce((s, d) => s + (schedule[String(d.val)] || []).length, 0);
    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeDays.map(day => {
                    const slots = schedule[String(day.val)] || [];
                    return (
                        <div key={day.val} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 52 }}>{day.label}</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {slots.map(s => (
                                    <span key={s} style={{ background: `${color}15`, color, border: `1px solid ${color}30`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                                        {s} WIB
                                    </span>
                                ))}
                            </div>
                            <span style={{ fontSize: 11, color: colors.muted }}>({slots.length} slot)</span>
                        </div>
                    );
                })}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: colors.muted, fontWeight: 600 }}>Total: {total} slot/minggu</div>
        </div>
    );
};

const TH = { padding: '11px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: colors.muted, borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap' };
const TD = { padding: '12px 14px', fontSize: 13, verticalAlign: 'middle' };


// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION BELL + PANEL
// ═══════════════════════════════════════════════════════════════════════════════
const NotifBell = ({ socketRef }) => {
    const [notifs, setNotifs]       = useState([]);
    const [unread, setUnread]       = useState(0);
    const [open, setOpen]           = useState(false);
    const [loading, setLoading]     = useState(false);
    const panelRef                  = useRef(null);

    const fetchNotifs = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/api/notifications');
            setNotifs(r.data.notifications || []);
            setUnread(r.data.unreadCount || 0);
        } catch { /* silently fail */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

    // Realtime via socket
    useEffect(() => {
        if (!socketRef?.current) return;
        const handler = (n) => {
            setNotifs(prev => [n, ...prev].slice(0, 50));
            setUnread(u => u + 1);
        };
        socketRef.current.on('new-notification', handler);
        socketRef.current.on('unread-count', (c) => setUnread(c));
        return () => {
            socketRef.current?.off('new-notification', handler);
        };
    }, [socketRef]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const markAllRead = async () => {
        try { await api.put('/api/notifications/read-all'); setUnread(0); setNotifs(prev => prev.map(n => ({ ...n, isRead: true }))); }
        catch { /* ignore */ }
    };

    const markOne = async (id) => {
        try { await api.put(`/api/notifications/${id}/read`); setNotifs(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n)); setUnread(u => Math.max(0, u - 1)); }
        catch { /* ignore */ }
    };

    const typeIcon = (type) => {
        if (type?.includes('appointment')) return '📅';
        if (type?.includes('consultation')) return '🩺';
        if (type?.includes('prescription')) return '💊';
        if (type?.includes('sick_letter'))  return '📄';
        return '🔔';
    };

    return (
        <div ref={panelRef} style={{ position: 'relative' }}>
            <button
                onClick={() => {
                    setOpen(o => {
                        if (!o) fetchNotifs();
                        return !o;
                    });
                }}
                style={{
                    position: 'relative', background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 10,
                    width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}
            >
                🔔
                {unread > 0 && (
                    <span style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '0 5px', minWidth: 16, textAlign: 'center', lineHeight: '16px' }}>
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {open && (() => {
                const rect = panelRef.current?.getBoundingClientRect();
                const panelLeft = rect ? rect.right + 10 : 260;
                const panelTop  = rect ? Math.max(8, rect.top - 4) : 12;
                return (
                <div style={{
                    position: 'fixed', left: panelLeft, top: panelTop, width: 340,
                    background: '#fff', borderRadius: 14,
                    boxShadow: '0 12px 40px rgba(0,0,0,.22)', zIndex: 10000, overflow: 'hidden',
                    border: `1px solid ${colors.border}`,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${colors.border}` }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>Notifikasi</span>
                        {unread > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: colors.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Tandai semua dibaca</button>}
                    </div>
                    <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                        {loading ? <Spinner size={24} /> : notifs.length === 0 ? <Empty icon="🔔" text="Belum ada notifikasi" /> : (
                            notifs.map(n => (
                                <div key={n._id} onClick={() => markOne(n._id)} style={{
                                    padding: '13px 18px', borderBottom: `1px solid #f8fafc`, cursor: 'pointer',
                                    background: n.isRead ? '#fff' : '#eff6ff',
                                    display: 'flex', gap: 12, alignItems: 'flex-start',
                                }}>
                                    <span style={{ fontSize: 20, flexShrink: 0 }}>{typeIcon(n.type)}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: n.isRead ? 500 : 700, fontSize: 13, color: colors.text, marginBottom: 2 }}>{n.title}</div>
                                        <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.4 }}>{n.message}</div>
                                        <div style={{ fontSize: 11, color: colors.subtle, marginTop: 4 }}>{fmtDT(n.createdAt)}</div>
                                    </div>
                                    {!n.isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.primary, flexShrink: 0, marginTop: 4 }} />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
                );
            })()}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: BERANDA
// ═══════════════════════════════════════════════════════════════════════════════
const SectionBeranda = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats]       = useState(null);
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [time, setTime]         = useState(new Date());
    const [reminders, setReminders] = useState([]);

    useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [statsRes, schedRes] = await Promise.allSettled([
                api.get('/api/doctors/my/stats'),
                api.get('/api/doctors/my/schedule-today'),
            ]);
            if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.stats);
            if (schedRes.status === 'fulfilled') {
                const sched = schedRes.value.data.schedule || [];
                setSchedule(sched);
                // Reminder: jadwal dalam 1 jam ke depan
                const nowMs = Date.now();
                const soon = sched.filter(s => {
                    if (!s.scheduledAt) return false;
                    const diff = new Date(s.scheduledAt).getTime() - nowMs;
                    return diff > 0 && diff <= 60 * 60 * 1000;
                });
                setReminders(soon);
            }
        } catch { toast.error('Gagal memuat data beranda'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // H-24 reminder toast on mount
    useEffect(() => {
        if (schedule.length === 0) return;
        const nowMs = Date.now();
        schedule.forEach(s => {
            if (!s.scheduledAt) return;
            const diff = new Date(s.scheduledAt).getTime() - nowMs;
            if (diff > 23 * 3600000 && diff <= 25 * 3600000) {
                toast(`⏰ Reminder: ${s.patientName} — ${s.type === 'consultation' ? 'Konsultasi Online' : 'Janji Temu'} besok pukul ${s.time}`, { duration: 8000, icon: '🗓️' });
            }
        });
    }, [schedule]);

    const greeting = () => {
        const h = time.getHours();
        if (h < 11) return 'Selamat Pagi';
        if (h < 15) return 'Selamat Siang';
        if (h < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    };

    const METRIC_CARDS = stats ? [
        { label: 'Pasien Hari Ini',          val: stats.apptToday,      icon: '👥', color: '#7c3aed', bg: '#f5f3ff' },
        { label: 'Konsultasi Online Hari Ini',val: stats.consToday,      icon: '🩺', color: '#2563eb', bg: '#eff6ff' },
        { label: 'Konsultasi Selesai',        val: stats.consCompleted,  icon: '✅', color: '#059669', bg: '#f0fdf4' },
        { label: 'Konsultasi Upcoming',       val: stats.consUpcoming,   icon: '⏳', color: '#d97706', bg: '#fffbeb' },
        { label: 'Konsultasi Dibatalkan',     val: stats.consCancelled,  icon: '🚫', color: '#dc2626', bg: '#fef2f2' },
        { label: 'Janji Temu Upcoming',       val: stats.apptUpcoming,   icon: '📅', color: '#0891b2', bg: '#ecfeff' },
        { label: 'Janji Temu Dibatalkan',     val: stats.apptCancelled,  icon: '❌', color: '#b45309', bg: '#fffbeb' },
        { label: `⭐ ${stats.rating?.toFixed(1) || '0.0'} (${stats.totalReviews} review)`, val: stats.rating?.toFixed(1) || '—', icon: '⭐', color: '#ca8a04', bg: '#fefce8', isRating: true },
    ] : [];

    return (
        <div>
            {/* Header strip */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #2563eb 100%)', borderRadius: 18, padding: '26px 30px', marginBottom: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 54, height: 54, borderRadius: 14, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🩺</div>
                    <div>
                        <div style={{ fontSize: 13, color: '#93c5fd' }}>{greeting()},</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>dr. {user?.name}</div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>
                        {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 13, color: '#93c5fd', marginTop: 2 }}>
                        {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <Btn size="sm" variant="ghost" style={{ marginTop: 8, background: 'rgba(255,255,255,.12)', color: '#e0f2fe', border: 'none' }} onClick={fetchData}>↻ Refresh</Btn>
                </div>
            </div>

            {/* Reminder banner */}
            {reminders.length > 0 && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 13, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>⏰</span>
                    <div>
                        <strong style={{ color: '#92400e', fontSize: 14 }}>Reminder — Jadwal dalam 1 Jam:</strong>
                        {reminders.map(r => (
                            <div key={r._id} style={{ fontSize: 13, color: '#78350f', marginTop: 2 }}>
                                {r.time} — {r.patientName} ({r.type === 'consultation' ? 'Konsultasi Online' : 'Janji Temu'})
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading ? <Spinner /> : (
                <>
                    {/* Metric cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 14, marginBottom: 26 }}>
                        {METRIC_CARDS.map((c, i) => (
                            <Card key={i} style={{ padding: '18px 20px' }}>
                                <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
                                <div style={{ fontSize: c.isRating ? 20 : 30, fontWeight: 800, color: c.color, letterSpacing: -1 }}>{c.val}</div>
                                <div style={{ fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 1.3 }}>{c.label}</div>
                            </Card>
                        ))}
                    </div>

                    {/* Jadwal hari ini */}
                    <Card>
                        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>📋 Jadwal Hari Ini</div>
                            <span style={{ fontSize: 12, color: colors.muted }}>{schedule.length} jadwal</span>
                        </div>
                        {schedule.length === 0 ? <Empty icon="🗓️" text="Tidak ada jadwal hari ini" /> : (
                            <div style={{ padding: '10px 22px 18px' }}>
                                {schedule.map((s, i) => (
                                    <div key={`${s._id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px', borderRadius: 10, marginBottom: 7, background: '#f8fafc', cursor: s.type === 'consultation' ? 'pointer' : 'default' }}
                                        onClick={() => s.type === 'consultation' && navigate(`/consultations/${s._id}`)}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: colors.primary, width: 50, flexShrink: 0 }}>{s.time}</div>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.type === 'consultation' ? '#2563eb' : '#7c3aed', flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, color: colors.text }}>{s.patientName}</div>
                                            <div style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
                                                {s.type === 'consultation' ? `💬 Konsultasi Online${s.consultationType === 'video_call' ? ' (Video)' : ''}` : '📅 Janji Temu'}
                                            </div>
                                        </div>
                                        <SBadge status={s.status} map={{ ...CONS_STATUS, ...APPT_STATUS }} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </>
            )}
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: JANJI TEMU
// ═══════════════════════════════════════════════════════════════════════════════
const SectionJanjiTemu = ({ socketRef }) => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [dateFilter, setDateFilter]   = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [processing, setProcessing] = useState({});
    const [completeTarget, setCompleteTarget] = useState(null);
    const [completeNotes, setCompleteNotes]   = useState('');
    const [completeAssessment, setCompleteAssessment] = useState('');
    const [completePlan, setCompletePlan]     = useState('');
    const [completing, setCompleting]         = useState(false);
    const [cancelTarget, setCancelTarget]     = useState(null);
    const [cancelReason, setCancelReason]     = useState('');
    const [cancelling, setCancelling]         = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateFilter) params.date = dateFilter;
            if (statusFilter !== 'all') params.status = statusFilter;
            const r = await api.get('/api/appointments/doctor/list', { params });
            setAppointments(r.data.appointments || []);
        } catch { toast.error('Gagal memuat janji temu'); }
        finally { setLoading(false); }
    }, [dateFilter, statusFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Socket: realtime new appointment
    useEffect(() => {
        if (!socketRef?.current) return;
        const handler = (n) => {
            if (n.type === 'appointment_reminder' || n.type === 'appointment_request') {
                fetchData();
                toast('📅 Janji temu baru masuk!', { icon: '📅' });
            }
        };
        socketRef.current.on('new-notification', handler);
        return () => socketRef.current?.off('new-notification', handler);
    }, [socketRef, fetchData]);

    // Polling fallback every 30s
    useEffect(() => {
        const t = setInterval(fetchData, 30000);
        return () => clearInterval(t);
    }, [fetchData]);

    const doCheckin = async (id) => {
        setProcessing(p => ({ ...p, [id]: 'ci' }));
        try { await api.put(`/api/appointments/doctor/${id}/checkin`); toast.success('Check-in berhasil ✅'); fetchData(); }
        catch (e) { toast.error(e.response?.data?.message || 'Gagal check-in'); }
        finally { setProcessing(p => ({ ...p, [id]: null })); }
    };

    const doComplete = async () => {
        if (!completeAssessment.trim()) { toast.error('Diagnosis wajib diisi'); return; }
        if (!completePlan.trim())       { toast.error('Rencana Terapi wajib diisi'); return; }
        setCompleting(true);
        try {
            await api.put(`/api/appointments/doctor/${completeTarget._id}/complete`, {
                notes:             completeNotes,
                assessment:        completeAssessment,
                plan:              completePlan,
                objectiveFindings: completeNotes,
            });
            toast.success('Janji temu selesai ✅');
            setCompleteTarget(null);
            setCompleteNotes('');
            setCompleteAssessment('');
            setCompletePlan('');
            fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal'); }
        finally { setCompleting(false); }
    };

    const doCancel = async () => {
        if (cancelReason.trim().length < 5) { toast.error('Alasan minimal 5 karakter'); return; }
        setCancelling(true);
        try {
            await api.put(`/api/appointments/doctor/${cancelTarget._id}/cancel`, { reason: cancelReason });
            toast.success('Janji temu dibatalkan'); setCancelTarget(null); setCancelReason(''); fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal'); }
        finally { setCancelling(false); }
    };

    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    const todayStr   = new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
    const todayCount = appointments.filter(a => {
        if (!a.appointmentDate) return false;
        return new Date(new Date(a.appointmentDate).getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10) === todayStr;
    }).length;

    return (
        <div>
            <SectionHeader title="Janji Temu" subtitle="Kelola jadwal janji temu pasien klinik"
                action={<Btn size="sm" variant="ghost" onClick={fetchData}>↻ Refresh</Btn>} />

            {/* Stats */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
                {[
                    { label: 'Hari Ini',     val: todayCount,                                                   color: '#7c3aed' },
                    { label: 'Terjadwal',    val: appointments.filter(a => a.status === 'scheduled').length,    color: '#2563eb' },
                    { label: 'Sudah Hadir',  val: appointments.filter(a => a.status === 'checked_in').length,   color: '#059669' },
                ].map(s => (
                    <Card key={s.label} style={{ padding: '14px 20px', flex: '1 1 110px' }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>{s.label}</div>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card style={{ padding: '14px 18px', marginBottom: 18 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.muted, marginBottom: 5 }}>Tanggal</label>
                        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                            style={{ padding: '7px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.muted, marginBottom: 5 }}>Status</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                            style={{ padding: '7px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
                            <option value="all">Semua Status</option>
                            {Object.entries(APPT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </div>
                    <Btn size="sm" variant="ghost" onClick={() => { setDateFilter(''); setStatusFilter('all'); }}>Reset</Btn>
                </div>
            </Card>

            {loading ? <Spinner /> : appointments.length === 0 ? <Empty icon="📅" text="Tidak ada janji temu" /> : (
                <Card>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>{['Pasien', 'Tanggal', 'Jam', 'Keluhan', 'Status', 'Aksi'].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {appointments.map((a, i) => {
                                    const proc = processing[a._id];
                                    const canCI    = a.status === 'scheduled';
                                    const canComp  = a.status === 'checked_in';
                                    const canCancl = a.status === 'scheduled' && (new Date(a.scheduledAt || a.appointmentDate).getTime() - Date.now() > 24 * 3600000);
                                    const accent   = APPT_STATUS[a.status]?.color || colors.border;
                                    return (
                                        <tr key={a._id} style={{ borderBottom: `1px solid #f8fafc`, background: i % 2 ? '#fafafa' : '#fff', borderLeft: `3px solid ${accent}` }}>
                                            <td style={TD}>
                                                <div style={{ fontWeight: 600, color: colors.text }}>{a.userId?.name}</div>
                                                <div style={{ fontSize: 11, color: colors.subtle }}>{a.userId?.phone}</div>
                                            </td>
                                            <td style={{ ...TD, whiteSpace: 'nowrap', color: colors.muted }}>{fmtDate(a.appointmentDate)}</td>
                                            <td style={{ ...TD, fontWeight: 700, color: colors.text, whiteSpace: 'nowrap' }}>{a.appointmentTime}</td>
                                            <td style={{ ...TD, color: colors.muted, maxWidth: 160 }}>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.complaint || '—'}</div>
                                                {a.cancelReason && <div style={{ fontSize: 11, color: colors.danger }}>Alasan: {a.cancelReason}</div>}
                                            </td>
                                            <td style={TD}><SBadge status={a.status} map={APPT_STATUS} /></td>
                                            <td style={TD}>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    {canCI   && <Btn size="sm" variant="success" disabled={!!proc} onClick={() => doCheckin(a._id)}>{proc === 'ci' ? '…' : '✅ Check-in'}</Btn>}
                                                    {canComp && <Btn size="sm" variant="primary" onClick={() => { setCompleteTarget(a); setCompleteNotes(''); setCompleteAssessment(''); setCompletePlan(''); }}>🏁 Selesai</Btn>}
                                                    {canCancl && <Btn size="sm" variant="red_outline" onClick={() => { setCancelTarget(a); setCancelReason(''); }}>❌ Batal</Btn>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Complete modal — rekam medis wajib */}
            <Modal open={!!completeTarget} onClose={() => setCompleteTarget(null)} title="🏁 Selesaikan Janji Temu">
                <p style={{ margin: '0 0 14px', color: colors.muted, fontSize: 14 }}>
                    Pasien: <strong>{completeTarget?.userId?.name}</strong> — pukul <strong>{completeTarget?.appointmentTime}</strong>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text }}>
                            Pemeriksaan Fisik / Temuan Objektif <span style={{ color: colors.muted, fontWeight: 400 }}>(opsional)</span>
                        </label>
                        <textarea value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} rows={2}
                            placeholder="Tekanan darah, suhu, temuan fisik..."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text }}>
                            Diagnosis <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea value={completeAssessment} onChange={e => setCompleteAssessment(e.target.value)} rows={2}
                            placeholder="Contoh: ISPA ringan, Gastritis akut..."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${!completeAssessment.trim() ? '#fca5a5' : colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text }}>
                            Rencana Terapi / Tindakan <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea value={completePlan} onChange={e => setCompletePlan(e.target.value)} rows={2}
                            placeholder="Contoh: Pemberian antibiotik amoxicillin 3x500mg, istirahat 3 hari..."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${!completePlan.trim() ? '#fca5a5' : colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                </div>
                <p style={{ fontSize: 11, color: colors.muted, margin: '8px 0 14px' }}>
                    <span style={{ color: '#ef4444' }}>*</span> Diagnosis dan Rencana Terapi wajib diisi sebelum menyelesaikan janji.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <Btn variant="ghost" onClick={() => setCompleteTarget(null)}>Batal</Btn>
                    <Btn variant="success" onClick={doComplete} disabled={completing || !completeAssessment.trim() || !completePlan.trim()}>
                        {completing ? '…' : '✅ Tandai Selesai'}
                    </Btn>
                </div>
            </Modal>

            {/* Cancel modal */}
            <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="❌ Batalkan Janji Temu">
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#b91c1c' }}>
                    <strong>{cancelTarget?.userId?.name}</strong> — pukul {cancelTarget?.appointmentTime}
                </div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: colors.text }}>Alasan Pembatalan *</label>
                <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
                    placeholder="Masukkan alasan pembatalan (min 5 karakter)..."
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 18 }} />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <Btn variant="ghost" onClick={() => setCancelTarget(null)}>Batal</Btn>
                    <Btn variant="danger" onClick={doCancel} disabled={cancelling}>{cancelling ? '…' : 'Konfirmasi Batalkan'}</Btn>
                </div>
            </Modal>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: KONSULTASI ONLINE
// ═══════════════════════════════════════════════════════════════════════════════
const SectionKonsultasi = ({ socketRef }) => {
    const navigate = useNavigate();
    const [tab, setTab]           = useState('active');
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [processing, setProcessing] = useState({});

    // Socket realtime
    useEffect(() => {
        if (!socketRef?.current) return;
        const handler = ({ consultationId, status }) => {
            setConsultations(prev => prev.map(c => c._id === consultationId ? { ...c, status } : c));
        };
        const notifHandler = (n) => {
            if (n.type?.includes('consultation')) { fetchAll(); }
        };
        socketRef.current.on('consultation-status-update', handler);
        socketRef.current.on('new-notification', notifHandler);
        return () => {
            socketRef.current?.off('consultation-status-update', handler);
            socketRef.current?.off('new-notification', notifHandler);
        };
    }, [socketRef]);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [ar, hr] = await Promise.all([
                api.get('/api/consultations/doctor/pending'),
                api.get('/api/consultations/doctor/history'),
            ]);
            const map = new Map();
            [...(ar.data?.consultations || []), ...(hr.data?.consultations || [])].forEach(c => map.set(c._id, c));
            setConsultations(Array.from(map.values()));
        } catch { toast.error('Gagal memuat konsultasi'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const activeList = consultations.filter(c => ['confirmed','in_progress','paid','scheduled'].includes(c.status));
    const todayList  = consultations.filter(c => {
        if (!c.scheduledAt) return false;
        return new Date(c.scheduledAt).toDateString() === new Date().toDateString();
    });
    const histList   = consultations.filter(c => ['completed','no_show','doctor_no_show','cancelled_by_doctor','expired'].includes(c.status));
    const shown      = { active: activeList, today: todayList, history: histList }[tab] || [];

    const handleStart = async (id) => {
        setProcessing(p => ({ ...p, [id]: 'start' }));
        try {
            const r = await api.put(`/api/consultations/${id}/start`);
            setConsultations(prev => prev.map(c => c._id === id ? r.data.consultation : c));
            toast.success('Sesi konsultasi dimulai');
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal memulai'); }
        finally { setProcessing(p => ({ ...p, [id]: null })); }
    };

    const [endTarget,     setEndTarget]     = useState(null);
    const [endAssessment, setEndAssessment] = useState('');
    const [endPlan,       setEndPlan]       = useState('');
    const [endObjective,  setEndObjective]  = useState('');
    const [ending,        setEnding]        = useState(false);

    const handleEnd = (id) => {
        const c = consultations.find(x => x._id === id);
        setEndTarget(c || { _id: id });
        setEndAssessment(''); setEndPlan(''); setEndObjective('');
    };

    const doEnd = async () => {
        if (!endAssessment.trim()) { toast.error('Diagnosis wajib diisi'); return; }
        if (!endPlan.trim())       { toast.error('Rencana Terapi wajib diisi'); return; }
        setEnding(true);
        try {
            const r = await api.put(`/api/consultations/${endTarget._id}/end`, {
                assessment:        endAssessment,
                plan:              endPlan,
                objectiveFindings: endObjective,
            });
            setConsultations(prev => prev.map(c => c._id === endTarget._id ? r.data.consultation : c));
            toast.success('Sesi konsultasi selesai ✅');
            setEndTarget(null);
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal mengakhiri'); }
        finally { setEnding(false); }
    };

    const TABS = [
        { key: 'active', label: 'Aktif & Upcoming', count: activeList.length },
        { key: 'today',  label: 'Hari Ini',          count: todayList.length },
        { key: 'history',label: 'Riwayat',            count: null },
    ];

    return (
        <div>
            <SectionHeader title="Konsultasi Online" subtitle="Kelola sesi konsultasi pasien"
                action={<Btn size="sm" variant="ghost" onClick={fetchAll}>↻ Refresh</Btn>} />

            {/* Stats */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
                {[
                    { label: 'Aktif/Upcoming',      val: activeList.length,   color: '#2563eb' },
                    { label: 'Hari Ini',             val: todayList.length,    color: '#059669' },
                    { label: 'Sedang Berlangsung',   val: consultations.filter(c => c.status === 'in_progress').length, color: '#dc2626' },
                ].map(s => (
                    <Card key={s.label} style={{ padding: '14px 20px', flex: '1 1 120px' }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>{s.label}</div>
                    </Card>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
                        cursor: 'pointer', fontFamily: 'inherit',
                        background: tab === t.key ? '#fff' : 'transparent',
                        color: tab === t.key ? colors.text : colors.muted,
                        boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                    }}>
                        {t.label}
                        {t.count > 0 && <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{t.count}</span>}
                    </button>
                ))}
            </div>

            {loading ? <Spinner /> : shown.length === 0 ? <Empty icon="🩺" text="Tidak ada konsultasi" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {shown.map(c => {
                        const canStart = c.status === 'confirmed';
                        const canEnd   = c.status === 'in_progress';
                        const canChat  = ['confirmed','in_progress','completed','no_show','paid','scheduled','ongoing'].includes(c.status);
                        const proc     = processing[c._id];
                        return (
                            <Card key={c._id} style={{ padding: '16px 20px', border: c.status === 'in_progress' ? '2px solid #22c55e' : undefined }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>{c.userId?.name}</div>
                                        <div style={{ fontSize: 12, color: colors.muted }}>{c.userId?.email} {c.userId?.phone && `· ${c.userId.phone}`}</div>
                                    </div>
                                    <SBadge status={c.status} map={CONS_STATUS} />
                                </div>
                                <div style={{ fontSize: 13, color: colors.muted, marginBottom: 10 }}>
                                    📅 <strong>{fmtDT(c.scheduledAt)}</strong>
                                    {c.consultationType && <span style={{ marginLeft: 12 }}>{c.consultationType === 'video_call' ? '📹 Video Call' : '💬 Chat'}</span>}
                                </div>
                                {c.symptoms && (
                                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: colors.muted, marginBottom: 12 }}>
                                        <strong>Keluhan:</strong> {c.symptoms.slice(0, 150)}{c.symptoms.length > 150 ? '…' : ''}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {canStart && <Btn size="sm" variant="success" disabled={!!proc} onClick={() => handleStart(c._id)}>{proc === 'start' ? '…' : '▶ Mulai Sesi'}</Btn>}
                                    {canEnd   && <Btn size="sm" variant="danger"  onClick={() => handleEnd(c._id)}>⏹ Akhiri Sesi</Btn>}
                                    {canChat  && <Btn size="sm" variant="outline" onClick={() => navigate(`/consultations/${c._id}`)}>💬 Buka Chat</Btn>}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modal Akhiri Sesi — rekam medis wajib */}
            <Modal open={!!endTarget} onClose={() => setEndTarget(null)} title="⏹ Akhiri Sesi Konsultasi">
                <p style={{ margin: '0 0 14px', color: colors.muted, fontSize: 14 }}>
                    Pasien: <strong>{endTarget?.userId?.name || '—'}</strong>
                    {endTarget?.scheduledAt && <> — <strong>{new Date(endTarget.scheduledAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB</strong></>}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text }}>
                            Pemeriksaan Fisik / Temuan Objektif <span style={{ color: colors.muted, fontWeight: 400 }}>(opsional)</span>
                        </label>
                        <textarea value={endObjective} onChange={e => setEndObjective(e.target.value)} rows={2}
                            placeholder="Temuan dari pemeriksaan fisik, hasil lab, dll..."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text }}>
                            Diagnosis <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea value={endAssessment} onChange={e => setEndAssessment(e.target.value)} rows={2}
                            placeholder="Contoh: ISPA ringan, Gastritis akut, Hipertensi grade I..."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${!endAssessment.trim() ? '#fca5a5' : colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text }}>
                            Rencana Terapi / Tindakan <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea value={endPlan} onChange={e => setEndPlan(e.target.value)} rows={2}
                            placeholder="Contoh: Amoxicillin 3x500mg 5 hari, istirahat, kontrol jika tidak membaik..."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${!endPlan.trim() ? '#fca5a5' : colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                </div>
                <p style={{ fontSize: 11, color: colors.muted, margin: '8px 0 14px' }}>
                    <span style={{ color: '#ef4444' }}>*</span> Diagnosis dan Rencana Terapi wajib diisi. Rekam medis ini akan tersedia untuk pasien.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <Btn variant="ghost" onClick={() => setEndTarget(null)}>Batal</Btn>
                    <Btn variant="danger" onClick={doEnd} disabled={ending || !endAssessment.trim() || !endPlan.trim()}>
                        {ending ? '…' : '⏹ Akhiri & Simpan Rekam Medis'}
                    </Btn>
                </div>
            </Modal>
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: PASIEN — Rekam Medis (sub-tab: Konsultasi | Janji Temu)
// ═══════════════════════════════════════════════════════════════════════════════
const SectionPasien = () => {
    const navigate = useNavigate();
    const [patientTab, setPatientTab] = useState('konsultasi');
    const [consultations, setConsultations] = useState([]);
    const [appointments, setAppointments]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [search, setSearch]     = useState('');
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [cr, ar] = await Promise.allSettled([
                    api.get('/api/consultations/doctor/all'),
                    api.get('/api/appointments/doctor/list'),
                ]);
                if (cr.status === 'fulfilled') setConsultations(cr.value.data.consultations || cr.value.data || []);
                if (ar.status === 'fulfilled') setAppointments((ar.value.data.appointments || []).filter(a => a.status === 'completed'));
            } catch { toast.error('Gagal memuat data pasien'); }
            finally { setLoading(false); }
        };
        load();
    }, []);

    const filteredCons = consultations.filter(c => {
        const q = search.toLowerCase();
        return !search || c.userId?.name?.toLowerCase().includes(q) || c.userId?.phone?.includes(search) || c.symptoms?.toLowerCase().includes(q);
    });

    const filteredAppts = appointments.filter(a => {
        const q = search.toLowerCase();
        return !search || a.userId?.name?.toLowerCase().includes(q) || a.userId?.phone?.includes(search);
    });

    const uniqueCons  = [...new Map(consultations.filter(c => c.userId?._id).map(c => [c.userId._id, c.userId])).values()];
    const uniqueAppts = [...new Map(appointments.filter(a => a.userId?._id).map(a => [a.userId._id, a.userId])).values()];

    return (
        <div>
            <SectionHeader title="Pasien" subtitle={`${uniqueCons.length} pasien konsultasi · ${uniqueAppts.length} pasien janji temu`} />

            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
                {[['konsultasi','🩺 Konsultasi Online'],['janji','📅 Janji Temu']].map(([k, l]) => (
                    <button key={k} onClick={() => setPatientTab(k)} style={{
                        padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
                        cursor: 'pointer', fontFamily: 'inherit',
                        background: patientTab === k ? '#fff' : 'transparent',
                        color: patientTab === k ? colors.text : colors.muted,
                        boxShadow: patientTab === k ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                    }}>{l}</button>
                ))}
            </div>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, nomor HP, atau keluhan..."
                    style={{ padding: '9px 14px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%', maxWidth: 400, boxSizing: 'border-box' }} />
            </div>

            {loading ? <Spinner /> : (
                <>
                    {/* === TAB: KONSULTASI === */}
                    {patientTab === 'konsultasi' && (
                        filteredCons.length === 0 ? <Empty icon="🩺" text="Belum ada data pasien konsultasi" /> : (
                            <Card>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead><tr>{['Pasien', 'Keluhan', 'Tanggal', 'Pesan', 'Surat Sakit', 'Status', 'Aksi'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                                        <tbody>
                                            {filteredCons.map((c, i) => {
                                                const sc = CONS_STATUS[c.status] || { label: c.status, color: '#6b7280', bg: '#f3f4f6' };
                                                return (
                                                    <tr key={c._id} style={{ borderBottom: `1px solid #f8fafc`, background: i % 2 ? '#fafafa' : '#fff' }}>
                                                        <td style={TD}>
                                                            <div style={{ fontWeight: 600, color: colors.text }}>{c.userId?.name}</div>
                                                            <div style={{ fontSize: 11, color: colors.subtle }}>{c.userId?.phone || c.userId?.email}</div>
                                                        </td>
                                                        <td style={{ ...TD, maxWidth: 170, color: colors.muted }}>
                                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(c.symptoms || '—').slice(0, 60)}</div>
                                                        </td>
                                                        <td style={{ ...TD, fontSize: 12, color: colors.subtle, whiteSpace: 'nowrap' }}>{new Date(c.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                                        <td style={{ ...TD, textAlign: 'center' }}>
                                                            <span style={{ background: '#f1f5f9', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '2px 8px', fontSize: 12, color: colors.muted }}>💬 {c.messages?.length || 0}</span>
                                                        </td>
                                                        <td style={TD}>
                                                            {c.sickLetter
                                                                ? <span style={{ background: c.sickLetter.status === 'issued' ? '#dcfce7' : '#fef3c7', color: c.sickLetter.status === 'issued' ? '#166534' : '#92400e', borderRadius: 8, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                                                                    {c.sickLetter.status === 'issued' ? '✓ Terbit' : '📝 Draft'}
                                                                </span>
                                                                : <span style={{ fontSize: 12, color: colors.border }}>—</span>}
                                                        </td>
                                                        <td style={TD}><SBadge status={c.status} map={CONS_STATUS} /></td>
                                                        <td style={TD}><Btn size="sm" variant="ghost" onClick={() => setSelected({ type: 'cons', data: c })}>Detail</Btn></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )
                    )}

                    {/* === TAB: JANJI TEMU (hanya completed) === */}
                    {patientTab === 'janji' && (
                        filteredAppts.length === 0 ? <Empty icon="📅" text="Belum ada rekam medis janji temu" /> : (
                            <Card>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead><tr>{['Pasien', 'Tanggal', 'Jam', 'Keluhan', 'Catatan Dokter', 'Aksi'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                                        <tbody>
                                            {filteredAppts.map((a, i) => (
                                                <tr key={a._id} style={{ borderBottom: `1px solid #f8fafc`, background: i % 2 ? '#fafafa' : '#fff' }}>
                                                    <td style={TD}>
                                                        <div style={{ fontWeight: 600, color: colors.text }}>{a.userId?.name}</div>
                                                        <div style={{ fontSize: 11, color: colors.subtle }}>{a.userId?.phone}</div>
                                                    </td>
                                                    <td style={{ ...TD, whiteSpace: 'nowrap', color: colors.muted }}>{fmtDate(a.appointmentDate)}</td>
                                                    <td style={{ ...TD, fontWeight: 600, color: colors.text }}>{a.appointmentTime}</td>
                                                    <td style={{ ...TD, maxWidth: 160, color: colors.muted }}>
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.complaint || '—'}</div>
                                                    </td>
                                                    <td style={{ ...TD, maxWidth: 200, color: colors.muted }}>
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.notes || <em style={{ color: colors.border }}>Belum ada catatan</em>}</div>
                                                    </td>
                                                    <td style={TD}><Btn size="sm" variant="ghost" onClick={() => setSelected({ type: 'appt', data: a })}>Detail</Btn></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )
                    )}
                </>
            )}

            {/* Modal detail konsultasi */}
            <Modal open={!!(selected?.type === 'cons')} onClose={() => setSelected(null)} title="Detail Rekam Medis Konsultasi" width={600}>
                {selected?.type === 'cons' && (() => { const c = selected.data; return (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                            <div style={{ background: '#f8fafc', borderRadius: 11, padding: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: colors.muted, marginBottom: 8 }}>INFO PASIEN</div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{c.userId?.name}</div>
                                <div style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>{c.userId?.email}</div>
                                <div style={{ fontSize: 12, color: colors.muted }}>{c.userId?.phone || '—'}</div>
                            </div>
                            <div style={{ background: '#f8fafc', borderRadius: 11, padding: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: colors.muted, marginBottom: 8 }}>STATUS</div>
                                <SBadge status={c.status} map={CONS_STATUS} />
                                <div style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>Pesan: {c.messages?.length || 0}</div>
                            </div>
                        </div>
                        <div style={{ background: '#f8fafc', borderRadius: 11, padding: 16, marginBottom: 14 }}>
                            {[
                                ['Keluhan', c.symptoms || '—'],
                                ['Diagnosis', c.medicalRecord?.assessment || c.diagnosis || 'Belum diisi'],
                                ['Temuan Objektif', c.medicalRecord?.objectiveFindings || '—'],
                                ['Rencana Terapi', c.medicalRecord?.plan || '—'],
                                ['Resep', c.prescriptionData ? `${c.prescriptionData.medicines?.length || 0} obat` : (c.prescription || '—')],
                            ].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 13 }}>
                                    <div style={{ width: 130, fontWeight: 600, color: colors.muted, flexShrink: 0 }}>{k}</div>
                                    <div style={{ color: colors.text }}>{v}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <Btn variant="ghost" onClick={() => setSelected(null)}>Tutup</Btn>
                            {['ongoing','in_progress'].includes(c.status) && <Btn variant="primary" onClick={() => { navigate(`/consultations/${c._id}`); setSelected(null); }}>💬 Buka Chat</Btn>}
                            {['completed','no_show'].includes(c.status) && !c.medicalRecord?.isCompleted && (
                                <Btn variant="outline" onClick={() => { navigate(`/consultations/${c._id}`); setSelected(null); }}>📋 Lengkapi Rekam Medis</Btn>
                            )}
                        </div>
                    </div>
                ); })()}
            </Modal>

            {/* Modal detail janji temu */}
            <Modal open={!!(selected?.type === 'appt')} onClose={() => setSelected(null)} title="Detail Rekam Medis Janji Temu">
                {selected?.type === 'appt' && (() => { const a = selected.data; return (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                            <div style={{ background: '#f8fafc', borderRadius: 11, padding: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: colors.muted, marginBottom: 8 }}>INFO PASIEN</div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{a.userId?.name}</div>
                                <div style={{ fontSize: 12, color: colors.muted }}>{a.userId?.phone}</div>
                            </div>
                            <div style={{ background: '#f8fafc', borderRadius: 11, padding: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: colors.muted, marginBottom: 8 }}>JADWAL</div>
                                <div style={{ fontSize: 13, color: colors.text }}>{fmtDate(a.appointmentDate)}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: colors.primary }}>{a.appointmentTime} WIB</div>
                            </div>
                        </div>
                        <div style={{ background: '#f8fafc', borderRadius: 11, padding: 16 }}>
                            {[
                                ['Keluhan', a.complaint || '—'],
                                ['Catatan Dokter', a.notes || 'Belum ada catatan'],
                                ['Alasan Batal', a.cancelReason || '—'],
                            ].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 13 }}>
                                    <div style={{ width: 130, fontWeight: 600, color: colors.muted, flexShrink: 0 }}>{k}</div>
                                    <div style={{ color: colors.text }}>{v}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
                            <Btn variant="ghost" onClick={() => setSelected(null)}>Tutup</Btn>
                        </div>
                    </div>
                ); })()}
            </Modal>
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: RESEP OBAT
// ═══════════════════════════════════════════════════════════════════════════════
const SectionResep = () => {
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [selCons, setSelCons]   = useState(null);
    const [medicines, setMedicines] = useState([{ name: '', dose: '', frequency: '', duration: '', notes: '' }]);
    const [doctorNotes, setDoctorNotes] = useState('');
    const [patientAge, setPatientAge]   = useState('');
    const [patientGender, setPatientGender] = useState('');
    const [patientWeight, setPatientWeight] = useState('');
    const [saving, setSaving]     = useState(false);
    const [detail, setDetail]     = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/api/consultations/doctor/all');
            const all = r.data.consultations || r.data || [];
            setConsultations(all.filter(c => ['in_progress','ongoing','completed','confirmed','paid','scheduled'].includes(c.status)));
        } catch { toast.error('Gagal memuat data konsultasi'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const addMedicine = () => setMedicines(m => [...m, { name: '', dose: '', frequency: '', duration: '', notes: '' }]);
    const removeMedicine = (i) => setMedicines(m => m.filter((_, idx) => idx !== i));
    const updateMedicine = (i, field, val) => setMedicines(m => m.map((med, idx) => idx === i ? { ...med, [field]: val } : med));

    const handleSave = async () => {
        if (!selCons) { toast.error('Pilih konsultasi terlebih dahulu'); return; }
        if (!medicines[0]?.name.trim()) { toast.error('Minimal satu obat wajib diisi'); return; }
        setSaving(true);
        try {
            await api.put(`/api/consultations/${selCons._id}/prescription`, {
                medicines, doctorNotes, patientAge, patientGender, patientWeight,
            });
            toast.success('Resep berhasil disimpan ✅');
            fetchData();
            setSelCons(null);
            setMedicines([{ name: '', dose: '', frequency: '', duration: '', notes: '' }]);
            setDoctorNotes(''); setPatientAge(''); setPatientGender(''); setPatientWeight('');
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan resep'); }
        finally { setSaving(false); }
    };

    const downloadPDF = async (consultationId, rxNum) => {
        try {
            const r = await api.get(`/api/consultations/${consultationId}/prescription/pdf`, { responseType: 'blob' });
            if (r.headers['content-type']?.includes('application/json')) { toast.error('Resep tidak ditemukan atau belum dibuat'); return; }
            const url  = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href  = url;
            link.setAttribute('download', `resep-${rxNum || consultationId}.pdf`);
            document.body.appendChild(link); link.click(); link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('PDF resep diunduh');
        } catch { toast.error('Gagal mengunduh PDF'); }
    };

    const withRx    = consultations.filter(c => c.prescriptionData || c.prescription);
    const withoutRx = consultations.filter(c => !c.prescriptionData && !c.prescription && ['in_progress','ongoing','confirmed','paid','scheduled'].includes(c.status));

    const InputField = ({ label, value, onChange, placeholder, required }) => (
        <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>{label}{required && <span style={{ color: colors.danger }}> *</span>}</label>
            <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || label}
                style={{ width: '100%', padding: '8px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        </div>
    );

    return (
        <div>
            <SectionHeader title="Resep Obat" subtitle="Buat dan kelola resep obat pasien konsultasi online"
                action={<Btn size="sm" variant="ghost" onClick={fetchData}>↻ Refresh</Btn>} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>

                {/* Buat Resep Baru */}
                <Card style={{ padding: 24 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: colors.text, marginBottom: 18 }}>✍️ Buat Resep Baru</div>

                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>Pilih Konsultasi</label>
                        <select value={selCons?._id || ''} onChange={e => setSelCons(consultations.find(c => c._id === e.target.value) || null)}
                            style={{ width: '100%', padding: '9px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
                            <option value="">— Pilih konsultasi —</option>
                            {consultations.map(c => <option key={c._id} value={c._id}>{c.userId?.name} · {fmtDT(c.scheduledAt)}</option>)}
                        </select>
                    </div>

                    {selCons && (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                            <strong>{selCons.userId?.name}</strong>
                            <div style={{ color: colors.muted, marginTop: 2 }}>Keluhan: {selCons.symptoms || '—'}</div>
                        </div>
                    )}

                    {/* Info pasien */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                        <InputField label="Usia" value={patientAge} onChange={setPatientAge} placeholder="mis. 32 tahun" />
                        <div>
                            <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>Jenis Kelamin</label>
                            <select value={patientGender} onChange={e => setPatientGender(e.target.value)}
                                style={{ width: '100%', padding: '8px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
                                <option value="">—</option>
                                <option value="Laki-laki">Laki-laki</option>
                                <option value="Perempuan">Perempuan</option>
                            </select>
                        </div>
                        <InputField label="Berat (kg)" value={patientWeight} onChange={setPatientWeight} placeholder="mis. 65 kg" />
                    </div>

                    {/* Daftar obat */}
                    <div style={{ fontWeight: 600, fontSize: 13, color: colors.text, marginBottom: 10 }}>Daftar Obat <span style={{ color: colors.danger }}>*</span></div>
                    {medicines.map((med, i) => (
                        <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: colors.muted }}>Obat #{i + 1}</span>
                                {medicines.length > 1 && <button onClick={() => removeMedicine(i)} style={{ background: 'none', border: 'none', color: colors.danger, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                <InputField label="Nama Obat" value={med.name} onChange={v => updateMedicine(i, 'name', v)} required />
                                <InputField label="Dosis" value={med.dose} onChange={v => updateMedicine(i, 'dose', v)} placeholder="mis. 500mg" />
                                <InputField label="Frekuensi" value={med.frequency} onChange={v => updateMedicine(i, 'frequency', v)} placeholder="mis. 3x sehari" />
                                <InputField label="Durasi" value={med.duration} onChange={v => updateMedicine(i, 'duration', v)} placeholder="mis. 5 hari" />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>Catatan</label>
                                <input value={med.notes} onChange={e => updateMedicine(i, 'notes', e.target.value)} placeholder="mis. Sesudah makan"
                                    style={{ width: '100%', padding: '8px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                    ))}

                    <Btn size="sm" variant="ghost" onClick={addMedicine} style={{ marginBottom: 14 }}>+ Tambah Obat</Btn>

                    <div style={{ marginBottom: 18 }}>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>Catatan Dokter</label>
                        <textarea value={doctorNotes} onChange={e => setDoctorNotes(e.target.value)} rows={2}
                            placeholder="Instruksi tambahan, pantangan, dll."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>

                    <Btn onClick={handleSave} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
                        {saving ? '…' : '💊 Simpan Resep & Kirim ke Pasien'}
                    </Btn>
                </Card>

                {/* Daftar Resep */}
                <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: colors.text, marginBottom: 14 }}>📋 Riwayat Resep</div>
                    {loading ? <Spinner /> : withRx.length === 0 ? <Empty icon="💊" text="Belum ada resep" /> : (
                        withRx.map(c => (
                            <Card key={c._id} style={{ padding: '14px 18px', marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{c.userId?.name}</div>
                                        <div style={{ fontSize: 12, color: colors.muted }}>{fmtDT(c.scheduledAt)}</div>
                                    </div>
                                    <span style={{ background: '#f0fdf4', color: '#166534', borderRadius: 8, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                                        {c.prescriptionData ? `${c.prescriptionData.medicines?.length || 0} obat` : 'Teks'}
                                    </span>
                                </div>
                                {c.prescriptionData?.medicines?.slice(0, 2).map((m, i) => (
                                    <div key={i} style={{ fontSize: 12, color: colors.muted }}>💊 {m.name} — {m.dose} · {m.frequency}</div>
                                ))}
                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                    <Btn size="sm" variant="outline" onClick={() => setDetail(c)}>Detail</Btn>
                                    <Btn size="sm" variant="ghost" onClick={() => downloadPDF(c._id, c.prescriptionData?.prescriptionNumber)}>⬇ PDF</Btn>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Detail modal */}
            <Modal open={!!detail} onClose={() => setDetail(null)} title="Detail Resep Obat" width={560}>
                {detail && (
                    <div>
                        <div style={{ background: '#f8fafc', borderRadius: 11, padding: 14, marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 4 }}>{detail.userId?.name}</div>
                            {detail.prescriptionData?.prescriptionNumber && <div style={{ fontSize: 12, color: colors.muted }}>No. Resep: {detail.prescriptionData.prescriptionNumber}</div>}
                            <div style={{ fontSize: 12, color: colors.muted }}>Tanggal: {fmtDT(detail.scheduledAt)}</div>
                        </div>
                        {detail.prescriptionData?.medicines?.map((m, i) => (
                            <div key={i} style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 6 }}>💊 {m.name}</div>
                                {[['Dosis', m.dose], ['Frekuensi', m.frequency], ['Durasi', m.duration], ['Catatan', m.notes]].map(([k, v]) => v && (
                                    <div key={k} style={{ display: 'flex', gap: 10, fontSize: 13, marginBottom: 3 }}>
                                        <span style={{ width: 80, color: colors.muted, fontWeight: 600 }}>{k}</span>
                                        <span style={{ color: colors.text }}>{v}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                        {detail.prescriptionData?.doctorNotes && (
                            <div style={{ background: '#f8fafc', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: colors.muted }}>
                                <strong>Catatan Dokter:</strong> {detail.prescriptionData.doctorNotes}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                            <Btn variant="ghost" onClick={() => setDetail(null)}>Tutup</Btn>
                            <Btn variant="outline" onClick={() => downloadPDF(detail._id, detail.prescriptionData?.prescriptionNumber)}>⬇ Download PDF</Btn>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: SURAT SAKIT
// ═══════════════════════════════════════════════════════════════════════════════
const SectionSuratSakit = () => {
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selCons, setSelCons]   = useState(null);
    const [form, setForm] = useState({ diagnosis: '', notes: '', startDate: '', endDate: '', patientAge: '', patientGender: '', patientWeight: '' });
    const [saving, setSaving]     = useState(false);
    const [issuing, setIssuing]   = useState({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/api/consultations/doctor/all');
            const all = r.data.consultations || r.data || [];
            setConsultations(all.filter(c => ['in_progress','ongoing','completed','confirmed','paid','scheduled'].includes(c.status)));
        } catch { toast.error('Gagal memuat data'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openCreate = (c) => {
        setSelCons(c);
        setForm({ diagnosis: '', notes: '', startDate: new Date().toISOString().slice(0,10), endDate: '', patientAge: '', patientGender: '', patientWeight: '' });
        setModalOpen(true);
    };

    const handleCreate = async () => {
        if (!form.diagnosis.trim()) { toast.error('Diagnosis wajib diisi'); return; }
        if (!form.startDate || !form.endDate) { toast.error('Tanggal mulai dan selesai wajib diisi'); return; }
        if (form.startDate > form.endDate) { toast.error('Tanggal mulai tidak boleh setelah tanggal selesai'); return; }
        setSaving(true);
        try {
            await api.post(`/api/consultations/${selCons._id}/sick-letter`, form);
            toast.success('Surat sakit (draft) berhasil dibuat ✅');
            setModalOpen(false);
            fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal membuat surat sakit'); }
        finally { setSaving(false); }
    };

    const handleIssue = async (consultationId) => {
        setIssuing(p => ({ ...p, [consultationId]: true }));
        try {
            await api.put(`/api/consultations/${consultationId}/sick-letter/issue`);
            toast.success('Surat sakit diterbitkan ✅');
            fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal menerbitkan'); }
        finally { setIssuing(p => ({ ...p, [consultationId]: false })); }
    };

    const downloadPDF = async (consultationId, letterNum) => {
        try {
            const r = await api.get(`/api/consultations/${consultationId}/sick-letter/pdf`, { responseType: 'blob' });
            const url  = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href  = url;
            link.setAttribute('download', `surat-sakit-${letterNum || consultationId}.pdf`);
            document.body.appendChild(link); link.click(); link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('PDF berhasil diunduh');
        } catch { toast.error('Gagal mengunduh PDF'); }
    };

    const withLetter    = consultations.filter(c => c.sickLetter);
    const withoutLetter = consultations.filter(c => !c.sickLetter && ['in_progress','ongoing','confirmed','paid','scheduled'].includes(c.status));

    const F = ({ label, value, onChange, type = 'text', placeholder, required }) => (
        <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>
                {label}{required && <span style={{ color: colors.danger }}> *</span>}
            </label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || label}
                style={{ width: '100%', padding: '8px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        </div>
    );

    return (
        <div>
            <SectionHeader title="Surat Sakit" subtitle="Buat dan kelola surat keterangan sakit pasien"
                action={<Btn size="sm" variant="ghost" onClick={fetchData}>↻ Refresh</Btn>} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>

                {/* Konsultasi belum punya surat */}
                <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 14 }}>📋 Butuh Surat Sakit</div>
                    {loading ? <Spinner /> : withoutLetter.length === 0 ? <Empty icon="✅" text="Semua konsultasi sudah diproses" /> : (
                        withoutLetter.map(c => (
                            <Card key={c._id} style={{ padding: '14px 18px', marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{c.userId?.name}</div>
                                        <div style={{ fontSize: 12, color: colors.muted }}>{fmtDT(c.scheduledAt)}</div>
                                    </div>
                                    <SBadge status={c.status} map={CONS_STATUS} />
                                </div>
                                {c.symptoms && <div style={{ fontSize: 12, color: colors.muted, marginBottom: 10 }}>Keluhan: {c.symptoms.slice(0, 100)}</div>}
                                <Btn size="sm" variant="primary" onClick={() => openCreate(c)}>📄 Buat Surat Sakit</Btn>
                            </Card>
                        ))
                    )}
                </div>

                {/* Surat yang sudah dibuat */}
                <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 14 }}>📂 Surat Sudah Dibuat</div>
                    {loading ? <Spinner /> : withLetter.length === 0 ? <Empty icon="📄" text="Belum ada surat sakit" /> : (
                        withLetter.map(c => {
                            const sl = c.sickLetter;
                            const isDraft  = sl?.status === 'draft';
                            const isIssued = sl?.status === 'issued';
                            return (
                                <Card key={c._id} style={{ padding: '14px 18px', marginBottom: 10, borderLeft: `4px solid ${isIssued ? colors.success : colors.warning}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{c.userId?.name}</div>
                                            <div style={{ fontSize: 11, color: colors.muted }}>No: {sl?.letterNumber || '(draft)'}</div>
                                        </div>
                                        <span style={{
                                            background: isIssued ? '#dcfce7' : '#fef9c3',
                                            color: isIssued ? '#166534' : '#854d0e',
                                            border: `1px solid ${isIssued ? '#86efac' : '#fde68a'}`,
                                            borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700,
                                        }}>
                                            {isIssued ? '✓ Terbit' : '📝 Draft'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>
                                        <div>Diagnosis: <strong style={{ color: colors.text }}>{sl?.diagnosis || '—'}</strong></div>
                                        <div style={{ marginTop: 3 }}>
                                            Periode: {fmtDate(sl?.startDate)} – {fmtDate(sl?.endDate)}
                                            {sl?.startDate && sl?.endDate && (
                                                <span style={{ marginLeft: 6, fontWeight: 600, color: colors.primary }}>
                                                    ({Math.ceil((new Date(sl.endDate) - new Date(sl.startDate)) / 86400000) + 1} hari)
                                                </span>
                                            )}
                                        </div>
                                        {isIssued && sl?.issuedAt && <div style={{ marginTop: 3, color: colors.success }}>Diterbitkan: {fmtDT(sl.issuedAt)}</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {isDraft && (
                                            <Btn size="sm" variant="success" disabled={issuing[c._id]} onClick={() => handleIssue(c._id)}>
                                                {issuing[c._id] ? '…' : '✅ Terbitkan'}
                                            </Btn>
                                        )}
                                        {isIssued && (
                                            <Btn size="sm" variant="outline" onClick={() => downloadPDF(c._id, sl.letterNumber)}>
                                                ⬇ Download PDF
                                            </Btn>
                                        )}
                                    </div>
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Modal buat surat */}
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="📄 Buat Surat Sakit" width={560}>
                {selCons && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '10px 14px', marginBottom: 18, fontSize: 13 }}>
                        <strong>{selCons.userId?.name}</strong>
                        <div style={{ color: colors.muted, marginTop: 2 }}>Keluhan: {selCons.symptoms || '—'}</div>
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <ProfileField label="Diagnosis" value={form.diagnosis} onChange={v => setForm(f => ({ ...f, diagnosis: v }))} required />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <ProfileField label="Tanggal Mulai" type="date" value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} required />
                        <ProfileField label="Tanggal Selesai" type="date" value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        <ProfileField label="Usia Pasien" value={form.patientAge} onChange={v => setForm(f => ({ ...f, patientAge: v }))} placeholder="mis. 28 tahun" />
                        <div>
                            <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>Jenis Kelamin</label>
                            <select value={form.patientGender} onChange={e => setForm(f => ({ ...f, patientGender: e.target.value }))}
                                style={{ width: '100%', padding: '8px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
                                <option value="">—</option>
                                <option>Laki-laki</option>
                                <option>Perempuan</option>
                            </select>
                        </div>
                        <ProfileField label="Berat Badan" value={form.patientWeight} onChange={v => setForm(f => ({ ...f, patientWeight: v }))} placeholder="mis. 60 kg" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>Catatan Tambahan</label>
                        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                            placeholder="Catatan khusus, anjuran, dll."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
                    <Btn variant="ghost" onClick={() => setModalOpen(false)}>Batal</Btn>
                    <Btn variant="primary" onClick={handleCreate} disabled={saving}>{saving ? '…' : '📄 Buat Draft'}</Btn>
                </div>
            </Modal>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: ATUR JADWAL
// ═══════════════════════════════════════════════════════════════════════════════
const SectionAturJadwal = () => {
    const [tab, setTab]           = useState('online');
    const [consForm, setConsForm] = useState(DEF_CONS);
    const [apptForm, setApptForm] = useState(DEF_APPT);
    const [settings, setSettings] = useState({ allowChat: true, allowVideoCall: true });
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [consWeek, setConsWeek] = useState({ weekStart: null, weekEnd: null, isExpired: true });
    const [apptWeek, setApptWeek] = useState({ weekStart: null, weekEnd: null, isExpired: true });

    const fmtWeekRange = (weekStart, weekEnd) => {
        if (!weekStart || !weekEnd) return null;
        const opt = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' };
        return `${new Date(weekStart).toLocaleDateString('id-ID', opt)} – ${new Date(weekEnd).toLocaleDateString('id-ID', opt)}`;
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [cr, ar, pr] = await Promise.allSettled([
                    api.get('/api/availability/my'),
                    api.get('/api/appointments/doctor/availability'),
                    api.get('/api/doctors/my/profile'),
                ]);
                if (cr.status === 'fulfilled' && cr.value.data?.availability) {
                    const av = cr.value.data.availability;
                    setConsForm(f => ({
                        ...f,
                        schedule: av.schedule ?? makeEmptySchedule(),
                        isActive: av.isActive ?? true,
                    }));
                    setConsWeek({ weekStart: av.weekStart, weekEnd: av.weekEnd, isExpired: av.isExpired ?? true });
                }
                if (ar.status === 'fulfilled' && ar.value.data?.availability) {
                    const av = ar.value.data.availability;
                    setApptForm(f => ({
                        ...f,
                        schedule: av.schedule ?? makeEmptySchedule(),
                        isActive: av.isActive ?? true,
                    }));
                    setApptWeek({ weekStart: av.weekStart, weekEnd: av.weekEnd, isExpired: av.isExpired ?? true });
                }
                if (pr.status === 'fulfilled' && pr.value.data?.doctor?.consultationSettings) {
                    setSettings(pr.value.data.doctor.consultationSettings);
                }
            } catch { toast.error('Gagal memuat jadwal'); }
            finally { setLoading(false); }
        };
        load();
    }, []);

    const toggleSlot = (form, setForm, dayKey, slot) => {
        setForm(f => {
            const current = f.schedule[dayKey] || [];
            const next = current.includes(slot)
                ? current.filter(s => s !== slot)
                : [...current, slot].sort();
            return { ...f, schedule: { ...f.schedule, [dayKey]: next } };
        });
    };

    const saveOnline = async () => {
        const total = Object.values(consForm.schedule).reduce((s, a) => s + a.length, 0);
        if (total === 0) { toast.error('Pilih minimal satu slot'); return; }
        setSaving(true);
        try {
            const [r] = await Promise.all([
                api.put('/api/availability/my', { schedule: consForm.schedule, isActive: consForm.isActive }),
                api.put('/api/doctors/my/settings', settings),
            ]);
            if (r.data?.availability) {
                const av = r.data.availability;
                setConsWeek({ weekStart: av.weekStart, weekEnd: av.weekEnd, isExpired: av.isExpired ?? false });
            }
            toast.success(r.data?.message || 'Jadwal konsultasi online berhasil dirilis ✅');
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan'); }
        finally { setSaving(false); }
    };

    const saveOffline = async () => {
        const total = Object.values(apptForm.schedule).reduce((s, a) => s + a.length, 0);
        if (total === 0) { toast.error('Pilih minimal satu slot'); return; }
        setSaving(true);
        try {
            const r = await api.put('/api/appointments/doctor/availability', { schedule: apptForm.schedule, isActive: apptForm.isActive });
            if (r.data?.availability) {
                const av = r.data.availability;
                setApptWeek({ weekStart: av.weekStart, weekEnd: av.weekEnd, isExpired: av.isExpired ?? false });
            }
            toast.success(r.data?.message || 'Jadwal janji temu berhasil dirilis ✅');
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan'); }
        finally { setSaving(false); }
    };

    if (loading) return <Spinner />;

    const TABS = [
        { key: 'online',  label: '💬 Konsultasi Online' },
        { key: 'offline', label: '📅 Janji Temu' },
    ];

    return (
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <SectionHeader title="Atur Jadwal" subtitle="Pilih slot waktu praktik per hari" />

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 28, width: 'fit-content' }}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        padding: '9px 22px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
                        cursor: 'pointer', fontFamily: 'inherit',
                        background: tab === t.key ? '#fff' : 'transparent',
                        color: tab === t.key ? colors.text : colors.muted,
                        boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                    }}>{t.label}</button>
                ))}
            </div>

            {/* ─── KONSULTASI ONLINE ─── */}
            {tab === 'online' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                    {/* Banner status minggu */}
                    {consWeek.isExpired ? (
                        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 20 }}>⚠️</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>Jadwal minggu ini belum dirilis</div>
                                <div style={{ fontSize: 12, color: '#b45309' }}>Pasien tidak bisa booking konsultasi online. Atur slot di bawah lalu klik Rilis Jadwal.</div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 20 }}>✅</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#166534' }}>Jadwal aktif minggu ini</div>
                                <div style={{ fontSize: 12, color: '#15803d' }}>Berlaku: {fmtWeekRange(consWeek.weekStart, consWeek.weekEnd)}</div>
                            </div>
                        </div>
                    )}

                    {/* Header card */}
                    <Card style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ fontWeight: 700, fontSize: 16, color: colors.text }}>Jadwal Konsultasi Online</div>
                            <Toggle checked={consForm.isActive} onChange={() => setConsForm(f => ({ ...f, isActive: !f.isActive }))} label={consForm.isActive ? 'Aktif' : 'Nonaktif'} />
                        </div>
                        <div style={{ fontSize: 12, color: colors.muted, marginBottom: 20 }}>
                            Klik slot untuk mengaktifkan / menonaktifkan. Jadwal berlaku dari Senin hingga Sabtu minggu yang ditentukan saat Anda klik Rilis Jadwal.
                        </div>

                        {/* Grid per-hari */}
                        <ScheduleGrid
                            schedule={consForm.schedule}
                            allowedSlots={CONS_SLOTS}
                            onChange={(dayKey, slot) => toggleSlot(consForm, setConsForm, dayKey, slot)}
                            color={colors.primary}
                        />
                    </Card>

                    {/* Preview */}
                    <Card style={{ padding: 22 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: colors.muted, marginBottom: 12 }}>📋 Ringkasan Jadwal</div>
                        <SchedulePreview schedule={consForm.schedule} color={colors.primary} />
                    </Card>

                    {/* Pengaturan fitur konsultasi */}
                    <Card style={{ padding: 24 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 18 }}>🩺 Fitur Konsultasi yang Tersedia</div>
                        {[
                            { key: 'allowChat',      icon: '💬', label: 'Chat',       desc: 'Pasien dapat konsultasi via pesan teks' },
                            { key: 'allowVideoCall', icon: '📹', label: 'Video Call', desc: 'Pasien dapat konsultasi via video call' },
                        ].map(f => (
                            <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${colors.border}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: settings[f.key] ? '#eff6ff' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{f.icon}</div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 13, color: colors.text }}>{f.label}</div>
                                        <div style={{ fontSize: 12, color: colors.muted }}>{f.desc}</div>
                                    </div>
                                </div>
                                <Toggle checked={settings[f.key]} onChange={() => setSettings(s => ({ ...s, [f.key]: !s[f.key] }))} />
                            </div>
                        ))}
                    </Card>

                    <Btn onClick={saveOnline} disabled={saving} style={{ width: '100%', justifyContent: 'center' }} size="lg">
                        {saving ? '…' : '🚀 Rilis Jadwal Konsultasi Online'}
                    </Btn>
                </div>
            )}

            {/* ─── JANJI TEMU ─── */}
            {tab === 'offline' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                    {/* Banner status minggu */}
                    {apptWeek.isExpired ? (
                        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 20 }}>⚠️</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>Jadwal minggu ini belum dirilis</div>
                                <div style={{ fontSize: 12, color: '#b45309' }}>Pasien tidak bisa booking janji temu. Atur slot di bawah lalu klik Rilis Jadwal.</div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 20 }}>✅</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#166534' }}>Jadwal aktif minggu ini</div>
                                <div style={{ fontSize: 12, color: '#15803d' }}>Berlaku: {fmtWeekRange(apptWeek.weekStart, apptWeek.weekEnd)}</div>
                            </div>
                        </div>
                    )}

                    <Card style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ fontWeight: 700, fontSize: 16, color: colors.text }}>Jadwal Janji Temu</div>
                            <Toggle checked={apptForm.isActive} onChange={() => setApptForm(f => ({ ...f, isActive: !f.isActive }))} label={apptForm.isActive ? 'Aktif' : 'Nonaktif'} />
                        </div>
                        <div style={{ fontSize: 12, color: colors.muted, marginBottom: 20 }}>
                            Klik slot untuk mengaktifkan / menonaktifkan. Jadwal berlaku dari Senin hingga Sabtu minggu yang ditentukan saat Anda klik Rilis Jadwal.
                        </div>

                        <ScheduleGrid
                            schedule={apptForm.schedule}
                            allowedSlots={APPT_SLOTS}
                            onChange={(dayKey, slot) => toggleSlot(apptForm, setApptForm, dayKey, slot)}
                            color="#7c3aed"
                        />
                    </Card>

                    <Card style={{ padding: 22 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: colors.muted, marginBottom: 12 }}>📋 Ringkasan Jadwal</div>
                        <SchedulePreview schedule={apptForm.schedule} color="#7c3aed" />
                    </Card>

                    <Btn onClick={saveOffline} disabled={saving} style={{ width: '100%', justifyContent: 'center' }} size="lg">
                        {saving ? '…' : '🚀 Rilis Jadwal Janji Temu'}
                    </Btn>
                </div>
            )}
        </div>
    );
};

const ProfileField = ({ label, value, onChange, placeholder, required, hint }) => (
    <div>
        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>
            {label}{required && <span style={{ color: colors.danger }}> *</span>}
        </label>
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || label}
            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        {hint && <div style={{ fontSize: 11, color: colors.subtle, marginTop: 4 }}>{hint}</div>}
    </div>
);

const SectionProfile = () => {
    const [form, setForm] = useState({ name: '', specialization: '', qualification: '', gender: '', bio: '', experience: '' });
    const [loading, setLoading]         = useState(true);
    const [saving, setSaving]           = useState(false);
    const [uploading, setUploading]     = useState(false);
    const [uploadingSig, setUploadingSig] = useState(false);
    const [photoUrl, setPhotoUrl]       = useState('');
    const [signatureUrl, setSignatureUrl] = useState('');
    const [consultationFee, setConsultationFee] = useState(null); // read-only display
    const fileRef  = useRef(null);
    const sigRef   = useRef(null);

    useEffect(() => {
        api.get('/api/doctors/my/profile')
            .then(r => {
                const d = r.data.doctor;
                if (!d) return;
                setForm({
                    name:           d.name           || '',
                    specialization: d.specialization || '',
                    qualification:  d.qualification  || '',
                    gender:         d.gender         || '',
                    bio:            d.bio            || '',
                    experience:     d.experience     != null ? String(d.experience) : '',
                });
                setPhotoUrl(d.photo || '');
                setSignatureUrl(d.signatureUrl || '');
                setConsultationFee(d.consultationFee ?? null);
            })
            .catch(() => toast.error('Gagal memuat profil'))
            .finally(() => setLoading(false));
    }, []);

    const saveProfile = async () => {
        if (!form.name.trim())           { toast.error('Nama wajib diisi'); return; }
        if (!form.specialization.trim()) { toast.error('Spesialisasi wajib diisi'); return; }
        setSaving(true);
        try {
            const r = await api.put('/api/doctors/my/profile', form);
            setForm(f => ({ ...f, ...r.data.doctor }));
            toast.success('Profil berhasil disimpan ✅');
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan profil'); }
        finally { setSaving(false); }
    };

    const handlePhoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran foto maksimal 5 MB'); return; }
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('photo', file);
            const r = await api.post('/api/doctors/my/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setPhotoUrl(r.data.photoUrl);
            toast.success('Foto profil diperbarui ✅');
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal upload foto'); }
        finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
    };

    const handleSignature = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran file maksimal 5 MB'); return; }
        setUploadingSig(true);
        try {
            const fd = new FormData();
            fd.append('signature', file);
            const r = await api.post('/api/doctors/my/signature', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setSignatureUrl(r.data.signatureUrl);
            toast.success('Tanda tangan berhasil diupload ✅');
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal upload tanda tangan'); }
        finally { setUploadingSig(false); if (sigRef.current) sigRef.current.value = ''; }
    };

    if (loading) return <Spinner />;

    const fullPhoto = photoUrl
        ? (photoUrl.startsWith('http') ? photoUrl : `${API_URL}${photoUrl}`)
        : null;
    const fullSig = signatureUrl
        ? (signatureUrl.startsWith('http') ? signatureUrl : `${API_URL}${signatureUrl}`)
        : null;

    return (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <SectionHeader title="Profil Saya" subtitle="Informasi profil dokter yang tampil kepada pasien" />

            {/* ── Avatar + cover card ── */}
            <Card style={{ marginBottom: 18, overflow: 'hidden' }}>
                {/* Cover gradient */}
                <div style={{ height: 110, background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #0ea5e9 100%)', borderRadius: '14px 14px 0 0' }} />

                {/* Centered avatar block */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px 28px' }}>
                    {/* Avatar — overlaps cover */}
                    <div style={{ position: 'relative', marginTop: -52 }}>
                        <div style={{
                            width: 104, height: 104, borderRadius: 26, overflow: 'hidden',
                            background: '#e2e8f0', border: '4px solid #fff',
                            boxShadow: '0 6px 20px rgba(0,0,0,.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {fullPhoto
                                ? <img src={fullPhoto} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.src = ''; }} />
                                : <span style={{ fontSize: 44 }}>👨‍⚕️</span>}
                        </div>
                        {uploading && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.82)', borderRadius: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: colors.primary, fontWeight: 700 }}>⬆</div>
                        )}
                    </div>

                    {/* Name & specialization */}
                    <div style={{ textAlign: 'center', marginTop: 14 }}>
                        <div style={{ fontWeight: 800, fontSize: 18, color: colors.text, lineHeight: 1.2 }}>
                            {form.name || 'Nama Dokter'}
                        </div>
                        <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>
                            {form.specialization || 'Spesialisasi'}
                            {form.qualification ? <span style={{ color: colors.subtle }}> · {form.qualification}</span> : ''}
                        </div>
                        {(form.experience || form.gender) && (
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                                {form.gender && (
                                    <span style={{ fontSize: 12, background: '#f1f5f9', color: colors.muted, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                                        {form.gender === 'Laki-laki' ? '👨' : '👩'} {form.gender}
                                    </span>
                                )}
                                {form.experience && (
                                    <span style={{ fontSize: 12, background: '#eff6ff', color: colors.primary, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                                        🩺 {form.experience} tahun pengalaman
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Upload button */}
                    <div style={{ marginTop: 16 }}>
                        <input type="file" accept="image/jpeg,image/png,image/webp" ref={fileRef} onChange={handlePhoto} style={{ display: 'none' }} />
                        <Btn size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                            {uploading ? '⬆ Mengunggah…' : '📷 Ganti Foto'}
                        </Btn>
                        <div style={{ fontSize: 10, color: colors.subtle, marginTop: 5, textAlign: 'center' }}>JPG · PNG · WEBP · maks 5 MB</div>
                    </div>
                </div>
            </Card>

            {/* ── Form card ── */}
            <Card style={{ padding: 28 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Row 1: Nama */}
                    <ProfileField label="Nama Lengkap" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required placeholder="dr. Nama Lengkap, Sp.X" />

                    {/* Row 2: Spesialisasi + Pendidikan */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <ProfileField label="Spesialisasi" value={form.specialization} onChange={v => setForm(f => ({ ...f, specialization: v }))} required placeholder="mis. Umum, Penyakit Dalam" />
                        <ProfileField label="Pendidikan / Gelar" value={form.qualification} onChange={v => setForm(f => ({ ...f, qualification: v }))} placeholder="mis. S.Ked, dr., Sp.PD" />
                    </div>

                    {/* Row 3: Gender + Pengalaman */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>Jenis Kelamin</label>
                            <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
                                <option value="">— Pilih —</option>
                                <option value="Laki-laki">Laki-laki</option>
                                <option value="Perempuan">Perempuan</option>
                            </select>
                        </div>
                        <ProfileField label="Pengalaman (tahun)" value={form.experience} onChange={v => setForm(f => ({ ...f, experience: v }))} placeholder="mis. 5" hint="Masukkan angka tahun pengalaman" />
                    </div>

                    {/* Row 4: Bio */}
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>Bio / Deskripsi Singkat</label>
                        <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={4}
                            placeholder="Tuliskan deskripsi singkat tentang keahlian dan pengalaman Anda..."
                            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                </div>

                <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${colors.border}` }}>
                    <Btn onClick={saveProfile} disabled={saving} style={{ width: '100%', justifyContent: 'center' }} size="lg">
                        {saving ? '…' : '💾 Simpan Profil'}
                    </Btn>
                </div>
            </Card>

            {/* ── Biaya Konsultasi (read-only) ── */}
            <Card style={{ padding: 24, marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 4 }}>💰 Biaya Konsultasi</div>
                        <div style={{ fontSize: 13, color: colors.muted }}>Biaya hanya dapat diubah oleh admin klinik.</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: colors.primary }}>
                        {consultationFee !== null
                            ? `Rp ${Number(consultationFee).toLocaleString('id-ID')}`
                            : <span style={{ color: colors.muted, fontSize: 14 }}>Belum diatur</span>
                        }
                    </div>
                </div>
            </Card>

            {/* ── Tanda Tangan Digital ── */}
            <Card style={{ padding: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: colors.text, marginBottom: 4 }}>✍️ Tanda Tangan Digital</div>
                <div style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>
                    Tanda tangan ini akan dicetak di pojok kanan bawah surat sakit PDF. Gunakan gambar dengan latar belakang putih atau transparan.
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {/* Preview */}
                    <div style={{
                        width: 180, height: 100, border: `2px dashed ${colors.border}`, borderRadius: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: '#fafafa', overflow: 'hidden', flexShrink: 0,
                    }}>
                        {fullSig
                            ? <img src={fullSig} alt="Tanda tangan" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            : <span style={{ fontSize: 12, color: colors.muted, textAlign: 'center', padding: 8 }}>Belum ada tanda tangan</span>
                        }
                    </div>
                    <div style={{ flex: 1 }}>
                        <input type="file" accept="image/jpeg,image/png,image/webp" ref={sigRef} onChange={handleSignature} style={{ display: 'none' }} />
                        <Btn size="sm" variant="outline" onClick={() => sigRef.current?.click()} disabled={uploadingSig}>
                            {uploadingSig ? '⬆ Mengunggah…' : '📤 Upload Tanda Tangan'}
                        </Btn>
                        <div style={{ fontSize: 11, color: colors.subtle, marginTop: 6 }}>JPG · PNG · WEBP · maks 5 MB</div>
                        <div style={{ fontSize: 11, color: colors.subtle, marginTop: 2 }}>Disarankan: ukuran 400×200 px, latar putih</div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT COMPONENT — DoctorDashboard
// ═══════════════════════════════════════════════════════════════════════════════
const NAV_ITEMS = [
    { key: 'beranda',    icon: '📊', label: 'Beranda'      },
    { key: 'janji',      icon: '🗓️', label: 'Janji Temu', badge: true },
    { key: 'konsultasi', icon: '🩺', label: 'Konsultasi', badge: true },
    { key: 'pasien',     icon: '👥', label: 'Pasien'       },
    { key: 'resep',      icon: '💊', label: 'Resep Obat'   },
    { key: 'surat',      icon: '📄', label: 'Surat Sakit'  },
    { key: 'jadwal',     icon: '📅', label: 'Atur Jadwal'  },
];

const DoctorDashboard = () => {
    const { user, logout } = useAuth();
    const navigate         = useNavigate();
    const [active, setActive]       = useState('beranda');
    const [collapsed, setCollapsed] = useState(false);
    const [doctorInfo, setDoctorInfo] = useState(null);
    const [pendingAppt, setPendingAppt]  = useState(0);
    const [pendingCons, setPendingCons]  = useState(0);
    const socketRef = useRef(null);

    // Socket.IO init
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        let io;
        try {
            io = window.io ? window.io(API_URL, { auth: { token }, transports: ['websocket','polling'], reconnection: true }) : null;
        } catch { return; }
        if (!io) return;
        socketRef.current = io;
        io.on('connect', () => { io.emit('join-user', user?._id || user?.id); });
        return () => { io.disconnect(); socketRef.current = null; };
    }, [user]);

    // Fetch doctor info + badge counts
    useEffect(() => {
        const fetchBadges = async () => {
            try {
                const [pr, ar, cr] = await Promise.allSettled([
                    api.get('/api/doctors/my/profile'),
                    api.get('/api/appointments/doctor/list', { params: { status: 'scheduled' } }),
                    api.get('/api/consultations/doctor/pending'),
                ]);
                if (pr.status === 'fulfilled') setDoctorInfo(pr.value.data.doctor);
                if (ar.status === 'fulfilled') setPendingAppt(ar.value.data.appointments?.length || 0);
                if (cr.status === 'fulfilled') setPendingCons(cr.value.data.consultations?.length || 0);
            } catch { /* silent */ }
        };
        fetchBadges();
        const t = setInterval(fetchBadges, 60000);
        return () => clearInterval(t);
    }, []);

    const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

    const getBadge = (key) => {
        if (key === 'janji')      return pendingAppt > 0 ? pendingAppt : null;
        if (key === 'konsultasi') return pendingCons > 0 ? pendingCons : null;
        return null;
    };

    const photoFull = doctorInfo?.photo
        ? (doctorInfo.photo.startsWith('http') ? doctorInfo.photo : `${API_URL}${doctorInfo.photo}`)
        : null;

    const SIDEBAR_W = collapsed ? 68 : 230;

    const renderSection = () => {
        switch (active) {
            case 'beranda':    return <SectionBeranda />;
            case 'janji':      return <SectionJanjiTemu socketRef={socketRef} />;
            case 'konsultasi': return <SectionKonsultasi socketRef={socketRef} />;
            case 'pasien':     return <SectionPasien />;
            case 'resep':      return <SectionResep />;
            case 'surat':      return <SectionSuratSakit />;
            case 'jadwal':     return <SectionAturJadwal />;
            case 'profile':    return <SectionProfile />;
            default:           return <SectionBeranda />;
        }
    };

    return (
        <>
            {/* Global styles */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
                *, *::before, *::after { box-sizing: border-box; }
                body { margin: 0; background: ${colors.bg}; font-family: 'DM Sans', system-ui, sans-serif; color: ${colors.text}; }
                @keyframes spin { to { transform: rotate(360deg); } }
                ::-webkit-scrollbar { width: 5px; height: 5px; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                * { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
            `}</style>

            <div style={{ display: 'flex', minHeight: '100vh' }}>

                {/* ─── SIDEBAR ─── */}
                <aside style={{
                    width: SIDEBAR_W, minHeight: '100vh', background: colors.sidebar,
                    display: 'flex', flexDirection: 'column', flexShrink: 0,
                    position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
                    transition: 'width .2s',
                }}>
                    {/* ── Header: logo + notif bell + collapse button ── */}
                    <div style={{
                        display: 'flex', alignItems: 'center',
                        padding: collapsed ? '16px 0' : '16px 14px',
                        justifyContent: collapsed ? 'center' : 'space-between',
                        borderBottom: '1px solid rgba(255,255,255,.07)',
                        minHeight: 64, gap: 8,
                    }}>
                        {!collapsed && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 20, flexShrink: 0 }}>⚕️</span>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: '#fff', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Klinik IPB</div>
                                    <div style={{ fontSize: 10, color: '#475569' }}>Dokter Dashboard</div>
                                </div>
                                {/* Bell notif sejajar judul klinik */}
                                <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                                    <NotifBell socketRef={socketRef} />
                                </div>
                            </div>
                        )}
                        {collapsed && <NotifBell socketRef={socketRef} />}
                        {!collapsed && (
                            <button onClick={() => setCollapsed(c => !c)} style={{
                                background: 'rgba(255,255,255,.07)', border: 'none', color: '#94a3b8', cursor: 'pointer',
                                borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
                            }}>←</button>
                        )}
                        {collapsed && (
                            <button onClick={() => setCollapsed(c => !c)} style={{
                                background: 'rgba(255,255,255,.07)', border: 'none', color: '#94a3b8', cursor: 'pointer',
                                borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, marginTop: 6,
                            }}>→</button>
                        )}
                    </div>

                    {/* ── Doctor identity card (expanded only) ── */}
                    {!collapsed && (
                        <div
                            onClick={() => setActive('profile')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '12px 14px', cursor: 'pointer',
                                borderBottom: '1px solid rgba(255,255,255,.07)',
                                transition: 'background .15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            {/* Avatar */}
                            <div style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', background: '#334155', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,.1)' }}>
                                {photoFull
                                    ? <img src={photoFull} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                                    : <span style={{ fontSize: 20 }}>👨‍⚕️</span>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {doctorInfo?.name || user?.name || 'Dokter'}
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {doctorInfo?.specialization || 'Dokter'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Nav ── */}
                    <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
                        {NAV_ITEMS.map(item => {
                            const isAct = active === item.key;
                            const badge = getBadge(item.key);
                            return (
                                <button key={item.key} onClick={() => setActive(item.key)} title={collapsed ? item.label : undefined} style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                    padding: collapsed ? '11px 0' : '11px 12px',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    background: isAct ? 'rgba(37,99,235,.35)' : 'transparent',
                                    border: isAct ? '1px solid rgba(37,99,235,.4)' : '1px solid transparent',
                                    borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 3,
                                    transition: 'all .15s', position: 'relative',
                                }}>
                                    <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
                                    {!collapsed && (
                                        <span style={{ fontSize: 13, fontWeight: 600, color: isAct ? '#fff' : '#94a3b8', flex: 1, textAlign: 'left' }}>{item.label}</span>
                                    )}
                                    {badge && (
                                        <span style={{
                                            background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700,
                                            padding: '1px 6px', minWidth: 16, textAlign: 'center', lineHeight: '16px',
                                            position: collapsed ? 'absolute' : 'static',
                                            top: collapsed ? 4 : undefined, right: collapsed ? 4 : undefined,
                                        }}>{badge}</span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* ── Bottom: logout ── */}
                    <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
                        <button onClick={handleLogout} title={collapsed ? 'Logout' : undefined} style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: collapsed ? '10px 0' : '10px 12px',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            background: 'transparent', border: '1px solid transparent', borderRadius: 10,
                            cursor: 'pointer', fontFamily: 'inherit', color: '#ef4444',
                            fontSize: 13, fontWeight: 600, transition: 'background .15s',
                        }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.12)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <span style={{ fontSize: 17 }}>🚪</span>
                            {!collapsed && 'Logout'}
                        </button>
                    </div>
                </aside>

                {/* ─── MAIN CONTENT ─── */}
                <main style={{ marginLeft: SIDEBAR_W, flex: 1, minWidth: 0, padding: '28px 32px', transition: 'margin-left .2s' }}>
                    {renderSection()}
                </main>
            </div>
        </>
    );
};

export default DoctorDashboard;