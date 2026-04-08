import React, { useState, useEffect } from 'react';
import api from '../utils/api';
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
    FaEye, FaFileInvoice, FaHourglass
} from 'react-icons/fa';

const PaymentHistory = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [payments, setPayments]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [search, setSearch]             = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType]     = useState('all');
    const [stats, setStats]               = useState({
        total: 0, paid: 0, pending: 0, failed: 0, totalAmount: 0
    });
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            // Semua payment sekarang dari Xendit
            const res  = await api.get('/api/xendit/history');
            const data = res.data.payments || [];
            setPayments(data);

            const paid = data.filter(p => p.status === 'paid' || p.status === 'refunded');
            setStats({
                total      : data.length,
                paid       : data.filter(p => p.status === 'paid').length,
                pending    : data.filter(p => p.status === 'pending').length,
                failed     : data.filter(p => p.status === 'failed').length,
                totalAmount: paid.reduce((sum, p) => sum + (p.amount || 0), 0),
            });
        } catch (err) {
            toast.error('Gagal memuat riwayat pembayaran');
        } finally {
            setLoading(false);
        }
    };

    // ── Status badge — disesuaikan dengan status Xendit ──────────────────────
    const getStatusBadge = (status) => {
        const map = {
            paid      : { bg: 'success', icon: <FaCheckCircle size={11} className="me-1" />, label: 'Berhasil'  },
            pending   : { bg: 'warning', icon: <FaClock       size={11} className="me-1" />, label: 'Menunggu'  },
            failed    : { bg: 'danger',  icon: <FaTimesCircle size={11} className="me-1" />, label: 'Gagal'     },
            refunded  : { bg: 'info',    icon: <FaHourglass   size={11} className="me-1" />, label: 'Direfund'  },
            expired   : { bg: 'secondary',icon: <FaTimesCircle size={11} className="me-1" />, label: 'Kadaluarsa'},
        };
        const s = map[status] || { bg: 'secondary', icon: null, label: status };
        return <Badge bg={s.bg}>{s.icon}{s.label}</Badge>;
    };

    const getTypeLabel = (type) => {
        const map = {
            consultation: '🩺 Konsultasi',
            medicine    : '💊 Farmasi',
            appointment : '📅 Janji Temu',
        };
        return map[type] || type;
    };

    const fmtRupiah = (n) => `Rp ${(n || 0).toLocaleString('id-ID')}`;

    const fmtDate = (d) => d
        ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
        : '-';

    // ── Filter ────────────────────────────────────────────────────────────────
    const filtered = payments.filter(p => {
        const matchSearch = !search ||
            p.transactionId?.toLowerCase().includes(search.toLowerCase()) ||
            getTypeLabel(p.paymentType).toLowerCase().includes(search.toLowerCase()) ||
            p.doctorName?.toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === 'all' || p.status === filterStatus;
        const matchType   = filterType   === 'all' || p.paymentType === filterType;
        return matchSearch && matchStatus && matchType;
    });

    // ── Loading ───────────────────────────────────────────────────────────────
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
                    <p className="text-muted small mb-0">Semua transaksi pembayaran via Xendit</p>
                </Col>
                <Col xs="auto">
                    <Button variant="outline-primary" size="sm" onClick={fetchHistory}>
                        🔄 Refresh
                    </Button>
                </Col>
            </Row>

            {/* Stats Cards */}
            <Row className="mb-4 g-3">
                {[
                    { label: 'Total Transaksi', value: stats.total,                        bg: 'primary', icon: FaFileInvoice   },
                    { label: 'Berhasil',         value: stats.paid,                         bg: 'success', icon: FaCheckCircle  },
                    { label: 'Menunggu',         value: stats.pending,                      bg: 'warning', icon: FaClock        },
                    { label: 'Total Dibayar',    value: fmtRupiah(stats.totalAmount),       bg: 'info',    icon: FaMoneyBillWave},
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
                            placeholder="Cari ID transaksi / layanan / dokter..."
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
                            <option value="paid">Berhasil</option>
                            <option value="pending">Menunggu</option>
                            <option value="failed">Gagal</option>
                            <option value="refunded">Direfund</option>
                        </Form.Select>
                    </InputGroup>
                </Col>
                <Col md={3}>
                    <Form.Select value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="all">Semua Layanan</option>
                        <option value="consultation">Konsultasi</option>
                        <option value="medicine">Farmasi</option>
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
                                            {p.doctorName && (
                                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                    {p.doctorName}
                                                    {p.doctorSpec && ` · ${p.doctorSpec}`}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className="small">
                                                {p.paymentMethod || 'Xendit'}
                                            </span>
                                        </td>
                                        <td className="fw-semibold">
                                            {fmtRupiah(p.amount)}
                                        </td>
                                        <td className="small text-muted">
                                            {fmtDate(p.paidAt || p.createdAt)}
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
                        <Table borderless size="sm" className="mb-0">
                            <tbody>
                                <tr>
                                    <td className="text-muted fw-semibold" style={{ width: '40%' }}>ID Transaksi</td>
                                    <td><code className="small">{selectedPayment.transactionId}</code></td>
                                </tr>
                                <tr>
                                    <td className="text-muted fw-semibold">Layanan</td>
                                    <td>{getTypeLabel(selectedPayment.paymentType)}</td>
                                </tr>
                                {selectedPayment.doctorName && (
                                    <tr>
                                        <td className="text-muted fw-semibold">Dokter</td>
                                        <td>{selectedPayment.doctorName}</td>
                                    </tr>
                                )}
                                <tr>
                                    <td className="text-muted fw-semibold">Metode Bayar</td>
                                    <td>{selectedPayment.paymentMethod || 'Xendit'}</td>
                                </tr>
                                <tr>
                                    <td className="text-muted fw-semibold">Jumlah</td>
                                    <td className="fw-bold text-primary">
                                        {fmtRupiah(selectedPayment.amount)}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-muted fw-semibold">Tanggal Bayar</td>
                                    <td>{fmtDate(selectedPayment.paidAt || selectedPayment.createdAt)}</td>
                                </tr>
                                <tr>
                                    <td className="text-muted fw-semibold">Status</td>
                                    <td>{getStatusBadge(selectedPayment.status)}</td>
                                </tr>
                            </tbody>
                        </Table>
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