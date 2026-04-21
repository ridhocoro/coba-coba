import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import {
    API_URL, colors, fmtDate, fmtDT, toMin, toHHMM,
    CONS_SLOTS, APPT_SLOTS, DAYS_INFO, makeEmptySchedule, DEF_CONS, DEF_APPT,
    CONS_STATUS, APPT_STATUS,
    Card, Btn, Spinner, Empty, SBadge, Toggle, Modal, SectionHeader,
    ScheduleGrid, SchedulePreview, TH, TD, ProfileField, InputField,
} from './shared';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: SURAT SAKIT (READ-ONLY)
// ═══════════════════════════════════════════════════════════════════════════════
const SectionSuratSakit = () => {
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [detail, setDetail]     = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/api/consultations/doctor/all');
            const all = r.data.consultations || r.data || [];
            setConsultations(all.filter(c => ['in_progress','ongoing','completed','confirmed','paid','scheduled','no_show'].includes(c.status)));
        } catch { toast.error('Gagal memuat data'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const downloadPDF = async (consultationId, letterNum) => {
        try {
            const r = await api.get(`/api/consultations/${consultationId}/sick-letter/pdf`, { responseType: 'blob' });
            const url  = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href  = url;
            link.setAttribute('download', `surat-sakit-${letterNum || consultationId}.pdf`);
            document.body.appendChild(link); link.click(); link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('PDF surat sakit berhasil diunduh');
        } catch (err) {
            console.error('Download error:', err);
            toast.error('Gagal mengunduh PDF surat sakit');
        }
    };

    // ── Filter: hanya konsultasi yang punya surat sakit DENGAN populate ──
    const withLetter = consultations.filter(c => {
        // Check sickLetter dengan proper populate
        const hasSickLetter = c.sickLetter && 
                             typeof c.sickLetter === 'object' &&  // Sudah di-populate
                             c.sickLetter.status && 
                             ['draft', 'issued'].includes(c.sickLetter.status);
        
        // Fallback: jika sickLetter masih ID string (old data)
        const hasLetterId = typeof c.sickLetter === 'string' && c.sickLetter.trim().length > 0;
        
        return hasSickLetter || hasLetterId;
    });

    // Hitung jumlah hari istirahat dengan aman
    const calcRestDays = (startDate, endDate) => {
        if (!startDate || !endDate) return 0;
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const days = Math.ceil((end - start) / 86400000) + 1;
            return Math.max(0, days);
        } catch {
            return 0;
        }
    };

    return (
        <div>
            <SectionHeader title="📄 Riwayat Surat Sakit" subtitle="Lihat dan download surat keterangan sakit pasien"
                action={<Btn size="sm" variant="ghost" onClick={fetchData}>↻ Refresh</Btn>} />

            <Card style={{ padding: 24 }}>
                {loading && <Spinner />}
                {!loading && withLetter.length === 0 && (
                    <Empty icon="📄" text="Belum ada surat sakit yang diterbitkan" />
                )}
                {!loading && withLetter.length > 0 && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                            {withLetter.map(c => {
                                const sl = c.sickLetter;
                                const isDraft  = sl?.status === 'draft';
                                const isIssued = sl?.status === 'issued';
                                const restDays = calcRestDays(sl?.startDate, sl?.endDate);

                                return (
                                    <Card
                                        key={c._id}
                                        style={{
                                            padding: '16px 18px',
                                            borderLeft: `4px solid ${isIssued ? '#22c55e' : '#eab308'}`,
                                            background: '#fafbfc',
                                            transition: 'all 0.2s',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => setDetail(c)}
                                    >
                                        {/* Header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 2 }}>{c.userId?.name || 'Pasien'}</div>
                                                <div style={{ fontSize: 11, color: colors.muted }}>
                                                    {sl?.letterNumber ? `No: ${sl.letterNumber}` : '(Draft)'}
                                                </div>
                                            </div>
                                            <span style={{
                                                background: isIssued ? '#dcfce7' : '#fef9c3',
                                                color: isIssued ? '#166534' : '#854d0e',
                                                border: `1px solid ${isIssued ? '#86efac' : '#fde68a'}`,
                                                borderRadius: 16,
                                                padding: '3px 10px',
                                                fontSize: 11,
                                                fontWeight: 700,
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {isIssued ? '✓ Terbit' : '📝 Draft'}
                                            </span>
                                        </div>

                                        {/* Info */}
                                        <div style={{ fontSize: 12, color: colors.muted, marginBottom: 10, lineHeight: 1.5 }}>
                                            <div style={{ marginBottom: 4 }}>
                                                <strong style={{ color: colors.text }}>Diagnosis:</strong> {sl?.diagnosis || '—'}
                                            </div>
                                            {sl?.startDate && sl?.endDate && (
                                                <div style={{ marginBottom: 4 }}>
                                                    <strong style={{ color: colors.text }}>Periode:</strong> {fmtDate(sl.startDate)} – {fmtDate(sl.endDate)}
                                                    {restDays > 0 && (
                                                        <span style={{ marginLeft: 6, fontWeight: 600, color: colors.primary }}>
                                                            ({restDays} hari)
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {isIssued && sl?.issuedAt && (
                                                <div style={{ color: colors.success }}>
                                                    Diterbitkan: {fmtDT(sl.issuedAt)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Action */}
                                        {isIssued && (
                                            <Btn
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    downloadPDF(c._id, sl.letterNumber);
                                                }}
                                                style={{ width: '100%' }}
                                            >
                                                ⬇ Download PDF
                                            </Btn>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}
            </Card>

            {/* Detail modal - READ ONLY */}
            <Modal open={!!detail} onClose={() => setDetail(null)} title="📄 Detail Surat Sakit" width={560}>
                {detail && (
                    <div>
                        <div style={{ background: '#f8fafc', borderRadius: 11, padding: 14, marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 4 }}>{detail.userId?.name || 'Pasien'}</div>
                            {detail.sickLetter?.letterNumber && (
                                <div style={{ fontSize: 12, color: colors.muted }}>No. Surat: <strong>{detail.sickLetter.letterNumber}</strong></div>
                            )}
                            <div style={{ fontSize: 12, color: colors.muted }}>Status: <strong>{detail.sickLetter?.status === 'issued' ? '✓ Terbit' : '📝 Draft'}</strong></div>
                        </div>

                        {/* Info Pasien */}
                        <div style={{ background: '#f8fafc', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
                            <div style={{ fontSize: 12, color: colors.text, lineHeight: 1.6 }}>
                                {[
                                    ['Diagnosis', detail.sickLetter?.diagnosis],
                                    ['Usia', detail.sickLetter?.patientAge],
                                    ['Jenis Kelamin', detail.sickLetter?.patientGender],
                                    ['Berat Badan', detail.sickLetter?.patientWeight],
                                ].map(([label, value]) => value && (
                                    <div key={label} style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                                        <span style={{ color: colors.muted, fontWeight: 600, minWidth: 100 }}>{label}</span>
                                        <span style={{ color: colors.text }}>{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Periode Istirahat */}
                        {detail.sickLetter?.startDate && detail.sickLetter?.endDate && (
                            <div style={{ background: '#f0fdf4', borderRadius: 9, padding: '12px 14px', marginBottom: 16, borderLeft: `3px solid #22c55e` }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#166534', marginBottom: 6 }}>📅 Periode Istirahat</div>
                                <div style={{ fontSize: 12, color: colors.text, lineHeight: 1.6 }}>
                                    <div>Mulai: <strong>{fmtDate(detail.sickLetter.startDate)}</strong></div>
                                    <div style={{ marginTop: 4 }}>Sampai: <strong>{fmtDate(detail.sickLetter.endDate)}</strong></div>
                                    <div style={{ marginTop: 4, color: '#166534', fontWeight: 600 }}>
                                        Total: {calcRestDays(detail.sickLetter.startDate, detail.sickLetter.endDate)} hari
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Catatan */}
                        {detail.sickLetter?.notes && (
                            <div style={{ background: '#eff6ff', borderRadius: 9, padding: '12px 14px', marginBottom: 16, borderLeft: `3px solid #3b82f6` }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#1e40af', marginBottom: 6 }}>📝 Catatan Tambahan</div>
                                <div style={{ fontSize: 12, color: colors.text, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{detail.sickLetter.notes}</div>
                            </div>
                        )}

                        {/* Issued info */}
                        {detail.sickLetter?.status === 'issued' && detail.sickLetter?.issuedAt && (
                            <div style={{ background: '#f0f9ff', borderRadius: 9, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: colors.muted }}>
                                Diterbitkan: {fmtDT(detail.sickLetter.issuedAt)}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                            <Btn variant="ghost" onClick={() => setDetail(null)}>Tutup</Btn>
                            {detail.sickLetter?.status === 'issued' && (
                                <Btn variant="outline" onClick={() => downloadPDF(detail._id, detail.sickLetter?.letterNumber)}>
                                    ⬇ Download PDF
                                </Btn>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};


export default SectionSuratSakit;