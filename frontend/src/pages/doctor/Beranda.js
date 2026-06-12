import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { fmtDoctorName } from '../../utils/format';
import { getCache, setCache, hasCache } from '../../utils/cache';
import {
    colors,
    CONS_STATUS, APPT_STATUS,
    Card, Btn, Spinner, Empty, SBadge,
} from './shared';
import {
    Chart as ChartJS,
    ArcElement, CategoryScale, LinearScale,
    BarElement, LineElement, PointElement,
    Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
    ArcElement, CategoryScale, LinearScale,
    BarElement, LineElement, PointElement,
    Tooltip, Legend, Filler,
);

// ─── Helper ───────────────────────────────────────────────────────────────────
const toDateKey = (d) =>
    new Date(d).toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        timeZone: 'Asia/Jakarta',
    });

const isToday = (d) => {
    const now = new Date();
    const cmp = new Date(d);
    return (
        cmp.getFullYear() === now.getFullYear() &&
        cmp.getMonth()    === now.getMonth()    &&
        cmp.getDate()     === now.getDate()
    );
};

const isThisWeek = (d) => {
    const now  = new Date();
    const cmp  = new Date(d);
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    const mon  = new Date(now);
    mon.setDate(now.getDate() - dayOfWeek + 1);
    mon.setHours(0, 0, 0, 0);
    const sun  = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return cmp >= mon && cmp <= sun;
};

const CATEGORY_COLORS = {
    'ISPA':                  '#ef4444',
    'Hipertensi':            '#f97316',
    'Diabetes':              '#eab308',
    'Gangguan Pencernaan':   '#22c55e',
    'Penyakit Kulit':        '#14b8a6',
    'Gangguan Jantung':      '#e11d48',
    'Gangguan Paru':         '#06b6d4',
    'Gangguan Saraf':        '#8b5cf6',
    'Gangguan Mata':         '#3b82f6',
    'Gangguan Ginjal':       '#f59e0b',
    'Gangguan Mental':       '#a855f7',
    'Karies Gigi':           '#84cc16',
    'Sakit Gusi':            '#10b981',
    'Abses Gigi':            '#f43f5e',
    'Gigi Sensitif':         '#fb923c',
    'Gigi Bungsu':           '#a16207',
    'Malnutrisi':            '#0ea5e9',
    'Obesitas':              '#6366f1',
    'Anemia':                '#ec4899',
    'Gangguan Makan':        '#d946ef',
    'Defisiensi Vitamin':    '#0d9488',
    'Kehamilan':             '#f472b6',
    'Gangguan Menstruasi':   '#e879f9',
    'Kontrasepsi':           '#c084fc',
    'Tumbuh Kembang Anak':   '#34d399',
    'Imunisasi':             '#60a5fa',
    'Lainnya':               '#94a3b8',
};

const PERIOD_OPTS = [
    { v: '7d',  l: '7 Hari'   },
    { v: '30d', l: '30 Hari'  },
    { v: '3m',  l: '3 Bulan'  },
    { v: '6m',  l: '6 Bulan'  },
];

