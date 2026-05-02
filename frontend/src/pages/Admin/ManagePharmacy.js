// Admin/ManagePharmacy.js - Elegant & Minimalis seperti Inventaris Obat
import React, { useState, useEffect, useRef } from 'react';
import api, { API_URL } from '../../utils/api';
import { Row, Col, Spinner, Modal, Form } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import {
    FaPills, FaSearch, FaPlus, FaEdit, FaBoxOpen, FaShoppingCart,
    FaUpload, FaClock, FaExclamationTriangle, FaCheckCircle,
    FaTimesCircle, FaTruck, FaSave, FaFileImage, FaEye,
    FaToggleOn, FaToggleOff, FaMotorcycle, FaStore, FaBan,
    FaStar, FaChevronDown, FaChevronUp, FaInfoCircle
} from 'react-icons/fa';

const CATEGORIES = [
    { value: 'obat_bebas', label: 'Obat Bebas' },
    { value: 'obat_bebas_terbatas', label: 'Obat Bebas Terbatas' },
    { value: 'obat_keras', label: 'Obat Keras (Resep)' },
    { value: 'antibiotik', label: 'Antibiotik' },
    { value: 'vitamin', label: 'Vitamin & Suplemen' },
    { value: 'alat_kesehatan', label: 'Alat Kesehatan' },
];

const STATUS_CFG = {
    waiting_prescription: { bg: '#fef9c3', color: '#854d0e', label: 'Menunggu Verifikasi Resep', icon: FaFileImage },
    prescription_rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Resep Ditolak', icon: FaTimesCircle },
    pending: { bg: '#fef3c7', color: '#b45309', label: 'Menunggu Pembayaran', icon: FaClock },
    paid: { bg: '#dbeafe', color: '#1e40af', label: 'Sudah Bayar', icon: FaCheckCircle },
    diproses: { bg: '#cffafe', color: '#0e7490', label: 'Sedang Diproses', icon: FaBoxOpen },
    dikirim: { bg: '#ede9fe', color: '#6d28d9', label: 'Sedang Dikirim', icon: FaTruck },
    terkirim: { bg: '#d1fae5', color: '#065f46', label: 'Sudah Tiba', icon: FaMotorcycle },
    siap_diambil: { bg: '#ecfdf5', color: '#065f46', label: 'Siap Diambil', icon: FaStore },
    selesai: { bg: '#dcfce7', color: '#166534', label: 'Selesai', icon: FaCheckCircle },
    cancelled: { bg: '#f1f5f9', color: '#475569', label: 'Dibatalkan', icon: FaBan },
};

const fmt = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

/**
 * Helper: normalise shipping fields.
 * Backend menyimpan di kolom flat (shippingAddress string, shippingLat, shippingLng,
 * shippingPhone, shippingDetail, distance), lalu formatOrder() membungkusnya menjadi
 * objek shippingAddress = { address, detail, lat, lng }.
 * Fungsi ini membaca kedua format agar tidak ada data yang hilang.
 */
const getShipping = (o) => {
    if (!o) return {};
    const sa = o.shippingAddress;
    const isObj = sa && typeof sa === 'object';
    return {
        address  : isObj ? (sa.address || '') : (sa || ''),
        detail   : isObj ? (sa.detail   || '') : (o.shippingDetail   || ''),
        lat      : isObj ? sa.lat  : (o.shippingLat  ?? null),
        lng      : isObj ? sa.lng  : (o.shippingLng  ?? null),
        phone    : o.shippingPhone || o.userId?.phone || o.user?.phone || '',
        // 'distance' disimpan dalam km (DECIMAL di MySQL), bukan meter
        distanceKm: o.distance ?? (o.shippingDistance ? o.shippingDistance / 1000 : null),
    };
};

