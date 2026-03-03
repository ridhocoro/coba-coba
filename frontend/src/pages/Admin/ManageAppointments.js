import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../utils/api';
import {
    Container, Row, Col, Card, Table, Badge, Button,
    InputGroup, Form, Modal, Spinner, Alert
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
    FaCalendarAlt, FaSearch, FaFilter, FaArrowLeft,
    FaEye, FaCheckCircle, FaTimesCircle,
    FaUser, FaUserMd, FaClock, FaSync,
    FaPhone, FaEnvelope, FaMapMarkerAlt, FaNotesMedical,
    FaUserCheck, FaUserTimes, FaExclamationTriangle
} from 'react-icons/fa';

/* ─────────────────────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
    pending:    { bg: '#fef3c7', color: '#b45309', label: 'Menunggu'      },
    confirmed:  { bg: '#dcfce7', color: '#166534', label: 'Dikonfirmasi'  },
    checked_in: { bg: '#dbeafe', color: '#1e40af', label: 'Hadir ✓'      },
    completed:  { bg: '#cffafe', color: '#0e7490', label: 'Selesai'       },
    rejected:   { bg: '#fee2e2', color: '#b91c1c', label: 'Ditolak'       },
    cancelled:  { bg: '#f1f5f9', color: '#475569', label: 'Dibatalkan'    },
};

/* ─────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────── */
const ManageAppointments = () => {

    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [processingId, setProcessingId] = useState(null);

    // Filter
    const [search, setSearch]             = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // Modals
    const [selected, setSelected]               = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason]       = useState('');

    /* ─────────────────────────────────────────────────────
       FETCH  — useCallback agar stabil di dependency array
    ───────────────────────────────────────────────────── */
    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/admin/appointments');
            setAppointments(res.data || []);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Gagal memuat data janji temu');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    /* ─────────────────────────────────────────────────────
       MODAL HELPERS
    ───────────────────────────────────────────────────── */
    const resetModals = useCallback(() => {
        setShowDetailModal(false);
        setShowCancelModal(false);
        setCancelReason('');
        setSelected(null);
    }, []);

    const openDetail = useCallback((apt) => {
        setSelected(apt);
        setShowDetailModal(true);
    }, []);

    const openCancel = useCallback((apt) => {
        setSelected(apt);
        setCancelReason('');
        setShowCancelModal(true);
        setShowDetailModal(false);
    }, []);

    /* ─────────────────────────────────────────────────────
       ACTIONS
    ───────────────────────────────────────────────────── */

    const handleCheckIn = useCallback(async (id) => {
        if (!window.confirm('Konfirmasi pasien sudah hadir?')) return;
        setProcessingId(id);
        try {
            await api.put(`/api/admin/appointments/${id}/check-in`);
            setAppointments(prev =>
                prev.map(a => a._id === id ? { ...a, status: 'checked_in', checkedInAt: new Date() } : a)
            );
            setSelected(prev => prev?._id === id ? { ...prev, status: 'checked_in' } : prev);
            toast.success('Pasien berhasil di-check-in');
            setShowDetailModal(false);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Gagal melakukan check-in');
        } finally {
            setProcessingId(null);
        }
    }, []);

    // Konfirmasi — optimistic update langsung tanpa full refetch
    const handleConfirm = useCallback(async (id) => {
        if (!window.confirm('Konfirmasi janji temu ini?')) return;
        setProcessingId(id);
        try {
            await api.put(`/api/admin/appointments/${id}/confirm`);

            setAppointments(prev =>
                prev.map(a => a._id === id ? { ...a, status: 'confirmed' } : a)
            );
            // Sync jika modal detail sedang terbuka
            setSelected(prev =>
                prev?._id === id ? { ...prev, status: 'confirmed' } : prev
            );

            toast.success('Janji temu berhasil dikonfirmasi');
            setShowDetailModal(false);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Gagal mengkonfirmasi janji temu');
        } finally {
            setProcessingId(null);
        }
    }, []);

    // Batalkan — optimistic update + reason
    const handleCancel = useCallback(async () => {
        if (!selected) return;
        setProcessingId(selected._id);
        try {
            await api.put(
                `/api/admin/appointments/${selected._id}/cancel`,
                { reason: cancelReason }
            );

            setAppointments(prev =>
                prev.map(a =>
                    a._id === selected._id
                        ? { ...a, status: 'cancelled', rejectionReason: cancelReason }
                        : a
                )
            );

            toast.success('Janji temu berhasil dibatalkan');
            resetModals();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Gagal membatalkan janji temu');
        } finally {
            setProcessingId(null);
        }
    }, [selected, cancelReason, resetModals]);

    /* ─────────────────────────────────────────────────────
       HELPERS
    ───────────────────────────────────────────────────── */
    const getStatusBadge = (status) => {
        const cfg = STATUS_CONFIG[status] || { bg: '#f1f5f9', color: '#475569', label: status };
        return (
            <span style={{
                background: cfg.bg,
                color: cfg.color,
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'inline-block'
            }}>
                {cfg.label}
            </span>
        );
    };

    const formatDate = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    const formatTime = (time) => {
        if (!time) return '-';
        return time;
    };

    /* ─────────────────────────────────────────────────────
       DERIVED STATE — useMemo, tidak re-compute tiap render
    ───────────────────────────────────────────────────── */
    const filteredAppointments = useMemo(() => {
        const q = search.toLowerCase();
        return appointments.filter(a => {
            const matchSearch =
                !search ||
                a.userId?.name?.toLowerCase().includes(q) ||
                a.doctorId?.name?.toLowerCase().includes(q) ||
                a.complaint?.toLowerCase().includes(q);
            const matchStatus =
                filterStatus === 'all' || a.status === filterStatus;
            return matchSearch && matchStatus;
        });
    }, [appointments, search, filterStatus]);

    const stats = useMemo(() => ({
        total:     appointments.length,
        pending:   appointments.filter(a => a.status === 'pending').length,
        confirmed: appointments.filter(a => a.status === 'confirmed').length,
        completed: appointments.filter(a => ['checked_in', 'completed'].includes(a.status)).length,
    }), [appointments]);

    /* ─────────────────────────────────────────────────────
       LOADING STATE
    ───────────────────────────────────────────────────── */
    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <Spinner animation="border" variant="primary" />
                <p style={{ marginTop: 16, color: '#64748b' }}>Memuat data janji temu...</p>
            </div>
        </div>
    );

    /* ─────────────────────────────────────────────────────
       RENDER
    ───────────────────────────────────────────────────── */
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
                .queue-badge {
                    background: #dbeafe;
                    color: #1e40af;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                    display: inline-block;
                }
                .action-group {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .action-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    border: none;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 16px;
                }
                .action-btn.view {
                    background: #dbeafe;
                    color: #2563eb;
                }
                .action-btn.view:hover {
                    background: #bfdbfe;
                }
                .action-btn.confirm {
                    background: #dcfce7;
                    color: #166534;
                }
                .action-btn.confirm:hover {
                    background: #bbf7d0;
                }
                .action-btn.checkin {
                    background: #dbeafe;
                    color: #1e40af;
                }
                .action-btn.checkin:hover {
                    background: #bfdbfe;
                }
                .action-btn.cancel {
                    background: #fee2e2;
                    color: #b91c1c;
                }
                .action-btn.cancel:hover {
                    background: #fecaca;
                }
                .action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .modal-custom .modal-content {
                    border-radius: 20px;
                    border: none;
                    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.15);
                }
                .modal-header-custom {
                    padding: 20px 24px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .modal-body-custom {
                    padding: 24px;
                }
                .modal-footer-custom {
                    padding: 16px 24px;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                }
                .detail-card {
                    background: #f8fafc;
                    border-radius: 12px;
                    padding: 16px;
                    height: 100%;
                }
                .detail-label {
                    color: #64748b;
                    font-size: 12px;
                    margin-bottom: 4px;
                }
                .detail-value {
                    color: #0f172a;
                    font-size: 14px;
                    font-weight: 500;
                }
                .detail-row {
                    display: flex;
                    padding: 8px 0;
                    border-bottom: 1px solid #f1f5f9;
                }
                .detail-row-label {
                    width: 120px;
                    color: #64748b;
                    font-size: 13px;
                }
                .detail-row-value {
                    flex: 1;
                    color: #0f172a;
                    font-size: 13px;
                    font-weight: 500;
                }
                .btn-custom {
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    border: 1px solid #e2e8f0;
                    background: #ffffff;
                    color: #475569;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                }
                .btn-custom:hover {
                    background: #f1f5f9;
                }
                .btn-custom-primary {
                    background: #2563eb;
                    border-color: #2563eb;
                    color: white;
                }
                .btn-custom-primary:hover {
                    background: #1d4ed8;
                }
                .btn-custom-success {
                    background: #16a34a;
                    border-color: #16a34a;
                    color: white;
                }
                .btn-custom-success:hover {
                    background: #15803d;
                }
                .btn-custom-danger {
                    background: #b91c1c;
                    border-color: #b91c1c;
                    color: white;
                }
                .btn-custom-danger:hover {
                    background: #991b1b;
                }
                .info-alert {
                    background: #dbeafe;
                    border: none;
                    border-radius: 10px;
                    padding: 12px 16px;
                    color: #1e40af;
                    font-size: 13px;
                }
                .warning-alert {
                    background: #fef3c7;
                    border: none;
                    border-radius: 10px;
                    padding: 12px 16px;
                    color: #b45309;
                    font-size: 13px;
                }
            `}</style>

            <Container fluid style={{ maxWidth: 1400, margin: '0 auto' }}>
                {/* ── HEADER ── */}
                <div className="page-header">
                    <div className="header-left">
                        <div className="header-icon">
                            <FaCalendarAlt size={24} />
                        </div>
                        <div className="header-title">
                            <h1>Kelola Janji Temu</h1>
                            <p>Manajemen jadwal dan konfirmasi janji temu pasien</p>
                        </div>
                    </div>
                    <button className="btn-custom" onClick={fetchAppointments}>
                        <FaSync /> Refresh
                    </button>
                </div>

                {/* ── STATS ── */}
                <Row className="g-3 mb-4">
                    <Col md={3} xs={6}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ color: '#2563eb', fontSize: 14 }}>Total</div>
                                <FaCalendarAlt style={{ color: '#2563eb', opacity: 0.5 }} size={20} />
                            </div>
                            <div className="stats-value">{stats.total}</div>
                            <div className="stats-label">Seluruh janji temu</div>
                        </div>
                    </Col>
                    <Col md={3} xs={6}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ color: '#b45309', fontSize: 14 }}>Menunggu</div>
                                <FaClock style={{ color: '#b45309', opacity: 0.5 }} size={20} />
                            </div>
                            <div className="stats-value">{stats.pending}</div>
                            <div className="stats-label">Perlu konfirmasi</div>
                        </div>
                    </Col>
                    <Col md={3} xs={6}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ color: '#166534', fontSize: 14 }}>Dikonfirmasi</div>
                                <FaCheckCircle style={{ color: '#166534', opacity: 0.5 }} size={20} />
                            </div>
                            <div className="stats-value">{stats.confirmed}</div>
                            <div className="stats-label">Siap dilayani</div>
                        </div>
                    </Col>
                    <Col md={3} xs={6}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ color: '#0e7490', fontSize: 14 }}>Selesai</div>
                                <FaUserCheck style={{ color: '#0e7490', opacity: 0.5 }} size={20} />
                            </div>
                            <div className="stats-value">{stats.completed}</div>
                            <div className="stats-label">Telah dilayani</div>
                        </div>
                    </Col>
                </Row>

                {/* ── FILTER ── */}
                <Row className="g-3 mb-3">
                    <Col md={5}>
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
                    </Col>
                    <Col md={3}>
                        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="all">Semua Status</option>
                            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                                <option key={key} value={key}>{val.label}</option>
                            ))}
                        </select>
                    </Col>
                    <Col md={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 14, color: '#64748b' }}>
                            {filteredAppointments.length} janji temu ditemukan
                        </span>
                    </Col>
                </Row>

                {/* ── TABLE ── */}
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>No. Antrian</th>
                                <th>Pasien</th>
                                <th>Dokter</th>
                                <th>Tanggal & Waktu</th>
                                <th>Keluhan</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAppointments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px' }}>
                                        <div style={{ width: 60, height: 60, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                            <FaCalendarAlt size={24} style={{ color: '#94a3b8' }} />
                                        </div>
                                        <h6 style={{ fontWeight: 600, marginBottom: 4 }}>Tidak ada data janji temu</h6>
                                        <p style={{ color: '#64748b', fontSize: 13 }}>Belum ada janji temu yang terdaftar</p>
                                    </td>
                                </tr>
                            ) : filteredAppointments.map(a => (
                                <tr key={a._id}>
                                    <td>
                                        <span className="queue-badge">#{a.queueNumber || '-'}</span>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{a.userId?.name || '-'}</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>
                                            {a.userId?.phone || a.userId?.email}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>dr. {a.doctorId?.name || '-'}</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>{a.doctorId?.specialization}</div>
                                    </td>
                                    <td>
                                        <div>{formatDate(a.appointmentDate)}</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>
                                            <FaClock size={10} style={{ marginRight: 4 }} />
                                            {a.appointmentTime || '-'}
                                        </div>
                                    </td>
                                    <td style={{ maxWidth: 150 }}>
                                        <div style={{ fontSize: 13, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {a.complaint || '-'}
                                        </div>
                                    </td>
                                    <td>{getStatusBadge(a.status)}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className="action-group" style={{ justifyContent: 'center' }}>
                                            {/* Detail */}
                                            <button
                                                className="action-btn view"
                                                title="Lihat Detail"
                                                onClick={() => openDetail(a)}
                                            >
                                                <FaEye />
                                            </button>

                                            {/* Konfirmasi — hanya pending */}
                                            {a.status === 'pending' && (
                                                <button
                                                    className="action-btn confirm"
                                                    title="Konfirmasi"
                                                    disabled={processingId === a._id}
                                                    onClick={() => handleConfirm(a._id)}
                                                >
                                                    {processingId === a._id
                                                        ? <Spinner size="sm" animation="border" />
                                                        : <FaCheckCircle />}
                                                </button>
                                            )}

                                            {/* Check-in — hanya confirmed */}
                                            {a.status === 'confirmed' && (
                                                <button
                                                    className="action-btn checkin"
                                                    title="Pasien Hadir"
                                                    disabled={processingId === a._id}
                                                    onClick={() => handleCheckIn(a._id)}
                                                >
                                                    {processingId === a._id
                                                        ? <Spinner size="sm" animation="border" />
                                                        : <FaUserCheck />}
                                                </button>
                                            )}

                                            {/* Batalkan — pending atau confirmed */}
                                            {['pending', 'confirmed'].includes(a.status) && (
                                                <button
                                                    className="action-btn cancel"
                                                    title="Batalkan"
                                                    disabled={processingId === a._id}
                                                    onClick={() => openCancel(a)}
                                                >
                                                    <FaTimesCircle />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ══════════════════════════════════════════════
                    DETAIL MODAL
                ══════════════════════════════════════════════ */}
                <Modal show={showDetailModal} onHide={resetModals} centered dialogClassName="modal-custom">
                    <div className="modal-header-custom">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, background: '#dbeafe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                                <FaEye size={20} />
                            </div>
                            <h5 style={{ fontWeight: 600, marginBottom: 0 }}>Detail Janji Temu</h5>
                        </div>
                        <button onClick={resetModals} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
                    </div>
                    
                    <div className="modal-body-custom">
                        {selected && (
                            <>
                                <Row className="g-3 mb-3">
                                    <Col md={6}>
                                        <div className="detail-card">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                <div style={{ width: 32, height: 32, background: '#dbeafe', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                                                    <FaUser size={16} />
                                                </div>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>PASIEN</span>
                                            </div>
                                            <div style={{ fontWeight: 500, marginBottom: 4 }}>{selected.userId?.name}</div>
                                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>
                                                <FaEnvelope size={10} style={{ marginRight: 6 }} /> {selected.userId?.email}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#64748b' }}>
                                                <FaPhone size={10} style={{ marginRight: 6 }} /> {selected.userId?.phone || '-'}
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="detail-card">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                <div style={{ width: 32, height: 32, background: '#dcfce7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534' }}>
                                                    <FaUserMd size={16} />
                                                </div>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>DOKTER</span>
                                            </div>
                                            <div style={{ fontWeight: 500, marginBottom: 4 }}>dr. {selected.doctorId?.name}</div>
                                            <div style={{ fontSize: 12, color: '#64748b' }}>{selected.doctorId?.specialization}</div>
                                        </div>
                                    </Col>
                                </Row>

                                <div className="detail-card" style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 12 }}>INFORMASI JANJI TEMU</div>
                                    
                                    <div className="detail-row">
                                        <div className="detail-row-label">No. Antrian</div>
                                        <div className="detail-row-value">
                                            <span className="queue-badge">#{selected.queueNumber || '-'}</span>
                                        </div>
                                    </div>
                                    <div className="detail-row">
                                        <div className="detail-row-label">Tanggal</div>
                                        <div className="detail-row-value">{formatDate(selected.appointmentDate)}</div>
                                    </div>
                                    <div className="detail-row">
                                        <div className="detail-row-label">Waktu</div>
                                        <div className="detail-row-value">{selected.appointmentTime || '-'}</div>
                                    </div>
                                    <div className="detail-row">
                                        <div className="detail-row-label">Keluhan</div>
                                        <div className="detail-row-value">{selected.complaint || '-'}</div>
                                    </div>
                                    <div className="detail-row">
                                        <div className="detail-row-label">Status</div>
                                        <div className="detail-row-value">{getStatusBadge(selected.status)}</div>
                                    </div>
                                    {selected.rejectionReason && (
                                        <div className="detail-row">
                                            <div className="detail-row-label">Alasan Batal</div>
                                            <div className="detail-row-value" style={{ color: '#b91c1c' }}>{selected.rejectionReason}</div>
                                        </div>
                                    )}
                                    {selected.doctorNotes && (
                                        <div className="detail-row">
                                            <div className="detail-row-label">Catatan Dokter</div>
                                            <div className="detail-row-value">{selected.doctorNotes}</div>
                                        </div>
                                    )}
                                </div>

                                {selected.status === 'pending' && (
                                    <div className="warning-alert" style={{ marginTop: 8 }}>
                                        <FaClock style={{ marginRight: 8 }} />
                                        Janji temu ini belum dikonfirmasi. Anda dapat mengkonfirmasi atau membatalkannya.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-custom" onClick={resetModals}>
                            Tutup
                        </button>

                        {selected?.status === 'pending' && (
                            <>
                                <button type="button" className="btn-custom btn-custom-danger" onClick={() => openCancel(selected)}>
                                    <FaTimesCircle style={{ marginRight: 4 }} /> Batalkan
                                </button>
                                <button
                                    type="button"
                                    className="btn-custom btn-custom-success"
                                    disabled={processingId === selected._id}
                                    onClick={() => handleConfirm(selected._id)}
                                >
                                    {processingId === selected._id
                                        ? <><Spinner size="sm" animation="border" style={{ marginRight: 4 }} /> Memproses...</>
                                        : <><FaCheckCircle style={{ marginRight: 4 }} /> Konfirmasi</>}
                                </button>
                            </>
                        )}

                        {selected?.status === 'confirmed' && (
                            <>
                                <button type="button" className="btn-custom btn-custom-danger" onClick={() => openCancel(selected)}>
                                    <FaTimesCircle style={{ marginRight: 4 }} /> Batalkan
                                </button>
                                <button
                                    type="button"
                                    className="btn-custom btn-custom-primary"
                                    disabled={processingId === selected._id}
                                    onClick={() => handleCheckIn(selected._id)}
                                >
                                    {processingId === selected._id
                                        ? <><Spinner size="sm" animation="border" style={{ marginRight: 4 }} /> Memproses...</>
                                        : <><FaUserCheck style={{ marginRight: 4 }} /> Pasien Hadir</>}
                                </button>
                            </>
                        )}
                    </div>
                </Modal>

                {/* ══════════════════════════════════════════════
                    CANCEL MODAL
                ══════════════════════════════════════════════ */}
                <Modal show={showCancelModal} onHide={resetModals} centered dialogClassName="modal-custom">
                    <div className="modal-header-custom">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, background: '#fee2e2', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b91c1c' }}>
                                <FaTimesCircle size={20} />
                            </div>
                            <h5 style={{ fontWeight: 600, marginBottom: 0 }}>Batalkan Janji Temu</h5>
                        </div>
                        <button onClick={resetModals} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
                    </div>
                    
                    <div className="modal-body-custom">
                        <p style={{ marginBottom: 16, fontSize: 14 }}>
                            Batalkan janji temu <strong>{selected?.userId?.name}</strong>{' '}
                            dengan <strong>dr. {selected?.doctorId?.name}</strong>?
                        </p>
                        
                        <Form.Group>
                            <Form.Label style={{ fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 8 }}>
                                Alasan Pembatalan <span style={{ color: '#64748b', fontWeight: 'normal' }}>(opsional)</span>
                            </Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                placeholder="Contoh: Dokter berhalangan, jadwal penuh, dll."
                                style={{ borderRadius: 10, borderColor: '#e2e8f0' }}
                            />
                        </Form.Group>
                        
                        <div className="warning-alert" style={{ marginTop: 16 }}>
                            <FaExclamationTriangle style={{ marginRight: 8 }} />
                            Tindakan ini tidak dapat dibatalkan.
                        </div>
                    </div>
                    
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-custom" onClick={resetModals}>
                            Batal
                        </button>
                        <button
                            type="button"
                            className="btn-custom btn-custom-danger"
                            disabled={processingId === selected?._id}
                            onClick={handleCancel}
                        >
                            {processingId === selected?._id
                                ? <><Spinner size="sm" animation="border" style={{ marginRight: 4 }} /> Memproses...</>
                                : 'Ya, Batalkan'}
                        </button>
                    </div>
                </Modal>
            </Container>
        </div>
    );
};

export default ManageAppointments;