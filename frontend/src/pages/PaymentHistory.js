import React, { useState, useEffect } from 'react';
import api, { API_URL } from '../utils/api';
import {
    Container, Row, Col, Card, Table, Badge,
    Button, Form, InputGroup, Spinner, Modal
} from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    FaMoneyBillWave, FaSearch, FaFilter,
    FaCheckCircle, FaTimesCircle, FaClock,
    FaEye, FaFileInvoice, FaQrcode, FaUniversity
} from 'react-icons/fa';

const PaymentHistory = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0, rejected: 0, totalAmount: 0 });

    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        fetchHistory();
    }, [user]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/manual-payment/history');
            const data = res.data.payments || [];
            setPayments(data);

            // Hitung statistik
            const verified = data.filter(p => p.status === 'verified');
            setStats({
                total: data.length,
                verified: verified.length,
                pending: data.filter(p => p.status === 'pending').length,
                rejected: data.filter(p => p.status === 'rejected').length,
                totalAmount: verified.reduce((sum, p) => sum + (p.amount || 0), 0)
            });
        } catch (err) {
            toast.error('Gagal memuat riwayat pembayaran');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const map = {
            pending: { bg: 'warning', icon: <FaClock size={11} className="me-1" />, label: 'Menunggu' },
            verified: { bg: 'success', icon: <FaCheckCircle size={11} className="me-1" />, label: 'Terverifikasi' },
            rejected: { bg: 'danger', icon: <FaTimesCircle size={11} className="me-1" />, label: 'Ditolak' },
        };
        const s = map[status] || { bg: 'secondary', icon: null, label: status };
        return <Badge bg={s.bg}>{s.icon}{s.label}</Badge>;
    };

    const getTypeLabel = (type) => {
        const map = { consultation: 'Konsultasi', pharmacy: 'Farmasi', appointment: 'Janji Temu' };
        return map[type] || type;
    };

    // Filter
    const filtered = payments.filter(p => {
        const matchSearch = !search || 
            p.transactionId?.toLowerCase().includes(search.toLowerCase()) ||
            getTypeLabel(p.paymentType).toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === 'all' || p.status === filterStatus;
        const matchType = filterType === 'all' || p.paymentType === filterType;
        return matchSearch && matchStatus && matchType;
    });

    if (loading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Memuat riwayat pembayaran...</p>
        </Container>
    );

    return (
        <Container className="py-4">
            {/* Header */}
            <Row className="mb-4">
                <Col>
                    <h4 className="fw-bold mb-0">
                        <FaMoneyBillWave className="me-2 text-success" />
                        Riwayat Pembayaran
                    </h4>
                    <p className="text-muted small mb-0">Semua transaksi pembayaran Anda</p>
                </Col>
            </Row>

            {/* Stats Cards */}
            <Row className="mb-4 g-3">
                {[
                    { label: 'Total Transaksi', value: stats.total, bg: 'primary', icon: FaFileInvoice },
                    { label: 'Terverifikasi', value: stats.verified, bg: 'success', icon: FaCheckCircle },
                    { label: 'Menunggu', value: stats.pending, bg: 'warning', icon: FaClock },
                    {
                        label: 'Total Dibayar',
                        value: `Rp ${stats.totalAmount.toLocaleString('id-ID')}`,
                        bg: 'info', icon: FaMoneyBillWave
                    },
                ].map((s, i) => (
                    <Col md={3} xs={6} key={i}>
                        <Card className={`border-0 shadow-sm bg-${s.bg} text-white`}>
                            <Card.Body className="py-3">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="small opacity-75 mb-1">{s.label}</div>
                                        <div className="fw-bold fs-5">{s.value}</div>
                                    </div>
                                    <s.icon size={28} className="opacity-25" />
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Filter Bar */}
            <Row className="mb-3 g-2 align-items-center">
                <Col md={4}>
                    <InputGroup>
                        <InputGroup.Text><FaSearch /></InputGroup.Text>
                        <Form.Control
                            placeholder="Cari ID transaksi / layanan..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </InputGroup>
                </Col>
                <Col md={3}>
                    <InputGroup>
                        <InputGroup.Text><FaFilter /></InputGroup.Text>
                        <Form.Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="all">Semua Status</option>
                            <option value="pending">Menunggu</option>
                            <option value="verified">Terverifikasi</option>
                            <option value="rejected">Ditolak</option>
                        </Form.Select>
                    </InputGroup>
                </Col>
                <Col md={3}>
                    <Form.Select value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="all">Semua Layanan</option>
                        <option value="consultation">Konsultasi</option>
                        <option value="pharmacy">Farmasi</option>
                    </Form.Select>
                </Col>
                <Col md={2} className="text-end">
                    <span className="text-muted small">{filtered.length} transaksi</span>
                </Col>
            </Row>

            {/* Tabel */}
            <Card className="border-0 shadow-sm">
                <Card.Body className="p-0">
                    {filtered.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <FaFileInvoice size={40} className="mb-2 opacity-25" />
                            <p className="mb-0">Tidak ada riwayat pembayaran</p>
                        </div>
                    ) : (
                        <Table hover responsive className="mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th>ID Transaksi</th>
                                    <th>Layanan</th>
                                    <th>Metode</th>
                                    <th>Jumlah</th>
                                    <th>Tanggal</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(p => (
                                    <tr key={p._id}>
                                        <td>
                                            <code className="small">{p.transactionId}</code>
                                        </td>
                                        <td>
                                            <Badge bg="light" text="dark" className="border">
                                                {getTypeLabel(p.paymentType)}
                                            </Badge>
                                            {p.referenceId?.doctorId && (
                                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                    dr. {p.referenceId.doctorId.name}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center gap-1">
                                                {p.bankName === 'QRIS'
                                                    ? <FaQrcode className="text-success" />
                                                    : <FaUniversity className="text-primary" />
                                                }
                                                <span className="small">{p.bankName}</span>
                                            </div>
                                        </td>
                                        <td className="fw-semibold">
                                            Rp {(p.amount || 0).toLocaleString('id-ID')}
                                        </td>
                                        <td className="small text-muted">
                                            {new Date(p.createdAt).toLocaleDateString('id-ID', {
                                                day: 'numeric', month: 'short', year: 'numeric'
                                            })}
                                        </td>
                                        <td>{getStatusBadge(p.status)}</td>
                                        <td>
                                            <Button
                                                variant="outline-primary"
                                                size="sm"
                                                onClick={() => { setSelectedPayment(p); setShowDetailModal(true); }}
                                            >
                                                <FaEye />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Card.Body>
            </Card>

            {/* Modal Detail */}
            <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="md">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaFileInvoice className="me-2 text-primary" />
                        Detail Transaksi
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedPayment && (
                        <>
                            <Table borderless size="sm" className="mb-3">
                                <tbody>
                                    <tr>
                                        <td className="text-muted fw-semibold" style={{ width: '40%' }}>ID Transaksi</td>
                                        <td><code>{selectedPayment.transactionId}</code></td>
                                    </tr>
                                    <tr>
                                        <td className="text-muted fw-semibold">Layanan</td>
                                        <td>{getTypeLabel(selectedPayment.paymentType)}</td>
                                    </tr>
                                    <tr>
                                        <td className="text-muted fw-semibold">Metode Bayar</td>
                                        <td>{selectedPayment.bankName}</td>
                                    </tr>
                                    {selectedPayment.accountNumber && (
                                        <tr>
                                            <td className="text-muted fw-semibold">No. Rekening</td>
                                            <td>{selectedPayment.accountNumber}</td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td className="text-muted fw-semibold">Jumlah</td>
                                        <td className="fw-bold text-primary">
                                            Rp {(selectedPayment.amount || 0).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="text-muted fw-semibold">Tanggal Bayar</td>
                                        <td>{new Date(selectedPayment.createdAt).toLocaleDateString('id-ID', { dateStyle: 'long' })}</td>
                                    </tr>
                                    {selectedPayment.transferDate && (
                                        <tr>
                                            <td className="text-muted fw-semibold">Tgl Transfer</td>
                                            <td>{new Date(selectedPayment.transferDate).toLocaleDateString('id-ID')}</td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td className="text-muted fw-semibold">Status</td>
                                        <td>{getStatusBadge(selectedPayment.status)}</td>
                                    </tr>
                                    {selectedPayment.adminNotes && (
                                        <tr>
                                            <td className="text-muted fw-semibold">Catatan Admin</td>
                                            <td className="text-danger small">{selectedPayment.adminNotes}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </Table>

                            {/* Bukti Transfer */}
                            {selectedPayment.transferProof && (
                                <div>
                                    <p className="fw-semibold small mb-2">Bukti Transfer:</p>
                                    <div className="text-center border rounded p-2 bg-light">
                                        <img
                                            src={`${API_URL}${selectedPayment.transferProof}`}
                                            alt="Bukti Transfer"
                                            style={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain' }}
                                            onError={e => { e.target.style.display = 'none'; }}
                                        />
                                        <div className="mt-2">
                                            <Button
                                                variant="outline-primary"
                                                size="sm"
                                                href={`${API_URL}${selectedPayment.transferProof}`}
                                                target="_blank"
                                            >
                                                Lihat Bukti Full
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDetailModal(false)}>Tutup</Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default PaymentHistory;
