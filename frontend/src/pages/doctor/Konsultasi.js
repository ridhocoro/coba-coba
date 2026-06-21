import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
// SECTION: KONSULTASI ONLINE
// ═══════════════════════════════════════════════════════════════════════════════
const SectionKonsultasi = ({ socketRef }) => {
    const navigate = useNavigate();
    const [tab, setTab]           = useState('active');
    const [consultations, setConsultations] = useState(() => getCache('doctor:consultations:data', []));
    const [loading, setLoading]   = useState(() => !hasCache('doctor:consultations:data'));
    const [processing, setProcessing] = useState({});
    // ── Detail riwayat konsultasi ──
    const [consDetail, setConsDetail]   = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // ── Surat Rujukan (konsultasi) ─────────────────────────────────
    const [rlTarget,    setRlTarget]    = useState(null);
    const [rlDiagnosis, setRlDiagnosis] = useState('');
    const [rlReason,    setRlReason]    = useState('');
    const [rlTo,        setRlTo]        = useState('');
    const [rlSpecialty, setRlSpecialty] = useState('');
    const [rlNotes,     setRlNotes]     = useState('');
    const [rlAge,       setRlAge]       = useState('');
    const [rlGender,    setRlGender]    = useState('');
    const [rlWeight,    setRlWeight]    = useState('');
    const [rlSaving,    setRlSaving]    = useState(false);
    const [rlIssuing,   setRlIssuing]   = useState(false);

    // ── ML Feedback (Active Learning) ──────────────────────────────
    const [mlTargetId, setMlTargetId] = useState(null);
    const [mlFeedback, setMlFeedback] = useState('');
    const [mlSaving, setMlSaving] = useState(false);

    const handleSubmitMlFeedback = async (id, originalCategory, symptoms) => {
        if (!mlFeedback) return toast.error('Pilih kategori koreksi yang benar');
        setMlSaving(true);
        try {
            await api.post('/api/doctors/ml-feedback', {
                type: 'consultation',
                id,
                keluhan: symptoms,
                prediksi_sistem: originalCategory,
                koreksi_dokter: mlFeedback
            });
            toast.success('Koreksi AI berhasil disubmit. Terima kasih!');
            setConsultations(prev => prev.map(c => c._id === id ? { ...c, ml_corrected: true } : c));
            setMlTargetId(null);
            setMlFeedback('');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Gagal submit koreksi');
        } finally {
            setMlSaving(false);
        }
    };

    const [search, setSearch] = useState('');



    const fetchAll = useCallback(async (background = false) => {
        if (!background) setLoading(!hasCache('doctor:consultations:data'));
        try {
            const params = search ? `?search=${encodeURIComponent(search)}` : '';
            const [ar, hr] = await Promise.all([
                api.get(`/api/consultations/doctor/pending${params}`),
                api.get(`/api/consultations/doctor/history${params}`),
            ]);
            // BUG-18 fix: spread history FIRST then pending so pending (authoritative for
            // active status) wins on duplicate _id — prevents active consultations disappearing
            const map = new Map();
            [...(hr.data?.consultations || []), ...(ar.data?.consultations || [])].forEach(c => map.set(c._id, c));
            const arr = Array.from(map.values());
            setConsultations(arr);
            setCache('doctor:consultations:data', arr);
        } catch { toast.error('Gagal memuat konsultasi'); }
        finally { if (!background) setLoading(false); }
    }, [search]);
    // Socket realtime
    useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;
    
    const handler = ({ consultationId, status }) => {
        setConsultations(prev => prev.map(c => c._id === consultationId ? { ...c, status } : c));
    };
    const notifHandler = (n) => {
        if (n.type?.includes('consultation')) { fetchAll(); }
    };
    
    socket.on('consultation-status-update', handler);
    socket.on('new-notification', notifHandler);
    
    return () => {
        socket.off('consultation-status-update', handler);
        socket.off('new-notification', notifHandler);
    };
    }, [socketRef, fetchAll]);



    useEffect(() => { 
        const isBg = hasCache('doctor:consultations:data');
        fetchAll(isBg); 
    }, [fetchAll]);

    const activeList = consultations.filter(c =>
        ['confirmed', 'in_progress', 'ongoing', 'paid', 'scheduled',
         'pending_payment', 'waiting_verification'].includes(c.status)
    );
    const todayList  = consultations.filter(c => {
        if (!c.scheduledAt) return false;
        return new Date(c.scheduledAt).toDateString() === new Date().toDateString();
    });
    const histList   = consultations.filter(c =>
        ['completed', 'no_show', 'doctor_no_show', 'cancelled_by_doctor',
         'cancelled_by_user', 'cancelled_by_admin', 'expired',
         'refund_requested', 'refunded', 'refund_failed'].includes(c.status)
    );
    const shown      = { active: activeList, today: todayList, history: histList }[tab] || [];

    const handleStart = async (id) => {
        setProcessing(p => ({ ...p, [id]: 'start' }));
        try {
            const r = await api.put(`/api/consultations/${id}/start`);
            setConsultations(prev => prev.map(c => c._id === id ? r.data.consultation : c));
            toast.success('Sesi konsultasi dimulai');
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal memulai'); }
        finally { setProcessing(p => ({ ...p, [id]: null })); }
    };

    const [endTarget,     setEndTarget]     = useState(null);
    const [endAssessment, setEndAssessment] = useState('');
    const [endPlan,       setEndPlan]       = useState('');
    const [endObjective,  setEndObjective]  = useState('');
    const [ending,        setEnding]        = useState(false);

    const handleEnd = (id) => {
        const c = consultations.find(x => x._id === id);
        setEndTarget(c || { _id: id });
        setEndAssessment(''); setEndPlan(''); setEndObjective('');
    };

    const doEnd = async () => {
        if (!endAssessment.trim()) { toast.error('Diagnosis wajib diisi'); return; }
        if (!endPlan.trim())       { toast.error('Rencana Terapi wajib diisi'); return; }
        setEnding(true);
        try {
            const r = await api.put(`/api/consultations/${endTarget._id}/end`, {
                assessment:        endAssessment,
                plan:              endPlan,
                objectiveFindings: endObjective,
            });
            setConsultations(prev => prev.map(c => c._id === endTarget._id ? r.data.consultation : c));
            toast.success('Sesi konsultasi selesai ✅');
            setEndTarget(null);
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal mengakhiri'); }
        finally { setEnding(false); }
    };

    // ── Surat Rujukan handlers ──────────────────────────────────────
    const openRlModal = (cons) => {
        const rl = cons.referralLetter;
        setRlTarget(cons);
        if (rl && typeof rl === 'object') {
            setRlDiagnosis(rl.diagnosis || '');
            setRlReason(rl.referralReason || '');
            setRlTo(rl.referralTo || '');
            setRlSpecialty(rl.referralSpecialty || '');
            setRlNotes(rl.notes || '');
            setRlAge(rl.patientAge || '');
            setRlGender(rl.patientGender || '');
            setRlWeight(rl.patientWeight || '');
        } else {
            setRlDiagnosis(cons.medicalRecord?.assessment || '');
            setRlReason(''); setRlTo(''); setRlSpecialty(''); setRlNotes('');
            setRlAge(''); setRlGender(''); setRlWeight('');
        }
    };
    const doSaveRl = async () => {
        if (!rlDiagnosis.trim() || !rlReason.trim() || !rlTo.trim()) {
            toast.error('Diagnosis, alasan rujukan, dan tujuan wajib diisi'); return;
        }
        setRlSaving(true);
        try {
            await api.post(`/api/consultations/${rlTarget._id}/referral-letter`, {
                diagnosis: rlDiagnosis, referralReason: rlReason, referralTo: rlTo,
                referralSpecialty: rlSpecialty, notes: rlNotes,
                patientAge: rlAge, patientGender: rlGender, patientWeight: rlWeight,
            });
            toast.success('Surat rujukan berhasil disimpan ✅');
            setRlTarget(null); fetchAll();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan'); }
        finally { setRlSaving(false); }
    };
    const doIssueRl = async () => {
        setRlIssuing(true);
        try {
            await api.put(`/api/consultations/${rlTarget._id}/referral-letter/issue`);
            toast.success('Surat rujukan diterbitkan ✅');
            setRlTarget(null); fetchAll();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal'); }
        finally { setRlIssuing(false); }
    };
    const downloadRlPdf = async (consId, letterNum) => {
        try {
            const r = await api.get(`/api/consultations/${consId}/referral-letter/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
            const a = document.createElement('a'); a.href = url;
            a.setAttribute('download', `surat-rujukan-${letterNum || consId}.pdf`);
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('PDF surat rujukan berhasil diunduh');
        } catch { toast.error('Gagal mengunduh PDF'); }
    };

    const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
    const textareaStyle = { ...inputStyle, resize: 'vertical' };
    const labelStyle = { display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text };

    const TABS = [
        { key: 'active', label: 'Aktif & Upcoming', count: activeList.length },
        { key: 'today',  label: 'Hari Ini',          count: todayList.length },
        { key: 'history',label: 'Riwayat',            count: null },
    ];

    return (
        <div>
            <SectionHeader title="Konsultasi Online" subtitle="Kelola sesi konsultasi pasien"
                action={<Btn size="sm" variant="ghost" onClick={fetchAll}>↻ Refresh</Btn>} />

            {/* Stats */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
                {[
                    { label: 'Aktif/Upcoming',      val: activeList.length,   color: '#2563eb' },
                    { label: 'Hari Ini',             val: todayList.length,    color: '#059669' },
                    { label: 'Sedang Berlangsung',   val: consultations.filter(c => c.status === 'in_progress').length, color: '#dc2626' },
                ].map(s => (
                    <Card key={s.label} style={{ padding: '14px 20px', flex: '1 1 120px' }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>{s.label}</div>
                    </Card>
                ))}
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                <input type="text" placeholder="Cari Pasien, Keluhan..." value={search} onChange={e => setSearch(e.target.value)} 
                    style={{ padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, width: 250, outline: 'none' }} />
                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>✕ Reset</button>}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
                        cursor: 'pointer', fontFamily: 'inherit',
                        background: tab === t.key ? '#fff' : 'transparent',
                        color: tab === t.key ? colors.text : colors.muted,
                        boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                    }}>
                        {t.label}
                        {t.count > 0 && <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{t.count}</span>}
                    </button>
                ))}
            </div>

            {loading ? <Spinner /> : shown.length === 0 ? <Empty icon="🩺" text="Tidak ada konsultasi" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {shown.map(c => {
                        const canStart = c.status === 'confirmed';
                        const canEnd   = c.status === 'in_progress';
                        const canChat  = ['confirmed','in_progress','completed','no_show','paid','scheduled','ongoing'].includes(c.status);
                        const proc     = processing[c._id];
                        return (
                            <Card key={c._id} style={{ padding: '16px 20px', border: c.status === 'in_progress' ? '2px solid #22c55e' : undefined }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>{c.userId?.name}</div>
                                        <div style={{ fontSize: 12, color: colors.muted }}>{c.userId?.email} {c.userId?.phone && `· ${c.userId.phone}`}</div>
                                    </div>
                                    <SBadge status={c.status} map={CONS_STATUS} />
                                </div>
                                <div style={{ fontSize: 13, color: colors.muted, marginBottom: 10 }}>
                                    📅 <strong>{fmtDT(c.scheduledAt)}</strong>
                                    {c.consultationType && <span style={{ marginLeft: 12 }}>{c.consultationType === 'video_call' ? '📹 Video Call' : '💬 Chat'}</span>}
                                </div>
                                {c.symptoms && (
                                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: colors.muted, marginBottom: 12 }}>
                                        <strong>Keluhan:</strong> {c.symptoms.slice(0, 150)}{c.symptoms.length > 150 ? '…' : ''}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {canStart && <Btn size="sm" variant="success" disabled={!!proc} onClick={() => handleStart(c._id)}>{proc === 'start' ? '…' : '▶ Mulai Sesi'}</Btn>}
                                    {canEnd   && <Btn size="sm" variant="danger"  onClick={() => handleEnd(c._id)}>⏹ Akhiri Sesi</Btn>}
                                    {canChat  && <Btn size="sm" variant="outline" onClick={() => navigate(`/consultations/${c._id}`)}>💬 Buka Chat</Btn>}
                                    {tab === 'history' && (
                                        <Btn size="sm" variant="ghost" onClick={async () => {
                                            setDetailLoading(true);
                                            try {
                                                const r = await api.get(`/api/consultations/${c._id}`);
                                                setConsDetail(r.data.consultation || r.data);
                                            } catch { toast.error('Gagal memuat detail'); }
                                            finally { setDetailLoading(false); }
                                        }}>📋 Detail</Btn>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modal Detail Riwayat Konsultasi */}
            <Modal open={!!consDetail || detailLoading} onClose={() => setConsDetail(null)} title="📋 Detail Konsultasi" width={580}>
                {detailLoading && <Spinner />}
                {consDetail && !detailLoading && (() => {
                    const d = consDetail;
                    const mr = d.medicalRecord;
                    const rx = d.prescriptionData;
                    const sl = d.sickLetter;
                    const msgs = d.messages || [];
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* Info pasien & jadwal */}
                            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px' }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 6 }}>{d.userId?.name}</div>
                                <div style={{ fontSize: 12, color: colors.muted, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                    <span>📅 {fmtDT(d.scheduledAt)}</span>
                                    <span>{d.consultationType === 'video_call' ? '📹 Video Call' : '💬 Chat'}</span>
                                    <SBadge status={d.status} map={CONS_STATUS} />
                                </div>
                                {d.symptoms && <div style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}><strong>Keluhan:</strong> {d.symptoms}</div>}
                                {d.medicalHistory && <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}><strong>Riwayat:</strong> {d.medicalHistory}</div>}
                            </div>

                            {d.disease_category && (
                                <div style={{ marginTop: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            background: d.ml_corrected ? '#f0fdf4' : (d.disease_category === 'Tidak Dikenali' ? '#fef3c7' : '#eff6ff'),
                                            border: `1px solid ${d.ml_corrected ? '#bbf7d0' : (d.disease_category === 'Tidak Dikenali' ? '#fde68a' : '#bfdbfe')}`,
                                            borderRadius: 20, padding: '3px 12px',
                                        }}>
                                            <span style={{ fontSize: 11 }}>
                                                {d.ml_corrected ? '✅' : (d.disease_category === 'Tidak Dikenali' ? '⚠️' : '🤖')}
                                            </span>
                                            <span style={{
                                                fontSize: 11, fontWeight: 700,
                                                color: d.ml_corrected ? '#166534' : (d.disease_category === 'Tidak Dikenali' ? '#92400e' : '#1d4ed8'),
                                            }}>
                                                {d.ml_corrected ? `Terkoreksi` : (d.disease_category === 'Tidak Dikenali'
                                                    ? 'Keluhan tidak dikenali sistem'
                                                    : `Terdeteksi: ${d.disease_category}`)}
                                            </span>
                                            {d.category_confidence && d.disease_category !== 'Tidak Dikenali' && !d.ml_corrected && (
                                                <span style={{ fontSize: 10, color: '#64748b' }}>
                                                    ({Math.round(d.category_confidence * 100)}%)
                                                </span>
                                            )}
                                        </div>
                                        {!d.ml_corrected && mlTargetId !== d._id && (
                                            <button onClick={() => setMlTargetId(d._id)} style={{ fontSize: 11, color: colors.primary, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Koreksi AI</button>
                                        )}
                                        {d.ml_corrected && (
                                            <span style={{ fontSize: 11, color: '#16a34a' }}>✓ Feedback terkirim</span>
                                        )}
                                    </div>
                                    {mlTargetId === d._id && (
                                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                            <select 
                                                value={mlFeedback} 
                                                onChange={e => setMlFeedback(e.target.value)}
                                                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none' }}
                                            >
                                                <option value="">-- Pilih Kategori Benar --</option>
                                                <option value="Demam">Demam</option>
                                                <option value="Batuk/Pilek">Batuk/Pilek</option>
                                                <option value="Pusing/Sakit Kepala">Pusing/Sakit Kepala</option>
                                                <option value="Sakit Perut/Diare">Sakit Perut/Diare</option>
                                                <option value="Gatal/Alergi">Gatal/Alergi</option>
                                                <option value="Pegal/Nyeri Otot">Pegal/Nyeri Otot</option>
                                                <option value="Sakit Gigi">Sakit Gigi</option>
                                                <option value="Lainnya">Lainnya</option>
                                            </select>
                                            <button 
                                                disabled={mlSaving}
                                                onClick={() => handleSubmitMlFeedback(d._id, d.disease_category, d.symptoms)} 
                                                style={{ fontSize: 11, background: colors.primary, color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
                                            >
                                                {mlSaving ? 'Loading...' : 'Submit'}
                                            </button>
                                            <button 
                                                onClick={() => {setMlTargetId(null); setMlFeedback('');}} 
                                                style={{ fontSize: 11, background: 'none', color: colors.muted, border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                            >
                                                Batal
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Rekam Medis */}
                            {mr?.isCompleted && (
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: colors.text, marginBottom: 8 }}>🩺 Rekam Medis</div>
                                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
                                        {mr.objectiveFindings && <div style={{ marginBottom: 6 }}><strong style={{ color: colors.muted }}>Pemeriksaan Fisik:</strong> {mr.objectiveFindings}</div>}
                                        {mr.assessment && <div style={{ marginBottom: 6 }}><strong style={{ color: colors.muted }}>Diagnosis:</strong> <span style={{ fontWeight: 700, color: colors.text }}>{mr.assessment}</span></div>}
                                        {mr.plan && <div><strong style={{ color: colors.muted }}>Rencana Terapi:</strong> {mr.plan}</div>}
                                    </div>
                                </div>
                            )}

                            {/* Resep */}
                            {rx?.medicines?.length > 0 && (
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: colors.text, marginBottom: 8 }}>💊 Resep Obat</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {rx.medicines.map((m, i) => (
                                            <div key={i} style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
                                                <span style={{ fontWeight: 700, color: colors.primary }}>{m.name}</span>
                                                <span style={{ color: colors.muted, marginLeft: 8 }}>{m.dose} · {m.frequency} · {m.duration}</span>
                                                {m.notes && <span style={{ color: colors.muted }}> — {m.notes}</span>}
                                            </div>
                                        ))}
                                    </div>
                                    {rx.doctorNotes && <div style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}><strong>Catatan:</strong> {rx.doctorNotes}</div>}
                                </div>
                            )}

                            {/* Surat Sakit */}
                            {sl && (
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: colors.text, marginBottom: 8 }}>📄 Surat Sakit</div>
                                    <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                                        <div><strong>No:</strong> {sl.letterNumber || '—'}</div>
                                        <div><strong>Diagnosis:</strong> {sl.diagnosis || '—'}</div>
                                        <div><strong>Status:</strong> {sl.status}</div>
                                    </div>
                                </div>
                            )}

                            {/* Surat Rujukan — read only di detail */}
                            {d.referralLetter && typeof d.referralLetter === 'object' && (() => {
                                const rl = d.referralLetter;
                                return (
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13, color: colors.text, marginBottom: 8 }}>🔀 Surat Rujukan</div>
                                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                                            <div><strong>No:</strong> {rl.letterNumber || '—'}</div>
                                            <div><strong>Diagnosis:</strong> {rl.diagnosis || '—'}</div>
                                            <div><strong>Rujukan Ke:</strong> {rl.referralTo || '—'}</div>
                                            {rl.referralSpecialty && <div><strong>Spesialisasi:</strong> {rl.referralSpecialty}</div>}
                                            <div><strong>Status:</strong> <span style={{ color: rl.status === 'issued' ? '#1d4ed8' : '#7c3aed', fontWeight: 700 }}>{rl.status === 'issued' ? '✓ Terbit' : '📝 Draft'}</span></div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Ringkasan Chat */}
                            {msgs.length > 0 && (
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: colors.text, marginBottom: 8 }}>
                                        💬 Riwayat Chat <span style={{ fontWeight: 400, color: colors.muted }}>({msgs.length} pesan)</span>
                                    </div>
                                    <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${colors.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, background: '#f9fafb' }}>
                                        {msgs.slice(-20).map((m, i) => {
                                            const isDoc = m.senderRole === 'doctor';
                                            return (
                                                <div key={i} style={{ display: 'flex', justifyContent: isDoc ? 'flex-end' : 'flex-start' }}>
                                                    <div style={{
                                                        background: isDoc ? '#dbeafe' : '#fff',
                                                        border: `1px solid ${isDoc ? '#bfdbfe' : colors.border}`,
                                                        borderRadius: 10, padding: '6px 12px',
                                                        fontSize: 12, maxWidth: '75%',
                                                        color: colors.text,
                                                    }}>
                                                        <div style={{ fontSize: 10, color: colors.muted, marginBottom: 2, fontWeight: 600 }}>
                                                            {isDoc ? 'Dokter' : d.userId?.name}
                                                        </div>
                                                        {m.imageUrl && <img src={m.imageUrl.startsWith('http') ? m.imageUrl : `${API_URL}${m.imageUrl}`} alt="" style={{ maxWidth: 120, borderRadius: 6, display: 'block', marginBottom: 4 }} />}
                                                        {m.text || m.message || ''}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: `1px solid ${colors.border}`, flexWrap: 'wrap' }}>
                                <Btn variant="ghost" onClick={() => setConsDetail(null)}>Tutup</Btn>
                                {['in_progress','ongoing','completed','no_show'].includes(d.status) && (
                                    <Btn variant="outline" onClick={() => { setConsDetail(null); openRlModal(d); }}>🔀 Surat Rujukan</Btn>
                                )}
                                <Btn variant="outline" onClick={() => { navigate(`/consultations/${d._id}`); setConsDetail(null); }}>💬 Buka Chat Lengkap</Btn>
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            {/* Modal Akhiri Sesi — rekam medis wajib */}
            <Modal open={!!endTarget} onClose={() => setEndTarget(null)} title="⏹ Akhiri Sesi Konsultasi">
                <p style={{ margin: '0 0 14px', color: colors.muted, fontSize: 14 }}>
                    Pasien: <strong>{endTarget?.userId?.name || '—'}</strong>
                    {endTarget?.scheduledAt && <> — <strong>{new Date(endTarget.scheduledAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB</strong></>}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text }}>
                            Pemeriksaan Fisik / Temuan Objektif <span style={{ color: colors.muted, fontWeight: 400 }}>(opsional)</span>
                        </label>
                        <textarea value={endObjective} onChange={e => setEndObjective(e.target.value)} rows={2}
                            placeholder="Temuan dari pemeriksaan fisik, hasil lab, dll..."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text }}>
                            Diagnosis <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea value={endAssessment} onChange={e => setEndAssessment(e.target.value)} rows={2}
                            placeholder="Contoh: ISPA ringan, Gastritis akut, Hipertensi grade I..."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${!endAssessment.trim() ? '#fca5a5' : colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text }}>
                            Rencana Terapi / Tindakan <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea value={endPlan} onChange={e => setEndPlan(e.target.value)} rows={2}
                            placeholder="Contoh: Amoxicillin 3x500mg 5 hari, istirahat, kontrol jika tidak membaik..."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${!endPlan.trim() ? '#fca5a5' : colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                </div>
                <p style={{ fontSize: 11, color: colors.muted, margin: '8px 0 14px' }}>
                    <span style={{ color: '#ef4444' }}>*</span> Diagnosis dan Rencana Terapi wajib diisi. Rekam medis ini akan tersedia untuk pasien.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <Btn variant="ghost" onClick={() => setEndTarget(null)}>Batal</Btn>
                    <Btn variant="danger" onClick={doEnd} disabled={ending || !endAssessment.trim() || !endPlan.trim()}>
                        {ending ? '…' : '⏹ Akhiri & Simpan Rekam Medis'}
                    </Btn>
                </div>
            </Modal>

            {/* ── MODAL: Surat Rujukan (Konsultasi) ── */}
            <Modal open={!!rlTarget} onClose={() => setRlTarget(null)} title="🔀 Surat Rujukan Konsultasi" width={560}>
                {rlTarget && (() => {
                    const rl = rlTarget.referralLetter;
                    const hasLetter = rl && typeof rl === 'object';
                    const isIssued  = hasLetter && rl.status === 'issued';
                    return (
                        <div>
                            <div style={{ background: '#f8fafc', borderRadius: 9, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                                Pasien: <strong>{rlTarget.userId?.name}</strong>
                                {hasLetter && <span style={{ marginLeft: 12, color: isIssued ? '#1d4ed8' : '#7c3aed', fontWeight: 600 }}>{isIssued ? '✓ Terbit' : '📝 Draft'}</span>}
                            </div>

                            {!isIssued && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                        <div>
                                            <label style={labelStyle}>Umur (tahun)</label>
                                            <input value={rlAge} onChange={e => setRlAge(e.target.value)} placeholder="cth: 32" style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Jenis Kelamin</label>
                                            <select value={rlGender} onChange={e => setRlGender(e.target.value)} style={inputStyle}>
                                                <option value="">—</option>
                                                <option value="Laki-laki">Laki-laki</option>
                                                <option value="Perempuan">Perempuan</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Berat Badan (kg)</label>
                                            <input value={rlWeight} onChange={e => setRlWeight(e.target.value)} placeholder="cth: 65" style={inputStyle} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Diagnosis <span style={{ color: '#ef4444' }}>*</span></label>
                                        <textarea value={rlDiagnosis} onChange={e => setRlDiagnosis(e.target.value)} rows={2}
                                            placeholder="Contoh: Hipertensi grade II, memerlukan evaluasi kardiologi..."
                                            style={{ ...textareaStyle, borderColor: !rlDiagnosis.trim() ? '#fca5a5' : colors.border }} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Rujukan Ke <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input value={rlTo} onChange={e => setRlTo(e.target.value)}
                                            placeholder="Contoh: RSUD Kota Bogor, Poli Jantung RS XYZ..."
                                            style={{ ...inputStyle, borderColor: !rlTo.trim() ? '#fca5a5' : colors.border }} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Spesialisasi Tujuan</label>
                                        <input value={rlSpecialty} onChange={e => setRlSpecialty(e.target.value)}
                                            placeholder="Contoh: Kardiologi, Orthopedi, Neurologi..." style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Alasan Rujukan <span style={{ color: '#ef4444' }}>*</span></label>
                                        <textarea value={rlReason} onChange={e => setRlReason(e.target.value)} rows={3}
                                            placeholder="Jelaskan alasan perujukan, riwayat pengobatan sebelumnya, dan hal penting lainnya..."
                                            style={{ ...textareaStyle, borderColor: !rlReason.trim() ? '#fca5a5' : colors.border }} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Catatan Tambahan</label>
                                        <textarea value={rlNotes} onChange={e => setRlNotes(e.target.value)} rows={2}
                                            placeholder="Obat yang sedang dikonsumsi, alergi, dll..." style={textareaStyle} />
                                    </div>
                                </div>
                            )}

                            {isIssued && (
                                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.7 }}>
                                    {[
                                        ['No. Surat',      rl.letterNumber],
                                        ['Diagnosis',      rl.diagnosis],
                                        ['Rujukan Ke',     rl.referralTo],
                                        ['Spesialisasi',   rl.referralSpecialty],
                                        ['Umur',           rl.patientAge ? rl.patientAge + ' tahun' : null],
                                        ['Jenis Kelamin',  rl.patientGender],
                                        ['Alasan Rujukan', rl.referralReason],
                                        ['Catatan',        rl.notes],
                                    ].filter(([,v]) => v).map(([label, value]) => (
                                        <div key={label} style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
                                            <span style={{ minWidth: 120, color: colors.muted, fontWeight: 600 }}>{label}</span>
                                            <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, flexWrap: 'wrap' }}>
                                <Btn variant="ghost" onClick={() => setRlTarget(null)}>Tutup</Btn>
                                {!hasLetter && (
                                    <Btn variant="primary" onClick={doSaveRl} disabled={rlSaving || !rlDiagnosis.trim() || !rlReason.trim() || !rlTo.trim()}>
                                        {rlSaving ? '…' : '💾 Simpan Draft'}
                                    </Btn>
                                )}
                                {hasLetter && !isIssued && (
                                    <Btn variant="success" onClick={doIssueRl} disabled={rlIssuing}>
                                        {rlIssuing ? '…' : '✅ Terbitkan Surat'}
                                    </Btn>
                                )}
                                {isIssued && (
                                    <Btn variant="outline" onClick={() => downloadRlPdf(rlTarget._id, rl.letterNumber)}>
                                        ⬇ Download PDF
                                    </Btn>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </Modal>

        </div>
    );
};

export default SectionKonsultasi;