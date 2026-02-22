import React, { useState, useEffect } from 'react';
import { 
    Container, Row, Col, Card, Table, Button, 
    Badge, Modal, Image, Form, Alert, Pagination,
    InputGroup, Spinner
} from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
    FaMoneyBillWave, FaCheckCircle, FaTimesCircle, 
    FaClock, FaEye, FaSearch, FaFilter, FaDownload,
    FaUserMd, FaCalendarAlt, FaUniversity, FaQrcode
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
        // Cek apakah user adalah admin
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
            const token = localStorage.getItem('token');
            let url = 'http://localhost:5000/api/admin/payments/all';
            
            if (filter === 'pending') {
                url = 'http://localhost:5000/api/admin/payments/pending';
                const response = await axios.get(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPayments(response.data.payments);
                setTotalPages(1);
            } else {
                const response = await axios.get(
                    `${url}?status=${filter}&page=${page}&limit=10`,
                    { headers: { Authorization: `Bearer ${token}` } }
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
            const token = localStorage.getItem('token');
            const response = await axios.get(
                'http://localhost:5000/api/admin/payments/stats',
                { headers: { Authorization: `Bearer ${token}` } }
            );
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
            const token = localStorage.getItem('token');
            await axios.put(
                `http://localhost:5000/api/admin/payments/${paymentId}/verify`,
                { 
                    status, 
                    notes: status === 'rejected' ? rejectNotes : 'Pembayaran valid' 
                },
                { headers: { Authorization: `Bearer ${token}` } }
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
            month: 'long',
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
            pending: { bg: 'warning', icon: FaClock, text: 'Menunggu' },
            verified: { bg: 'success', icon: FaCheckCircle, text: 'Terverifikasi' },
            rejected: { bg: 'danger', icon: FaTimesCircle, text: 'Ditolak' }
        };
        const variant = variants[status] || variants.pending;
        return (
            <Badge bg={variant.bg} className="d-flex align-items-center gap-1" style={{ width: 'fit-content' }}>
                <variant.icon size={12} />
                <span>{variant.text}</span>
            </Badge>
        );
    };

    return (
        <Container fluid className="py-4">
            <Row className="mb-4">
                <Col>
                    <h2 className="mb-0">
                        <FaMoneyBillWave className="me-2 text-primary" />
                        Verifikasi Pembayaran Manual
                    </h2>
                    <p className="text-muted">
                        Kelola dan verifikasi bukti transfer dari user
                    </p>
                </Col>
            </Row>

            {/* Statistik Cards */}
            <Row className="mb-4 g-4">
                <Col md={3}>
                    <Card className="bg-warning text-white shadow-sm">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Menunggu Verifikasi</h6>
                                    <h2 className="mb-0 fw-bold">{stats.pending}</h2>
                                </div>
                                <FaClock size={40} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="bg-success text-white shadow-sm">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Terverifikasi</h6>
                                    <h2 className="mb-0 fw-bold">{stats.verified}</h2>
                                </div>
                                <FaCheckCircle size={40} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="bg-danger text-white shadow-sm">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Ditolak</h6>
                                    <h2 className="mb-0 fw-bold">{stats.rejected}</h2>
                                </div>
                                <FaTimesCircle size={40} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="bg-info text-white shadow-sm">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Total Pendapatan</h6>
                                    <h2 className="mb-0 fw-bold">{formatCurrency(stats.totalAmount)}</h2>
                                </div>
                                <FaMoneyBillWave size={40} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Filter */}
            <Card className="shadow-sm border-0 mb-4">
                <Card.Body>
                    <Row className="g-3">
                        <Col md={4}>
                            <InputGroup>
                                <InputGroup.Text className="bg-light border-0">
                                    <FaSearch className="text-muted" />
                                </InputGroup.Text>
                                <Form.Control
                                    placeholder="Cari transaksi..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="border-0 bg-light"
                                />
                            </InputGroup>
                        </Col>
                        <Col md={3}>
                            <InputGroup>
                                <InputGroup.Text className="bg-light border-0">
                                    <FaFilter className="text-muted" />
                                </InputGroup.Text>
                                <Form.Select 
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="border-0 bg-light"
                                >
                                    <option value="pending">Menunggu Verifikasi</option>
                                    <option value="verified">Terverifikasi</option>
                                    <option value="rejected">Ditolak</option>
                                    <option value="all">Semua</option>
                                </Form.Select>
                            </InputGroup>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Tabel Pembayaran */}
            <Card className="shadow-sm border-0">
                <Card.Body>
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                        </div>
                    ) : payments.length === 0 ? (
                        <div className="text-center py-5">
                            <FaMoneyBillWave size={50} className="text-muted mb-3" />
                            <h5>Tidak Ada Pembayaran</h5>
                            <p className="text-muted">
                                {filter === 'pending' 
                                    ? 'Tidak ada pembayaran yang menunggu verifikasi'
                                    : 'Tidak ada data pembayaran'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="table-responsive">
                                <Table hover className="align-middle mb-0">
                                    <thead className="bg-light">
                                        <tr>
                                            <th>ID Transaksi</th>
                                            <th>User</th>
                                            <th>Tanggal</th>
                                            <th>Layanan</th>
                                            <th>Jumlah</th>
                                            <th>Bank</th>
                                            <th>Status</th>
                                            <th className="text-end">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.map(payment => (
                                            <tr key={payment._id}>
                                                <td>
                                                    <code>{payment.transactionId}</code>
                                                </td>
                                                <td>
                                                    <strong>{payment.userId?.name}</strong>
                                                    <br />
                                                    <small className="text-muted">
                                                        {payment.userId?.email}
                                                    </small>
                                                </td>
                                                <td>
                                                    {formatDate(payment.createdAt)}
                                                </td>
                                                <td>
                                                    {payment.paymentType === 'consultation' && (
                                                        <>
                                                            <Badge bg="info">Konsultasi</Badge>
                                                            <br />
                                                            <small className="text-muted">
                                                                dr. {payment.referenceId?.doctorId?.name}
                                                            </small>
                                                        </>
                                                    )}
                                                    {payment.paymentType === 'appointment' && 'Janji Temu'}
                                                    {payment.paymentType === 'sick_letter' && 'Surat Sakit'}
                                                    {payment.paymentType === 'medicine' && 'Pembelian Obat'}
                                                </td>
                                                <td className="fw-bold">
                                                    {formatCurrency(payment.amount)}
                                                </td>
                                                <td>
                                                    {payment.bankName === 'QRIS' ? (
                                                        <>
                                                            <FaQrcode className="me-1 text-success" />
                                                            QRIS
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FaUniversity className="me-1 text-primary" />
                                                            {payment.bankName}
                                                        </>
                                                    )}
                                                </td>
                                                <td>
                                                    {getStatusBadge(payment.status)}
                                                </td>
                                                <td className="text-end">
                                                    <Button
                                                        variant="info"
                                                        size="sm"
                                                        onClick={() => handleViewProof(payment)}
                                                    >
                                                        <FaEye className="me-1" />
                                                        Lihat Bukti
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {filter !== 'pending' && totalPages > 1 && (
                                <div className="d-flex justify-content-center mt-4">
                                    <Pagination>
                                        <Pagination.Prev 
                                            disabled={page === 1}
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                        />
                                        {[...Array(totalPages)].map((_, i) => (
                                            <Pagination.Item
                                                key={i + 1}
                                                active={i + 1 === page}
                                                onClick={() => setPage(i + 1)}
                                            >
                                                {i + 1}
                                            </Pagination.Item>
                                        ))}
                                        <Pagination.Next
                                            disabled={page === totalPages}
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        />
                                    </Pagination>
                                </div>
                            )}
                        </>
                    )}
                </Card.Body>
            </Card>

            {/* Modal Lihat Bukti Transfer */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaMoneyBillWave className="me-2 text-primary" />
                        Detail Pembayaran
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedPayment && (
                        <>
                            <Row className="mb-4">
                                <Col md={6}>
                                    <Card className="bg-light border-0">
                                        <Card.Body>
                                            <h6 className="mb-3">📋 Informasi Transaksi</h6>
                                            <p className="mb-1">
                                                <strong>ID:</strong> {selectedPayment.transactionId}
                                            </p>
                                            <p className="mb-1">
                                                <strong>Tanggal:</strong> {formatDate(selectedPayment.createdAt)}
                                            </p>
                                            <p className="mb-1">
                                                <strong>Layanan:</strong> {selectedPayment.paymentType}
                                            </p>
                                            <p className="mb-1">
                                                <strong>Jumlah:</strong> {formatCurrency(selectedPayment.amount)}
                                            </p>
                                            <p className="mb-1">
                                                <strong>Metode:</strong> {selectedPayment.bankName}
                                            </p>
                                            {selectedPayment.bankName !== 'QRIS' && (
                                                <>
                                                    <p className="mb-1">
                                                        <strong>No. Rekening:</strong> {selectedPayment.accountNumber}
                                                    </p>
                                                    <p className="mb-1">
                                                        <strong>Atas Nama:</strong> {selectedPayment.accountName}
                                                    </p>
                                                </>
                                            )}
                                            {selectedPayment.transferDate && (
                                                <p className="mb-1">
                                                    <strong>Tgl Transfer:</strong> {new Date(selectedPayment.transferDate).toLocaleDateString('id-ID')}
                                                </p>
                                            )}
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={6}>
                                    <Card className="bg-light border-0">
                                        <Card.Body>
                                            <h6 className="mb-3">👤 Informasi User</h6>
                                            <p className="mb-1">
                                                <strong>Nama:</strong> {selectedPayment.userId?.name}
                                            </p>
                                            <p className="mb-1">
                                                <strong>Email:</strong> {selectedPayment.userId?.email}
                                            </p>
                                            <p className="mb-1">
                                                <strong>Telepon:</strong> {selectedPayment.userId?.phone}
                                            </p>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>

                            {selectedPayment.paymentType === 'consultation' && (
                                <Card className="bg-light border-0 mb-4">
                                    <Card.Body>
                                        <h6 className="mb-3">🩺 Detail Konsultasi</h6>
                                        <p className="mb-1">
                                            <strong>Dokter:</strong> dr. {selectedPayment.referenceId?.doctorId?.name}
                                        </p>
                                        <p className="mb-1">
                                            <strong>Keluhan:</strong> {selectedPayment.referenceId?.symptoms}
                                        </p>
                                    </Card.Body>
                                </Card>
                            )}

                            {/* Bukti Transfer */}
                            <h6 className="mb-3">📎 Bukti Transfer</h6>
                            {selectedPayment.transferProof ? (
                                <div className="text-center border p-3 rounded bg-light">
                                    <Image 
                                        src={`http://localhost:5000${selectedPayment.transferProof}`}
                                        fluid
                                        style={{ maxHeight: '400px' }}
                                    />
                                    <div className="mt-3">
                                        <Button 
                                            variant="outline-primary"
                                            size="sm"
                                            href={`http://localhost:5000${selectedPayment.transferProof}`}
                                            target="_blank"
                                        >
                                            <FaDownload className="me-1" />
                                            Download Bukti
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Alert variant="warning">
                                    Belum ada bukti transfer yang diupload
                                </Alert>
                            )}

                            {/* Admin Notes */}
                            {selectedPayment.adminNotes && (
                                <Alert variant="info" className="mt-3">
                                    <strong>Catatan Admin:</strong>
                                    <p className="mb-0 mt-1">{selectedPayment.adminNotes}</p>
                                </Alert>
                            )}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowModal(false)}>
                        Tutup
                    </Button>
                    {selectedPayment?.status === 'pending' && (
                        <>
                            <Button 
                                variant="danger"
                                onClick={() => {
                                    setShowModal(false);
                                    setShowRejectModal(true);
                                }}
                            >
                                <FaTimesCircle className="me-1" />
                                Tolak
                            </Button>
                            <Button 
                                variant="success"
                                onClick={() => handleVerify(selectedPayment._id, 'verified')}
                            >
                                <FaCheckCircle className="me-1" />
                                Verifikasi
                            </Button>
                        </>
                    )}
                </Modal.Footer>
            </Modal>

            {/* Modal Alasan Penolakan */}
            <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Alasan Penolakan</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Catatan untuk user</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            placeholder="Contoh: Bukti tidak jelas, jumlah tidak sesuai, dll"
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
                        Batal
                    </Button>
                    <Button 
                        variant="danger"
                        onClick={() => handleVerify(selectedPayment._id, 'rejected')}
                    >
                        Tolak Pembayaran
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default VerifyPayments;