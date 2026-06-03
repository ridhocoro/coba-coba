import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { getCache, setCache, hasCache } from '../../utils/cache';
import {
    API_URL, colors, fmtDate, fmtDT, toMin, toHHMM,
    CONS_SLOTS, APPT_SLOTS, DAYS_INFO, makeEmptySchedule, DEF_CONS, DEF_APPT,
    CONS_STATUS, APPT_STATUS,
    Card, Btn, Spinner, Empty, SBadge, Toggle, Modal, SectionHeader,
    ScheduleGrid, SchedulePreview, TH, TD, ProfileField, InputField,
} from './shared';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: SURAT SAKIT (Konsultasi + Janji Temu)
// ═══════════════════════════════════════════════════════════════════════════════
const SectionSuratSakit = () => {
    const [tab, setTab]           = useState('all'); // 'all' | 'consultation' | 'appointment'
    const [items, setItems]       = useState(() => getCache('doctor:suratsakit:items', []));
    const [loading, setLoading]   = useState(() => !hasCache('doctor:suratsakit:items'));
    const [detail, setDetail]     = useState(null);

    const fetchData = useCallback(async (background = false) => {
        if (!background) setLoading(!hasCache('doctor:suratsakit:items'));
        try {
            const [consRes, apptRes] = await Promise.all([
                api.get('/api/consultations/doctor/all').catch(() => ({ data: { consultations: [] } })),
                api.get('/api/appointments/doctor/list').catch(() => ({ data: { appointments: [] } })),
            ]);

            const cons = (consRes.data.consultations || consRes.data || [])
                .filter(c => c.sickLetter && typeof c.sickLetter === 'object' && c.sickLetter.status)
                .map(c => ({
                    _id:        c._id,
                    source:     'consultation',
                    sourceLabel:'Konsultasi',
                    patient:    c.userId,
                    date:       c.scheduledAt || c.createdAt,
                    status:     c.status,
                    sickLetter: c.sickLetter,
                }));

            const appts = (apptRes.data.appointments || [])
                .filter(a => a.sickLetter && typeof a.sickLetter === 'object' && a.sickLetter.status)
                .map(a => ({
                    _id:        a._id,
                    source:     'appointment',
                    sourceLabel:'Janji Temu',
                    patient:    a.userId,
                    date:       a.appointmentDate || a.scheduledAt,
                    status:     a.status,
                    sickLetter: a.sickLetter,
                }));

            const merged = [...cons, ...appts].sort((a, b) => new Date(b.date) - new Date(a.date));
            setItems(merged);
            setCache('doctor:suratsakit:items', merged);
        } catch { toast.error('Gagal memuat data'); }
        finally { if (!background) setLoading(false); }
    }, []);

    useEffect(() => { 
        const isBg = hasCache('doctor:suratsakit:items');
        fetchData(isBg); 
    }, [fetchData]);

    const downloadPDF = async (item) => {
        const endpoint = item.source === 'consultation'
            ? `/api/consultations/${item._id}/sick-letter/pdf`
            : `/api/appointments/${item._id}/sick-letter/pdf`;
        try {
            const r = await api.get(endpoint, { responseType: 'blob' });
            const url  = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href  = url;
            link.setAttribute('download', `surat-sakit-${item.sickLetter?.letterNumber || item._id}.pdf`);
            document.body.appendChild(link); link.click(); link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('PDF surat sakit berhasil diunduh');
        } catch { toast.error('Gagal mengunduh PDF'); }
    };

    const calcRestDays = (start, end) => {
        if (!start || !end) return 0;
        return Math.max(0, Math.ceil((new Date(end) - new Date(start)) / 86400000) + 1);
    };

    const displayed = tab === 'all' ? items : items.filter(i => i.source === tab);

    const tabStyle = (active) => ({
        padding: '7px 20px',
        borderRadius: 20,
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        background: active ? colors.primary : '#f1f5f9',
        color: active ? '#fff' : colors.muted,
        transition: 'all 0.15s',
    });

    return (
        <div>
            <SectionHeader
                title="📄 Riwayat Surat Sakit"
                subtitle="Surat keterangan sakit dari konsultasi maupun janji temu"
                action={<Btn size="sm" variant="ghost" onClick={fetchData}>↻ Refresh</Btn>}
            />

            {/* Tab filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button style={tabStyle(tab === 'all')}         onClick={() => setTab('all')}>Semua ({items.length})</button>
                <button style={tabStyle(tab === 'consultation')} onClick={() => setTab('consultation')}>
                    💬 Konsultasi ({items.filter(i => i.source === 'consultation').length})
                </button>
                <button style={tabStyle(tab === 'appointment')}  onClick={() => setTab('appointment')}>
                    📅 Janji Temu ({items.filter(i => i.source === 'appointment').length})
                </button>
            </div>

            <Card style={{ padding: 24 }}>
                {loading && <Spinner />}
                {!loading && displayed.length === 0 && (
                    <Empty icon="📄" text="Belum ada surat sakit" />
                )}
                {!loading && displayed.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                        {displayed.map(item => {
                            const sl       = item.sickLetter;
                            const isIssued = sl?.status === 'issued';
                            const restDays = calcRestDays(sl?.startDate, sl?.endDate);
                            return (
                                <Card
                                    key={`${item.source}-${item._id}`}
                                    style={{
                                        padding: '16px 18px',
                                        borderLeft: `4px solid ${isIssued ? '#22c55e' : '#eab308'}`,
                                        background: '#fafbfc',
                                        cursor: 'pointer',
                                        transition: 'box-shadow 0.15s',
                                    }}
                                    onClick={() => setDetail(item)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 2 }}>
                                                {item.patient?.name || 'Pasien'}
                                            </div>
                                            <div style={{ fontSize: 11, color: colors.muted, display: 'flex', gap: 6, alignItems: 'center' }}>
                                                <span style={{ background: item.source === 'consultation' ? '#eff6ff' : '#f0fdf4', color: item.source === 'consultation' ? '#2563eb' : '#16a34a', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>
                                                    {item.sourceLabel}
                                                </span>
                                                {sl?.letterNumber && <span>No: {sl.letterNumber}</span>}
                                            </div>
                                        </div>
                                        <span style={{
                                            background: isIssued ? '#dcfce7' : '#fef9c3',
                                            color: isIssued ? '#166534' : '#854d0e',
                                            border: `1px solid ${isIssued ? '#86efac' : '#fde68a'}`,
                                            borderRadius: 16, padding: '3px 10px',
                                            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                                        }}>
                                            {isIssued ? '✓ Terbit' : '📝 Draft'}
                                        </span>
                                    </div>

                                    <div style={{ fontSize: 12, color: colors.muted, marginBottom: 10, lineHeight: 1.5 }}>
                                        <div style={{ marginBottom: 4 }}>
                                            <strong style={{ color: colors.text }}>Diagnosis:</strong> {sl?.diagnosis || '—'}
                                        </div>
                                        {sl?.startDate && sl?.endDate && (
                                            <div style={{ marginBottom: 4 }}>
                                                <strong style={{ color: colors.text }}>Periode:</strong> {fmtDate(sl.startDate)} – {fmtDate(sl.endDate)}
                                                {restDays > 0 && <span style={{ marginLeft: 6, fontWeight: 600, color: colors.primary }}>({restDays} hari)</span>}
                                            </div>
                                        )}
                                        {isIssued && sl?.issuedAt && (
                                            <div style={{ color: '#16a34a' }}>Terbit: {fmtDT(sl.issuedAt)}</div>
                                        )}
                                    </div>

                                    {isIssued && (
                                        <Btn size="sm" variant="outline"
                                            onClick={e => { e.stopPropagation(); downloadPDF(item); }}
                                            style={{ width: '100%' }}>
                                            ⬇ Download PDF
                                        </Btn>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}
            </Card>

            {/* Detail modal */}
            <Modal open={!!detail} onClose={() => setDetail(null)} title="📄 Detail Surat Sakit" width={540}>
                {detail && (() => {
                    const sl       = detail.sickLetter;
                    const isIssued = sl?.status === 'issued';
                    const restDays = calcRestDays(sl?.startDate, sl?.endDate);
                    return (
                        <div>
                            <div style={{ background: '#f8fafc', borderRadius: 11, padding: 14, marginBottom: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 4 }}>
                                    {detail.patient?.name || 'Pasien'}
                                </div>
                                <div style={{ fontSize: 12, color: colors.muted, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <span style={{ background: detail.source === 'consultation' ? '#eff6ff' : '#f0fdf4', color: detail.source === 'consultation' ? '#2563eb' : '#16a34a', padding: '1px 8px', borderRadius: 10, fontWeight: 600 }}>
                                        {detail.sourceLabel}
                                    </span>
                                    {sl?.letterNumber && <span>No: <strong>{sl.letterNumber}</strong></span>}
                                    <span>Status: <strong>{isIssued ? '✓ Terbit' : '📝 Draft'}</strong></span>
                                </div>
                            </div>

                            <div style={{ background: '#f8fafc', borderRadius: 9, padding: '12px 14px', marginBottom: 14 }}>
                                {[['Diagnosis', sl?.diagnosis], ['Usia', sl?.patientAge ? sl.patientAge + ' tahun' : null], ['Jenis Kelamin', sl?.patientGender], ['Berat Badan', sl?.patientWeight ? sl.patientWeight + ' kg' : null]]
                                    .filter(([, v]) => v)
                                    .map(([label, value]) => (
                                        <div key={label} style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 13 }}>
                                            <span style={{ color: colors.muted, fontWeight: 600, minWidth: 110 }}>{label}</span>
                                            <span style={{ color: colors.text }}>{value}</span>
                                        </div>
                                    ))}
                            </div>

                            {sl?.startDate && sl?.endDate && (
                                <div style={{ background: '#f0fdf4', borderRadius: 9, padding: '12px 14px', marginBottom: 14, borderLeft: '3px solid #22c55e' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#166534', marginBottom: 6 }}>📅 Periode Istirahat</div>
                                    <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
                                        <div>Mulai: <strong>{fmtDate(sl.startDate)}</strong></div>
                                        <div>Sampai: <strong>{fmtDate(sl.endDate)}</strong></div>
                                        <div style={{ color: '#166534', fontWeight: 600 }}>Total: {restDays} hari</div>
                                    </div>
                                </div>
                            )}

                            {sl?.notes && (
                                <div style={{ background: '#eff6ff', borderRadius: 9, padding: '12px 14px', marginBottom: 14, borderLeft: '3px solid #3b82f6' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e40af', marginBottom: 6 }}>📝 Catatan</div>
                                    <div style={{ fontSize: 13, color: colors.text, whiteSpace: 'pre-wrap' }}>{sl.notes}</div>
                                </div>
                            )}

                            {isIssued && sl?.issuedAt && (
                                <div style={{ fontSize: 12, color: colors.muted, marginBottom: 14 }}>
                                    Diterbitkan: {fmtDT(sl.issuedAt)}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <Btn variant="ghost" onClick={() => setDetail(null)}>Tutup</Btn>
                                {isIssued && (
                                    <Btn variant="outline" onClick={() => downloadPDF(detail)}>⬇ Download PDF</Btn>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
};

export default SectionSuratSakit;