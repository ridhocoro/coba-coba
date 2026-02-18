import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Form, InputGroup } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
    FaMoneyBillWave, 
    FaSearch, 
    FaDownload, 
    FaFileInvoice, 
    FaCheckCircle,
    FaTimesCircle,
    FaClock,
    FaFilter,
    FaPrint
} from 'react-icons/fa';

const PaymentHistory = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [stats, setStats] = useState({
        totalSpent: 0,
        totalTransactions: 0,
        successRate: 0
    });

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchPaymentHistory();
    }, [user]);

    const fetchPaymentHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                'http://localhost:5000/api/payments/history',
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPayments(response.data);
            calculateStats(response.data);
        } catch (error) {
            toast.error('Gagal memuat riwayat pembayaran');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (paymentData) => {
        const total = paymentData.reduce((sum, p) => sum + (p.status === 'paid' ? p.amount : 0), 0);
        const success = paymentData.filter(p => p.status === 'paid').length;
        const rate = paymentData.length > 0 ? (success / paymentData.length * 100) : 0;
        
        setStats({
            totalSpent: total,
            totalTransactions: paymentData.length,
            successRate: rate.toFixed(1)
        });
    };

    const getStatusBadge = (status) => {
        const variants = {
            pending: { bg: 'warning', icon: FaClock, text: 'Menunggu' },
            paid: { bg: 'success', icon: FaCheckCircle, text: 'Berhasil' },
            failed: { bg: 'danger', icon: FaTimesCircle, text: 'Gagal' },
            refunded: { bg: 'info', icon: FaMoneyBillWave, text: 'Refund' }
        };
        const variant = variants[status] || variants.pending;
        return (
            <Badge bg={variant.bg} className="d-flex align-items-center gap-1" style={{ width: 'fit-content' }}>
                <variant.icon size={12} />
                <span>{variant.text}</span>
            </Badge>
        );
    };

    const getPaymentTypeLabel = (type) => {
        const types = {
            consultation: 'Konsultasi Online',
            sick_letter: 'Surat Sakit',
            medicine: 'Pembelian Obat',
            appointment: 'Janji Temu'
        };
        return types[type] || type;
    };

    const getFilteredPayments = () => {
        let filtered = [...payments];

        // Search
        if (searchTerm) {
            filtered = filtered.filter(p => 
                p.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                getPaymentTypeLabel(p.paymentType).toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filter by status
        if (filterStatus !== 'all') {
            filtered = filtered.filter(p => p.status === filterStatus);
        }

        // Filter by type
        if (filterType !== 'all') {
            filtered = filtered.filter(p => p.paymentType === filterType);
        }

        // Sort
        filtered.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
        });

        return filtered;
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount || 0);
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

    const downloadInvoice = (payment) => {
        // Create invoice content
        const invoice = `
            INVOICE #${payment.transactionId}
            ================================
            Tanggal: ${formatDate(payment.createdAt)}
            Tipe: ${getPaymentTypeLabel(payment.paymentType)}
            Status: ${payment.status}
            
            Detail Transaksi:
            ID: ${payment._id}
            
            Jumlah: ${formatCurrency(payment.amount)}
            
            Terima kasih telah menggunakan layanan Klinik Pratama IPB.
            ================================
        `;

        // Download as text file
        const blob = new Blob([invoice], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-${payment.transactionId}.txt`;
        link.click();
        window.URL.revokeObjectURL(url);
        
        toast.success('Invoice berhasil diunduh');
    };

    const printInvoice = (payment) => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Invoice ${payment.transactionId}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; }
                        .invoice-header { text-align: center; margin-bottom: 30px; }
                        .invoice-details { margin-bottom: 20px; }
                        .status-paid { color: green; }
                        .status-pending { color: orange; }
                        .status-failed { color: red; }
                    </style>
                </head>
                <body>
                    <div class="invoice-header">
                        <h1>Klinik Pratama IPB</h1>
                        <h3>INVOICE</h3>
                        <p>${payment.transactionId}</p>
                    </div>
                    <div class="invoice-details">
                        <p><strong>Tanggal:</strong> ${formatDate(payment.createdAt)}</p>
                        <p><strong>Layanan:</strong> ${getPaymentTypeLabel(payment.paymentType)}</p>
                        <p><strong>Status:</strong> <span class="status-${payment.status}">${payment.status}</span></p>
                        <p><strong>Jumlah:</strong> ${formatCurrency(payment.amount)}</p>
                    </div>
                    <hr />
                    <p>Terima kasih telah menggunakan layanan kami.</p>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    if (loading) {
        return (
            <Container className="py-5 text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </Container>
        );
    }

    const filteredPayments = getFilteredPayments();

    return (
        <Container className="py-5">
            {/* Header */}
            <Row className="mb-4">
                <Col>
                    <h2 className="mb-0">
                        <FaMoneyBillWave className="me-2 text-primary" />
                        Riwayat Transaksi
                    </h2>
                    <p className="text-muted">
                        Kelola dan lihat semua riwayat pembayaran Anda
                    </p>
                </Col>
            </Row>

            {/* Stats Cards */}
            <Row className="mb-4 g-4">
                <Col md={4}>
                    <Card className="shadow-sm border-0 bg-gradient-success text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Total Pengeluaran</h6>
                                    <h3 className="mb-0 fw-bold">{formatCurrency(stats.totalSpent)}</h3>
                                </div>
                                <FaMoneyBillWave size={48} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="shadow-sm border-0 bg-gradient-info text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Total Transaksi</h6>
                                    <h3 className="mb-0 fw-bold">{stats.totalTransactions}</h3>
                                </div>
                                <FaFileInvoice size={48} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="shadow-sm border-0 bg-gradient-warning text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Tingkat Keberhasilan</h6>
                                    <h3 className="mb-0 fw-bold">{stats.successRate}%</h3>
                                </div>
                                <FaCheckCircle size={48} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Filters */}
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
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="border-0 bg-light"
                                />
                            </InputGroup>
                        </Col>
                        <Col md={3}>
                            <Form.Select 
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="border-0 bg-light"
                            >
                                <option value="all">Semua Status</option>
                                <option value="paid">Berhasil</option>
                                <option value="pending">Menunggu</option>
                                <option value="failed">Gagal</option>
                                <option value="refunded">Refund</option>
                            </Form.Select>
                        </Col>
                        <Col md={3}>
                            <Form.Select 
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="border-0 bg-light"
                            >
                                <option value="all">Semua Layanan</option>
                                <option value="consultation">Konsultasi</option>
                                <option value="sick_letter">Surat Sakit</option>
                                <option value="medicine">Pembelian Obat</option>
                                <option value="appointment">Janji Temu</option>
                            </Form.Select>
                        </Col>
                        <Col md={2}>
                            <Form.Select 
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="border-0 bg-light"
                            >
                                <option value="newest">Terbaru</option>
                                <option value="oldest">Terlama</option>
                            </Form.Select>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Transactions Table */}
            <Card className="shadow-sm border-0">
                <Card.Body>
                    {filteredPayments.length === 0 ? (
                        <div className="text-center py-5">
                            <FaMoneyBillWave size={64} className="text-muted mb-3" />
                            <h5>Belum Ada Transaksi</h5>
                            <p className="text-muted mb-4">
                                {searchTerm || filterStatus !== 'all' || filterType !== 'all'
                                    ? 'Tidak ada transaksi yang sesuai dengan filter'
                                    : 'Anda belum memiliki riwayat transaksi'}
                            </p>
                            {!searchTerm && filterStatus === 'all' && filterType === 'all' && (
                                <div className="d-flex gap-3 justify-content-center">
                                    <Button variant="primary" href="/consultations">
                                        Konsultasi Online
                                    </Button>
                                    <Button variant="outline-primary" href="/pharmacy">
                                        Beli Obat
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover className="align-middle mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th>ID Transaksi</th>
                                        <th>Tanggal</th>
                                        <th>Layanan</th>
                                        <th>Jumlah</th>
                                        <th>Status</th>
                                        <th className="text-end">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPayments.map(payment => (
                                        <tr key={payment._id}>
                                            <td>
                                                <div className="d-flex align-items-center">
                                                    <FaFileInvoice className="text-primary me-2" />
                                                    <span className="font-monospace small">
                                                        {payment.transactionId || payment._id.slice(-8)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <div>{formatDate(payment.createdAt)}</div>
                                                <small className="text-muted">
                                                    {new Date(payment.createdAt).toLocaleTimeString('id-ID')}
                                                </small>
                                            </td>
                                            <td>
                                                <div className="fw-medium">
                                                    {getPaymentTypeLabel(payment.paymentType)}
                                                </div>
                                                <small className="text-muted">
                                                    {payment.paymentMethod || 'Stripe'}
                                                </small>
                                            </td>
                                            <td className="fw-bold">
                                                {formatCurrency(payment.amount)}
                                            </td>
                                            <td>
                                                {getStatusBadge(payment.status)}
                                            </td>
                                            <td>
                                                <div className="d-flex gap-2 justify-content-end">
                                                    {payment.status === 'paid' && (
                                                        <>
                                                            <Button
                                                                variant="outline-primary"
                                                                size="sm"
                                                                onClick={() => downloadInvoice(payment)}
                                                            >
                                                                <FaDownload className="me-1" />
                                                                Invoice
                                                            </Button>
                                                            <Button
                                                                variant="outline-secondary"
                                                                size="sm"
                                                                onClick={() => printInvoice(payment)}
                                                            >
                                                                <FaPrint />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {payment.status === 'pending' && (
                                                        <Badge bg="warning" className="px-3 py-2">
                                                            Menunggu Pembayaran
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
};

export default PaymentHistory;