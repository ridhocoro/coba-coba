/**
 * frontend/src/pages/Admin/ManageAppointments.js
 *
 * Admin panel untuk janji temu offline:
 *  - Tab: Hari Ini / Semua / Report
 *  - Search/filter (nama, dokter, status, tanggal)
 *  - Manual check-in
 *  - Override status
 *  - Cancel dengan alasan
 *  - Report per hari + no-show rate
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';

// ── Config ────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
    scheduled           : { label: '📅 Terjadwal',          color: '#1d4ed8', bg: '#eff6ff' },
    checked_in          : { label: '✅ Hadir',               color: '#166534', bg: '#dcfce7' },
    completed           : { label: '🏁 Selesai',             color: '#0e7490', bg: '#ecfeff' },
    no_show             : { label: '❌ Tidak Hadir',          color: '#b45309', bg: '#fffbeb' },
    cancelled_by_user   : { label: '🚫 Batal (User)',        color: '#6b7280', bg: '#f3f4f6' },
    cancelled_by_doctor : { label: '🚫 Batal (Dokter)',      color: '#b91c1c', bg: '#fef2f2' },
    cancelled_by_admin  : { label: '🚫 Batal (Admin)',       color: '#b91c1c', bg: '#fef2f2' },
};

const StatusBadge = ({ status }) => {
    const c = STATUS_CFG[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
    return (
        <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}30`, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
            {c.label}
        </span>
    );
};

const fmtDT = (dateStr, timeStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const tgl = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    return timeStr ? `${tgl}, ${timeStr} WIB` : tgl;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
const ManageAppointments = () => {
    const [tab, setTab] = useState('today'); // 'today' | 'all' | 'report'

    // Today tab
    const [todayAppts,    setTodayAppts]    = useState([]);
    const [loadingToday,  setLoadingToday]  = useState(true);
    const [todayDate,     setTodayDate]     = useState('');

    // All tab
    const [allAppts,      setAllAppts]      = useState([]);
    const [loadingAll,    setLoadingAll]    = useState(false);
    const [search,        setSearch]        = useState('');
    const [filterStatus,  setFilterStatus]  = useState('all');
    const [filterDate,    setFilterDate]    = useState('');
    const [doctors,       setDoctors]       = useState([]);
    const [filterDoctor,  setFilterDoctor]  = useState('');

    // Report tab
    const [report,        setReport]        = useState(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [reportFrom,    setReportFrom]    = useState('');
    const [reportTo,      setReportTo]      = useState('');

    // Modals
    const [overrideTarget,   setOverrideTarget]   = useState(null);
    const [overrideStatus,   setOverrideStatus]   = useState('');
    const [overrideReason,   setOverrideReason]   = useState('');
    const [overriding,       setOverriding]       = useState(false);

    const [cancelTarget,     setCancelTarget]     = useState(null);
    const [cancelReason,     setCancelReason]     = useState('');
    const [cancelling,       setCancelling]       = useState(false);

    const [checkinTarget,    setCheckinTarget]    = useState(null);
    const [checkingIn,       setCheckingIn]       = useState(false);

    const [detailTarget,     setDetailTarget]     = useState(null);

    const [processing,       setProcessing]       = useState({});

    useEffect(() => {
        fetchToday();
        fetchDoctorList();
    }, []);

    // ── Fetch today ────────────────────────────────────────────────────────
    const fetchToday = async () => {
        setLoadingToday(true);
        try {
            const r = await api.get('/api/appointments/admin/today');
            setTodayAppts(r.data.appointments || []);
            setTodayDate(r.data.date || '');
        } catch { toast.error('Gagal memuat janji hari ini'); }
        finally { setLoadingToday(false); }
    };

    // ── Fetch all ──────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoadingAll(true);
        try {
            const params = new URLSearchParams();
            if (filterStatus !== 'all') params.append('status', filterStatus);
            if (filterDate) params.append('date', filterDate);
            if (filterDoctor) params.append('doctorId', filterDoctor);
            if (search) params.append('search', search);
            params.append('limit', 100);
            const r = await api.get(`/api/appointments/admin/list?${params}`);
            setAllAppts(r.data.appointments || []);
        } catch { toast.error('Gagal memuat data'); }
        finally { setLoadingAll(false); }
    }, [filterStatus, filterDate, filterDoctor, search]);

    useEffect(() => {
        if (tab === 'all') fetchAll();
    }, [tab, fetchAll]);

    // ── Fetch report ───────────────────────────────────────────────────────
    const fetchReport = async () => {
        setLoadingReport(true);
        try {
            const params = new URLSearchParams();
            if (reportFrom) params.append('from', reportFrom);
            if (reportTo)   params.append('to',   reportTo);
            const r = await api.get(`/api/appointments/admin/report?${params}`);
            setReport(r.data);
        } catch { toast.error('Gagal memuat report'); }
        finally { setLoadingReport(false); }
    };

    useEffect(() => { if (tab === 'report') fetchReport(); }, [tab]);

    const fetchDoctorList = async () => {
        try {
            const r = await api.get('/api/appointments/doctors-with-slots');
            setDoctors(r.data.doctors?.map(d => d.doctor) || []);
        } catch {}
    };

    // ── Check-in ───────────────────────────────────────────────────────────
    const handleCheckin = async () => {
        setCheckingIn(true);
        try {
            await api.put(`/api/appointments/admin/${checkinTarget._id}/checkin`);
            toast.success('Check-in berhasil ✅');
            setCheckinTarget(null);
            fetchToday();
            if (tab === 'all') fetchAll();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal check-in'); }
        finally { setCheckingIn(false); }
    };

    // ── Cancel ─────────────────────────────────────────────────────────────
    const handleCancel = async () => {
        if (!cancelReason.trim() || cancelReason.length < 5) { toast.error('Alasan minimal 5 karakter'); return; }
        setCancelling(true);
        try {
            await api.put(`/api/appointments/admin/${cancelTarget._id}/cancel`, { reason: cancelReason });
            toast.success('Janji dibatalkan');
            setCancelTarget(null);
            setCancelReason('');
            fetchToday();
            if (tab === 'all') fetchAll();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal membatalkan'); }
        finally { setCancelling(false); }
    };

    // ── Override ───────────────────────────────────────────────────────────
    const handleOverride = async () => {
        if (!overrideStatus) { toast.error('Pilih status baru'); return; }
        setOverriding(true);
        try {
            await api.put(`/api/appointments/admin/${overrideTarget._id}/override`, {
                status : overrideStatus,
                reason : overrideReason,
            });
            toast.success('Status berhasil diubah');
            setOverrideTarget(null);
            setOverrideStatus('');
            setOverrideReason('');
            fetchToday();
            if (tab === 'all') fetchAll();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal override'); }
        finally { setOverriding(false); }
    };

    // ── Styles ─────────────────────────────────────────────────────────────
    const s = {
        root  : { minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif", padding: '24px 16px' },
        inner : { maxWidth: 1000, margin: '0 auto' },
        card  : { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 16 },
        label : { color: '#374151', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 },
        sel   : { border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#374151', background: '#fff', cursor: 'pointer' },
        inp   : { border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#374151', outline: 'none', background: '#fff' },
    };

    const tabStyle = (key) => ({
        flex: 1, padding: '10px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
        background: tab === key ? '#fff' : 'transparent',
        color: tab === key ? '#111827' : '#6b7280',
        boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
    });

    return (
        <div style={s.root}>
            <div style={s.inner}>

                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Manajemen Janji Temu</h1>
                    <p style={{ color: '#6b7280', fontSize: 14 }}>Kelola semua janji temu offline di klinik</p>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 24 }}>
                    <button style={tabStyle('today')}  onClick={() => setTab('today')}>📋 Hari Ini</button>
                    <button style={tabStyle('all')}    onClick={() => setTab('all')}>🗂️ Semua</button>
                    <button style={tabStyle('report')} onClick={() => setTab('report')}>📊 Laporan</button>
                </div>

                {/* ═══ TAB: HARI INI ═══════════════════════════════════════ */}
                {tab === 'today' && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>
                                📅 {todayDate ? new Date(todayDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Hari Ini'}
                                <span style={{ marginLeft: 10, background: '#eff6ff', color: '#2563eb', borderRadius: 12, padding: '2px 10px', fontSize: 13 }}>
                                    {todayAppts.length} janji
                                </span>
                            </div>
                            <button onClick={fetchToday} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13 }}>
                                🔄 Refresh
                            </button>
                        </div>

                        {/* Summary hari ini */}
                        {todayAppts.length > 0 && (
                            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                                {Object.entries({
                                    scheduled  : { label: 'Terjadwal', color: '#2563eb' },
                                    checked_in : { label: 'Hadir', color: '#16a34a' },
                                    completed  : { label: 'Selesai', color: '#0e7490' },
                                    no_show    : { label: 'Tidak Hadir', color: '#b45309' },
                                }).map(([key, cfg]) => {
                                    const count = todayAppts.filter(a => a.status === key).length;
                                    if (count === 0) return null;
                                    return (
                                        <div key={key} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '10px 16px', textAlign: 'center', minWidth: 80 }}>
                                            <div style={{ fontSize: 20, fontWeight: 800, color: cfg.color }}>{count}</div>
                                            <div style={{ fontSize: 11, color: '#6b7280' }}>{cfg.label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {loadingToday ? (
                            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Memuat...</div>
                        ) : todayAppts.length === 0 ? (
                            <div style={{ ...s.card, textAlign: 'center', padding: 40 }}>
                                <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
                                <div style={{ color: '#6b7280' }}>Tidak ada janji temu hari ini</div>
                            </div>
                        ) : (
                            todayAppts.map(a => (
                                <ApptRow key={a._id} appt={a}
                                    onCheckin={() => setCheckinTarget(a)}
                                    onCancel={() => { setCancelTarget(a); setCancelReason(''); }}
                                    onOverride={() => { setOverrideTarget(a); setOverrideStatus(''); setOverrideReason(''); }}
                                    onDetail={() => setDetailTarget(a)}
                                />
                            ))
                        )}
                    </>
                )}

                {/* ═══ TAB: SEMUA ════════════════════════════════════════════ */}
                {tab === 'all' && (
                    <>
                        {/* Filter row */}
                        <div style={s.card}>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div style={{ flex: '1 1 180px' }}>
                                    <label style={s.label}>Cari Pasien / Dokter</label>
                                    <input value={search} onChange={e => setSearch(e.target.value)}
                                        placeholder="Nama atau nomor HP..."
                                        style={{ ...s.inp, width: '100%', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={s.label}>Status</label>
                                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={s.sel}>
                                        <option value="all">Semua</option>
                                        {Object.entries(STATUS_CFG).map(([k, v]) => (
                                            <option key={k} value={k}>{v.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={s.label}>Tanggal</label>
                                    <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ ...s.inp }} />
                                </div>
                                <div>
                                    <label style={s.label}>Dokter</label>
                                    <select value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)} style={s.sel}>
                                        <option value="">Semua Dokter</option>
                                        {doctors.map(d => <option key={d._id} value={d._id}>dr. {d.name}</option>)}
                                    </select>
                                </div>
                                <button onClick={fetchAll} style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                                    🔍 Cari
                                </button>
                                <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterDate(''); setFilterDoctor(''); }}
                                    style={{ padding: '9px 14px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13 }}>
                                    Reset
                                </button>
                            </div>
                        </div>

                        <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 10 }}>
                            {loadingAll ? 'Memuat...' : `${allAppts.length} janji ditemukan`}
                        </div>

                        {!loadingAll && allAppts.length === 0 && (
                            <div style={{ ...s.card, textAlign: 'center', padding: 40 }}>
                                <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
                                <div style={{ color: '#6b7280' }}>Tidak ada data yang cocok</div>
                            </div>
                        )}

                        {!loadingAll && allAppts.map(a => (
                            <ApptRow key={a._id} appt={a}
                                onCheckin={a.status === 'scheduled' ? () => setCheckinTarget(a) : null}
                                onCancel={['scheduled','checked_in'].includes(a.status) ? () => { setCancelTarget(a); setCancelReason(''); } : null}
                                onOverride={() => { setOverrideTarget(a); setOverrideStatus(''); setOverrideReason(''); }}
                                onDetail={() => setDetailTarget(a)}
                            />
                        ))}
                    </>
                )}

                {/* ═══ TAB: REPORT ════════════════════════════════════════════ */}
                {tab === 'report' && (
                    <>
                        {/* Filter range */}
                        <div style={s.card}>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div>
                                    <label style={s.label}>Dari Tanggal</label>
                                    <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} style={s.inp} />
                                </div>
                                <div>
                                    <label style={s.label}>Sampai Tanggal</label>
                                    <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} style={s.inp} />
                                </div>
                                <button onClick={fetchReport} style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                                    📊 Generate Report
                                </button>
                            </div>
                        </div>

                        {loadingReport ? (
                            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Memuat laporan...</div>
                        ) : report ? (
                            <>
                                {/* Summary */}
                                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                                    {[
                                        { label: 'Total Janji',   val: report.summary.total,       color: '#2563eb' },
                                        { label: 'Selesai',       val: report.summary.completed,   color: '#16a34a' },
                                        { label: 'Tidak Hadir',   val: report.summary.no_show,     color: '#b45309' },
                                        { label: 'No-Show Rate',  val: `${report.summary.noShowRate}%`, color: report.summary.noShowRate > 20 ? '#ef4444' : '#16a34a' },
                                    ].map(item => (
                                        <div key={item.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px', flex: '1 1 120px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 26, fontWeight: 800, color: item.color }}>{item.val}</div>
                                            <div style={{ fontSize: 12, color: '#6b7280' }}>{item.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Per hari */}
                                <div style={s.card}>
                                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 14 }}>📅 Statistik Per Hari</div>
                                    {Object.keys(report.byDay).length === 0 ? (
                                        <div style={{ color: '#6b7280', fontSize: 13 }}>Tidak ada data</div>
                                    ) : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                <thead>
                                                    <tr style={{ background: '#f9fafb' }}>
                                                        {['Tanggal','Total','Selesai','Tidak Hadir','Dibatalkan','Terjadwal'].map(h => (
                                                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(report.byDay).sort(([a],[b]) => a.localeCompare(b)).map(([day, data]) => (
                                                        <tr key={day} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                            <td style={{ padding: '10px 12px', color: '#374151', fontWeight: 600 }}>
                                                                {new Date(day).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
                                                            </td>
                                                            <td style={{ padding: '10px 12px', color: '#111827', fontWeight: 700 }}>{data.total}</td>
                                                            <td style={{ padding: '10px 12px', color: '#16a34a' }}>{data.completed}</td>
                                                            <td style={{ padding: '10px 12px', color: '#b45309' }}>{data.no_show}</td>
                                                            <td style={{ padding: '10px 12px', color: '#6b7280' }}>{data.cancelled}</td>
                                                            <td style={{ padding: '10px 12px', color: '#2563eb' }}>{data.scheduled}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Per dokter */}
                                <div style={s.card}>
                                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 14 }}>👨‍⚕️ Statistik Per Dokter</div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                            <thead>
                                                <tr style={{ background: '#f9fafb' }}>
                                                    {['Dokter','Total','Selesai','Tidak Hadir','No-Show Rate'].map(h => (
                                                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(report.byDoctor).map(([name, data]) => {
                                                    const rate = data.total > 0 ? Math.round((data.no_show / data.total) * 100) : 0;
                                                    return (
                                                        <tr key={name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                            <td style={{ padding: '10px 12px', color: '#374151', fontWeight: 600 }}>dr. {name}</td>
                                                            <td style={{ padding: '10px 12px', color: '#111827', fontWeight: 700 }}>{data.total}</td>
                                                            <td style={{ padding: '10px 12px', color: '#16a34a' }}>{data.completed}</td>
                                                            <td style={{ padding: '10px 12px', color: '#b45309' }}>{data.no_show}</td>
                                                            <td style={{ padding: '10px 12px', color: rate > 20 ? '#ef4444' : '#16a34a', fontWeight: 600 }}>{rate}%</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ ...s.card, textAlign: 'center', padding: 40, color: '#6b7280' }}>
                                Pilih rentang tanggal dan klik "Generate Report"
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Check-in Modal ──────────────────────────────────────────── */}
            {checkinTarget && (
                <ModalBox onClose={() => setCheckinTarget(null)} title="✅ Manual Check-in">
                    <div style={{ marginBottom: 16, fontSize: 14, color: '#374151' }}>
                        Konfirmasi check-in untuk:<br />
                        <strong>{checkinTarget.userId?.name}</strong> — {checkinTarget.appointmentTime} WIB<br />
                        Dokter: dr. {checkinTarget.doctorId?.name}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setCheckinTarget(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
                        <button onClick={handleCheckin} disabled={checkingIn}
                            style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: checkingIn ? 0.6 : 1 }}>
                            {checkingIn ? '...' : '✅ Konfirmasi Check-in'}
                        </button>
                    </div>
                </ModalBox>
            )}

            {/* ── Cancel Modal ────────────────────────────────────────────── */}
            {cancelTarget && (
                <ModalBox onClose={() => setCancelTarget(null)} title="❌ Batalkan Janji Temu">
                    <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>
                        <strong>{cancelTarget.userId?.name}</strong> — {cancelTarget.appointmentTime} WIB akan dibatalkan (oleh admin).
                    </div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Alasan Pembatalan *</label>
                    <textarea value={cancelReason} rows={3} onChange={e => setCancelReason(e.target.value)}
                        placeholder="Masukkan alasan pembatalan..."
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button onClick={() => setCancelTarget(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
                        <button onClick={handleCancel} disabled={cancelling}
                            style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: cancelling ? 0.6 : 1 }}>
                            {cancelling ? 'Memproses...' : 'Konfirmasi Pembatalan'}
                        </button>
                    </div>
                </ModalBox>
            )}

            {/* ── Override Modal ───────────────────────────────────────────── */}
            {overrideTarget && (
                <ModalBox onClose={() => setOverrideTarget(null)} title="⚙️ Override Status">
                    <div style={{ marginBottom: 14, fontSize: 13, color: '#374151' }}>
                        <strong>{overrideTarget.userId?.name}</strong> — {overrideTarget.appointmentTime} WIB<br />
                        Status saat ini: <StatusBadge status={overrideTarget.status} />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Status Baru *</label>
                        <select value={overrideStatus} onChange={e => setOverrideStatus(e.target.value)}
                            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, background: '#fff' }}>
                            <option value="">— Pilih Status —</option>
                            <option value="scheduled">📅 Terjadwal</option>
                            <option value="checked_in">✅ Hadir</option>
                            <option value="completed">🏁 Selesai</option>
                            <option value="no_show">❌ Tidak Hadir</option>
                            <option value="cancelled_by_admin">🚫 Dibatalkan Admin</option>
                        </select>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Keterangan (opsional)</label>
                        <textarea value={overrideReason} rows={2} onChange={e => setOverrideReason(e.target.value)}
                            placeholder="Alasan perubahan status..."
                            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setOverrideTarget(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
                        <button onClick={handleOverride} disabled={overriding || !overrideStatus}
                            style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: (!overrideStatus || overriding) ? 0.5 : 1 }}>
                            {overriding ? 'Memproses...' : '⚙️ Terapkan Override'}
                        </button>
                    </div>
                </ModalBox>
            )}

            {/* ── Detail Modal ─────────────────────────────────────────────── */}
            {detailTarget && (
                <ModalBox onClose={() => setDetailTarget(null)} title="📋 Detail Janji Temu">
                    <div style={{ fontSize: 13, lineHeight: 2, color: '#374151' }}>
                        <div><strong>Pasien</strong>: {detailTarget.userId?.name}</div>
                        <div><strong>Email</strong>: {detailTarget.userId?.email || '-'}</div>
                        <div><strong>No. HP</strong>: {detailTarget.userId?.phone || '-'}</div>
                        <div><strong>Dokter</strong>: dr. {detailTarget.doctorId?.name} ({detailTarget.doctorId?.specialization})</div>
                        <div><strong>Jadwal</strong>: {fmtDT(detailTarget.appointmentDate, detailTarget.appointmentTime)}</div>
                        <div><strong>Status</strong>: <StatusBadge status={detailTarget.status} /></div>
                        {detailTarget.complaint && <div><strong>Keluhan</strong>: {detailTarget.complaint}</div>}
                        {detailTarget.doctorNotes && <div><strong>Catatan Dokter</strong>: {detailTarget.doctorNotes}</div>}
                        {detailTarget.cancelReason && <div><strong>Alasan Batal</strong>: {detailTarget.cancelReason}</div>}
                        {detailTarget.rescheduledFrom?.appointmentTime && (
                            <div><strong>Di-reschedule dari</strong>: {detailTarget.rescheduledFrom.appointmentTime} WIB</div>
                        )}
                        <div><strong>Dibuat</strong>: {new Date(detailTarget.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</div>
                    </div>
                </ModalBox>
            )}
        </div>
    );
};

// ── ApptRow ──────────────────────────────────────────────────────────────────
const ApptRow = ({ appt, onCheckin, onCancel, onOverride, onDetail }) => (
    <div style={{
        background: '#fff', borderRadius: 12,
        border: `1px solid ${appt.status === 'checked_in' ? '#86efac' : '#e5e7eb'}`,
        padding: '14px 20px', marginBottom: 10,
        borderLeft: `4px solid ${STATUS_CFG[appt.status]?.color || '#e5e7eb'}`,
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{appt.userId?.name || '-'}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>→ dr. {appt.doctorId?.name}</span>
                    <StatusBadge status={appt.status} />
                </div>
                <div style={{ fontSize: 13, color: '#374151' }}>
                    🕐 {fmtDT(appt.appointmentDate, appt.appointmentTime)}
                    {appt.userId?.phone && <span style={{ marginLeft: 10, color: '#6b7280' }}>📞 {appt.userId.phone}</span>}
                </div>
                {appt.complaint && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Keluhan: {appt.complaint}</div>}
                {appt.cancelReason && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>Alasan batal: {appt.cancelReason}</div>}
            </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={onDetail}
                style={{ padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                👁 Detail
            </button>
            {onCheckin && (
                <button onClick={onCheckin}
                    style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    ✅ Check-in
                </button>
            )}
            {onCancel && (
                <button onClick={onCancel}
                    style={{ padding: '6px 12px', background: '#fff', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    ❌ Batalkan
                </button>
            )}
            <button onClick={onOverride}
                style={{ padding: '6px 12px', background: '#fff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ⚙️ Override
            </button>
        </div>
    </div>
);

const ModalBox = ({ children, onClose, title }) => (
    <div style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{title}</span>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            {children}
        </div>
    </div>
);

export default ManageAppointments;