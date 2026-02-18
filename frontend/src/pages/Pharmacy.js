import React, { useState, useEffect } from 'react';
import { 
    Container, Row, Col, Card, Form, Button, 
    InputGroup, Badge, Modal, Table, Alert,
    Pagination
} from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
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
    FaInfoCircle
} from 'react-icons/fa';

const Pharmacy = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [cart, setCart] = useState([]);
    const [showCart, setShowCart] = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);
    const [address, setAddress] = useState('');
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [selectedMedicine, setSelectedMedicine] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('shop');
    const [recommendations, setRecommendations] = useState([]);
    const [processing, setProcessing] = useState(false);

    const categories = [
        { value: '', label: 'Semua Kategori' },
        { value: 'obat_bebas', label: 'Obat Bebas' },
        { value: 'obat_bebas_terbatas', label: 'Obat Bebas Terbatas' },
        { value: 'obat_keras', label: 'Obat Keras (Resep)' },
        { value: 'antibiotik', label: 'Antibiotik' }
    ];

    useEffect(() => {
        fetchMedicines();
        if (user) {
            fetchOrders();
        }
        loadCart();
        generateRecommendations();
    }, [currentPage, searchTerm, selectedCategory]);

    useEffect(() => {
        saveCart();
    }, [cart]);

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
            
            setMedicines(response.data.medicines || response.data);
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

    const loadCart = () => {
        const savedCart = localStorage.getItem('pharmacy_cart');
        if (savedCart) {
            setCart(JSON.parse(savedCart));
        }
    };

    const saveCart = () => {
        localStorage.setItem('pharmacy_cart', JSON.stringify(cart));
    };

    const generateRecommendations = () => {
        const recs = [
            { name: 'Paracetamol', usage: 'Pereda demam & nyeri', icon: FaFire },
            { name: 'Vitamin C', usage: 'Meningkatkan imunitas', icon: FaStar },
            { name: 'Antasida', usage: 'Mengatasi maag', icon: FaPrescriptionBottle }
        ];
        setRecommendations(recs);
    };

    const addToCart = (medicine) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item._id === medicine._id);
            
            if (existingItem) {
                if (existingItem.quantity >= medicine.stock) {
                    toast.error(`Stok ${medicine.name} hanya tersedia ${medicine.stock}`);
                    return prevCart;
                }
                return prevCart.map(item =>
                    item._id === medicine._id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            
            return [...prevCart, { ...medicine, quantity: 1 }];
        });
        
        toast.success(`${medicine.name} ditambahkan ke keranjang`);
    };

    const removeFromCart = (medicineId) => {
        setCart(prevCart => prevCart.filter(item => item._id !== medicineId));
        toast.info('Item dihapus dari keranjang');
    };

    const updateQuantity = (medicineId, newQuantity) => {
        if (newQuantity < 1) {
            removeFromCart(medicineId);
            return;
        }

        setCart(prevCart =>
            prevCart.map(item => {
                if (item._id === medicineId) {
                    if (newQuantity > item.stock) {
                        toast.error(`Stok ${item.name} hanya tersedia ${item.stock}`);
                        return item;
                    }
                    return { ...item, quantity: newQuantity };
                }
                return item;
            })
        );
    };

    const getCartTotal = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    };

    const handleCheckout = () => {
        if (!user) {
            toast.error('Silakan login terlebih dahulu');
            navigate('/login');
            return;
        }

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

    const clearCart = () => {
        if (window.confirm('Hapus semua item dari keranjang?')) {
            setCart([]);
            toast.info('Keranjang belanja dikosongkan');
        }
    };

    const handleMockPayment = async () => {
        setProcessing(true);
        
        try {
            const token = localStorage.getItem('token');
            
            // Create mock payment
            const paymentResponse = await axios.post(
                'http://localhost:5000/api/payments/create-payment-intent',
                {
                    amount: paymentAmount,
                    paymentType: 'medicine',
                    referenceId: 'cart-' + Date.now()
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Create order
            await axios.post(
                'http://localhost:5000/api/pharmacy/orders',
                {
                    items: cart,
                    address,
                    paymentId: paymentResponse.data.paymentId,
                    total: paymentAmount
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success('✅ Pembayaran berhasil! Obat akan segera diproses.');
            setCart([]);
            setShowCheckout(false);
            setAddress('');
            fetchOrders();
            setActiveTab('orders');
            
        } catch (error) {
            toast.error('Pembayaran gagal');
        } finally {
            setProcessing(false);
        }
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
            pending: 'Menunggu',
            paid: 'Dibayar',
            processing: 'Diproses',
            shipped: 'Dikirim',
            delivered: 'Terkirim',
            cancelled: 'Dibatalkan'
        };
        return <Badge bg={variants[status]}>{labels[status] || status}</Badge>;
    };

    const formatCurrency = (amount) => {
        return `Rp ${amount?.toLocaleString() || 0}`;
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const MockCheckoutForm = () => {
        return (
            <div className="p-3">
                <Alert variant="warning" className="mb-4">
                    <div className="d-flex align-items-center">
                        <span className="badge bg-dark me-3">🔧 DEV MODE</span>
                        <div>
                            <strong className="d-block">Stripe Nonaktif</strong>
                            <small>Testing pembayaran tanpa kartu kredit</small>
                        </div>
                    </div>
                </Alert>

                <div className="bg-light p-3 rounded mb-4">
                    <h6 className="mb-3">📦 Ringkasan Pesanan</h6>
                    {cart.map(item => (
                        <div key={item._id} className="d-flex justify-content-between mb-2">
                            <span>
                                {item.name} x {item.quantity}
                            </span>
                            <span className="fw-bold">
                                {formatCurrency(item.price * item.quantity)}
                            </span>
                        </div>
                    ))}
                    <hr />
                    <div className="d-flex justify-content-between">
                        <span className="fw-bold">Total:</span>
                        <span className="fw-bold text-primary h5">
                            {formatCurrency(paymentAmount)}
                        </span>
                    </div>
                </div>

                <div className="d-grid gap-2">
                    <Button
                        variant="success"
                        size="lg"
                        onClick={handleMockPayment}
                        disabled={processing}
                    >
                        {processing ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" />
                                Memproses...
                            </>
                        ) : (
                            '✅ Bayar Sekarang (Test)'
                        )}
                    </Button>
                    
                    <Button
                        variant="outline-secondary"
                        onClick={() => setShowCheckout(false)}
                        disabled={processing}
                    >
                        Batal
                    </Button>
                </div>

                <p className="text-muted small text-center mt-3 mb-0">
                    ⏱️ Estimasi pengiriman: 1-3 hari kerja
                </p>
            </div>
        );
    };

    return (
        <Container className="py-5">
            {/* Header */}
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
                        {user && (
                            <Button
                                variant={activeTab === 'orders' ? 'primary' : 'light'}
                                onClick={() => setActiveTab('orders')}
                            >
                                <FaBox className="me-2" />
                                Pesanan Saya
                            </Button>
                        )}
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

                    {/* Recommendations */}
                    {!searchTerm && !selectedCategory && medicines.length > 0 && (
                        <Row className="mb-4">
                            <Col>
                                <Card className="border-0 bg-gradient-primary text-white">
                                    <Card.Body>
                                        <h5 className="mb-3">🔥 Rekomendasi Hari Ini</h5>
                                        <Row>
                                            {recommendations.map((rec, idx) => (
                                                <Col md={4} key={idx}>
                                                    <div className="d-flex align-items-center">
                                                        <rec.icon size={24} className="me-2" />
                                                        <div>
                                                            <strong>{rec.name}</strong>
                                                            <br />
                                                            <small>{rec.usage}</small>
                                                        </div>
                                                    </div>
                                                </Col>
                                            ))}
                                        </Row>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {/* Medicine Grid */}
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
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
                                                        {formatDate(order.createdAt)}
                                                    </Badge>
                                                    {getStatusBadge(order.status)}
                                                </div>
                                                <div className="ms-2">
                                                    {order.items?.map((item, idx) => (
                                                        <div key={idx} className="d-flex justify-content-between mb-1">
                                                            <span>
                                                                {item.medicineId?.name || 'Produk'}
                                                                <small className="text-muted ms-2">
                                                                    x{item.quantity}
                                                                </small>
                                                            </span>
                                                            <span className="fw-bold">
                                                                {formatCurrency(item.price * item.quantity)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2 text-muted small">
                                                    <FaTruck className="me-1" />
                                                    Pengiriman ke: {order.shippingAddress}
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
                                <br />
                                <small className="text-muted">
                                    *Gratis ongkir untuk pembelian di atas Rp 100.000
                                </small>
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
                            if (selectedMedicine) {
                                addToCart(selectedMedicine);
                                setShowDetailModal(false);
                            }
                        }}
                        disabled={selectedMedicine?.stock === 0}
                    >
                        <FaShoppingCart className="me-2" />
                        Tambah ke Keranjang
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Checkout Modal */}
            <Modal show={showCheckout} onHide={() => setShowCheckout(false)} size="md">
                <Modal.Header closeButton>
                    <Modal.Title>Pembayaran</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <MockCheckoutForm />
                </Modal.Body>
            </Modal>

            <style jsx="true">{`
                .bg-gradient-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .hover-card {
                    transition: all 0.3s ease;
                    cursor: pointer;
                }
                .hover-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important;
                }
            `}</style>
        </Container>
    );
};

export default Pharmacy;