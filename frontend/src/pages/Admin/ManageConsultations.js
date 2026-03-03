import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import {
    FaSearch, FaFilter, FaSync, FaEye, FaTimes,
    FaCheckCircle, FaTimesCircle, FaClock, FaUserMd,
    FaUser, FaCalendarAlt, FaMoneyBillWave, FaFileMedical,
    FaPlay, FaStop, FaBan, FaDownload, FaExclamationTriangle
} from 'react-icons/fa';

const STATUS_CFG = {
    draft:            { bg: '#f1f5f9', color: '#475569', label: 'Draft' },
    pending_payment:  { bg: '#fef3c7', color: '#b45309', label: 'Menunggu Bayar' },
    paid:             { bg: '#dbeafe', color: '#1e40af', label: 'Sudah Bayar' },
    scheduled:        { bg: '#ede9fe', color: '#6d28d9', label: 'Terjadwal' },
    ongoing:          { bg: '#dcfce7', color: '#166534', label: 'Berlangsung' },
    completed:        { bg: '#cffafe', color: '#0e7490', label: 'Selesai' },
    cancelled:        { bg: '#fee2e2', color: '#b91c1c', label: 'Dibatalkan' },
    expired:          { bg: '#f1f5f9', color: '#64748b', label: 'Kadaluarsa' },
    rejected_payment: { bg: '#fee2e2', color: '#b91c1c', label: 'Bayar Ditolak' },
    no_show:          { bg: '#fef3c7', color: '#b45309', label: 'Tidak Hadir' },
};

const StatusBadge = ({ status }) => {
    const c = STATUS_CFG[status] || STATUS_CFG.draft;
    return (
        <span style={{
            background: c.bg,
            color: c.color,
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'inline-block',
            whiteSpace: 'nowrap'
        }}>
            {c.label}
        </span>
    );
};

const fmtDate = (d) => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const fmtRupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

