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
// SECTION: SURAT SAKIT
// ═══════════════════════════════════════════════════════════════════════════════
const SectionSuratSakit = () => {
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selCons, setSelCons]   = useState(null);
    const [form, setForm] = useState({ diagnosis: '', notes: '', restDays: 3, patientAge: '', patientGender: '', patientWeight: '' });
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
        setForm({ diagnosis: '', notes: '', restDays: 3, patientAge: '', patientGender: '', patientWeight: '' });
        setModalOpen(true);
    };

    const handleCreate = async () => {
        if (!form.diagnosis.trim()) { toast.error('Diagnosis wajib diisi'); return; }
        if (!form.restDays || Number(form.restDays) < 1) { toast.error('Lama istirahat minimal 1 hari'); return; }
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
    const withoutLetter = consultations.filter(c => !c.sickLetter && ['in_progress','ongoing','completed','confirmed','paid','scheduled'].includes(c.status));


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
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>Lama Istirahat (hari) <span style={{ color: colors.danger }}>*</span></label>
                        <input
                            type="number" min={1} max={30}
                            value={form.restDays}
                            onChange={e => setForm(f => ({ ...f, restDays: e.target.value }))}
                            placeholder="mis. 3"
                            style={{ width: '100%', padding: '8px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                        />
                        <div style={{ fontSize: 11, color: colors.muted, marginTop: 3 }}>
                            Mulai hari ini: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} s/d {form.restDays && Number(form.restDays) >= 1 ? new Date(Date.now() + (Number(form.restDays)-1)*86400000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                        </div>
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


export default SectionSuratSakit;