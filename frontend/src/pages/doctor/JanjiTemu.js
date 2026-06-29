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
// SECTION: JANJI TEMU
// ═══════════════════════════════════════════════════════════════════════════════
const SectionJanjiTemu = ({ socketRef }) => {
    const [appointments, setAppointments] = useState(() => getCache('doctor:appointments:data', []));
    const [loading, setLoading]   = useState(() => !hasCache('doctor:appointments:data'));
    const [dateFilter, setDateFilter]   = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch]           = useState('');
    const [processing, setProcessing] = useState({});
    const [completeTarget, setCompleteTarget] = useState(null);
    const [completeNotes, setCompleteNotes]   = useState('');
    const [completeAssessment, setCompleteAssessment] = useState('');
    const [completePlan, setCompletePlan]     = useState('');
    const [completing, setCompleting]         = useState(false);
    const [cancelTarget, setCancelTarget]     = useState(null);
    const [cancelReason, setCancelReason]     = useState('');
    const [cancelling, setCancelling]         = useState(false);

    // ── Surat Sakit (appointment) ──────────────────────────────────
    const [slTarget,       setSlTarget]       = useState(null);
    const [slDiagnosis,    setSlDiagnosis]    = useState('');
    const [slRestDays,     setSlRestDays]     = useState('3');
    const [slNotes,        setSlNotes]        = useState('');
    const [slAge,          setSlAge]          = useState('');
    const [slGender,       setSlGender]       = useState('');
    const [slWeight,       setSlWeight]       = useState('');
    const [slSaving,       setSlSaving]       = useState(false);
    const [slIssuing,      setSlIssuing]      = useState(false);

    // ── Surat Rujukan (appointment) ────────────────────────────────
    const [rlTarget,       setRlTarget]       = useState(null);
    const [rlDiagnosis,    setRlDiagnosis]    = useState('');
    const [rlReason,       setRlReason]       = useState('');
    const [rlTo,           setRlTo]           = useState('');
    const [rlSpecialty,    setRlSpecialty]    = useState('');
    const [rlNotes,        setRlNotes]        = useState('');
    const [rlAge,          setRlAge]          = useState('');
    const [rlGender,       setRlGender]       = useState('');
    const [rlWeight,       setRlWeight]       = useState('');
    const [rlSaving,       setRlSaving]       = useState(false);
    const [rlIssuing,      setRlIssuing]      = useState(false);

    // ── ML Feedback (Active Learning) ──────────────────────────────
    const [mlTargetId, setMlTargetId] = useState(null);
    const [mlFeedback, setMlFeedback] = useState('');
    const [mlSaving, setMlSaving] = useState(false);

    const handleSubmitMlFeedback = async (id, originalCategory, symptoms) => {
        if (!mlFeedback) return toast.error('Ketik kategori koreksi yang benar');
        setMlSaving(true);
        try {
            await api.post('/api/doctors/ml-feedback', {
                type: 'appointment',
                id,
                keluhan: symptoms,
                prediksi_sistem: originalCategory,
                koreksi_dokter: mlFeedback
            });
            toast.success('Koreksi AI berhasil disubmit. Terima kasih!');
            setAppointments(prev => prev.map(a => a._id === id ? { ...a, ml_corrected: true } : a));
            setMlTargetId(null);
            setMlFeedback('');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Gagal submit koreksi');
        } finally {
            setMlSaving(false);
        }
    };


    const fetchData = useCallback(async (background = false) => {
        if (!background) setLoading(!hasCache('doctor:appointments:data'));
        try {
            const params = {};
            if (dateFilter) params.date = dateFilter;
            if (statusFilter !== 'all') params.status = statusFilter;
            if (search) params.search = search;
            const r = await api.get('/api/appointments/doctor/list', { params });
            setAppointments(r.data.appointments || []);
            if (!dateFilter && statusFilter === 'all' && !search) {
                setCache('doctor:appointments:data', r.data.appointments || []);
            }
        } catch { toast.error('Gagal memuat janji temu'); }
        finally { if (!background) setLoading(false); }
    }, [dateFilter, statusFilter, search]);

    useEffect(() => { 
        const isBg = !dateFilter && statusFilter === 'all' && !search && hasCache('doctor:appointments:data');
        fetchData(isBg); 
    }, [fetchData]);

    // Socket: realtime new appointment
    useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;
    
    const handler = (n) => {
        if (n.type === 'appointment_reminder' || n.type === 'appointment_request') {
            fetchData();
            toast('📅 Janji temu baru masuk!', { icon: '📅' });
        }
    };
    
    socket.on('new-notification', handler);
    return () => socket.off('new-notification', handler);
    }, [socketRef, fetchData]);

    // Polling fallback every 30s
    useEffect(() => {
        const t = setInterval(fetchData, 30000);
        return () => clearInterval(t);
    }, [fetchData]);

    const doCheckin = async (id) => {
        setProcessing(p => ({ ...p, [id]: 'ci' }));
        try { await api.put(`/api/appointments/doctor/${id}/checkin`); toast.success('Check-in berhasil ✅'); fetchData(); }
        catch (e) { toast.error(e.response?.data?.message || 'Gagal check-in'); }
        finally { setProcessing(p => ({ ...p, [id]: null })); }
    };

    const doComplete = async () => {
        if (!completeAssessment.trim()) { toast.error('Diagnosis wajib diisi'); return; }
        if (!completePlan.trim())       { toast.error('Rencana Terapi wajib diisi'); return; }
        setCompleting(true);
        try {
            await api.put(`/api/appointments/doctor/${completeTarget._id}/complete`, {
                notes:             completeNotes,
                assessment:        completeAssessment,
                plan:              completePlan,
                objectiveFindings: completeNotes,
            });
            toast.success('Janji temu selesai ✅');
            setCompleteTarget(null);
            setCompleteNotes(''); setCompleteAssessment(''); setCompletePlan('');
            fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal'); }
        finally { setCompleting(false); }
    };

    const doCancel = async () => {
        if (cancelReason.trim().length < 5) { toast.error('Alasan minimal 5 karakter'); return; }
        setCancelling(true);
        try {
            await api.put(`/api/appointments/doctor/${cancelTarget._id}/cancel`, { reason: cancelReason });
            toast.success('Janji temu dibatalkan'); setCancelTarget(null); setCancelReason(''); fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal'); }
        finally { setCancelling(false); }
    };

    // ── Surat Sakit handlers ────────────────────────────────────────
    const openSlModal = (appt) => {
        const sl = appt.sickLetter;
        setSlTarget(appt);
        if (sl && typeof sl === 'object') {
            setSlDiagnosis(sl.diagnosis || '');
            setSlNotes(sl.notes || '');
            setSlAge(sl.patientAge || '');
            setSlGender(sl.patientGender || '');
            setSlWeight(sl.patientWeight || '');
            setSlRestDays(sl.startDate && sl.endDate
                ? String(Math.ceil((new Date(sl.endDate) - new Date(sl.startDate)) / 86400000) + 1)
                : '3');
        } else {
            setSlDiagnosis(appt.medicalRecord?.assessment || '');
            setSlNotes(''); setSlAge(''); setSlGender(''); setSlWeight(''); setSlRestDays('3');
        }
    };

    const doSaveSl = async () => {
        if (!slDiagnosis.trim() || !slRestDays) { toast.error('Diagnosis dan hari istirahat wajib diisi'); return; }
        setSlSaving(true);
        try {
            await api.post(`/api/appointments/doctor/${slTarget._id}/sick-letter`, {
                diagnosis: slDiagnosis, restDays: slRestDays, notes: slNotes,
                patientAge: slAge, patientGender: slGender, patientWeight: slWeight,
            });
            toast.success('Surat sakit berhasil disimpan ✅');
            setSlTarget(null); fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan'); }
        finally { setSlSaving(false); }
    };

    const doIssueSl = async () => {
        setSlIssuing(true);
        try {
            await api.put(`/api/appointments/doctor/${slTarget._id}/sick-letter/issue`);
            toast.success('Surat sakit diterbitkan ✅');
            setSlTarget(null); fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal menerbitkan'); }
        finally { setSlIssuing(false); }
    };

    const downloadSlPdf = async (apptId, letterNum) => {
        try {
            const r = await api.get(`/api/appointments/${apptId}/sick-letter/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
            const a = document.createElement('a'); a.href = url;
            a.setAttribute('download', `surat-sakit-${letterNum || apptId}.pdf`);
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('PDF surat sakit berhasil diunduh');
        } catch { toast.error('Gagal mengunduh PDF'); }
    };

    // ── Surat Rujukan handlers ──────────────────────────────────────
    const openRlModal = (appt) => {
        const rl = appt.referralLetter;
        setRlTarget(appt);
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
            setRlDiagnosis(appt.medicalRecord?.assessment || '');
            setRlReason(''); setRlTo(''); setRlSpecialty(''); setRlNotes('');
            setRlAge(''); setRlGender(''); setRlWeight('');
        }
    };

    const doSaveRl = async () => {
        if (!rlDiagnosis.trim() || !rlReason.trim() || !rlTo.trim()) {
            toast.error('Diagnosis, alasan rujukan, dan tujuan rujukan wajib diisi'); return;
        }
        setRlSaving(true);
        try {
            await api.post(`/api/appointments/doctor/${rlTarget._id}/referral-letter`, {
                diagnosis: rlDiagnosis, referralReason: rlReason, referralTo: rlTo,
                referralSpecialty: rlSpecialty, notes: rlNotes,
                patientAge: rlAge, patientGender: rlGender, patientWeight: rlWeight,
            });
            toast.success('Surat rujukan berhasil disimpan ✅');
            setRlTarget(null); fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan'); }
        finally { setRlSaving(false); }
    };

    const doIssueRl = async () => {
        setRlIssuing(true);
        try {
            await api.put(`/api/appointments/doctor/${rlTarget._id}/referral-letter/issue`);
            toast.success('Surat rujukan diterbitkan ✅');
            setRlTarget(null); fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal menerbitkan'); }
        finally { setRlIssuing(false); }
    };

    const downloadRlPdf = async (apptId, letterNum) => {
        try {
            const r = await api.get(`/api/appointments/${apptId}/referral-letter/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
            const a = document.createElement('a'); a.href = url;
            a.setAttribute('download', `surat-rujukan-${letterNum || apptId}.pdf`);
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('PDF surat rujukan berhasil diunduh');
        } catch { toast.error('Gagal mengunduh PDF'); }
    };

    const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
    const textareaStyle = { ...inputStyle, resize: 'vertical' };
    const labelStyle = { display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text };

    return (
        <div>
            <SectionHeader title="📅 Janji Temu" subtitle="Kelola janji temu pasien"
                action={<Btn size="sm" variant="ghost" onClick={fetchData}>↻ Refresh</Btn>} />

            {/* Filter */}
            <Card style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                    <label style={{ ...labelStyle, marginBottom: 4 }}>Tanggal</label>
                    <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                        style={{ ...inputStyle, width: 160 }} />
                </div>
                <div>
                    <label style={{ ...labelStyle, marginBottom: 4 }}>Status</label>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        style={{ ...inputStyle, width: 160 }}>
                        <option value="all">Semua</option>
                        {Object.entries(APPT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ ...labelStyle, marginBottom: 4 }}>Cari Pasien/Keluhan</label>
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Cari..." style={{ ...inputStyle, width: 200 }} />
                </div>
                {(dateFilter || statusFilter !== 'all' || search) && (
                    <Btn size="sm" variant="ghost" onClick={() => { setDateFilter(''); setStatusFilter('all'); setSearch(''); }}>✕ Reset</Btn>
                )}
            </Card>

            {loading ? <Spinner /> : appointments.length === 0 ? <Empty icon="📅" text="Tidak ada janji temu" /> : (
                <Card>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>{['Pasien', 'Tanggal', 'Jam', 'Keluhan', 'Surat', 'Status', 'Aksi'].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {appointments.map((a, i) => {
                                    const proc = processing[a._id];
                                    let isTime = true;
                                    const canCI    = a.status === 'scheduled';
                                    const canComp  = a.status === 'checked_in';
                                    const canCancl = a.status === 'scheduled' && (new Date(a.scheduledAt || a.appointmentDate).getTime() - Date.now() > 24 * 3600000);
                                    const canLetter = ['checked_in', 'completed'].includes(a.status);
                                    const accent   = APPT_STATUS[a.status]?.color || colors.border;
                                    const sl = a.sickLetter;
                                    const rl = a.referralLetter;

                                    return (
                                        <tr key={a._id} style={{ borderBottom: `1px solid #f8fafc`, background: i % 2 ? '#fafafa' : '#fff', borderLeft: `3px solid ${accent}` }}>
                                            <td style={TD}>
                                                <div style={{ fontWeight: 600, color: colors.text }}>{a.userId?.name}</div>
                                                <div style={{ fontSize: 11, color: colors.subtle }}>{a.userId?.phone}</div>
                                            </td>
                                            <td style={{ ...TD, whiteSpace: 'nowrap', color: colors.muted }}>{fmtDate(a.appointmentDate)}</td>
                                            <td style={{ ...TD, fontWeight: 700, color: colors.text, whiteSpace: 'nowrap' }}>{a.appointmentTime}</td>
                                            <td style={{ ...TD, color: colors.muted, maxWidth: 140 }}>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.complaint || '—'}</div>
                                                {a.disease_category && (
                                                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                        <div style={{ fontSize: 10, background: a.ml_corrected ? '#f0fdf4' : '#eff6ff', color: a.ml_corrected ? '#166534' : '#1d4ed8', border: `1px solid ${a.ml_corrected ? '#bbf7d0' : '#bfdbfe'}`, borderRadius: 4, padding: '2px 4px', display: 'inline-block', width: 'fit-content' }}>
                                                            {a.ml_corrected ? '✅ Terkoreksi' : `🤖 ${a.disease_category}`}
                                                        </div>
                                                        {!a.ml_corrected && mlTargetId !== a._id && (
                                                            <button onClick={() => setMlTargetId(a._id)} style={{ fontSize: 9, color: colors.primary, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'left' }}>Koreksi AI</button>
                                                        )}
                                                        {mlTargetId === a._id && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                <input type="text" placeholder="Ketik kategori..." value={mlFeedback} onChange={e => setMlFeedback(e.target.value)} style={{ fontSize: 9, padding: '2px', maxWidth: '100px' }} />
                                                                <div style={{ display: 'flex', gap: 4 }}>
                                                                    <button disabled={mlSaving} onClick={() => handleSubmitMlFeedback(a._id, a.disease_category, a.complaint)} style={{ fontSize: 9, background: colors.primary, color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Submit</button>
                                                                    <button onClick={() => {setMlTargetId(null); setMlFeedback('');}} style={{ fontSize: 9, background: 'none', color: colors.muted, border: 'none', cursor: 'pointer' }}>Batal</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {a.cancelReason && <div style={{ fontSize: 11, color: colors.danger, marginTop: 4 }}>Alasan: {a.cancelReason}</div>}
                                            </td>
                                            <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
                                                    {/* Surat Sakit badge */}
                                                    {sl && typeof sl === 'object' ? (
                                                        <span
                                                            onClick={() => openSlModal(a)}
                                                            title="Lihat / edit surat sakit"
                                                            style={{ cursor: 'pointer', background: sl.status === 'issued' ? '#dcfce7' : '#fef9c3', color: sl.status === 'issued' ? '#166534' : '#854d0e', border: `1px solid ${sl.status === 'issued' ? '#86efac' : '#fde68a'}`, borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                                                            📄 {sl.status === 'issued' ? 'Sakit ✓' : 'Sakit Draft'}
                                                        </span>
                                                    ) : canLetter ? (
                                                        <span onClick={() => openSlModal(a)} title="Buat surat sakit"
                                                            style={{ cursor: 'pointer', background: '#f1f5f9', color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '2px 8px', fontSize: 10 }}>
                                                            + Sakit
                                                        </span>
                                                    ) : null}
                                                    {/* Surat Rujukan badge */}
                                                    {rl && typeof rl === 'object' ? (
                                                        <span
                                                            onClick={() => openRlModal(a)}
                                                            title="Lihat / edit surat rujukan"
                                                            style={{ cursor: 'pointer', background: rl.status === 'issued' ? '#dbeafe' : '#ede9fe', color: rl.status === 'issued' ? '#1d4ed8' : '#6d28d9', border: `1px solid ${rl.status === 'issued' ? '#93c5fd' : '#c4b5fd'}`, borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                                                            🔀 {rl.status === 'issued' ? 'Rujukan ✓' : 'Rujukan Draft'}
                                                        </span>
                                                    ) : canLetter ? (
                                                        <span onClick={() => openRlModal(a)} title="Buat surat rujukan"
                                                            style={{ cursor: 'pointer', background: '#f1f5f9', color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '2px 8px', fontSize: 10 }}>
                                                            + Rujukan
                                                        </span>
                                                    ) : null}
                                                    {!canLetter && !sl && !rl && <span style={{ color: colors.muted, fontSize: 11 }}>—</span>}
                                                </div>
                                            </td>
                                            <td style={TD}><SBadge status={a.status} map={APPT_STATUS} /></td>
                                            <td style={TD}>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    {canCI && (
                                                        <Btn size="sm" variant="success"
                                                             disabled={!!proc || !isTime}
                                                             onClick={() => doCheckin(a._id)}
                                                             title={!isTime ? 'Hanya bisa check-in 30 menit sebelum jadwal' : 'Mulai sesi'}>
                                                            {proc === 'ci' ? '…' : '✅ Check-in'}
                                                        </Btn>
                                                    )}
                                                    {canComp && <Btn size="sm" variant="primary" onClick={() => { setCompleteTarget(a); setCompleteNotes(''); setCompleteAssessment(''); setCompletePlan(''); }}>🏁 Selesai</Btn>}
                                                    {canCancl && <Btn size="sm" variant="red_outline" onClick={() => { setCancelTarget(a); setCancelReason(''); }}>❌ Batal</Btn>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* ── Complete modal ── */}
            <Modal open={!!completeTarget} onClose={() => setCompleteTarget(null)} title="🏁 Selesaikan Janji Temu">
                <p style={{ margin: '0 0 14px', color: colors.muted, fontSize: 14 }}>
                    Pasien: <strong>{completeTarget?.userId?.name}</strong> — pukul <strong>{completeTarget?.appointmentTime}</strong>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label style={labelStyle}>Pemeriksaan Fisik / Temuan Objektif <span style={{ color: colors.muted, fontWeight: 400 }}>(opsional)</span></label>
                        <textarea value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} rows={2}
                            placeholder="Tekanan darah, suhu, temuan fisik..." style={textareaStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Diagnosis <span style={{ color: '#ef4444' }}>*</span></label>
                        <textarea value={completeAssessment} onChange={e => setCompleteAssessment(e.target.value)} rows={2}
                            placeholder="Contoh: ISPA ringan, Gastritis akut..."
                            style={{ ...textareaStyle, borderColor: !completeAssessment.trim() ? '#fca5a5' : colors.border }} />
                    </div>
                    <div>
                        <label style={labelStyle}>Rencana Terapi / Tindakan <span style={{ color: '#ef4444' }}>*</span></label>
                        <textarea value={completePlan} onChange={e => setCompletePlan(e.target.value)} rows={2}
                            placeholder="Contoh: Pemberian antibiotik amoxicillin 3x500mg..."
                            style={{ ...textareaStyle, borderColor: !completePlan.trim() ? '#fca5a5' : colors.border }} />
                    </div>
                </div>
                <p style={{ fontSize: 11, color: colors.muted, margin: '8px 0 14px' }}>
                    <span style={{ color: '#ef4444' }}>*</span> Diagnosis dan Rencana Terapi wajib diisi sebelum menyelesaikan janji.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <Btn variant="ghost" onClick={() => setCompleteTarget(null)}>Batal</Btn>
                    <Btn variant="success" onClick={doComplete} disabled={completing || !completeAssessment.trim() || !completePlan.trim()}>
                        {completing ? '…' : '✅ Tandai Selesai'}
                    </Btn>
                </div>
            </Modal>

            {/* ── Cancel modal ── */}
            <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="❌ Batalkan Janji Temu">
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#b91c1c' }}>
                    <strong>{cancelTarget?.userId?.name}</strong> — pukul {cancelTarget?.appointmentTime}
                </div>
                <label style={{ ...labelStyle, marginBottom: 6 }}>Alasan Pembatalan *</label>
                <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
                    placeholder="Masukkan alasan pembatalan (min 5 karakter)..."
                    style={{ ...textareaStyle, marginBottom: 18 }} />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <Btn variant="ghost" onClick={() => setCancelTarget(null)}>Batal</Btn>
                    <Btn variant="danger" onClick={doCancel} disabled={cancelling}>{cancelling ? '…' : 'Konfirmasi Batalkan'}</Btn>
                </div>
            </Modal>

            {/* ── MODAL: Surat Sakit (Appointment) ── */}
            <Modal open={!!slTarget} onClose={() => setSlTarget(null)} title="📄 Surat Keterangan Sakit" width={540}>
                {slTarget && (() => {
                    const sl = slTarget.sickLetter;
                    const hasLetter = sl && typeof sl === 'object';
                    const isIssued  = hasLetter && sl.status === 'issued';
                    return (
                        <div>
                            <div style={{ background: '#f8fafc', borderRadius: 9, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                                Pasien: <strong>{slTarget.userId?.name}</strong>
                                {hasLetter && <span style={{ marginLeft: 12, color: isIssued ? '#16a34a' : '#ca8a04', fontWeight: 600 }}>{isIssued ? '✓ Terbit' : '📝 Draft'}</span>}
                            </div>

                            {/* Form — hanya tampil jika belum terbit */}
                            {!isIssued && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                        <div>
                                            <label style={labelStyle}>Umur (tahun)</label>
                                            <input value={slAge} onChange={e => setSlAge(e.target.value)} placeholder="cth: 32" style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Jenis Kelamin</label>
                                            <select value={slGender} onChange={e => setSlGender(e.target.value)} style={inputStyle}>
                                                <option value="">—</option>
                                                <option value="Laki-laki">Laki-laki</option>
                                                <option value="Perempuan">Perempuan</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Berat Badan (kg)</label>
                                            <input value={slWeight} onChange={e => setSlWeight(e.target.value)} placeholder="cth: 65" style={inputStyle} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Diagnosis <span style={{ color: '#ef4444' }}>*</span></label>
                                        <textarea value={slDiagnosis} onChange={e => setSlDiagnosis(e.target.value)} rows={2}
                                            placeholder="Contoh: ISPA ringan, Gastritis akut..."
                                            style={{ ...textareaStyle, borderColor: !slDiagnosis.trim() ? '#fca5a5' : colors.border }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                                        <div>
                                            <label style={labelStyle}>Hari Istirahat <span style={{ color: '#ef4444' }}>*</span></label>
                                            <input type="number" min="1" max="30" value={slRestDays} onChange={e => setSlRestDays(e.target.value)}
                                                style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Catatan Tambahan</label>
                                            <input value={slNotes} onChange={e => setSlNotes(e.target.value)}
                                                placeholder="Opsional..." style={inputStyle} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Readonly view saat sudah issued */}
                            {isIssued && (
                                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.7 }}>
                                    {[
                                        ['No. Surat',   sl.letterNumber],
                                        ['Diagnosis',   sl.diagnosis],
                                        ['Umur',        sl.patientAge ? sl.patientAge + ' tahun' : null],
                                        ['Jenis Kelamin',sl.patientGender],
                                        ['Berat Badan', sl.patientWeight ? sl.patientWeight + ' kg' : null],
                                        ['Mulai',       sl.startDate ? new Date(sl.startDate).toLocaleDateString('id-ID') : null],
                                        ['Sampai',      sl.endDate   ? new Date(sl.endDate).toLocaleDateString('id-ID')   : null],
                                        ['Catatan',     sl.notes],
                                    ].filter(([,v]) => v).map(([label, value]) => (
                                        <div key={label} style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
                                            <span style={{ minWidth: 110, color: colors.muted, fontWeight: 600 }}>{label}</span>
                                            <span>{value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, flexWrap: 'wrap' }}>
                                <Btn variant="ghost" onClick={() => setSlTarget(null)}>Tutup</Btn>
                                {!hasLetter && (
                                    <Btn variant="primary" onClick={doSaveSl} disabled={slSaving || !slDiagnosis.trim() || !slRestDays}>
                                        {slSaving ? '…' : '💾 Simpan Draft'}
                                    </Btn>
                                )}
                                {hasLetter && !isIssued && (
                                    <Btn variant="success" onClick={doIssueSl} disabled={slIssuing}>
                                        {slIssuing ? '…' : '✅ Terbitkan Surat'}
                                    </Btn>
                                )}
                                {isIssued && (
                                    <Btn variant="outline" onClick={() => downloadSlPdf(slTarget._id, sl.letterNumber)}>
                                        ⬇ Download PDF
                                    </Btn>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            {/* ── MODAL: Surat Rujukan (Appointment) ── */}
            <Modal open={!!rlTarget} onClose={() => setRlTarget(null)} title="🔀 Surat Rujukan" width={560}>
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


export default SectionJanjiTemu;