const ManagePharmacy = () => {
    const [medicines, setMedicines] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [orderSearch, setOrderSearch] = useState('');
    const [orderStatus, setOrderStatus] = useState('all');
    const [activeTab, setActiveTab] = useState('medicines');

    // Med modal
    const [showMedModal, setShowMedModal] = useState(false);
    const [editingMed, setEditingMed] = useState(null);
    const [medForm, setMedForm] = useState({ name: '', genericName: '', category: 'obat_bebas', price: '', stock: '', unit: 'tablet', description: '', requiresPrescription: false, availableForStudentQuota: false, isActive: true });
    const [savingMed, setSavingMed] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [uploadingImg, setUploadingImg] = useState(false);
    const imageRef = useRef();

    // Order detail modal
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [orderAction, setOrderAction] = useState('status');
    const [newStatus, setNewStatus] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [adjustedItems, setAdjustedItems] = useState([]);
    const [updatingOrder, setUpdatingOrder] = useState(false);
    const [, setRxPreview] = useState(false);

    // Refund requests
    const [refundOrders, setRefundOrders] = useState([]);
    const [refundModal, setRefundModal] = useState(null);
    const [refundAction, setRefundAction] = useState('');
    const [refundRejectReason, setRefundRejectReason] = useState('');
    const [, setRefundBankCode] = useState('');
    const [, setRefundAccount] = useState('');
    const [, setRefundAccountName] = useState('');
    const [processingRefund, setProcessingRefund] = useState(false);
    const [, setNeedsBankInfo] = useState(false);
    const [, setBankList] = useState([]);

    // Expand/collapse order rows
    const [expandedOrders, setExpandedOrders] = useState(new Set());

    useEffect(() => {
        fetchData();
        // Ambil daftar bank dari endpoint baru
        api.get('/api/pharmacy/refund-banks')
            .then(r => setBankList(r.data.banks || []))
            .catch(() => {
                // Fallback bank list
                setBankList([
                    { code: 'BCA', name: 'Bank Central Asia' },
                    { code: 'BNI', name: 'Bank Negara Indonesia' },
                    { code: 'BRI', name: 'Bank Rakyat Indonesia' },
                    { code: 'MANDIRI', name: 'Bank Mandiri' },
                    { code: 'BSI', name: 'Bank Syariah Indonesia' },
                    { code: 'CIMB', name: 'CIMB Niaga' },
                    { code: 'PERMATA', name: 'Bank Permata' },
                    { code: 'DANAMON', name: 'Bank Danamon' },
                    { code: 'BTN', name: 'Bank Tabungan Negara' },
                ]);
            });
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [medsRes, ordersRes, refundRes] = await Promise.all([
                api.get('/api/pharmacy/admin/medicines?limit=200'),
                api.get('/api/pharmacy/admin/orders?limit=100'),
                api.get('/api/pharmacy/admin/orders/refund-requests?status=refund_requested').catch(() => ({ data: { orders: [] } })),
            ]);
            setMedicines(medsRes.data.medicines || []);
            setOrders(ordersRes.data.orders || []);
            setRefundOrders(refundRes.data.orders || []);
        } catch {
            toast.error('Gagal memuat data');
        } finally { setLoading(false); }
    };

    const openMedModal = (med = null) => {
        if (med) {
            setEditingMed(med);
            setMedForm({
                name: med.name || '', genericName: med.genericName || '', category: med.category || 'obat_bebas',
                price: med.price || '', stock: med.stock || '', unit: med.unit || 'tablet', description: med.description || '',
                requiresPrescription: !!med.requiresPrescription, availableForStudentQuota: !!med.availableForStudentQuota, isActive: med.isActive !== false
            });
            setImagePreview(med.image ? `${API_URL}${med.image}` : null);
        } else {
            setEditingMed(null);
            setMedForm({ name: '', genericName: '', category: 'obat_bebas', price: '', stock: '', unit: 'tablet', description: '', requiresPrescription: false, availableForStudentQuota: false, isActive: true });
            setImagePreview(null);
        }
        setImageFile(null);
        setShowMedModal(true);
    };

    const handleSaveMed = async (e) => {
        e.preventDefault();
        if (!medForm.name || !medForm.price || medForm.stock === '') {
            toast.error('Nama, harga, dan stok wajib diisi');
            return;
        }
        setSavingMed(true);
        try {
            let savedId = editingMed?._id;
            if (editingMed) {
                await api.put(`/api/pharmacy/admin/medicines/${editingMed._id}`, medForm);
                toast.success('Obat diperbarui');
            } else {
                const r = await api.post('/api/pharmacy/admin/medicines', medForm);
                savedId = r.data.medicine?._id;
                toast.success('Obat ditambahkan');
            }
            if (imageFile && savedId) {
                setUploadingImg(true);
                try {
                    const fd = new FormData();
                    fd.append('image', imageFile);
                    await api.post(`/api/pharmacy/admin/medicines/${savedId}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                } catch {
                    toast.error('Data tersimpan, tapi gambar gagal diupload');
                } finally {
                    setUploadingImg(false);
                }
            }
            setShowMedModal(false);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menyimpan');
        } finally {
            setSavingMed(false);
        }
    };

    const handleToggleActive = async (med) => {
        const willActivate = med.isActive === false;
        const msg = willActivate ? `Aktifkan kembali obat "${med.name}"?` : `Nonaktifkan obat "${med.name}"? Obat akan tetap tampil tapi tidak bisa dibeli.`;
        if (!window.confirm(msg)) return;
        try {
            await api.put(`/api/pharmacy/admin/medicines/${med._id}`, { isActive: willActivate });
            toast.success(willActivate ? 'Obat diaktifkan kembali' : 'Obat dinonaktifkan');
            fetchData();
        } catch {
            toast.error('Gagal mengubah status');
        }
    };

    const openOrderModal = (order, action = 'status') => {
        setSelectedOrder(order);
        setOrderAction(action);
        setNewStatus('');
        setRejectReason('');
        setRxPreview(false);
        if (action === 'adjust-items') {
            setAdjustedItems(order.items.map(i => ({ 
                medicineId: i.medicineId?._id || i.medicineId, 
                name: i.name, 
                quantity: i.quantity, 
                price: i.finalPrice || i.price || 0
            })));
        }
        setShowOrderModal(true);
    };

    const handleQuickStatus = async (order) => {
        const isPickup = order.deliveryMethod === 'pickup';
        const nextMap = {
            paid: 'diproses',
            diproses: isPickup ? 'siap_diambil' : 'dikirim',
            dikirim: 'terkirim',
            terkirim: 'selesai',
            siap_diambil: 'selesai',
        };
        const next = nextMap[order.status];
        if (!next) return;
        try {
            await api.put(`/api/pharmacy/admin/orders/${order._id}/status`, { status: next });
            toast.success(`Status diperbarui: ${next}`);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal update status');
        }
    };

    const getQuickActionLabel = (order) => {
        const isPickup = order.deliveryMethod === 'pickup';
        const labels = {
            paid: { icon: '📦', text: 'Proses' },
            diproses: isPickup ? { icon: '🏥', text: 'Siap Diambil' } : { icon: '🏍️', text: 'Kirim' },
            dikirim: { icon: '📬', text: 'Sudah Tiba' },
            terkirim: { icon: '✅', text: 'Selesai' },
            siap_diambil: { icon: '✅', text: 'Selesai' },
        };
        return labels[order.status] || null;
    };

    const handleOrderAction = async () => {
        if (!selectedOrder) return;
        setUpdatingOrder(true);
        try {
            if (orderAction === 'verify-rx') {
                if (!newStatus) {
                    toast.error('Pilih approve atau reject');
                    setUpdatingOrder(false);
                    return;
                }
                const payload = { action: newStatus };
                if (newStatus === 'reject') payload.reason = rejectReason;
                await api.put(`/api/pharmacy/admin/orders/${selectedOrder._id}/verify-prescription`, payload);
                toast.success(newStatus === 'approve' ? 'Resep disetujui' : 'Resep ditolak');

            } else if (orderAction === 'adjust-items') {
                const payload = { 
                    items: adjustedItems.map(i => ({ 
                        medicineId: i.medicineId, 
                        quantity: i.quantity 
                    })) 
                };
                await api.put(`/api/pharmacy/admin/orders/${selectedOrder._id}/adjust-items`, payload);
                toast.success('Jumlah item diperbarui');
            }
            setShowOrderModal(false);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal');
        } finally {
            setUpdatingOrder(false);
        }
    };

    const toggleExpand = (id) => {
        setExpandedOrders(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
    };

    // Hitung total dari adjustedItems
    const calculateAdjustedTotal = () => {
        const itemsTotal = adjustedItems.reduce((sum, item) => {
            const price = Number(item.price) || 0;
            const qty = Number(item.quantity) || 0;
            return sum + (price * qty);
        }, 0);
        const shipping = Number(selectedOrder?.shippingCost) || 0;
        return itemsTotal + shipping;
    };

    const filteredMeds = medicines.filter(m =>
        !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.category?.toLowerCase().includes(search.toLowerCase())
    );

    const filteredOrders = orders.filter(o => o.status !== 'expired').filter(o => {
        const q = orderSearch.toLowerCase();
        const matchQ = !orderSearch || o.userId?.name?.toLowerCase().includes(q) || o.userId?.email?.toLowerCase().includes(q) || o.orderNumber?.toLowerCase().includes(q);
        const matchS = orderStatus === 'all' || o.status === orderStatus;
        return matchQ && matchS;
    });

    const pendingRxCount = orders.filter(o => o.status === 'waiting_prescription').length;
    const lowStockCount = medicines.filter(m => m.stock <= 10).length;

    const getStatusBadge = (status) => {
        const v = STATUS_CFG[status] || { bg: '#f1f5f9', color: '#475569', label: status, icon: FaBoxOpen };
        return <span style={{ background: v.bg, color: v.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><v.icon size={10} />{v.label}</span>;
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
            <Spinner animation="border" variant="primary" />
        </div>
    );

    const styles = {
        page: { minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 24 },
        container: { maxWidth: 1400, margin: '0 auto' },
        header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
        headerIcon: { width: 44, height: 44, background: '#dcfce7', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' },
        headerTitle: { fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 2 },
        headerSub: { fontSize: 13, color: '#64748b', marginBottom: 0 },
        badgeWarning: { background: '#fef9c3', border: '1px solid #fcd34d', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#92400e', cursor: 'pointer' },
        statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
        statCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18 },
        statLabel: { fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 4 },
        statValue: { fontSize: 28, fontWeight: 700, color: '#0f172a' },
        tabBar: { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e2e8f0', paddingBottom: 0 },
        tabBtn: (active) => ({
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            color: active ? '#16a34a' : '#64748b',
            fontWeight: active ? 600 : 400,
            fontSize: 13,
            cursor: 'pointer',
            borderBottom: active ? '2px solid #16a34a' : '2px solid transparent',
            marginBottom: -1,
            transition: 'all .2s'
        }),
        toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
        searchBox: { position: 'relative', maxWidth: 320, width: '100%' },
        searchInput: { width: '100%', padding: '10px 14px 10px 38px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none' },
        addBtn: { padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 },
        table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' },
        th: { padding: '12px 16px', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: 12, textAlign: 'left', borderBottom: '1px solid #e2e8f0' },
        td: { padding: '12px 16px', fontSize: 13, color: '#0f172a', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
        orderRow: { borderBottom: '1px solid #f1f5f9', cursor: 'pointer' },
        orderExpanded: { padding: '0 16px 16px 40px', background: '#fafafa', borderTop: '1px dashed #e2e8f0' },
        modal: { padding: 24 },
        modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        modalTitle: { fontWeight: 700, fontSize: 16, margin: 0 },
        modalClose: { background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' },
        formLabel: { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 },
        formInput: { width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none' },
        formSelect: { width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, background: '#fff' },
        toggleWrap: (isActive) => ({
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: `1px solid ${isActive ? '#16a34a' : '#e2e8f0'}`,
            borderRadius: 10, background: isActive ? '#f0fdf4' : '#f8fafc', cursor: 'pointer'
        }),
        btnPrimary: { padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
        btnSuccess: { padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
        btnWarning: { padding: '8px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
        btnOutline: { padding: '8px 16px', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#475569' },
        overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    };

    return (
        <div style={styles.page}>
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={styles.headerIcon}><FaPills size={22} /></div>
                        <div>
                            <h1 style={styles.headerTitle}>Inventaris Obat</h1>
                            <p style={styles.headerSub}>Kelola stok obat · Verifikasi resep · Update status pesanan</p>
                        </div>
                    </div>
                    {pendingRxCount > 0 && (
                        <div style={styles.badgeWarning} onClick={() => { setActiveTab('orders'); setOrderStatus('waiting_prescription'); }}>
                            <FaFileImage /> <strong>{pendingRxCount} resep</strong> menunggu verifikasi
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div style={styles.statGrid}>
                    {[
                        { label: 'Total Obat', value: medicines.length, color: '#2563eb', icon: FaPills },
                        { label: 'Stok Menipis', value: lowStockCount, color: '#dc2626', icon: FaExclamationTriangle },
                        { label: 'Total Pesanan', value: orders.length, color: '#0e7490', icon: FaShoppingCart },
                        { label: 'Perlu Diproses', value: orders.filter(o => ['paid', 'waiting_prescription'].includes(o.status)).length, color: '#f59e0b', icon: FaClock },
                    ].map(s => (
                        <div key={s.label} style={styles.statCard}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 12, color: s.color, fontWeight: 500 }}>{s.label}</span>
                                <s.icon style={{ color: s.color, opacity: 0.5 }} size={18} />
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a' }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div style={styles.tabBar}>
                    <button style={styles.tabBtn(activeTab === 'medicines')} onClick={() => setActiveTab('medicines')}>
                        <FaBoxOpen style={{ marginRight: 6 }} /> Daftar Obat
                    </button>
                    <button style={styles.tabBtn(activeTab === 'orders')} onClick={() => setActiveTab('orders')}>
                        <FaShoppingCart style={{ marginRight: 6 }} /> Pesanan {pendingRxCount > 0 && <span style={{ background: '#dc2626', color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: 10, marginLeft: 6 }}>{pendingRxCount}</span>}
                    </button>
                    <button style={styles.tabBtn(activeTab === 'refunds')} onClick={() => setActiveTab('refunds')}>
                        🎥 Refund {refundOrders.length > 0 && <span style={{ background: '#dc2626', color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: 10, marginLeft: 6 }}>{refundOrders.length}</span>}
                    </button>
                </div>

                {/* TAB: OBAT */}
                {activeTab === 'medicines' && (
                    <div>
                        <div style={styles.toolbar}>
                            <div style={styles.searchBox}>
                                <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 12 }} />
                                <input style={styles.searchInput} placeholder="Cari nama atau kategori..." value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                            <button style={styles.addBtn} onClick={() => openMedModal()}><FaPlus size={12} /> Tambah Obat</button>
                        </div>
                        <table style={styles.table}>
                            <thead>
                                <tr><th style={styles.th}>Foto</th><th style={styles.th}>Nama Obat</th><th style={styles.th}>Kategori</th><th style={styles.th}>Harga</th><th style={styles.th}>Stok</th><th style={styles.th}>Resep</th><th style={styles.th}>Mhs</th><th style={styles.th}>Status</th><th style={styles.th}>Aksi</th></tr>
                            </thead>
                            <tbody>
                                {filteredMeds.length === 0 ? (
                                    <tr><td colSpan={9} style={{ ...styles.td, textAlign: 'center', color: '#94a3b8' }}>Tidak ada obat</td></tr>
                                ) : filteredMeds.map(m => (
                                    <tr key={m._id}>
                                        <td style={styles.td}>{m.image ? <img src={`${API_URL}${m.image}`} alt={m.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} /> : <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaPills size={18} /></div>}</td>
                                        <td style={styles.td}><div style={{ fontWeight: 600 }}>{m.name}</div>{m.genericName && <div style={{ fontSize: 11, color: '#64748b' }}>{m.genericName}</div>}</td>
                                        <td style={styles.td}><span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: 12, fontSize: 11 }}>{CATEGORIES.find(c => c.value === m.category)?.label || m.category}</span></td>
                                        <td style={styles.td}>{fmt(m.price)}</td>
                                        <td style={styles.td}><span style={{ background: m.stock <= 5 ? '#fee2e2' : m.stock <= 10 ? '#fef3c7' : '#dcfce7', padding: '3px 8px', borderRadius: 12, fontSize: 11 }}>{m.stock} {m.unit}</span></td>
                                        <td style={styles.td}>{m.requiresPrescription ? 'Ya' : '-'}</td>
                                        <td style={styles.td}>{m.availableForStudentQuota ? <FaStar color="#7c3aed" /> : '-'}</td>
                                        <td style={styles.td}>{m.isActive !== false ? 'Aktif' : 'Nonaktif'}</td>
                                        <td style={styles.td}><button onClick={() => openMedModal(m)}><FaEdit /></button><button onClick={() => handleToggleActive(m)}>{m.isActive !== false ? <FaToggleOff /> : <FaToggleOn />}</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB: PESANAN */}
                {activeTab === 'orders' && (
                    <div>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                            <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                                <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 12 }} />
                                <input style={styles.searchInput} placeholder="Cari nama, email, atau nomor pesanan..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
                            </div>
                            <select style={styles.formSelect} value={orderStatus} onChange={e => setOrderStatus(e.target.value)}>
                                <option value="all">Semua Status</option>
                                {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <span style={{ fontSize: 13, color: '#64748b', marginLeft: 'auto' }}>{filteredOrders.length} pesanan</span>
                        </div>

                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                            {filteredOrders.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}><FaShoppingCart size={32} /><p>Tidak ada pesanan ditemukan</p></div>
                            ) : filteredOrders.map(o => (
                                <div key={o._id}>
                                    <div style={{ ...styles.orderRow, display: 'grid', gridTemplateColumns: '28px 1fr 1fr 100px 110px 100px auto', alignItems: 'center', padding: '12px 16px', gap: 12 }} onClick={() => toggleExpand(o._id)}>
                                        <div>{expandedOrders.has(o._id) ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}</div>
                                        <div><div style={{ fontWeight: 600 }}>{o.orderNumber}</div><div style={{ fontSize: 11, color: '#64748b' }}>{fmtDate(o.createdAt)}</div></div>
                                        <div>
                                        <div style={{ fontWeight: 500 }}>{o.userId?.name || '-'}</div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>{o.userId?.email}</div>
                                        {getShipping(o).phone && (
                                            <div style={{ fontSize: 11, color: '#0ea5e9', fontWeight: 600 }}>
                                                📞 {getShipping(o).phone}
                                            </div>
                                             )}
                                        </div>
                                        <div>{o.deliveryMethod === 'pickup' ? 'Pickup' : 'Diantar'}</div>
                                        <div>{getStatusBadge(o.status)}</div>
                                        <div style={{ textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{fmt(o.totalAmount)}</div>
                                        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                                            {o.status === 'waiting_prescription' && <button style={styles.btnWarning} onClick={() => openOrderModal(o, 'verify-rx')}><FaFileImage size={11} /> Verifikasi</button>}
                                            {getQuickActionLabel(o) && <button style={styles.btnSuccess} onClick={(e) => { e.stopPropagation(); handleQuickStatus(o); }}>{getQuickActionLabel(o).icon} {getQuickActionLabel(o).text}</button>}
                                        </div>
                                    </div>
                                    {expandedOrders.has(o._id) && (
                                        <div style={styles.orderExpanded}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
                                                <div>
                                                    <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Item Pesanan</p>
                                                    {o.items?.map((item, i) => {
                                                        const subtotal = (item.finalPrice || item.price || 0) * (item.quantity || 0);
                                                        return (
                                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                                                <span>{item.name} ×{item.quantity}</span>
                                                                <span>{fmt(subtotal)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                    <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                                                        <span>Subtotal: <strong>{fmt(o.subtotalObat)}</strong></span>
                                                        <span>Ongkir: <strong>{fmt(o.shippingCost)}</strong></span>
                                                        <span>Total: <strong style={{ color: '#2563eb' }}>{fmt(o.totalAmount)}</strong></span>
                                                    </div>

                                                    {/* LOKASI PENGIRIMAN di expanded row */}
                                                    {o.deliveryMethod !== 'pickup' && (() => {
                                                        const sh = getShipping(o);
                                                        if (!sh.address && !sh.lat) return null;
                                                        return (
                                                            <div style={{ marginTop: 12, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 14px' }}>
                                                                <p style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px 0' }}>📍 Lokasi Pengiriman</p>
                                                                {sh.address && (
                                                                    <p style={{ fontSize: 13, color: '#0c4a6e', margin: '0 0 4px 0', fontWeight: 500 }}>
                                                                        {sh.address}
                                                                        {sh.detail && <span style={{ color: '#0369a1' }}>, {sh.detail}</span>}
                                                                    </p>
                                                                )}
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                                                                    {sh.lat && sh.lng && (
                                                                        <a href={`https://www.google.com/maps?q=${sh.lat},${sh.lng}`} target="_blank" rel="noreferrer"
                                                                            style={{ fontSize: 12, color: '#0284c7', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                                            🗺️ Buka di Google Maps →
                                                                        </a>
                                                                    )}
                                                                    {sh.distanceKm != null && (
                                                                        <span style={{ fontSize: 12, color: '#64748b' }}>
                                                                            📏 {Number(sh.distanceKm).toFixed(1)} km
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <div>
                                                    {o.status === 'waiting_prescription' && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                            {o.prescription && <button style={styles.btnPrimary} onClick={() => openOrderModal(o, 'adjust-items')}><FaEdit size={11} /> Sesuaikan Dosis</button>}
                                                            <button style={styles.btnWarning} onClick={() => openOrderModal(o, 'verify-rx')}><FaFileImage size={11} /> Verifikasi Resep</button>
                                                        </div>
                                                    )}
                                                    {getQuickActionLabel(o) && <button style={{ ...styles.btnSuccess, width: '100%', marginTop: 8 }} onClick={(e) => { e.stopPropagation(); handleQuickStatus(o); }}>{getQuickActionLabel(o).icon} {getQuickActionLabel(o).text}</button>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB: REFUND */}
                {activeTab === 'refunds' && (
                    <div>
                        {refundOrders.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>🎥</div>
                                <div style={{ fontWeight: 600 }}>Tidak ada pengajuan refund</div>
                            </div>
                        ) : refundOrders.map(order => (
                            <div key={order._id || order.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{order.orderNumber}</div>
                                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                                            {order.userId?.name || order.user?.name}
                                            {getShipping(order).phone && (
                                                <> · <span style={{ color: '#0ea5e9', fontWeight: 600 }}>
                                                    📞 {getShipping(order).phone}
                                                </span></>
                                            )}
                                            {' · '}{order.userId?.email || order.user?.email}
                                        </div>
                                        <div style={{ fontSize: 13, marginTop: 4 }}>
                                            💰 <strong>{fmt(order.totalAmount)}</strong> · Diajukan: {order.refundRequestedAt ? new Date(order.refundRequestedAt).toLocaleString('id-ID') : '-'}
                                        </div>
                                        {/* ALASAN REFUND USER */}
                                        <div style={{ marginTop: 8, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                                            <span style={{ fontWeight: 600, color: '#92400e' }}>📝 Alasan Refund: </span>
                                            <span style={{ color: '#78350f' }}>{order.refundReason || '-'}</span>
                                        </div>
                                        {/* RINGKASAN ITEM */}
                                        {order.items && order.items.length > 0 && (
                                            <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
                                                💊 {order.items.map(i => `${i.medicineName || i.name} ×${i.quantity}`).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const r = await api.get(`/api/pharmacy/admin/orders/${order._id || order.id}/refund-detail`);
                                                    setRefundModal(r.data.order);
                                                } catch {
                                                    setRefundModal(order);
                                                }
                                                setRefundAction('');
                                                setRefundRejectReason('');
                                                setNeedsBankInfo(false);
                                            }}
                                            style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                                        >
                                            ▶ Tinjau
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Tambah/Edit Obat */}
            <Modal show={showMedModal} onHide={() => setShowMedModal(false)} centered size="lg">
                <div style={styles.modal}>
                    <div style={styles.modalHeader}><h5 style={styles.modalTitle}>{editingMed ? 'Edit Obat' : 'Tambah Obat Baru'}</h5><button onClick={() => setShowMedModal(false)} style={styles.modalClose}>×</button></div>
                    <Form onSubmit={handleSaveMed}>
                        <Row className="g-3">
                            <Col md={12}>
                                <label style={styles.formLabel}>Gambar Obat</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 80, height: 80, borderRadius: 12, border: '2px dashed #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                        {imagePreview ? <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FaPills size={28} color="#94a3b8" />}
                                    </div>
                                    <div>
                                        <input ref={imageRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (!f) return; if (f.size > 3 * 1024 * 1024) { toast.error('Maks 3MB'); return; } setImageFile(f); setImagePreview(URL.createObjectURL(f)); }} />
                                        <button type="button" style={styles.btnOutline} onClick={() => imageRef.current.click()}><FaUpload size={12} />{imagePreview ? 'Ganti' : 'Pilih Gambar'}</button>
                                        {imageFile && <button type="button" style={{ background: 'none', border: 'none', color: '#b91c1c', fontSize: 12, cursor: 'pointer', marginLeft: 8 }} onClick={() => { setImageFile(null); setImagePreview(editingMed?.image ? `${API_URL}${editingMed.image}` : null); }}>Hapus</button>}
                                    </div>
                                </div>
                            </Col>
                            <Col md={6}><label style={styles.formLabel}>Nama Obat *</label><input style={styles.formInput} value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))} required /></Col>
                            <Col md={6}><label style={styles.formLabel}>Nama Generik</label><input style={styles.formInput} value={medForm.genericName} onChange={e => setMedForm(f => ({ ...f, genericName: e.target.value }))} /></Col>
                            <Col md={6}><label style={styles.formLabel}>Jenis Obat *</label><select style={styles.formSelect} value={medForm.category} onChange={e => setMedForm(f => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Col>
                            <Col md={3}><label style={styles.formLabel}>Satuan</label><select style={styles.formSelect} value={medForm.unit} onChange={e => setMedForm(f => ({ ...f, unit: e.target.value }))}>{['tablet', 'kapsul', 'botol', 'sachet', 'tube', 'pcs', 'strip', 'ampul'].map(u => <option key={u} value={u}>{u}</option>)}</select></Col>
                            <Col md={3}><label style={styles.formLabel}>Harga (Rp) *</label><input type="number" style={styles.formInput} value={medForm.price} onChange={e => setMedForm(f => ({ ...f, price: e.target.value }))} required /></Col>
                            <Col md={3}><label style={styles.formLabel}>Stok *</label><input type="number" style={styles.formInput} value={medForm.stock} onChange={e => setMedForm(f => ({ ...f, stock: e.target.value }))} required /></Col>
                            <Col md={12}><label style={styles.formLabel}>Deskripsi</label><textarea rows={2} style={styles.formInput} value={medForm.description} onChange={e => setMedForm(f => ({ ...f, description: e.target.value }))} /></Col>
                            <Col md={12}><div style={styles.toggleWrap(medForm.isActive)} onClick={() => setMedForm(f => ({ ...f, isActive: !f.isActive }))}>{medForm.isActive ? <FaToggleOn size={22} style={{ color: '#16a34a' }} /> : <FaToggleOff size={22} style={{ color: '#b91c1c' }} />}<div><div>{medForm.isActive ? 'Aktif — tersedia untuk pasien' : 'Nonaktif — tidak bisa dibeli'}</div></div></div></Col>
                            <Col md={6}><div style={styles.toggleWrap(medForm.requiresPrescription)} onClick={() => setMedForm(f => ({ ...f, requiresPrescription: !f.requiresPrescription }))}>{medForm.requiresPrescription ? <FaToggleOn size={22} style={{ color: '#16a34a' }} /> : <FaToggleOff size={22} style={{ color: '#94a3b8' }} />}<div><div>{medForm.requiresPrescription ? 'Ya, butuh resep' : 'Tidak butuh resep'}</div></div></div></Col>
                            <Col md={6}><div style={styles.toggleWrap(medForm.availableForStudentQuota)} onClick={() => setMedForm(f => ({ ...f, availableForStudentQuota: !f.availableForStudentQuota }))}>{medForm.availableForStudentQuota ? <FaToggleOn size={22} style={{ color: '#7c3aed' }} /> : <FaToggleOff size={22} style={{ color: '#94a3b8' }} />}<div><div>{medForm.availableForStudentQuota ? 'Aktif — masuk kuota gratis mhs' : 'Tidak aktif'}</div></div></div></Col>
                        </Row>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                            <button type="button" style={styles.btnOutline} onClick={() => setShowMedModal(false)}>Batal</button>
                            <button type="submit" style={styles.btnSuccess} disabled={savingMed || uploadingImg}>{(savingMed || uploadingImg) ? <><Spinner size="sm" /> Menyimpan...</> : <><FaSave size={12} /> {editingMed ? 'Simpan Perubahan' : 'Tambah Obat'}</>}</button>
                        </div>
                    </Form>
                </div>
            </Modal>

            {/* Modal Verifikasi Resep & Sesuaikan Dosis */}
            <Modal show={showOrderModal} onHide={() => setShowOrderModal(false)} centered size="lg">
                <div style={styles.modal}>
                    <div style={styles.modalHeader}>
                        <h5 style={styles.modalTitle}>
                            {orderAction === 'verify-rx' && <><FaFileImage style={{ color: '#f59e0b', marginRight: 8 }} />Verifikasi Resep</>}
                            {orderAction === 'adjust-items' && <><FaEdit style={{ color: '#2563eb', marginRight: 8 }} />Sesuaikan Dosis</>}
                            {orderAction === 'rx-preview' && <><FaEye style={{ color: '#2563eb', marginRight: 8 }} />Foto Resep</>}
                        </h5>
                        <button onClick={() => setShowOrderModal(false)} style={styles.modalClose}>×</button>
                    </div>

                    {selectedOrder && (
                        <div>
                            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontWeight: 600 }}>{selectedOrder.orderNumber}</span>{getStatusBadge(selectedOrder.status)}</div>
                                <div style={{ color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '0 10px', alignItems: 'center' }}>
                                <span>{selectedOrder.userId?.name}</span>
                                <span>·</span>
                                <span>{selectedOrder.userId?.email}</span>
                                {getShipping(selectedOrder).phone && (
                                    <>
                                        <span>·</span>
                                        <span style={{ color: '#0ea5e9', fontWeight: 600 }}>
                                            📞 {getShipping(selectedOrder).phone}
                                        </span>
                                    </>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 12 }}><span>Total: <strong style={{ color: '#2563eb' }}>{fmt(selectedOrder.totalAmount)}</strong></span><span>{selectedOrder.deliveryMethod === 'pickup' ? '📦 Pickup' : '🚚 Diantar'}</span></div>
                            </div>

                            {/* LOKASI PENGIRIMAN */}
                            {selectedOrder.deliveryMethod !== 'pickup' && (() => {
                                const sh = getShipping(selectedOrder);
                                if (!sh.address && !sh.lat) return null;
                                return (
                                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px 0' }}>📍 Lokasi Pengiriman</p>
                                    {sh.address && (
                                        <p style={{ fontSize: 13, color: '#0c4a6e', margin: '0 0 4px 0', fontWeight: 500 }}>
                                            {sh.address}
                                            {sh.detail && (
                                                <span style={{ color: '#0369a1' }}>, {sh.detail}</span>
                                            )}
                                        </p>
                                    )}
                                    {sh.lat && sh.lng && (
                                        <a
                                            href={`https://www.google.com/maps?q=${sh.lat},${sh.lng}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ fontSize: 12, color: '#0284c7', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}
                                        >
                                            🗺️ Buka di Google Maps →
                                        </a>
                                    )}
                                    {sh.distanceKm != null && (
                                        <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0 0' }}>
                                            📏 Jarak: <strong>{Number(sh.distanceKm).toFixed(1)} km</strong>
                                        </p>
                                    )}
                                </div>
                                );
                            })()}

                            {/* VERIFIKASI RESEP */}
                            {orderAction === 'verify-rx' && (
                                <div>
                                    {(selectedOrder.prescription?.url || selectedOrder.prescription?.imageUrl) ? (() => {
                                        const rxUrl = selectedOrder.prescription?.url || selectedOrder.prescription?.imageUrl;
                                        const fullUrl = rxUrl.startsWith('http') ? rxUrl : `${API_URL}${rxUrl}`;
                                        const isPdf = rxUrl.toLowerCase().endsWith('.pdf');
                                        return (
                                            <div style={{ marginBottom: 16 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                    <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', margin: 0 }}>FILE RESEP PASIEN</p>
                                                    <a href={fullUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600, textDecoration: 'none' }}>Buka di Tab Baru →</a>
                                                </div>
                                                {isPdf ? <iframe src={fullUrl} title="Resep PDF" style={{ width: '100%', height: 340, border: '1px solid #e2e8f0', borderRadius: 10 }} /> : <img src={fullUrl} alt="Resep" style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 10, border: '1px solid #e2e8f0', display: 'block', cursor: 'pointer' }} onClick={() => window.open(fullUrl, '_blank')} />}
                                            </div>
                                        );
                                    })() : <div style={{ background: '#fef3c7', borderRadius: 10, padding: '12px 14px', marginBottom: 12, fontSize: 13, color: '#92400e' }}>⚠️ Pasien belum mengupload foto/file resep.</div>}

                                    <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>KEPUTUSAN VERIFIKASI</p>
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                        <button style={{ flex: 1, padding: '10px', borderRadius: 8, border: `2px solid ${newStatus === 'approve' ? '#16a34a' : '#e2e8f0'}`, background: newStatus === 'approve' ? '#f0fdf4' : '#fff', color: newStatus === 'approve' ? '#166534' : '#475569', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setNewStatus('approve'); setRejectReason(''); }}>✅ Setujui Resep</button>
                                        <button style={{ flex: 1, padding: '10px', borderRadius: 8, border: `2px solid ${newStatus === 'reject' ? '#dc2626' : '#e2e8f0'}`, background: newStatus === 'reject' ? '#fef2f2' : '#fff', color: newStatus === 'reject' ? '#b91c1c' : '#475569', cursor: 'pointer', fontWeight: 600 }} onClick={() => setNewStatus('reject')}>❌ Tolak Resep</button>
                                    </div>
                                    {newStatus === 'approve' && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#166534' }}>Stok akan dikunci 15 menit untuk pembayaran.</div>}
                                    {newStatus === 'reject' && (<div><label style={styles.formLabel}>Alasan Penolakan <span style={{ color: '#dc2626' }}>*</span></label><textarea rows={3} style={styles.formInput} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Contoh: Resep tidak jelas/buram, resep expired, nama pasien tidak sesuai..." /></div>)}
                                </div>
                            )}

                            {/* SESUAIKAN DOSIS - PERBAIKAN UTAMA */}
                            {orderAction === 'adjust-items' && (
                                <div>
                                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1e3a8a', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <FaInfoCircle style={{ marginTop: 2, flexShrink: 0 }} />
                                        Sesuaikan jumlah obat sesuai dosis yang tertera di resep. Harga akan dikalkulasi ulang otomatis.
                                    </div>
                                    {adjustedItems.map((item, i) => {
                                        const pricePerUnit = Number(item.price) || 0;
                                        const quantity = Number(item.quantity) || 1;
                                        const subtotal = pricePerUnit * quantity;
                                        
                                        return (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                                                <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <button 
                                                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 16 }}
                                                        onClick={() => { 
                                                            const a = [...adjustedItems]; 
                                                            a[i].quantity = Math.max(1, quantity - 1); 
                                                            setAdjustedItems(a); 
                                                        }}
                                                    >−</button>
                                                    <span style={{ minWidth: 40, textAlign: 'center', fontWeight: 600 }}>{quantity}</span>
                                                    <button 
                                                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 16 }}
                                                        onClick={() => { 
                                                            const a = [...adjustedItems]; 
                                                            a[i].quantity = quantity + 1; 
                                                            setAdjustedItems(a); 
                                                        }}
                                                    >+</button>
                                                </div>
                                                <div style={{ minWidth: 100, textAlign: 'right', fontSize: 13, color: '#2563eb', fontWeight: 600 }}>
                                                    {fmt(subtotal)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, marginTop: 8, fontWeight: 700, fontSize: 15, borderTop: '1px solid #e2e8f0' }}>
                                        Total Baru: <span style={{ color: '#2563eb', marginLeft: 8, fontSize: 16 }}>
                                            {fmt(calculateAdjustedTotal())}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* RX PREVIEW */}
                            {orderAction === 'rx-preview' && (selectedOrder.prescription?.url || selectedOrder.prescription?.imageUrl) && (() => {
                                const rxUrl = selectedOrder.prescription?.url || selectedOrder.prescription?.imageUrl;
                                const fullUrl = rxUrl.startsWith('http') ? rxUrl : `${API_URL}${rxUrl}`;
                                const isPdf = rxUrl.toLowerCase().endsWith('.pdf');
                                return (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}><a href={fullUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600, textDecoration: 'none' }}>Buka di Tab Baru →</a></div>
                                        {isPdf ? <iframe src={fullUrl} title="Resep PDF" style={{ width: '100%', height: 480, border: '1px solid #e2e8f0', borderRadius: 10 }} /> : <img src={fullUrl} alt="Resep" style={{ maxWidth: '100%', maxHeight: 500, objectFit: 'contain', borderRadius: 10, display: 'block', margin: '0 auto', cursor: 'pointer' }} onClick={() => window.open(fullUrl, '_blank')} />}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {orderAction !== 'rx-preview' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                            <button style={styles.btnOutline} onClick={() => setShowOrderModal(false)}>Batal</button>
                            <button style={styles.btnSuccess} onClick={handleOrderAction} disabled={updatingOrder || (orderAction === 'verify-rx' && (!newStatus || (newStatus === 'reject' && !rejectReason.trim())))}>
                                {updatingOrder ? <><Spinner size="sm" /> Memproses...</> : (orderAction === 'verify-rx' ? '✅ Konfirmasi Verifikasi' : '💾 Simpan Perubahan')}
                            </button>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Modal Refund Review — Video + Alasan + Items */}
            {refundModal && (
                <div style={styles.overlay}>
                    <div style={{
                        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 700,
                        maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)'
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                            <span style={{ fontWeight: 700, fontSize: 16 }}>🎥 Review Refund — {refundModal.orderNumber}</span>
                            <button onClick={() => { setRefundModal(null); setRefundAction(''); }} style={styles.modalClose}>×</button>
                        </div>

                        <div style={{ padding: '20px 24px' }}>
                            {/* VIDEO PLAYER */}
                            <div style={{ marginBottom: 20 }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Video Bukti Refund</p>
                                {refundModal.refundVideoUrl ? (
                                    <div style={{ background: '#000', borderRadius: 10, overflow: 'hidden' }}>
                                        <video
                                            controls
                                            style={{ width: '100%', maxHeight: 360, display: 'block' }}
                                            onError={() => {}}
                                        >
                                            <source src={refundModal.refundVideoUrl} type="video/mp4" />
                                            <source src={refundModal.refundVideoUrl} type="video/webm" />
                                            <source src={refundModal.refundVideoUrl} type="video/quicktime" />
                                        </video>
                                        <div style={{ background: '#1e293b', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#94a3b8', fontSize: 12 }}>Video tersimpan di Cloudinary</span>
                                            <a href={refundModal.refundVideoUrl} target="_blank" rel="noopener noreferrer"
                                                style={{ color: '#60a5fa', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                                                ↗ Buka di tab baru
                                            </a>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ background: '#f1f5f9', borderRadius: 10, padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                                        ⚠️ Video tidak tersedia
                                    </div>
                                )}
                            </div>

                            {/* INFO PENGGUNA */}
                            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 3 }}>NAMA</div><div style={{ fontSize: 13, fontWeight: 600 }}>{refundModal.user?.name || '-'}</div></div>
                                <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 3 }}>EMAIL</div><div style={{ fontSize: 13 }}>{refundModal.user?.email || '-'}</div></div>
                                <div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 3 }}>TELEPON</div><div style={{ fontSize: 13 }}>{refundModal.user?.phone || '-'}</div></div>
                            </div>

                            {/* ITEM PESANAN */}
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Item Pesanan</p>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc' }}>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b' }}>Nama Obat</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#64748b' }}>Qty</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b' }}>Harga</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b' }}>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(refundModal.items || []).map((item, i) => (
                                            <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '10px 12px', fontSize: 13 }}>
                                                    <div style={{ fontWeight: 500 }}>{item.medicineName}</div>
                                                    {item.manufacturer && <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.manufacturer}</div>}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13 }}>{item.quantity}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13 }}>{fmt(item.price)}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{fmt(item.subtotal)}</td>
                                            </tr>
                                        ))}
                                        <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                                            <td colSpan={3} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>Total Refund</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#2563eb' }}>{fmt(refundModal.totalAmount)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* ALASAN REFUND USER */}
                            <div style={{ marginBottom: 20 }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Alasan Refund User</p>
                                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderLeft: '4px solid #f59e0b', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#78350f', fontStyle: 'italic' }}>
                                    "{refundModal.refundReason || 'Tidak ada alasan yang diberikan'}"
                                </div>
                            </div>

                            {/* TOMBOL PILIH AKSI */}
                            {!refundAction && (
                                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                    <button
                                        onClick={() => setRefundAction('approve')}
                                        style={{ flex: 1, padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
                                    >
                                        ✅ Setujui Refund
                                    </button>
                                    <button
                                        onClick={() => setRefundAction('reject')}
                                        style={{ flex: 1, padding: '12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
                                    >
                                        ❌ Tolak Refund
                                    </button>
                                </div>
                            )}

                            {/* FORM TOLAK */}
                            {refundAction === 'reject' && (
                                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                                    <div style={{ fontWeight: 700, color: '#b91c1c', marginBottom: 12 }}>❌ Konfirmasi Penolakan</div>
                                    <label style={styles.formLabel}>Alasan Penolakan <span style={{ color: '#ef4444' }}>*</span></label>
                                    <textarea
                                        rows={3}
                                        style={{ ...styles.formInput, marginBottom: 0 }}
                                        value={refundRejectReason}
                                        onChange={e => setRefundRejectReason(e.target.value)}
                                        placeholder="Jelaskan mengapa refund ini ditolak..."
                                    />
                                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#fff', borderRadius: 8, fontSize: 12, color: '#64748b' }}>
                                        ℹ️ Video akan otomatis dihapus dari Cloudinary setelah konfirmasi.
                                    </div>
                                </div>
                            )}

                            {/* FORM SETUJUI */}
                            {refundAction === 'approve' && (
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                                    <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 8 }}>✅ Konfirmasi Persetujuan</div>
                                    <p style={{ fontSize: 13, color: '#166534', margin: '0 0 10px 0' }}>
                                        Setelah disetujui, Xendit <strong>langsung memproses transfer</strong> ke rekening yang sudah user isi saat submit. Video akan dihapus otomatis dari Cloudinary.
                                    </p>
                                    <div style={{ padding: '10px 14px', background: '#fff', borderRadius: 8, fontSize: 13, color: '#374151' }}>
                                        <div>💰 Jumlah refund: <strong style={{ color: '#2563eb' }}>{fmt(refundModal.totalAmount)}</strong></div>
                                        {refundModal.refundBankCode && (
                                            <div style={{ marginTop: 6, padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 12, color: '#166534' }}>
                                                🏦 <strong>{refundModal.refundBankCode}</strong> · {refundModal.refundAccountNumber} · a.n. {refundModal.refundAccountName}
                                            </div>
                                        )}
                                        <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>* Xendit akan langsung transfer saat Anda konfirmasi approve</div>
                                    </div>
                                </div>
                            )}

                            {/* TOMBOL SUBMIT */}
                            {refundAction && (
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button
                                        onClick={() => { setRefundAction(''); setNeedsBankInfo(false); }}
                                        style={{ flex: 1, padding: '11px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                                        disabled={processingRefund}
                                    >
                                        ← Kembali
                                    </button>
                                    <button
                                        disabled={processingRefund || (refundAction === 'reject' && !refundRejectReason.trim())}
                                        onClick={async () => {
                                            setProcessingRefund(true);
                                            try {
                                                const payload = { action: refundAction };
                                                if (refundAction === 'reject') payload.rejectReason = refundRejectReason;
                                                await api.put(`/api/pharmacy/admin/orders/${refundModal.id || refundModal._id}/refund-review`, payload);
                                                toast.success(refundAction === 'approve'
                                                    ? '✅ Refund disetujui! Transfer Xendit langsung diproses ke rekening user.'
                                                    : '❌ Refund ditolak. Video dihapus dari Cloudinary.');
                                                setRefundModal(null);
                                                setRefundAction('');
                                                fetchData();
                                            } catch (err) {
                                                toast.error(err.response?.data?.message || 'Gagal memproses refund');
                                            } finally {
                                                setProcessingRefund(false);
                                            }
                                        }}
                                        style={{
                                            flex: 2, padding: '11px',
                                            background: refundAction === 'approve' ? '#16a34a' : '#dc2626',
                                            color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700,
                                            cursor: processingRefund ? 'not-allowed' : 'pointer',
                                            opacity: processingRefund ? 0.6 : 1, fontSize: 14
                                        }}
                                    >
                                        {processingRefund ? '⏳ Memproses...' : (refundAction === 'approve' ? '✅ Konfirmasi Setujui' : '❌ Konfirmasi Tolak')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagePharmacy;