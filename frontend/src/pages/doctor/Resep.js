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
// SECTION: RESEP OBAT (READ-ONLY)
// ═══════════════════════════════════════════════════════════════════════════════
const SectionResep = () => {
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [detail, setDetail]     = useState(null);
    // ── Filter riwayat resep ──
    const [rxSearch, setRxSearch] = useState('');
    const [rxDate,   setRxDate]   = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/api/consultations/doctor/all');
            const all = r.data.consultations || r.data || [];
            setConsultations(all.filter(c => ['in_progress','ongoing','completed','confirmed','paid','scheduled','no_show'].includes(c.status)));
        } catch { toast.error('Gagal memuat data konsultasi'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

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

    // ── Filter: hanya konsultasi yang punya resep ──
    const withRx = consultations.filter(c => {
        // Check prescriptionData dengan medicines array (SAFE)
        const hasPrescriptionData = c.prescriptionData && 
                                   Array.isArray(c.prescriptionData.medicines) && 
                                   c.prescriptionData.medicines.length > 0;
        
        // Check prescription string
        const hasPrescription = c.prescription && 
                               typeof c.prescription === 'string' && 
                               c.prescription.trim().length > 0;
        
        return hasPrescriptionData || hasPrescription;
    });

    const filteredRx = withRx.filter(c => {
        const nameMatch = !rxSearch || (c.userId?.name || '').toLowerCase().includes(rxSearch.toLowerCase());
        const dateMatch = !rxDate   || (c.scheduledAt && c.scheduledAt.slice(0, 10) === rxDate);
        return nameMatch && dateMatch;
    });

    return (
        <div>
            <SectionHeader title="📋 Riwayat Resep Obat" subtitle="Lihat dan download resep obat yang sudah dibuat"
                action={<Btn size="sm" variant="ghost" onClick={fetchData}>↻ Refresh</Btn>} />

            <Card style={{ padding: 24 }}>
                {/* Filter */}
                <div style={{ marginBottom: 18 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 14 }}>🔍 Filter</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <input
                            value={rxSearch}
                            onChange={e => setRxSearch(e.target.value)}
                            placeholder="Cari nama pasien..."
                            style={{ flex: 1, minWidth: 150, padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                        />
                        <input
                            type="date"
                            value={rxDate}
                            onChange={e => setRxDate(e.target.value)}
                            style={{ padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                        />
                        {(rxSearch || rxDate) && (
                            <Btn size="sm" variant="ghost" onClick={() => { setRxSearch(''); setRxDate(''); }}>✕ Reset</Btn>
                        )}
                    </div>
                </div>

                {/* Daftar Resep */}
                <div>
                    {loading && <Spinner />}
                    {!loading && withRx.length === 0 && (
                        <Empty icon="💊" text="Belum ada resep obat" />
                    )}
                    {!loading && filteredRx.length === 0 && withRx.length > 0 && (
                        <Empty icon="🔍" text="Tidak ada resep yang cocok dengan filter" />
                    )}
                    {filteredRx.map(c => (
                        <Card key={c._id} style={{ padding: '14px 18px', marginBottom: 12, background: '#fafbfc', border: `1px solid ${colors.border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{c.userId?.name || 'Pasien (unknown)'}</div>
                                    <div style={{ fontSize: 12, color: colors.muted }}>{fmtDT(c.scheduledAt)}</div>
                                </div>
                                <span style={{ background: '#f0fdf4', color: '#166534', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                                    💊 {c.prescriptionData?.medicines?.length || 0} obat
                                </span>
                            </div>

                            {/* Preview obat (max 2) */}
                            {c.prescriptionData?.medicines?.slice(0, 2).map((m, i) => (
                                <div key={i} style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>
                                    • {m.name} – {m.dose} · {m.frequency}
                                </div>
                            ))}
                            {c.prescriptionData?.medicines?.length > 2 && (
                                <div style={{ fontSize: 12, color: colors.muted, marginBottom: 4, fontStyle: 'italic' }}>
                                    + {c.prescriptionData.medicines.length - 2} obat lainnya
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                <Btn size="sm" variant="outline" onClick={() => setDetail(c)}>👁 Detail</Btn>
                                <Btn size="sm" variant="ghost" onClick={() => downloadPDF(c._id, c.prescriptionData?.prescriptionNumber)}>⬇ PDF</Btn>
                            </div>
                        </Card>
                    ))}
                </div>
            </Card>

            {/* Detail modal - READ ONLY */}
            <Modal open={!!detail} onClose={() => setDetail(null)} title="📋 Detail Resep Obat" width={560}>
                {detail && (
                    <div>
                        <div style={{ background: '#f8fafc', borderRadius: 11, padding: 14, marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 4 }}>{detail.userId?.name || 'Pasien'}</div>
                            {detail.prescriptionData?.prescriptionNumber && (
                                <div style={{ fontSize: 12, color: colors.muted }}>No. Resep: <strong>{detail.prescriptionData.prescriptionNumber}</strong></div>
                            )}
                            <div style={{ fontSize: 12, color: colors.muted }}>Tanggal: {fmtDT(detail.scheduledAt)}</div>
                        </div>

                        {/* Daftar obat */}
                        {detail.prescriptionData?.medicines && detail.prescriptionData.medicines.length > 0 ? (
                            detail.prescriptionData.medicines.map((m, i) => (
                                <div key={i} style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 10, background: '#fafbfc' }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 8 }}>💊 {m.name}</div>
                                    <div style={{ fontSize: 12, color: colors.text, lineHeight: 1.6 }}>
                                        {[
                                            ['Dosis', m.dose],
                                            ['Bentuk', m.form],
                                            ['Aturan Pakai', m.frequency],
                                            ['Cara Pakai', m.instructions],
                                            ['Jumlah', m.quantity]
                                        ].map(([label, value]) => value && (
                                            <div key={label} style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                                                <span style={{ color: colors.muted, fontWeight: 600, minWidth: 100 }}>{label}</span>
                                                <span>{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', color: colors.muted, fontSize: 13, padding: 20 }}>
                                Tidak ada data obat
                            </div>
                        )}

                        {/* Catatan dokter */}
                        {detail.prescriptionData?.doctorNotes && (
                            <div style={{ background: '#f0fdf4', borderRadius: 9, padding: '12px 14px', fontSize: 13, color: colors.text, marginTop: 12, borderLeft: `3px solid #22c55e` }}>
                                <strong>📝 Catatan Dokter:</strong>
                                <div style={{ marginTop: 6, color: colors.muted }}>{detail.prescriptionData.doctorNotes}</div>
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


export default SectionResep;