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
// SECTION: SURAT RUJUKAN (Konsultasi + Janji Temu)
// ═══════════════════════════════════════════════════════════════════════════════
const SectionSuratRujukan = () => {
    const [tab, setTab]         = useState('all');
    const [items, setItems]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [detail, setDetail]   = useState(null);

    // ── Edit modal state ──────────────────────────────────────────────────────
    const [editTarget,    setEditTarget]    = useState(null);
    const [rlDiagnosis,   setRlDiagnosis]   = useState('');
    const [rlReason,      setRlReason]      = useState('');
    const [rlTo,          setRlTo]          = useState('');
    const [rlSpecialty,   setRlSpecialty]   = useState('');
    const [rlNotes,       setRlNotes]       = useState('');
    const [rlAge,         setRlAge]         = useState('');
    const [rlGender,      setRlGender]      = useState('');
    const [rlWeight,      setRlWeight]      = useState('');
    const [rlSaving,      setRlSaving]      = useState(false);
    const [rlIssuing,     setRlIssuing]     = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [consRes, apptRes] = await Promise.all([
                api.get('/api/consultations/doctor/all').catch(() => ({ data: { consultations: [] } })),
                api.get('/api/appointments/doctor/list').catch(() => ({ data: { appointments: [] } })),
            ]);

            const cons = (consRes.data.consultations || consRes.data || [])
                .filter(c => c.referralLetter && typeof c.referralLetter === 'object' && c.referralLetter.status)
                .map(c => ({
                    _id:           c._id,
                    source:        'consultation',
                    sourceLabel:   'Konsultasi',
                    patient:       c.userId,
                    date:          c.scheduledAt || c.createdAt,
                    status:        c.status,
                    referralLetter: c.referralLetter,
                }));

            const appts = (apptRes.data.appointments || [])
                .filter(a => a.referralLetter && typeof a.referralLetter === 'object' && a.referralLetter.status)
                .map(a => ({
                    _id:           a._id,
                    source:        'appointment',
                    sourceLabel:   'Janji Temu',
                    patient:       a.userId,
                    date:          a.appointmentDate || a.scheduledAt,
                    status:        a.status,
                    referralLetter: a.referralLetter,
                }));

            const merged = [...cons, ...appts].sort((a, b) => new Date(b.date) - new Date(a.date));
            setItems(merged);
        } catch { toast.error('Gagal memuat data'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Download PDF ──────────────────────────────────────────────────────────
    const downloadPDF = async (item) => {
        const endpoint = item.source === 'consultation'
            ? `/api/consultations/${item._id}/referral-letter/pdf`
            : `/api/appointments/${item._id}/referral-letter/pdf`;
        try {
            const r = await api.get(endpoint, { responseType: 'blob' });
            const url  = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href  = url;
            link.setAttribute('download', `surat-rujukan-${item.referralLetter?.letterNumber || item._id}.pdf`);
            document.body.appendChild(link); link.click(); link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('PDF surat rujukan berhasil diunduh');
        } catch { toast.error('Gagal mengunduh PDF'); }
    };

    // ── Issue letter ──────────────────────────────────────────────────────────
    const doIssue = async (item) => {
        const endpoint = item.source === 'consultation'
            ? `/api/consultations/${item._id}/referral-letter/issue`
            : `/api/appointments/doctor/${item._id}/referral-letter/issue`;
        try {
            await api.put(endpoint);
            toast.success('Surat rujukan diterbitkan ✅');
            setDetail(null);
            fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal menerbitkan'); }
    };

    // ── Open edit modal ───────────────────────────────────────────────────────
    const openEdit = (item) => {
        const rl = item.referralLetter;
        setEditTarget(item);
        setRlDiagnosis(rl?.diagnosis || '');
        setRlReason(rl?.referralReason || '');
        setRlTo(rl?.referralTo || '');
        setRlSpecialty(rl?.referralSpecialty || '');
        setRlNotes(rl?.notes || '');
        setRlAge(rl?.patientAge || '');
        setRlGender(rl?.patientGender || '');
        setRlWeight(rl?.patientWeight || '');
        setDetail(null);
    };

    const doSaveEdit = async () => {
        if (!rlDiagnosis.trim() || !rlReason.trim() || !rlTo.trim()) {
            toast.error('Diagnosis, alasan, dan tujuan rujukan wajib diisi'); return;
        }
        setRlSaving(true);
        try {
            const endpoint = editTarget.source === 'consultation'
                ? `/api/consultations/${editTarget._id}/referral-letter`
                : `/api/appointments/doctor/${editTarget._id}/referral-letter`;
            await api.post(endpoint, {
                diagnosis: rlDiagnosis, referralReason: rlReason, referralTo: rlTo,
                referralSpecialty: rlSpecialty, notes: rlNotes,
                patientAge: rlAge, patientGender: rlGender, patientWeight: rlWeight,
            });
            toast.success('Surat rujukan disimpan ✅');
            setEditTarget(null);
            fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan'); }
        finally { setRlSaving(false); }
    };

    const doIssueEdit = async () => {
        setRlIssuing(true);
        try {
            const endpoint = editTarget.source === 'consultation'
                ? `/api/consultations/${editTarget._id}/referral-letter/issue`
                : `/api/appointments/doctor/${editTarget._id}/referral-letter/issue`;
            await api.put(endpoint);
            toast.success('Surat rujukan diterbitkan ✅');
            setEditTarget(null);
            fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal'); }
        finally { setRlIssuing(false); }
    };

    const displayed = tab === 'all' ? items : items.filter(i => i.source === tab);

    const tabStyle = (active) => ({
        padding: '7px 20px', borderRadius: 20, border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: 600,
        background: active ? colors.primary : '#f1f5f9',
        color: active ? '#fff' : colors.muted,
        transition: 'all 0.15s',
    });

    const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
    const textareaStyle = { ...inputStyle, resize: 'vertical' };
    const labelStyle = { display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text };

    return (
        <div>
            <SectionHeader
                title="🔀 Riwayat Surat Rujukan"
                subtitle="Surat rujukan dari konsultasi maupun janji temu"
                action={<Btn size="sm" variant="ghost" onClick={fetchData}>↻ Refresh</Btn>}
            />

            {/* Tab filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button style={tabStyle(tab === 'all')}          onClick={() => setTab('all')}>Semua ({items.length})</button>
                <button style={tabStyle(tab === 'consultation')}  onClick={() => setTab('consultation')}>
                    💬 Konsultasi ({items.filter(i => i.source === 'consultation').length})
                </button>
                <button style={tabStyle(tab === 'appointment')}   onClick={() => setTab('appointment')}>
                    📅 Janji Temu ({items.filter(i => i.source === 'appointment').length})
                </button>
            </div>

            <Card style={{ padding: 24 }}>
                {loading && <Spinner />}
                {!loading && displayed.length === 0 && <Empty icon="🔀" text="Belum ada surat rujukan" />}
                {!loading && displayed.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                        {displayed.map(item => {
                            const rl       = item.referralLetter;
                            const isIssued = rl?.status === 'issued';
                            return (
                                <Card
                                    key={`${item.source}-${item._id}`}
                                    style={{
                                        padding: '16px 18px',
                                        borderLeft: `4px solid ${isIssued ? '#3b82f6' : '#a78bfa'}`,
                                        background: '#fafbfc', cursor: 'pointer',
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
                                                {rl?.letterNumber && <span>No: {rl.letterNumber}</span>}
                                            </div>
                                        </div>
                                        <span style={{
                                            background: isIssued ? '#dbeafe' : '#ede9fe',
                                            color: isIssued ? '#1d4ed8' : '#6d28d9',
                                            border: `1px solid ${isIssued ? '#93c5fd' : '#c4b5fd'}`,
                                            borderRadius: 16, padding: '3px 10px',
                                            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                                        }}>
                                            {isIssued ? '✓ Terbit' : '📝 Draft'}
                                        </span>
                                    </div>

                                    <div style={{ fontSize: 12, color: colors.muted, marginBottom: 10, lineHeight: 1.5 }}>
                                        <div style={{ marginBottom: 4 }}>
                                            <strong style={{ color: colors.text }}>Diagnosis:</strong> {rl?.diagnosis || '—'}
                                        </div>
                                        <div style={{ marginBottom: 4 }}>
                                            <strong style={{ color: colors.text }}>Rujuk ke:</strong> {rl?.referralTo || '—'}
                                            {rl?.referralSpecialty && <span style={{ color: colors.muted }}> ({rl.referralSpecialty})</span>}
                                        </div>
                                        {isIssued && rl?.issuedAt && (
                                            <div style={{ color: '#2563eb' }}>Terbit: {fmtDT(rl.issuedAt)}</div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {!isIssued && (
                                            <Btn size="sm" variant="primary"
                                                onClick={e => { e.stopPropagation(); openEdit(item); }}
                                                style={{ flex: 1 }}>
                                                ✏ Edit Draft
                                            </Btn>
                                        )}
                                        {isIssued && (
                                            <Btn size="sm" variant="outline"
                                                onClick={e => { e.stopPropagation(); downloadPDF(item); }}
                                                style={{ flex: 1 }}>
                                                ⬇ Download PDF
                                            </Btn>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </Card>

            {/* ── Detail Modal ── */}
            <Modal open={!!detail} onClose={() => setDetail(null)} title="🔀 Detail Surat Rujukan" width={540}>
                {detail && (() => {
                    const rl       = detail.referralLetter;
                    const isIssued = rl?.status === 'issued';
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
                                    {rl?.letterNumber && <span>No: <strong>{rl.letterNumber}</strong></span>}
                                    <span>Status: <strong style={{ color: isIssued ? '#1d4ed8' : '#7c3aed' }}>{isIssued ? '✓ Terbit' : '📝 Draft'}</strong></span>
                                </div>
                            </div>

                            <div style={{ background: '#f8fafc', borderRadius: 9, padding: '12px 14px', marginBottom: 14 }}>
                                {[
                                    ['Diagnosis',      rl?.diagnosis],
                                    ['Rujukan Ke',     rl?.referralTo],
                                    ['Spesialisasi',   rl?.referralSpecialty],
                                    ['Usia',           rl?.patientAge ? rl.patientAge + ' tahun' : null],
                                    ['Jenis Kelamin',  rl?.patientGender],
                                    ['Berat Badan',    rl?.patientWeight ? rl.patientWeight + ' kg' : null],
                                ].filter(([, v]) => v).map(([label, value]) => (
                                    <div key={label} style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 13 }}>
                                        <span style={{ color: colors.muted, fontWeight: 600, minWidth: 110 }}>{label}</span>
                                        <span style={{ color: colors.text }}>{value}</span>
                                    </div>
                                ))}
                            </div>

                            {rl?.referralReason && (
                                <div style={{ background: '#f0f9ff', borderRadius: 9, padding: '12px 14px', marginBottom: 14, borderLeft: '3px solid #3b82f6' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e40af', marginBottom: 6 }}>📋 Alasan Rujukan</div>
                                    <div style={{ fontSize: 13, color: colors.text, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{rl.referralReason}</div>
                                </div>
                            )}

                            {rl?.notes && (
                                <div style={{ background: '#fefce8', borderRadius: 9, padding: '12px 14px', marginBottom: 14, borderLeft: '3px solid #eab308' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 6 }}>📝 Catatan Tambahan</div>
                                    <div style={{ fontSize: 13, color: colors.text, whiteSpace: 'pre-wrap' }}>{rl.notes}</div>
                                </div>
                            )}

                            {isIssued && rl?.issuedAt && (
                                <div style={{ fontSize: 12, color: colors.muted, marginBottom: 14 }}>
                                    Diterbitkan: {fmtDT(rl.issuedAt)}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <Btn variant="ghost" onClick={() => setDetail(null)}>Tutup</Btn>
                                {!isIssued && (
                                    <>
                                        <Btn variant="primary" onClick={() => openEdit(detail)}>✏ Edit Draft</Btn>
                                        <Btn variant="success" onClick={() => doIssue(detail)}>✅ Terbitkan</Btn>
                                    </>
                                )}
                                {isIssued && (
                                    <Btn variant="outline" onClick={() => downloadPDF(detail)}>⬇ Download PDF</Btn>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            {/* ── Edit Draft Modal ── */}
            <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="✏ Edit Surat Rujukan" width={560}>
                {editTarget && (() => {
                    const rl = editTarget.referralLetter;
                    const isIssued = rl?.status === 'issued';
                    return (
                        <div>
                            <div style={{ background: '#f8fafc', borderRadius: 9, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                                Pasien: <strong>{editTarget.patient?.name}</strong>
                                <span style={{ marginLeft: 10, background: editTarget.source === 'consultation' ? '#eff6ff' : '#f0fdf4', color: editTarget.source === 'consultation' ? '#2563eb' : '#16a34a', padding: '1px 8px', borderRadius: 10, fontWeight: 600, fontSize: 11 }}>
                                    {editTarget.sourceLabel}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                    <div>
                                        <label style={labelStyle}>Umur (tahun)</label>
                                        <input value={rlAge} onChange={e => setRlAge(e.target.value)} placeholder="cth: 32" style={inputStyle} disabled={isIssued} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Jenis Kelamin</label>
                                        <select value={rlGender} onChange={e => setRlGender(e.target.value)} style={inputStyle} disabled={isIssued}>
                                            <option value="">—</option>
                                            <option value="Laki-laki">Laki-laki</option>
                                            <option value="Perempuan">Perempuan</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Berat Badan (kg)</label>
                                        <input value={rlWeight} onChange={e => setRlWeight(e.target.value)} placeholder="cth: 65" style={inputStyle} disabled={isIssued} />
                                    </div>
                                </div>
                                <div>
                                    <label style={labelStyle}>Diagnosis <span style={{ color: '#ef4444' }}>*</span></label>
                                    <textarea value={rlDiagnosis} onChange={e => setRlDiagnosis(e.target.value)} rows={2}
                                        placeholder="Contoh: Hipertensi grade II..."
                                        style={{ ...textareaStyle, borderColor: !rlDiagnosis.trim() ? '#fca5a5' : colors.border }}
                                        disabled={isIssued} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Rujukan Ke <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input value={rlTo} onChange={e => setRlTo(e.target.value)}
                                        placeholder="Contoh: RSUD Kota Bogor..."
                                        style={{ ...inputStyle, borderColor: !rlTo.trim() ? '#fca5a5' : colors.border }}
                                        disabled={isIssued} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Spesialisasi Tujuan</label>
                                    <input value={rlSpecialty} onChange={e => setRlSpecialty(e.target.value)}
                                        placeholder="Contoh: Kardiologi..." style={inputStyle} disabled={isIssued} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Alasan Rujukan <span style={{ color: '#ef4444' }}>*</span></label>
                                    <textarea value={rlReason} onChange={e => setRlReason(e.target.value)} rows={3}
                                        placeholder="Jelaskan alasan perujukan..."
                                        style={{ ...textareaStyle, borderColor: !rlReason.trim() ? '#fca5a5' : colors.border }}
                                        disabled={isIssued} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Catatan Tambahan</label>
                                    <textarea value={rlNotes} onChange={e => setRlNotes(e.target.value)} rows={2}
                                        placeholder="Obat yang sedang dikonsumsi, alergi, dll..." style={textareaStyle} disabled={isIssued} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, flexWrap: 'wrap' }}>
                                <Btn variant="ghost" onClick={() => setEditTarget(null)}>Batal</Btn>
                                {!isIssued && (
                                    <>
                                        <Btn variant="primary" onClick={doSaveEdit}
                                            disabled={rlSaving || !rlDiagnosis.trim() || !rlReason.trim() || !rlTo.trim()}>
                                            {rlSaving ? '…' : '💾 Simpan'}
                                        </Btn>
                                        <Btn variant="success" onClick={doIssueEdit} disabled={rlIssuing}>
                                            {rlIssuing ? '…' : '✅ Terbitkan'}
                                        </Btn>
                                    </>
                                )}
                                {isIssued && (
                                    <Btn variant="outline" onClick={() => downloadPDF(editTarget)}>⬇ Download PDF</Btn>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
};

export default SectionSuratRujukan;