import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { fmtDoctorName } from '../../utils/format';
import {
    colors,
    CONS_STATUS, APPT_STATUS,
    Card, Btn, Spinner, Empty, SBadge,
} from './shared';

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
    // getDay(): 0=Sun,1=Mon,...,6=Sat. Offset to Monday-based week.
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // Sun->7
    const mon  = new Date(now);
    mon.setDate(now.getDate() - dayOfWeek + 1);
    mon.setHours(0, 0, 0, 0);
    const sun  = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return cmp >= mon && cmp <= sun;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: BERANDA
// ═══════════════════════════════════════════════════════════════════════════════
const SectionBeranda = () => {
    const { user, doctorProfile } = useAuth();
    const navigate   = useNavigate();
    const [stats,    setStats]    = useState(null);
    const [allItems, setAllItems] = useState([]); // semua jadwal gabungan
    const [loading,  setLoading]  = useState(true);
    const [time,     setTime]     = useState(new Date());
    const [tab,      setTab]      = useState('today'); // today | week | upcoming | all

    // Jam berjalan
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [statsRes, apptRes, consRes] = await Promise.allSettled([
                api.get('/api/doctors/my/stats'),
                api.get('/api/appointments/doctor/list', {
                    params: { status: 'all' },
                }),
                api.get('/api/consultations/doctor/all'),
            ]);

            if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.stats);

            // Normalize appointments
            const appts = (apptRes.status === 'fulfilled'
                ? apptRes.value.data.appointments || []
                : []
            ).filter(a => ['scheduled','checked_in','completed'].includes(a.status))
             .map(a => ({
                _id          : a._id,
                type         : 'appointment',
                sortAt       : a.scheduledAt || a.appointmentDate,
                time         : a.appointmentTime || '—',
                patientName  : a.userId?.name  || 'Pasien',
                patientPhone : a.userId?.phone || '',
                status       : a.status,
                scheduledAt  : a.scheduledAt || a.appointmentDate,
            }));

            // Normalize consultations
            const cons = (consRes.status === 'fulfilled'
                ? consRes.value.data.consultations || consRes.value.data || []
                : []
            ).filter(c => ['confirmed','in_progress','paid','scheduled','ongoing','completed'].includes(c.status))
             .map(c => ({
                _id             : c._id,
                type            : 'consultation',
                sortAt          : c.scheduledAt,
                time            : c.scheduledAt
                    ? new Date(c.scheduledAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
                      })
                    : '—',
                patientName     : c.userId?.name  || 'Pasien',
                patientPhone    : c.userId?.phone || '',
                status          : c.status,
                scheduledAt     : c.scheduledAt,
                consultationType: c.consultationType || 'chat',
            }));

            // Merge & sort ascending
            const merged = [...appts, ...cons].sort((a, b) =>
                new Date(a.sortAt) - new Date(b.sortAt)
            );
            setAllItems(merged);

        } catch { toast.error('Gagal memuat data beranda'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Reminder: jadwal dalam 1 jam ke depan ────────────────────────────────
    const reminders = allItems.filter(s => {
        if (!s.scheduledAt) return false;
        const diff = new Date(s.scheduledAt).getTime() - Date.now();
        return diff > 0 && diff <= 60 * 60 * 1000;
    });

    // Reminder H-24 toast
    useEffect(() => {
        allItems.forEach(s => {
            if (!s.scheduledAt) return;
            const diff = new Date(s.scheduledAt).getTime() - Date.now();
            if (diff > 23 * 3600000 && diff <= 25 * 3600000) {
                toast(
                    `⏰ Reminder: ${s.patientName} — ${s.type === 'consultation' ? 'Konsultasi Online' : 'Janji Temu'} besok pukul ${s.time}`,
                    { duration: 8000, icon: '🗓️' }
                );
            }
        });
    }, [allItems]);

    // ── Filter by tab ─────────────────────────────────────────────────────────
    const now = new Date();
    const filtered = allItems.filter(s => {
        if (!s.sortAt) return false;
        const d = new Date(s.sortAt);
        if (tab === 'today')    return isToday(d);
        if (tab === 'week')     return isThisWeek(d);
        if (tab === 'upcoming') return d >= now;
        return true; // 'all'
    });

    // ── Group by date ─────────────────────────────────────────────────────────
    const grouped = filtered.reduce((acc, s) => {
        const key = s.sortAt ? toDateKey(s.sortAt) : 'Tanggal tidak diketahui';
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
    }, {});
    const dateKeys = Object.keys(grouped);

    // ── Greeting ──────────────────────────────────────────────────────────────
    const greeting = () => {
        const h = time.getHours();
        if (h < 11) return 'Selamat Pagi';
        if (h < 15) return 'Selamat Siang';
        if (h < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    };

    // ── Metric cards ──────────────────────────────────────────────────────────
    const METRIC_CARDS = stats ? [
        { label: 'Pasien Hari Ini',           val: stats.apptToday,     icon: '👥', color: '#7c3aed', bg: '#f5f3ff' },
        { label: 'Konsultasi Online Hari Ini', val: stats.consToday,     icon: '🩺', color: '#2563eb', bg: '#eff6ff' },
        { label: 'Konsultasi Selesai',         val: stats.consCompleted, icon: '✅', color: '#059669', bg: '#f0fdf4' },
        { label: 'Konsultasi Upcoming',        val: stats.consUpcoming,  icon: '⏳', color: '#d97706', bg: '#fffbeb' },
        { label: 'Konsultasi Dibatalkan',      val: stats.consCancelled, icon: '🚫', color: '#dc2626', bg: '#fef2f2' },
        { label: 'Janji Temu Upcoming',        val: stats.apptUpcoming,  icon: '📅', color: '#0891b2', bg: '#ecfeff' },
        { label: 'Janji Temu Dibatalkan',      val: stats.apptCancelled, icon: '❌', color: '#b45309', bg: '#fffbeb' },
        {
            label: `⭐ ${Number(stats.rating || 0).toFixed(1)} (${stats.totalReviews} review)`,
            val: Number(stats.rating || 0).toFixed(1), icon: '⭐', color: '#ca8a04', bg: '#fefce8', isRating: true,
        },
    ] : [];

    const TABS = [
        { key: 'today',    label: 'Hari Ini' },
        { key: 'week',     label: 'Minggu Ini' },
        { key: 'upcoming', label: 'Mendatang' },
        { key: 'all',      label: 'Semua' },
    ];

    // Status badge color for the schedule item row left border
    const rowAccent = (s) => {
        if (s.type === 'consultation') return CONS_STATUS[s.status]?.color || colors.primary;
        return APPT_STATUS[s.status]?.color || colors.border;
    };

    return (
        <div>
            {/* ── Header strip ── */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #2563eb 100%)',
                borderRadius: 18, padding: '26px 30px', marginBottom: 26,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: 16,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 54, height: 54, borderRadius: 14,
                        background: 'rgba(255,255,255,.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                    }}>🩺</div>
                    <div>
                        <div style={{ fontSize: 13, color: '#93c5fd' }}>{greeting()},</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>
                            {doctorProfile
                                ? fmtDoctorName(doctorProfile)
                                : user?.name}
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>
                        {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 13, color: '#93c5fd', marginTop: 2 }}>
                        {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <Btn
                        size="sm" variant="ghost"
                        style={{ marginTop: 8, background: 'rgba(255,255,255,.12)', color: '#e0f2fe', border: 'none' }}
                        onClick={fetchData}
                    >↻ Refresh</Btn>
                </div>
            </div>

            {/* ── Reminder banner ── */}
            {reminders.length > 0 && (
                <div style={{
                    background: '#fef3c7', border: '1px solid #fcd34d',
                    borderRadius: 13, padding: '12px 18px', marginBottom: 20,
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>⏰</span>
                    <div>
                        <strong style={{ color: '#92400e', fontSize: 14 }}>
                            Reminder — Jadwal dalam 1 Jam:
                        </strong>
                        {reminders.map(r => (
                            <div key={r._id} style={{ fontSize: 13, color: '#78350f', marginTop: 3 }}>
                                {r.time} WIB — <strong>{r.patientName}</strong>
                                {' '}({r.type === 'consultation' ? '💬 Konsultasi Online' : '📅 Janji Temu'})
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading ? <Spinner /> : (
                <>
                    {/* ── Metric cards ── */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
                        gap: 14, marginBottom: 28,
                    }}>
                        {METRIC_CARDS.map((c, i) => (
                            <Card key={i} style={{ padding: '18px 20px' }}>
                                <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
                                <div style={{
                                    fontSize: c.isRating ? 20 : 30, fontWeight: 800,
                                    color: c.color, letterSpacing: -1,
                                }}>{c.val}</div>
                                <div style={{ fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 1.3 }}>
                                    {c.label}
                                </div>
                            </Card>
                        ))}
                    </div>

                    {/* ── Jadwal Keseluruhan ── */}
                    <Card>
                        {/* Header + tabs */}
                        <div style={{
                            padding: '16px 22px',
                            borderBottom: `1px solid ${colors.border}`,
                        }}>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8,
                            }}>
                                <div style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>
                                    📋 Jadwal Keseluruhan
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 12, color: colors.muted }}>
                                        {filtered.length} jadwal
                                    </span>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <span style={{
                                            fontSize: 11, padding: '2px 9px', borderRadius: 20,
                                            background: '#dbeafe', color: '#1e40af', fontWeight: 600,
                                        }}>
                                            💬 {filtered.filter(s => s.type === 'consultation').length} online
                                        </span>
                                        <span style={{
                                            fontSize: 11, padding: '2px 9px', borderRadius: 20,
                                            background: '#f5f3ff', color: '#6d28d9', fontWeight: 600,
                                        }}>
                                            📅 {filtered.filter(s => s.type === 'appointment').length} offline
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Tab filter */}
                            <div style={{
                                display: 'flex', gap: 4,
                                background: '#f1f5f9', borderRadius: 10, padding: 4,
                                width: 'fit-content',
                            }}>
                                {TABS.map(t => (
                                    <button
                                        key={t.key}
                                        onClick={() => setTab(t.key)}
                                        style={{
                                            padding: '6px 16px', fontSize: 12, fontWeight: 600,
                                            border: 'none', borderRadius: 8, cursor: 'pointer',
                                            fontFamily: 'inherit', transition: 'all .15s',
                                            background: tab === t.key ? '#fff' : 'transparent',
                                            color: tab === t.key ? colors.text : colors.muted,
                                            boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                                        }}
                                    >{t.label}</button>
                                ))}
                            </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '12px 22px 20px' }}>
                            {dateKeys.length === 0 ? (
                                <Empty
                                    icon="🗓️"
                                    text={
                                        tab === 'today'    ? 'Tidak ada jadwal hari ini' :
                                        tab === 'week'     ? 'Tidak ada jadwal minggu ini' :
                                        tab === 'upcoming' ? 'Tidak ada jadwal mendatang' :
                                        'Belum ada jadwal'
                                    }
                                />
                            ) : (
                                dateKeys.map(dateKey => (
                                    <div key={dateKey} style={{ marginBottom: 20 }}>
                                        {/* Date header */}
                                        <div style={{
                                            fontSize: 12, fontWeight: 700,
                                            color: isToday(grouped[dateKey][0]?.sortAt)
                                                ? colors.primary : colors.muted,
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.5,
                                            marginBottom: 8,
                                            display: 'flex', alignItems: 'center', gap: 8,
                                        }}>
                                            {isToday(grouped[dateKey][0]?.sortAt) && (
                                                <span style={{
                                                    background: colors.primary, color: '#fff',
                                                    fontSize: 10, fontWeight: 700,
                                                    borderRadius: 6, padding: '1px 7px',
                                                }}>HARI INI</span>
                                            )}
                                            {dateKey}
                                            <span style={{
                                                fontSize: 11, color: colors.subtle, fontWeight: 400,
                                                textTransform: 'none',
                                            }}>
                                                — {grouped[dateKey].length} jadwal
                                            </span>
                                        </div>

                                        {/* Schedule items */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {grouped[dateKey].map((s, idx) => {
                                                const isOnline = s.type === 'consultation';
                                                const isPast   = new Date(s.sortAt) < now;
                                                return (
                                                    <div
                                                        key={`${s._id}-${idx}`}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 14,
                                                            padding: '12px 16px', borderRadius: 12,
                                                            background: isPast ? '#fafafa' : '#f8fafc',
                                                            border: `1px solid ${colors.border}`,
                                                            borderLeft: `4px solid ${rowAccent(s)}`,
                                                            opacity: isPast ? 0.7 : 1,
                                                            cursor: isOnline ? 'pointer' : 'default',
                                                            transition: 'box-shadow .15s',
                                                        }}
                                                        onClick={() => isOnline && navigate(`/consultations/${s._id}`)}
                                                        onMouseEnter={e => {
                                                            if (isOnline) e.currentTarget.style.boxShadow = '0 2px 10px rgba(37,99,235,.12)';
                                                        }}
                                                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                                                    >
                                                        {/* Jam */}
                                                        <div style={{
                                                            fontWeight: 800, fontSize: 14,
                                                            color: isPast ? colors.muted : colors.primary,
                                                            width: 52, flexShrink: 0, textAlign: 'center',
                                                        }}>
                                                            {s.time}
                                                            <div style={{ fontSize: 9, fontWeight: 500, color: colors.subtle }}>WIB</div>
                                                        </div>

                                                        {/* Dot */}
                                                        <div style={{
                                                            width: 10, height: 10, borderRadius: '50%',
                                                            background: isOnline ? '#2563eb' : '#7c3aed',
                                                            flexShrink: 0,
                                                            boxShadow: isPast ? 'none' : `0 0 0 3px ${isOnline ? '#dbeafe' : '#ede9fe'}`,
                                                        }} />

                                                        {/* Info */}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{
                                                                fontWeight: 700, fontSize: 13,
                                                                color: colors.text,
                                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                            }}>
                                                                {s.patientName}
                                                            </div>
                                                            <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                                                                {isOnline
                                                                    ? `💬 Konsultasi Online${s.consultationType === 'video_call' ? ' (Video)' : ' (Chat)'}`
                                                                    : '📅 Janji Temu Offline'
                                                                }
                                                                {s.patientPhone && (
                                                                    <span style={{ marginLeft: 8, color: colors.subtle }}>
                                                                        {s.patientPhone}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Status + aksi */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                            <SBadge
                                                                status={s.status}
                                                                map={{ ...CONS_STATUS, ...APPT_STATUS }}
                                                            />
                                                            {isOnline && ['confirmed','in_progress','paid','ongoing'].includes(s.status) && (
                                                                <Btn
                                                                    size="sm" variant="outline"
                                                                    onClick={e => { e.stopPropagation(); navigate(`/consultations/${s._id}`); }}
                                                                >
                                                                    💬 Buka
                                                                </Btn>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
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