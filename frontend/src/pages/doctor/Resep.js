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
    // ── Filter riwayat resep ──
    const [rxSearch, setRxSearch] = useState('');
    const [rxDate,   setRxDate]   = useState('');

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

    const filteredRx = withRx.filter(c => {
        const nameMatch = !rxSearch || (c.userId?.name || '').toLowerCase().includes(rxSearch.toLowerCase());
        const dateMatch = !rxDate   || (c.scheduledAt && c.scheduledAt.slice(0, 10) === rxDate);
        return nameMatch && dateMatch;
    });

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
                    <div style={{ fontWeight: 700, fontSize: 15, color: colors.text, marginBottom: 12 }}>📋 Riwayat Resep</div>
                    {/* Filter */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                        <input
                            value={rxSearch}
                            onChange={e => setRxSearch(e.target.value)}
                            placeholder="🔍 Cari nama pasien..."
                            style={{ flex: 1, minWidth: 150, padding: '7px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                        />
                        <input
                            type="date"
                            value={rxDate}
                            onChange={e => setRxDate(e.target.value)}
                            style={{ padding: '7px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                        />
                        {(rxSearch || rxDate) && (
                            <Btn size="sm" variant="ghost" onClick={() => { setRxSearch(''); setRxDate(''); }}>Reset</Btn>
                        )}
                    </div>
                    {loading ? <Spinner /> : filteredRx.length === 0 ? <Empty icon="💊" text={withRx.length === 0 ? 'Belum ada resep' : 'Tidak ada resep yang cocok'} /> : (
                        filteredRx.map(c => (
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


export default SectionResep;