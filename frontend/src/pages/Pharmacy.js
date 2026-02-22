import React, { useState, useEffect } from 'react';
import { 
    Container, Row, Col, Card, Form, Button, 
    InputGroup, Badge, Modal, Table, Alert,
    Pagination, Spinner
} from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
    FaSearch, 
    FaShoppingCart, 
    FaPlus, 
    FaMinus, 
    FaTrash, 
    FaPrescriptionBottle,
    FaBox,
    FaTruck,
    FaClock,
    FaCheckCircle,
    FaFilter,
    FaStar,
    FaFire,
    FaInfoCircle,
    FaMoneyBillWave,
    FaQrcode,
    FaCopy,
    FaHistory
} from 'react-icons/fa';

const Pharmacy = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { cart, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal } = useCart();
    
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [showCart, setShowCart] = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [address, setAddress] = useState('');
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [selectedMedicine, setSelectedMedicine] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('shop');
    const [currentOrder, setCurrentOrder] = useState(null);
    const [step, setStep] = useState(1);
    const [banks, setBanks] = useState([]);
    const [qris, setQris] = useState(null);
    const [selectedBank, setSelectedBank] = useState(null);
    const [transaction, setTransaction] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [transferDate, setTransferDate] = useState('');
    const [file, setFile] = useState(null);

    const categories = [
        { value: '', label: 'Semua Kategori' },
        { value: 'obat_bebas', label: 'Obat Bebas' },
        { value: 'obat_bebas_terbatas', label: 'Obat Bebas Terbatas' },
        { value: 'obat_keras', label: 'Obat Keras (Resep)' },
        { value: 'antibiotik', label: 'Antibiotik' }
    ];

    useEffect(() => {
        // Redirect if not logged in
        if (!user) {
            toast.error('Silakan login untuk mengakses farmasi');
            navigate('/login');
            return;
        }
        
        fetchMedicines();
        fetchOrders();
        fetchBankAccounts();
    }, [currentPage, searchTerm, selectedCategory, user]);

    const fetchMedicines = async () => {
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: 12
            });
            if (searchTerm) params.append('search', searchTerm);
            if (selectedCategory) params.append('category', selectedCategory);
            
            const response = await axios.get(
                `http://localhost:5000/api/pharmacy/medicines?${params}`
            );
            
            setMedicines(response.data.medicines || []);
            setTotalPages(response.data.totalPages || 1);
        } catch (error) {
            toast.error('Gagal memuat data obat');
        } finally {
            setLoading(false);
        }
    };

    const fetchOrders = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                'http://localhost:5000/api/pharmacy/orders',
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setOrders(response.data);
        } catch (error) {
            console.error('Gagal memuat pesanan');
        }
    };

    const fetchBankAccounts = async () => {
        try {
            const response = await axios.get(
                'http://localhost:5000/api/manual-payment/bank-accounts'
            );
            setBanks(response.data.banks);
            setQris(response.data.qris[0]);
        } catch (error) {
            console.error('Gagal memuat data bank');
        }
    };

    const handleCheckout = () => {
        if (cart.length === 0) {
            toast.error('Keranjang belanja kosong');
            return;
        }

        if (!address) {
            toast.error('Alamat pengiriman harus diisi');
            return;
        }

        setShowCart(false);
        setShowCheckout(true);
        setPaymentAmount(getCartTotal());
    };

    const createOrder = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                'http://localhost:5000/api/pharmacy/orders',
                {
                    items: cart,
                    address,
                    total: getCartTotal()
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setCurrentOrder(response.data.order);
            setShowCheckout(false);
            setShowPaymentModal(true);
            setStep(1);

        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal membuat pesanan');
        }
    };

    const createTransaction = async (bankId) => {
        setStep(2);
        
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                'http://localhost:5000/api/manual-payment/create',
                {
                    amount: paymentAmount,
                    paymentType: 'medicine',
                    referenceId: currentOrder._id,
                    bankId
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setTransaction(response.data.transaction);
            
            if (response.data.transaction.isQRIS) {
                setSelectedBank({
                    bankName: 'QRIS',
                    accountName: 'Klinik Pratama IPB',
                    isQRIS: true
                });
            } else {
                setSelectedBank(banks.find(b => b.id === bankId));
            }
            
            setStep(3);
            
        } catch (error) {
            toast.error('Gagal membuat transaksi');
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.size > 5 * 1024 * 1024) {
                toast.error('File maksimal 5MB');
                return;
            }
            setFile(selectedFile);
        }
    };

    const uploadProof = async () => {
        if (!file) {
            toast.error('Pilih file bukti transfer');
            return;
        }

        if (!transferDate) {
            toast.error('Pilih tanggal transfer');
            return;
        }

        setUploading(true);

        const formData = new FormData();
        formData.append('proof', file);
        formData.append('transferDate', transferDate);

        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `http://localhost:5000/api/manual-payment/upload-proof/${transaction.id}`,
                formData,
                {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            toast.success('Bukti transfer berhasil diupload! Menunggu verifikasi admin.');
            
            // Update order status
            setStep(4);
            clearCart();
            fetchOrders();
            
        } catch (error) {
            toast.error('Gagal upload bukti transfer');
        } finally {
            setUploading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Teks berhasil disalin');
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
            pending: 'warning',
            paid: 'info',
            processing: 'primary',
            shipped: 'success',
            delivered: 'success',
            cancelled: 'danger'
        };
        const labels = {
            pending: 'Menunggu Pembayaran',
            paid: 'Menunggu Verifikasi',
            processing: 'Diproses',
            shipped: 'Dikirim',
            delivered: 'Terkirim',
            cancelled: 'Dibatalkan'
        };
        return <Badge bg={variants[status]}>{labels[status] || status}</Badge>;
    };

    return (
        <Container className="py-5">
            <Row className="mb-4">
                <Col>
                    <h2 className="mb-0">
                        <FaPrescriptionBottle className="me-2 text-primary" />
                        Farmasi Online
                    </h2>
                    <p className="text-muted">
                        Beli obat dengan mudah, aman, dan terpercaya
                    </p>
                </Col>
            </Row>

            {/* Tabs */}
            <Card className="border-0 bg-light mb-4">
                <Card.Body>
                    <div className="d-flex gap-3">
                        <Button
                            variant={activeTab === 'shop' ? 'primary' : 'light'}
                            onClick={() => setActiveTab('shop')}
                        >
                            <FaSearch className="me-2" />
                            Belanja
                        </Button>
                        <Button
                            variant={activeTab === 'orders' ? 'primary' : 'light'}
                            onClick={() => setActiveTab('orders')}
                        >
                            <FaHistory className="me-2" />
                            Pesanan Saya
                        </Button>
                    </div>
                </Card.Body>
            </Card>

            {activeTab === 'shop' ? (
                <>
                    {/* Search and Filter */}
                    <Row className="mb-4">
                        <Col md={6}>
                            <InputGroup className="shadow-sm">
                                <InputGroup.Text className="bg-white border-end-0">
                                    <FaSearch className="text-muted" />
                                </InputGroup.Text>
                                <Form.Control
                                    placeholder="Cari obat, vitamin, atau suplemen..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="border-start-0"
                                />
                            </InputGroup>
                        </Col>
                        <Col md={4}>
                            <InputGroup className="shadow-sm">
                                <InputGroup.Text className="bg-white border-end-0">
                                    <FaFilter className="text-muted" />
                                </InputGroup.Text>
                                <Form.Select
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        setSelectedCategory(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="border-start-0"
                                >
                                    {categories.map(cat => (
                                        <option key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </option>
                                    ))}
                                </Form.Select>
                            </InputGroup>
                        </Col>
                        <Col md={2}>
                            <Button 
                                variant="outline-primary"
                                className="position-relative w-100 h-100"
                                onClick={() => setShowCart(true)}
                            >
                                <FaShoppingCart />
                                {cart.length > 0 && (
                                    <Badge 
                                        bg="danger" 
                                        className="position-absolute top-0 start-100 translate-middle rounded-pill"
                                    >
                                        {cart.length}
                                    </Badge>
                                )}
                            </Button>
                        </Col>
                    </Row>

                    {/* Medicine Grid */}
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                        </div>
                    ) : medicines.length === 0 ? (
                        <div className="text-center py-5">
                            <FaPrescriptionBottle size={64} className="text-muted mb-3" />
                            <h5>Tidak Ada Obat Ditemukan</h5>
                            <p className="text-muted">
                                Coba gunakan kata kunci atau filter yang berbeda
                            </p>
                        </div>
                    ) : (
                        <>
                            <Row className="g-4">
                                {medicines.map((medicine) => (
                                    <Col xl={3} lg={4} md={6} key={medicine._id}>
                                        <Card className="h-100 shadow-sm hover-card border-0">
                                            <Card.Img 
                                                variant="top" 
                                                src={medicine.image || '/images/medicine-placeholder.jpg'}
                                                style={{ height: '200px', objectFit: 'cover' }}
                                                className="bg-light"
                                                onClick={() => {
                                                    setSelectedMedicine(medicine);
                                                    setShowDetailModal(true);
                                                }}
                                                role="button"
                                            />
                                            <Card.Body>
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <div>
                                                        <Card.Title className="h6 mb-1">
                                                            {medicine.name}
                                                        </Card.Title>
                                                        <Card.Text className="small text-muted mb-2">
                                                            {medicine.genericName}
                                                        </Card.Text>
                                                    </div>
                                                    {medicine.prescription && (
                                                        <Badge bg="danger" className="ms-2">
                                                            Resep
                                                        </Badge>
                                                    )}
                                                </div>
                                                
                                                <div className="mb-2">
                                                    <Badge bg="info" className="me-1">
                                                        {categories.find(c => c.value === medicine.category)?.label || medicine.category}
                                                    </Badge>
                                                    <Badge bg={medicine.stock > 10 ? 'success' : medicine.stock > 0 ? 'warning' : 'danger'}>
                                                        Stok: {medicine.stock}
                                                    </Badge>
                                                </div>

                                                <div className="d-flex justify-content-between align-items-center mt-3">
                                                    <div>
                                                        <span className="h6 text-primary mb-0 fw-bold">
                                                            {formatCurrency(medicine.price)}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => addToCart(medicine)}
                                                        disabled={medicine.stock === 0}
                                                        className="rounded-pill px-3"
                                                    >
                                                        <FaPlus className="me-1" />
                                                        Keranjang
                                                    </Button>
                                                </div>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="d-flex justify-content-center mt-4">
                                    <Pagination>
                                        <Pagination.Prev 
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        />
                                        {[...Array(totalPages)].map((_, i) => (
                                            <Pagination.Item
                                                key={i + 1}
                                                active={i + 1 === currentPage}
                                                onClick={() => setCurrentPage(i + 1)}
                                            >
                                                {i + 1}
                                            </Pagination.Item>
                                        ))}
                                        <Pagination.Next
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        />
                                    </Pagination>
                                </div>
                            )}
                        </>
                    )}
                </>
            ) : (
                /* Orders Tab */
                <Card className="shadow-sm border-0">
                    <Card.Body>
                        <h5 className="mb-4">📦 Riwayat Pesanan</h5>
                        {orders.length === 0 ? (
                            <div className="text-center py-5">
                                <FaBox size={48} className="text-muted mb-3" />
                                <h6>Belum Ada Pesanan</h6>
                                <p className="text-muted mb-4">
                                    Anda belum melakukan pemesanan obat
                                </p>
                                <Button 
                                    variant="primary"
                                    onClick={() => setActiveTab('shop')}
                                >
                                    Mulai Belanja
                                </Button>
                            </div>
                        ) : (
                            orders.map(order => (
                                <Card key={order._id} className="mb-3 border-0 bg-light">
                                    <Card.Body>
                                        <Row>
                                            <Col md={8}>
                                                <div className="d-flex align-items-center mb-2">
                                                    <Badge bg="primary" className="me-2">
                                                        {order.orderNumber}
                                                    </Badge>
                                                    {getStatusBadge(order.status)}
                                                </div>
                                                <div className="ms-2">
                                                    {order.items?.map((item, idx) => (
                                                        <div key={idx} className="d-flex justify-content-between mb-1">
                                                            <span>
                                                                {item.name}
                                                                <small className="text-muted ms-2">
                                                                    x{item.quantity}
                                                                </small>
                                                            </span>
                                                            <span className="fw-bold">
                                                                {formatCurrency(item.subtotal)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2 text-muted small">
                                                    <FaTruck className="me-1" />
                                                    Pengiriman ke: {order.shippingAddress?.street}, {order.shippingAddress?.city}
                                                </div>
                                                {order.estimatedDelivery && (
                                                    <div className="mt-1 text-success small">
                                                        <FaClock className="me-1" />
                                                        Estimasi: {formatDate(order.estimatedDelivery)}
                                                    </div>
                                                )}
                                            </Col>
                                            <Col md={4} className="text-end">
                                                <div className="mb-2">
                                                    <span className="fw-bold">
                                                        Total: {formatCurrency(order.totalAmount)}
                                                    </span>
                                                </div>
                                                {order.trackingNumber && (
                                                    <Badge bg="info">
                                                        No. Resi: {order.trackingNumber}
                                                    </Badge>
                                                )}
                                                {order.status === 'pending' && (
                                                    <Button 
                                                        variant="warning" 
                                                        size="sm"
                                                        className="mt-2"
                                                        onClick={() => {
                                                            setCurrentOrder(order);
                                                            setPaymentAmount(order.totalAmount);
                                                            setShowPaymentModal(true);
                                                            setStep(1);
                                                        }}
                                                    >
                                                        Bayar Sekarang
                                                    </Button>
                                                )}
                                            </Col>
                                        </Row>
                                    </Card.Body>
                                </Card>
                            ))
                        )}
                    </Card.Body>
                </Card>
            )}

            {/* Cart Modal */}
            <Modal show={showCart} onHide={() => setShowCart(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaShoppingCart className="me-2 text-primary" />
                        Keranjang Belanja
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {cart.length === 0 ? (
                        <div className="text-center py-4">
                            <FaShoppingCart size={48} className="text-muted mb-3" />
                            <h6>Keranjang belanja kosong</h6>
                            <p className="text-muted">
                                Tambahkan obat yang Anda butuhkan
                            </p>
                        </div>
                    ) : (
                        <>
                            {cart.map((item) => (
                                <div key={item._id} className="d-flex align-items-center mb-3 pb-3 border-bottom">
                                    <img 
                                        src={item.image || '/images/medicine-placeholder.jpg'}
                                        alt={item.name}
                                        style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                                        className="rounded me-3"
                                    />
                                    <div className="flex-grow-1">
                                        <h6 className="mb-1">{item.name}</h6>
                                        <small className="text-muted">
                                            {formatCurrency(item.price)} / item
                                        </small>
                                        <div className="mt-2">
                                            <Badge bg={item.stock > 10 ? 'success' : 'warning'}>
                                                Stok: {item.stock}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center">
                                        <Button
                                            size="sm"
                                            variant="outline-secondary"
                                            onClick={() => updateQuantity(item._id, item.quantity - 1)}
                                            className="rounded-circle"
                                        >
                                            <FaMinus size={12} />
                                        </Button>
                                        <span className="mx-3 fw-bold">{item.quantity}</span>
                                        <Button
                                            size="sm"
                                            variant="outline-secondary"
                                            onClick={() => updateQuantity(item._id, item.quantity + 1)}
                                            className="rounded-circle"
                                            disabled={item.quantity >= item.stock}
                                        >
                                            <FaPlus size={12} />
                                        </Button>
                                    </div>
                                    <div className="ms-4 text-end" style={{ minWidth: '100px' }}>
                                        <div className="fw-bold text-primary">
                                            {formatCurrency(item.price * item.quantity)}
                                        </div>
                                        <Button
                                            variant="link"
                                            className="text-danger p-0 mt-1"
                                            onClick={() => removeFromCart(item._id)}
                                        >
                                            <FaTrash size={14} />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <hr />

                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="mb-0">Total</h5>
                                <h4 className="text-primary fw-bold mb-0">
                                    {formatCurrency(getCartTotal())}
                                </h4>
                            </div>

                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">
                                    <FaTruck className="me-2" />
                                    Alamat Pengiriman
                                </Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Masukkan alamat lengkap (termasuk kode pos)"
                                />
                            </Form.Group>

                            <Alert variant="info" className="mb-0">
                                <FaClock className="me-2" />
                                Estimasi waktu pengiriman: 1-3 hari kerja
                            </Alert>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowCart(false)}>
                        Lanjut Belanja
                    </Button>
                    {cart.length > 0 && (
                        <>
                            <Button variant="outline-danger" onClick={clearCart}>
                                <FaTrash className="me-1" />
                                Hapus Semua
                            </Button>
                            <Button 
                                variant="primary" 
                                onClick={handleCheckout}
                                disabled={!address}
                            >
                                Checkout ({cart.length} item)
                            </Button>
                        </>
                    )}
                </Modal.Footer>
            </Modal>

            {/* Checkout Confirmation Modal */}
            <Modal show={showCheckout} onHide={() => setShowCheckout(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Konfirmasi Pesanan</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <h6>Ringkasan Pesanan:</h6>
                    {cart.map(item => (
                        <div key={item._id} className="d-flex justify-content-between mb-2">
                            <span>{item.name} x {item.quantity}</span>
                            <span>{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                    ))}
                    <hr />
                    <div className="d-flex justify-content-between fw-bold">
                        <span>Total</span>
                        <span className="text-primary">{formatCurrency(getCartTotal())}</span>
                    </div>
                    <hr />
                    <p><strong>Alamat Pengiriman:</strong> {address}</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowCheckout(false)}>
                        Batal
                    </Button>
                    <Button variant="primary" onClick={createOrder}>
                        Lanjutkan ke Pembayaran
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Payment Modal */}
            <Modal show={showPaymentModal} onHide={() => setShowPaymentModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaMoneyBillWave className="me-2 text-primary" />
                        Pembayaran
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {step === 1 && (
                        <div className="p-4">
                            <h5 className="mb-4">Pilih Metode Pembayaran</h5>
                            
                            <div className="mb-4">
                                <h6 className="mb-3">🏦 Transfer Bank</h6>
                                <Row className="g-3">
                                    {banks.map(bank => (
                                        <Col md={6} key={bank.id}>
                                            <Card 
                                                className={`bank-card ${selectedBank?.id === bank.id ? 'border-primary' : ''}`}
                                                onClick={() => setSelectedBank(bank)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <Card.Body className="d-flex align-items-center">
                                                    <div className="me-3" style={{ fontSize: '2rem' }}>
                                                        🏦
                                                    </div>
                                                    <div>
                                                        <strong>{bank.bankName}</strong>
                                                        <br />
                                                        <small className="text-muted">a.n. {bank.accountName}</small>
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    ))}
                                </Row>
                            </div>

                            {qris && (
                                <div className="mb-4">
                                    <h6 className="mb-3">📱 QRIS</h6>
                                    <Card 
                                        className={`text-center p-3 bank-card ${selectedBank?.id === 999 ? 'border-primary' : ''}`}
                                        onClick={() => setSelectedBank({ id: 999, bankName: 'QRIS', isQRIS: true })}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div style={{ width: '150px', height: '150px', margin: '0 auto' }}>
                                            <img 
                                                src={qris.qrCode || '/images/qris-klinik.png'} 
                                                alt="QRIS"
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            />
                                        </div>
                                        <p className="mt-2 mb-0">
                                            <strong>{qris.merchantName}</strong>
                                        </p>
                                    </Card>
                                </div>
                            )}

                            <div className="d-grid gap-2 mt-4">
                                <Button
                                    variant="primary"
                                    size="lg"
                                    onClick={() => createTransaction(selectedBank.id)}
                                    disabled={!selectedBank}
                                >
                                    Lanjutkan
                                </Button>
                                <Button variant="outline-secondary" onClick={() => setShowPaymentModal(false)}>
                                    Batal
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-3">Membuat transaksi...</p>
                        </div>
                    )}

                    {step === 3 && transaction && (
                        <div className="p-4">
                            <Alert variant="info" className="mb-4">
                                <FaClock className="me-2" />
                                <strong>Batas pembayaran:</strong> {formatDate(transaction.expiresAt)}
                            </Alert>

                            <Card className="mb-4 border-success">
                                <Card.Header className="bg-success text-white">
                                    <h6 className="mb-0">💰 Detail Pembayaran</h6>
                                </Card.Header>
                                <Card.Body>
                                    <Table borderless size="sm">
                                        <tbody>
                                            <tr>
                                                <td className="text-muted">ID Transaksi:</td>
                                                <td>
                                                    <code>{transaction.id}</code>
                                                    <Button 
                                                        variant="link" 
                                                        className="p-0 ms-2"
                                                        onClick={() => copyToClipboard(transaction.id)}
                                                    >
                                                        <FaCopy size={12} />
                                                    </Button>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="text-muted">Metode:</td>
                                                <td><strong>{transaction.bank.bankName}</strong></td>
                                            </tr>
                                            {!transaction.isQRIS && (
                                                <>
                                                    <tr>
                                                        <td className="text-muted">Nomor Rekening:</td>
                                                        <td>
                                                            <strong>{transaction.bank.accountNumber}</strong>
                                                            <Button 
                                                                variant="link" 
                                                                className="p-0 ms-2"
                                                                onClick={() => copyToClipboard(transaction.bank.accountNumber)}
                                                            >
                                                                <FaCopy size={12} />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td className="text-muted">Atas Nama:</td>
                                                        <td><strong>{transaction.bank.accountName}</strong></td>
                                                    </tr>
                                                </>
                                            )}
                                            <tr>
                                                <td className="text-muted">Total Transfer:</td>
                                                <td><h5 className="text-primary mb-0">{formatCurrency(paymentAmount)}</h5></td>
                                            </tr>
                                        </tbody>
                                    </Table>
                                </Card.Body>
                            </Card>

                            <Card className="mb-4">
                                <Card.Header>
                                    <h6 className="mb-0">📤 Upload Bukti Transfer</h6>
                                </Card.Header>
                                <Card.Body>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Tanggal Transfer</Form.Label>
                                        <Form.Control
                                            type="date"
                                            value={transferDate}
                                            onChange={(e) => setTransferDate(e.target.value)}
                                            max={new Date().toISOString().split('T')[0]}
                                            required
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label>File Bukti Transfer</Form.Label>
                                        <Form.Control
                                            type="file"
                                            accept="image/*,.pdf"
                                            onChange={handleFileChange}
                                            required
                                        />
                                    </Form.Group>
                                </Card.Body>
                            </Card>

                            <div className="d-grid gap-2">
                                <Button
                                    variant="success"
                                    size="lg"
                                    onClick={uploadProof}
                                    disabled={!file || !transferDate || uploading}
                                >
                                    {uploading ? 'Mengupload...' : 'Upload & Konfirmasi'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="text-center py-5">
                            <FaCheckCircle size={64} className="text-success mb-3" />
                            <h5>Bukti Transfer Terkirim!</h5>
                            <p className="text-muted">
                                Terima kasih, bukti transfer Anda sedang diverifikasi oleh admin.
                            </p>
                            <Button 
                                variant="primary" 
                                className="mt-3"
                                onClick={() => {
                                    setShowPaymentModal(false);
                                    setActiveTab('orders');
                                }}
                            >
                                Lihat Pesanan Saya
                            </Button>
                        </div>
                    )}
                </Modal.Body>
            </Modal>

            {/* Medicine Detail Modal */}
            <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="md">
                <Modal.Header closeButton>
                    <Modal.Title>{selectedMedicine?.name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedMedicine && (
                        <>
                            <div className="text-center mb-4">
                                <img 
                                    src={selectedMedicine.image || '/images/medicine-placeholder.jpg'}
                                    alt={selectedMedicine.name}
                                    style={{ maxHeight: '200px', objectFit: 'contain' }}
                                    className="img-fluid"
                                />
                            </div>

                            <Table borderless size="sm">
                                <tbody>
                                    <tr>
                                        <th style={{ width: '40%' }}>Nama Generik</th>
                                        <td>{selectedMedicine.genericName || '-'}</td>
                                    </tr>
                                    <tr>
                                        <th>Kategori</th>
                                        <td>
                                            <Badge bg="info">
                                                {categories.find(c => c.value === selectedMedicine.category)?.label}
                                            </Badge>
                                        </td>
                                    </tr>
                                    <tr>
                                        <th>Harga</th>
                                        <td className="text-primary fw-bold">
                                            {formatCurrency(selectedMedicine.price)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <th>Stok</th>
                                        <td>
                                            <Badge bg={selectedMedicine.stock > 0 ? 'success' : 'danger'}>
                                                {selectedMedicine.stock > 0 ? `${selectedMedicine.stock} tersedia` : 'Stok habis'}
                                            </Badge>
                                        </td>
                                    </tr>
                                    {selectedMedicine.prescription && (
                                        <tr>
                                            <th>Resep</th>
                                            <td>
                                                <Badge bg="danger">Memerlukan Resep Dokter</Badge>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </Table>

                            <div className="mt-3">
                                <h6>Deskripsi</h6>
                                <p className="text-muted">
                                    {selectedMedicine.description || 'Tidak ada deskripsi tersedia'}
                                </p>
                            </div>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                        Tutup
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={() => {
                            addToCart(selectedMedicine);
                            setShowDetailModal(false);
                        }}
                        disabled={selectedMedicine?.stock === 0}
                    >
                        <FaShoppingCart className="me-2" />
                        Tambah ke Keranjang
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default Pharmacy;