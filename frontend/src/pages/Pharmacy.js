import React, { useState, useEffect, useRef, useCallback } from 'react';
import api, { API_URL } from '../utils/api';
import io from 'socket.io-client';
import { Container, Row, Col, Spinner } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { toast } from 'react-hot-toast';
import {
    FaSearch, FaShoppingCart, FaPlus, FaMinus, FaTrash,
    FaPrescriptionBottle, FaBox, FaTruck, FaClock, FaCheckCircle,
    FaHistory, FaArrowRight, FaExclamationTriangle, FaChevronLeft,
    FaChevronRight, FaMapMarkerAlt, FaExternalLinkAlt,
    FaMotorcycle, FaStore, FaGraduationCap, FaRoute, FaLock,
    FaFileImage, FaUpload, FaTimesCircle, FaInfoCircle, FaEdit,
    FaBan, FaStar,
} from 'react-icons/fa';

const KLINIK_LAT = -6.5530;
const KLINIK_LNG = 106.7237;
const fmt = (n) => `Rp ${(n || 0).toLocaleString('id-ID')}`;

const CATEGORIES = [
    { value: '',                     label: 'Semua Kategori'       },
    { value: 'obat_bebas',           label: 'Obat Bebas'           },
    { value: 'obat_bebas_terbatas',  label: 'Obat Bebas Terbatas'  },
    { value: 'obat_keras',           label: 'Obat Keras (Resep)'   },
    { value: 'antibiotik',           label: 'Antibiotik'           },
    { value: 'vitamin',              label: 'Vitamin & Suplemen'   },
    { value: 'alat_kesehatan',       label: 'Alat Kesehatan'       },
];

const STATUS_CFG = {
    waiting_prescription : { bg:'#fef9c3', color:'#854d0e', icon:FaFileImage,         label:'Menunggu Verifikasi Resep' },
    prescription_rejected: { bg:'#fee2e2', color:'#991b1b', icon:FaTimesCircle,        label:'Resep Ditolak'             },
    pending              : { bg:'#fef3c7', color:'#b45309', icon:FaClock,              label:'Menunggu Pembayaran'       },
    paid                 : { bg:'#dbeafe', color:'#1e40af', icon:FaCheckCircle,        label:'Pembayaran Berhasil'       },
    diproses             : { bg:'#cffafe', color:'#0e7490', icon:FaBox,                label:'Sedang Diproses'           },
    dikirim              : { bg:'#ede9fe', color:'#6d28d9', icon:FaTruck,              label:'Sedang Dikirim'            },
    terkirim             : { bg:'#d1fae5', color:'#065f46', icon:FaMotorcycle,         label:'Sudah Tiba'                },
    siap_diambil         : { bg:'#ecfdf5', color:'#065f46', icon:FaStore,              label:'Siap Diambil'              },
    selesai              : { bg:'#dcfce7', color:'#166534', icon:FaCheckCircle,        label:'Selesai'                   },
    expired              : { bg:'#fee2e2', color:'#b91c1c', icon:FaExclamationTriangle,label:'Kedaluwarsa'               },
    cancelled            : { bg:'#f1f5f9', color:'#475569', icon:FaBan,                label:'Dibatalkan'                },
    refund_requested     : { bg:'#fef3c7', color:'#92400e', icon:FaClock,              label:'Menunggu Review Refund'    },
    refund_rejected      : { bg:'#fee2e2', color:'#991b1b', icon:FaTimesCircle,        label:'Refund Ditolak'            },
    refunded             : { bg:'#dcfce7', color:'#166534', icon:FaCheckCircle,        label:'Refund Berhasil'           },
};

