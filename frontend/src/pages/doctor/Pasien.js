import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
// SECTION: PASIEN — Rekam Medis (sub-tab: Konsultasi | Janji Temu)
// ═══════════════════════════════════════════════════════════════════════════════
const SectionPasien = () => {
    const navigate = useNavigate();
    const [patientTab, setPatientTab] = useState('konsultasi');
    const [consultations, setConsultations] = useState([]);
    const [appointments, setAppointments]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [search, setSearch]     = useState('');
    const [selected, setSelected] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [cr, ar] = await Promise.allSettled([
                api.get('/api/consultations/doctor/all'),
                api.get('/api/appointments/doctor/list'),
            ]);
            if (cr.status === 'fulfilled') setConsultations(cr.value.data.consultations || cr.value.data || []);
            if (ar.status === 'fulfilled') setAppointments((ar.value.data.appointments || []).filter(a => a.status === 'completed'));
        } catch { toast.error('Gagal memuat data pasien'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const filteredCons = consultations.filter(c => {
        const q = search.toLowerCase();
        return !search || c.userId?.name?.toLowerCase().includes(q) || c.userId?.phone?.includes(search) || c.symptoms?.toLowerCase().includes(q);
    });

    const filteredAppts = appointments.filter(a => {
        const q = search.toLowerCase();
        return !search || a.userId?.name?.toLowerCase().includes(q) || a.userId?.phone?.includes(search);
    });

    const uniqueCons  = [...new Map(consultations.filter(c => c.userId?._id).map(c => [c.userId._id, c.userId])).values()];
    const uniqueAppts = [...new Map(appointments.filter(a => a.userId?._id).map(a => [a.userId._id, a.userId])).values()];

    return (
        <div>
            <SectionHeader title="Pasien" subtitle={`${uniqueCons.length} pasien konsultasi · ${uniqueAppts.length} pasien janji temu`}
                action={<Btn size="sm" variant="ghost" onClick={loadData}>↻ Refresh</Btn>} />

            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
                {[['konsultasi','🩺 Konsultasi Online'],['janji','📅 Janji Temu']].map(([k, l]) => (
                    <button key={k} onClick={() => setPatientTab(k)} style={{
                        padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
                        cursor: 'pointer', fontFamily: 'inherit',
                        background: patientTab === k ? '#fff' : 'transparent',
                        color: patientTab === k ? colors.text : colors.muted,
                        boxShadow: patientTab === k ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                    }}>{l}</button>
                ))}
            </div>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, nomor HP, atau keluhan..."
                    style={{ padding: '9px 14px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%', maxWidth: 400, boxSizing: 'border-box' }} />
            </div>

            {loading ? <Spinner /> : (
                <>
                    {/* === TAB: KONSULTASI === */}
                    {patientTab === 'konsultasi' && (
                        filteredCons.length === 0 ? <Empty icon="🩺" text="Belum ada data pasien konsultasi" /> : (
                            <Card>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead><tr>{['Pasien', 'Keluhan', 'Tanggal', 'Pesan', 'Surat Sakit', 'Status', 'Aksi'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                                        <tbody>
                                            {filteredCons.map((c, i) => {
                                                const sc = CONS_STATUS[c.status] || { label: c.status, color: '#6b7280', bg: '#f3f4f6' };
                                                return (
                                                    <tr key={c._id} style={{ borderBottom: `1px solid #f8fafc`, background: i % 2 ? '#fafafa' : '#fff' }}>
                                                        <td style={TD}>
                                                            <div style={{ fontWeight: 600, color: colors.text }}>{c.userId?.name}</div>
                                                            <div style={{ fontSize: 11, color: colors.subtle }}>{c.userId?.phone || c.userId?.email}</div>
                                                        </td>
                                                        <td style={{ ...TD, maxWidth: 170, color: colors.muted }}>
                                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(c.symptoms || '—').slice(0, 60)}</div>
                                                        </td>
                                                        <td style={{ ...TD, fontSize: 12, color: colors.subtle, whiteSpace: 'nowrap' }}>{new Date(c.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                                        <td style={{ ...TD, textAlign: 'center' }}>
                                                            <span style={{ background: '#f1f5f9', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '2px 8px', fontSize: 12, color: colors.muted }}>💬 {c.messages?.length || 0}</span>
                                                        </td>
                                                        <td style={TD}>
                                                            {c.sickLetter
                                                                ? <span style={{ background: c.sickLetter.status === 'issued' ? '#dcfce7' : '#fef3c7', color: c.sickLetter.status === 'issued' ? '#166534' : '#92400e', borderRadius: 8, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                                                                    {c.sickLetter.status === 'issued' ? '✓ Terbit' : '📝 Draft'}
                                                                </span>
                                                                : <span style={{ fontSize: 12, color: colors.border }}>—</span>}
                                                        </td>
                                                        <td style={TD}><SBadge status={c.status} map={CONS_STATUS} /></td>
                                                        <td style={TD}><Btn size="sm" variant="ghost" onClick={() => setSelected({ type: 'cons', data: c })}>Detail</Btn></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )
                    )}

                    {/* === TAB: JANJI TEMU (hanya completed) === */}
                    {patientTab === 'janji' && (
                        filteredAppts.length === 0 ? <Empty icon="📅" text="Belum ada rekam medis janji temu" /> : (
                            <Card>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead><tr>{['Pasien', 'Tanggal', 'Jam', 'Keluhan', 'Catatan Dokter', 'Aksi'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                                        <tbody>
                                            {filteredAppts.map((a, i) => (
                                                <tr key={a._id} style={{ borderBottom: `1px solid #f8fafc`, background: i % 2 ? '#fafafa' : '#fff' }}>
                                                    <td style={TD}>
                                                        <div style={{ fontWeight: 600, color: colors.text }}>{a.userId?.name}</div>
                                                        <div style={{ fontSize: 11, color: colors.subtle }}>{a.userId?.phone}</div>
                                                    </td>
                                                    <td style={{ ...TD, whiteSpace: 'nowrap', color: colors.muted }}>{fmtDate(a.appointmentDate)}</td>
                                                    <td style={{ ...TD, fontWeight: 600, color: colors.text }}>{a.appointmentTime}</td>
                                                    <td style={{ ...TD, maxWidth: 160, color: colors.muted }}>
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.complaint || '—'}</div>
                                                    </td>
                                                    <td style={{ ...TD, maxWidth: 200, color: colors.muted }}>
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.notes || <em style={{ color: colors.border }}>Belum ada catatan</em>}</div>
                                                    </td>
                                                    <td style={TD}><Btn size="sm" variant="ghost" onClick={() => setSelected({ type: 'appt', data: a })}>Detail</Btn></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )
                    )}
                </>
            )}

            {/* Modal detail konsultasi */}
            <Modal open={!!(selected?.type === 'cons')} onClose={() => setSelected(null)} title="Detail Rekam Medis Konsultasi" width={600}>
                {selected?.type === 'cons' && (() => { const c = selected.data; return (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                            <div style={{ background: '#f8fafc', borderRadius: 11, padding: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: colors.muted, marginBottom: 8 }}>INFO PASIEN</div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{c.userId?.name}</div>
                                <div style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>{c.userId?.email}</div>
                                <div style={{ fontSize: 12, color: colors.muted }}>{c.userId?.phone || '—'}</div>
                            </div>
                            <div style={{ background: '#f8fafc', borderRadius: 11, padding: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: colors.muted, marginBottom: 8 }}>STATUS</div>
                                <SBadge status={c.status} map={CONS_STATUS} />
                                <div style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>Pesan: {c.messages?.length || 0}</div>
                            </div>
                        </div>
                        <div style={{ background: '#f8fafc', borderRadius: 11, padding: 16, marginBottom: 14 }}>
                            {[
                                ['Keluhan', c.symptoms || '—'],
                                ['Diagnosis', c.medicalRecord?.assessment || c.diagnosis || 'Belum diisi'],
                                ['Temuan Objektif', c.medicalRecord?.objectiveFindings || '—'],
                                ['Rencana Terapi', c.medicalRecord?.plan || '—'],
                                ['Resep', c.prescriptionData ? `${c.prescriptionData.medicines?.length || 0} obat` : (c.prescription || '—')],
                            ].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 13 }}>
                                    <div style={{ width: 130, fontWeight: 600, color: colors.muted, flexShrink: 0 }}>{k}</div>
                                    <div style={{ color: colors.text }}>{v}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <Btn variant="ghost" onClick={() => setSelected(null)}>Tutup</Btn>
                            {['ongoing','in_progress'].includes(c.status) && <Btn variant="primary" onClick={() => { navigate(`/consultations/${c._id}`); setSelected(null); }}>💬 Buka Chat</Btn>}
                            {['completed','no_show'].includes(c.status) && !c.medicalRecord?.isCompleted && (
                                <Btn variant="outline" onClick={() => { navigate(`/consultations/${c._id}`); setSelected(null); }}>📋 Lengkapi Rekam Medis</Btn>
                            )}
                            {c.medicalRecord?.isCompleted && (
                                <Btn variant="ghost" onClick={() => {
                                    const lines = [
                                        `REKAM MEDIS KONSULTASI ONLINE`,
                                        `Klinik Pratama IPB`,
                                        `================================`,
                                        `Pasien    : ${c.userId?.name || '—'}`,
                                        `Email     : ${c.userId?.email || '—'}`,
                                        `Tanggal   : ${fmtDT(c.scheduledAt)}`,
                                        `Tipe      : ${c.consultationType === 'video_call' ? 'Video Call' : 'Chat'}`,
                                        ``,
                                        `ANAMNESIS`,
                                        `Keluhan   : ${c.symptoms || '—'}`,
                                        `Riwayat   : ${c.medicalHistory || '—'}`,
                                        ``,
                                        `PEMERIKSAAN`,
                                        `Objektif  : ${c.medicalRecord?.objectiveFindings || '—'}`,
                                        ``,
                                        `ASSESSMENT & PLAN`,
                                        `Diagnosis : ${c.medicalRecord?.assessment || '—'}`,
                                        `Terapi    : ${c.medicalRecord?.plan || '—'}`,
                                        ``,
                                        c.prescriptionData?.medicines?.length ? [
                                            `RESEP OBAT`,
                                            ...c.prescriptionData.medicines.map((m, i) => `${i+1}. ${m.name} ${m.dose} — ${m.frequency} selama ${m.duration}${m.notes ? ` (${m.notes})` : ''}`),
                                            c.prescriptionData.doctorNotes ? `Catatan: ${c.prescriptionData.doctorNotes}` : '',
                                        ].filter(Boolean).join('\n') : '',
                                    ].filter(v => v !== undefined).join('\n');
                                    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
                                    const url  = URL.createObjectURL(blob);
                                    const a    = document.createElement('a');
                                    a.href = url;
                                    a.download = `rekam-medis-${c.userId?.name?.replace(/\s+/g,'-')}-${c._id.slice(-6)}.txt`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}>⬇ Export TXT</Btn>
                            )}
                        </div>
                    </div>
                ); })()}
            </Modal>

            {/* Modal detail janji temu */}
            <Modal open={!!(selected?.type === 'appt')} onClose={() => setSelected(null)} title="Detail Rekam Medis Janji Temu">
                {selected?.type === 'appt' && (() => { const a = selected.data; return (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                            <div style={{ background: '#f8fafc', borderRadius: 11, padding: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: colors.muted, marginBottom: 8 }}>INFO PASIEN</div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{a.userId?.name}</div>
                                <div style={{ fontSize: 12, color: colors.muted }}>{a.userId?.phone}</div>
                            </div>
                            <div style={{ background: '#f8fafc', borderRadius: 11, padding: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: colors.muted, marginBottom: 8 }}>JADWAL</div>
                                <div style={{ fontSize: 13, color: colors.text }}>{fmtDate(a.appointmentDate)}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: colors.primary }}>{a.appointmentTime} WIB</div>
                            </div>
                        </div>
                        <div style={{ background: '#f8fafc', borderRadius: 11, padding: 16 }}>
                            {[
                                ['Keluhan', a.complaint || '—'],
                                ['Catatan Dokter', a.notes || 'Belum ada catatan'],
                                ['Alasan Batal', a.cancelReason || '—'],
                            ].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 13 }}>
                                    <div style={{ width: 130, fontWeight: 600, color: colors.muted, flexShrink: 0 }}>{k}</div>
                                    <div style={{ color: colors.text }}>{v}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                            <Btn variant="ghost" onClick={() => setSelected(null)}>Tutup</Btn>
                            {a.medicalRecord?.isCompleted && (
                                <Btn variant="ghost" onClick={() => {
                                    const mr = a.medicalRecord;
                                    const lines = [
                                        `REKAM MEDIS JANJI TEMU`,
                                        `Klinik Pratama IPB`,
                                        `================================`,
                                        `Pasien    : ${a.userId?.name || '—'}`,
                                        `Telepon   : ${a.userId?.phone || '—'}`,
                                        `Tanggal   : ${fmtDate(a.appointmentDate)} · ${a.appointmentTime} WIB`,
                                        ``,
                                        `ANAMNESIS`,
                                        `Keluhan   : ${a.complaint || '—'}`,
                                        ``,
                                        `PEMERIKSAAN`,
                                        `Objektif  : ${mr?.objectiveFindings || '—'}`,
                                        ``,
                                        `ASSESSMENT & PLAN`,
                                        `Diagnosis : ${mr?.assessment || '—'}`,
                                        `Terapi    : ${mr?.plan || '—'}`,
                                        `Catatan   : ${mr?.doctorNotes || '—'}`,
                                    ].join('\n');
                                    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
                                    const url  = URL.createObjectURL(blob);
                                    const el   = document.createElement('a');
                                    el.href = url;
                                    el.download = `rekam-medis-janji-${a.userId?.name?.replace(/\s+/g,'-')}-${a._id.slice(-6)}.txt`;
                                    el.click();
                                    URL.revokeObjectURL(url);
                                }}>⬇ Export TXT</Btn>
                            )}
                        </div>
                    </div>
                ); })()}
            </Modal>
        </div>
    );
};



export default SectionPasien;