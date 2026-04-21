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
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
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
    const [allItems, setAllItems] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [time,     setTime]     = useState(new Date());
    const [tab,      setTab]      = useState('today');
   
    
    // Data untuk card
    const [completedConsultations, setCompletedConsultations] = useState([]);
    const [completedAppointments, setCompletedAppointments] = useState([]);
    const [cancelledConsultations, setCancelledConsultations] = useState([]);
    const [cancelledAppointments, setCancelledAppointments] = useState([]);

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
                api.get('/api/appointments/doctor/list', { params: { status: 'all' } }),
                api.get('/api/consultations/doctor/all'),
            ]);

            if (statsRes.status === 'fulfilled') {
                setStats(statsRes.value.data.stats);
                console.log('Stats:', statsRes.value.data.stats);
            }

            // Normalize appointments
            const appts = (apptRes.status === 'fulfilled'
                ? apptRes.value.data.appointments || []
                : []
            ).map(a => ({
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
            ).map(c => ({
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

            // DEBUG: Lihat status yang tersedia
            console.log('=== STATUS YANG TERSEDIA ===');
            console.log('Appointment statuses:', [...new Set(appts.map(a => a.status))]);
            console.log('Consultation statuses:', [...new Set(cons.map(c => c.status))]);

            const merged = [...appts, ...cons].sort((a, b) =>
                new Date(a.sortAt) - new Date(b.sortAt)
            );
            setAllItems(merged);

            // ================================================================
            // 1. SELESAI (COMPLETED)
            // ================================================================
            // Konsultasi selesai: status 'completed' atau 'no_show'
            const completedConsultationStatuses = ['completed', 'no_show'];
            const completedCons = merged.filter(item => 
                item.type === 'consultation' && completedConsultationStatuses.includes(item.status)
            );
            setCompletedConsultations(completedCons);
            
            // Janji temu selesai: status 'completed'
            const completedAppointmentStatuses = ['completed'];
            const completedAppts = merged.filter(item => 
                item.type === 'appointment' && completedAppointmentStatuses.includes(item.status)
            );
            setCompletedAppointments(completedAppts);

            // ================================================================
            // 2. DIBATALKAN (CANCELLED)
            // ================================================================
            const cancelledStatuses = [
                'cancelled', 'cancelled_by_user', 'cancelled_by_doctor', 'cancelled_by_admin',
                'expired', 'refunded', 'refund_failed', 'doctor_no_show'
            ];
            
            const cancelledCons = merged.filter(item => 
                item.type === 'consultation' && cancelledStatuses.includes(item.status)
            );
            setCancelledConsultations(cancelledCons);
            
            const cancelledAppts = merged.filter(item => 
                item.type === 'appointment' && cancelledStatuses.includes(item.status)
            );
            setCancelledAppointments(cancelledAppts);

            console.log('=== HASIL FILTER ===');
            console.log('Completed Consultations:', completedCons.length);
            console.log('Completed Appointments:', completedAppts.length);
            console.log('Cancelled Consultations:', cancelledCons.length);
            console.log('Cancelled Appointments:', cancelledAppts.length);

        } catch (err) {
            console.error('Fetch error:', err);
            toast.error('Gagal memuat data beranda');
        }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Reminder ────────────────────────────────────────────────────────────
    const reminders = allItems.filter(s => {
        if (!s.scheduledAt) return false;
        const diff = new Date(s.scheduledAt).getTime() - Date.now();
        return diff > 0 && diff <= 60 * 60 * 1000;
    });

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

    // ── Filter for main schedule ──────────────────────────────────────────────
    const now = new Date();
    const excludeStatuses = [
        'completed', 'no_show', 
        'cancelled', 'cancelled_by_user', 'cancelled_by_doctor', 'cancelled_by_admin',
        'expired', 'refunded', 'refund_failed', 'doctor_no_show'
    ];
    
    const filtered = allItems.filter(s => {
        if (!s.sortAt) return false;
        if (excludeStatuses.includes(s.status)) return false;
        const d = new Date(s.sortAt);
        if (tab === 'today')    return isToday(d);
        if (tab === 'week')     return isThisWeek(d);
        if (tab === 'upcoming') return d >= now;
        return true;
    });

    // ── Group by date for main schedule ────────────────────────────────────────
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

    // Helper render item
    const renderScheduleItem = (s, isPast = false) => {
        const isOnline = s.type === 'consultation';
        const rowAccent = (item) => {
            if (item.type === 'consultation') return CONS_STATUS[item.status]?.color || colors.primary;
            return APPT_STATUS[item.status]?.color || colors.border;
        };
        
        return (
            <div
                key={s._id}
                style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '14px 18px', borderRadius: 14,
                    background: isPast ? '#fafafa' : '#fff',
                    border: `1px solid ${colors.border}`,
                    borderLeft: `4px solid ${rowAccent(s)}`,
                    opacity: isPast ? 0.75 : 1,
                    cursor: isOnline ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,.03)',
                }}
                onClick={() => isOnline && navigate(`/consultations/${s._id}`)}
                onMouseEnter={e => {
                    if (isOnline) {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,.12)';
                        e.currentTarget.style.transform = 'translateX(2px)';
                    }
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,.03)';
                    e.currentTarget.style.transform = 'translateX(0)';
                }}
            >
                <div style={{
                    fontWeight: 800, fontSize: 15,
                    color: isPast ? colors.muted : colors.primary,
                    width: 56, flexShrink: 0, textAlign: 'center',
                }}>
                    {s.time}
                    <div style={{ fontSize: 9, fontWeight: 500, color: colors.subtle }}>WIB</div>
                </div>

                <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: isOnline ? '#2563eb' : '#7c3aed',
                    flexShrink: 0,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontWeight: 700, fontSize: 14,
                        color: colors.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {s.patientName}
                    </div>
                    <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                        {isOnline
                            ? `💬 Konsultasi Online${s.consultationType === 'video_call' ? ' (Video)' : ' (Chat)'}`
                            : '📅 Janji Temu Offline'
                        }
                        {s.status === 'no_show' && (
                            <span style={{ marginLeft: 10, color: '#f59e0b' }}>
                                ⚠️ Pasien Tidak Hadir
                            </span>
                        )}
                        {s.patientPhone && s.status !== 'no_show' && (
                            <span style={{ marginLeft: 10, color: colors.subtle }}>
                                📞 {s.patientPhone}
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
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
    };

    // ── METRIC CARDS ──
    const totalCompleted = completedConsultations.length + completedAppointments.length;
    const totalCancelled = cancelledConsultations.length + cancelledAppointments.length;

    const METRIC_CARDS = [
        { 
            label: 'Janji Temu Hari Ini', 
            val: stats?.patientsTodayCount || stats?.apptToday || 0, 
            icon: '👥', 
            color: '#7c3aed', 
            bg: '#f5f3ff',
            key: 'patients'
        },
        { 
            label: 'Konsultasi Hari Ini', 
            val: stats?.consToday || 0, 
            icon: '🩺', 
            color: '#2563eb', 
            bg: '#eff6ff',
            key: 'consToday'
        },
        { 
            label: 'Selesai', 
            val: totalCompleted,
            icon: '✅', 
            color: '#059669', 
            bg: '#f0fdf4',
            key: 'completed'
        },
        { 
            label: 'Konsultasi Upcoming', 
            val: stats?.consUpcoming || 0, 
            icon: '⏳', 
            color: '#d97706', 
            bg: '#fffbeb',
            key: 'consUpcoming'
        },
        { 
            label: 'Janji Temu Upcoming', 
            val: stats?.apptUpcoming || 0, 
            icon: '📅', 
            color: '#0891b2', 
            bg: '#ecfeff',
            key: 'apptUpcoming'
        },
        { 
            label: 'Dibatalkan', 
            val: totalCancelled,
            icon: '🚫', 
            color: '#dc2626', 
            bg: '#fef2f2',
            key: 'cancelled'
        },
    ];

    const TABS = [
        { key: 'today',    label: '📅 Hari Ini' },
        { key: 'week',     label: '📆 Minggu Ini' },
        { key: 'upcoming', label: '⏰ Mendatang' },
        { key: 'all',      label: '📋 Semua' },
    ];

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
                    <div style={{
                        width: 60, height: 60, borderRadius: 16,
                        background: 'rgba(255,255,255,.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                    }}>👨‍⚕️</div>
                    <div>
                        <div style={{ fontSize: 14, color: '#93c5fd', marginBottom: 4 }}>{greeting()},</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                            {doctorName}
                        </div>
                        {stats?.rating != null && (
                            <div style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 8,
                                background: 'rgba(255,255,255,.1)',
                                padding: '4px 12px',
                                borderRadius: 20,
                            }}>
                                <span style={{ fontSize: 14, color: '#fbbf24' }}>★</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: '#fde68a' }}>
                                    {Number(stats.rating).toFixed(1)}
                                </span>
                                {stats.totalReviews > 0 && (
                                    <span style={{ fontSize: 12, color: '#93c5fd' }}>
                                        ({stats.totalReviews} ulasan)
                                    </span>
                                )}
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
                    <Btn
                        size="sm" variant="ghost"
                        style={{ marginTop: 12, background: 'rgba(255,255,255,.12)', color: '#e0f2fe', border: 'none' }}
                        onClick={fetchData}
                    >↻ Refresh</Btn>
                </div>
            </div>

            {/* ── REMINDER BANNER ── */}
            {reminders.length > 0 && (
                <div style={{
                    background: '#fef3c7', border: '1px solid #fcd34d',
                    borderRadius: 14, padding: '14px 20px', marginBottom: 24,
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                }}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>⏰</span>
                    <div>
                        <strong style={{ color: '#92400e', fontSize: 14 }}>
                            Reminder — Jadwal dalam 1 Jam:
                        </strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                            {reminders.map(r => (
                                <div key={r._id} style={{ 
                                    fontSize: 13, color: '#78350f', 
                                    background: '#fff3e0', padding: '4px 12px', borderRadius: 20,
                                }}>
                                    {r.time} WIB — <strong>{r.patientName}</strong>
                                    ({r.type === 'consultation' ? 'Konsultasi Online' : 'Janji Temu'})
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {loading ? <Spinner /> : (
                <>
                    {/* ── METRIC CARDS dengan GRID ── */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: 16, 
                        marginBottom: 32,
                    }}>
                        {METRIC_CARDS.map((c) => (
                            <Card 
                                key={c.key}
                                style={{ 
                                    padding: '20px 18px', 
                                    borderRadius: 16,
                                    border: `1px solid ${colors.border}`,
                                    background: '#fff',
                                }}
                            >
                                <div style={{ 
                                    fontSize: 28, marginBottom: 12,
                                    background: c.bg, width: 48, height: 48,
                                    borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>{c.icon}</div>
                                <div style={{
                                    fontSize: 32, fontWeight: 800,
                                    color: c.color, letterSpacing: -1, lineHeight: 1.2,
                                }}>{c.val}</div>
                                <div style={{ fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 1.4 }}>
                                    {c.label}
                                </div>
                            </Card>
                        ))}
                    </div>

                    {/* ── JADWAL KESELURUHAN ── */}
                    <Card style={{ borderRadius: 20, overflow: 'hidden' }}>
                        <div style={{
                            padding: '18px 24px',
                            borderBottom: `1px solid ${colors.border}`,
                            background: '#fafafa',
                        }}>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12,
                            }}>
                                <div style={{ fontWeight: 700, fontSize: 16, color: colors.text }}>
                                    📋 Jadwal Keseluruhan
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 13, color: colors.muted }}>
                                        Total: {filtered.length} jadwal
                                    </span>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <span style={{
                                            fontSize: 11, padding: '3px 10px', borderRadius: 20,
                                            background: '#dbeafe', color: '#1e40af', fontWeight: 600,
                                        }}>
                                            💬 {filtered.filter(s => s.type === 'consultation').length} online
                                        </span>
                                        <span style={{
                                            fontSize: 11, padding: '3px 10px', borderRadius: 20,
                                            background: '#f5f3ff', color: '#6d28d9', fontWeight: 600,
                                        }}>
                                            📅 {filtered.filter(s => s.type === 'appointment').length} offline
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Tab filter */}
                            <div style={{
                                display: 'flex', gap: 8, flexWrap: 'wrap',
                            }}>
                                {TABS.map(t => (
                                    <button
                                        key={t.key}
                                        onClick={() => setTab(t.key)}
                                        style={{
                                            padding: '8px 20px', fontSize: 13, fontWeight: 600,
                                            border: 'none', borderRadius: 30, cursor: 'pointer',
                                            fontFamily: 'inherit', transition: 'all 0.2s',
                                            background: tab === t.key ? colors.primary : '#f1f5f9',
                                            color: tab === t.key ? '#fff' : colors.muted,
                                            boxShadow: tab === t.key ? `0 2px 8px ${colors.primary}30` : 'none',
                                        }}
                                    >{t.label}</button>
                                ))}
                            </div>
                        </div>

                        {/* Body jadwal */}
                        <div style={{ padding: '16px 24px 24px' }}>
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
                                    <div key={dateKey} style={{ marginBottom: 24 }}>
                                        <div style={{
                                            fontSize: 13, fontWeight: 700,
                                            color: isToday(grouped[dateKey][0]?.sortAt)
                                                ? colors.primary : colors.muted,
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.8,
                                            marginBottom: 12,
                                            display: 'flex', alignItems: 'center', gap: 10,
                                        }}>
                                            {isToday(grouped[dateKey][0]?.sortAt) && (
                                                <span style={{
                                                    background: colors.primary, color: '#fff',
                                                    fontSize: 10, fontWeight: 700,
                                                    borderRadius: 20, padding: '2px 12px',
                                                }}>HARI INI</span>
                                            )}
                                            {dateKey}
                                            <span style={{
                                                fontSize: 11, color: colors.subtle, fontWeight: 400,
                                                textTransform: 'none',
                                            }}>
                                                {grouped[dateKey].length} jadwal
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {grouped[dateKey].map((s, idx) => {
                                                const isPast = new Date(s.sortAt) < now;
                                                return renderScheduleItem(s, isPast);
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