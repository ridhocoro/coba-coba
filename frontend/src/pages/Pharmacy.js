import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
    Container, Row, Col, Card, Form, Button, 
    InputGroup, Badge, Modal, Alert,
    Pagination, Spinner 
} from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
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
    FaInfoCircle,
    FaMoneyBillWave,
    FaQrcode,
    FaCopy,
    FaHistory,
    FaArrowRight,
    FaExclamationTriangle
} from 'react-icons/fa';

const Pharmacy = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { cart, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal } = useCart();
    
    // State untuk produk
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    // State untuk keranjang & checkout
    const [showCart, setShowCart] = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    
    // State untuk kurir & ongkir
    const [selectedCourier, setSelectedCourier] = useState('');
    const [courierService, setCourierService] = useState('');
    const [shippingCosts, setShippingCosts] = useState([]);
    const [shippingCost, setShippingCost] = useState(0);
    const [estimatedDays, setEstimatedDays] = useState('');
    const [loadingShipping, setLoadingShipping] = useState(false);
    
    // State untuk pembayaran
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [currentOrder, setCurrentOrder] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentExpiry, setPaymentExpiry] = useState(null);
    const [countdown, setCountdown] = useState(null);
    
    // State untuk detail obat
    const [selectedMedicine, setSelectedMedicine] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    
    // State untuk pesanan
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('shop');
    const [loadingOrders, setLoadingOrders] = useState(false);
    
    // State untuk payment flow
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
        { value: 'antibiotik', label: 'Antibiotik' },
        { value: 'vitamin', label: 'Vitamin & Suplemen' },
        { value: 'alat_kesehatan', label: 'Alat Kesehatan' }
    ];

    // ========== EFFECTS ==========
    useEffect(() => {
        if (!user) {
            toast.error('Silakan login untuk mengakses farmasi');
            navigate('/login');
            return;
        }
        
        fetchMedicines();
        fetchOrders();
        fetchBankAccounts();
    }, [currentPage, searchTerm, selectedCategory, user]);

    // Countdown timer
    useEffect(() => {
        if (!paymentExpiry) return;
        
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const expiry = new Date(paymentExpiry).getTime();
            const distance = expiry - now;
            
            if (distance < 0) {
                clearInterval(interval);
                setCountdown('00:00');
                toast.error('Waktu pembayaran telah habis');
                setShowPaymentModal(false);
            } else {
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                setCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
            }
        }, 1000);
        
        return () => clearInterval(interval);
    }, [paymentExpiry]);

    // ========== API CALLS ==========
    const fetchMedicines = async () => {
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: 12
            });
            if (searchTerm) params.append('search', searchTerm);
            if (selectedCategory) params.append('category', selectedCategory);
            
            const response = await api.get(`/api/pharmacy/medicines?${params}`);
            setMedicines(response.data.medicines || []);
            setTotalPages(response.data.totalPages || 1);
        } catch (error) {
            toast.error('Gagal memuat data obat');
        } finally {
            setLoading(false);
        }
    };

    const fetchOrders = async () => {
        setLoadingOrders(true);
        try {
            const response = await api.get('/api/pharmacy/orders');
            setOrders(response.data);
        } catch (error) {
            console.error('Gagal memuat pesanan');
        } finally {
            setLoadingOrders(false);
        }
    };

    const fetchBankAccounts = async () => {
        try {
            const response = await api.get('/api/manual-payment/bank-accounts');
            setBanks(response.data.banks);
            setQris(response.data.qris[0]);
        } catch (error) {
            console.error('Gagal memuat data bank');
        }
    };

    const fetchShippingCost = async (courier) => {
        if (!address || !courier) return;
        
        setLoadingShipping(true);
        try {
            // Hitung berat total (asumsi 1 item = 100g)
            const totalWeight = cart.reduce((sum, item) => sum + (item.quantity * 100), 0);
            
            const response = await api.post('/api/pharmacy/shipping-cost', {
                destination: address,
                weight: totalWeight,
                courier
            });
            
            setShippingCosts(response.data.costs || []);
        } catch (error) {
            toast.error('Gagal memuat ongkos kirim');
        } finally {
            setLoadingShipping(false);
        }
    };

    // ========== CHECKOUT & ORDER ==========
    const parseAddress = (addressString) => {
        return {
            street: addressString || '',
            city: 'Bogor', // Default, bisa dikembangkan
            province: 'Jawa Barat',
            postalCode: '16680',
            phone: phone || user?.phone || ''
        };
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

        if (!phone) {
            toast.error('Nomor telepon harus diisi');
            return;
        }

        setShowCart(false);
        setShowCheckout(true);
        setPaymentAmount(getCartTotal());
    };

    const createOrder = async () => {
        if (!selectedCourier || !courierService || shippingCost === 0) {
            toast.error('Pilih kurir dan layanan pengiriman');
            return;
        }

        try {
            const response = await api.post('/api/pharmacy/orders', {
                items: cart,
                address: parseAddress(address),
                courier: selectedCourier,
                courierService,
                shippingCost,
                total: getCartTotal()
            });

            setCurrentOrder(response.data.order);
            setPaymentExpiry(new Date(response.data.paymentExpiry));
            setShowCheckout(false);
            setShowPaymentModal(true);
            setStep(1);
            setPaymentAmount(response.data.order.totalAmount);

        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal membuat pesanan');
        }
    };

    const cancelOrder = async (orderId) => {
        if (!window.confirm('Yakin ingin membatalkan pesanan ini?')) return;
        
        try {
            await api.put(`/api/pharmacy/orders/${orderId}/cancel`, {
                reason: 'Dibatalkan oleh pengguna'
            });
            
            toast.success('Pesanan dibatalkan');
            fetchOrders();
            setShowPaymentModal(false);
        } catch (error) {
            toast.error('Gagal membatalkan pesanan');
        }
    };

    // ========== PAYMENT ==========
    const createTransaction = async (bankId) => {
        setStep(2);
        
        try {
            const response = await api.post('/api/manual-payment/create', {
                amount: paymentAmount,
                paymentType: 'medicine',
                referenceId: currentOrder._id,
                bankId
            });

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
            setStep(1);
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
            await api.post(`/api/manual-payment/upload-proof/${transaction.id}`, formData);
            
            // Konfirmasi pembayaran ke order
            await api.put(`/api/pharmacy/orders/${currentOrder._id}/confirm-payment`);
            
            toast.success('Pembayaran berhasil! Pesanan sedang diproses.');
            
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

    // ========== UTILITIES ==========
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
            awaiting_payment: { bg: '#fff3cd', text: '#856404', icon: FaClock, label: 'Menunggu Bayar' },
            paid: { bg: '#cce5ff', text: '#004085', icon: FaCheckCircle, label: 'Lunas' },
            processing: { bg: '#d4edda', text: '#155724', icon: FaBox, label: 'Diproses' },
            shipped: { bg: '#d4edda', text: '#155724', icon: FaTruck, label: 'Dikirim' },
            delivered: { bg: '#d4edda', text: '#155724', icon: FaCheckCircle, label: 'Terkirim' },
            expired: { bg: '#f8d7da', text: '#721c24', icon: FaExclamationTriangle, label: 'Kadaluarsa' },
            cancelled: { bg: '#f8d7da', text: '#721c24', icon: FaTrash, label: 'Dibatalkan' }
        };
        const v = variants[status] || variants.awaiting_payment;
        return (
            <span 
                className="d-inline-flex align-items-center gap-1 px-3 py-1 rounded-pill small fw-medium"
                style={{ backgroundColor: v.bg, color: v.text }}
            >
                <v.icon size={12} />
                {v.label}
            </span>
        );
    };

    return (
        <div className="pharmacy-page bg-light min-vh-100 py-5">
            <Container>
                {/* Header */}
                <Row className="mb-4">
                    <Col>
                        <div className="d-flex align-items-center">
                            <div className="bg-primary bg-opacity-10 rounded-3 p-3 me-3">
                                <FaPrescriptionBottle size={24} className="text-primary" />
                            </div>
                            <div>
                                <h4 className="fw-bold mb-1">Farmasi Online</h4>
                                <p className="text-secondary mb-0">Beli obat dengan mudah, aman, dan terpercaya</p>
                            </div>
                        </div>
                    </Col>
                </Row>

                {/* Tabs */}
                <Card className="border-0 shadow-sm mb-4">
                    <Card.Body className="p-3">
                        <div className="d-flex gap-2">
                            <Button
                                variant={activeTab === 'shop' ? 'primary' : 'light'}
                                onClick={() => setActiveTab('shop')}
                                className="rounded-pill px-4"
                                size="sm"
                            >
                                <FaSearch className="me-2" />
                                Belanja
                            </Button>
                            <Button
                                variant={activeTab === 'orders' ? 'primary' : 'light'}
                                onClick={() => setActiveTab('orders')}
                                className="rounded-pill px-4"
                                size="sm"
                            >
                                <FaHistory className="me-2" />
                                Pesanan Saya
                            </Button>
                        </div>
                    </Card.Body>
                </Card>

                {/* SHOP TAB */}
                {activeTab === 'shop' && (
                    <>
                        {/* Search and Filter */}
                        <Row className="mb-4 g-3">
                            <Col md={6}>
                                <InputGroup className="shadow-sm">
                                    <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '10px 0 0 10px' }}>
                                        <FaSearch className="text-secondary" size={14} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        placeholder="Cari obat, vitamin, atau suplemen..."
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="border-start-0 bg-white"
                                        style={{ borderRadius: '0 10px 10px 0' }}
                                    />
                                </InputGroup>
                            </Col>
                            <Col md={4}>
                                <InputGroup className="shadow-sm">
                                    <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '10px 0 0 10px' }}>
                                        <FaFilter className="text-secondary" size={14} />
                                    </InputGroup.Text>
                                    <Form.Select
                                        value={selectedCategory}
                                        onChange={(e) => {
                                            setSelectedCategory(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="border-start-0 bg-white"
                                        style={{ borderRadius: '0 10px 10px 0' }}
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
                                    variant="primary"
                                    className="position-relative w-100 h-100 d-flex align-items-center justify-content-center"
                                    style={{ borderRadius: '10px' }}
                                    onClick={() => setShowCart(true)}
                                >
                                    <FaShoppingCart size={18} />
                                    {cart.length > 0 && (
                                        <Badge 
                                            bg="danger" 
                                            className="position-absolute top-0 start-100 translate-middle rounded-pill"
                                            style={{ fontSize: '10px' }}
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
                                <div className="bg-light rounded-circle d-inline-flex p-4 mb-3">
                                    <FaPrescriptionBottle size={40} className="text-secondary" />
                                </div>
                                <h6 className="fw-bold mb-2">Tidak Ada Obat Ditemukan</h6>
                                <p className="text-secondary small">
                                    Coba gunakan kata kunci atau filter yang berbeda
                                </p>
                            </div>
                        ) : (
                            <>
                                <Row className="g-4">
                                    {medicines.map((medicine) => (
                                        <Col xl={3} lg={4} md={6} key={medicine._id}>
                                            <Card className="h-100 border-0 shadow-sm hover-card">
                                                <Card.Img 
                                                    variant="top" 
                                                    src={medicine.image || '/images/medicine-placeholder.jpg'}
                                                    style={{ height: '180px', objectFit: 'cover' }}
                                                    className="bg-light"
                                                    onClick={() => {
                                                        setSelectedMedicine(medicine);
                                                        setShowDetailModal(true);
                                                    }}
                                                    role="button"
                                                />
                                                <Card.Body className="p-3">
                                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                                        <div>
                                                            <Card.Title className="h6 fw-bold mb-1">
                                                                {medicine.name}
                                                            </Card.Title>
                                                            <Card.Text className="small text-secondary mb-2">
                                                                {medicine.genericName}
                                                            </Card.Text>
                                                        </div>
                                                        {medicine.prescription && (
                                                            <Badge bg="danger" className="ms-2 small" style={{ fontSize: '10px' }}>
                                                                Resep
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="mb-3">
                                                        <Badge bg="light" text="dark" className="me-1 small">
                                                            {categories.find(c => c.value === medicine.category)?.label || medicine.category}
                                                        </Badge>
                                                        <Badge 
                                                            bg={medicine.availableStock > 10 ? 'success' : medicine.availableStock > 0 ? 'warning' : 'danger'} 
                                                            className="small"
                                                            style={{ fontSize: '10px' }}
                                                        >
                                                            Stok: {medicine.availableStock || 0}
                                                        </Badge>
                                                    </div>

                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <span className="fw-bold text-primary">
                                                            {formatCurrency(medicine.price)}
                                                        </span>
                                                        <Button
                                                            variant="primary"
                                                            size="sm"
                                                            onClick={() => addToCart(medicine)}
                                                            disabled={medicine.availableStock === 0}
                                                            className="rounded-pill px-3"
                                                            style={{ fontSize: '12px' }}
                                                        >
                                                            <FaPlus className="me-1" size={10} />
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
                                    <div className="d-flex justify-content-center mt-5">
                                        <Pagination size="sm">
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
                )}

                {/* ORDERS TAB */}
                {activeTab === 'orders' && (
                    <Card className="border-0 shadow-sm">
                        <Card.Body className="p-4">
                            <h5 className="fw-bold mb-4 d-flex align-items-center">
                                <div className="bg-info bg-opacity-10 rounded-circle p-2 me-2">
                                    <FaBox className="text-info" size={16} />
                                </div>
                                Riwayat Pesanan
                            </h5>
                            
                            {loadingOrders ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                </div>
                            ) : orders.length === 0 ? (
                                <div className="text-center py-5">
                                    <div className="bg-light rounded-circle d-inline-flex p-4 mb-3">
                                        <FaBox size={30} className="text-secondary" />
                                    </div>
                                    <h6 className="fw-bold mb-2">Belum Ada Pesanan</h6>
                                    <p className="text-secondary small mb-4">
                                        Anda belum melakukan pemesanan obat
                                    </p>
                                    <Button 
                                        variant="primary"
                                        size="sm"
                                        className="rounded-pill px-4"
                                        onClick={() => setActiveTab('shop')}
                                    >
                                        Mulai Belanja
                                    </Button>
                                </div>
                            ) : (
                                <div className="orders-list">
                                    {orders.map(order => (
                                        <Card key={order._id} className="mb-3 border-0 bg-light">
                                            <Card.Body className="p-3">
                                                <Row>
                                                    <Col md={8}>
                                                        <div className="d-flex align-items-center mb-2">
                                                            <Badge bg="primary" className="me-2 small">
                                                                {order.orderNumber}
                                                            </Badge>
                                                            {getStatusBadge(order.status)}
                                                        </div>
                                                        
                                                        <div className="ms-2">
                                                            {order.items?.map((item, idx) => (
                                                                <div key={idx} className="d-flex justify-content-between mb-1 small">
                                                                    <span>
                                                                        {item.name}
                                                                        <span className="text-secondary ms-2">
                                                                            x{item.quantity}
                                                                        </span>
                                                                    </span>
                                                                    <span className="fw-medium">
                                                                        {formatCurrency(item.subtotal)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        
                                                        <div className="mt-2 text-secondary small">
                                                            <FaTruck className="me-1" size={10} />
                                                            {order.courier} {order.courierService} - {formatCurrency(order.shippingCost)}
                                                        </div>
                                                        
                                                        <div className="mt-1 text-secondary small">
                                                            <FaInfoCircle className="me-1" size={10} />
                                                            {order.shippingAddress?.street || 'Alamat tidak lengkap'}
                                                        </div>
                                                    </Col>
                                                    
                                                    <Col md={4} className="text-md-end mt-3 mt-md-0">
                                                        <div className="mb-2">
                                                            <span className="fw-bold text-primary">
                                                                {formatCurrency(order.totalAmount)}
                                                            </span>
                                                        </div>
                                                        
                                                        {order.trackingNumber && (
                                                            <Badge bg="info" className="mb-2 small">
                                                                No. Resi: {order.trackingNumber}
                                                            </Badge>
                                                        )}
                                                        
                                                        {order.status === 'awaiting_payment' && (
                                                            <>
                                                                <Button 
                                                                    variant="warning"
                                                                    size="sm"
                                                                    className="rounded-pill px-3 w-100 mb-2"
                                                                    onClick={() => {
                                                                        setCurrentOrder(order);
                                                                        setPaymentAmount(order.totalAmount);
                                                                        setShowPaymentModal(true);
                                                                        setStep(1);
                                                                    }}
                                                                >
                                                                    Bayar Sekarang
                                                                </Button>
                                                                <Button 
                                                                    variant="outline-danger"
                                                                    size="sm"
                                                                    className="rounded-pill px-3 w-100"
                                                                    onClick={() => cancelOrder(order._id)}
                                                                >
                                                                    Batalkan
                                                                </Button>
                                                            </>
                                                        )}
                                                        
                                                        {order.status === 'shipped' && (
                                                            <Button 
                                                                variant="success"
                                                                size="sm"
                                                                className="rounded-pill px-3 w-100"
                                                                onClick={() => toast.info('Fitur konfirmasi terima akan segera hadir')}
                                                            >
                                                                Terima Pesanan
                                                            </Button>
                                                        )}
                                                    </Col>
                                                </Row>
                                            </Card.Body>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                )}

                {/* CART MODAL */}
                <Modal show={showCart} onHide={() => setShowCart(false)} size="lg" centered>
                    <Modal.Header closeButton className="border-0 pb-0">
                        <Modal.Title className="h5 fw-bold">
                            <FaShoppingCart className="me-2 text-primary" />
                            Keranjang Belanja
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="pt-2">
                        {cart.length === 0 ? (
                            <div className="text-center py-4">
                                <div className="bg-light rounded-circle d-inline-flex p-3 mb-3">
                                    <FaShoppingCart size={24} className="text-secondary" />
                                </div>
                                <p className="text-secondary small mb-0">Keranjang belanja kosong</p>
                            </div>
                        ) : (
                            <>
                                {cart.map((item) => (
                                    <div key={item._id} className="d-flex align-items-center mb-3 pb-3 border-bottom">
                                        <img 
                                            src={item.image || '/images/medicine-placeholder.jpg'}
                                            alt={item.name}
                                            style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                                            className="rounded me-3"
                                        />
                                        <div className="flex-grow-1">
                                            <h6 className="fw-bold mb-1 small">{item.name}</h6>
                                            <small className="text-secondary">
                                                {formatCurrency(item.price)} / item
                                            </small>
                                        </div>
                                        <div className="d-flex align-items-center">
                                            <Button
                                                size="sm"
                                                variant="light"
                                                onClick={() => updateQuantity(item._id, item.quantity - 1)}
                                                className="rounded-circle p-1"
                                                style={{ width: '28px', height: '28px' }}
                                            >
                                                <FaMinus size={10} />
                                            </Button>
                                            <span className="mx-2 fw-medium small">{item.quantity}</span>
                                            <Button
                                                size="sm"
                                                variant="light"
                                                onClick={() => updateQuantity(item._id, item.quantity + 1)}
                                                className="rounded-circle p-1"
                                                style={{ width: '28px', height: '28px' }}
                                                disabled={item.quantity >= (item.availableStock || item.stock)}
                                            >
                                                <FaPlus size={10} />
                                            </Button>
                                        </div>
                                        <div className="ms-3 text-end" style={{ minWidth: '80px' }}>
                                            <div className="fw-bold text-primary small">
                                                {formatCurrency(item.price * item.quantity)}
                                            </div>
                                            <Button
                                                variant="link"
                                                className="text-danger p-0 mt-1"
                                                onClick={() => removeFromCart(item._id)}
                                            >
                                                <FaTrash size={12} />
                                            </Button>
                                        </div>
                                    </div>
                                ))}

                                <hr />
                                
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <span className="fw-medium">Subtotal</span>
                                    <h5 className="text-primary fw-bold mb-0">
                                        {formatCurrency(getCartTotal())}
                                    </h5>
                                </div>
                            </>
                        )}
                    </Modal.Body>
                    <Modal.Footer className="border-0 pt-0">
                        <Button variant="light" onClick={() => setShowCart(false)} className="rounded-pill px-4">
                            Lanjut Belanja
                        </Button>
                        {cart.length > 0 && (
                            <>
                                <Button variant="outline-danger" onClick={clearCart} className="rounded-pill px-4">
                                    <FaTrash className="me-1" />
                                    Hapus Semua
                                </Button>
                                <Button 
                                    variant="primary" 
                                    onClick={() => {
                                        setShowCart(false);
                                        setShowCheckout(true);
                                    }}
                                    className="rounded-pill px-4"
                                >
                                    Checkout
                                    <FaArrowRight className="ms-2" />
                                </Button>
                            </>
                        )}
                    </Modal.Footer>
                </Modal>

                {/* CHECKOUT MODAL */}
                <Modal show={showCheckout} onHide={() => setShowCheckout(false)} size="lg" centered>
                    <Modal.Header closeButton className="border-0 pb-0">
                        <Modal.Title className="h5 fw-bold">
                            <FaTruck className="me-2 text-primary" />
                            Checkout
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="pt-2">
                        {/* Alamat & Kontak */}
                        <Card className="border-0 bg-light mb-4">
                            <Card.Body className="p-3">
                                <h6 className="fw-bold mb-3 small">1. Informasi Pengiriman</h6>
                                
                                <Form.Group className="mb-3">
                                    <Form.Label className="small text-secondary">Nomor Telepon</Form.Label>
                                    <Form.Control
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="081234567890"
                                        className="bg-white border-0"
                                        style={{ borderRadius: '10px' }}
                                        required
                                    />
                                </Form.Group>
                                
                                <Form.Group className="mb-2">
                                    <Form.Label className="small text-secondary">Alamat Lengkap</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder="Masukkan alamat lengkap (jalan, gang, nomor rumah, RT/RW, kota, kode pos)"
                                        className="bg-white border-0"
                                        style={{ borderRadius: '10px', fontSize: '0.9rem' }}
                                        required
                                    />
                                </Form.Group>
                            </Card.Body>
                        </Card>

                        {/* Pilih Kurir */}
                        <Card className="border-0 bg-light mb-4">
                            <Card.Body className="p-3">
                                <h6 className="fw-bold mb-3 small">2. Pilih Pengiriman</h6>
                                
                                <Form.Group className="mb-3">
                                    <Form.Select
                                        value={selectedCourier}
                                        onChange={(e) => {
                                            setSelectedCourier(e.target.value);
                                            setCourierService('');
                                            setShippingCost(0);
                                            fetchShippingCost(e.target.value);
                                        }}
                                        className="bg-white border-0"
                                        style={{ borderRadius: '10px' }}
                                        disabled={!address}
                                    >
                                        <option value="">-- Pilih Kurir --</option>
                                        <option value="JNE">JNE</option>
                                        <option value="J&T">J&T Express</option>
                                        <option value="SiCepat">SiCepat</option>
                                        <option value="Pos Indonesia">Pos Indonesia</option>
                                    </Form.Select>
                                </Form.Group>

                                {/* Layanan Kurir */}
                                {loadingShipping ? (
                                    <div className="text-center py-3">
                                        <Spinner size="sm" className="me-2" />
                                        <span className="small">Memuat ongkir...</span>
                                    </div>
                                ) : shippingCosts.length > 0 && (
                                    <div className="mt-3">
                                        {shippingCosts.map((cost, idx) => (
                                            <div
                                                key={idx}
                                                className={`p-2 mb-2 rounded-3 ${courierService === cost.service ? 'bg-primary bg-opacity-10 border-primary' : 'bg-white'}`}
                                                style={{ cursor: 'pointer', border: '1px solid transparent' }}
                                                onClick={() => {
                                                    setCourierService(cost.service);
                                                    setShippingCost(cost.cost);
                                                    setEstimatedDays(cost.etd);
                                                }}
                                            >
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <span className="fw-medium">{cost.courier} {cost.service}</span>
                                                        <br />
                                                        <small className="text-secondary">
                                                            Estimasi {cost.etd} hari
                                                        </small>
                                                    </div>
                                                    <span className="fw-bold text-primary">
                                                        {formatCurrency(cost.cost)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card.Body>
                        </Card>

                        {/* Ringkasan Biaya */}
                        <Card className="border-0 bg-light mb-4">
                            <Card.Body className="p-3">
                                <h6 className="fw-bold mb-3 small">3. Ringkasan Biaya</h6>
                                
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-secondary small">Subtotal</span>
                                    <span className="fw-medium">{formatCurrency(getCartTotal())}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-secondary small">Ongkos Kirim</span>
                                    <span className="fw-medium">{formatCurrency(shippingCost)}</span>
                                </div>
                                <hr className="my-2" />
                                <div className="d-flex justify-content-between fw-bold">
                                    <span>Total</span>
                                    <span className="text-primary">{formatCurrency(getCartTotal() + shippingCost)}</span>
                                </div>
                                
                                <Alert variant="info" className="mt-3 py-2 small">
                                    <FaClock className="me-1" />
                                    Stok akan di-lock selama 15 menit setelah pesanan dibuat
                                </Alert>
                            </Card.Body>
                        </Card>
                    </Modal.Body>
                    <Modal.Footer className="border-0 pt-0">
                        <Button variant="light" onClick={() => setShowCheckout(false)} className="rounded-pill px-4">
                            Batal
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={createOrder}
                            disabled={!selectedCourier || !courierService || shippingCost === 0}
                            className="rounded-pill px-4"
                        >
                            Buat Pesanan
                        </Button>
                    </Modal.Footer>
                </Modal>

                {/* PAYMENT MODAL */}
                <Modal show={showPaymentModal} onHide={() => setShowPaymentModal(false)} size="lg" centered>
                    <Modal.Header closeButton className="border-0 pb-0">
                        <Modal.Title className="h5 fw-bold">
                            <FaMoneyBillWave className="me-2 text-primary" />
                            Pembayaran
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="pt-2">
                        {/* Countdown */}
                        {paymentExpiry && step < 4 && (
                            <Alert variant="warning" className="mb-4 text-center py-2">
                                <FaClock className="me-2" />
                                <strong>Sisa waktu: {countdown}</strong>
                                <br />
                                <small>Pesanan akan dibatalkan jika tidak dibayar</small>
                            </Alert>
                        )}

                        {/* STEP 1: Pilih Metode Pembayaran */}
                        {step === 1 && (
                            <div className="p-3">
                                <h6 className="fw-bold mb-4 text-center">Pilih Metode Pembayaran</h6>
                                <p className="text-secondary text-center small mb-4">
                                    Total pembayaran: <span className="fw-bold text-primary">{formatCurrency(paymentAmount)}</span>
                                </p>
                                
                                {/* Transfer Bank */}
                                <div className="mb-4">
                                    <h6 className="fw-semibold mb-3 small text-secondary">🏦 Transfer Bank</h6>
                                    <div className="d-flex flex-wrap gap-2">
                                        {banks.map(bank => (
                                            <Button
                                                key={bank.id}
                                                variant={selectedBank?.id === bank.id ? 'primary' : 'light'}
                                                className={`rounded-pill px-3 py-2 d-flex align-items-center ${selectedBank?.id === bank.id ? 'shadow-sm' : ''}`}
                                                onClick={() => setSelectedBank(bank)}
                                                style={{ fontSize: '0.85rem' }}
                                            >
                                                <span className="me-2">🏦</span>
                                                {bank.bankName}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* QRIS */}
                                {qris && (
                                    <div className="mb-4">
                                        <h6 className="fw-semibold mb-3 small text-secondary">📱 QRIS</h6>
                                        <Card 
                                            className={`border-0 shadow-sm text-center p-3 ${selectedBank?.id === 999 ? 'border-primary' : ''}`}
                                            style={{ cursor: 'pointer', maxWidth: '200px', margin: '0 auto' }}
                                            onClick={() => setSelectedBank({ id: 999, bankName: 'QRIS', isQRIS: true })}
                                        >
                                            <div style={{ width: '120px', height: '120px', margin: '0 auto' }}>
                                                <img 
                                                    src={qris.qrCode || '/images/qris-klinik.png'} 
                                                    alt="QRIS"
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                />
                                            </div>
                                            <p className="mt-2 mb-0 small fw-medium">{qris.merchantName}</p>
                                            <small className="text-secondary">Scan dengan e-wallet</small>
                                        </Card>
                                    </div>
                                )}

                                <div className="d-grid gap-2 mt-4">
                                    <Button
                                        variant="primary"
                                        onClick={() => createTransaction(selectedBank.id)}
                                        disabled={!selectedBank}
                                        className="rounded-pill py-2"
                                    >
                                        Lanjutkan
                                    </Button>
                                    <Button variant="light" onClick={() => setShowPaymentModal(false)} className="rounded-pill">
                                        Batal
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: Loading */}
                        {step === 2 && (
                            <div className="text-center py-5">
                                <Spinner animation="border" variant="primary" />
                                <p className="mt-3 text-secondary small">Membuat transaksi...</p>
                            </div>
                        )}

                        {/* STEP 3: Instruksi Pembayaran */}
                        {step === 3 && transaction && (
                            <div className="p-3">
                                <Alert variant="info" className="mb-4 py-2 small">
                                    <FaClock className="me-2" />
                                    <strong>Batas pembayaran:</strong> {formatDate(transaction.expiresAt)}
                                </Alert>

                                {/* Detail Pembayaran */}
                                <Card className="border-0 bg-light mb-4">
                                    <Card.Body className="p-3">
                                        <h6 className="fw-bold mb-3 small">💰 Detail Pembayaran</h6>
                                        <div className="small">
                                            <div className="d-flex justify-content-between mb-2">
                                                <span className="text-secondary">ID Transaksi:</span>
                                                <div>
                                                    <code className="bg-white p-1 rounded" style={{ fontSize: '11px' }}>{transaction.id}</code>
                                                    <Button 
                                                        variant="link" 
                                                        className="p-0 ms-2"
                                                        onClick={() => copyToClipboard(transaction.id)}
                                                    >
                                                        <FaCopy size={10} />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="d-flex justify-content-between mb-2">
                                                <span className="text-secondary">Metode:</span>
                                                <span className="fw-medium">{transaction.bank.bankName}</span>
                                            </div>
                                            {!transaction.isQRIS && (
                                                <>
                                                    <div className="d-flex justify-content-between mb-2">
                                                        <span className="text-secondary">No. Rekening:</span>
                                                        <div>
                                                            <span className="fw-medium">{transaction.bank.accountNumber}</span>
                                                            <Button 
                                                                variant="link" 
                                                                className="p-0 ms-2"
                                                                onClick={() => copyToClipboard(transaction.bank.accountNumber)}
                                                            >
                                                                <FaCopy size={10} />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="d-flex justify-content-between mb-2">
                                                        <span className="text-secondary">Atas Nama:</span>
                                                        <span className="fw-medium">{transaction.bank.accountName}</span>
                                                    </div>
                                                </>
                                            )}
                                            <div className="d-flex justify-content-between pt-2 border-top">
                                                <span className="fw-medium">Total Transfer:</span>
                                                <h6 className="text-primary mb-0">{formatCurrency(paymentAmount)}</h6>
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>

                                {/* Upload Bukti */}
                                <Card className="border-0 bg-light mb-4">
                                    <Card.Body className="p-3">
                                        <h6 className="fw-bold mb-3 small">📤 Upload Bukti Transfer</h6>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="small text-secondary">Tanggal Transfer</Form.Label>
                                            <Form.Control
                                                type="date"
                                                value={transferDate}
                                                onChange={(e) => setTransferDate(e.target.value)}
                                                max={new Date().toISOString().split('T')[0]}
                                                className="bg-white border-0"
                                                style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                                                required
                                            />
                                        </Form.Group>
                                        <Form.Group>
                                            <Form.Label className="small text-secondary">File Bukti Transfer</Form.Label>
                                            <Form.Control
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={handleFileChange}
                                                className="bg-white border-0"
                                                style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                                                required
                                            />
                                            <Form.Text className="text-secondary small">
                                                Format: JPG, PNG, PDF (maks 5MB)
                                            </Form.Text>
                                        </Form.Group>
                                    </Card.Body>
                                </Card>

                                <div className="d-grid gap-2">
                                    <Button
                                        variant="success"
                                        onClick={uploadProof}
                                        disabled={!file || !transferDate || uploading}
                                        className="rounded-pill py-2"
                                    >
                                        {uploading ? 'Mengupload...' : 'Upload & Konfirmasi'}
                                    </Button>
                                    <Button variant="light" onClick={() => setStep(1)} className="rounded-pill">
                                        Kembali
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* STEP 4: Sukses */}
                        {step === 4 && (
                            <div className="text-center py-5">
                                <div className="bg-success bg-opacity-10 rounded-circle d-inline-flex p-3 mb-3">
                                    <FaCheckCircle size={40} className="text-success" />
                                </div>
                                <h5 className="fw-bold mb-2">Pembayaran Berhasil!</h5>
                                <p className="text-secondary small mb-4">
                                    Terima kasih, pesanan Anda sedang diproses.
                                </p>
                                <Button 
                                    variant="primary"
                                    className="rounded-pill px-4"
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

                {/* DETAIL OBAT MODAL */}
                <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} centered>
                    <Modal.Header closeButton className="border-0 pb-0">
                        <Modal.Title className="h5 fw-bold">{selectedMedicine?.name}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="pt-2">
                        {selectedMedicine && (
                            <>
                                <div className="text-center mb-4">
                                    <img 
                                        src={selectedMedicine.image || '/images/medicine-placeholder.jpg'}
                                        alt={selectedMedicine.name}
                                        style={{ maxHeight: '150px', objectFit: 'contain' }}
                                        className="img-fluid"
                                    />
                                </div>

                                <div className="bg-light p-3 rounded-3">
                                    <div className="d-flex justify-content-between mb-2 small">
                                        <span className="text-secondary">Nama Generik:</span>
                                        <span className="fw-medium">{selectedMedicine.genericName || '-'}</span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-2 small">
                                        <span className="text-secondary">Kategori:</span>
                                        <Badge bg="info" className="small">
                                            {categories.find(c => c.value === selectedMedicine.category)?.label}
                                        </Badge>
                                    </div>
                                    <div className="d-flex justify-content-between mb-2 small">
                                        <span className="text-secondary">Harga:</span>
                                        <span className="fw-bold text-primary">{formatCurrency(selectedMedicine.price)}</span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-2 small">
                                        <span className="text-secondary">Stok Tersedia:</span>
                                        <Badge bg={selectedMedicine.availableStock > 0 ? 'success' : 'danger'} className="small">
                                            {selectedMedicine.availableStock || 0} item
                                        </Badge>
                                    </div>
                                    {selectedMedicine.prescription && (
                                        <div className="d-flex justify-content-between mb-2 small">
                                            <span className="text-secondary">Resep:</span>
                                            <Badge bg="danger" className="small">Memerlukan Resep Dokter</Badge>
                                        </div>
                                    )}
                                    {selectedMedicine.description && (
                                        <div className="mt-3 pt-2 border-top">
                                            <small className="text-secondary d-block">
                                                <span className="fw-medium">Deskripsi:</span> {selectedMedicine.description}
                                            </small>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </Modal.Body>
                    <Modal.Footer className="border-0 pt-0">
                        <Button variant="light" onClick={() => setShowDetailModal(false)} className="rounded-pill px-4">
                            Tutup
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={() => {
                                addToCart(selectedMedicine);
                                setShowDetailModal(false);
                            }}
                            disabled={selectedMedicine?.availableStock === 0}
                            className="rounded-pill px-4"
                        >
                            <FaShoppingCart className="me-2" />
                            Tambah ke Keranjang
                        </Button>
                    </Modal.Footer>
                </Modal>
            </Container>

            <style jsx="true">{`
                .pharmacy-page {
                    background-color: #f8f9fa;
                }
                .bg-opacity-10 {
                    opacity: 0.1;
                }
                .hover-card {
                    transition: all 0.3s ease;
                }
                .hover-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 30px rgba(0,0,0,0.1) !important;
                }
                .btn {
                    transition: all 0.2s ease;
                }
                .btn:hover {
                    transform: translateY(-2px);
                }
                .orders-list {
                    max-height: 500px;
                    overflow-y: auto;
                    padding-right: 5px;
                }
                .orders-list::-webkit-scrollbar {
                    width: 5px;
                }
                .orders-list::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                }
                .orders-list::-webkit-scrollbar-thumb {
                    background: #ccc;
                    border-radius: 10px;
                }
                .orders-list::-webkit-scrollbar-thumb:hover {
                    background: #999;
                }
            `}</style>
        </div>
    );
};

export default Pharmacy;