// ─── Map Picker ───────────────────────────────────────────────────────────────
const MapPickerModal = ({ onConfirm, onClose }) => {
    const mapRef     = useRef(null);
    const leafletRef = useRef(null);
    const markerRef  = useRef(null);
    const [address,   setAddress]   = useState('');
    const [coord,     setCoord]     = useState(null);
    const [geocoding, setGeocoding] = useState(false);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapError,  setMapError]  = useState('');

    const reverseGeocode = useCallback(async (lat, lng) => {
        setGeocoding(true);
        try {
            const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, { headers: { 'User-Agent': 'KlinikIPB/1.0' } });
            const data = await res.json();
            if (data?.display_name) {
                const a = data.address || {};
                const parts = [a.road, a.neighbourhood||a.suburb, a.village||a.town||a.city_district, a.county||a.city].filter(Boolean);
                setAddress(parts.length ? parts.join(', ') : data.display_name);
            } else setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } catch { setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`); }
        finally  { setGeocoding(false); }
    }, []);

    const placeMarker = useCallback((L, map, lat, lng) => {
        if (markerRef.current) markerRef.current.remove();
        const icon = L.divIcon({ html: `<div style="width:28px;height:28px;background:#dc2626;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>`, iconSize:[28,28], iconAnchor:[14,28], className:'' });
        markerRef.current = L.marker([lat,lng],{icon,draggable:true}).addTo(map);
        markerRef.current.on('dragend', e => { const p=e.target.getLatLng(); setCoord({lat:p.lat,lng:p.lng}); reverseGeocode(p.lat,p.lng); });
    }, [reverseGeocode]);

    useEffect(() => {
        if (!mapRef.current) return;
        let destroyed = false;
        const load = async () => {
            if (!document.getElementById('leaflet-css')) {
                const lnk = document.createElement('link'); lnk.id='leaflet-css'; lnk.rel='stylesheet'; lnk.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(lnk);
            }
            if (!window.L) await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
            if (destroyed) return;
            const L = window.L;
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({ iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' });
            const map = L.map(mapRef.current).setView([KLINIK_LAT,KLINIK_LNG],14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
            const kIcon = L.divIcon({ html:`<div style="width:32px;height:32px;background:#2563eb;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"><div style="transform:rotate(45deg);text-align:center;line-height:26px;font-size:14px">🏥</div></div>`, iconSize:[32,32], iconAnchor:[16,32], className:'' });
            L.marker([KLINIK_LAT,KLINIK_LNG],{icon:kIcon}).addTo(map).bindPopup('<b>Klinik Pratama IPB</b>');
            map.on('click', e => { const {lat,lng}=e.latlng; placeMarker(L,map,lat,lng); setCoord({lat,lng}); reverseGeocode(lat,lng); });
            leafletRef.current = map;
            setMapLoaded(true);
        };
        load().catch(() => setMapError('Gagal memuat peta. Cek koneksi internet.'));
        return () => { destroyed=true; if(leafletRef.current){leafletRef.current.remove();leafletRef.current=null;} };
    }, [placeMarker, reverseGeocode]);

    return (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:680,maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <div style={{padding:'16px 20px',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                        <h6 style={{margin:0,fontWeight:700}}><FaMapMarkerAlt style={{color:'#2563eb',marginRight:6}}/>Pilih Lokasi Pengiriman</h6>
                        <p style={{margin:0,fontSize:12,color:'#64748b'}}>Klik peta untuk menandai lokasi, atau drag pin</p>
                    </div>
                    <button onClick={onClose} style={{background:'none',border:'none',fontSize:24,cursor:'pointer',color:'#64748b'}}>×</button>
                </div>
                <div style={{position:'relative',flex:'0 0 340px'}}>
                    {!mapLoaded&&!mapError&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#f1f5f9',zIndex:1}}><Spinner animation="border" variant="primary"/><span style={{marginLeft:10,color:'#475569',fontSize:14}}>Memuat peta...</span></div>}
                    {mapError&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fef2f2',zIndex:1,padding:24,textAlign:'center'}}><div><FaExclamationTriangle size={28} style={{color:'#b91c1c',marginBottom:8}}/><p style={{color:'#b91c1c',margin:0}}>{mapError}</p></div></div>}
                    <div ref={mapRef} style={{height:340,width:'100%'}}/>
                </div>
                <div style={{padding:'12px 20px',borderTop:'1px solid #e2e8f0'}}>
                    <label style={{fontSize:12,color:'#64748b',marginBottom:4,display:'block'}}>{coord?(geocoding?'Mengambil alamat...':<><FaEdit size={10} style={{marginRight:4}}/>Alamat terdeteksi (bisa diedit):</>):'Klik peta untuk menentukan lokasi'}</label>
                    <textarea rows={2} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Alamat akan otomatis terisi setelah klik peta..." style={{width:'100%',padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:10,fontSize:13,resize:'none',fontFamily:'inherit'}}/>
                    {coord&&<p style={{fontSize:11,color:'#94a3b8',margin:'2px 0 0'}}>{coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}</p>}
                </div>
                <div style={{padding:'12px 20px',borderTop:'1px solid #e2e8f0',display:'flex',justifyContent:'flex-end',gap:8}}>
                    <button onClick={onClose} style={{padding:'10px 20px',borderRadius:10,border:'1px solid #e2e8f0',background:'#fff',color:'#475569',cursor:'pointer',fontSize:13}}>Batal</button>
                    <button onClick={()=>{ if(!coord){toast.error('Klik lokasi Anda di peta');return;} if(!address.trim()){toast.error('Alamat tidak boleh kosong');return;} onConfirm({lat:coord.lat,lng:coord.lng,address:address.trim()}); }}
                        disabled={!coord||geocoding}
                        style={{padding:'10px 20px',borderRadius:10,border:'none',background:!coord||geocoding?'#93c5fd':'#2563eb',color:'#fff',cursor:!coord||geocoding?'not-allowed':'pointer',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
                        <FaCheckCircle size={12}/> Gunakan Lokasi Ini
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PHARMACY
// ─────────────────────────────────────────────────────────────────────────────
const Pharmacy = () => {
    const { user }     = useAuth();
    const navigate     = useNavigate();
    const { cart, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal } = useCart();

    const [medicines,   setMedicines]   = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [searchTerm,  setSearchTerm]  = useState('');
    const [selectedCat, setSelectedCat] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages,  setTotalPages]  = useState(1);

    // Student quota
    const [quota, setQuota] = useState({ isStudent:false, used:0, remaining:0, max:8 });

    const [activeTab,    setActiveTab]    = useState('shop');
    const [showCart,     setShowCart]     = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);
    const [showMap,      setShowMap]      = useState(false);

    // Checkout
    const [selectedAddress,  setSelectedAddress]  = useState(null);
    const [addressDetail,    setAddressDetail]    = useState('');
    const [phone,            setPhone]            = useState('');
    const [shippingResult,   setShippingResult]   = useState(null);
    const [loadingShipping,  setLoadingShipping]  = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState(null);
    const [creatingOrder,    setCreatingOrder]    = useState(false);

    // Resep state — upload sebelum checkout
    const [showRxUpload,    setShowRxUpload]    = useState(false);  // modal upload resep pre-checkout
    const [rxFile,          setRxFile]          = useState(null);
    const [rxOrderId,       setRxOrderId]       = useState(null);   // null = pre-checkout, string = order existing
    const [uploadingRx,     setUploadingRx]     = useState(false);
    const rxInputRef = useRef();

    // Detail obat
    const [selectedMed, setSelectedMed] = useState(null);

    // Orders
    const [orders,        setOrders]        = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const isStudent   = user?.email?.toLowerCase().endsWith('@apps.ipb.ac.id');
    const cartHasRx   = cart.some(i => i.requiresPrescription);
    // Total keranjang dengan kalkulasi kuota mahasiswa (estimasi frontend)
    const cartSubtotal = () => {
        if (!isStudent) return getCartTotal();
        let used = quota.remaining; // berapa yang tersisa
        return cart.reduce((s, item) => {
            if (item.availableForStudentQuota && !item.requiresPrescription && used > 0) {
                const freeQty = Math.min(item.quantity, used);
                used -= freeQty;
                return s + (item.quantity - freeQty) * item.price;
            }
            return s + item.quantity * item.price;
        }, 0);
    };

    useEffect(() => {
        if (!user) { toast.error('Silakan login'); navigate('/login'); return; }
        fetchMedicines();
        if (isStudent) fetchQuota();
    }, [currentPage, searchTerm, selectedCat]); // eslint-disable-line

    useEffect(() => {
        if (activeTab === 'orders') fetchOrders();
    }, [activeTab]); // eslint-disable-line

    // Real-time: auto refresh saat ada update dari backend
    useEffect(() => {
        if (!user) return;
        const sock = io(API_URL, {
            auth: { token: localStorage.getItem('token') },
            query: { userId: user.id || user._id },
        });
        sock.emit('join-user', user.id || user._id);
        // Refresh orders saat resep diverifikasi atau status berubah
        sock.on('prescription-verified', () => {
            fetchOrders();
            toast('Resep telah diverifikasi oleh admin', { icon: '📋' });
        });
        sock.on('order-status-update', () => fetchOrders());
        sock.on('order-items-adjusted', () => {
            fetchOrders();
            toast('Admin menyesuaikan dosis obat. Cek detail pesanan.', { icon: '📋' });
        });
        return () => sock.close();
    }, [user]); // eslint-disable-line

    const fetchMedicines = async () => {
        setLoading(true);
        try {
            const p = new URLSearchParams({ page: currentPage, limit: 12 });
            if (searchTerm) p.append('search', searchTerm);
            if (selectedCat) p.append('category', selectedCat);
            const res = await api.get(`/api/pharmacy/medicines?${p}`);
            setMedicines(res.data.medicines || []);
            setTotalPages(res.data.totalPages || 1);
        } catch { toast.error('Gagal memuat data obat'); }
        finally  { setLoading(false); }
    };

    const fetchQuota = async () => {
        try {
            const res = await api.get('/api/pharmacy/student-quota');
            setQuota(res.data);
        } catch { /* silent */ }
    };

    const fetchOrders = async () => {
        setLoadingOrders(true);
        try {
            const res = await api.get('/api/pharmacy/orders');
            setOrders(res.data);
        } catch { /* silent */ }
        finally  { setLoadingOrders(false); }
    };

    // ── Shipping ──────────────────────────────────────────────────────────────
    const handleMapConfirm = ({ lat, lng, address }) => {
        setSelectedAddress({ lat, lng, address });
        setShippingResult(null);
        setSelectedDelivery(null);
        setShowMap(false);
    };

    const calculateShipping = async () => {
        if (!selectedAddress) { toast.error('Pilih lokasi terlebih dahulu'); return; }
        setLoadingShipping(true); setShippingResult(null); setSelectedDelivery(null);
        try {
            const res = await api.post('/api/pharmacy/calculate-shipping', { lat: selectedAddress.lat, lng: selectedAddress.lng });
            setShippingResult(res.data);
            if (res.data.options.length === 1) setSelectedDelivery(res.data.options[0]);
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal menghitung ongkir'); }
        finally { setLoadingShipping(false); }
    };

    const computedTotal = () => {
        if (!selectedDelivery) return 0;
        return cartSubtotal() + selectedDelivery.cost;
    };

    // ── Checkout utama ────────────────────────────────────────────────────────
    const handleCheckoutClick = () => {
        if (cartHasRx) {
            // Checkout untuk obat resep: buat order dulu → upload resep
            proceedCheckoutWithRx();
        } else {
            setShowCart(false);
            setShowCheckout(true);
        }
    };

    // Buat order dulu (status waiting_prescription), lalu minta upload resep
    const proceedCheckoutWithRx = async () => {
        // Checkout butuh lokasi dulu — tampilkan checkout modal
        setShowCart(false);
        setShowCheckout(true);
    };

    const createOrder = async () => {
        if (!selectedDelivery) { toast.error('Pilih metode pengiriman'); return; }
        if (selectedDelivery.method === 'diantar' && !phone.trim()) { toast.error('Nomor telepon wajib diisi'); return; }
        setCreatingOrder(true);
        try {
            const orderRes = await api.post('/api/pharmacy/orders', {
                items          : cart,
                deliveryMethod : selectedDelivery.method,
                address        : selectedAddress?.address || '',
                detail         : addressDetail.trim(),
                lat            : selectedAddress?.lat,
                lng            : selectedAddress?.lng,
                distance       : shippingResult?.distance,
                shippingCost   : selectedDelivery.cost,
                phone          : phone.trim(),
            });

            const order = orderRes.data.order;
            clearCart();
            setShowCheckout(false);
            if (isStudent && orderRes.data.quotaUsed > 0)
                toast.success(`🎓 ${orderRes.data.quotaUsed} pcs gratis dari kuota mahasiswa!`);

            // Ada resep → minta upload sekarang
            if (orderRes.data.requiresPrescription) {
                setRxOrderId(order._id);
                setShowRxUpload(true);
                setActiveTab('orders');
                fetchOrders();
                return;
            }

            // Total 0 → confirm-free (langsung diproses)
            if (order.totalAmount === 0) {
                await api.put(`/api/pharmacy/orders/${order._id}/confirm-free`);
                toast.success('Pesanan gratis dikonfirmasi! Siap diambil dalam ±30 menit.');
                setActiveTab('orders');
                fetchOrders();
                fetchQuota();
                return;
            }

            // Buat Xendit invoice
            const invRes = await api.post('/api/xendit/create-invoice', {
                amount     : order.totalAmount,
                paymentType: 'medicine',
                referenceId: order._id,
                description: `Obat ${order.orderNumber} – Klinik Pratama IPB`,
            });
            window.location.href = invRes.data.invoiceUrl;

        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal membuat pesanan');
        } finally { setCreatingOrder(false); }
    };

    // ── Upload resep ──────────────────────────────────────────────────────────
    const handleUploadRx = async (orderId) => {
        if (!rxFile) { toast.error('Pilih file resep terlebih dahulu'); return; }
        setUploadingRx(true);
        try {
            const fd = new FormData(); fd.append('prescription', rxFile);
            await api.post(`/api/pharmacy/orders/${orderId}/prescription`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success('Resep diupload! Menunggu verifikasi admin.');
            setRxFile(null); setRxOrderId(null); setShowRxUpload(false);
            fetchOrders();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal upload resep'); }
        finally { setUploadingRx(false); }
    };

    // ── Cancel / selesai ──────────────────────────────────────────────────────
    const cancelOrder = async (id) => {
        if (!window.confirm('Yakin ingin membatalkan pesanan?')) return;
        try {
            await api.put(`/api/pharmacy/orders/${id}/cancel`, { reason: 'Dibatalkan pengguna' });
            toast.success('Pesanan dibatalkan'); fetchOrders();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal membatalkan'); }
    };

    // ── Refund farmasi ────────────────────────────────────────────────────────
    const [refundModal, setRefundModal]   = useState(null); // { order, type: 'instant'|'video' }
    const [refundVideo, setRefundVideo]   = useState(null);
    const [refundReason, setRefundReason] = useState('');
    const [submittingRefund, setSubmittingRefund] = useState(false);
    const [needsBankInfo, setNeedsBankInfo]       = useState(false);
    const [bankCode, setBankCode]                 = useState('');
    const [accountNumber, setAccountNumber]       = useState('');
    const [accountName, setAccountName]           = useState('');
    const [bankList, setBankList]                 = useState([]);
    const refundVideoRef = useRef(null);

    useEffect(() => {
        api.get('/api/xendit/banks').then(r => setBankList(r.data.banks || [])).catch(() => {});
    }, []);

    const handleRefundSubmit = async () => {
        if (!refundModal) return;
        const isInstant = refundModal.type === 'instant';

        if (!isInstant && !refundVideo) { toast.error('Video bukti wajib diunggah'); return; }
        if (!refundReason.trim()) { toast.error('Alasan refund wajib diisi'); return; }
        if (!isInstant && refundVideo?.size > 50 * 1024 * 1024) { toast.error('Ukuran video maksimal 50MB'); return; }

        setSubmittingRefund(true);
        try {
            const fd = new FormData();
            fd.append('reason', refundReason);
            if (!isInstant && refundVideo) fd.append('video', refundVideo);
            if (needsBankInfo) {
                if (!bankCode || !accountNumber || !accountName) {
                    toast.error('Data rekening wajib diisi'); setSubmittingRefund(false); return;
                }
                fd.append('bankCode', bankCode);
                fd.append('accountNumber', accountNumber);
                fd.append('accountName', accountName);
            }
            const r = await api.post(`/api/pharmacy/orders/${refundModal.order._id}/refund-request`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (r.data.needsBankInfo) {
                setNeedsBankInfo(true); setSubmittingRefund(false); return;
            }
            toast.success(isInstant ? 'Refund berhasil diproses! Dana akan masuk dalam 1x24 jam.' : 'Pengajuan refund dikirim. Admin akan meninjau dalam 1×24 jam.');
            setRefundModal(null); setRefundVideo(null); setRefundReason('');
            setNeedsBankInfo(false); setBankCode(''); setAccountNumber(''); setAccountName('');
            fetchOrders();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal mengajukan refund');
        } finally { setSubmittingRefund(false); }
    };

    // paid & belum 1 jam → refund langsung
    const canRefundInstant = (order) => {
        if (order.status !== 'paid') return false;
        const paidAt = order.updatedAt || order.createdAt;
        return Date.now() - new Date(paidAt).getTime() < 60 * 60 * 1000;
    };
    // terkirim / selesai → refund dengan video, maksimal 1 hari setelah tiba
    const canRefundWithVideo = (order) => {
        if (!['terkirim', 'selesai'].includes(order.status)) return false;
        const arrivedAt = order.terkirimAt || order.completedAt || order.updatedAt;
        return Date.now() - new Date(arrivedAt).getTime() < 24 * 60 * 60 * 1000;
    };

    const selesaikanOrder = async (id) => {
        if (!window.confirm('Konfirmasi pesanan sudah diterima?')) return;
        try {
            await api.put(`/api/pharmacy/orders/${id}/selesai`);
            toast.success('Pesanan diselesaikan!'); fetchOrders();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal'); }
    };

    const bayarLagi = async (order) => {
        try {
            const res = await api.post('/api/xendit/create-invoice', { amount:order.totalAmount, paymentType:'medicine', referenceId:order._id, description:`Obat ${order.orderNumber}` });
            window.location.href = res.data.invoiceUrl;
        } catch { toast.error('Gagal membuat link pembayaran'); }
    };

    const confirmFreeFromOrders = async (id) => {
        try {
            await api.put(`/api/pharmacy/orders/${id}/confirm-free`);
            toast.success('Pesanan dikonfirmasi! Sedang disiapkan.');
            fetchOrders();
            fetchQuota();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal mengkonfirmasi'); }
    };

    const getStatusBadge = (status) => {
        const v = STATUS_CFG[status] || { bg:'#f1f5f9', color:'#475569', icon:FaBox, label:status };
        return <span style={{background:v.bg,color:v.color,padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:500,display:'inline-flex',alignItems:'center',gap:5}}><v.icon size={11}/>{v.label}</span>;
    };

    // ────────────────────────────────────────────────────────────────────────
    return (
        <div style={{minHeight:'100vh',background:'#f8fafc',fontFamily:"'Inter',sans-serif",padding:24}}>
            <style>{`
                .ph-tab{padding:10px 20px;border-radius:10px;font-size:14px;font-weight:500;border:none;background:transparent;color:#64748b;cursor:pointer;flex:1;transition:all .2s}
                .ph-tab.active{background:#2563eb;color:#fff}
                .ph-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;height:100%;transition:all .2s;cursor:default}
                .ph-card:hover{transform:translateY(-4px);box-shadow:0 12px 24px -8px rgba(0,0,0,.1)}
                .ph-input{width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none}
                .ph-input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
                .btn-p{background:#2563eb;color:#fff;border:none;border-radius:12px;padding:11px 22px;font-size:14px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:all .2s}
                .btn-p:hover:not(:disabled){background:#1d4ed8}
                .btn-p:disabled{background:#93c5fd;cursor:not-allowed}
                .btn-o{background:transparent;border:1px solid #e2e8f0;color:#475569;border-radius:12px;padding:11px 22px;font-size:14px;cursor:pointer;font-family:inherit}
                .btn-success{background:#16a34a;color:#fff;border:none;border-radius:12px;padding:9px 18px;font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
                .btn-danger-sm{background:transparent;border:1px solid #b91c1c;color:#b91c1c;border-radius:10px;padding:7px 14px;font-size:12px;cursor:pointer;font-family:inherit}
                .delivery-opt{border:2px solid #e2e8f0;border-radius:14px;padding:16px;cursor:pointer;transition:all .2s;margin-bottom:8px}
                .delivery-opt.sel{border-color:#2563eb;background:#eff6ff}
                .sec-box{background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:14px}
                .rx-badge{background:#fef3c7;color:#92400e;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:600;display:inline-flex;align-items:center;gap:3px;margin-left:6px}
                .free-badge{background:#ede9fe;color:#6d28d9;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:600;display:inline-flex;align-items:center;gap:3px;margin-left:4px}
                .quota-bar{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;margin-top:4px}
                .quota-fill{height:100%;background:#7c3aed;border-radius:4px;transition:width .4s}
                .map-btn{display:flex;align-items:center;gap:8px;padding:12px 18px;background:#fff;border:2px dashed #2563eb;border-radius:12px;color:#2563eb;font-weight:600;font-size:13px;cursor:pointer;width:100%;justify-content:center;font-family:inherit}
                .order-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin-bottom:12px}
            `}</style>

            {showMap && <MapPickerModal onConfirm={handleMapConfirm} onClose={()=>setShowMap(false)}/>}

            {/* Upload Resep Modal (pre/post checkout) */}
            {showRxUpload && (
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
                    <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:460,padding:28}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                            <h5 style={{fontWeight:700,marginBottom:0}}><FaFileImage style={{color:'#f59e0b',marginRight:8}}/>Upload Resep Dokter</h5>
                            <button onClick={()=>{setShowRxUpload(false);setRxFile(null);}} style={{background:'none',border:'none',fontSize:22,cursor:'pointer'}}>×</button>
                        </div>
                        <div style={{background:'#fef9c3',border:'1px solid #fcd34d',borderRadius:12,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#92400e'}}>
                            <FaInfoCircle style={{marginRight:6}}/>
                            <strong>Upload foto resep dokter</strong> yang jelas dan terbaca. Pesanan baru bisa dibayar setelah admin menyetujui resep.
                        </div>
                        <input type="file" ref={rxInputRef} accept="image/*,.pdf" style={{display:'none'}} onChange={e=>setRxFile(e.target.files[0])}/>
                        <button onClick={()=>rxInputRef.current?.click()} style={{width:'100%',padding:'12px',border:'2px dashed #e2e8f0',borderRadius:12,background:'#f8fafc',color:'#475569',cursor:'pointer',fontSize:13,marginBottom:8,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                            <FaUpload style={{color:'#2563eb'}}/>{rxFile ? rxFile.name : 'Pilih File Foto Resep (JPG/PNG/PDF, maks 5MB)'}
                        </button>
                        {rxFile && <p style={{fontSize:11,color:'#64748b',marginBottom:12,textAlign:'center'}}>✅ File dipilih: {rxFile.name}</p>}
                        <div style={{display:'flex',gap:8,marginTop:12}}>
                            <button className="btn-o" style={{flex:1}} onClick={()=>{setShowRxUpload(false);setRxFile(null);}}>Nanti</button>
                            <button className="btn-p" style={{flex:1,justifyContent:'center'}} onClick={()=>handleUploadRx(rxOrderId)} disabled={!rxFile||uploadingRx}>
                                {uploadingRx?<><Spinner size="sm" animation="border"/> Mengupload...</>:<><FaUpload size={12}/> Upload Resep</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Container fluid style={{maxWidth:1200,margin:'0 auto'}}>
                {/* Header */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:16}}>
                        <div style={{width:52,height:52,background:'#dcfce7',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',color:'#16a34a'}}>
                            <FaPrescriptionBottle size={24}/>
                        </div>
                        <div>
                            <h1 style={{fontSize:24,fontWeight:700,color:'#0f172a',marginBottom:2}}>Farmasi Online</h1>
                            <p style={{fontSize:13,color:'#64748b',marginBottom:0}}>Pesan obat · bayar via Xendit · diantar atau pickup</p>
                        </div>
                    </div>
                    {/* Quota bar mahasiswa */}
                    {isStudent && quota.isStudent && (
                        <div style={{background:'linear-gradient(135deg,#ede9fe,#ddd6fe)',borderRadius:14,padding:'12px 18px',minWidth:220}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                                <FaGraduationCap style={{color:'#7c3aed'}}/>
                                <span style={{fontWeight:700,fontSize:13,color:'#4c1d95'}}>Kuota Gratis Bulan Ini</span>
                            </div>
                            <div className="quota-bar"><div className="quota-fill" style={{width:`${Math.min(100,(quota.used/quota.max)*100)}%`}}/></div>
                            <p style={{fontSize:12,color:'#6d28d9',marginBottom:0,marginTop:4}}>{quota.used}/{quota.max} pcs digunakan · Sisa {quota.remaining} pcs</p>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div style={{display:'flex',gap:6,marginBottom:24,background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:4}}>
                    <button className={`ph-tab ${activeTab==='shop'?'active':''}`} onClick={()=>setActiveTab('shop')}><FaSearch style={{marginRight:6}}/>Belanja Obat</button>
                    <button className={`ph-tab ${activeTab==='orders'?'active':''}`} onClick={()=>setActiveTab('orders')}><FaHistory style={{marginRight:6}}/>Pesanan Saya {orders.filter(o=>['waiting_prescription','pending','paid','diproses','dikirim','siap_diambil'].includes(o.status)).length>0&&<span style={{background:'#b91c1c',color:'#fff',borderRadius:20,padding:'1px 7px',fontSize:10,fontWeight:700,marginLeft:6}}>{orders.filter(o=>['waiting_prescription','pending','paid','diproses','dikirim','siap_diambil'].includes(o.status)).length}</span>}</button>
                </div>

                {/* ─── SHOP ─────────────────────────────────────────────── */}
                {activeTab==='shop' && (
                    <>
                        <Row className="g-3 mb-4">
                            <Col md={6}>
                                <div style={{position:'relative'}}>
                                    <FaSearch style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:'#94a3b8'}}/>
                                    <input className="ph-input" style={{paddingLeft:42}} type="text" placeholder="Cari nama obat, vitamin..." value={searchTerm} onChange={e=>{setSearchTerm(e.target.value);setCurrentPage(1);}}/>
                                </div>
                            </Col>
                            <Col md={4}>
                                <select className="ph-input" value={selectedCat} onChange={e=>{setSelectedCat(e.target.value);setCurrentPage(1);}}>
                                    {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </Col>
                            <Col md={2}>
                                <button style={{background:'#2563eb',border:'none',borderRadius:12,padding:'11px 16px',color:'#fff',fontWeight:500,width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,cursor:'pointer',position:'relative'}}
                                    onClick={()=>setShowCart(true)}>
                                    <FaShoppingCart/> Keranjang
                                    {cart.length>0&&<span style={{position:'absolute',top:-6,right:-6,background:'#b91c1c',color:'#fff',borderRadius:20,padding:'1px 7px',fontSize:10,fontWeight:700}}>{cart.reduce((s,i)=>s+i.quantity,0)}</span>}
                                </button>
                            </Col>
                        </Row>

                        {/* Warning keranjang ada resep */}
                        {cart.length>0 && cartHasRx && (
                            <div style={{background:'#fef3c7',border:'1px solid #fcd34d',borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'flex-start',gap:10}}>
                                <FaExclamationTriangle style={{color:'#b45309',marginTop:2,flexShrink:0}}/>
                                <div style={{fontSize:13,color:'#92400e'}}>
                                    <strong>Ada obat yang memerlukan resep dokter</strong> di keranjang. Tombol Checkout akan membuat pesanan dan Anda perlu mengupload resep sebelum bisa melanjutkan pembayaran.
                                </div>
                            </div>
                        )}

                        {loading ? <div style={{textAlign:'center',padding:60}}><Spinner animation="border" variant="primary"/></div>
                            : medicines.length===0 ? <div style={{textAlign:'center',padding:60,color:'#64748b'}}><FaPrescriptionBottle size={40} style={{marginBottom:12,color:'#94a3b8'}}/><h6>Tidak ada obat ditemukan</h6></div>
                            : (
                                <>
                                    <Row className="g-4">
                                        {medicines.map(med=>(
                                            <Col xl={3} lg={4} md={6} key={med._id}>
                                                <div className="ph-card">
                                                    <div style={{position:'relative'}}>
                                                        <img src={med.image?`${API_URL}${med.image}`:'/images/medicine-placeholder.jpg'} alt={med.name}
                                                            style={{height:170,objectFit:'cover',width:'100%',cursor:'pointer',filter:med.isActive===false?'grayscale(60%)':'none',opacity: med.isActive===false ? 0.75 : 1}}
                                                            onClick={()=>setSelectedMed(med)}/>
                                                        {med.isActive===false&&(
                                                            <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.25)',display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                                                                <span style={{background:'rgba(15,23,42,.7)',color:'#fff',borderRadius:8,padding:'5px 12px',fontSize:11,fontWeight:700,letterSpacing:.5}}>TIDAK TERSEDIA</span>
                                                            </div>
                                                        )}
                                                        {med.requiresPrescription&&<span style={{position:'absolute',top:8,right:8,background:'#f59e0b',color:'#fff',borderRadius:8,padding:'3px 8px',fontSize:10,fontWeight:700}}>Butuh Resep</span>}
                                                        {med.availableForStudentQuota&&<span style={{position:'absolute',top:8,left:8,background:'#7c3aed',color:'#fff',borderRadius:8,padding:'3px 8px',fontSize:10,fontWeight:700}}><FaStar size={8} style={{marginRight:3}}/>Gratis Mhs</span>}
                                                    </div>
                                                    <div style={{padding:14}}>
                                                        <h6 style={{fontWeight:600,fontSize:13,marginBottom:2}}>{med.name}</h6>
                                                        {med.genericName&&<p style={{fontSize:11,color:'#64748b',marginBottom:6}}>{med.genericName}</p>}
                                                        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:10}}>
                                                            <span style={{background:'#f1f5f9',color:'#475569',padding:'2px 8px',borderRadius:12,fontSize:10}}>{CATEGORIES.find(c=>c.value===med.category)?.label||med.category}</span>
                                                            <span style={{background:med.availableStock>10?'#dcfce7':med.availableStock>0?'#fef3c7':'#fee2e2',color:med.availableStock>10?'#166534':med.availableStock>0?'#b45309':'#b91c1c',padding:'2px 8px',borderRadius:12,fontSize:10}}>
                                                                Stok: {med.availableStock}
                                                            </span>
                                                        </div>
                                                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                                            <div>
                                                                {isStudent && med.availableForStudentQuota && quota.remaining>0 ? (
                                                                    <div>
                                                                        <span style={{textDecoration:'line-through',color:'#94a3b8',fontSize:11}}>{fmt(med.price)}</span>
                                                                        <span style={{fontWeight:700,color:'#7c3aed',fontSize:14,marginLeft:4}}>Rp 0 🎓</span>
                                                                    </div>
                                                                ) : <span style={{fontWeight:700,color:'#2563eb',fontSize:14}}>{fmt(med.price)}</span>}
                                                            </div>
                                                            <button disabled={med.availableStock===0||med.isActive===false} onClick={()=>addToCart(med)}
                                                                style={{background:(med.isActive===false||med.availableStock===0)?'#e2e8f0':'#2563eb',color:(med.isActive===false||med.availableStock===0)?'#94a3b8':'#fff',border:'none',borderRadius:30,padding:'6px 12px',fontSize:12,cursor:(med.isActive===false||med.availableStock===0)?'not-allowed':'pointer',fontFamily:'inherit'}}>
                                                                {med.isActive===false?'Tidak Tersedia':med.availableStock===0?'Habis':<><FaPlus size={10} style={{marginRight:4}}/>Tambah</>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Col>
                                        ))}
                                    </Row>
                                    {totalPages>1&&(
                                        <div style={{display:'flex',justifyContent:'center',gap:4,marginTop:32}}>
                                            <button style={{width:36,height:36,borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1}><FaChevronLeft size={11}/></button>
                                            {[...Array(totalPages)].map((_,i)=>(
                                                <button key={i} onClick={()=>setCurrentPage(i+1)} style={{width:36,height:36,borderRadius:8,border:'1px solid #e2e8f0',background:i+1===currentPage?'#2563eb':'#fff',color:i+1===currentPage?'#fff':'#475569',cursor:'pointer',fontFamily:'inherit'}}>
                                                    {i+1}
                                                </button>
                                            ))}
                                            <button style={{width:36,height:36,borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages}><FaChevronRight size={11}/></button>
                                        </div>
                                    )}
                                </>
                            )}
                    </>
                )}

                {/* ─── ORDERS ───────────────────────────────────────────── */}
                {activeTab==='orders'&&(
                    <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:24}}>
                        <h5 style={{fontWeight:700,marginBottom:20}}><FaBox style={{marginRight:8,color:'#0e7490'}}/>Pesanan Saya</h5>
                        {loadingOrders?<div style={{textAlign:'center',padding:40}}><Spinner animation="border" variant="primary"/></div>
                            :orders.length===0?(
                                <div style={{textAlign:'center',padding:40}}>
                                    <FaBox size={32} style={{color:'#94a3b8',marginBottom:12}}/><p style={{color:'#64748b'}}>Belum ada pesanan</p>
                                    <button className="btn-p" onClick={()=>setActiveTab('shop')}>Mulai Belanja</button>
                                </div>
                            ):orders.map(order=>(
                                <div key={order._id} className="order-card">
                                    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                                        <span style={{background:'#f1f5f9',padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,color:'#475569'}}>{order.orderNumber}</span>
                                        {getStatusBadge(order.status)}
                                        {order.deliveryMethod==='pickup'?<span style={{background:'#dcfce7',color:'#166534',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600}}><FaStore size={9} style={{marginRight:4}}/>Pickup</span>:<span style={{background:'#dbeafe',color:'#1e40af',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600}}><FaTruck size={9} style={{marginRight:4}}/>Diantar</span>}
                                        {order.isStudentDiscount&&<span style={{background:'#ede9fe',color:'#7c3aed',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600}}><FaGraduationCap size={9} style={{marginRight:4}}/>Diskon Mhs</span>}
                                    </div>

                                    <Row>
                                        <Col md={8}>
                                            {order.items?.map((item,i)=>(
                                                <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:3}}>
                                                    <span>{item.name} <span style={{color:'#64748b'}}>×{item.quantity}</span>
                                                        {item.requiresPrescription&&<span className="rx-badge"><FaFileImage size={8}/>Resep</span>}
                                                        {item.isFreeForStudent&&<span className="free-badge"><FaStar size={8}/>Gratis</span>}
                                                    </span>
                                                    <span style={{fontWeight:500}}>{fmt(item.subtotal)}</span>
                                                </div>
                                            ))}
                                            <div style={{fontSize:12,color:'#64748b',marginTop:8}}>
                                                {order.deliveryMethod==='diantar'
                                                    ?<><FaMotorcycle style={{marginRight:4}}/>{order.estimatedDelivery}</>
                                                    :<><FaStore style={{marginRight:4}}/>Pickup di Klinik Pratama IPB</>}
                                            </div>
                                            {order.shippingAddress?.address&&<div style={{fontSize:12,color:'#64748b',marginTop:3}}><FaMapMarkerAlt style={{marginRight:4}}/>{order.shippingAddress.address}{order.shippingAddress.detail&&` · ${order.shippingAddress.detail}`}</div>}

                                            {/* Status resep */}
                                            {order.requiresPrescription&&order.prescription&&(
                                                <div style={{marginTop:10,background:order.prescription.status==='approved'?'#dcfce7':order.prescription.status==='rejected'?'#fee2e2':'#fef9c3',borderRadius:8,padding:'8px 12px',fontSize:12}}>
                                                    {order.prescription.status==='pending'&&<><FaClock style={{marginRight:4,color:'#b45309'}}/>Resep sedang diverifikasi admin...</>}
                                                    {order.prescription.status==='approved'&&<><FaCheckCircle style={{marginRight:4,color:'#16a34a'}}/>Resep disetujui</>}
                                                    {order.prescription.status==='rejected'&&<><FaTimesCircle style={{marginRight:4,color:'#b91c1c'}}/>Ditolak: <strong>{order.prescription.rejectedReason}</strong></>}
                                                </div>
                                            )}

                                            {/* Info pickup timer */}
                                            {order.status==='siap_diambil'&&<div style={{marginTop:8,background:'#ecfdf5',border:'1px solid #6ee7b7',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#065f46',display:'flex',alignItems:'center',gap:6}}><FaStore/><span>Obat siap diambil di Klinik Pratama IPB. Batas waktu 48 jam sejak notifikasi.</span></div>}
                                            {order.status==='dikirim'&&<div style={{marginTop:8,background:'#ede9fe',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#6d28d9',display:'flex',alignItems:'center',gap:6}}><FaClock/>Estimasi tiba 1–2 hari kerja</div>}
                                        </Col>

                                        <Col md={4} style={{textAlign:'right'}}>
                                            <div style={{fontSize:18,fontWeight:700,color:'#2563eb',marginBottom:2}}>{fmt(order.totalAmount)}</div>
                                            {order.shippingCost>0&&<div style={{fontSize:11,color:'#64748b',marginBottom:8}}>Ongkir: {fmt(order.shippingCost)}</div>}
                                            <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end'}}>

                                                {/* Upload resep */}
                                                {['waiting_prescription','prescription_rejected'].includes(order.status)&&(
                                                    <>
                                                        <button className="btn-p" style={{padding:'8px 14px',fontSize:12}} onClick={()=>{setRxOrderId(order._id);setShowRxUpload(true);}}>
                                                            <FaUpload size={11}/> Upload Resep
                                                        </button>
                                                        <button className="btn-danger-sm" onClick={()=>cancelOrder(order._id)}>Batalkan</button>
                                                    </>
                                                )}

                                                {/* Bayar */}
                                                {order.status==='pending'&&order.totalAmount>0&&(
                                                    <>
                                                        <button className="btn-p" style={{padding:'8px 14px',fontSize:12}} onClick={()=>bayarLagi(order)}>
                                                            <FaExternalLinkAlt size={11}/> Bayar Sekarang
                                                        </button>
                                                        <button className="btn-danger-sm" onClick={()=>cancelOrder(order._id)}>Batalkan</button>
                                                    </>
                                                )}

                                                {/* Gratis (total=0) setelah resep disetujui */}
                                                {order.status==='pending'&&order.totalAmount===0&&(
                                                    <button className="btn-success" onClick={()=>confirmFreeFromOrders(order._id)}>
                                                        <FaCheckCircle size={11}/> Konfirmasi Pesanan Gratis
                                                    </button>
                                                )}

                                                {/* Terkirim → user bisa klik selesai */}
                                                {order.status==='terkirim'&&(
                                                    <button className="btn-success" onClick={()=>selesaikanOrder(order._id)}>
                                                        <FaCheckCircle size={11}/> Pesanan Sudah Diterima
                                                    </button>
                                                )}

                                                {/* Refund langsung — paid belum 1 jam */}
                                                {canRefundInstant(order)&&(
                                                    <button
                                                        style={{padding:'7px 14px',background:'#fff',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}
                                                        onClick={()=>{setRefundModal({order,type:'instant'});setRefundVideo(null);setRefundReason('');setNeedsBankInfo(false);setBankCode('');setAccountNumber('');setAccountName('');}}>
                                                        ↩️ Refund Pesanan
                                                    </button>
                                                )}

                                                {/* Refund dengan video — barang tidak sesuai */}
                                                {canRefundWithVideo(order)&&(
                                                    <button
                                                        style={{padding:'7px 14px',background:'#fff',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}
                                                        onClick={()=>{setRefundModal({order,type:'video'});setRefundVideo(null);setRefundReason('');setNeedsBankInfo(false);setBankCode('');setAccountNumber('');setAccountName('');}}>
                                                        🎥 Refund (Tidak Sesuai)
                                                    </button>
                                                )}

                                                {/* Refund status info */}
                                                {order.status==='refund_requested'&&(
                                                    <div style={{background:'#fef3c7',border:'1px solid #fcd34d',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#92400e',textAlign:'left'}}>
                                                        ⏳ Permintaan refund sedang ditinjau admin.
                                                    </div>
                                                )}
                                                {order.status==='refund_rejected'&&(
                                                    <div style={{background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#991b1b',textAlign:'left'}}>
                                                        ❌ Refund ditolak: {order.refund?.rejectReason || '-'}
                                                    </div>
                                                )}
                                                {order.status==='refunded'&&(
                                                    <div style={{background:'#dcfce7',border:'1px solid #6ee7b7',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#166534',textAlign:'left'}}>
                                                        ✅ Refund berhasil diproses.
                                                    </div>
                                                )}
                                            </div>
                                        </Col>
                                    </Row>
                                </div>
                            ))
                        }
                    </div>
                )}

                {/* ─── REFUND MODAL ─────────────────────────────────────── */}
                {refundModal&&(
                    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
                        <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto',padding:24}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                                <span style={{fontWeight:700,fontSize:16,color:'#111827'}}>
                                    {refundModal.type==='instant' ? '↩️ Refund Pesanan' : '🎥 Refund Barang Tidak Sesuai'}
                                </span>
                                <button onClick={()=>setRefundModal(null)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#6b7280'}}>×</button>
                            </div>

                            {/* Info box berbeda per skenario */}
                            {refundModal.type==='instant' ? (
                                <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#1e40af',marginBottom:16}}>
                                    <div style={{fontWeight:600,marginBottom:4}}>ℹ️ Refund Langsung</div>
                                    <div>Pesanan belum diproses. Dana akan dikembalikan secara otomatis.</div>
                                    <div style={{marginTop:4,color:'#1d4ed8'}}>Catatan: biaya layanan payment gateway tidak termasuk dalam refund.</div>
                                </div>
                            ) : (
                                <div style={{background:'#fef3c7',border:'1px solid #fcd34d',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#92400e',marginBottom:16}}>
                                    <div style={{fontWeight:600,marginBottom:4}}>⚠️ Refund Barang Tidak Sesuai</div>
                                    <ul style={{margin:0,paddingLeft:16,lineHeight:1.8}}>
                                        <li>Wajib menyertakan <strong>video bukti</strong> (maks. 50MB)</li>
                                        <li>Admin akan meninjau dan memverifikasi video Anda</li>
                                        <li>Catatan: biaya payment gateway tidak termasuk dalam refund</li>
                                    </ul>
                                </div>
                            )}

                            <div style={{fontSize:13,color:'#374151',marginBottom:16}}>
                                <strong>Pesanan:</strong> {refundModal.order.orderNumber} — Rp {(refundModal.order.totalAmount||0).toLocaleString('id-ID')}
                            </div>

                            {/* Upload video — hanya untuk skenario video */}
                            {refundModal.type==='video'&&(
                                <div style={{marginBottom:14}}>
                                    <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>
                                        Video Bukti <span style={{color:'#ef4444'}}>*</span>
                                        <span style={{fontWeight:400,color:'#6b7280'}}> (MP4/MOV/AVI/MKV, maks 50MB)</span>
                                    </label>
                                    <input ref={refundVideoRef} type="file" accept="video/*"
                                        style={{display:'none'}}
                                        onChange={e=>setRefundVideo(e.target.files?.[0]||null)} />
                                    <button onClick={()=>refundVideoRef.current?.click()}
                                        style={{padding:'8px 16px',border:'2px dashed #d1d5db',borderRadius:8,background:'#f9fafb',color:'#374151',fontSize:13,cursor:'pointer',width:'100%'}}>
                                        {refundVideo ? `✅ ${refundVideo.name} (${(refundVideo.size/1024/1024).toFixed(1)}MB)` : '📁 Pilih Video Bukti'}
                                    </button>
                                </div>
                            )}

                            {/* Bank info jika needsBankInfo */}
                            {needsBankInfo&&(
                                <div style={{background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:8,padding:'12px 14px',marginBottom:16}}>
                                    <div style={{fontWeight:600,fontSize:13,color:'#92400e',marginBottom:10}}>
                                        💳 Masukkan rekening untuk menerima refund
                                    </div>
                                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                                        <div>
                                            <label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:4}}>Bank <span style={{color:'#ef4444'}}>*</span></label>
                                            <select value={bankCode} onChange={e=>setBankCode(e.target.value)} style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13}}>
                                                <option value="">— Pilih Bank —</option>
                                                {bankList.map(b=><option key={b.code} value={b.code}>{b.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:4}}>Nomor Rekening <span style={{color:'#ef4444'}}>*</span></label>
                                            <input value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} placeholder="mis. 1234567890" style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box'}} />
                                        </div>
                                        <div>
                                            <label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:4}}>Nama Pemilik <span style={{color:'#ef4444'}}>*</span></label>
                                            <input value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Sesuai nama di buku tabungan" style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box'}} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Alasan */}
                            <div style={{marginBottom:18}}>
                                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>
                                    Alasan <span style={{color:'#ef4444'}}>*</span>
                                </label>
                                <textarea value={refundReason} onChange={e=>setRefundReason(e.target.value)} rows={3}
                                    placeholder={refundModal.type==='instant' ? 'Jelaskan mengapa Anda membatalkan pesanan...' : 'Jelaskan ketidaksesuaian barang yang diterima...'}
                                    style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,fontFamily:'inherit',resize:'vertical',boxSizing:'border-box'}} />
                            </div>

                            <div style={{display:'flex',gap:10}}>
                                <button onClick={()=>setRefundModal(null)}
                                    style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid #d1d5db',background:'#fff',color:'#6b7280',fontWeight:600,cursor:'pointer'}}>
                                    Batal
                                </button>
                                <button onClick={handleRefundSubmit}
                                    disabled={submittingRefund||(refundModal.type==='video'&&!refundVideo)||!refundReason.trim()}
                                    style={{flex:2,padding:'10px',borderRadius:8,border:'none',
                                        background:(refundModal.type==='video'&&!refundVideo)||!refundReason.trim()?'#9ca3af':'#dc2626',
                                        color:'#fff',fontWeight:700,cursor:'pointer',opacity: submittingRefund ? 0.6 : 1}}>
                                    {submittingRefund ? 'Memproses...' : refundModal.type==='instant' ? '↩️ Konfirmasi Refund' : '📤 Kirim Pengajuan Refund'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── CART MODAL ───────────────────────────────────────── */}
                {showCart&&(
                    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
                        <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:600,maxHeight:'85vh',overflow:'auto'}}>
                            <div style={{padding:24}}>
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                                    <h5 style={{fontWeight:700,marginBottom:0}}><FaShoppingCart style={{color:'#2563eb',marginRight:8}}/>Keranjang</h5>
                                    <button onClick={()=>setShowCart(false)} style={{background:'none',border:'none',fontSize:24,cursor:'pointer'}}>×</button>
                                </div>

                                {/* Warning resep */}
                                {cartHasRx&&(
                                    <div style={{background:'#fef3c7',border:'1px solid #fcd34d',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#92400e',display:'flex',alignItems:'flex-start',gap:8}}>
                                        <FaExclamationTriangle style={{marginTop:2,flexShrink:0}}/> <span><strong>Ada obat yang memerlukan resep.</strong> Setelah klik Checkout, sistem akan membuat pesanan dan Anda perlu upload resep dokter. Pembayaran baru bisa dilakukan setelah admin menyetujui resep.</span>
                                    </div>
                                )}

                                {/* Quota info */}
                                {isStudent&&quota.isStudent&&quota.remaining>0&&(
                                    <div style={{background:'#ede9fe',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#5b21b6',display:'flex',alignItems:'center',gap:8}}>
                                        <FaGraduationCap/><span>Kuota gratis tersisa: <strong>{quota.remaining} pcs</strong> untuk obat bertanda 🎓</span>
                                    </div>
                                )}
                                {isStudent&&quota.isStudent&&quota.remaining===0&&(
                                    <div style={{background:'#f3f4f6',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#6b7280'}}>
                                        <FaInfoCircle style={{marginRight:6}}/>Kuota gratis bulan ini sudah habis. Harga normal akan berlaku.
                                    </div>
                                )}

                                {cart.length===0?<p style={{color:'#64748b',textAlign:'center',padding:40}}>Keranjang kosong</p>:(
                                    <>
                                        {cart.map(item=>{
                                            const isFree = isStudent && item.availableForStudentQuota && !item.requiresPrescription && quota.remaining>0;
                                            return (
                                                <div key={item._id} style={{display:'flex',alignItems:'center',padding:'12px 0',borderBottom:'1px solid #f1f5f9'}}>
                                                    <img src={item.image?`${API_URL}${item.image}`:'/images/medicine-placeholder.jpg'} alt={item.name} style={{width:48,height:48,objectFit:'cover',borderRadius:8,marginRight:12}}/>
                                                    <div style={{flex:1}}>
                                                        <div style={{fontWeight:500,fontSize:13}}>{item.name}{item.requiresPrescription&&<span className="rx-badge"><FaFileImage size={8}/>Resep</span>}{isFree&&<span className="free-badge"><FaStar size={8}/>Gratis</span>}</div>
                                                        <div style={{fontSize:11,color:'#64748b'}}>{isFree?<span style={{color:'#7c3aed',fontWeight:600}}>Rp 0 (gratis mhs)</span>:fmt(item.price)+' / item'}</div>
                                                    </div>
                                                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                                                        <button style={{width:28,height:28,borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>updateQuantity(item._id,item.quantity-1)}><FaMinus size={9}/></button>
                                                        <span style={{minWidth:20,textAlign:'center',fontSize:13,fontWeight:500}}>{item.quantity}</span>
                                                        <button style={{width:28,height:28,borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>updateQuantity(item._id,item.quantity+1)}><FaPlus size={9}/></button>
                                                    </div>
                                                    <div style={{marginLeft:14,textAlign:'right',minWidth:80}}>
                                                        <div style={{fontWeight:600,fontSize:13,color:isFree?'#7c3aed':'#2563eb'}}>{isFree?'Rp 0':fmt(item.price*item.quantity)}</div>
                                                        <button style={{background:'none',border:'none',color:'#b91c1c',fontSize:11,cursor:'pointer'}} onClick={()=>removeFromCart(item._id)}>Hapus</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div style={{marginTop:14,padding:14,background:'#f8fafc',borderRadius:10,display:'flex',justifyContent:'space-between',fontWeight:600,fontSize:15}}>
                                            <span>Subtotal Obat</span>
                                            <span style={{color:'#2563eb'}}>{fmt(cartSubtotal())}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div style={{padding:'14px 24px',borderTop:'1px solid #e2e8f0',display:'flex',justifyContent:'flex-end',gap:8}}>
                                <button className="btn-o" onClick={()=>setShowCart(false)}>Lanjut Belanja</button>
                                {cart.length>0&&(
                                    <>
                                        <button className="btn-o" style={{borderColor:'#b91c1c',color:'#b91c1c'}} onClick={clearCart}><FaTrash style={{marginRight:4}}/>Kosongkan</button>
                                        <button className="btn-p" onClick={handleCheckoutClick}>
                                            {cartHasRx?<><FaFileImage size={12}/> Checkout & Upload Resep</>:<><FaArrowRight size={12}/> Checkout</>}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── CHECKOUT MODAL ───────────────────────────────────── */}
                {showCheckout&&(
                    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
                        <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:600,maxHeight:'93vh',overflow:'auto'}}>
                            <div style={{padding:24}}>
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                                    <h5 style={{fontWeight:700,marginBottom:0}}><FaTruck style={{color:'#2563eb',marginRight:8}}/>Checkout</h5>
                                    <button onClick={()=>setShowCheckout(false)} style={{background:'none',border:'none',fontSize:24,cursor:'pointer'}}>×</button>
                                </div>

                                {cartHasRx&&(
                                    <div style={{background:'#fef9c3',border:'1px solid #fcd34d',borderRadius:12,padding:'12px 16px',marginBottom:14,fontSize:13,color:'#92400e'}}>
                                        <FaFileImage style={{marginRight:6}}/>
                                        <strong>Pesanan ini membutuhkan resep.</strong> Setelah checkout, Anda perlu upload foto resep. Pembayaran baru aktif setelah admin verifikasi.
                                    </div>
                                )}

                                {/* Step 1: Lokasi */}
                                <div className="sec-box">
                                    <h6 style={{fontWeight:600,marginBottom:12,fontSize:13}}><FaMapMarkerAlt style={{color:'#2563eb',marginRight:6}}/>1. Lokasi Pengiriman</h6>
                                    <button className="map-btn" onClick={()=>setShowMap(true)}>
                                        <FaMapMarkerAlt/>{selectedAddress?'Ubah Lokasi di Peta':'Pilih Lokasi di Peta'}
                                    </button>
                                    {selectedAddress&&(
                                        <div style={{marginTop:10,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'10px 14px',marginBottom:10}}>
                                            <p style={{fontSize:13,color:'#1e3a8a',margin:0}}><FaMapMarkerAlt style={{marginRight:4}}/>{selectedAddress.address}</p>
                                        </div>
                                    )}
                                    <div style={{marginTop:10}}>
                                        <label style={{fontSize:12,color:'#64748b',marginBottom:4,display:'block'}}>Detail Lokasi <span style={{color:'#94a3b8'}}>(No. rumah, RT/RW, nama gedung, dll)</span></label>
                                        <input type="text" className="ph-input" placeholder="contoh: No. 12 RT 03/RW 05, dekat Alfamart" value={addressDetail} onChange={e=>setAddressDetail(e.target.value)}/>
                                    </div>
                                    {selectedAddress&&(
                                        <button className="btn-p" style={{marginTop:10,width:'100%',justifyContent:'center'}} onClick={calculateShipping} disabled={loadingShipping}>
                                            {loadingShipping?<><Spinner size="sm" animation="border"/> Menghitung jarak...</>:<><FaRoute/> Cek Jarak & Ongkir</>}
                                        </button>
                                    )}
                                </div>

                                {/* Step 2: Pengiriman */}
                                {shippingResult&&(
                                    <div className="sec-box">
                                        <h6 style={{fontWeight:600,marginBottom:12,fontSize:13}}><FaMotorcycle style={{color:'#2563eb',marginRight:6}}/>2. Metode Pengiriman</h6>
                                        <div style={{background:shippingResult.canDeliver?'#dcfce7':'#fef3c7',borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:13,color:shippingResult.canDeliver?'#166534':'#b45309'}}>
                                            <FaRoute style={{marginRight:6}}/>{shippingResult.message}
                                        </div>
                                        {shippingResult.options.map(opt=>(
                                            <div key={opt.method} className={`delivery-opt ${selectedDelivery?.method===opt.method?'sel':''}`} onClick={()=>setSelectedDelivery(opt)}>
                                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                                                        <div style={{width:36,height:36,borderRadius:10,background:opt.method==='diantar'?'#dbeafe':'#dcfce7',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                                            {opt.method==='diantar'?<FaMotorcycle style={{color:'#2563eb'}}/>:<FaStore style={{color:'#16a34a'}}/>}
                                                        </div>
                                                        <div><div style={{fontWeight:600,fontSize:14}}>{opt.label}</div><div style={{fontSize:12,color:'#64748b'}}>{opt.description}</div></div>
                                                    </div>
                                                    <div style={{fontWeight:700,color:opt.cost===0?'#16a34a':'#2563eb',fontSize:15}}>{opt.cost===0?'Gratis':fmt(opt.cost)}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {selectedDelivery?.method==='diantar'&&(
                                            <div style={{marginTop:10}}>
                                                <label style={{fontSize:12,color:'#64748b',marginBottom:4,display:'block'}}>Nomor Telepon <span style={{color:'#b91c1c'}}>*</span></label>
                                                <input type="tel" className="ph-input" placeholder="0812xxxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)}/>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Step 3: Ringkasan */}
                                {selectedDelivery&&(
                                    <div className="sec-box">
                                        <h6 style={{fontWeight:600,marginBottom:12,fontSize:13}}>3. Ringkasan Pembayaran</h6>
                                        <div style={{fontSize:13}}>
                                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><span style={{color:'#64748b'}}>Subtotal Obat</span><span style={{fontWeight:500}}>{fmt(cartSubtotal())}</span></div>
                                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><span style={{color:'#64748b'}}>Ongkir</span><span style={{color:selectedDelivery.cost===0?'#16a34a':'#0f172a',fontWeight:500}}>{selectedDelivery.cost===0?'Gratis':fmt(selectedDelivery.cost)}</span></div>
                                            {isStudent&&quota.remaining>0&&<div style={{fontSize:11,color:'#7c3aed',marginBottom:6,textAlign:'right'}}>🎓 Kuota gratis mhs diterapkan</div>}
                                            <hr style={{margin:'8px 0',borderColor:'#e2e8f0'}}/>
                                            <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:16,marginBottom:12}}><span>Total</span><span style={{color:'#2563eb'}}>{fmt(computedTotal())}</span></div>
                                        </div>
                                        {computedTotal()===0&&!cartHasRx&&<div style={{background:'#dcfce7',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#166534',marginBottom:8,display:'flex',alignItems:'center',gap:6}}><FaCheckCircle/> Total Rp 0 — tidak perlu pembayaran!</div>}
                                        {computedTotal()>0&&!cartHasRx&&<div style={{background:'linear-gradient(135deg,#0ea5e9,#2563eb)',color:'#fff',borderRadius:10,padding:'10px 14px',display:'flex',alignItems:'center',gap:8,fontSize:12,marginBottom:8}}><FaLock/><div><div style={{fontWeight:600}}>Pembayaran via Xendit</div><div style={{opacity:.85,fontSize:11}}>BCA · BNI · BRI · OVO · DANA · QRIS</div></div></div>}
                                        {cartHasRx&&<div style={{background:'#fef3c7',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#92400e',display:'flex',alignItems:'center',gap:6}}><FaFileImage/> Pembayaran aktif setelah resep diverifikasi admin</div>}
                                    </div>
                                )}
                            </div>
                            <div style={{padding:'14px 24px',borderTop:'1px solid #e2e8f0',display:'flex',justifyContent:'flex-end',gap:8}}>
                                <button className="btn-o" onClick={()=>setShowCheckout(false)}>Batal</button>
                                <button className="btn-p"
                                    onClick={createOrder}
                                    disabled={!selectedDelivery||(selectedDelivery?.method==='diantar'&&!phone.trim())||creatingOrder}>
                                    {creatingOrder?<><Spinner size="sm" animation="border"/> Memproses...</>
                                        :cartHasRx?<><FaFileImage size={12}/> Buat Pesanan & Upload Resep</>
                                        :computedTotal()>0?<><FaExternalLinkAlt size={12}/> Bayar Sekarang</>
                                        :<><FaCheckCircle size={12}/> Konfirmasi Pesanan</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── DETAIL OBAT ──────────────────────────────────────── */}
                {selectedMed&&(
                    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
                        <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:440}}>
                            <div style={{padding:24}}>
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                                    <h5 style={{fontWeight:700,marginBottom:0}}>{selectedMed.name}</h5>
                                    <button onClick={()=>setSelectedMed(null)} style={{background:'none',border:'none',fontSize:24,cursor:'pointer'}}>×</button>
                                </div>
                                <img src={selectedMed.image?`${API_URL}${selectedMed.image}`:'/images/medicine-placeholder.jpg'} alt={selectedMed.name} style={{maxHeight:130,objectFit:'contain',display:'block',margin:'0 auto 16px',maxWidth:'100%'}}/>
                                {selectedMed.requiresPrescription&&<div style={{background:'#fef3c7',border:'1px solid #fcd34d',borderRadius:8,padding:'8px 12px',marginBottom:12,fontSize:12,color:'#92400e',display:'flex',alignItems:'center',gap:6}}><FaFileImage/>Obat ini membutuhkan resep dokter</div>}
                                {selectedMed.availableForStudentQuota&&!selectedMed.requiresPrescription&&<div style={{background:'#ede9fe',borderRadius:8,padding:'8px 12px',marginBottom:12,fontSize:12,color:'#7c3aed',display:'flex',alignItems:'center',gap:6}}><FaStar/>Tersedia dalam program gratis mahasiswa IPB</div>}
                                <div style={{background:'#f8fafc',borderRadius:12,padding:16}}>
                                    {[['Nama Generik',selectedMed.genericName||'-'],['Kategori',CATEGORIES.find(c=>c.value===selectedMed.category)?.label||selectedMed.category],['Harga',fmt(selectedMed.price)],['Stok Tersedia',`${selectedMed.availableStock} ${selectedMed.unit||'pcs'}`],['Satuan',selectedMed.unit||'tablet']].map(([label,val],i)=>(
                                        <div key={i} style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:13}}>
                                            <span style={{color:'#64748b'}}>{label}:</span>
                                            <span style={{fontWeight:500}}>{val}</span>
                                        </div>
                                    ))}
                                    {selectedMed.description&&<div style={{marginTop:10,paddingTop:10,borderTop:'1px solid #e2e8f0',fontSize:12,color:'#64748b'}}>{selectedMed.description}</div>}
                                </div>
                            </div>
                            <div style={{padding:'14px 24px',borderTop:'1px solid #e2e8f0',display:'flex',justifyContent:'flex-end',gap:8}}>
                                <button className="btn-o" onClick={()=>setSelectedMed(null)}>Tutup</button>
                                <button className="btn-p" disabled={selectedMed.availableStock===0||selectedMed.isActive===false} onClick={()=>{addToCart(selectedMed);setSelectedMed(null);toast.success(`${selectedMed.name} ditambahkan ke keranjang`);}}>
                                    <FaShoppingCart size={12}/>{selectedMed.isActive===false?'Tidak Tersedia':selectedMed.availableStock===0?'Stok Habis':'Tambah ke Keranjang'}
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