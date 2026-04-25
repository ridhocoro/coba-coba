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
// SECTION: JANJI TEMU
// ═══════════════════════════════════════════════════════════════════════════════
const SectionJanjiTemu = ({ socketRef }) => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [dateFilter, setDateFilter]   = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [processing, setProcessing] = useState({});
    const [completeTarget, setCompleteTarget] = useState(null);
    const [completeNotes, setCompleteNotes]   = useState('');
    const [completeAssessment, setCompleteAssessment] = useState('');
    const [completePlan, setCompletePlan]     = useState('');
    const [completing, setCompleting]         = useState(false);
    const [cancelTarget, setCancelTarget]     = useState(null);
    const [cancelReason, setCancelReason]     = useState('');
    const [cancelling, setCancelling]         = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateFilter) params.date = dateFilter;
            if (statusFilter !== 'all') params.status = statusFilter;
            const r = await api.get('/api/appointments/doctor/list', { params });
            setAppointments(r.data.appointments || []);
        } catch { toast.error('Gagal memuat janji temu'); }
        finally { setLoading(false); }
    }, [dateFilter, statusFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

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
            setCompleteNotes('');
            setCompleteAssessment('');
            setCompletePlan('');
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

    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    const todayStr   = new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
    const todayCount = appointments.filter(a => {
        if (!a.appointmentDate) return false;
        return new Date(new Date(a.appointmentDate).getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10) === todayStr;
    }).length;

    return (
        <div>
            <SectionHeader title="Janji Temu" subtitle="Kelola jadwal janji temu pasien klinik"
                action={<Btn size="sm" variant="ghost" onClick={fetchData}>↻ Refresh</Btn>} />

            {/* Stats */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
                {[
                    { label: 'Hari Ini',     val: todayCount,                                                   color: '#7c3aed' },
                    { label: 'Terjadwal',    val: appointments.filter(a => a.status === 'scheduled').length,    color: '#2563eb' },
                    { label: 'Sudah Hadir',  val: appointments.filter(a => a.status === 'checked_in').length,   color: '#059669' },
                ].map(s => (
                    <Card key={s.label} style={{ padding: '14px 20px', flex: '1 1 110px' }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>{s.label}</div>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card style={{ padding: '14px 18px', marginBottom: 18 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.muted, marginBottom: 5 }}>Tanggal</label>
                        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                            style={{ padding: '7px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.muted, marginBottom: 5 }}>Status</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                            style={{ padding: '7px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
                            <option value="all">Semua Status</option>
                            {Object.entries(APPT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </div>
                    <Btn size="sm" variant="ghost" onClick={() => { setDateFilter(''); setStatusFilter('all'); }}>Reset</Btn>
                </div>
            </Card>

            {loading ? <Spinner /> : appointments.length === 0 ? <Empty icon="📅" text="Tidak ada janji temu" /> : (
                <Card>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>{['Pasien', 'Tanggal', 'Jam', 'Keluhan', 'Status', 'Aksi'].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {appointments.map((a, i) => {
                                    const proc = processing[a._id];
                                    
                                    // ── LOGIKA VALIDASI WAKTU CHECK-IN ──
                                    let isTime = true;
                                    if (a.appointmentDate && a.appointmentTime) {
                                        const dt = new Date(a.appointmentDate);
                                        const [h, m] = a.appointmentTime.split(':').map(Number);
                                        dt.setHours(h, m, 0, 0);
                                        // Mencegah check-in jika jadwal > 30 menit dari sekarang
                                        if ((dt.getTime() - Date.now()) > 30 * 60000) {
                                            isTime = false;
                                        }
                                    }

                                    const canCI    = a.status === 'scheduled';
                                    const canComp  = a.status === 'checked_in';
                                    const canCancl = a.status === 'scheduled' && (new Date(a.scheduledAt || a.appointmentDate).getTime() - Date.now() > 24 * 3600000);
                                    const accent   = APPT_STATUS[a.status]?.color || colors.border;
                                    
                                    return (
                                        <tr key={a._id} style={{ borderBottom: `1px solid #f8fafc`, background: i % 2 ? '#fafafa' : '#fff', borderLeft: `3px solid ${accent}` }}>
                                            <td style={TD}>
                                                <div style={{ fontWeight: 600, color: colors.text }}>{a.userId?.name}</div>
                                                <div style={{ fontSize: 11, color: colors.subtle }}>{a.userId?.phone}</div>
                                            </td>
                                            <td style={{ ...TD, whiteSpace: 'nowrap', color: colors.muted }}>{fmtDate(a.appointmentDate)}</td>
                                            <td style={{ ...TD, fontWeight: 700, color: colors.text, whiteSpace: 'nowrap' }}>{a.appointmentTime}</td>
                                            <td style={{ ...TD, color: colors.muted, maxWidth: 160 }}>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.complaint || '—'}</div>
                                                {a.cancelReason && <div style={{ fontSize: 11, color: colors.danger }}>Alasan: {a.cancelReason}</div>}
                                            </td>
                                            <td style={TD}><SBadge status={a.status} map={APPT_STATUS} /></td>
                                            <td style={TD}>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    {canCI && (
                                                        <Btn size="sm" variant="success" 
                                                             disabled={!!proc || !isTime} 
                                                             onClick={() => doCheckin(a._id)}
                                                             title={!isTime ? "Hanya bisa check-in 30 menit sebelum jadwal" : "Mulai sesi"}>
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

            {/* Complete modal — rekam medis wajib */}
            <Modal open={!!completeTarget} onClose={() => setCompleteTarget(null)} title="🏁 Selesaikan Janji Temu">
                <p style={{ margin: '0 0 14px', color: colors.muted, fontSize: 14 }}>
                    Pasien: <strong>{completeTarget?.userId?.name}</strong> — pukul <strong>{completeTarget?.appointmentTime}</strong>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text }}>
                            Pemeriksaan Fisik / Temuan Objektif <span style={{ color: colors.muted, fontWeight: 400 }}>(opsional)</span>
                        </label>
                        <textarea value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} rows={2}
                            placeholder="Tekanan darah, suhu, temuan fisik..."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text }}>
                            Diagnosis <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea value={completeAssessment} onChange={e => setCompleteAssessment(e.target.value)} rows={2}
                            placeholder="Contoh: ISPA ringan, Gastritis akut..."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${!completeAssessment.trim() ? '#fca5a5' : colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.text }}>
                            Rencana Terapi / Tindakan <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea value={completePlan} onChange={e => setCompletePlan(e.target.value)} rows={2}
                            placeholder="Contoh: Pemberian antibiotik amoxicillin 3x500mg, istirahat 3 hari..."
                            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${!completePlan.trim() ? '#fca5a5' : colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
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

            {/* Cancel modal */}
            <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="❌ Batalkan Janji Temu">
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#b91c1c' }}>
                    <strong>{cancelTarget?.userId?.name}</strong> — pukul {cancelTarget?.appointmentTime}
                </div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: colors.text }}>Alasan Pembatalan *</label>
                <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
                    placeholder="Masukkan alasan pembatalan (min 5 karakter)..."
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 18 }} />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <Btn variant="ghost" onClick={() => setCancelTarget(null)}>Batal</Btn>
                    <Btn variant="danger" onClick={doCancel} disabled={cancelling}>{cancelling ? '…' : 'Konfirmasi Batalkan'}</Btn>
                </div>
            </Modal>
        </div>
    );
};

export default SectionJanjiTemu;