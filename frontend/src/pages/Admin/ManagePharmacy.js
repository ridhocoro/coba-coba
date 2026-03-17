import React, { useState, useEffect, useRef } from 'react';
import api, { API_URL } from '../../utils/api';
import { Container, Row, Col, Spinner, Modal, Form } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import {
    FaPills, FaSearch, FaPlus, FaEdit, FaTrash, FaBoxOpen, FaShoppingCart,
    FaUpload, FaImage, FaClock, FaExclamationTriangle, FaCheckCircle,
    FaTimesCircle, FaTruck, FaSave, FaTimes, FaFileImage, FaEye,
    FaToggleOn, FaToggleOff, FaMotorcycle, FaStore, FaBan,
    FaStar, FaChevronDown, FaChevronUp, FaGraduationCap, FaMapMarkerAlt, FaInfoCircle,
} from 'react-icons/fa';
import { Link } from 'react-router-dom';

const CATEGORIES = [
    { value: 'obat_bebas',           label: 'Obat Bebas'           },
    { value: 'obat_bebas_terbatas',  label: 'Obat Bebas Terbatas'  },
    { value: 'obat_keras',           label: 'Obat Keras (Resep)'   },
    { value: 'antibiotik',           label: 'Antibiotik'           },
    { value: 'vitamin',              label: 'Vitamin & Suplemen'   },
    { value: 'alat_kesehatan',       label: 'Alat Kesehatan'       },
];

const STATUS_CFG = {
    waiting_prescription : { bg:'#fef9c3', color:'#854d0e', label:'Menunggu Verifikasi Resep', icon:FaFileImage },
    prescription_rejected: { bg:'#fee2e2', color:'#991b1b', label:'Resep Ditolak',             icon:FaTimesCircle },
    pending              : { bg:'#fef3c7', color:'#b45309', label:'Menunggu Pembayaran',        icon:FaClock },
    paid                 : { bg:'#dbeafe', color:'#1e40af', label:'Sudah Bayar',                icon:FaCheckCircle },
    diproses             : { bg:'#cffafe', color:'#0e7490', label:'Sedang Diproses',            icon:FaBoxOpen },
    dikirim              : { bg:'#ede9fe', color:'#6d28d9', label:'Sedang Dikirim',             icon:FaTruck },
    terkirim             : { bg:'#d1fae5', color:'#065f46', label:'Sudah Tiba',                 icon:FaMotorcycle },
    siap_diambil         : { bg:'#ecfdf5', color:'#065f46', label:'Siap Diambil',               icon:FaStore },
    selesai              : { bg:'#dcfce7', color:'#166534', label:'Selesai',                    icon:FaCheckCircle },
    // 'expired' disembunyikan dari admin — ditangani otomatis oleh cron
    cancelled            : { bg:'#f1f5f9', color:'#475569', label:'Dibatalkan',                 icon:FaBan },
};

const fmt = (n) => `Rp ${(n||0).toLocaleString('id-ID')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';

const ManagePharmacy = () => {
    const [medicines,   setMedicines]   = useState([]);
    const [orders,      setOrders]      = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [search,      setSearch]      = useState('');
    const [orderSearch, setOrderSearch] = useState('');
    const [orderStatus, setOrderStatus] = useState('all');
    const [activeTab,   setActiveTab]   = useState('orders');

    // Med modal
    const [showMedModal,  setShowMedModal]  = useState(false);
    const [editingMed,    setEditingMed]    = useState(null);
    const [medForm,       setMedForm]       = useState({ name:'', genericName:'', category:'obat_bebas', price:'', stock:'', unit:'tablet', description:'', requiresPrescription:false, availableForStudentQuota:false, isActive:true });
    const [savingMed,     setSavingMed]     = useState(false);
    const [imageFile,     setImageFile]     = useState(null);
    const [imagePreview,  setImagePreview]  = useState(null);
    const [uploadingImg,  setUploadingImg]  = useState(false);
    const imageRef = useRef();

    // Order detail modal
    const [selectedOrder,  setSelectedOrder]  = useState(null);
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [orderAction,    setOrderAction]    = useState('status');
    const [newStatus,      setNewStatus]      = useState('');
    const [rejectReason,   setRejectReason]   = useState('');
    const [adjustedItems,  setAdjustedItems]  = useState([]);
    const [updatingOrder,  setUpdatingOrder]  = useState(false);
    const [rxPreview,      setRxPreview]      = useState(false);

    // Refund requests
    const [refundOrders,       setRefundOrders]       = useState([]);
    const [refundModal,        setRefundModal]        = useState(null);
    const [refundAction,       setRefundAction]       = useState(''); // 'approve'|'reject'
    const [refundRejectReason, setRefundRejectReason] = useState('');
    const [refundBankCode,     setRefundBankCode]     = useState('');
    const [refundAccount,      setRefundAccount]      = useState('');
    const [refundAccountName,  setRefundAccountName]  = useState('');
    const [processingRefund,   setProcessingRefund]   = useState(false);
    const [needsBankInfo,      setNeedsBankInfo]       = useState(false);
    const [bankList,           setBankList]            = useState([]);

    // Expand/collapse order rows
    const [expandedOrders, setExpandedOrders] = useState(new Set());

    useEffect(() => {
        fetchData();
        api.get('/api/xendit/banks').then(r => setBankList(r.data.banks || [])).catch(()=>{});
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [medsRes, ordersRes, refundRes] = await Promise.all([
                api.get('/api/pharmacy/admin/medicines?limit=200'),
                api.get('/api/pharmacy/admin/orders?limit=100'),
                api.get('/api/pharmacy/admin/orders/refund-requests').catch(()=>({ data: { orders: [] } })),
            ]);
            setRefundOrders(refundRes.data.orders || []);
            setMedicines(medsRes.data.medicines || []);
            setOrders(ordersRes.data.orders || []);
        } catch { toast.error('Gagal memuat data'); }
        finally  { setLoading(false); }
    };

    // ── Med modal ─────────────────────────────────────────────────────────────
    const openMedModal = (med=null) => {
        if (med) {
            setEditingMed(med);
            setMedForm({ name:med.name||'', genericName:med.genericName||'', category:med.category||'obat_bebas', price:med.price||'', stock:med.stock||'', unit:med.unit||'tablet', description:med.description||'', requiresPrescription:!!med.requiresPrescription, availableForStudentQuota:!!med.availableForStudentQuota, isActive:med.isActive!==false });
            setImagePreview(med.image?`${API_URL}${med.image}`:null);
        } else {
            setEditingMed(null);
            setMedForm({ name:'', genericName:'', category:'obat_bebas', price:'', stock:'', unit:'tablet', description:'', requiresPrescription:false, availableForStudentQuota:false });
            setImagePreview(null);
        }
        setImageFile(null);
        setShowMedModal(true);
    };

    const handleSaveMed = async (e) => {
        e.preventDefault();
        if (!medForm.name||!medForm.price||medForm.stock==='') { toast.error('Nama, harga, dan stok wajib diisi'); return; }
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
                    const fd = new FormData(); fd.append('image', imageFile);
                    await api.post(`/api/pharmacy/admin/medicines/${savedId}/image`, fd, { headers:{'Content-Type':'multipart/form-data'} });
                } catch { toast.error('Data tersimpan, tapi gambar gagal diupload'); }
                finally { setUploadingImg(false); }
            }
            setShowMedModal(false);
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal menyimpan'); }
        finally { setSavingMed(false); }
    };

    const handleToggleActive = async (med) => {
        const willActivate = med.isActive === false;
        const msg = willActivate ? `Aktifkan kembali obat "${med.name}"?` : `Nonaktifkan obat "${med.name}"? Obat akan tetap tampil tapi tidak bisa dibeli.`;
        if (!window.confirm(msg)) return;
        try {
            await api.put(`/api/pharmacy/admin/medicines/${med._id}`, { isActive: willActivate });
            toast.success(willActivate ? 'Obat diaktifkan kembali' : 'Obat dinonaktifkan');
            fetchData();
        } catch { toast.error('Gagal mengubah status'); }
    };

    // ── Order modal ───────────────────────────────────────────────────────────
    const openOrderModal = (order, action='status') => {
        setSelectedOrder(order);
        setOrderAction(action);
        setNewStatus('');
        setRejectReason('');
        setRxPreview(false);
        if (action==='adjust-items') {
            setAdjustedItems(order.items.map(i=>({ medicineId:i.medicineId?._id||i.medicineId, name:i.name, quantity:i.quantity, price:i.price })));
        }
        setShowOrderModal(true);
    };

    // Transisi valid per status
    const getValidNextStatuses = (order) => {
        const isPickup = order.deliveryMethod==='pickup';
        const map = {
            paid         : ['diproses','cancelled'],
            diproses     : isPickup ? ['cancelled'] : ['dikirim','cancelled'],
            dikirim      : ['terkirim'],
            terkirim     : ['selesai'],
            siap_diambil : ['selesai','cancelled'],
        };
        return map[order.status] || [];
    };

    const handleOrderAction = async () => {
        if (!selectedOrder) return;
        setUpdatingOrder(true);
        try {
            if (orderAction==='verify-rx') {
                if (!newStatus) { toast.error('Pilih approve atau reject'); setUpdatingOrder(false); return; }
                const payload = { action: newStatus };
                if (newStatus==='reject') payload.reason = rejectReason;
                await api.put(`/api/pharmacy/admin/orders/${selectedOrder._id}/verify-prescription`, payload);
                toast.success(newStatus==='approve'?'Resep disetujui':'Resep ditolak');

            } else if (orderAction==='adjust-items') {
                const payload = { items: adjustedItems.map(i=>({ medicineId:i.medicineId, quantity:i.quantity })) };
                await api.put(`/api/pharmacy/admin/orders/${selectedOrder._id}/adjust-items`, payload);
                toast.success('Jumlah item diperbarui');

            } else {
                if (!newStatus) { toast.error('Pilih status baru'); setUpdatingOrder(false); return; }
                await api.put(`/api/pharmacy/admin/orders/${selectedOrder._id}/status`, { status: newStatus });
                toast.success('Status diperbarui');
            }
            setShowOrderModal(false);
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal'); }
        finally { setUpdatingOrder(false); }
    };

    const toggleExpand = (id) => {
        setExpandedOrders(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });
    };

    // ── Filtered data ─────────────────────────────────────────────────────────
    const filteredMeds = medicines.filter(m =>
        !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.category?.toLowerCase().includes(search.toLowerCase())
    );

    // Admin tidak perlu lihat expired — cron sudah handle otomatis
    const filteredOrders = orders.filter(o => o.status !== 'expired').filter(o => {
        const q = orderSearch.toLowerCase();
        const matchQ = !orderSearch || o.userId?.name?.toLowerCase().includes(q) || o.userId?.email?.toLowerCase().includes(q) || o.orderNumber?.toLowerCase().includes(q);
        const matchS = orderStatus==='all' || o.status===orderStatus;
        return matchQ && matchS;
    });

    const pendingRxCount = orders.filter(o=>o.status==='waiting_prescription').length;
    const lowStockCount  = medicines.filter(m=>m.stock<=10).length;

    const getStatusBadge = (status) => {
        const v = STATUS_CFG[status] || { bg:'#f1f5f9', color:'#475569', label:status, icon:FaBoxOpen };
        return <span style={{background:v.bg,color:v.color,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,display:'inline-flex',alignItems:'center',gap:4}}><v.icon size={10}/>{v.label}</span>;
    };

    if (loading) return (
        <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc'}}>
            <Spinner animation="border" variant="primary"/>
        </div>
    );

    return (
        <div style={{minHeight:'100vh',background:'#f8fafc',fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",padding:24}}>
            <style>{`
                .adm-tab{padding:10px 20px;border-radius:30px;font-size:13px;font-weight:500;border:none;background:transparent;color:#64748b;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .2s}
                .adm-tab.active{background:#dcfce7;color:#166534}
                .tbl th{background:#f8fafc;padding:13px 16px;font-size:12px;font-weight:600;color:#475569;text-align:left;border-bottom:1px solid #e2e8f0}
                .tbl td{padding:14px 16px;font-size:13px;color:#0f172a;border-bottom:1px solid #f1f5f9;vertical-align:middle}
                .tbl tr:hover td{background:#fafafa}
                .btn-g{background:#16a34a;color:#fff;border:none;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
                .btn-g:hover{background:#15803d}
                .btn-b{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:7px 14px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-family:inherit}
                .btn-b:hover{background:#1d4ed8}
                .btn-y{background:#f59e0b;color:#fff;border:none;border-radius:10px;padding:7px 14px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-family:inherit}
                .btn-y:hover{background:#d97706}
                .btn-r{background:#b91c1c;color:#fff;border:none;border-radius:10px;padding:7px 14px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-family:inherit}
                .btn-r:hover{background:#991b1b}
                .btn-o-sm{background:transparent;border:1px solid #e2e8f0;color:#475569;border-radius:10px;padding:7px 14px;font-size:12px;cursor:pointer;font-family:inherit}
                .inp{width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;font-family:inherit;outline:none}
                .inp:focus{border-color:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.1)}
                .toggle-wrap{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;cursor:pointer;transition:all .2s}
                .toggle-wrap.on{border-color:#16a34a;background:#f0fdf4}
                .stat-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px}
            `}</style>

            <Container fluid style={{maxWidth:1400,margin:'0 auto'}}>
                {/* Header */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <Link to="/admin" style={{color:'#64748b',fontSize:13,textDecoration:'none',display:'flex',alignItems:'center',gap:4}}>← Admin</Link>
                        <div style={{width:44,height:44,background:'#dcfce7',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',color:'#16a34a'}}><FaPills size={22}/></div>
                        <div>
                            <h1 style={{fontSize:22,fontWeight:700,color:'#0f172a',marginBottom:2}}>Manajemen Farmasi</h1>
                            <p style={{fontSize:13,color:'#64748b',marginBottom:0}}>Kelola obat · verifikasi resep · update status pesanan</p>
                        </div>
                    </div>
                    {pendingRxCount>0&&(
                        <div style={{background:'#fef9c3',border:'1px solid #fcd34d',borderRadius:12,padding:'10px 16px',display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#92400e',cursor:'pointer'}} onClick={()=>{setActiveTab('orders');setOrderStatus('waiting_prescription');}}>
                            <FaFileImage/><strong>{pendingRxCount} resep</strong> menunggu verifikasi
                        </div>
                    )}
                </div>

                {/* Stats */}
                <Row className="g-3 mb-4">
                    {[
                        { label:'Total Obat',     value:medicines.length,                                                        color:'#2563eb',  icon:FaPills },
                        { label:'Stok Menipis',   value:lowStockCount,                                                           color:'#b91c1c',  icon:FaExclamationTriangle },
                        { label:'Total Pesanan',  value:orders.length,                                                           color:'#0e7490',  icon:FaShoppingCart },
                        { label:'Perlu Diproses', value:orders.filter(o=>['paid','waiting_prescription'].includes(o.status)).length, color:'#b45309', icon:FaClock },
                    ].map(s=>(
                        <Col md={3} xs={6} key={s.label}>
                            <div className="stat-card">
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                                    <span style={{fontSize:13,color:s.color,fontWeight:500}}>{s.label}</span>
                                    <s.icon style={{color:s.color,opacity:.5}} size={18}/>
                                </div>
                                <div style={{fontSize:28,fontWeight:700,color:'#0f172a'}}>{s.value}</div>
                            </div>
                        </Col>
                    ))}
                </Row>

                {/* Tabs */}
                <div style={{display:'flex',gap:6,marginBottom:24,borderBottom:'1px solid #e2e8f0',paddingBottom:8}}>
                    <button className={`adm-tab ${activeTab==='orders'?'active':''}`} onClick={()=>setActiveTab('orders')}>
                        <FaShoppingCart/> Pesanan {pendingRxCount>0&&<span style={{background:'#b91c1c',color:'#fff',borderRadius:20,padding:'1px 6px',fontSize:10}}>{pendingRxCount}</span>}
                    </button>
                    <button className={`adm-tab ${activeTab==='medicines'?'active':''}`} onClick={()=>setActiveTab('medicines')}>
                        <FaBoxOpen/> Daftar Obat
                    </button>
                    <button className={`adm-tab ${activeTab==='refunds'?'active':''}`} onClick={()=>setActiveTab('refunds')}>
                        🎥 Refund {refundOrders.length>0&&<span style={{background:'#b91c1c',color:'#fff',borderRadius:20,padding:'1px 6px',fontSize:10,marginLeft:4}}>{refundOrders.length}</span>}
                    </button>
                </div>

                {/* ─── TAB: PESANAN ────────────────────────────────────── */}
                {activeTab==='orders'&&(
                    <div>
                        <Row className="g-3 mb-3">
                            <Col md={5}>
                                <div style={{position:'relative'}}>
                                    <FaSearch style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',fontSize:12}}/>
                                    <input className="inp" style={{paddingLeft:38}} placeholder="Cari nama, email, atau nomor pesanan..." value={orderSearch} onChange={e=>setOrderSearch(e.target.value)}/>
                                </div>
                            </Col>
                            <Col md={4}>
                                <select className="inp" value={orderStatus} onChange={e=>setOrderStatus(e.target.value)}>
                                    <option value="all">Semua Status</option>
                                    {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                                </select>
                            </Col>
                            <Col md={3} style={{display:'flex',alignItems:'center',justifyContent:'flex-end'}}>
                                <span style={{fontSize:13,color:'#64748b'}}>{filteredOrders.length} pesanan</span>
                            </Col>
                        </Row>

                        <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,overflow:'hidden'}}>
                            {filteredOrders.length===0?(
                                <div style={{textAlign:'center',padding:60,color:'#64748b'}}>
                                    <FaShoppingCart size={32} style={{marginBottom:12,color:'#94a3b8'}}/><p>Tidak ada pesanan ditemukan</p>
                                </div>
                            ):filteredOrders.map(o=>(
                                <div key={o._id} style={{borderBottom:'1px solid #f1f5f9'}}>
                                    {/* Row utama */}
                                    <div style={{display:'flex',alignItems:'center',padding:'14px 16px',gap:12,flexWrap:'wrap',cursor:'pointer'}} onClick={()=>toggleExpand(o._id)}>
                                        <div style={{flex:'0 0 auto'}}>
                                            {expandedOrders.has(o._id)?<FaChevronUp size={12} style={{color:'#94a3b8'}}/>:<FaChevronDown size={12} style={{color:'#94a3b8'}}/>}
                                        </div>
                                        <div style={{flex:'1 1 160px'}}>
                                            <div style={{fontWeight:600,fontSize:12,color:'#0f172a'}}>{o.orderNumber}</div>
                                            <div style={{fontSize:11,color:'#64748b'}}>{fmtDate(o.createdAt)}</div>
                                        </div>
                                        <div style={{flex:'1 1 150px'}}>
                                            <div style={{fontWeight:500,fontSize:13}}>{o.userId?.name||'-'}</div>
                                            <div style={{fontSize:11,color:'#64748b'}}>{o.userId?.email}</div>
                                        </div>
                                        <div style={{flex:'0 0 auto'}}>{o.deliveryMethod==='pickup'?<span style={{background:'#dcfce7',color:'#166534',padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:600}}><FaStore size={9} style={{marginRight:3}}/>Pickup</span>:<span style={{background:'#dbeafe',color:'#1e40af',padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:600}}><FaTruck size={9} style={{marginRight:3}}/>Diantar</span>}</div>
                                        <div style={{flex:'0 0 auto'}}>{getStatusBadge(o.status)}</div>
                                        <div style={{flex:'0 0 100px',textAlign:'right',fontWeight:700,color:'#2563eb',fontSize:14}}>{fmt(o.totalAmount)}</div>
                                        {/* Aksi cepat */}
                                        <div style={{flex:'0 0 auto',display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
                                            {o.status==='waiting_prescription'&&(
                                                <button className="btn-y" onClick={()=>openOrderModal(o,'verify-rx')}>
                                                    <FaFileImage size={11}/> Verifikasi Resep
                                                </button>
                                            )}
                                            {o.status==='paid'&&(
                                                <button className="btn-g" onClick={()=>openOrderModal(o,'status')}>
                                                    <FaBoxOpen size={11}/> Proses
                                                </button>
                                            )}
                                            {['diproses','dikirim','terkirim','siap_diambil'].includes(o.status)&&(
                                                <button className="btn-b" onClick={()=>openOrderModal(o,'status')}>
                                                    <FaEdit size={11}/> Update Status
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded detail */}
                                    {expandedOrders.has(o._id)&&(
                                        <div style={{padding:'0 16px 16px 40px',background:'#fafafa',borderTop:'1px dashed #e2e8f0'}}>
                                            <Row>
                                                <Col md={8}>
                                                    {/* Item obat */}
                                                    <div style={{marginBottom:12}}>
                                                        <p style={{fontSize:11,fontWeight:600,color:'#64748b',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Item Pesanan</p>
                                                        {o.items?.map((item,i)=>(
                                                            <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4,padding:'6px 10px',background:'#fff',borderRadius:8,border:'1px solid #e2e8f0'}}>
                                                                <span>{item.name} <span style={{color:'#64748b'}}>×{item.quantity}</span>
                                                                    {item.requiresPrescription&&<span style={{background:'#fef3c7',color:'#92400e',borderRadius:6,padding:'1px 6px',fontSize:10,fontWeight:600,marginLeft:6}}>Resep</span>}
                                                                    {item.isFreeForStudent&&<span style={{background:'#ede9fe',color:'#7c3aed',borderRadius:6,padding:'1px 6px',fontSize:10,fontWeight:600,marginLeft:4}}>Gratis Mhs</span>}
                                                                </span>
                                                                <span style={{fontWeight:500}}>{fmt(item.subtotal)}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Alamat */}
                                                    {o.shippingAddress?.address&&(
                                                        <p style={{fontSize:12,color:'#64748b',margin:'0 0 8px'}}><FaMapMarkerAlt style={{marginRight:4}}/>{o.shippingAddress.address}{o.shippingAddress.detail&&` · ${o.shippingAddress.detail}`}</p>
                                                    )}

                                                    {/* Resep info */}
                                                    {o.requiresPrescription&&(
                                                        <div style={{background:o.prescription?.status==='approved'?'#dcfce7':o.prescription?.status==='rejected'?'#fee2e2':'#fef9c3',borderRadius:10,padding:'10px 14px',fontSize:12,marginBottom:8}}>
                                                            <strong>Resep: </strong>
                                                            {!o.prescription&&'Belum diupload'}
                                                            {o.prescription?.status==='pending'&&'⏳ Menunggu verifikasi'}
                                                            {o.prescription?.status==='approved'&&<span style={{color:'#166534'}}>✅ Disetujui</span>}
                                                            {o.prescription?.status==='rejected'&&<span style={{color:'#b91c1c'}}>❌ Ditolak: {o.prescription.rejectedReason}</span>}
                                                            {o.prescription?.imageUrl&&(
                                                                <button style={{background:'none',border:'none',color:'#2563eb',fontSize:11,cursor:'pointer',marginLeft:8}} onClick={()=>{ setSelectedOrder(o); setRxPreview(true); setShowOrderModal(true); setOrderAction('rx-preview'); }}>
                                                                    <FaEye size={10} style={{marginRight:3}}/>Lihat Foto
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Ringkasan harga */}
                                                    <div style={{display:'flex',gap:16,fontSize:12,color:'#64748b'}}>
                                                        <span>Subtotal: <strong style={{color:'#0f172a'}}>{fmt(o.subtotalObat)}</strong></span>
                                                        <span>Ongkir: <strong style={{color:'#0f172a'}}>{fmt(o.shippingCost)}</strong></span>
                                                        <span>Total: <strong style={{color:'#2563eb'}}>{fmt(o.totalAmount)}</strong></span>
                                                    </div>
                                                </Col>

                                                <Col md={4}>
                                                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                                        {/* Verifikasi resep */}
                                                        {o.status==='waiting_prescription'&&(
                                                            <>
                                                                {o.prescription&&<button className="btn-b" style={{justifyContent:'center'}} onClick={()=>openOrderModal(o,'adjust-items')}>
                                                                    <FaEdit size={11}/> Sesuaikan Dosis
                                                                </button>}
                                                                <button className="btn-y" style={{justifyContent:'center'}} onClick={()=>openOrderModal(o,'verify-rx')}>
                                                                    <FaFileImage size={11}/> Verifikasi Resep
                                                                </button>
                                                            </>
                                                        )}
                                                        {/* Update status */}
                                                        {getValidNextStatuses(o).length>0&&o.status!=='waiting_prescription'&&(
                                                            <button className="btn-g" style={{justifyContent:'center'}} onClick={()=>openOrderModal(o,'status')}>
                                                                <FaEdit size={11}/> Update Status
                                                            </button>
                                                        )}
                                                    </div>
                                                </Col>
                                            </Row>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── TAB: OBAT ───────────────────────────────────────── */}
                {activeTab==='medicines'&&(
                    <div>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                            <div style={{position:'relative',maxWidth:300,width:'100%'}}>
                                <FaSearch style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',fontSize:12}}/>
                                <input className="inp" style={{paddingLeft:38}} placeholder="Cari nama atau kategori..." value={search} onChange={e=>setSearch(e.target.value)}/>
                            </div>
                            <button className="btn-g" onClick={()=>openMedModal()}><FaPlus size={12}/> Tambah Obat</button>
                        </div>

                        <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,overflow:'hidden'}}>
                            <table className="tbl" style={{width:'100%',borderCollapse:'collapse'}}>
                                <thead>
                                    <tr>
                                        <th style={{width:60}}>Foto</th>
                                        <th>Nama Obat</th>
                                        <th>Kategori</th>
                                        <th>Harga</th>
                                        <th>Stok</th>
                                        <th>Resep</th>
                                        <th>Gratis Mhs</th>
                                        <th style={{textAlign:'center'}}>Status</th>
                                        <th style={{textAlign:'center'}}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMeds.length===0?(
                                        <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'#64748b'}}>Tidak ada obat</td></tr>
                                    ):filteredMeds.map(m=>(
                                        <tr key={m._id}>
                                            <td>
                                                {m.image?<img src={`${API_URL}${m.image}`} alt={m.name} style={{width:44,height:44,objectFit:'cover',borderRadius:8,border:'1px solid #e2e8f0'}}/>
                                                    :<div style={{width:44,height:44,borderRadius:8,background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8'}}><FaPills size={18}/></div>}
                                            </td>
                                            <td>
                                                <div style={{fontWeight:500}}>{m.name}</div>
                                                {m.genericName&&<div style={{fontSize:11,color:'#64748b'}}>{m.genericName}</div>}
                                                {m.description&&<div style={{fontSize:11,color:'#94a3b8'}}>{m.description.substring(0,50)}{m.description.length>50?'...':''}</div>}
                                            </td>
                                            <td><span style={{background:'#f1f5f9',color:'#475569',padding:'3px 8px',borderRadius:12,fontSize:11}}>{CATEGORIES.find(c=>c.value===m.category)?.label||m.category}</span></td>
                                            <td style={{fontWeight:500}}>{fmt(m.price)}</td>
                                            <td>
                                                <span style={{background:m.stock<=5?'#fee2e2':m.stock<=10?'#fef3c7':'#dcfce7',color:m.stock<=5?'#b91c1c':m.stock<=10?'#b45309':'#166534',padding:'3px 8px',borderRadius:12,fontSize:11,fontWeight:500}}>
                                                    {m.stock} {m.unit} {m.stock<=10&&'⚠️'}
                                                </span>
                                            </td>
                                            <td>{m.requiresPrescription?<span style={{background:'#fef3c7',color:'#b45309',padding:'3px 8px',borderRadius:12,fontSize:11,fontWeight:600}}>Ya</span>:<span style={{color:'#94a3b8',fontSize:12}}>-</span>}</td>
                                            <td>{m.availableForStudentQuota?<span style={{background:'#ede9fe',color:'#7c3aed',padding:'3px 8px',borderRadius:12,fontSize:11,fontWeight:600}}><FaStar size={9} style={{marginRight:3}}/>Aktif</span>:<span style={{color:'#94a3b8',fontSize:12}}>-</span>}</td>
                                            <td style={{textAlign:'center'}}>
                                                {m.isActive!==false
                                                    ?<span style={{background:'#dcfce7',color:'#166534',padding:'3px 10px',borderRadius:12,fontSize:11,fontWeight:600}}>Aktif</span>
                                                    :<span style={{background:'#fee2e2',color:'#b91c1c',padding:'3px 10px',borderRadius:12,fontSize:11,fontWeight:600}}>Nonaktif</span>}
                                            </td>
                                            <td style={{textAlign:'center'}}>
                                                <div style={{display:'flex',gap:6,justifyContent:'center'}}>
                                                    <button style={{width:32,height:32,borderRadius:8,border:'none',background:'#dbeafe',color:'#2563eb',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>openMedModal(m)} title="Edit"><FaEdit size={14}/></button>
                                                    <button style={{width:32,height:32,borderRadius:8,border:'none',background:m.isActive!==false?'#fee2e2':'#dcfce7',color:m.isActive!==false?'#b91c1c':'#16a34a',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>handleToggleActive(m)} title={m.isActive!==false?'Nonaktifkan':'Aktifkan'}>{m.isActive!==false?<FaToggleOff size={14}/>:<FaToggleOn size={14}/>}</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Container>

            {/* ─── MODAL TAMBAH/EDIT OBAT ───────────────────────────────── */}
            <Modal show={showMedModal} onHide={()=>setShowMedModal(false)} centered size="lg">
                <div style={{padding:24}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                        <h5 style={{fontWeight:700,marginBottom:0}}>{editingMed?'Edit Obat':'Tambah Obat Baru'}</h5>
                        <button onClick={()=>setShowMedModal(false)} style={{background:'none',border:'none',fontSize:24,cursor:'pointer',color:'#64748b'}}>×</button>
                    </div>
                    <Form onSubmit={handleSaveMed}>
                        <Row className="g-3">
                            {/* Gambar */}
                            <Col md={12}>
                                <label style={{fontSize:12,color:'#64748b',marginBottom:6,display:'block',fontWeight:600}}>Gambar Obat</label>
                                <div style={{display:'flex',alignItems:'center',gap:16}}>
                                    <div style={{width:80,height:80,borderRadius:12,border:'2px dashed #e2e8f0',background:'#f8fafc',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                                        {imagePreview?<img src={imagePreview} alt="preview" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<FaPills size={28} color="#94a3b8"/>}
                                    </div>
                                    <div>
                                        <input ref={imageRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{display:'none'}} onChange={e=>{ const f=e.target.files[0]; if(!f) return; if(f.size>3*1024*1024){toast.error('Maks 3MB');return;} setImageFile(f); setImagePreview(URL.createObjectURL(f)); }}/>
                                        <button type="button" className="btn-o-sm" onClick={()=>imageRef.current.click()} style={{marginRight:8}}><FaUpload size={12} style={{marginRight:5}}/>{imagePreview?'Ganti':'Pilih Gambar'}</button>
                                        {imageFile&&<button type="button" style={{background:'none',border:'none',color:'#b91c1c',fontSize:12,cursor:'pointer'}} onClick={()=>{setImageFile(null);setImagePreview(editingMed?.image?`${API_URL}${editingMed.image}`:null);}}>Hapus</button>}
                                        <div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>JPG, PNG, WebP · Maks 3MB</div>
                                    </div>
                                </div>
                            </Col>

                            <Col md={12}><hr style={{margin:'4px 0',borderColor:'#e2e8f0'}}/></Col>

                            <Col md={6}>
                                <label style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:4,display:'block'}}>Nama Obat <span style={{color:'#b91c1c'}}>*</span></label>
                                <input className="inp" value={medForm.name} onChange={e=>setMedForm(f=>({...f,name:e.target.value}))} required placeholder="Paracetamol 500mg"/>
                            </Col>
                            <Col md={6}>
                                <label style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:4,display:'block'}}>Nama Generik</label>
                                <input className="inp" value={medForm.genericName} onChange={e=>setMedForm(f=>({...f,genericName:e.target.value}))} placeholder="Opsional"/>
                            </Col>

                            <Col md={6}>
                                <label style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:4,display:'block'}}>Jenis Obat <span style={{color:'#b91c1c'}}>*</span></label>
                                <select className="inp" value={medForm.category} onChange={e=>setMedForm(f=>({...f,category:e.target.value}))}>
                                    {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </Col>
                            <Col md={3}>
                                <label style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:4,display:'block'}}>Satuan</label>
                                <select className="inp" value={medForm.unit} onChange={e=>setMedForm(f=>({...f,unit:e.target.value}))}>
                                    {['tablet','kapsul','botol','sachet','tube','pcs','strip','ampul'].map(u=><option key={u} value={u}>{u}</option>)}
                                </select>
                            </Col>
                            <Col md={3}>
                                <label style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:4,display:'block'}}>Harga (Rp) <span style={{color:'#b91c1c'}}>*</span></label>
                                <input className="inp" type="number" min="0" value={medForm.price} onChange={e=>setMedForm(f=>({...f,price:e.target.value}))} required placeholder="0"/>
                            </Col>

                            <Col md={3}>
                                <label style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:4,display:'block'}}>Stok <span style={{color:'#b91c1c'}}>*</span></label>
                                <input className="inp" type="number" min="0" value={medForm.stock} onChange={e=>setMedForm(f=>({...f,stock:e.target.value}))} required placeholder="0"/>
                            </Col>

                            <Col md={12}>
                                <label style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:4,display:'block'}}>Deskripsi</label>
                                <textarea className="inp" rows={2} value={medForm.description} onChange={e=>setMedForm(f=>({...f,description:e.target.value}))} style={{resize:'none'}} placeholder="Indikasi, cara pakai, dll"/>
                            </Col>

                            {/* Toggle: Status Aktif */}
                            <Col md={12}>
                                <label style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:6,display:'block'}}>Status Ketersediaan Obat</label>
                                <div className={`toggle-wrap ${medForm.isActive?'on':''}`}
                                    style={{borderColor:medForm.isActive?'#16a34a':'#b91c1c',background:medForm.isActive?'#f0fdf4':'#fef2f2'}}
                                    onClick={()=>setMedForm(f=>({...f,isActive:!f.isActive}))}>
                                    {medForm.isActive
                                        ?<FaToggleOn size={22} style={{color:'#16a34a'}}/>
                                        :<FaToggleOff size={22} style={{color:'#b91c1c'}}/>}
                                    <div>
                                        <div style={{fontSize:13,fontWeight:600,color:medForm.isActive?'#166534':'#b91c1c'}}>
                                            {medForm.isActive?'Aktif — tersedia untuk pasien':'Nonaktif — tidak bisa dibeli'}
                                        </div>
                                        <div style={{fontSize:11,color:'#94a3b8'}}>
                                            {medForm.isActive?'Obat tampil normal di halaman farmasi':'Obat tetap tampil tapi tombol beli di-disable'}
                                        </div>
                                    </div>
                                </div>
                            </Col>

                            {/* Toggle: Butuh Resep */}
                            <Col md={6}>
                                <label style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:6,display:'block'}}>Butuh Resep Dokter?</label>
                                <div className={`toggle-wrap ${medForm.requiresPrescription?'on':''}`} onClick={()=>setMedForm(f=>({...f,requiresPrescription:!f.requiresPrescription}))}>
                                    {medForm.requiresPrescription?<FaToggleOn size={22} style={{color:'#16a34a'}}/>:<FaToggleOff size={22} style={{color:'#94a3b8'}}/>}
                                    <div>
                                        <div style={{fontSize:13,fontWeight:500,color:medForm.requiresPrescription?'#166534':'#475569'}}>{medForm.requiresPrescription?'Ya, butuh resep':'Tidak butuh resep'}</div>
                                        <div style={{fontSize:11,color:'#94a3b8'}}>Pasien harus upload resep dokter</div>
                                    </div>
                                </div>
                            </Col>

                            {/* Toggle: Gratis Mahasiswa */}
                            <Col md={6}>
                                <label style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:6,display:'block'}}><FaGraduationCap style={{marginRight:4}}/>Tersedia untuk Kuota Gratis Mahasiswa?</label>
                                <div className={`toggle-wrap ${medForm.availableForStudentQuota?'on':''}`}
                                    onClick={()=>setMedForm(f=>({...f,availableForStudentQuota:!f.availableForStudentQuota}))}>
                                    {medForm.availableForStudentQuota?<FaToggleOn size={22} style={{color:'#7c3aed'}}/>:<FaToggleOff size={22} style={{color:'#94a3b8'}}/>}
                                    <div>
                                        <div style={{fontSize:13,fontWeight:500,color:medForm.availableForStudentQuota?'#7c3aed':'#475569'}}>{medForm.availableForStudentQuota?'Aktif — masuk kuota gratis mhs':'Tidak aktif'}</div>
                                        <div style={{fontSize:11,color:'#94a3b8'}}>Maks 8 pcs/bulan/mahasiswa</div>
                                    </div>
                                </div>
                            </Col>
                        </Row>

                        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:20,paddingTop:16,borderTop:'1px solid #e2e8f0'}}>
                            <button type="button" className="btn-o-sm" onClick={()=>setShowMedModal(false)}>Batal</button>
                            <button type="submit" className="btn-g" disabled={savingMed||uploadingImg}>
                                {(savingMed||uploadingImg)?<><Spinner size="sm" animation="border"/> Menyimpan...</>:<><FaSave size={12}/>{editingMed?'Simpan Perubahan':'Tambah Obat'}</>}
                            </button>
                        </div>
                    </Form>
                </div>
            </Modal>

            {/* ─── TAB: REFUND ─────────────────────────────────────────── */}
            {activeTab==='refunds'&&(
                <div>
                    {refundOrders.length===0 ? (
                        <div style={{textAlign:'center',padding:48,color:'#64748b'}}>
                            <div style={{fontSize:40,marginBottom:12}}>🎥</div>
                            <div style={{fontWeight:600}}>Tidak ada pengajuan refund</div>
                        </div>
                    ) : refundOrders.map(order=>(
                        <div key={order._id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:20,marginBottom:14}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10}}>
                                <div>
                                    <div style={{fontWeight:700,fontSize:15}}>{order.orderNumber}</div>
                                    <div style={{fontSize:13,color:'#64748b'}}>
                                        {order.userId?.name} · {order.userId?.phone || order.userId?.email}
                                    </div>
                                    <div style={{fontSize:13,color:'#374151',marginTop:4}}>
                                        💰 Rp {(order.totalAmount||0).toLocaleString('id-ID')} · Diajukan: {new Date(order.refund?.requestedAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})}
                                    </div>
                                    <div style={{fontSize:13,color:'#374151',marginTop:4}}>
                                        <strong>Alasan:</strong> {order.refund?.reason}
                                    </div>
                                </div>
                                <div style={{display:'flex',gap:8}}>
                                    {order.refund?.videoUrl&&(
                                        <a href={order.refund.videoUrl} target="_blank" rel="noopener noreferrer"
                                            style={{padding:'7px 14px',background:'#1e40af',color:'#fff',borderRadius:8,fontSize:13,fontWeight:600,textDecoration:'none'}}>
                                            🎥 Tonton Video
                                        </a>
                                    )}
                                    <button onClick={()=>{setRefundModal(order);setRefundAction('');setRefundRejectReason('');setRefundBankCode('');setRefundAccount('');setRefundAccountName('');setNeedsBankInfo(false);}}
                                        style={{padding:'7px 14px',background:'#2563eb',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                                        ⚖️ Tindak Lanjut
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── MODAL REVIEW REFUND ─────────────────────────────────── */}
            {refundModal&&(
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
                    <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:500,maxHeight:'90vh',overflowY:'auto',padding:24}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                            <span style={{fontWeight:700,fontSize:16}}>⚖️ Review Refund — {refundModal.orderNumber}</span>
                            <button onClick={()=>setRefundModal(null)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#64748b'}}>×</button>
                        </div>

                        <div style={{background:'#f8fafc',borderRadius:8,padding:'12px 14px',marginBottom:16,fontSize:13}}>
                            <div><strong>Pasien:</strong> {refundModal.userId?.name}</div>
                            <div><strong>Total:</strong> Rp {(refundModal.totalAmount||0).toLocaleString('id-ID')}</div>
                            <div><strong>Alasan:</strong> {refundModal.refund?.reason}</div>
                            {refundModal.refund?.videoUrl&&(
                                <a href={refundModal.refund.videoUrl} target="_blank" rel="noopener noreferrer"
                                    style={{color:'#2563eb',fontWeight:600,display:'inline-block',marginTop:6}}>
                                    🎥 Tonton Video Bukti
                                </a>
                            )}
                        </div>

                        {/* Pilih tindakan */}
                        {!refundAction&&(
                            <div style={{display:'flex',gap:10,marginBottom:16}}>
                                <button onClick={()=>setRefundAction('approve')}
                                    style={{flex:1,padding:'10px',background:'#16a34a',color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>
                                    ✅ Approve Refund
                                </button>
                                <button onClick={()=>setRefundAction('reject')}
                                    style={{flex:1,padding:'10px',background:'#dc2626',color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>
                                    ❌ Tolak Refund
                                </button>
                            </div>
                        )}

                        {/* Reject form */}
                        {refundAction==='reject'&&(
                            <div style={{marginBottom:16}}>
                                <label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:6}}>Alasan Penolakan <span style={{color:'#ef4444'}}>*</span></label>
                                <textarea value={refundRejectReason} onChange={e=>setRefundRejectReason(e.target.value)} rows={3}
                                    placeholder="Jelaskan alasan penolakan..."
                                    style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,resize:'vertical',boxSizing:'border-box'}} />
                            </div>
                        )}

                        {/* Approve — bank info jika needsBankInfo */}
                        {refundAction==='approve'&&needsBankInfo&&(
                            <div style={{background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:8,padding:'12px 14px',marginBottom:16}}>
                                <div style={{fontWeight:600,fontSize:13,color:'#92400e',marginBottom:10}}>
                                    💳 Metode pembayaran tidak support refund otomatis — masukkan rekening tujuan
                                </div>
                                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                                    <div>
                                        <label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:4}}>Bank <span style={{color:'#ef4444'}}>*</span></label>
                                        <select value={refundBankCode} onChange={e=>setRefundBankCode(e.target.value)}
                                            style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13}}>
                                            <option value="">— Pilih Bank —</option>
                                            {bankList.map(b=><option key={b.code} value={b.code}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:4}}>Nomor Rekening <span style={{color:'#ef4444'}}>*</span></label>
                                        <input value={refundAccount} onChange={e=>setRefundAccount(e.target.value)}
                                            placeholder="mis. 1234567890"
                                            style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box'}} />
                                    </div>
                                    <div>
                                        <label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:4}}>Nama Pemilik <span style={{color:'#ef4444'}}>*</span></label>
                                        <input value={refundAccountName} onChange={e=>setRefundAccountName(e.target.value)}
                                            placeholder="Sesuai nama di buku tabungan"
                                            style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box'}} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {refundAction&&(
                            <div style={{display:'flex',gap:10}}>
                                <button onClick={()=>{setRefundAction('');setNeedsBankInfo(false);}}
                                    style={{flex:1,padding:'10px',border:'1px solid #d1d5db',background:'#fff',color:'#64748b',borderRadius:8,fontWeight:600,cursor:'pointer'}}>
                                    Kembali
                                </button>
                                <button disabled={processingRefund}
                                    onClick={async()=>{
                                        setProcessingRefund(true);
                                        try {
                                            const payload = { action: refundAction };
                                            if (refundAction==='reject') payload.rejectReason = refundRejectReason;
                                            if (needsBankInfo) { payload.bankCode=refundBankCode; payload.accountNumber=refundAccount; payload.accountName=refundAccountName; }
                                            const r = await api.put(`/api/pharmacy/admin/orders/${refundModal._id}/refund-review`, payload);
                                            if (r.data.needsBankInfo) { setNeedsBankInfo(true); setProcessingRefund(false); return; }
                                            toast.success(refundAction==='approve'?'Refund berhasil diproses ✅':'Refund ditolak');
                                            setRefundModal(null);
                                            fetchData();
                                        } catch(err){
                                            toast.error(err.response?.data?.message||'Gagal memproses refund');
                                        } finally { setProcessingRefund(false); }
                                    }}
                                    style={{flex:2,padding:'10px',background:refundAction==='approve'?'#16a34a':'#dc2626',color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',opacity:processingRefund?.6:1}}>
                                    {processingRefund?'Memproses...':(refundAction==='approve'?'✅ Konfirmasi Approve':'❌ Konfirmasi Tolak')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── MODAL AKSI ORDER ─────────────────────────────────────── */}
            <Modal show={showOrderModal} onHide={()=>setShowOrderModal(false)} centered size="lg">
                <div style={{padding:24}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                        <h5 style={{fontWeight:700,marginBottom:0}}>
                            {orderAction==='verify-rx'&&<><FaFileImage style={{color:'#f59e0b',marginRight:8}}/>Verifikasi Resep</>}
                            {orderAction==='adjust-items'&&<><FaEdit style={{color:'#2563eb',marginRight:8}}/>Sesuaikan Dosis</>}
                            {orderAction==='status'&&<><FaBoxOpen style={{color:'#16a34a',marginRight:8}}/>Update Status Pesanan</>}
                            {orderAction==='rx-preview'&&<><FaEye style={{color:'#2563eb',marginRight:8}}/>Foto Resep</>}
                        </h5>
                        <button onClick={()=>setShowOrderModal(false)} style={{background:'none',border:'none',fontSize:24,cursor:'pointer',color:'#64748b'}}>×</button>
                    </div>

                    {selectedOrder&&(
                        <div>
                            {/* Info pesanan */}
                            <div style={{background:'#f8fafc',borderRadius:10,padding:14,marginBottom:16,fontSize:13}}>
                                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                                    <span style={{fontWeight:600}}>{selectedOrder.orderNumber}</span>
                                    {getStatusBadge(selectedOrder.status)}
                                </div>
                                <div style={{color:'#64748b'}}>{selectedOrder.userId?.name} · {selectedOrder.userId?.email}</div>
                                <div style={{display:'flex',gap:16,marginTop:4,fontSize:12,color:'#64748b'}}>
                                    <span>Total: <strong style={{color:'#2563eb'}}>{fmt(selectedOrder.totalAmount)}</strong></span>
                                    <span>{selectedOrder.deliveryMethod==='pickup'?'Pickup':'Diantar'}</span>
                                </div>
                            </div>

                            {/* VERIFIKASI RESEP */}
                            {orderAction==='verify-rx'&&(
                                <div>
                                    {selectedOrder.prescription?.imageUrl&&(
                                        <div style={{marginBottom:16}}>
                                            <p style={{fontSize:12,fontWeight:600,color:'#64748b',marginBottom:6}}>FOTO RESEP DOKTER</p>
                                            <img src={`${API_URL}${selectedOrder.prescription.imageUrl}`} alt="Resep"
                                                style={{maxWidth:'100%',maxHeight:300,objectFit:'contain',borderRadius:10,border:'1px solid #e2e8f0',display:'block'}}/>
                                        </div>
                                    )}
                                    {!selectedOrder.prescription&&<div style={{background:'#fef3c7',borderRadius:10,padding:'12px 14px',marginBottom:12,fontSize:13,color:'#92400e'}}>⚠️ Pasien belum mengupload foto resep.</div>}

                                    <p style={{fontSize:12,fontWeight:600,color:'#64748b',marginBottom:8}}>KEPUTUSAN VERIFIKASI</p>
                                    <div style={{display:'flex',gap:8,marginBottom:12}}>
                                        <button style={{flex:1,padding:'12px',borderRadius:10,border:`2px solid ${newStatus==='approve'?'#16a34a':'#e2e8f0'}`,background:newStatus==='approve'?'#f0fdf4':'#fff',color:newStatus==='approve'?'#166534':'#475569',cursor:'pointer',fontWeight:600,fontSize:13,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}
                                            onClick={()=>{setNewStatus('approve');setRejectReason('');}}>
                                            <FaCheckCircle size={14}/> Setujui Resep
                                        </button>
                                        <button style={{flex:1,padding:'12px',borderRadius:10,border:`2px solid ${newStatus==='reject'?'#b91c1c':'#e2e8f0'}`,background:newStatus==='reject'?'#fef2f2':'#fff',color:newStatus==='reject'?'#b91c1c':'#475569',cursor:'pointer',fontWeight:600,fontSize:13,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}
                                            onClick={()=>setNewStatus('reject')}>
                                            <FaTimesCircle size={14}/> Tolak Resep
                                        </button>
                                    </div>
                                    {newStatus==='approve'&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#166534'}}>Stok akan dikunci 15 menit untuk pembayaran. Pasien akan dapat notifikasi untuk segera bayar.</div>}
                                    {newStatus==='reject'&&(
                                        <div>
                                            <label style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:4,display:'block'}}>Alasan Penolakan <span style={{color:'#b91c1c'}}>*</span></label>
                                            <textarea className="inp" rows={3} value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Contoh: Resep tidak jelas/buram, resep expired, nama pasien tidak sesuai..." style={{resize:'none'}}/>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SESUAIKAN DOSIS */}
                            {orderAction==='adjust-items'&&(
                                <div>
                                    <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#1e3a8a',display:'flex',alignItems:'flex-start',gap:8}}>
                                        <FaInfoCircle style={{marginTop:2,flexShrink:0}}/>
                                        Sesuaikan jumlah obat sesuai dosis yang tertera di resep. Harga akan dikalkulasi ulang otomatis.
                                    </div>
                                    {adjustedItems.map((item,i)=>(
                                        <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid #f1f5f9'}}>
                                            <div style={{flex:1,fontSize:13,fontWeight:500}}>{item.name}</div>
                                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                                                <button style={{width:28,height:28,borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}} onClick={()=>{ const a=[...adjustedItems]; a[i].quantity=Math.max(1,a[i].quantity-1); setAdjustedItems(a); }}>-</button>
                                                <span style={{minWidth:30,textAlign:'center',fontWeight:600,fontSize:15}}>{item.quantity}</span>
                                                <button style={{width:28,height:28,borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}} onClick={()=>{ const a=[...adjustedItems]; a[i].quantity=a[i].quantity+1; setAdjustedItems(a); }}>+</button>
                                            </div>
                                            <div style={{minWidth:80,textAlign:'right',fontSize:13,color:'#2563eb',fontWeight:600}}>{fmt(item.price*item.quantity)}</div>
                                        </div>
                                    ))}
                                    <div style={{display:'flex',justifyContent:'flex-end',paddingTop:10,fontWeight:700,fontSize:15}}>
                                        Total Baru: <span style={{color:'#2563eb',marginLeft:8}}>{fmt(adjustedItems.reduce((s,i)=>s+i.price*i.quantity,0) + (selectedOrder.shippingCost||0))}</span>
                                    </div>
                                </div>
                            )}

                            {/* UPDATE STATUS */}
                            {orderAction==='status'&&(
                                <div>
                                    <p style={{fontSize:12,fontWeight:600,color:'#64748b',marginBottom:8}}>PILIH STATUS BARU</p>
                                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                                        {getValidNextStatuses(selectedOrder).map(s=>{
                                            const v = STATUS_CFG[s];
                                            return (
                                                <div key={s} style={{border:`2px solid ${newStatus===s?v.color:'#e2e8f0'}`,borderRadius:12,padding:'12px 16px',cursor:'pointer',background:newStatus===s?v.bg:'#fff',transition:'all .15s'}} onClick={()=>setNewStatus(s)}>
                                                    <div style={{display:'flex',alignItems:'center',gap:8,color:newStatus===s?v.color:'#475569',fontWeight:600,fontSize:13}}>
                                                        <v.icon size={14}/>{v.label}
                                                    </div>
                                                    {s==='diproses'&&<div style={{fontSize:11,color:'#64748b',marginTop:2}}>{selectedOrder.deliveryMethod==='pickup'?'Akan siap diambil dalam ±30 menit setelah ini':'Lanjutkan ke pengiriman setelah obat siap'}</div>}
                                                    {s==='dikirim'&&<div style={{fontSize:11,color:'#64748b',marginTop:2}}>Estimasi tiba 1–2 hari kerja</div>}
                                                    {s==='terkirim'&&<div style={{fontSize:11,color:'#64748b',marginTop:2}}>Konfirmasi obat sudah tiba ke pasien</div>}
                                                    {s==='selesai'&&<div style={{fontSize:11,color:'#64748b',marginTop:2}}>Pesanan diselesaikan</div>}
                                                    {s==='cancelled'&&<div style={{fontSize:11,color:'#64748b',marginTop:2}}>Batalkan pesanan dan kembalikan stok</div>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* RX PREVIEW */}
                            {orderAction==='rx-preview'&&selectedOrder.prescription?.imageUrl&&(
                                <img src={`${API_URL}${selectedOrder.prescription.imageUrl}`} alt="Resep" style={{maxWidth:'100%',maxHeight:500,objectFit:'contain',borderRadius:10,display:'block',margin:'0 auto'}}/>
                            )}
                        </div>
                    )}

                    {orderAction!=='rx-preview'&&(
                        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:20,paddingTop:16,borderTop:'1px solid #e2e8f0'}}>
                            <button className="btn-o-sm" onClick={()=>setShowOrderModal(false)}>Batal</button>
                            <button className="btn-g" onClick={handleOrderAction} disabled={updatingOrder||
                                (orderAction==='verify-rx'&&(!newStatus||(!selectedOrder?.prescription&&newStatus==='approve')||(newStatus==='reject'&&!rejectReason.trim())))||
                                (orderAction==='status'&&!newStatus)}>
                                {updatingOrder?<><Spinner size="sm" animation="border"/> Memproses...</>
                                    :orderAction==='verify-rx'?<><FaCheckCircle size={12}/>Konfirmasi Verifikasi</>
                                    :orderAction==='adjust-items'?<><FaSave size={12}/>Simpan Perubahan</>
                                    :<><FaSave size={12}/>Update Status</>}
                            </button>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default ManagePharmacy;