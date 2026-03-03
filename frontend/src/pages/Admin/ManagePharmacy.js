import React, { useState, useEffect, useRef } from 'react';
import api, { API_URL } from '../../utils/api';
import {
    Container, Row, Col, Card, Table, Badge, Button,
    Form, InputGroup, Spinner, Modal
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import {
    FaPills, FaSearch, FaPlus, FaEdit, FaTrash,
    FaArrowLeft, FaBoxOpen, FaShoppingCart, FaUpload, FaImage,
    FaClock, FaExclamationTriangle, FaCheckCircle, FaTimesCircle,
    FaTruck, FaSave, FaTimes, FaFilter
} from 'react-icons/fa';
import { Link } from 'react-router-dom';

const orderStatusConfig = {
    awaiting_payment: { bg: '#fef3c7', color: '#b45309', label: 'Menunggu Bayar' },
    paid:             { bg: '#dbeafe', color: '#1e40af', label: 'Sudah Bayar' },
    processing:       { bg: '#cffafe', color: '#0e7490', label: 'Diproses' },
    shipped:          { bg: '#ede9fe', color: '#6d28d9', label: 'Dikirim' },
    delivered:        { bg: '#dcfce7', color: '#166534', label: 'Diterima' },
    expired:          { bg: '#f1f5f9', color: '#64748b', label: 'Kadaluarsa' },
    cancelled:        { bg: '#fee2e2', color: '#b91c1c', label: 'Dibatalkan' },
};

const ManagePharmacy = () => {
    const [medicines, setMedicines] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [orderSearch, setOrderSearch] = useState('');
    const [filterOrderStatus, setFilterOrderStatus] = useState('all');
    const [activeTab, setActiveTab] = useState('medicines');

    // Modal obat
    const [showMedModal, setShowMedModal] = useState(false);
    const [editingMed, setEditingMed] = useState(null);
    const [medForm, setMedForm] = useState({ name:'', category:'', price:'', stock:'', description:'', unit:'tablet' });
    const [savingMed, setSavingMed] = useState(false);

    // Upload gambar obat
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const imageInputRef = useRef();

    // Modal update status order
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [newStatus, setNewStatus] = useState('');
    const [updatingOrder, setUpdatingOrder] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [medsRes, ordersRes] = await Promise.all([
                api.get('/api/pharmacy/admin/medicines'),
                api.get('/api/pharmacy/admin/orders'),
            ]);
            setMedicines(medsRes.data.medicines || medsRes.data || []);
            setOrders(ordersRes.data.orders || ordersRes.data || []);
        } catch {
            toast.error('Gagal memuat data farmasi');
        } finally {
            setLoading(false);
        }
    };

    const openMedModal = (med = null) => {
        if (med) {
            setEditingMed(med);
            setMedForm({ 
                name: med.name, 
                category: med.category||'', 
                price: med.price, 
                stock: med.stock, 
                description: med.description||'', 
                unit: med.unit||'tablet' 
            });
            setImagePreview(med.image ? `${API_URL}${med.image}` : null);
        } else {
            setEditingMed(null);
            setMedForm({ name:'', category:'', price:'', stock:'', description:'', unit:'tablet' });
            setImagePreview(null);
        }
        setImageFile(null);
        setShowMedModal(true);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { toast.error('Ukuran gambar maksimal 3MB'); return; }
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSaveMed = async (e) => {
        e.preventDefault();
        if (!medForm.name || !medForm.price || !medForm.stock) { 
            toast.error('Nama, harga, dan stok wajib diisi'); 
            return; 
        }
        setSavingMed(true);
        try {
            let savedId = editingMed?._id;
            if (editingMed) {
                await api.put(`/api/pharmacy/admin/medicines/${editingMed._id}`, medForm);
                toast.success('Obat berhasil diperbarui');
            } else {
                const res = await api.post('/api/pharmacy/admin/medicines', medForm);
                savedId = res.data.medicine?._id;
                toast.success('Obat berhasil ditambahkan');
            }

            // Upload gambar jika ada
            if (imageFile && savedId) {
                setUploadingImage(true);
                try {
                    const formData = new FormData();
                    formData.append('image', imageFile);
                    await api.post(`/api/pharmacy/admin/medicines/${savedId}/image`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    toast.success('Gambar obat berhasil diupload');
                } catch {
                    toast.error('Data tersimpan, tapi gagal upload gambar. Coba edit obat untuk upload ulang.');
                } finally {
                    setUploadingImage(false);
                }
            }

            setShowMedModal(false);
            setImageFile(null);
            setImagePreview(null);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menyimpan obat');
        } finally {
            setSavingMed(false);
        }
    };

    const handleDeleteMed = async (id, name) => {
        if (!window.confirm(`Hapus obat "${name}"?`)) return;
        try {
            await api.delete(`/api/pharmacy/admin/medicines/${id}`);
            toast.success('Obat berhasil dihapus');
            fetchData();
        } catch {
            toast.error('Gagal menghapus obat');
        }
    };

    const handleUpdateOrderStatus = async () => {
        if (!newStatus) return;
        setUpdatingOrder(true);
        try {
            await api.put(`/api/pharmacy/admin/orders/${selectedOrder._id}/status`, { status: newStatus });
            toast.success('Status pesanan diperbarui');
            setShowOrderModal(false);
            fetchData();
        } catch {
            toast.error('Gagal memperbarui status');
        } finally {
            setUpdatingOrder(false);
        }
    };

    const filteredMeds = medicines.filter(m =>
        !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.category?.toLowerCase().includes(search.toLowerCase())
    );

    const filteredOrders = orders.filter(o => {
        const q = orderSearch.toLowerCase();
        const matchSearch = !orderSearch || o.userId?.name?.toLowerCase().includes(q) || o._id?.toLowerCase().includes(q);
        const matchStatus = filterOrderStatus === 'all' || o.status === filterOrderStatus;
        return matchSearch && matchStatus;
    });

    const lowStock = medicines.filter(m => m.stock <= 10).length;

    const formatCurrency = (amount) => `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;

    const getStockBadge = (stock) => {
        if (stock <= 5) return { bg: '#fee2e2', color: '#b91c1c', label: 'Kritis' };
        if (stock <= 10) return { bg: '#fef3c7', color: '#b45309', label: 'Menipis' };
        if (stock <= 30) return { bg: '#dbeafe', color: '#1e40af', label: 'Normal' };
        return { bg: '#dcfce7', color: '#166534', label: 'Aman' };
    };

    const getOrderStatusBadge = (status) => {
        const cfg = orderStatusConfig[status] || { bg: '#f1f5f9', color: '#64748b', label: status };
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

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <Spinner animation="border" variant="primary" />
                <p style={{ marginTop: 16, color: '#64748b' }}>Memuat data farmasi...</p>
            </div>
        </div>
    );

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
                    background: #dcfce7;
                    border-radius: 12px;
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
                .tab-container {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 24px;
                    border-bottom: 1px solid #e2e8f0;
                    padding-bottom: 8px;
                }
                .tab-button {
                    padding: 8px 20px;
                    border-radius: 30px;
                    font-size: 14px;
                    font-weight: 500;
                    border: none;
                    background: transparent;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .tab-button:hover {
                    background: #f1f5f9;
                    color: #0f172a;
                }
                .tab-button.active {
                    background: #dcfce7;
                    color: #166534;
                }
                .search-container {
                    position: relative;
                    width: 100%;
                    max-width: 350px;
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
                    border-color: #16a34a;
                    box-shadow: 0 0 0 3px rgba(22,163,74,0.1);
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
                    border-color: #16a34a;
                    box-shadow: 0 0 0 3px rgba(22,163,74,0.1);
                }
                .table-container {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    overflow: hidden;
                    margin-top: 20px;
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
                .table-container tbody tr {
                    transition: background 0.2s ease;
                }
                .table-container tbody tr:hover {
                    background: #f8fafc;
                }
                .action-group {
                    display: flex;
                    gap: 6px;
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
                .action-btn.edit {
                    background: #dbeafe;
                    color: #2563eb;
                }
                .action-btn.edit:hover {
                    background: #bfdbfe;
                }
                .action-btn.delete {
                    background: #fee2e2;
                    color: #b91c1c;
                }
                .action-btn.delete:hover {
                    background: #fecaca;
                }
                .action-btn.update {
                    background: #dcfce7;
                    color: #166534;
                    width: auto;
                    padding: 0 16px;
                    font-size: 13px;
                }
                .action-btn.update:hover {
                    background: #bbf7d0;
                }
                .btn-custom {
                    padding: 10px 20px;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 500;
                    border: none;
                    background: #16a34a;
                    color: white;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                }
                .btn-custom:hover {
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
                .stock-badge {
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                    display: inline-block;
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
                .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #475569;
                    margin-bottom: 6px;
                }
                .form-control-custom {
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 14px;
                    width: 100%;
                }
                .form-control-custom:focus {
                    outline: none;
                    border-color: #16a34a;
                    box-shadow: 0 0 0 3px rgba(22,163,74,0.1);
                }
                .image-upload-box {
                    width: 80px;
                    height: 80px;
                    border-radius: 12px;
                    border: 2px dashed #e2e8f0;
                    background: #f8fafc;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    overflow: hidden;
                }
                .image-upload-box img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .product-image {
                    width: 48px;
                    height: 48px;
                    border-radius: 10px;
                    object-fit: cover;
                    border: 1px solid #e2e8f0;
                }
                .product-image-placeholder {
                    width: 48px;
                    height: 48px;
                    border-radius: 10px;
                    background: #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #94a3b8;
                    border: 1px solid #e2e8f0;
                }
            `}</style>

            <Container fluid style={{ maxWidth: 1400, margin: '0 auto' }}>
                {/* Header */}
                <div className="page-header">
                    <div className="header-left">
                        <div className="header-icon">
                            <FaPills size={24} />
                        </div>
                        <div className="header-title">
                            <h1>Manajemen Farmasi</h1>
                            <p>Kelola stok obat dan pesanan farmasi</p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <Row className="g-3 mb-4">
                    <Col md={3} xs={6}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ color: '#2563eb', fontSize: 14 }}>Total Obat</div>
                                <FaPills style={{ color: '#2563eb', opacity: 0.5 }} size={20} />
                            </div>
                            <div className="stats-value">{medicines.length}</div>
                            <div className="stats-label">Varian obat tersedia</div>
                        </div>
                    </Col>
                    <Col md={3} xs={6}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ color: lowStock > 0 ? '#b91c1c' : '#166534', fontSize: 14 }}>Stok Menipis</div>
                                <FaExclamationTriangle style={{ color: lowStock > 0 ? '#b91c1c' : '#166534', opacity: 0.5 }} size={20} />
                            </div>
                            <div className="stats-value">{lowStock}</div>
                            <div className="stats-label">Obat dengan stok ≤10</div>
                        </div>
                    </Col>
                    <Col md={3} xs={6}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ color: '#0e7490', fontSize: 14 }}>Total Pesanan</div>
                                <FaShoppingCart style={{ color: '#0e7490', opacity: 0.5 }} size={20} />
                            </div>
                            <div className="stats-value">{orders.length}</div>
                            <div className="stats-label">Semua transaksi</div>
                        </div>
                    </Col>
                    <Col md={3} xs={6}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ color: '#b45309', fontSize: 14 }}>Menunggu</div>
                                <FaClock style={{ color: '#b45309', opacity: 0.5 }} size={20} />
                            </div>
                            <div className="stats-value">{orders.filter(o => o.status === 'awaiting_payment').length}</div>
                            <div className="stats-label">Pesanan perlu diproses</div>
                        </div>
                    </Col>
                </Row>

                {/* Custom Tabs */}
                <div className="tab-container">
                    <button 
                        className={`tab-button ${activeTab === 'medicines' ? 'active' : ''}`}
                        onClick={() => setActiveTab('medicines')}
                    >
                        <FaBoxOpen /> Daftar Obat ({medicines.length})
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'orders' ? 'active' : ''}`}
                        onClick={() => setActiveTab('orders')}
                    >
                        <FaShoppingCart /> Pesanan ({orders.length})
                    </button>
                </div>

                {/* Tab: Daftar Obat */}
                {activeTab === 'medicines' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div className="search-container">
                                <FaSearch className="search-icon" />
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Cari nama atau kategori obat..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <button className="btn-custom" onClick={() => openMedModal()}>
                                <FaPlus /> Tambah Obat
                            </button>
                        </div>

                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: 60 }}>Foto</th>
                                        <th>Nama Obat</th>
                                        <th>Kategori</th>
                                        <th>Harga</th>
                                        <th>Stok</th>
                                        <th>Satuan</th>
                                        <th style={{ textAlign: 'center' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMeds.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '48px' }}>
                                                <div style={{ width: 60, height: 60, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                                    <FaPills size={24} style={{ color: '#94a3b8' }} />
                                                </div>
                                                <h6 style={{ fontWeight: 600, marginBottom: 4 }}>Tidak ada obat</h6>
                                                <p style={{ color: '#64748b', fontSize: 13 }}>Belum ada data obat atau coba kata kunci lain</p>
                                            </td>
                                        </tr>
                                    ) : filteredMeds.map(m => {
                                        const stockStatus = getStockBadge(m.stock);
                                        return (
                                            <tr key={m._id}>
                                                <td>
                                                    {m.image ? (
                                                        <img
                                                            src={`${API_URL}${m.image}`}
                                                            alt={m.name}
                                                            className="product-image"
                                                        />
                                                    ) : (
                                                        <div className="product-image-placeholder">
                                                            <FaPills size={20} />
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 500 }}>{m.name}</div>
                                                    {m.description && (
                                                        <div style={{ fontSize: 12, color: '#64748b' }}>{m.description.substring(0, 50)}</div>
                                                    )}
                                                </td>
                                                <td>
                                                    <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' }}>
                                                        {m.category || '-'}
                                                    </span>
                                                </td>
                                                <td style={{ fontWeight: 500 }}>{formatCurrency(m.price)}</td>
                                                <td>
                                                    <span style={{
                                                        background: stockStatus.bg,
                                                        color: stockStatus.color,
                                                        padding: '4px 10px',
                                                        borderRadius: '20px',
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        display: 'inline-block'
                                                    }}>
                                                        {m.stock} • {stockStatus.label}
                                                    </span>
                                                </td>
                                                <td style={{ color: '#64748b' }}>{m.unit || 'tablet'}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div className="action-group" style={{ justifyContent: 'center' }}>
                                                        <button className="action-btn edit" onClick={() => openMedModal(m)} title="Edit">
                                                            <FaEdit />
                                                        </button>
                                                        <button className="action-btn delete" onClick={() => handleDeleteMed(m._id, m.name)} title="Hapus">
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Tab: Pesanan */}
                {activeTab === 'orders' && (
                    <div>
                        <Row className="g-3 mb-3">
                            <Col md={4}>
                                <div className="search-container" style={{ maxWidth: '100%' }}>
                                    <FaSearch className="search-icon" />
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Cari nama pelanggan atau ID..."
                                        value={orderSearch}
                                        onChange={e => setOrderSearch(e.target.value)}
                                    />
                                </div>
                            </Col>
                            <Col md={3}>
                                <select 
                                    className="filter-select" 
                                    value={filterOrderStatus} 
                                    onChange={e => setFilterOrderStatus(e.target.value)}
                                >
                                    <option value="all">Semua Status</option>
                                    {Object.entries(orderStatusConfig).map(([k,v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                    ))}
                                </select>
                            </Col>
                            <Col md={5} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                <span style={{ fontSize: 14, color: '#64748b' }}>
                                    {filteredOrders.length} pesanan ditemukan
                                </span>
                            </Col>
                        </Row>

                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID Pesanan</th>
                                        <th>Pelanggan</th>
                                        <th>Total</th>
                                        <th>Tanggal</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'center' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '48px' }}>
                                                <div style={{ width: 60, height: 60, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                                    <FaShoppingCart size={24} style={{ color: '#94a3b8' }} />
                                                </div>
                                                <h6 style={{ fontWeight: 600, marginBottom: 4 }}>Tidak ada pesanan</h6>
                                                <p style={{ color: '#64748b', fontSize: 13 }}>Belum ada pesanan atau coba filter lain</p>
                                            </td>
                                        </tr>
                                    ) : filteredOrders.map(o => (
                                        <tr key={o._id}>
                                            <td>
                                                <code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontSize: '12px' }}>
                                                    {o._id.slice(-8).toUpperCase()}
                                                </code>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{o.userId?.name || '-'}</div>
                                                <div style={{ fontSize: 12, color: '#64748b' }}>{o.userId?.email}</div>
                                            </td>
                                            <td style={{ fontWeight: 500 }}>{formatCurrency(o.totalAmount)}</td>
                                            <td style={{ fontSize: 13, color: '#475569' }}>
                                                {new Date(o.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td>{getOrderStatusBadge(o.status)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button 
                                                    className="action-btn update" 
                                                    onClick={() => {
                                                        setSelectedOrder(o);
                                                        setNewStatus(o.status);
                                                        setShowOrderModal(true);
                                                    }}
                                                >
                                                    Update Status
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Modal Tambah/Edit Obat */}
                <Modal show={showMedModal} onHide={() => setShowMedModal(false)} centered dialogClassName="modal-custom">
                    <div className="modal-header-custom">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, background: '#dcfce7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                                {editingMed ? <FaEdit size={20} /> : <FaPlus size={20} />}
                            </div>
                            <h5 style={{ fontWeight: 600, marginBottom: 0 }}>
                                {editingMed ? 'Edit Obat' : 'Tambah Obat Baru'}
                            </h5>
                        </div>
                        <button onClick={() => setShowMedModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
                    </div>
                    
                    <Form onSubmit={handleSaveMed}>
                        <div className="modal-body-custom">
                            <Row className="g-3">
                                {/* Bagian Gambar Obat */}
                                <Col md={12}>
                                    <Form.Label className="form-label-custom d-block">
                                        <FaImage style={{ marginRight: 6 }} /> Gambar Obat
                                    </Form.Label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div className="image-upload-box">
                                            {imagePreview ? (
                                                <img src={imagePreview} alt="preview" />
                                            ) : (
                                                <FaPills size={30} color="#94a3b8" />
                                            )}
                                        </div>
                                        <div>
                                            <input
                                                ref={imageInputRef}
                                                type="file"
                                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                                style={{ display: 'none' }}
                                                onChange={handleImageChange}
                                            />
                                            <button 
                                                type="button" 
                                                className="btn-custom-outline" 
                                                style={{ padding: '8px 16px' }}
                                                onClick={() => imageInputRef.current.click()}
                                            >
                                                <FaUpload style={{ marginRight: 6 }} />
                                                {imagePreview ? 'Ganti Gambar' : 'Pilih Gambar'}
                                            </button>
                                            {imageFile && (
                                                <button 
                                                    type="button" 
                                                    style={{ background: 'none', border: 'none', color: '#b91c1c', marginLeft: 8, cursor: 'pointer' }}
                                                    onClick={() => { setImageFile(null); setImagePreview(editingMed?.image ? `${API_URL}${editingMed.image}` : null); }}
                                                >
                                                    Hapus
                                                </button>
                                            )}
                                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                                JPG, PNG, WebP · Maks. 3MB
                                            </div>
                                        </div>
                                    </div>
                                </Col>
                                
                                <Col md={12}>
                                    <hr style={{ margin: '8px 0', borderColor: '#e2e8f0' }} />
                                </Col>

                                <Col md={12}>
                                    <Form.Group>
                                        <Form.Label className="form-label-custom">Nama Obat <span style={{ color: '#b91c1c' }}>*</span></Form.Label>
                                        <Form.Control
                                            className="form-control-custom"
                                            value={medForm.name}
                                            onChange={e => setMedForm(f=>({...f, name: e.target.value}))}
                                            required
                                            placeholder="Contoh: Paracetamol 500mg"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="form-label-custom">Kategori</Form.Label>
                                        <Form.Control
                                            className="form-control-custom"
                                            value={medForm.category}
                                            onChange={e => setMedForm(f=>({...f, category: e.target.value}))}
                                            placeholder="Analgesik, Antibiotik, dll"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="form-label-custom">Satuan</Form.Label>
                                        <Form.Select 
                                            className="form-control-custom"
                                            value={medForm.unit} 
                                            onChange={e => setMedForm(f=>({...f, unit: e.target.value}))}
                                        >
                                            <option value="tablet">Tablet</option>
                                            <option value="kapsul">Kapsul</option>
                                            <option value="botol">Botol</option>
                                            <option value="sachet">Sachet</option>
                                            <option value="tube">Tube</option>
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="form-label-custom">Harga (Rp) <span style={{ color: '#b91c1c' }}>*</span></Form.Label>
                                        <Form.Control
                                            className="form-control-custom"
                                            type="number"
                                            min="0"
                                            value={medForm.price}
                                            onChange={e => setMedForm(f=>({...f, price: e.target.value}))}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="form-label-custom">Stok <span style={{ color: '#b91c1c' }}>*</span></Form.Label>
                                        <Form.Control
                                            className="form-control-custom"
                                            type="number"
                                            min="0"
                                            value={medForm.stock}
                                            onChange={e => setMedForm(f=>({...f, stock: e.target.value}))}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={12}>
                                    <Form.Group>
                                        <Form.Label className="form-label-custom">Deskripsi</Form.Label>
                                        <Form.Control
                                            className="form-control-custom"
                                            as="textarea"
                                            rows={2}
                                            value={medForm.description}
                                            onChange={e => setMedForm(f=>({...f, description: e.target.value}))}
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                        </div>
                        <div className="modal-footer-custom">
                            <button type="button" className="btn-custom-outline" onClick={() => setShowMedModal(false)}>
                                Batal
                            </button>
                            <button type="submit" className="btn-custom" disabled={savingMed || uploadingImage}>
                                {(savingMed || uploadingImage) ? <Spinner size="sm" style={{ marginRight: 8 }} /> : <FaSave style={{ marginRight: 8 }} />}
                                {editingMed ? 'Simpan Perubahan' : 'Tambah Obat'}
                            </button>
                        </div>
                    </Form>
                </Modal>

                {/* Modal Update Status Pesanan */}
                <Modal show={showOrderModal} onHide={() => setShowOrderModal(false)} centered dialogClassName="modal-custom">
                    <div className="modal-header-custom">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, background: '#dcfce7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                                <FaShoppingCart size={20} />
                            </div>
                            <h5 style={{ fontWeight: 600, marginBottom: 0 }}>Update Status Pesanan</h5>
                        </div>
                        <button onClick={() => setShowOrderModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
                    </div>
                    
                    <div className="modal-body-custom">
                        {selectedOrder && (
                            <div>
                                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{selectedOrder.userId?.name}</div>
                                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>ID: {selectedOrder._id}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 13, color: '#475569' }}>Total Pesanan</span>
                                        <span style={{ fontWeight: 700, color: '#16a34a' }}>{formatCurrency(selectedOrder.totalAmount)}</span>
                                    </div>
                                </div>
                                
                                <Form.Group>
                                    <Form.Label className="form-label-custom">Status Baru</Form.Label>
                                    <Form.Select 
                                        className="form-control-custom"
                                        value={newStatus} 
                                        onChange={e => setNewStatus(e.target.value)}
                                    >
                                        {Object.entries(orderStatusConfig).map(([k,v]) => (
                                            <option key={k} value={k}>{v.label}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </div>
                        )}
                    </div>
                    
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-custom-outline" onClick={() => setShowOrderModal(false)}>
                            Batal
                        </button>
                        <button 
                            type="button" 
                            className="btn-custom" 
                            onClick={handleUpdateOrderStatus} 
                            disabled={updatingOrder}
                        >
                            {updatingOrder ? <Spinner size="sm" style={{ marginRight: 8 }} /> : <FaSave style={{ marginRight: 8 }} />}
                            Simpan
                        </button>
                    </div>
                </Modal>
            </Container>
        </div>
    );
};

export default ManagePharmacy;