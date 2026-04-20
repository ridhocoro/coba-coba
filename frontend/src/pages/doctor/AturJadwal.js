import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import {
    API_URL, colors, fmtDate, fmtDT, toMin, toHHMM,
    CONS_SLOTS, APPT_SLOTS, DAYS_INFO, makeEmptySchedule, DEF_CONS, DEF_APPT,
    CONS_STATUS, APPT_STATUS,
    Card, Btn, Spinner, Empty, SBadge, Toggle, Modal, SectionHeader,
    ScheduleGrid, SchedulePreview, TH, TD, ProfileField, InputField, getAPPTSlotsForDay,
} from './shared';

/**
 * SectionAturJadwal - Komponen untuk mengatur jadwal dokter
 * 
 * PERUBAHAN (20 Apr 2026):
 * - Menambahkan dukungan jadwal janji temu berbeda per hari
 * - Senin-Jumat: 08:00 - 20:00
 * - Sabtu: 08:00 - 18:00
 * - Props isDynamicSlots=true pada ScheduleGrid untuk Janji Temu
 */
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
                            isDynamicSlots={false}
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
                            Klik slot untuk mengaktifkan / menonaktifkan. Jadwal berbeda per hari: Senin-Jumat hingga 20:00, Sabtu hingga 18:00. Jadwal berlaku dari Senin hingga Sabtu minggu yang ditentukan saat Anda klik Rilis Jadwal.
                        </div>

                        <ScheduleGrid
                            schedule={apptForm.schedule}
                            allowedSlots={APPT_SLOTS}
                            onChange={(dayKey, slot) => toggleSlot(apptForm, setApptForm, dayKey, slot)}
                            color="#7c3aed"
                            isDynamicSlots={true}
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



export default SectionAturJadwal;