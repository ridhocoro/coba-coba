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
    FaExclamationTriangle,
    FaTimes,
    FaChevronLeft,
    FaChevronRight,
    FaStar,
    FaMapMarkerAlt,
    FaPhone,
    FaUser,
    FaCreditCard,
    FaUniversity,
    FaImage
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
        if (!address.trim()) {
            toast.error('Alamat pengiriman harus diisi');
            return;
        }

        if (!phone.trim()) {
            toast.error('Nomor telepon harus diisi');
            return;
        }

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

    const confirmReceipt = async (orderId) => {
        if (!window.confirm('Konfirmasi pesanan sudah diterima?')) return;
        try {
            await api.put(`/api/pharmacy/orders/${orderId}/confirm-receipt`);
            toast.success('Pesanan dikonfirmasi diterima!');
            fetchOrders();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal mengkonfirmasi penerimaan');
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
            awaiting_payment: { bg: '#fef3c7', color: '#b45309', icon: FaClock, label: 'Menunggu Bayar' },
            paid: { bg: '#dbeafe', color: '#1e40af', icon: FaCheckCircle, label: 'Lunas' },
            processing: { bg: '#dcfce7', color: '#166534', icon: FaBox, label: 'Diproses' },
            shipped: { bg: '#ede9fe', color: '#6d28d9', icon: FaTruck, label: 'Dikirim' },
            delivered: { bg: '#dcfce7', color: '#166534', icon: FaCheckCircle, label: 'Diterima' },
            expired: { bg: '#fee2e2', color: '#b91c1c', icon: FaExclamationTriangle, label: 'Kadaluarsa' },
            cancelled: { bg: '#f1f5f9', color: '#475569', icon: FaTrash, label: 'Dibatalkan' }
        };
        const v = variants[status] || variants.awaiting_payment;
        return (
            <span style={{
                background: v.bg,
                color: v.color,
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                <v.icon size={12} />
                {v.label}
            </span>
        );
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: '24px' }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            
            <style>{`
                .page-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 24px;
                    gap: 16px;
                }
                .header-icon {
                    width: 52px;
                    height: 52px;
                    background: #dcfce7;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #16a34a;
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
                .tab-container {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 24px;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 4px;
                }
                .tab-button {
                    padding: 10px 20px;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 500;
                    border: none;
                    background: transparent;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex: 1;
                    justify-content: center;
                }
                .tab-button:hover {
                    background: #f1f5f9;
                    color: #0f172a;
                }
                .tab-button.active {
                    background: #2563eb;
                    color: white;
                }
                .search-container {
                    position: relative;
                    flex: 1;
                }
                .search-icon {
                    position: absolute;
                    left: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8;
                    font-size: 14px;
                }
                .search-input {
                    width: 100%;
                    padding: 12px 16px 12px 45px;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    font-size: 14px;
                    background: #ffffff;
                }
                .search-input:focus {
                    outline: none;
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
                }
                .filter-select {
                    padding: 12px 16px;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    font-size: 14px;
                    background: #ffffff;
                    width: 100%;
                }
                .filter-select:focus {
                    outline: none;
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
                }
                .cart-button {
                    background: #2563eb;
                    border: none;
                    border-radius: 12px;
                    padding: 12px 20px;
                    color: white;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    height: 100%;
                }
                .cart-button:hover {
                    background: #1d4ed8;
                }
                .cart-badge {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #b91c1c;
                    color: white;
                    border-radius: 20px;
                    padding: 2px 6px;
                    font-size: 10px;
                    font-weight: 600;
                }
                .product-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    overflow: hidden;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    height: 100%;
                }
                .product-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px -8px rgba(0,0,0,0.1);
                }
                .product-image {
                    height: 180px;
                    object-fit: cover;
                    width: 100%;
                    background: #f8fafc;
                }
                .product-badge {
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 500;
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
                .btn-custom {
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 500;
                    border: none;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                }
                .btn-custom-primary {
                    background: #2563eb;
                    color: white;
                }
                .btn-custom-primary:hover {
                    background: #1d4ed8;
                }
                .btn-custom-success {
                    background: #16a34a;
                    color: white;
                }
                .btn-custom-success:hover {
                    background: #15803d;
                }
                .btn-custom-outline {
                    background: transparent;
                    border: 1px solid #e2e8f0;
                    color: #475569;
                }
                .btn-custom-outline:hover {
                    background: #f1f5f9;
                }
                .cart-item {
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .cart-item:last-child {
                    border-bottom: none;
                }
                .quantity-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    background: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .quantity-btn:hover {
                    background: #f1f5f9;
                }
                .order-card {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 20px;
                    margin-bottom: 16px;
                }
                .payment-option {
                    border: 2px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 16px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .payment-option:hover {
                    border-color: #2563eb;
                    background: #f8fafc;
                }
                .payment-option.selected {
                    border-color: #2563eb;
                    background: #eff6ff;
                }
                .qris-image {
                    width: 160px;
                    height: 160px;
                    object-fit: contain;
                    margin: 0 auto 16px;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 8px;
                }
                .orders-list {
                    max-height: 500px;
                    overflow-y: auto;
                    padding-right: 8px;
                }
                .orders-list::-webkit-scrollbar {
                    width: 6px;
                }
                .orders-list::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 10px;
                }
                .orders-list::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
            `}</style>

            <Container fluid style={{ maxWidth: 1200, margin: '0 auto' }}>
                {/* Header */}
                <div className="page-header">
                    <div className="header-icon">
                        <FaPrescriptionBottle size={24} />
                    </div>
                    <div className="header-title">
                        <h1>Farmasi Online</h1>
                        <p>Beli obat dengan mudah, aman, dan terpercaya</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="tab-container">
                    <button
                        className={`tab-button ${activeTab === 'shop' ? 'active' : ''}`}
                        onClick={() => setActiveTab('shop')}
                    >
                        <FaSearch /> Belanja
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'orders' ? 'active' : ''}`}
                        onClick={() => setActiveTab('orders')}
                    >
                        <FaHistory /> Pesanan Saya
                    </button>
                </div>

                {/* SHOP TAB */}
                {activeTab === 'shop' && (
                    <>
                        {/* Search and Filter */}
                        <Row className="g-3 mb-4">
                            <Col md={6}>
                                <div className="search-container">
                                    <FaSearch className="search-icon" />
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Cari obat, vitamin, atau suplemen..."
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                    />
                                </div>
                            </Col>
                            <Col md={4}>
                                <select
                                    className="filter-select"
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        setSelectedCategory(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                >
                                    {categories.map(cat => (
                                        <option key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </option>
                                    ))}
                                </select>
                            </Col>
                            <Col md={2}>
                                <div style={{ position: 'relative', height: '100%' }}>
                                    <button className="cart-button" onClick={() => setShowCart(true)}>
                                        <FaShoppingCart />
                                        <span>Keranjang</span>
                                        {cart.length > 0 && (
                                            <span className="cart-badge">{cart.length}</span>
                                        )}
                                    </button>
                                </div>
                            </Col>
                        </Row>

                        {/* Medicine Grid */}
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '60px' }}>
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : medicines.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px' }}>
                                <div style={{ width: 80, height: 80, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <FaPrescriptionBottle size={32} style={{ color: '#94a3b8' }} />
                                </div>
                                <h6 style={{ fontWeight: 600, marginBottom: 8 }}>Tidak Ada Obat Ditemukan</h6>
                                <p style={{ color: '#64748b', fontSize: 13 }}>Coba gunakan kata kunci atau filter yang berbeda</p>
                            </div>
                        ) : (
                            <>
                                <Row className="g-4">
                                    {medicines.map((medicine) => (
                                        <Col xl={3} lg={4} md={6} key={medicine._id}>
                                            <div className="product-card">
                                                <img 
                                                    src={medicine.image || '/images/medicine-placeholder.jpg'} 
                                                    alt={medicine.name}
                                                    className="product-image"
                                                    onClick={() => {
                                                        setSelectedMedicine(medicine);
                                                        setShowDetailModal(true);
                                                    }}
                                                />
                                                <div style={{ padding: '16px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                        <div>
                                                            <h6 style={{ fontWeight: 600, marginBottom: 2, fontSize: 14 }}>{medicine.name}</h6>
                                                            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{medicine.genericName}</p>
                                                        </div>
                                                        {medicine.prescription && (
                                                            <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 600 }}>
                                                                Resep
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                                                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontSize: '10px' }}>
                                                            {categories.find(c => c.value === medicine.category)?.label || medicine.category}
                                                        </span>
                                                        <span style={{
                                                            background: medicine.availableStock > 10 ? '#dcfce7' : medicine.availableStock > 0 ? '#fef3c7' : '#fee2e2',
                                                            color: medicine.availableStock > 10 ? '#166534' : medicine.availableStock > 0 ? '#b45309' : '#b91c1c',
                                                            padding: '2px 8px',
                                                            borderRadius: '12px',
                                                            fontSize: '10px',
                                                            fontWeight: 500
                                                        }}>
                                                            Stok: {medicine.availableStock || 0}
                                                        </span>
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 700, color: '#2563eb', fontSize: 16 }}>
                                                            {formatCurrency(medicine.price)}
                                                        </span>
                                                        <button
                                                            style={{
                                                                background: medicine.availableStock === 0 ? '#e2e8f0' : '#2563eb',
                                                                color: medicine.availableStock === 0 ? '#94a3b8' : 'white',
                                                                border: 'none',
                                                                borderRadius: '30px',
                                                                padding: '6px 16px',
                                                                fontSize: '12px',
                                                                fontWeight: 500,
                                                                cursor: medicine.availableStock === 0 ? 'not-allowed' : 'pointer'
                                                            }}
                                                            onClick={() => addToCart(medicine)}
                                                            disabled={medicine.availableStock === 0}
                                                        >
                                                            <FaPlus style={{ marginRight: 4 }} /> Keranjang
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Col>
                                    ))}
                                </Row>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 32 }}>
                                        <button
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 8,
                                                border: '1px solid #e2e8f0',
                                                background: '#ffffff',
                                                color: '#475569',
                                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                                opacity: currentPage === 1 ? 0.5 : 1
                                            }}
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <FaChevronLeft size={12} />
                                        </button>
                                        {[...Array(totalPages)].map((_, i) => (
                                            <button
                                                key={i + 1}
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: 8,
                                                    border: '1px solid #e2e8f0',
                                                    background: i + 1 === currentPage ? '#2563eb' : '#ffffff',
                                                    color: i + 1 === currentPage ? 'white' : '#475569',
                                                    fontWeight: i + 1 === currentPage ? 600 : 400,
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => setCurrentPage(i + 1)}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                        <button
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 8,
                                                border: '1px solid #e2e8f0',
                                                background: '#ffffff',
                                                color: '#475569',
                                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                                opacity: currentPage === totalPages ? 0.5 : 1
                                            }}
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            <FaChevronRight size={12} />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* ORDERS TAB */}
                {activeTab === 'orders' && (
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                        <h5 style={{ fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 36, height: 36, background: '#cffafe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0e7490' }}>
                                <FaBox size={16} />
                            </div>
                            Riwayat Pesanan
                        </h5>
                        
                        {loadingOrders ? (
                            <div style={{ textAlign: 'center', padding: 40 }}>
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : orders.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40 }}>
                                <div style={{ width: 60, height: 60, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <FaBox size={24} style={{ color: '#94a3b8' }} />
                                </div>
                                <h6 style={{ fontWeight: 600, marginBottom: 8 }}>Belum Ada Pesanan</h6>
                                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Anda belum melakukan pemesanan obat</p>
                                <button className="btn-custom btn-custom-primary" onClick={() => setActiveTab('shop')}>
                                    Mulai Belanja
                                </button>
                            </div>
                        ) : (
                            <div className="orders-list">
                                {orders.map(order => (
                                    <div key={order._id} className="order-card">
                                        <Row>
                                            <Col md={8}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                    <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                                                        {order.orderNumber}
                                                    </span>
                                                    {getStatusBadge(order.status)}
                                                </div>
                                                
                                                <div style={{ marginBottom: 12 }}>
                                                    {order.items?.map((item, idx) => (
                                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                                            <span>
                                                                {item.name}
                                                                <span style={{ color: '#64748b', marginLeft: 8 }}>x{item.quantity}</span>
                                                            </span>
                                                            <span style={{ fontWeight: 500 }}>{formatCurrency(item.subtotal)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b' }}>
                                                    <span><FaTruck style={{ marginRight: 4 }} /> {order.courier} {order.courierService}</span>
                                                    <span>{formatCurrency(order.shippingCost)}</span>
                                                </div>
                                            </Col>
                                            
                                            <Col md={4} style={{ textAlign: 'right' }}>
                                                <div style={{ marginBottom: 12 }}>
                                                    <span style={{ fontSize: 18, fontWeight: 700, color: '#2563eb' }}>{formatCurrency(order.totalAmount)}</span>
                                                </div>
                                                
                                                {order.status === 'awaiting_payment' && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        <button
                                                            className="btn-custom btn-custom-primary"
                                                            style={{ padding: '8px 16px' }}
                                                            onClick={() => {
                                                                setCurrentOrder(order);
                                                                setPaymentAmount(order.totalAmount);
                                                                setPaymentExpiry(order.paymentExpiry ? new Date(order.paymentExpiry) : null);
                                                                setShowPaymentModal(true);
                                                                setStep(1);
                                                            }}
                                                        >
                                                            Bayar Sekarang
                                                        </button>
                                                        <button
                                                            className="btn-custom btn-custom-outline"
                                                            style={{ padding: '8px 16px', borderColor: '#b91c1c', color: '#b91c1c' }}
                                                            onClick={() => cancelOrder(order._id)}
                                                        >
                                                            Batalkan
                                                        </button>
                                                    </div>
                                                )}
                                                
                                                {order.status === 'shipped' && (
                                                    <button
                                                        className="btn-custom btn-custom-success"
                                                        style={{ padding: '8px 16px' }}
                                                        onClick={() => confirmReceipt(order._id)}
                                                    >
                                                        Terima Pesanan
                                                    </button>
                                                )}
                                            </Col>
                                        </Row>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* CART MODAL */}
                {showCart && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                        <div style={{ background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}>
                            <div style={{ padding: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <h5 style={{ fontWeight: 600, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <FaShoppingCart style={{ color: '#2563eb' }} /> Keranjang Belanja
                                    </h5>
                                    <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
                                </div>
                                
                                {cart.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 40 }}>
                                        <div style={{ width: 60, height: 60, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                            <FaShoppingCart size={24} style={{ color: '#94a3b8' }} />
                                        </div>
                                        <p style={{ color: '#64748b' }}>Keranjang belanja kosong</p>
                                    </div>
                                ) : (
                                    <>
                                        {cart.map((item) => (
                                            <div key={item._id} className="cart-item">
                                                <img 
                                                    src={item.image || '/images/medicine-placeholder.jpg'}
                                                    alt={item.name}
                                                    style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: 8, marginRight: 12 }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <h6 style={{ fontWeight: 500, marginBottom: 2, fontSize: 13 }}>{item.name}</h6>
                                                    <div style={{ fontSize: 11, color: '#64748b' }}>{formatCurrency(item.price)} / item</div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <button className="quantity-btn" onClick={() => updateQuantity(item._id, item.quantity - 1)}>
                                                        <FaMinus size={10} />
                                                    </button>
                                                    <span style={{ minWidth: 20, textAlign: 'center', fontSize: 13 }}>{item.quantity}</span>
                                                    <button className="quantity-btn" onClick={() => updateQuantity(item._id, item.quantity + 1)}>
                                                        <FaPlus size={10} />
                                                    </button>
                                                </div>
                                                <div style={{ marginLeft: 16, minWidth: 80, textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#2563eb' }}>{formatCurrency(item.price * item.quantity)}</div>
                                                    <button style={{ background: 'none', border: 'none', color: '#b91c1c', fontSize: 11, cursor: 'pointer' }} onClick={() => removeFromCart(item._id)}>
                                                        Hapus
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                                <span>Subtotal</span>
                                                <span style={{ color: '#2563eb' }}>{formatCurrency(getCartTotal())}</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className="btn-custom btn-custom-outline" onClick={() => setShowCart(false)}>
                                    Lanjut Belanja
                                </button>
                                {cart.length > 0 && (
                                    <>
                                        <button className="btn-custom btn-custom-outline" style={{ borderColor: '#b91c1c', color: '#b91c1c' }} onClick={clearCart}>
                                            <FaTrash style={{ marginRight: 4 }} /> Hapus Semua
                                        </button>
                                        <button className="btn-custom btn-custom-primary" onClick={() => {
                                            setShowCart(false);
                                            setShowCheckout(true);
                                        }}>
                                            Checkout <FaArrowRight style={{ marginLeft: 4 }} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* CHECKOUT MODAL */}
                {showCheckout && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                        <div style={{ background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}>
                            <div style={{ padding: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <h5 style={{ fontWeight: 600, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <FaTruck style={{ color: '#2563eb' }} /> Checkout
                                    </h5>
                                    <button onClick={() => setShowCheckout(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
                                </div>

                                {/* Alamat & Kontak */}
                                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                                    <h6 style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>1. Informasi Pengiriman</h6>
                                    
                                    <div style={{ marginBottom: 12 }}>
                                        <label style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' }}>Nomor Telepon</label>
                                        <input
                                            type="tel"
                                            className="search-input"
                                            style={{ padding: '10px 14px' }}
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="081234567890"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' }}>Alamat Lengkap</label>
                                        <textarea
                                            rows={2}
                                            className="search-input"
                                            style={{ padding: '10px 14px', resize: 'vertical' }}
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder="Masukkan alamat lengkap (jalan, gang, nomor rumah, RT/RW, kota, kode pos)"
                                        />
                                    </div>
                                </div>

                                {/* Pilih Kurir */}
                                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                                    <h6 style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>2. Pilih Pengiriman</h6>
                                    
                                    <div style={{ marginBottom: 12 }}>
                                        <select
                                            className="filter-select"
                                            style={{ padding: '10px 14px' }}
                                            value={selectedCourier}
                                            onChange={(e) => {
                                                setSelectedCourier(e.target.value);
                                                setCourierService('');
                                                setShippingCost(0);
                                                fetchShippingCost(e.target.value);
                                            }}
                                            disabled={!address}
                                        >
                                            <option value="">-- Pilih Kurir --</option>
                                            <option value="JNE">JNE</option>
                                            <option value="J&T">J&T Express</option>
                                            <option value="SiCepat">SiCepat</option>
                                            <option value="Pos Indonesia">Pos Indonesia</option>
                                        </select>
                                    </div>

                                    {/* Layanan Kurir */}
                                    {loadingShipping ? (
                                        <div style={{ textAlign: 'center', padding: 16 }}>
                                            <Spinner size="sm" /> <span style={{ marginLeft: 8, fontSize: 13 }}>Memuat ongkir...</span>
                                        </div>
                                    ) : shippingCosts.length > 0 && (
                                        <div>
                                            {shippingCosts.map((cost, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        padding: '12px',
                                                        marginBottom: 8,
                                                        borderRadius: 8,
                                                        background: courierService === cost.service ? '#eff6ff' : '#ffffff',
                                                        border: courierService === cost.service ? '2px solid #2563eb' : '1px solid #e2e8f0',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => {
                                                        setCourierService(cost.service);
                                                        setShippingCost(cost.cost);
                                                        setEstimatedDays(cost.etd);
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <span style={{ fontWeight: 500 }}>{cost.courier} {cost.service}</span>
                                                            <br />
                                                            <span style={{ fontSize: 11, color: '#64748b' }}>Estimasi {cost.etd} hari</span>
                                                        </div>
                                                        <span style={{ fontWeight: 600, color: '#2563eb' }}>{formatCurrency(cost.cost)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Ringkasan Biaya */}
                                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                                    <h6 style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>3. Ringkasan Biaya</h6>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                                        <span style={{ color: '#64748b' }}>Subtotal</span>
                                        <span>{formatCurrency(getCartTotal())}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                                        <span style={{ color: '#64748b' }}>Ongkos Kirim</span>
                                        <span>{formatCurrency(shippingCost)}</span>
                                    </div>
                                    <hr style={{ margin: '12px 0', borderColor: '#e2e8f0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                        <span>Total</span>
                                        <span style={{ color: '#2563eb' }}>{formatCurrency(getCartTotal() + shippingCost)}</span>
                                    </div>
                                    
                                    <div style={{ background: '#dbeafe', borderRadius: 8, padding: '8px 12px', marginTop: 12, fontSize: 12, color: '#1e40af' }}>
                                        <FaClock style={{ marginRight: 4 }} /> Stok akan di-lock selama 15 menit setelah pesanan dibuat
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className="btn-custom btn-custom-outline" onClick={() => setShowCheckout(false)}>
                                    Batal
                                </button>
                                <button 
                                    className="btn-custom btn-custom-primary" 
                                    onClick={createOrder}
                                    disabled={!selectedCourier || !courierService || shippingCost === 0}
                                >
                                    Buat Pesanan
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* PAYMENT MODAL */}
                {showPaymentModal && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                        <div style={{ background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 500, maxHeight: '80vh', overflow: 'auto' }}>
                            <div style={{ padding: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <h5 style={{ fontWeight: 600, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <FaMoneyBillWave style={{ color: '#2563eb' }} /> Pembayaran
                                    </h5>
                                    <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
                                </div>

                                {/* Countdown */}
                                {paymentExpiry && step < 4 && (
                                    <div style={{ background: '#fef3c7', borderRadius: 10, padding: '12px', marginBottom: 16, textAlign: 'center' }}>
                                        <FaClock style={{ color: '#b45309', marginRight: 4 }} />
                                        <strong>Sisa waktu: {countdown}</strong>
                                        <br />
                                        <small style={{ color: '#b45309' }}>Pesanan akan dibatalkan jika tidak dibayar</small>
                                    </div>
                                )}

                                {/* STEP 1: Pilih Metode Pembayaran */}
                                {step === 1 && (
                                    <div>
                                        <h6 style={{ fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>Pilih Metode Pembayaran</h6>
                                        <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
                                            Total pembayaran: <span style={{ fontWeight: 700, color: '#2563eb' }}>{formatCurrency(paymentAmount)}</span>
                                        </p>
                                        
                                        {/* Transfer Bank */}
                                        <div style={{ marginBottom: 20 }}>
                                            <h6 style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 12 }}>🏦 Transfer Bank</h6>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                                                {banks.map(bank => (
                                                    <div
                                                        key={bank.id}
                                                        className={`payment-option ${selectedBank?.id === bank.id ? 'selected' : ''}`}
                                                        onClick={() => setSelectedBank(bank)}
                                                        style={{ padding: '12px', textAlign: 'center' }}
                                                    >
                                                        <span style={{ fontSize: 20, display: 'block', marginBottom: 4 }}>🏦</span>
                                                        <span style={{ fontSize: 12, fontWeight: 500 }}>{bank.bankName}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* QRIS */}
                                        {qris && (
                                            <div style={{ marginBottom: 20 }}>
                                                <h6 style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 12 }}>📱 QRIS</h6>
                                                <div
                                                    className={`payment-option ${selectedBank?.id === 999 ? 'selected' : ''}`}
                                                    onClick={() => setSelectedBank({ id: 999, bankName: 'QRIS', isQRIS: true })}
                                                    style={{ padding: '16px', textAlign: 'center' }}
                                                >
                                                    <img 
                                                        src={qris.qrCode || '/images/qris-klinik.png'} 
                                                        alt="QRIS"
                                                        className="qris-image"
                                                    />
                                                    <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{qris.merchantName}</p>
                                                    <small style={{ color: '#64748b' }}>Scan dengan e-wallet</small>
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <button
                                                className="btn-custom btn-custom-primary"
                                                onClick={() => createTransaction(selectedBank.id)}
                                                disabled={!selectedBank}
                                                style={{ width: '100%' }}
                                            >
                                                Lanjutkan
                                            </button>
                                            <button className="btn-custom btn-custom-outline" onClick={() => setShowPaymentModal(false)}>
                                                Batal
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2: Loading */}
                                {step === 2 && (
                                    <div style={{ textAlign: 'center', padding: 40 }}>
                                        <Spinner animation="border" variant="primary" />
                                        <p style={{ marginTop: 16, color: '#64748b', fontSize: 13 }}>Membuat transaksi...</p>
                                    </div>
                                )}

                                {/* STEP 3: Instruksi Pembayaran */}
                                {step === 3 && transaction && (
                                    <div>
                                        {/* Detail Pembayaran */}
                                        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                                            <h6 style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>💰 Detail Pembayaran</h6>
                                            <div style={{ fontSize: 13 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <span style={{ color: '#64748b' }}>ID Transaksi:</span>
                                                    <div>
                                                        <code style={{ background: '#ffffff', padding: '4px 8px', borderRadius: 4 }}>{transaction.id}</code>
                                                        <button 
                                                            style={{ background: 'none', border: 'none', color: '#2563eb', marginLeft: 4, cursor: 'pointer' }}
                                                            onClick={() => copyToClipboard(transaction.id)}
                                                        >
                                                            <FaCopy size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <span style={{ color: '#64748b' }}>Metode:</span>
                                                    <span style={{ fontWeight: 500 }}>{transaction.bank.bankName}</span>
                                                </div>
                                                {!transaction.isQRIS && (
                                                    <>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                            <span style={{ color: '#64748b' }}>No. Rekening:</span>
                                                            <div>
                                                                <span style={{ fontWeight: 500 }}>{transaction.bank.accountNumber}</span>
                                                                <button 
                                                                    style={{ background: 'none', border: 'none', color: '#2563eb', marginLeft: 4, cursor: 'pointer' }}
                                                                    onClick={() => copyToClipboard(transaction.bank.accountNumber)}
                                                                >
                                                                    <FaCopy size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                            <span style={{ color: '#64748b' }}>Atas Nama:</span>
                                                            <span style={{ fontWeight: 500 }}>{transaction.bank.accountName}</span>
                                                        </div>
                                                    </>
                                                )}
                                                <hr style={{ margin: '12px 0', borderColor: '#e2e8f0' }} />
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                                    <span>Total Transfer:</span>
                                                    <span style={{ color: '#2563eb' }}>{formatCurrency(paymentAmount)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Upload Bukti */}
                                        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                                            <h6 style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>📤 Upload Bukti Transfer</h6>
                                            <div style={{ marginBottom: 12 }}>
                                                <label style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' }}>Tanggal Transfer</label>
                                                <input
                                                    type="date"
                                                    className="search-input"
                                                    style={{ padding: '10px 14px' }}
                                                    value={transferDate}
                                                    onChange={(e) => setTransferDate(e.target.value)}
                                                    max={new Date().toISOString().split('T')[0]}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' }}>File Bukti Transfer</label>
                                                <input
                                                    type="file"
                                                    className="search-input"
                                                    style={{ padding: '8px 14px' }}
                                                    accept="image/*,.pdf"
                                                    onChange={handleFileChange}
                                                />
                                                <small style={{ color: '#94a3b8', fontSize: 11, display: 'block', marginTop: 4 }}>
                                                    Format: JPG, PNG, PDF (maks 5MB)
                                                </small>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <button
                                                className="btn-custom btn-custom-success"
                                                onClick={uploadProof}
                                                disabled={!file || !transferDate || uploading}
                                                style={{ width: '100%' }}
                                            >
                                                {uploading ? 'Mengupload...' : 'Upload & Konfirmasi'}
                                            </button>
                                            <button className="btn-custom btn-custom-outline" onClick={() => setStep(1)}>
                                                Kembali
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 4: Sukses */}
                                {step === 4 && (
                                    <div style={{ textAlign: 'center', padding: 20 }}>
                                        <div style={{ width: 60, height: 60, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                            <FaCheckCircle size={32} style={{ color: '#16a34a' }} />
                                        </div>
                                        <h5 style={{ fontWeight: 600, marginBottom: 8 }}>Pembayaran Berhasil!</h5>
                                        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Terima kasih, pesanan Anda sedang diproses.</p>
                                        <button
                                            className="btn-custom btn-custom-primary"
                                            onClick={() => {
                                                setShowPaymentModal(false);
                                                setActiveTab('orders');
                                            }}
                                        >
                                            Lihat Pesanan Saya
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* DETAIL OBAT MODAL */}
                {showDetailModal && selectedMedicine && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                        <div style={{ background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 400 }}>
                            <div style={{ padding: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <h5 style={{ fontWeight: 600, marginBottom: 0 }}>{selectedMedicine.name}</h5>
                                    <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
                                </div>

                                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                    <img 
                                        src={selectedMedicine.image || '/images/medicine-placeholder.jpg'}
                                        alt={selectedMedicine.name}
                                        style={{ maxHeight: '120px', objectFit: 'contain' }}
                                    />
                                </div>

                                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                                        <span style={{ color: '#64748b' }}>Nama Generik:</span>
                                        <span style={{ fontWeight: 500 }}>{selectedMedicine.genericName || '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                                        <span style={{ color: '#64748b' }}>Kategori:</span>
                                        <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontSize: 11 }}>
                                            {categories.find(c => c.value === selectedMedicine.category)?.label}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                                        <span style={{ color: '#64748b' }}>Harga:</span>
                                        <span style={{ fontWeight: 600, color: '#2563eb' }}>{formatCurrency(selectedMedicine.price)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                                        <span style={{ color: '#64748b' }}>Stok Tersedia:</span>
                                        <span style={{
                                            background: selectedMedicine.availableStock > 0 ? '#dcfce7' : '#fee2e2',
                                            color: selectedMedicine.availableStock > 0 ? '#166534' : '#b91c1c',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            fontSize: 11,
                                            fontWeight: 500
                                        }}>
                                            {selectedMedicine.availableStock || 0} item
                                        </span>
                                    </div>
                                    {selectedMedicine.prescription && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                                            <span style={{ color: '#64748b' }}>Resep:</span>
                                            <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontSize: 11 }}>
                                                Memerlukan Resep Dokter
                                            </span>
                                        </div>
                                    )}
                                    {selectedMedicine.description && (
                                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                                            <small style={{ color: '#64748b', display: 'block' }}>
                                                <span style={{ fontWeight: 500 }}>Deskripsi:</span> {selectedMedicine.description}
                                            </small>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className="btn-custom btn-custom-outline" onClick={() => setShowDetailModal(false)}>
                                    Tutup
                                </button>
                                <button 
                                    className="btn-custom btn-custom-primary" 
                                    onClick={() => {
                                        addToCart(selectedMedicine);
                                        setShowDetailModal(false);
                                    }}
                                    disabled={selectedMedicine.availableStock === 0}
                                >
                                    <FaShoppingCart style={{ marginRight: 4 }} /> Tambah ke Keranjang
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Container>
        </div>
    );
};

export default Pharmacy;