const GENDER_OPTS = [
    { v: 'all',    l: 'Semua'      },
    { v: 'male',   l: '♂ Laki-laki' },
    { v: 'female', l: '♀ Perempuan' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: BERANDA
// ═══════════════════════════════════════════════════════════════════════════════
const SectionBeranda = () => {
    const { user, doctorProfile } = useAuth();
    const navigate   = useNavigate();
    const [stats,    setStats]    = useState(() => getCache('doctor:beranda:stats', null));
    const [allItems, setAllItems] = useState(() => getCache('doctor:beranda:allItems', []));
    const [loading,  setLoading]  = useState(() => !hasCache('doctor:beranda:stats'));
    const [time,     setTime]     = useState(new Date());
    const [tab,      setTab]      = useState('today');

    const [completedConsultations, setCompletedConsultations] = useState([]);
    const [completedAppointments,  setCompletedAppointments]  = useState([]);
    const [cancelledConsultations, setCancelledConsultations] = useState([]);
    const [cancelledAppointments,  setCancelledAppointments]  = useState([]);

    // Disease trend state
    const [diseaseData,    setDiseaseData]    = useState(null);
    const [diseaseLoading, setDiseaseLoading] = useState(true);
    const [diseasePeriod,  setDiseasePeriod]  = useState('30d');
    const [diseaseGender,  setDiseaseGender]  = useState('all');

    // AI Insight state
    const [aiInsight,        setAiInsight]        = useState(null);
    const [aiInsightLoading, setAiInsightLoading] = useState(false);
    const [aiFromCache,      setAiFromCache]      = useState(false);
    const lastInsightKeyRef = useRef(null); // guard: hindari re-fetch data identik

    // Jam berjalan
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // ── Fetch jadwal ─────────────────────────────────────────────────────────
    const fetchData = useCallback(async (background = false) => {
        if (!background) setLoading(!hasCache('doctor:beranda:stats'));
        try {
            const [statsRes, apptRes, consRes] = await Promise.allSettled([
                api.get('/api/doctors/my/stats'),
                api.get('/api/appointments/doctor/list', { params: { status: 'all' } }),
                api.get('/api/consultations/doctor/all'),
            ]);

            let newStats = stats;
            if (statsRes.status === 'fulfilled') {
                newStats = statsRes.value.data.stats;
                setStats(newStats);
            }

            const appts = (apptRes.status === 'fulfilled'
                ? apptRes.value.data.appointments || [] : []
            ).map(a => ({
                _id: a._id, type: 'appointment',
                sortAt: a.scheduledAt || a.appointmentDate,
                time: a.appointmentTime || '—',
                patientName: a.userId?.name || 'Pasien',
                patientPhone: a.userId?.phone || '',
                status: a.status,
                scheduledAt: a.scheduledAt || a.appointmentDate,
            }));

            const cons = (consRes.status === 'fulfilled'
                ? consRes.value.data.consultations || consRes.value.data || [] : []
            ).map(c => ({
                _id: c._id, type: 'consultation',
                sortAt: c.scheduledAt,
                time: c.scheduledAt
                    ? new Date(c.scheduledAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
                    : '—',
                patientName: c.userId?.name || 'Pasien',
                patientPhone: c.userId?.phone || '',
                status: c.status,
                scheduledAt: c.scheduledAt,
                consultationType: c.consultationType || 'chat',
            }));

            const merged = [...appts, ...cons].sort((a, b) => new Date(a.sortAt) - new Date(b.sortAt));
            setAllItems(merged);

            setCompletedConsultations(merged.filter(i => i.type === 'consultation' && ['completed','no_show'].includes(i.status)));
            setCompletedAppointments( merged.filter(i => i.type === 'appointment'  && i.status === 'completed'));
            const cancelledStatuses = ['cancelled','cancelled_by_user','cancelled_by_doctor','cancelled_by_admin','expired','refunded','refund_failed','doctor_no_show'];
            setCancelledConsultations(merged.filter(i => i.type === 'consultation' && cancelledStatuses.includes(i.status)));
            setCancelledAppointments( merged.filter(i => i.type === 'appointment'  && cancelledStatuses.includes(i.status)));

            setCache('doctor:beranda:stats', newStats);
            setCache('doctor:beranda:allItems', merged);
        } catch (err) {
            toast.error('Gagal memuat data beranda');
        } finally { if (!background) setLoading(false); }
    }, [stats]);

    useEffect(() => { 
        const isBg = hasCache('doctor:beranda:stats');
        fetchData(isBg); 
    }, [fetchData]);

    // ── Fetch tren penyakit ──────────────────────────────────────────────────
    const fetchDiseaseTrend = useCallback(async () => {
        setDiseaseLoading(true);
        // Reset fingerprint agar AI insight ikut refresh saat filter berubah
        lastInsightKeyRef.current = null;
        setAiInsight(null);
        try {
            const genderParam = diseaseGender !== 'all' ? `&gender=${diseaseGender}` : '';
            const endpoint = diseaseGender === 'all'
                ? `/api/doctors/my/disease-trend?period=${diseasePeriod}`
                : `/api/doctors/my/disease-trend-gender?period=${diseasePeriod}${genderParam}`;
            const res = await api.get(endpoint);
            setDiseaseData(res.data?.data || null);
        } catch (e) {
            setDiseaseData(null);
        } finally {
            setDiseaseLoading(false);
        }
    }, [diseasePeriod, diseaseGender]);

    useEffect(() => { fetchDiseaseTrend(); }, [fetchDiseaseTrend]);

    // ── Fetch AI Insight ─────────────────────────────────────────────────────
    const fetchAiInsight = useCallback(async (data) => {
        if (!data || Object.keys(data).length === 0) return;

        // Buat fingerprint dari data aktual
        const topKeys = Object.entries(data)
            .map(([k, arr]) => `${k}:${arr.reduce((s, r) => s + r.jumlah, 0)}`)
            .sort().join('|');
        const fingerprint = `doctor:${diseasePeriod}:${diseaseGender}:${topKeys}`;

        // Skip jika data identik dengan fetch terakhir
        if (lastInsightKeyRef.current === fingerprint && aiInsight) return;

        // Cek sessionStorage
        const sessionKey = `ai-insight:${fingerprint}`;
        try {
            const stored = sessionStorage.getItem(sessionKey);
            if (stored) {
                setAiInsight(stored);
                setAiFromCache(true);
                lastInsightKeyRef.current = fingerprint;
                return;
            }
        } catch (_) {}

        lastInsightKeyRef.current = fingerprint;
        setAiInsightLoading(true);
        try {
            const res = await api.post('/api/doctors/my/ai-insight', {
                diseaseData: data,
                period: diseasePeriod,
                gender: diseaseGender === 'all' ? null : diseaseGender,
                role: 'doctor',
            });
            const insight = res.data?.insight || null;
            setAiInsight(insight);
            setAiFromCache(res.data?.fromCache || false);
            if (insight) {
                try { sessionStorage.setItem(sessionKey, insight); } catch (_) {}
            }
        } catch (e) {
            setAiInsight(null);
        } finally {
            setAiInsightLoading(false);
        }
    }, [diseasePeriod, diseaseGender, aiInsight]);

    useEffect(() => {
        if (diseaseData) fetchAiInsight(diseaseData);
    }, [diseaseData, fetchAiInsight]);

    // ── Reminder ─────────────────────────────────────────────────────────────
    const reminders = allItems.filter(s => {
        if (!s.scheduledAt) return false;
        const diff = new Date(s.scheduledAt).getTime() - Date.now();
        return diff > 0 && diff <= 60 * 60 * 1000;
    });

    const now = new Date();
    const excludeStatuses = [
        'completed','no_show','cancelled','cancelled_by_user','cancelled_by_doctor',
        'cancelled_by_admin','expired','refunded','refund_failed','doctor_no_show',
    ];

    const filtered = allItems.filter(s => {
        if (!s.sortAt || excludeStatuses.includes(s.status)) return false;
        const d = new Date(s.sortAt);
        if (tab === 'today')    return isToday(d);
        if (tab === 'week')     return isThisWeek(d);
        if (tab === 'upcoming') return d >= now;
        return true;
    });

    const grouped = filtered.reduce((acc, s) => {
        const key = s.sortAt ? toDateKey(s.sortAt) : 'Tanggal tidak diketahui';
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
    }, {});
    const dateKeys = Object.keys(grouped);

    const greeting = () => {
        const h = time.getHours();
        if (h < 11) return 'Selamat Pagi';
        if (h < 15) return 'Selamat Siang';
        if (h < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    };

    const doctorName = doctorProfile ? fmtDoctorName(doctorProfile) : user?.name;
    const totalCompleted = completedConsultations.length + completedAppointments.length;
    const totalCancelled = cancelledConsultations.length + cancelledAppointments.length;

    const METRIC_CARDS = [
        { label: 'Janji Temu Hari Ini',   val: stats?.apptToday    || 0, icon: '👥', color: '#7c3aed', bg: '#f5f3ff', key: 'patients'    },
        { label: 'Konsultasi Hari Ini',    val: stats?.consToday    || 0, icon: '🩺', color: '#2563eb', bg: '#eff6ff', key: 'consToday'   },
        { label: 'Selesai',                val: totalCompleted,           icon: '✅', color: '#059669', bg: '#f0fdf4', key: 'completed'   },
        { label: 'Konsultasi Upcoming',    val: stats?.consUpcoming || 0, icon: '⏳', color: '#d97706', bg: '#fffbeb', key: 'consUpcoming'},
        { label: 'Janji Temu Upcoming',    val: stats?.apptUpcoming || 0, icon: '📅', color: '#0891b2', bg: '#ecfeff', key: 'apptUpcoming'},
        { label: 'Dibatalkan',             val: totalCancelled,           icon: '🚫', color: '#dc2626', bg: '#fef2f2', key: 'cancelled'  },
    ];

    const TABS = [
        { key: 'today',    label: '📅 Hari Ini'    },
        { key: 'week',     label: '📆 Minggu Ini'  },
        { key: 'upcoming', label: '⏰ Mendatang'   },
        { key: 'all',      label: '📋 Semua'       },
    ];

    const renderScheduleItem = (s, isPast = false) => {
        const isOnline = s.type === 'consultation';
        const rowAccent = (item) => {
            if (item.type === 'consultation') return CONS_STATUS[item.status]?.color || colors.primary;
            return APPT_STATUS[item.status]?.color || colors.border;
        };
        return (
            <div key={s._id} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 18px', borderRadius: 14,
                background: isPast ? '#fafafa' : '#fff',
                border: `1px solid ${colors.border}`,
                borderLeft: `4px solid ${rowAccent(s)}`,
                opacity: isPast ? 0.75 : 1,
                cursor: isOnline ? 'pointer' : 'default',
                transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,.03)',
            }}
                onClick={() => isOnline && navigate(`/consultations/${s._id}`)}
                onMouseEnter={e => { if (isOnline) { e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,.12)'; e.currentTarget.style.transform = 'translateX(2px)'; }}}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,.03)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            >
                <div style={{ fontWeight: 800, fontSize: 15, color: isPast ? colors.muted : colors.primary, width: 56, flexShrink: 0, textAlign: 'center' }}>
                    {s.time}
                    <div style={{ fontSize: 9, fontWeight: 500, color: colors.subtle }}>WIB</div>
                </div>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: isOnline ? '#2563eb' : '#7c3aed', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.patientName}</div>
                    <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                        {isOnline ? `💬 Konsultasi Online${s.consultationType === 'video_call' ? ' (Video)' : ' (Chat)'}` : '📅 Janji Temu Offline'}
                        {s.status === 'no_show' && <span style={{ marginLeft: 10, color: '#f59e0b' }}>⚠️ Pasien Tidak Hadir</span>}
                        {s.patientPhone && s.status !== 'no_show' && <span style={{ marginLeft: 10, color: colors.subtle }}>📞 {s.patientPhone}</span>}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <SBadge status={s.status} map={{ ...CONS_STATUS, ...APPT_STATUS }} />
                    {isOnline && ['confirmed','in_progress','paid','ongoing'].includes(s.status) && (
                        <Btn size="sm" variant="outline" onClick={e => { e.stopPropagation(); navigate(`/consultations/${s._id}`); }}>💬 Buka</Btn>
                    )}
                </div>
            </div>
        );
    };

    // ── Build chart data dari diseaseData ────────────────────────────────────
    const buildChartData = (data) => {
        if (!data || Object.keys(data).length === 0) return null;

        const topKategori = Object.entries(data)
            .map(([k, arr]) => ({ k, total: arr.reduce((s, r) => s + r.jumlah, 0) }))
            .sort((a, b) => b.total - a.total);

        // Horizontal Bar: total per kategori
        const hBarData = {
            labels: topKategori.map(x => x.k),
            datasets: [{
                label: 'Total Kasus',
                data: topKategori.map(x => x.total),
                backgroundColor: topKategori.map(x => (CATEGORY_COLORS[x.k] || '#94a3b8') + 'cc'),
                borderColor:     topKategori.map(x => CATEGORY_COLORS[x.k] || '#94a3b8'),
                borderWidth: 1.5,
                borderRadius: 4,
            }],
        };

        // Line Chart: tren waktu (top 5 kategori)
        const allDates = [...new Set(
            Object.values(data).flat().map(r => r.tanggal)
        )].sort();

        // Label sumbu X: singkat jika periode panjang
        const isLongPeriod = allDates.length > 60;
        const fmtLabel = (d) => {
            const dt = new Date(d + 'T00:00:00+07:00');
            return isLongPeriod
                ? dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                : dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        };

        // Jika periode panjang (3m/6m), aggregate ke mingguan
        let lineLabels, lineData;
        if (allDates.length > 30) {
            // Group ke mingguan
            const weekly = {};
            allDates.forEach(d => {
                const dt   = new Date(d + 'T00:00:00+07:00');
                const day  = dt.getDay();
                const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
                const mon  = new Date(dt);
                mon.setDate(diff);
                const wk = mon.toISOString().slice(0, 10);
                if (!weekly[wk]) weekly[wk] = [];
                weekly[wk].push(d);
            });
            lineLabels = Object.keys(weekly).sort().map(w => {
                const dt = new Date(w + 'T00:00:00+07:00');
                return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            });
            const weekKeys = Object.keys(weekly).sort();

            lineData = topKategori.slice(0, 5).map(({ k }) => ({
                label: k,
                data: weekKeys.map(wk =>
                    weekly[wk].reduce((s, d) => {
                        const entry = (data[k] || []).find(r => r.tanggal === d);
                        return s + (entry ? entry.jumlah : 0);
                    }, 0)
                ),
                borderColor: CATEGORY_COLORS[k] || '#94a3b8',
                backgroundColor: (CATEGORY_COLORS[k] || '#94a3b8') + '22',
                fill: false, tension: 0.35, pointRadius: 3,
                pointBackgroundColor: CATEGORY_COLORS[k] || '#94a3b8',
            }));
        } else {
            lineLabels = allDates.map(fmtLabel);
            lineData = topKategori.slice(0, 5).map(({ k }) => ({
                label: k,
                data: allDates.map(d => {
                    const entry = (data[k] || []).find(r => r.tanggal === d);
                    return entry ? entry.jumlah : 0;
                }),
                borderColor: CATEGORY_COLORS[k] || '#94a3b8',
                backgroundColor: (CATEGORY_COLORS[k] || '#94a3b8') + '22',
                fill: false, tension: 0.35, pointRadius: 3,
                pointBackgroundColor: CATEGORY_COLORS[k] || '#94a3b8',
            }));
        }

        return { topKategori, hBarData, lineLabels, lineDatasets: lineData };
    };

    const chartData = buildChartData(diseaseData);

    return (
        <div>
            {/* ── HEADER STRIP ── */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #2563eb 100%)',
                borderRadius: 20, padding: '28px 32px', marginBottom: 28,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: 20,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>👨‍⚕️</div>
                    <div>
                        <div style={{ fontSize: 14, color: '#93c5fd', marginBottom: 4 }}>{greeting()},</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{doctorName}</div>
                        {stats?.rating != null && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.1)', padding: '4px 12px', borderRadius: 20 }}>
                                <span style={{ fontSize: 14, color: '#fbbf24' }}>★</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: '#fde68a' }}>{Number(stats.rating).toFixed(1)}</span>
                                {stats.totalReviews > 0 && <span style={{ fontSize: 12, color: '#93c5fd' }}>({stats.totalReviews} ulasan)</span>}
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 38, fontWeight: 800, color: '#fff', letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>
                        {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 13, color: '#93c5fd', marginTop: 4 }}>
                        {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <Btn size="sm" variant="ghost" style={{ marginTop: 12, background: 'rgba(255,255,255,.12)', color: '#e0f2fe', border: 'none' }} onClick={fetchData}>↻ Refresh</Btn>
                </div>
            </div>

            {/* ── REMINDER BANNER ── */}
            {reminders.length > 0 && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 14, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>⏰</span>
                    <div>
                        <strong style={{ color: '#92400e', fontSize: 14 }}>Reminder — Jadwal dalam 1 Jam:</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                            {reminders.map(r => (
                                <div key={r._id} style={{ fontSize: 13, color: '#78350f', background: '#fff3e0', padding: '4px 12px', borderRadius: 20 }}>
                                    {r.time} WIB — <strong>{r.patientName}</strong> ({r.type === 'consultation' ? 'Konsultasi Online' : 'Janji Temu'})
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {loading ? <Spinner /> : (
                <>
                    {/* ── METRIC CARDS ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
                        {METRIC_CARDS.map((c) => (
                            <Card key={c.key} style={{ padding: '20px 18px', borderRadius: 16, border: `1px solid ${colors.border}`, background: '#fff' }}>
                                <div style={{ fontSize: 28, marginBottom: 12, background: c.bg, width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</div>
                                <div style={{ fontSize: 32, fontWeight: 800, color: c.color, letterSpacing: -1, lineHeight: 1.2 }}>{c.val}</div>
                                <div style={{ fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 1.4 }}>{c.label}</div>
                            </Card>
                        ))}
                    </div>

                    {/* ── TREN PENYAKIT (ML) ── */}
                    <Card style={{ borderRadius: 20, marginBottom: 24 }}>
                        {/* Header + Filter */}
                        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${colors.border}`, background: '#fafafa' }}>
                            <div style={{ fontWeight: 700, fontSize: 16, color: colors.text, marginBottom: 14 }}>
                                🦠 Tren Penyakit Pasien Saya
                            </div>
                            {/* Period filter */}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                <span style={{ fontSize: 11, color: colors.muted, alignSelf: 'center', fontWeight: 600 }}>Periode:</span>
                                {PERIOD_OPTS.map(o => (
                                    <button key={o.v} onClick={() => setDiseasePeriod(o.v)} style={{
                                        padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                        cursor: 'pointer', border: `1px solid ${diseasePeriod === o.v ? colors.primary : colors.border}`,
                                        background: diseasePeriod === o.v ? colors.primary : '#fff',
                                        color: diseasePeriod === o.v ? '#fff' : colors.muted, fontFamily: 'inherit',
                                    }}>{o.l}</button>
                                ))}
                            </div>
                            {/* Gender filter */}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 11, color: colors.muted, fontWeight: 600 }}>Gender:</span>
                                {GENDER_OPTS.map(o => (
                                    <button key={o.v} onClick={() => setDiseaseGender(o.v)} style={{
                                        padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                        cursor: 'pointer', border: `1px solid ${diseaseGender === o.v ? '#7c3aed' : colors.border}`,
                                        background: diseaseGender === o.v ? '#7c3aed' : '#fff',
                                        color: diseaseGender === o.v ? '#fff' : colors.muted, fontFamily: 'inherit',
                                    }}>{o.l}</button>
                                ))}
                                {diseaseLoading && <span style={{ fontSize: 12, color: colors.muted }}>⏳ Memuat...</span>}
                            </div>
                        </div>

                        <div style={{ padding: '20px 24px' }}>
                            {diseaseLoading ? (
                                <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
                            ) : !chartData ? (
                                <Empty icon="📊" text="Belum ada data klasifikasi penyakit. Data akan muncul setelah pasien submit keluhan." />
                            ) : (
                                <>
                                    {/* AI Insight Box */}
                                    <div style={{
                                        background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                                        border: '1px solid #bfdbfe', borderRadius: 14,
                                        padding: '14px 18px', marginBottom: 24,
                                        display: 'flex', gap: 12, alignItems: 'flex-start',
                                    }}>
                                        <span style={{ fontSize: 22, flexShrink: 0 }}>🤖</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                AI Analytics Insight
                                            </div>
                                            {aiInsightLoading ? (
                                                <div style={{ fontSize: 13, color: '#64748b' }}>⏳ Menganalisis data...</div>
                                            ) : aiInsight ? (
                                                <div>
                                                    <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.7 }}>{aiInsight}</div>
                                                    {aiFromCache && <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>⚡ Diperbarui dari cache (6 jam terakhir)</div>}
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: 13, color: '#94a3b8' }}>Insight belum tersedia.</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Dua chart side by side */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                                        {/* Horizontal Bar: Kategori Terbanyak */}
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: colors.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                📊 Kategori Terbanyak
                                            </div>
                                            <div style={{ height: 220 }}>
                                                <Bar data={chartData.hBarData} options={{
                                                    indexAxis: 'y',
                                                    responsive: true, maintainAspectRatio: false,
                                                    plugins: {
                                                        legend: { display: false },
                                                        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} kasus` } },
                                                    },
                                                    scales: {
                                                        x: { beginAtZero: true, ticks: { font: { size: 10 }, stepSize: 1 }, grid: { color: '#f1f5f9' } },
                                                        y: { grid: { display: false }, ticks: { font: { size: 10 } } },
                                                    },
                                                }} />
                                            </div>
                                        </div>

                                        {/* Line Chart: Tren Waktu */}
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: colors.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                📈 Tren dari Waktu ke Waktu (Top 5)
                                            </div>
                                            <div style={{ height: 220 }}>
                                                <Line data={{ labels: chartData.lineLabels, datasets: chartData.lineDatasets }} options={{
                                                    responsive: true, maintainAspectRatio: false,
                                                    interaction: { mode: 'index', intersect: false },
                                                    plugins: {
                                                        legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } },
                                                        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} kasus` } },
                                                    },
                                                    scales: {
                                                        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } },
                                                        y: { beginAtZero: true, ticks: { font: { size: 10 }, stepSize: 1 }, grid: { color: '#f1f5f9' } },
                                                    },
                                                }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Top kategori list */}
                                    <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: colors.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            Ranking Kategori Penyakit
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                                            {chartData.topKategori.slice(0, 8).map(({ k, total }, i) => (
                                                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f8fafc', borderRadius: 10 }}>
                                                    <span style={{ fontSize: 11, color: colors.subtle, width: 16, flexShrink: 0 }}>{i + 1}.</span>
                                                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS[k] || '#94a3b8', flexShrink: 0 }} />
                                                    <span style={{ flex: 1, fontSize: 12, color: colors.text }}>{k}</span>
                                                    <span style={{ fontSize: 11, fontWeight: 700, background: '#fff', borderRadius: 8, padding: '2px 8px', color: colors.muted }}>
                                                        {total}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </Card>

                    {/* ── JADWAL KESELURUHAN ── */}
                    <Card style={{ borderRadius: 20, overflow: 'hidden' }}>
                        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${colors.border}`, background: '#fafafa' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                                <div style={{ fontWeight: 700, fontSize: 16, color: colors.text }}>📋 Jadwal Keseluruhan</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 13, color: colors.muted }}>Total: {filtered.length} jadwal</span>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>💬 {filtered.filter(s => s.type === 'consultation').length} online</span>
                                        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#f5f3ff', color: '#6d28d9', fontWeight: 600 }}>📅 {filtered.filter(s => s.type === 'appointment').length} offline</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {TABS.map(t => (
                                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                                        padding: '8px 20px', fontSize: 13, fontWeight: 600,
                                        border: 'none', borderRadius: 30, cursor: 'pointer',
                                        fontFamily: 'inherit', transition: 'all 0.2s',
                                        background: tab === t.key ? colors.primary : '#f1f5f9',
                                        color: tab === t.key ? '#fff' : colors.muted,
                                        boxShadow: tab === t.key ? `0 2px 8px ${colors.primary}30` : 'none',
                                    }}>{t.label}</button>
                                ))}
                            </div>
                        </div>

                        <div style={{ padding: '16px 24px 24px' }}>
                            {dateKeys.length === 0 ? (
                                <Empty icon="🗓️" text={
                                    tab === 'today'    ? 'Tidak ada jadwal hari ini' :
                                    tab === 'week'     ? 'Tidak ada jadwal minggu ini' :
                                    tab === 'upcoming' ? 'Tidak ada jadwal mendatang' : 'Belum ada jadwal'
                                } />
                            ) : (
                                dateKeys.map(dateKey => (
                                    <div key={dateKey} style={{ marginBottom: 24 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: isToday(grouped[dateKey][0]?.sortAt) ? colors.primary : colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {isToday(grouped[dateKey][0]?.sortAt) && <span style={{ background: colors.primary, color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '2px 12px' }}>HARI INI</span>}
                                            {dateKey}
                                            <span style={{ fontSize: 11, color: colors.subtle, fontWeight: 400, textTransform: 'none' }}>{grouped[dateKey].length} jadwal</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {grouped[dateKey].map((s) => renderScheduleItem(s, new Date(s.sortAt) < now))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};

export default SectionBeranda;
