import React, { useState, useEffect } from 'react';
import api, { API_URL } from '../../utils/api';
import { 
    Container, Row, Col, Card, Table, Button, 
    Badge, Modal, Image, Form, Alert, 
    InputGroup, Spinner
} from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
    FaMoneyBillWave, FaCheckCircle, FaTimesCircle, 
    FaClock, FaEye, FaSearch, FaFilter, FaDownload,
    FaUniversity, FaQrcode, FaArrowLeft, FaArrowRight
} from 'react-icons/fa';

const VerifyPayments = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectNotes, setRejectNotes] = useState('');
    const [stats, setStats] = useState({
        pending: 0,
        verified: 0,
        rejected: 0,
        totalAmount: 0
    });
    const [filter, setFilter] = useState('pending');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        if (!user || user.role !== 'admin') {
            toast.error('Akses ditolak. Halaman ini hanya untuk admin.');
            navigate('/');
            return;
        }
        
        fetchPayments();
        fetchStats();
    }, [filter, page, search]);

    const fetchPayments = async () => {
        setLoading(true);
        try {
            let url = '/api/admin/payments/all';
            
            if (filter === 'pending') {
                url = '/api/admin/payments/pending';
                const response = await api.get(url);
                setPayments(response.data.payments);
                setTotalPages(1);
            } else {
                const response = await api.get(
                    `${url}?status=${filter}&page=${page}&limit=10`
                );
                setPayments(response.data.payments);
                setTotalPages(response.data.totalPages);
            }
        } catch (error) {
            toast.error('Gagal memuat data pembayaran');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await api.get('/api/admin/payments/stats');
            setStats(response.data.stats);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleViewProof = (payment) => {
        setSelectedPayment(payment);
        setShowModal(true);
    };

    const handleVerify = async (paymentId, status) => {
        if (status === 'rejected' && !rejectNotes) {
            toast.error('Isi alasan penolakan');
            return;
        }

        try {
            await api.put(
                `/api/admin/payments/${paymentId}/verify`,
                { 
                    status, 
                    notes: status === 'rejected' ? rejectNotes : 'Pembayaran valid' 
                }
            );

            toast.success(`Pembayaran ${status === 'verified' ? 'diverifikasi' : 'ditolak'}`);
            setShowModal(false);
            setShowRejectModal(false);
            setRejectNotes('');
            fetchPayments();
            fetchStats();
            
        } catch (error) {
            toast.error('Gagal memproses verifikasi');
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (amount) => {
        return `Rp ${amount?.toLocaleString() || 0}`;
    };

    const getStatusBadge = (status) => {
        const variants = {
            pending: { className: 'badge-warning', icon: FaClock, text: 'Menunggu' },
            verified: { className: 'badge-success', icon: FaCheckCircle, text: 'Terverifikasi' },
            rejected: { className: 'badge-danger', icon: FaTimesCircle, text: 'Ditolak' }
        };
        const variant = variants[status] || variants.pending;
        return (
            <span className={`badge-status ${variant.className}`}>
                <variant.icon size={12} style={{ marginRight: 4 }} />
                {variant.text}
            </span>
        );
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: '24px' }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            
            <style>{`
                .stat-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                    transition: all 0.2s ease;
                }
                .stat-card:hover {
                    box-shadow: 0 8px 16px -4px rgba(0,0,0,0.05);
                    transform: translateY(-2px);
                }
                .badge-status {
                    border-radius: 20px;
                    padding: 4px 12px;
                    font-size: 12px;
                    font-weight: 500;
                    display: inline-flex;
                    align-items: center;
                }
                .badge-warning { background: #fef3c7; color: #b45309; }
                .badge-success { background: #dcfce7; color: #166534; }
                .badge-danger { background: #fee2e2; color: #b91c1c; }
                .badge-info { background: #dbeafe; color: #1e40af; }
                .filter-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 16px;
                }
                .table-container {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    overflow: hidden;
                }
                .table-container table {
                    margin-bottom: 0;
                }
                .table-container thead th {
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    color: #475569;
                    font-weight: 600;
                    font-size: 13px;
                    padding: 16px;
                }
                .table-container td {
                    padding: 16px;
                    border-bottom: 1px solid #e2e8f0;
                    color: #0f172a;
                    vertical-align: middle;
                }
                .table-container tr:last-child td {
                    border-bottom: none;
                }
                .btn-custom {
                    border-radius: 8px;
                    padding: 6px 16px;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                .btn-custom-primary {
                    background: #2563eb;
                    border: none;
                    color: white;
                }
                .btn-custom-primary:hover {
                    background: #1d4ed8;
                }
                .btn-custom-outline {
                    background: transparent;
                    border: 1px solid #e2e8f0;
                    color: #475569;
                }
                .btn-custom-outline:hover {
                    background: #f1f5f9;
                }
                .pagination-custom {
                    display: flex;
                    gap: 4px;
                    justify-content: center;
                    margin-top: 24px;
                }
                .pagination-custom button {
                    border: 1px solid #e2e8f0;
                    background: #ffffff;
                    color: #475569;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 13px;
                    transition: all 0.2s ease;
                }
                .pagination-custom button:hover:not(:disabled) {
                    background: #f1f5f9;
                }
                .pagination-custom button.active {
                    background: #2563eb;
                    color: white;
                    border-color: #2563eb;
                }
                .pagination-custom button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .input-custom {
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    padding: 10px 16px;
                    font-size: 14px;
                }
                .input-custom:focus {
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
                    outline: none;
                }
                .select-custom {
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    padding: 10px 16px;
                    font-size: 14px;
                    background: #ffffff;
                }
                .modal-custom .modal-content {
                    border-radius: 16px;
                    border: none;
                    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1);
                }
                .detail-card {
                    background: #f8fafc;
                    border-radius: 12px;
                    padding: 16px;
                }
            `}</style>

            <Container fluid style={{ maxWidth: 1400, margin: '0 auto' }}>
                {/* Header */}
                <Row className="mb-4">
                    <Col>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                            <div style={{ width: 40, height: 40, background: '#dbeafe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                                <FaMoneyBillWave size={20} />
                            </div>
                            <div>
                                <h1 style={{ fontSize: 24, fontWeight: 600, color: '#0f172a', marginBottom: 0 }}>
                                    Verifikasi Pembayaran
                                </h1>
                                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 0 }}>
                                    Kelola dan verifikasi bukti transfer dari user
                                </p>
                            </div>
                        </div>
                    </Col>
                </Row>

                {/* Statistik Cards */}
                <Row className="mb-4 g-3">
                    <Col md={3}>
                        <div className="stat-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div style={{ color: '#b45309', fontSize: 14 }}>Menunggu Verifikasi</div>
                                <div style={{ color: '#b45309', opacity: 0.5 }}><FaClock size={24} /></div>
                            </div>
                            <div style={{ fontSize: 32, fontWeight: 600, color: '#0f172a' }}>{stats.pending}</div>
                        </div>
                    </Col>
                    <Col md={3}>
                        <div className="stat-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div style={{ color: '#166534', fontSize: 14 }}>Terverifikasi</div>
                                <div style={{ color: '#166534', opacity: 0.5 }}><FaCheckCircle size={24} /></div>
                            </div>
                            <div style={{ fontSize: 32, fontWeight: 600, color: '#0f172a' }}>{stats.verified}</div>
                        </div>
                    </Col>
                    <Col md={3}>
                        <div className="stat-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div style={{ color: '#b91c1c', fontSize: 14 }}>Ditolak</div>
                                <div style={{ color: '#b91c1c', opacity: 0.5 }}><FaTimesCircle size={24} /></div>
                            </div>
                            <div style={{ fontSize: 32, fontWeight: 600, color: '#0f172a' }}>{stats.rejected}</div>
                        </div>
                    </Col>
                    <Col md={3}>
                        <div className="stat-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div style={{ color: '#1e40af', fontSize: 14 }}>Total Pendapatan</div>
                                <div style={{ color: '#1e40af', opacity: 0.5 }}><FaMoneyBillWave size={24} /></div>
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 600, color: '#0f172a' }}>{formatCurrency(stats.totalAmount)}</div>
                        </div>
                    </Col>
                </Row>

                {/* Filter */}
                <div className="filter-card" style={{ marginBottom: 24 }}>
                    <Row className="g-3">
                        <Col md={4}>
                            <div style={{ position: 'relative' }}>
                                <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }} />
                                <input
                                    type="text"
                                    placeholder="Cari transaksi..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="input-custom"
                                    style={{ width: '100%', paddingLeft: 36 }}
                                />
                            </div>
                        </Col>
                        <Col md={3}>
                            <div style={{ position: 'relative' }}>
                                <FaFilter style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }} />
                                <select 
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="select-custom"
                                    style={{ width: '100%', paddingLeft: 36 }}
                                >
                                    <option value="pending">Menunggu Verifikasi</option>
                                    <option value="verified">Terverifikasi</option>
                                    <option value="rejected">Ditolak</option>
                                    <option value="all">Semua</option>
                                </select>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Tabel Pembayaran */}
                <div className="table-container">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px' }}>
                            <Spinner animation="border" variant="primary" />
                        </div>
                    ) : payments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px' }}>
                            <div style={{ width: 60, height: 60, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <FaMoneyBillWave size={24} style={{ color: '#94a3b8' }} />
                            </div>
                            <h6 style={{ fontWeight: 600, marginBottom: 4 }}>Tidak Ada Pembayaran</h6>
                            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 0 }}>
                                {filter === 'pending' 
                                    ? 'Tidak ada pembayaran yang menunggu verifikasi'
                                    : 'Tidak ada data pembayaran'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>ID Transaksi</th>
                                            <th>User</th>
                                            <th>Tanggal</th>
                                            <th>Layanan</th>
                                            <th>Jumlah</th>
                                            <th>Bank</th>
                                            <th>Status</th>
                                            <th style={{ textAlign: 'right' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.map(payment => (
                                            <tr key={payment._id}>
                                                <td>
                                                    <code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 4 }}>{payment.transactionId}</code>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 500 }}>{payment.userId?.name}</div>
                                                    <div style={{ fontSize: 12, color: '#64748b' }}>{payment.userId?.email}</div>
                                                </td>
                                                <td style={{ fontSize: 13 }}>{formatDate(payment.createdAt)}</td>
                                                <td>
                                                    {payment.paymentType === 'consultation' && (
                                                        <>
                                                            <span className="badge-status badge-info" style={{ marginBottom: 4 }}>Konsultasi</span>
                                                            <br />
                                                            <span style={{ fontSize: 12, color: '#64748b' }}>dr. {payment.referenceId?.doctorId?.name}</span>
                                                        </>
                                                    )}
                                                    {payment.paymentType === 'appointment' && (
                                                        <span className="badge-status badge-info">Janji Temu</span>
                                                    )}
                                                    {payment.paymentType === 'sick_letter' && (
                                                        <span className="badge-status badge-info">Surat Sakit</span>
                                                    )}
                                                    {payment.paymentType === 'medicine' && (
                                                        <span className="badge-status badge-info">Pembelian Obat</span>
                                                    )}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{formatCurrency(payment.amount)}</td>
                                                <td>
                                                    {payment.bankName === 'QRIS' ? (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <FaQrcode style={{ color: '#16a34a' }} />
                                                            QRIS
                                                        </span>
                                                    ) : (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <FaUniversity style={{ color: '#2563eb' }} />
                                                            {payment.bankName}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>{getStatusBadge(payment.status)}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        className="btn-custom btn-custom-outline"
                                                        onClick={() => handleViewProof(payment)}
                                                    >
                                                        <FaEye style={{ marginRight: 4 }} />
                                                        Detail
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {filter !== 'pending' && totalPages > 1 && (
                                <div className="pagination-custom">
                                    <button 
                                        disabled={page === 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                    >
                                        <FaArrowLeft size={12} />
                                    </button>
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i + 1}
                                            className={i + 1 === page ? 'active' : ''}
                                            onClick={() => setPage(i + 1)}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                    <button
                                        disabled={page === totalPages}
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    >
                                        <FaArrowRight size={12} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Modal Lihat Bukti Transfer */}
                <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered dialogClassName="modal-custom">
                    <div style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h5 style={{ fontWeight: 600, marginBottom: 0 }}>Detail Pembayaran</h5>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>×</button>
                        </div>
                        
                        {selectedPayment && (
                            <>
                                <Row className="mb-3">
                                    <Col md={6}>
                                        <div className="detail-card">
                                            <h6 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#475569' }}>📋 Informasi Transaksi</h6>
                                            <div style={{ fontSize: 13, marginBottom: 8 }}>
                                                <span style={{ color: '#64748b' }}>ID: </span>
                                                <span style={{ fontWeight: 500 }}>{selectedPayment.transactionId}</span>
                                            </div>
                                            <div style={{ fontSize: 13, marginBottom: 8 }}>
                                                <span style={{ color: '#64748b' }}>Tanggal: </span>
                                                <span>{formatDate(selectedPayment.createdAt)}</span>
                                            </div>
                                            <div style={{ fontSize: 13, marginBottom: 8 }}>
                                                <span style={{ color: '#64748b' }}>Layanan: </span>
                                                <span>{selectedPayment.paymentType}</span>
                                            </div>
                                            <div style={{ fontSize: 13, marginBottom: 8 }}>
                                                <span style={{ color: '#64748b' }}>Jumlah: </span>
                                                <span style={{ fontWeight: 600 }}>{formatCurrency(selectedPayment.amount)}</span>
                                            </div>
                                            <div style={{ fontSize: 13, marginBottom: 8 }}>
                                                <span style={{ color: '#64748b' }}>Metode: </span>
                                                <span>{selectedPayment.bankName}</span>
                                            </div>
                                            {selectedPayment.bankName !== 'QRIS' && (
                                                <>
                                                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                                                        <span style={{ color: '#64748b' }}>No. Rekening: </span>
                                                        <span>{selectedPayment.accountNumber}</span>
                                                    </div>
                                                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                                                        <span style={{ color: '#64748b' }}>Atas Nama: </span>
                                                        <span>{selectedPayment.accountName}</span>
                                                    </div>
                                                </>
                                            )}
                                            {selectedPayment.transferDate && (
                                                <div style={{ fontSize: 13 }}>
                                                    <span style={{ color: '#64748b' }}>Tgl Transfer: </span>
                                                    <span>{new Date(selectedPayment.transferDate).toLocaleDateString('id-ID')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="detail-card">
                                            <h6 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#475569' }}>👤 Informasi User</h6>
                                            <div style={{ fontSize: 13, marginBottom: 8 }}>
                                                <span style={{ color: '#64748b' }}>Nama: </span>
                                                <span style={{ fontWeight: 500 }}>{selectedPayment.userId?.name}</span>
                                            </div>
                                            <div style={{ fontSize: 13, marginBottom: 8 }}>
                                                <span style={{ color: '#64748b' }}>Email: </span>
                                                <span>{selectedPayment.userId?.email}</span>
                                            </div>
                                            <div style={{ fontSize: 13 }}>
                                                <span style={{ color: '#64748b' }}>Telepon: </span>
                                                <span>{selectedPayment.userId?.phone || '-'}</span>
                                            </div>
                                        </div>
                                    </Col>
                                </Row>

                                {selectedPayment.paymentType === 'consultation' && (
                                    <div className="detail-card" style={{ marginBottom: 16 }}>
                                        <h6 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#475569' }}>🩺 Detail Konsultasi</h6>
                                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                                            <span style={{ color: '#64748b' }}>Dokter: </span>
                                            <span style={{ fontWeight: 500 }}>dr. {selectedPayment.referenceId?.doctorId?.name}</span>
                                        </div>
                                        <div style={{ fontSize: 13 }}>
                                            <span style={{ color: '#64748b' }}>Keluhan: </span>
                                            <span>{selectedPayment.referenceId?.symptoms}</span>
                                        </div>
                                    </div>
                                )}

                                <h6 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#475569' }}>📎 Bukti Transfer</h6>
                                {selectedPayment.transferProof ? (
                                    <div style={{ textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: '#f8fafc', marginBottom: 16 }}>
                                        <Image 
                                            src={`${API_URL}${selectedPayment.transferProof}`}
                                            fluid
                                            style={{ maxHeight: '300px', borderRadius: 8 }}
                                        />
                                        <div style={{ marginTop: 12 }}>
                                            <Button 
                                                variant="outline-primary"
                                                size="sm"
                                                href={`${API_URL}${selectedPayment.transferProof}`}
                                                target="_blank"
                                                style={{ borderColor: '#e2e8f0', color: '#475569' }}
                                            >
                                                <FaDownload style={{ marginRight: 4 }} />
                                                Download Bukti
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Alert variant="warning" style={{ fontSize: 13, borderRadius: 8, marginBottom: 16 }}>
                                        Belum ada bukti transfer yang diupload
                                    </Alert>
                                )}

                                {selectedPayment.adminNotes && (
                                    <Alert variant="info" style={{ fontSize: 13, borderRadius: 8 }}>
                                        <strong>Catatan Admin:</strong>
                                        <p className="mb-0 mt-1">{selectedPayment.adminNotes}</p>
                                    </Alert>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                                    <button 
                                        className="btn-custom btn-custom-outline"
                                        onClick={() => setShowModal(false)}
                                    >
                                        Tutup
                                    </button>
                                    {selectedPayment?.status === 'pending' && (
                                        <>
                                            <button 
                                                className="btn-custom" 
                                                style={{ background: '#b91c1c', color: 'white', border: 'none' }}
                                                onClick={() => {
                                                    setShowModal(false);
                                                    setShowRejectModal(true);
                                                }}
                                            >
                                                <FaTimesCircle style={{ marginRight: 4 }} />
                                                Tolak
                                            </button>
                                            <button 
                                                className="btn-custom" 
                                                style={{ background: '#16a34a', color: 'white', border: 'none' }}
                                                onClick={() => handleVerify(selectedPayment._id, 'verified')}
                                            >
                                                <FaCheckCircle style={{ marginRight: 4 }} />
                                                Verifikasi
                                            </button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </Modal>

                {/* Modal Alasan Penolakan */}
                <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered dialogClassName="modal-custom">
                    <div style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h5 style={{ fontWeight: 600, marginBottom: 0 }}>Alasan Penolakan</h5>
                            <button onClick={() => setShowRejectModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>×</button>
                        </div>
                        
                        <Form.Group className="mb-3">
                            <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Catatan untuk user</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={rejectNotes}
                                onChange={(e) => setRejectNotes(e.target.value)}
                                placeholder="Contoh: Bukti tidak jelas, jumlah tidak sesuai, dll"
                                style={{ borderRadius: 8, borderColor: '#e2e8f0' }}
                            />
                        </Form.Group>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button 
                                className="btn-custom btn-custom-outline"
                                onClick={() => setShowRejectModal(false)}
                            >
                                Batal
                            </button>
                            <button 
                                className="btn-custom" 
                                style={{ background: '#b91c1c', color: 'white', border: 'none' }}
                                onClick={() => handleVerify(selectedPayment._id, 'rejected')}
                            >
                                Tolak Pembayaran
                            </button>
                        </div>
                    </div>
                </Modal>
            </Container>
        </div>
    );
};

export default VerifyPayments;