const ManageConsultations = () => {
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selected, setSelected] = useState(null);
    const [showDetail, setShowDetail] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const r = await api.get('/api/admin/consultations');
            setConsultations(r.data || []);
        } catch { toast.error('Gagal memuat konsultasi'); }
        finally { setLoading(false); }
    };

    const handleAction = async (action, consultationId, extraData = {}) => {
        setProcessing(true);
        try {
            const map = {
                'mark-paid':       () => api.put(`/api/consultations/${consultationId}/mark-paid`),
                'reject-payment':  () => api.put(`/api/consultations/${consultationId}/reject-payment`, extraData),
                'start':           () => api.put(`/api/consultations/${consultationId}/start`),
                'end':             () => api.put(`/api/consultations/${consultationId}/end`),
                'no-show':         () => api.put(`/api/consultations/${consultationId}/no-show`, extraData),
                'cancel':          () => api.put(`/api/consultations/${consultationId}/cancel`, extraData),
            };
            if (!map[action]) return;
            await map[action]();
            toast.success('Berhasil diproses');
            setShowDetail(false);
            setShowRejectForm(false);
            setRejectReason('');
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal memproses');
        } finally { setProcessing(false); }
    };

    const downloadPDF = async (c) => {
        try {
            const r = await api.get(`/api/consultations/${c._id}/sick-letter/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([r.data]));
            const a = document.createElement('a'); a.href = url; a.download = `surat-sakit-${c._id}.pdf`;
            document.body.appendChild(a); a.click(); a.remove();
        } catch { toast.error('Surat sakit belum tersedia'); }
    };

    const filtered = consultations.filter(c => {
        const q = search.toLowerCase();
        const matchSearch = !search
            || c.userId?.name?.toLowerCase().includes(q)
            || c.doctorId?.name?.toLowerCase().includes(q)
            || c.symptoms?.toLowerCase().includes(q);
        return matchSearch && (filterStatus === 'all' || c.status === filterStatus);
    });

    const stats = {
        pending_payment: consultations.filter(c => c.status === 'pending_payment').length,
        ongoing: consultations.filter(c => c.status === 'ongoing').length,
        scheduled: consultations.filter(c => c.status === 'scheduled').length,
        completed: consultations.filter(c => c.status === 'completed').length,
        total: consultations.length
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                <p style={{ marginTop: 16, color: '#64748b' }}>Memuat data konsultasi...</p>
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: '24px' }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            
            <style>{`
                .page-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 24px;
                    flex-wrap: wrap;
                    gap: 16px;
                }
                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .header-icon {
                    width: 44px;
                    height: 44px;
                    background: #dbeafe;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #2563eb;
                }
                .header-title h1 {
                    font-size: 24px;
                    font-weight: 600;
                    color: #0f172a;
                    margin-bottom: 4px;
                }
                .header-title p {
                    font-size: 14px;
                    color: #64748b;
                    margin-bottom: 0;
                }
                .stats-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                    transition: all 0.2s ease;
                    cursor: pointer;
                }
                .stats-card:hover {
                    box-shadow: 0 8px 16px -4px rgba(0,0,0,0.05);
                    transform: translateY(-2px);
                }
                .stats-value {
                    font-size: 32px;
                    font-weight: 600;
                    color: #0f172a;
                }
                .stats-label {
                    font-size: 14px;
                    color: #64748b;
                }
                .search-container {
                    position: relative;
                    width: 100%;
                }
                .search-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8;
                    font-size: 14px;
                }
                .search-input {
                    width: 100%;
                    padding: 10px 16px 10px 40px;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 14px;
                    background: #ffffff;
                }
                .search-input:focus {
                    outline: none;
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
                }
                .filter-select {
                    padding: 10px 16px;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 14px;
                    background: #ffffff;
                    width: 100%;
                }
                .filter-select:focus {
                    outline: none;
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
                }
                .table-container {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    overflow: hidden;
                    margin-top: 24px;
                }
                .table-container table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .table-container th {
                    background: #f8fafc;
                    padding: 16px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #475569;
                    text-align: left;
                    border-bottom: 1px solid #e2e8f0;
                }
                .table-container td {
                    padding: 16px;
                    font-size: 14px;
                    color: #0f172a;
                    border-bottom: 1px solid #e2e8f0;
                    vertical-align: middle;
                }
                .table-container tr:last-child td {
                    border-bottom: none;
                }
                .table-container tbody tr {
                    transition: background 0.2s ease;
                }
                .table-container tbody tr:hover {
                    background: #f8fafc;
                }
                .action-btn {
                    padding: 6px 12px;
                    border-radius: 8px;
                    border: none;
                    background: #dbeafe;
                    color: #2563eb;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                .action-btn:hover {
                    background: #bfdbfe;
                }
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.3);
                    z-index: 9999;
                    display: flex;
                    align-items: flex-start;
                    justify-content: flex-end;
                }
                .modal-sidebar {
                    background: #ffffff;
                    border-left: 1px solid #e2e8f0;
                    width: 100%;
                    max-width: 520px;
                    height: 100vh;
                    overflow-y: auto;
                    padding: 24px;
                    box-shadow: -4px 0 20px rgba(0,0,0,0.05);
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .modal-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #0f172a;
                    margin: 0;
                }
                .modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: #94a3b8;
                    cursor: pointer;
                }
                .modal-close:hover {
                    color: #475569;
                }
                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #f1f5f9;
                }
                .detail-label {
                    color: #64748b;
                    font-size: 13px;
                }
                .detail-value {
                    color: #0f172a;
                    font-size: 13px;
                    font-weight: 500;
                    text-align: right;
                }
                .section-title {
                    color: #475569;
                    font-size: 12px;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                .content-box {
                    background: #f8fafc;
                    border-radius: 10px;
                    padding: 12px;
                    font-size: 13px;
                    color: #0f172a;
                }
                .action-button {
                    padding: 10px;
                    border-radius: 10px;
                    border: none;
                    font-weight: 600;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }
                .action-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .btn-primary {
                    background: #2563eb;
                    color: white;
                }
                .btn-primary:hover:not(:disabled) {
                    background: #1d4ed8;
                }
                .btn-success {
                    background: #16a34a;
                    color: white;
                }
                .btn-success:hover:not(:disabled) {
                    background: #15803d;
                }
                .btn-danger {
                    background: #b91c1c;
                    color: white;
                }
                .btn-danger:hover:not(:disabled) {
                    background: #991b1b;
                }
                .btn-warning {
                    background: #b45309;
                    color: white;
                }
                .btn-warning:hover:not(:disabled) {
                    background: #9a3412;
                }
                .btn-outline {
                    background: transparent;
                    border: 1px solid #e2e8f0;
                    color: #475569;
                }
                .btn-outline:hover:not(:disabled) {
                    background: #f1f5f9;
                }
                .reject-form {
                    background: #fef3c7;
                    border: 1px solid #fde68a;
                    border-radius: 12px;
                    padding: 16px;
                }
                .deadline-warning {
                    color: #b45309;
                }
                .deadline-expired {
                    color: #b91c1c;
                }
            `}</style>

            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                {/* Header */}
                <div className="page-header">
                    <div className="header-left">
                        <div className="header-icon">
                            <FaFileMedical size={24} />
                        </div>
                        <div className="header-title">
                            <h1>Kelola Konsultasi</h1>
                            <p>Verifikasi pembayaran & pantau status konsultasi</p>
                        </div>
                    </div>
                    <button className="action-btn" onClick={fetchData} style={{ padding: '8px 16px' }}>
                        <FaSync /> Refresh
                    </button>
                </div>

                {/* Stats Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                    <div className="stats-card" onClick={() => setFilterStatus('pending_payment')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ color: '#b45309', fontSize: 14 }}>Menunggu Bayar</div>
                            <FaMoneyBillWave style={{ color: '#b45309', opacity: 0.5 }} size={20} />
                        </div>
                        <div className="stats-value">{stats.pending_payment}</div>
                        <div className="stats-label">Perlu verifikasi</div>
                    </div>
                    <div className="stats-card" onClick={() => setFilterStatus('ongoing')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ color: '#166534', fontSize: 14 }}>Berlangsung</div>
                            <FaPlay style={{ color: '#166534', opacity: 0.5 }} size={20} />
                        </div>
                        <div className="stats-value">{stats.ongoing}</div>
                        <div className="stats-label">Aktif</div>
                    </div>
                    <div className="stats-card" onClick={() => setFilterStatus('scheduled')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ color: '#6d28d9', fontSize: 14 }}>Terjadwal</div>
                            <FaCalendarAlt style={{ color: '#6d28d9', opacity: 0.5 }} size={20} />
                        </div>
                        <div className="stats-value">{stats.scheduled}</div>
                        <div className="stats-label">Menunggu mulai</div>
                    </div>
                    <div className="stats-card" onClick={() => setFilterStatus('completed')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ color: '#0e7490', fontSize: 14 }}>Selesai</div>
                            <FaCheckCircle style={{ color: '#0e7490', opacity: 0.5 }} size={20} />
                        </div>
                        <div className="stats-value">{stats.completed}</div>
                        <div className="stats-label">Telah dilayani</div>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, marginBottom: 16 }}>
                    <div className="search-container">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Cari pasien, dokter, atau keluhan..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 180 }}>
                        <option value="all">Semua Status</option>
                        {Object.entries(STATUS_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                    </select>
                </div>

                {/* Table */}
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Pasien</th>
                                <th>Dokter</th>
                                <th>Tipe</th>
                                <th>Status</th>
                                <th>Dibuat</th>
                                <th>Batas Bayar</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px' }}>
                                        <div style={{ width: 60, height: 60, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                            <FaFileMedical size={24} style={{ color: '#94a3b8' }} />
                                        </div>
                                        <h6 style={{ fontWeight: 600, marginBottom: 4 }}>Tidak ada konsultasi</h6>
                                        <p style={{ color: '#64748b', fontSize: 13 }}>Belum ada data konsultasi</p>
                                    </td>
                                </tr>
                            ) : filtered.map(c => (
                                <tr key={c._id}>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{c.userId?.name || '-'}</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>{c.userId?.email || '-'}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>dr. {c.doctorId?.name || '-'}</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>{c.doctorId?.specialization || '-'}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: 13 }}>
                                            {c.consultationType === 'chat' ? '💬 Chat' : c.consultationType === 'voice_call' ? '📞 Voice' : '📹 Video'}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>
                                            {c.scheduleType === 'scheduled' ? 'Terjadwal' : '⚡ Instant'}
                                        </div>
                                    </td>
                                    <td><StatusBadge status={c.status} /></td>
                                    <td style={{ fontSize: 13, color: '#475569' }}>{fmtDate(c.createdAt)}</td>
                                    <td>
                                        {c.paymentDeadline ? (
                                            <span style={{
                                                fontSize: 12,
                                                color: new Date(c.paymentDeadline) < new Date() ? '#b91c1c' : '#b45309',
                                                fontWeight: 500
                                            }}>
                                                {new Date(c.paymentDeadline) < new Date() ? '⚠️ ' : ''}
                                                {fmtDate(c.paymentDeadline)}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            className="action-btn"
                                            onClick={() => { setSelected(c); setShowRejectForm(false); setShowDetail(true); }}
                                        >
                                            <FaEye size={12} /> Detail
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal - Sidebar */}
            {showDetail && selected && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowDetail(false); }}>
                    <div className="modal-sidebar">
                        <div className="modal-header">
                            <h5 className="modal-title">Detail Konsultasi</h5>
                            <button className="modal-close" onClick={() => setShowDetail(false)}>×</button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <StatusBadge status={selected.status} />
                            <span style={{ color: '#64748b', fontSize: 12 }}>ID: {selected._id.slice(-8)}</span>
                        </div>

                        {/* Informasi Pasien & Dokter */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <FaUser style={{ color: '#2563eb' }} size={12} />
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>PASIEN</span>
                                </div>
                                <div style={{ fontWeight: 500, fontSize: 13 }}>{selected.userId?.name || '-'}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{selected.userId?.email || '-'}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{selected.userId?.phone || '-'}</div>
                            </div>
                            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <FaUserMd style={{ color: '#166534' }} size={12} />
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>DOKTER</span>
                                </div>
                                <div style={{ fontWeight: 500, fontSize: 13 }}>dr. {selected.doctorId?.name || '-'}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{selected.doctorId?.specialization || '-'}</div>
                            </div>
                        </div>

                        {/* Detail Informasi */}
                        <div style={{ marginBottom: 16 }}>
                            <div className="section-title">INFORMASI KONSULTASI</div>
                            {[
                                ['Tipe Konsultasi', selected.consultationType === 'chat' ? 'Chat' : selected.consultationType === 'voice_call' ? 'Voice Call' : 'Video Call'],
                                ['Jenis Jadwal', selected.scheduleType === 'instant' ? 'Instant' : 'Terjadwal'],
                                ...(selected.scheduledAt ? [['Waktu Jadwal', fmtDate(selected.scheduledAt)]] : []),
                                ['Tanggal Dibuat', fmtDate(selected.createdAt)],
                                ...(selected.paymentDeadline ? [['Batas Pembayaran', fmtDate(selected.paymentDeadline)]] : []),
                                ['Biaya', fmtRupiah(selected.doctorId?.consultationFee)],
                            ].map(([k, v]) => (
                                <div key={k} className="detail-row">
                                    <span className="detail-label">{k}</span>
                                    <span className="detail-value">{v}</span>
                                </div>
                            ))}
                        </div>

                        {/* Keluhan */}
                        {selected.symptoms && (
                            <div style={{ marginBottom: 16 }}>
                                <div className="section-title">KELUHAN</div>
                                <div className="content-box">{selected.symptoms}</div>
                            </div>
                        )}

                        {/* Resep */}
                        {selected.prescription && (
                            <div style={{ marginBottom: 16 }}>
                                <div className="section-title">RESEP</div>
                                <div style={{ background: '#dcfce7', borderRadius: 10, padding: 12, color: '#166534', fontSize: 13 }}>
                                    {selected.prescription}
                                </div>
                            </div>
                        )}

                        {/* Rating */}
                        {selected.rating && (
                            <div style={{ marginBottom: 16 }}>
                                <div className="section-title">RATING PASIEN</div>
                                <div className="content-box">
                                    <span style={{ color: '#b45309' }}>{'⭐'.repeat(selected.rating)}</span>
                                    {selected.ratingComment && <span> — "{selected.ratingComment}"</span>}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ marginTop: 24 }}>
                            <div className="section-title" style={{ marginBottom: 12 }}>TINDAKAN ADMIN</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                                {/* Verifikasi Pembayaran */}
                                {selected.status === 'pending_payment' && (
                                    <>
                                        {!showRejectForm ? (
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    className="action-button btn-success"
                                                    style={{ flex: 1 }}
                                                    onClick={() => handleAction('mark-paid', selected._id)}
                                                    disabled={processing}
                                                >
                                                    <FaCheckCircle /> Verifikasi
                                                </button>
                                                <button
                                                    className="action-button btn-danger"
                                                    style={{ flex: 1 }}
                                                    onClick={() => setShowRejectForm(true)}
                                                >
                                                    <FaTimesCircle /> Tolak
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="reject-form">
                                                <div style={{ fontSize: 13, fontWeight: 600, color: '#b45309', marginBottom: 8 }}>
                                                    Alasan Penolakan
                                                </div>
                                                <textarea
                                                    value={rejectReason}
                                                    onChange={e => setRejectReason(e.target.value)}
                                                    rows={2}
                                                    placeholder="Contoh: Bukti transfer tidak valid..."
                                                    style={{ width: '100%', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}
                                                />
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button
                                                        className="action-button btn-outline"
                                                        style={{ flex: 1 }}
                                                        onClick={() => setShowRejectForm(false)}
                                                    >
                                                        Batal
                                                    </button>
                                                    <button
                                                        className="action-button btn-danger"
                                                        style={{ flex: 1 }}
                                                        onClick={() => handleAction('reject-payment', selected._id, { reason: rejectReason })}
                                                        disabled={processing || !rejectReason}
                                                    >
                                                        Konfirmasi
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Mulai Konsultasi */}
                                {['paid', 'scheduled'].includes(selected.status) && (
                                    <button
                                        className="action-button btn-primary"
                                        onClick={() => handleAction('start', selected._id)}
                                        disabled={processing}
                                    >
                                        <FaPlay /> Mulai Konsultasi
                                    </button>
                                )}

                                {/* Tandai Tidak Hadir */}
                                {selected.status === 'scheduled' && (
                                    <button
                                        className="action-button btn-warning"
                                        onClick={() => handleAction('no-show', selected._id, { reason: 'Ditandai no-show oleh admin' })}
                                        disabled={processing}
                                    >
                                        <FaBan /> Tandai Tidak Hadir
                                    </button>
                                )}

                                {/* Akhiri Konsultasi */}
                                {selected.status === 'ongoing' && (
                                    <button
                                        className="action-button btn-warning"
                                        onClick={() => handleAction('end', selected._id)}
                                        disabled={processing}
                                    >
                                        <FaStop /> Akhiri Konsultasi
                                    </button>
                                )}

                                {/* Batalkan Konsultasi */}
                                {['pending_payment', 'paid', 'scheduled'].includes(selected.status) && (
                                    <button
                                        className="action-button btn-danger"
                                        onClick={() => handleAction('cancel', selected._id, { reason: 'Dibatalkan oleh admin' })}
                                        disabled={processing}
                                    >
                                        <FaTimesCircle /> Batalkan Konsultasi
                                    </button>
                                )}

                                {/* Download Surat Sakit */}
                                {selected.sickLetter?.status === 'issued' && (
                                    <button
                                        className="action-button btn-outline"
                                        onClick={() => downloadPDF(selected)}
                                    >
                                        <FaDownload /> Unduh Surat Sakit
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageConsultations;