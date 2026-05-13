import React, { useState, useEffect, useRef, useCallback } from 'react';
import api, { API_URL } from '../utils/api';
import io from 'socket.io-client';
import { Container, Row, Col, Spinner } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { toast } from 'react-hot-toast';
import {
    FaPills, FaSearch, FaShoppingCart, FaPlus, FaMinus, FaTrash,
    FaBox, FaTruck, FaClock, FaCheckCircle,
    FaHistory, FaArrowRight, FaExclamationTriangle, FaChevronLeft,
    FaChevronRight, FaMapMarkerAlt, FaExternalLinkAlt,
    FaMotorcycle, FaStore, FaGraduationCap, FaRoute, FaLock,
    FaFileImage, FaUpload, FaTimesCircle, FaInfoCircle, FaEdit,
    FaBan, FaStar, FaCapsules, FaChevronDown
} from 'react-icons/fa';

const KLINIK_LAT = -6.5530;
const KLINIK_LNG = 106.7237;

// Format harga: Membulatkan angka agar tidak ada .00 dan mengubah warna menjadi hitam tegas
const fmt = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;

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

// ─── Grup Filter Status Pesanan ───────────────────────────────────────────────
const ORDER_FILTERS = [
    { value: 'all',      label: 'Semua'             },
    { value: 'active',   label: 'Aktif'             },
    { value: 'pending',  label: 'Menunggu Bayar'    },
    { value: 'paid',     label: 'Sudah Bayar'       },
    { value: 'done',     label: 'Selesai'           },
    { value: 'cancelled',label: 'Dibatalkan'        },
    { value: 'expired',  label: 'Kedaluwarsa'       },
];

// Status yang termasuk tiap grup filter
const FILTER_STATUS_MAP = {
    all      : null, // tidak difilter
    active   : ['waiting_prescription','prescription_rejected','pending','paid','diproses','dikirim','siap_diambil'],
    pending  : ['pending'],
    paid     : ['paid'],
    done     : ['selesai','terkirim','refunded'],
    cancelled: ['cancelled','refund_rejected'],
    expired  : ['expired'],
};

// ─── Helper: resolusi URL gambar (Cloudinary = full URL, lokal = tambah API_URL) ──
const resolveImg = (image) => {
    if (!image) return null;
    return image.startsWith("http") ? image : `${API_URL}${image}`;
};

// ─── Komponen Fallback Gambar ─────────────────────────────────────────────────
const ProductImage = ({ src, alt, isActive, isGrid = true }) => {
    const [err, setErr] = useState(false);
    
    const filterStyle = {
        filter: isActive === false ? 'grayscale(100%)' : 'none',
        opacity: isActive === false ? 0.6 : 1
    };

    if (!src || err) {
        return (
            <div className={isGrid ? "med-img-fallback" : ""} 
                 style={isGrid ? { ...filterStyle } : { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', ...filterStyle }}>
                <FaCapsules size={isGrid ? 48 : 24} />
            </div>
        );
    }
    
    return (
        <img src={src} alt={alt} className={isGrid ? "med-img" : ""} onError={() => setErr(true)}
            style={isGrid ? { ...filterStyle } : { width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply', ...filterStyle }} />
    );
};

// ─── Map Picker (Telah Diperkecil) ────────────────────────────────────────────
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
                const lnk = document.createElement('link'); lnk.id='leaflet-css'; lnk.rel='stylesheet'; 
                lnk.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; 
                document.head.appendChild(lnk);
            }
            if (!window.L) await new Promise((res,rej)=>{ 
                const s=document.createElement('script'); 
                s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; 
                s.onload=res; s.onerror=rej; document.head.appendChild(s); 
            });
            if (destroyed) return;
            const L = window.L;
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({ 
                iconRetinaUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png', 
                iconUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png', 
                shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png' 
            });
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
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(4px)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
            {/* Lebar maksimal diperkecil ke 500px */}
            <div className="slide-up" onClick={e => e.stopPropagation()} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:500,maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 25px 50px -12px rgba(0,0,0,.25)'}}>
                <div style={{padding:'20px 24px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                        <h6 style={{margin:0,fontWeight:700,fontSize:15}}><FaMapMarkerAlt style={{color:'#2563eb',marginRight:8}}/>Pilih Lokasi Pengiriman</h6>
                        <p style={{margin:0,fontSize:12,color:'#64748b',marginTop:4}}>Klik peta atau drag pin merah</p>
                    </div>
                    <button onClick={onClose} style={{background:'#f1f5f9',border:'none',fontSize:18,width:32,height:32,borderRadius:'50%',cursor:'pointer',color:'#64748b',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                </div>
                {/* Tinggi peta diperkecil ke 260px */}
                <div style={{position:'relative',flex:'0 0 260px'}}>
                    {!mapLoaded&&!mapError&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',zIndex:1}}><Spinner animation="border" variant="primary" size="sm"/><span style={{marginLeft:10,color:'#475569',fontSize:13,fontWeight:500}}>Memuat peta...</span></div>}
                    {mapError&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fef2f2',zIndex:1,padding:24,textAlign:'center'}}><div><FaExclamationTriangle size={24} style={{color:'#b91c1c',marginBottom:8}}/><p style={{color:'#b91c1c',margin:0,fontSize:13}}>{mapError}</p></div></div>}
                    <div ref={mapRef} style={{height:260,width:'100%'}}/>
                </div>
                <div style={{padding:'16px 20px',background:'#f8fafc'}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:6,display:'block'}}>{coord?(geocoding?'Mencari alamat...':<><FaEdit size={10} style={{marginRight:4}}/>Alamat Detail:</>):'Pilih lokasi di peta'}</label>
                    <textarea rows={2} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Alamat akan otomatis terisi..." style={{width:'100%',padding:'10px 14px',border:'1px solid #e2e8f0',borderRadius:12,fontSize:13,resize:'none',fontFamily:'inherit',boxShadow:'inset 0 2px 4px 0 rgba(0,0,0,0.02)'}}/>
                </div>
                <div style={{padding:'14px 20px',borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'flex-end',gap:10,background:'#fff'}}>
                    <button onClick={onClose} className="btn-o" style={{padding:'8px 16px', fontSize:13}}>Batal</button>
                    <button onClick={()=>{ if(!coord){toast.error('Klik lokasi Anda di peta');return;} if(!address.trim()){toast.error('Alamat tidak boleh kosong');return;} onConfirm({lat:coord.lat,lng:coord.lng,address:address.trim()}); }}
                        disabled={!coord||geocoding} className="btn-p" style={{opacity: !coord||geocoding ? 0.6 : 1, padding:'8px 16px', fontSize:13}}>
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
    
    // Custom Dropdown State
    const [selectedCat, setSelectedCat] = useState('');
    const [catOpen,     setCatOpen]     = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages,  setTotalPages]  = useState(1);

    const [quota, setQuota] = useState({ isStudent:false, used:0, remaining:0, max:8 });

    const [activeTab,    setActiveTab]    = useState('shop');
    const [showCart,     setShowCart]     = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);
    const [showMap,      setShowMap]      = useState(false);

    const [selectedAddress,  setSelectedAddress]  = useState(null);
    const [addressDetail,    setAddressDetail]    = useState('');
    const [phone,            setPhone]            = useState('');
    const [shippingResult,   setShippingResult]   = useState(null);
    const [loadingShipping,  setLoadingShipping]  = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState(null);
    const [creatingOrder,    setCreatingOrder]    = useState(false);

    const [showRxUpload,    setShowRxUpload]    = useState(false);
    const [rxFile,          setRxFile]          = useState(null);
    const [rxOrderId,       setRxOrderId]       = useState(null);
    const [uploadingRx,     setUploadingRx]     = useState(false);
    const rxInputRef = useRef();

    const [selectedMed, setSelectedMed] = useState(null);
    const [guestModal,  setGuestModal]  = useState(false);

    const [orders,        setOrders]        = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [orderFilter,   setOrderFilter]   = useState('all'); // filter status pesanan

    const isStudent = user?.email?.toLowerCase().endsWith('@apps.ipb.ac.id');
    const cartHasRx = cart.some(i => i.requiresPrescription);
    
    const cartSubtotal = () => {
        if (!isStudent) return getCartTotal();
        let used = quota.remaining; 
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
        if (!user) { 
            fetchMedicines(); 
            window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll otomatis ke atas
            return; 
        } 
        fetchMedicines();
        if (isStudent) fetchQuota();
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll otomatis ke atas
    }, [currentPage, searchTerm, selectedCat]); // eslint-disable-line

    useEffect(() => {
        if (activeTab === 'orders' && user) {
            fetchOrders();
            setOrderFilter('all'); // reset filter saat buka tab
        }
    }, [activeTab, user]); // eslint-disable-line

    useEffect(() => {
        if (!user) return;
        const sock = io(API_URL, {
            auth: { token: localStorage.getItem('token') },
            query: { userId: user.id || user._id },
        });
        sock.emit('join-user', user.id || user._id);
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
            const p = new URLSearchParams({ page: currentPage, limit: 16 });
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
        if (!user) return;
        setLoadingOrders(true);
        try {
            const res = await api.get('/api/pharmacy/orders');
            setOrders(res.data);
        } catch { /* silent */ }
        finally  { setLoadingOrders(false); }
    };

    const handleMapConfirm = ({ lat, lng, address }) => {
        setSelectedAddress({ lat, lng, address });
        setShippingResult(null); setSelectedDelivery(null); setShowMap(false);
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

    const handleCheckoutClick = () => {
        if (!user) { setGuestModal(true); return; } 
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

            if (orderRes.data.requiresPrescription) {
                setRxOrderId(order._id);
                setShowRxUpload(true);
                setActiveTab('orders');
                fetchOrders();
                return;
            }

            // Gunakan Number() karena DECIMAL dari MySQL bisa kembali sebagai string "0.00"
            if (Number(order.totalAmount) === 0) {
                // Backend sudah otomatis set status 'diproses' untuk pesanan gratis
                toast.success('Pesanan gratis berhasil dibuat! Sedang disiapkan.');
                setActiveTab('orders'); fetchOrders(); fetchQuota();
                return;
            }

            const invRes = await api.post('/api/xendit/create-invoice', {
                amount     : Number(order.totalAmount),
                paymentType: 'medicine',
                referenceId: order._id,
                description: `Obat ${order.orderNumber} – Klinik Pratama IPB`,
            });
            window.location.href = invRes.data.invoiceUrl;

        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal membuat pesanan');
        } finally { setCreatingOrder(false); }
    };

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

    const cancelOrder = async (id) => {
        if (!window.confirm('Yakin ingin membatalkan pesanan?')) return;
        try {
            await api.put(`/api/pharmacy/orders/${id}/cancel`, { reason: 'Dibatalkan pengguna' });
            toast.success('Pesanan dibatalkan'); fetchOrders();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal membatalkan'); }
    };

    const [refundModal, setRefundModal]   = useState(null); 
    const [refundVideo, setRefundVideo]   = useState(null);
    const [refundReason, setRefundReason] = useState('');
    const [submittingRefund, setSubmittingRefund] = useState(false);
    const [bankCode, setBankCode]         = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName]   = useState('');
    const [bankList, setBankList]         = useState([]);
    const refundVideoRef = useRef(null);

    useEffect(() => {
        // Gunakan bank list sama seperti konsultasi — ambil dari Xendit
        api.get('/api/pharmacy/refund-banks')
            .then(r => setBankList(r.data.banks || []))
            .catch(() => setBankList([
                { code: 'BCA', name: 'Bank Central Asia' },
                { code: 'BNI', name: 'Bank Negara Indonesia' },
                { code: 'BRI', name: 'Bank Rakyat Indonesia' },
                { code: 'MANDIRI', name: 'Bank Mandiri' },
                { code: 'BSI', name: 'Bank Syariah Indonesia' },
                { code: 'CIMB', name: 'CIMB Niaga' },
                { code: 'PERMATA', name: 'Bank Permata' },
                { code: 'DANAMON', name: 'Bank Danamon' },
                { code: 'BTN', name: 'Bank Tabungan Negara' },
            ]));
    }, []);

    const openRefundModal = (order, type) => {
        setRefundModal({ order, type });
        setRefundVideo(null);
        setRefundReason('');
        setBankCode('');
        setAccountNumber('');
        setAccountName('');
    };

    const handleRefundSubmit = async () => {
        if (!refundModal) return;
        const isInstant = refundModal.type === 'instant';

        if (!isInstant && !refundVideo) { toast.error('Video bukti wajib diunggah'); return; }
        if (!refundReason.trim()) { toast.error('Alasan refund wajib diisi'); return; }
        if (!bankCode) { toast.error('Pilih bank tujuan refund'); return; }
        if (!accountNumber.trim()) { toast.error('Nomor rekening wajib diisi'); return; }
        if (!accountName.trim()) { toast.error('Nama pemilik rekening wajib diisi'); return; }
        if (!isInstant && refundVideo?.size > 50 * 1024 * 1024) { toast.error('Ukuran video maksimal 50MB'); return; }

        setSubmittingRefund(true);
        try {
            const fd = new FormData();
            fd.append('reason', refundReason);
            fd.append('bankCode', bankCode);
            fd.append('accountNumber', accountNumber.trim());
            fd.append('accountName', accountName.trim());
            if (!isInstant && refundVideo) fd.append('video', refundVideo);

            await api.post(
                `/api/pharmacy/orders/${refundModal.order._id || refundModal.order.id}/refund-request`,
                fd,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            toast.success(isInstant
                ? 'Refund berhasil diproses!'
                : 'Pengajuan refund dikirim. Admin akan meninjau dalam 1×24 jam.');
            setRefundModal(null);
            fetchOrders();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal mengajukan refund');
        } finally { setSubmittingRefund(false); }
    };

    const canRefundInstant = (order) => {
        if (order.status !== 'paid') return false;
        // Pesanan gratis mahasiswa tidak bisa direfund
        if (order.isStudentDiscount && Number(order.totalAmount) === 0) return false;
        const paidAt = order.updatedAt || order.createdAt;
        return Date.now() - new Date(paidAt).getTime() < 60 * 60 * 1000;
    };
    const REFUND_DEADLINE_MS = 24 * 60 * 60 * 1000;
    const canRefundWithVideo = (order) => {
        if (!['terkirim', 'selesai'].includes(order.status)) return false;
        // Pesanan gratis mahasiswa tidak bisa dikomplain/refund
        if (order.isStudentDiscount && Number(order.totalAmount) === 0) return false;
        const arrivedAt = order.terkirimAt || order.completedAt || order.updatedAt;
        return Date.now() - new Date(arrivedAt).getTime() < REFUND_DEADLINE_MS;
    };

    const refundHoursLeft = (order) => {
    const arrivedAt = order.terkirimAt || order.completedAt || order.updatedAt;
    const elapsed = Date.now() - new Date(arrivedAt).getTime();
    const remaining = REFUND_DEADLINE_MS - elapsed;
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / (60 * 60 * 1000));
    };

    const selesaikanOrder = async (id) => {
        if (!window.confirm('Konfirmasi pesanan sudah diterima?')) return;
        try {
            await api.put(`/api/pharmacy/orders/${id}/selesai`);
            toast.success('Pesanan diselesaikan!'); fetchOrders();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal'); }
    };

    const bayarLagi = async (order) => {
        // Guard: pesanan gratis tidak perlu invoice Xendit
        // Gunakan Number() karena DECIMAL MySQL bisa kembali sebagai string "0.00"
        if (!order.totalAmount || Number(order.totalAmount) <= 0) {
            toast.info('Pesanan ini gratis, tidak perlu pembayaran.');
            return;
        }
        try {
            const res = await api.post('/api/xendit/create-invoice', { amount:Number(order.totalAmount), paymentType:'medicine', referenceId:order._id, description:`Obat ${order.orderNumber}` });
            window.location.href = res.data.invoiceUrl;
        } catch { toast.error('Gagal membuat link pembayaran'); }
    };

    const confirmFreeFromOrders = async (id) => {
        try {
            await api.put(`/api/pharmacy/orders/${id}/confirm-free`);
            toast.success('Pesanan dikonfirmasi! Sedang disiapkan.');
            fetchOrders(); fetchQuota();
        } catch (err) { toast.error(err.response?.data?.message || 'Gagal mengkonfirmasi'); }
    };

    const getStatusBadge = (status) => {
        const v = STATUS_CFG[status] || { bg:'#f1f5f9', color:'#475569', icon:FaBox, label:status };
        return <span style={{background:v.bg,color:v.color,padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,display:'inline-flex',alignItems:'center',gap:6}}><v.icon size={12}/>{v.label}</span>;
    };

    const GuestModal = () => (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', backdropFilter:'blur(4px)', zIndex:10001, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={() => setGuestModal(false)}>
            <div className="slide-up" onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:24, padding:'40px 32px', maxWidth:420, width:'100%', textAlign:'center', boxShadow:'0 25px 50px -12px rgba(0,0,0,.25)' }}>
                <div style={{ width:72, height:72, borderRadius:'50%', background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:32 }}>🔐</div>
                <h5 style={{ fontWeight:800, fontSize:22, color:'#0f172a', marginBottom:10 }}>Login Diperlukan</h5>
                <p style={{ color:'#64748b', fontSize:14, lineHeight:1.6, marginBottom:32 }}>Silakan login atau daftar untuk menambahkan obat ke keranjang dan melacak pesanan Anda.</p>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <button onClick={() => navigate('/login')} className="btn-p" style={{ width:'100%', justifyContent:'center', padding:'14px', fontSize:15 }}>Masuk ke Akun</button>
                    <button onClick={() => navigate('/register')} className="btn-o" style={{ width:'100%', justifyContent:'center', padding:'14px', fontSize:15 }}>Daftar Gratis</button>
                </div>
                <button onClick={() => setGuestModal(false)} style={{ marginTop:20, background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:13, fontWeight:500, transition:'color 0.2s' }} onMouseEnter={e=>e.target.style.color='#64748b'} onMouseLeave={e=>e.target.style.color='#94a3b8'}>Lanjut Lihat-lihat</button>
            </div>
        </div>
    );

    return (
        <div className="fade-in" style={{minHeight:'100vh',background:'#f8fafc',fontFamily:"'Poppins',sans-serif",paddingBottom:60}}>
            {guestModal && <GuestModal />}
            
            {/* CSS ANIMATIONS & MODERN STYLES */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
                * { font-family: 'Poppins', sans-serif !important; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .fade-in { animation: fadeIn 0.4s ease-out forwards; }
                .slide-up { animation: slideUp 0.5s ease-out forwards; }
                
                .ph-tab-container { display: inline-flex; background: #f1f5f9; padding: 6px; border-radius: 16px; margin-bottom: 24px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
                .ph-tab { padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; border: none; background: transparent; color: #64748b; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display:flex; alignItems:center; justify-content:center; gap:8px;}
                .ph-tab.active { background: #fff; color: #2563eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .ph-tab:hover:not(.active) { color: #334155; }

                .ph-card { background: #fff; border: 1px solid #f1f5f9; border-radius: 20px; overflow: hidden; height: 100%; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); display:flex; flex-direction:column; }
                .ph-card:hover { transform: translateY(-4px); box-shadow: 0 16px 20px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04); border-color: #e2e8f0; }
                
                .ph-input { width: 100%; padding: 14px 18px; border: 1px solid #e2e8f0; border-radius: 16px; font-size: 14px; font-family: inherit; outline: none; transition: all 0.2s; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.01); }
                .ph-input:focus { border-color: #2563eb; box-shadow: 0 0 0 4px rgba(37,99,235,0.1); }
                
                .btn-p { background: #2563eb; color: #fff; border: none; border-radius: 14px; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.2); }
                .btn-p:hover:not(:disabled) { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 6px 8px -1px rgba(37,99,235,0.3); }
                .btn-p:disabled { background: #94a3b8; cursor: not-allowed; box-shadow: none; opacity: 0.7; }
                
                .btn-o { background: #fff; border: 2px solid #e2e8f0; color: #475569; border-radius: 14px; padding: 11px 24px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .btn-o:hover:not(:disabled) { border-color: #cbd5e1; background: #f8fafc; color: #0f172a; }
                
                .btn-success { background: #16a34a; color: #fff; border: none; border-radius: 14px; padding: 12px 20px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition:all .2s; }
                .btn-success:hover { background: #15803d; box-shadow: 0 4px 6px -1px rgba(22,163,74,0.2); }
                
                .btn-danger-sm { background: #fff; border: 2px solid #fecaca; color: #ef4444; border-radius: 12px; padding: 8px 16px; font-size: 12px; font-weight: 600; cursor: pointer; transition:all .2s; }
                .btn-danger-sm:hover { background: #fef2f2; border-color: #f87171; }
                
                .delivery-opt { border: 2px solid #f1f5f9; background: #fff; border-radius: 16px; padding: 18px; cursor: pointer; transition: all 0.2s; margin-bottom: 12px; }
                .delivery-opt:hover { border-color: #e2e8f0; background: #f8fafc; }
                .delivery-opt.sel { border-color: #3b82f6; background: #eff6ff; box-shadow: 0 4px 12px rgba(59,130,246,0.1); }
                
                .rx-badge { background: #fef3c7; color: #b45309; border-radius: 6px; padding: 2px 6px; font-size: 9px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; }
                .free-badge { background: #ede9fe; color: #7c3aed; border-radius: 6px; padding: 2px 6px; font-size: 9px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; }
                
                .quota-bar { height: 8px; background: rgba(255,255,255,0.3); border-radius: 4px; overflow: hidden; margin-top: 8px; }
                .quota-fill { height: 100%; background: #fff; border-radius: 4px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
                
                .map-btn { display: flex; align-items: center; gap: 8px; padding: 14px 20px; background: #eff6ff; border: 2px dashed #93c5fd; border-radius: 16px; color: #2563eb; font-weight: 600; font-size: 14px; cursor: pointer; width: 100%; justify-content: center; transition: all .2s; }
                .map-btn:hover { background: #dbeafe; border-color: #60a5fa; }
                
                .order-card { background: #fff; border: 1px solid #f1f5f9; border-radius: 24px; padding: 28px; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.03); transition: transform 0.2s; }
                .order-card:hover { border-color:#e2e8f0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }

                /* CSS Animasi Gambar Grid */
                .img-container { background: #f8fafc; border-radius: 16px; overflow: hidden; position: relative; padding-top: 85%; margin: 8px 8px 0 8px; cursor: pointer; }
                .med-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; padding: 16px; mix-blend-mode: multiply; transition: transform 0.4s; }
                .med-img-fallback { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #cbd5e1; transition: transform 0.4s; }
                .ph-card:hover .med-img { transform: scale(1.08); }
                .ph-card:hover .med-img-fallback { transform: scale(1.08); }
                
                /* Harga Hitam & Tegas */
                .price-text { font-weight: 900; color: #000; font-size: 15px; letter-spacing: -0.3px; }
            `}</style>

            {showMap && <MapPickerModal onConfirm={handleMapConfirm} onClose={()=>setShowMap(false)}/>}

            {/* Upload Resep Modal */}
            {showRxUpload && (
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(4px)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={() => { setShowRxUpload(false); setRxFile(null); }}>
                    <div className="slide-up" onClick={e => e.stopPropagation()} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:480,padding:32,boxShadow:'0 25px 50px -12px rgba(0,0,0,.25)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
                            <h5 style={{fontWeight:800,marginBottom:0,fontSize:20}}><FaFileImage style={{color:'#f59e0b',marginRight:10}}/>Upload Resep Dokter</h5>
                            <button onClick={()=>{setShowRxUpload(false);setRxFile(null);}} style={{background:'#f1f5f9',border:'none',fontSize:20,width:36,height:36,borderRadius:'50%',cursor:'pointer',color:'#64748b',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                        </div>
                        <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:16,padding:'16px 20px',marginBottom:20,fontSize:14,color:'#92400e',lineHeight:1.6}}>
                            <FaInfoCircle style={{marginRight:8}}/>
                            <strong>Upload foto resep dokter</strong> yang jelas dan terbaca. Admin akan memverifikasi resep Anda sebelum pembayaran dapat dilakukan.
                        </div>
                        <input type="file" ref={rxInputRef} accept="image/*,.pdf" style={{display:'none'}} onChange={e=>setRxFile(e.target.files[0])}/>
                        <button onClick={()=>rxInputRef.current?.click()} style={{width:'100%',padding:'20px',border:'2px dashed #cbd5e1',borderRadius:16,background:'#f8fafc',color:'#475569',cursor:'pointer',fontSize:14,fontWeight:600,marginBottom:12,display:'flex',flexDirection:'column',alignItems:'center',gap:12,transition:'all .2s'}}>
                            <div style={{width:48,height:48,background:'#eff6ff',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}><FaUpload size={20} style={{color:'#2563eb'}}/></div>
                            {rxFile ? rxFile.name : 'Pilih File (JPG/PNG/PDF, maks 5MB)'}
                        </button>
                        {rxFile && <p style={{fontSize:13,color:'#16a34a',marginBottom:16,textAlign:'center',fontWeight:600}}>✅ Siap diupload: {rxFile.name}</p>}
                        <div style={{display:'flex',gap:12,marginTop:16}}>
                            <button className="btn-o" style={{flex:1}} onClick={()=>{setShowRxUpload(false);setRxFile(null);}}>Nanti Saja</button>
                            <button className="btn-p" style={{flex:1,justifyContent:'center'}} onClick={()=>handleUploadRx(rxOrderId)} disabled={!rxFile||uploadingRx}>
                                {uploadingRx?<><Spinner size="sm" animation="border"/> Mengupload...</>:<><FaUpload/> Upload Resep</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Container fluid style={{maxWidth:1140,margin:'0 auto',paddingTop:32}}>
                {/* Header Section */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:32,flexWrap:'wrap',gap:20}}>
                    <div style={{display:'flex',alignItems:'center',gap:16}}>
                        <div>
                            <h1 style={{fontSize:28,fontWeight:900,color:'#000',marginBottom:4, letterSpacing: '-0.5px'}}>Apotek Online</h1>
                            <p style={{fontSize:15,color:'#64748b',margin:0}}>Pesan obat aman, mudah, dan terpercaya</p>
                        </div>
                    </div>
                    
                    {isStudent && quota.isStudent && (
                        <div className="slide-up" style={{background:'linear-gradient(135deg, #8b5cf6, #6d28d9)',color:'#fff',borderRadius:20,padding:'16px 24px',minWidth:260,boxShadow:'0 10px 15px -3px rgba(109,40,217,0.3)'}}>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                                <div style={{display:'flex',alignItems:'center',gap:8}}>
                                    <div style={{background:'rgba(255,255,255,0.2)',padding:6,borderRadius:8}}><FaGraduationCap size={16}/></div>
                                    <span style={{fontWeight:700,fontSize:14}}>Kuota Gratis Mhs</span>
                                </div>
                                <span style={{fontWeight:800,fontSize:18}}>{quota.remaining}</span>
                            </div>
                            <div className="quota-bar"><div className="quota-fill" style={{width:`${Math.min(100,(quota.used/quota.max)*100)}%`}}/></div>
                            <p style={{fontSize:12,opacity:0.9,marginBottom:0,marginTop:6}}>{quota.used} dari {quota.max} pcs telah digunakan bulan ini</p>
                        </div>
                    )}
                </div>

                {/* Styled Tabs */}
                <div className="ph-tab-container">
                    <button className={`ph-tab ${activeTab==='shop'?'active':''}`} onClick={()=>setActiveTab('shop')}>
                        <FaPills size={14}/> Belanja Obat
                    </button>
                    {user && (
                        <button className={`ph-tab ${activeTab==='orders'?'active':''}`} onClick={()=> setActiveTab('orders')}>
                            <FaHistory size={14}/> Pesanan Saya 
                            {orders.filter(o=>['waiting_prescription','pending','paid','diproses','dikirim','siap_diambil'].includes(o.status)).length>0&&
                                <span style={{background:'#ef4444',color:'#fff',borderRadius:20,padding:'2px 8px',fontSize:11,fontWeight:700,marginLeft:8}}>
                                    {orders.filter(o=>['waiting_prescription','pending','paid','diproses','dikirim','siap_diambil'].includes(o.status)).length}
                                </span>
                            }
                        </button>
                    )}
                </div>

                {/* ─── SHOP ─────────────────────────────────────────────── */}
                {activeTab==='shop' && (
                    <div className="fade-in">
                        <Row className="g-3 mb-4">
                            <Col md={5}>
                                <div style={{position:'relative'}}>
                                    <FaSearch style={{position:'absolute',left:20,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',fontSize:16}}/>
                                    <input className="ph-input" style={{paddingLeft:50,borderRadius:20,backgroundColor:'#fff'}} type="text" placeholder="Cari obat, suplemen..." value={searchTerm} onChange={e=>{setSearchTerm(e.target.value);setCurrentPage(1);}}/>
                                </div>
                            </Col>
                            
                            <Col md={4}>
                                <div style={{position:'relative', height: '100%'}} tabIndex={0} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setCatOpen(false); }}>
                                    <div className="ph-input"
                                         onClick={() => setCatOpen(!catOpen)}
                                         style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:20, cursor:'pointer', backgroundColor:'#fff', paddingLeft:20, paddingRight:20, userSelect:'none', height: '100%'}}>
                                        <span style={{color: selectedCat ? '#0f172a' : '#64748b', fontWeight: selectedCat ? 700 : 500, fontSize: 14}}>
                                            {CATEGORIES.find(c=>c.value===selectedCat)?.label || 'Semua Kategori'}
                                        </span>
                                        <FaChevronDown size={12} color="#94a3b8" style={{transform: catOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}}/>
                                    </div>
                                    {catOpen && (
                                        <div className="slide-up" style={{position:'absolute', top:'100%', left:0, right:0, background:'#fff', borderRadius:16, marginTop:8, boxShadow:'0 10px 25px rgba(0,0,0,0.1)', zIndex:50, overflow:'hidden', border:'1px solid #f1f5f9'}}>
                                            {CATEGORIES.map(c => (
                                                <div key={c.value}
                                                     onClick={() => { setSelectedCat(c.value); setCurrentPage(1); setCatOpen(false); }}
                                                     style={{padding:'14px 20px', cursor:'pointer', fontSize:14, background: selectedCat === c.value ? '#eff6ff' : '#fff', color: selectedCat === c.value ? '#2563eb' : '#475569', fontWeight: selectedCat === c.value ? 700 : 500, transition:'background .2s'}}
                                                     onMouseEnter={e => { if(selectedCat !== c.value) e.target.style.background = '#f8fafc' }}
                                                     onMouseLeave={e => { if(selectedCat !== c.value) e.target.style.background = '#fff' }}>
                                                    {c.label}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Col>

                            <Col md={3}>
                                <button className="btn-p" style={{width:'100%', height:'100%', justifyContent:'center', borderRadius:20, padding:'14px', fontSize:15}} onClick={()=> !user ? setGuestModal(true) : setShowCart(true)}>
                                    <FaShoppingCart size={16}/> Keranjang
                                    {cart.length>0&&<span style={{background:'#ef4444',color:'#fff',borderRadius:20,padding:'2px 8px',fontSize:11,fontWeight:800,marginLeft:6}}>{cart.reduce((s,i)=>s+i.quantity,0)}</span>}
                                </button>
                            </Col>
                        </Row>

                        {cart.length>0 && cartHasRx && (
                            <div className="slide-up" style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:16,padding:'16px 20px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:12}}>
                                <div style={{background:'#fef3c7',padding:8,borderRadius:'50%'}}><FaExclamationTriangle size={16} style={{color:'#d97706'}}/></div>
                                <div style={{fontSize:14,color:'#92400e',lineHeight:1.6}}>
                                    <strong>Perhatian:</strong> Anda memiliki obat resep di keranjang. Selesaikan checkout untuk mengamankan pesanan, lalu upload resep dokter. Pembayaran diaktifkan setelah verifikasi admin.
                                </div>
                            </div>
                        )}

                        {loading ? (
                            <div style={{textAlign:'center',padding:'80px 0'}}>
                                <Spinner animation="border" style={{color:'#3b82f6',width:'3rem',height:'3rem',borderWidth:'0.25em'}}/>
                                <div style={{marginTop:16,color:'#64748b',fontWeight:500}}>Memuat katalog obat...</div>
                            </div>
                        ) : medicines.length===0 ? (
                            <div className="slide-up" style={{textAlign:'center',padding:'80px 0',background:'#fff',borderRadius:24,border:'1px dashed #cbd5e1'}}>
                                <FaBox size={56} style={{marginBottom:16,color:'#cbd5e1'}}/>
                                <h4 style={{fontWeight:700,color:'#475569'}}>Tidak Ditemukan</h4>
                                <p style={{color:'#94a3b8',fontSize:15}}>Coba gunakan kata kunci lain atau ubah kategori.</p>
                            </div>
                        ) : (
                            <>
                                <Row className="g-3">
                                    {medicines.map((med, index) => {
                                        const inCart = cart.find(i => i._id === med._id);
                                        return (
                                            <Col xl={3} lg={3} md={4} sm={6} xs={6} key={med._id}>
                                                <div className="ph-card slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
                                                    <div className="img-container" onClick={() => setSelectedMed(med)}>
                                                        <ProductImage src={med.image?resolveImg(med.image):null} alt={med.name} isActive={med.isActive} isGrid={true} />
                                                        {med.isActive===false&&(
                                                            <div style={{position:'absolute',inset:0,background:'rgba(248,250,252,.7)',backdropFilter:'blur(2px)',display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                                                                <span style={{background:'#000',color:'#fff',borderRadius:12,padding:'4px 10px',fontSize:10,fontWeight:900,letterSpacing:1}}>TDK TERSEDIA</span>
                                                            </div>
                                                        )}
                                                        {med.requiresPrescription&&<span style={{position:'absolute',top:8,right:8,background:'#f59e0b',color:'#fff',borderRadius:8,padding:'3px 8px',fontSize:9,fontWeight:800,boxShadow:'0 2px 4px rgba(245,158,11,0.3)'}}>Butuh Resep</span>}
                                                        {med.availableForStudentQuota&&<span style={{position:'absolute',top:8,left:8,background:'#8b5cf6',color:'#fff',borderRadius:8,padding:'3px 8px',fontSize:9,fontWeight:800,boxShadow:'0 2px 4px rgba(139,92,246,0.3)'}}><FaStar size={8} style={{marginRight:3,marginBottom:1}}/>Gratis Mhs</span>}
                                                    </div>
                                                    <div style={{padding:'14px 16px',flex:1,display:'flex',flexDirection:'column'}}>
                                                        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:6}}>
                                                            <span style={{background:'#f1f5f9',color:'#64748b',padding:'3px 8px',borderRadius:6,fontSize:9,fontWeight:600}}>{CATEGORIES.find(c=>c.value===med.category)?.label||med.category}</span>
                                                        </div>
                                                        <h6 style={{fontWeight:700,fontSize:13,marginBottom:2,color:'#0f172a',lineHeight:1.4}}>{med.name}</h6>
                                                        <p style={{fontSize:11,color:'#94a3b8',marginBottom:12,flex:1}}>{med.genericName||'\u00A0'}</p>
                                                        
                                                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginTop:'auto'}}>
                                                            <div>
                                                                {isStudent && med.availableForStudentQuota && quota.remaining>0 ? (
                                                                    <div style={{display:'flex',flexDirection:'column'}}>
                                                                        <span style={{textDecoration:'line-through',color:'#cbd5e1',fontSize:11}}>{fmt(med.price)}</span>
                                                                        <span className="price-text">Rp0 <span style={{fontSize:10}}>🎓</span></span>
                                                                    </div>
                                                                ) : <span className="price-text">{fmt(med.price)}</span>}
                                                            </div>
                                                            {inCart ? (
                                                                <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', background: '#f8fafc', borderRadius: 10, padding: 4, border: '1px solid #e2e8f0' }}>
                                                                    <button 
                                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); inCart.quantity <= 1 ? removeFromCart(med._id) : updateQuantity(med._id, inCart.quantity - 1); }} 
                                                                        style={{ width: 22, height: 22, border: 'none', borderRadius: 6, background: '#fff', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                                        <FaMinus size={9} />
                                                                    </button>
                                                                    <span style={{ width: 24, textAlign: 'center', fontSize: 13, fontWeight: 900, color: '#000' }}>{inCart.quantity}</span>
                                                                    <button 
                                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateQuantity(med._id, inCart.quantity + 1); }} 
                                                                        style={{ width: 22, height: 22, border: 'none', borderRadius: 6, background: '#fff', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                                        <FaPlus size={9} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    disabled={med.isActive === false}
                                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!user) { setGuestModal(true); return; } addToCart(med); }}
                                                                    style={{ position: 'relative', zIndex: 10, background: med.isActive === false ? '#f1f5f9' : '#000', color: med.isActive === false ? '#94a3b8' : '#fff', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: med.isActive === false ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: med.isActive === false ? 'none' : '0 4px 6px -1px rgba(0,0,0,0.2)' }}>
                                                                    <FaPlus size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Col>
                                        );
                                    })}
                                </Row>
                                
                                {totalPages>1&&(
                                    <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:40}}>
                                        <button style={{width:36,height:36,borderRadius:10,border:'2px solid #f1f5f9',background:'#fff',color:'#475569',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}} onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1}><FaChevronLeft size={10}/></button>
                                        {[...Array(totalPages)].map((_,i)=>(
                                            <button key={i} onClick={()=>setCurrentPage(i+1)} style={{width:36,height:36,borderRadius:10,border:'none',background:i+1===currentPage?'#000':'#fff',color:i+1===currentPage?'#fff':'#475569',fontWeight:700,fontSize:13,cursor:'pointer',transition:'all .2s',boxShadow:i+1===currentPage?'0 4px 10px rgba(0,0,0,0.3)':'inset 0 0 0 2px #f1f5f9'}}>
                                                {i+1}
                                            </button>
                                        ))}
                                        <button style={{width:36,height:36,borderRadius:10,border:'2px solid #f1f5f9',background:'#fff',color:'#475569',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}} onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages}><FaChevronRight size={10}/></button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ─── ORDERS ───────────────────────────────────────────── */}
                {activeTab==='orders'&&(
                    <div className="fade-in">
                        {/* ── Filter Status Bar ── */}
                        {!loadingOrders && orders.length > 0 && (
                            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:24}}>
                                {ORDER_FILTERS.map(f => {
                                    const count = f.value === 'all'
                                        ? orders.length
                                        : orders.filter(o => (FILTER_STATUS_MAP[f.value]||[]).includes(o.status)).length;
                                    if (f.value !== 'all' && count === 0) return null;
                                    return (
                                        <button key={f.value}
                                            onClick={() => setOrderFilter(f.value)}
                                            style={{
                                                padding:'8px 16px', borderRadius:12, fontSize:13, fontWeight:600,
                                                border: orderFilter === f.value ? 'none' : '2px solid #e2e8f0',
                                                background: orderFilter === f.value ? '#000' : '#fff',
                                                color: orderFilter === f.value ? '#fff' : '#475569',
                                                cursor:'pointer', transition:'all .2s',
                                                boxShadow: orderFilter === f.value ? '0 4px 10px rgba(0,0,0,0.2)' : 'none',
                                                display:'flex', alignItems:'center', gap:6,
                                            }}>
                                            {f.label}
                                            <span style={{
                                                background: orderFilter === f.value ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                                                color: orderFilter === f.value ? '#fff' : '#64748b',
                                                borderRadius:20, padding:'1px 7px', fontSize:11, fontWeight:800,
                                            }}>{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {(() => {
                            const filteredOrders = orderFilter === 'all'
                                ? orders
                                : orders.filter(o => (FILTER_STATUS_MAP[orderFilter]||[]).includes(o.status));
                            return loadingOrders ? (
                                <div style={{textAlign:'center',padding:'80px 0'}}><Spinner animation="border" style={{color:'#000'}}/><div style={{marginTop:16,color:'#64748b'}}>Memuat riwayat pesanan...</div></div>
                            ) : orders.length===0 ? (
                                <div className="slide-up" style={{textAlign:'center',padding:'80px 0',background:'#fff',borderRadius:24,border:'1px solid #f1f5f9',boxShadow:'0 4px 6px rgba(0,0,0,0.02)'}}>
                                    <div style={{width:80,height:80,background:'#f8fafc',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}><FaBox size={32} style={{color:'#cbd5e1'}}/></div>
                                    <h4 style={{fontWeight:700,color:'#0f172a'}}>Belum ada pesanan</h4>
                                    <p style={{color:'#64748b',marginBottom:24}}>Anda belum pernah melakukan pesanan obat.</p>
                                    <button className="btn-p" style={{padding:'12px 28px', background:'#000'}} onClick={()=>setActiveTab('shop')}>Mulai Belanja Sekarang</button>
                                </div>
                            ) : filteredOrders.length===0 ? (
                                <div className="slide-up" style={{textAlign:'center',padding:'60px 0',background:'#fff',borderRadius:24,border:'1px dashed #e2e8f0'}}>
                                    <FaBox size={40} style={{color:'#cbd5e1',marginBottom:12}}/>
                                    <h5 style={{fontWeight:700,color:'#475569'}}>Tidak ada pesanan</h5>
                                    <p style={{color:'#94a3b8',fontSize:14}}>Tidak ada pesanan dengan filter ini.</p>
                                    <button className="btn-o" style={{marginTop:8}} onClick={()=>setOrderFilter('all')}>Tampilkan Semua</button>
                                </div>
                            ) : filteredOrders.map((order, i)=>(
                                <div key={order._id} className="order-card slide-up" style={{animationDelay:`${i*0.05}s`}}>
                                    <div style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,paddingBottom:16,borderBottom:'1px dashed #e2e8f0'}}>
                                        <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}>
                                            <span style={{background:'#f8fafc',border:'1px solid #e2e8f0',padding:'6px 14px',borderRadius:12,fontSize:13,fontWeight:900,color:'#000',letterSpacing:0.5}}>{order.orderNumber}</span>
                                            {getStatusBadge(order.status)}
                                        </div>
                                        <div style={{display:'flex',gap:8,marginTop:{xs:10,md:0}}}>
                                            <span style={{background:order.deliveryMethod==='pickup'?'#ecfdf5':'#eff6ff',color:order.deliveryMethod==='pickup'?'#059669':'#2563eb',padding:'6px 14px',borderRadius:12,fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                                                {order.deliveryMethod==='pickup'?<><FaStore size={12}/> Pickup</>:<><FaTruck size={12}/> Diantar</>}
                                            </span>
                                        </div>
                                    </div>

                                    <Row>
                                        <Col md={7} lg={8}>
                                            <div style={{display:'flex',flexDirection:'column',gap:12}}>
                                                {order.items?.map((item,idx)=>(
                                                    <div key={idx} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                                        <div style={{display:'flex',alignItems:'center',gap:12}}>
                                                            <div style={{width:48,height:48,background:'#f8fafc',borderRadius:10,padding:6,border:'1px solid #f1f5f9'}}>
                                                                <ProductImage src={item.image?resolveImg(item.image):null} alt={item.name} isGrid={false} />
                                                            </div>
                                                            <div>
                                                                <div style={{fontWeight:700,fontSize:14,color:'#0f172a',marginBottom:2}}>
                                                                    {item.name}
                                                                    {item.requiresPrescription&&<span className="rx-badge" style={{marginLeft:8,padding:'2px 6px'}}><FaFileImage size={10}/></span>}
                                                                    {item.isFreeForStudent&&<span className="free-badge" style={{marginLeft:8,padding:'2px 6px'}}><FaStar size={10}/></span>}
                                                                </div>
                                                                <div style={{fontSize:13,color:'#64748b',fontWeight:500}}>{item.quantity} x <span style={{fontWeight:900, color:'#000'}}>{fmt(item.price)}</span></div>
                                                            </div>
                                                        </div>
                                                        <div style={{fontWeight:900,fontSize:14,color:'#000'}}>{item.isFreeForStudent ? 'Rp0' : fmt(item.subtotal)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div style={{marginTop:20,background:'#f8fafc',borderRadius:16,padding:16}}>
                                                <div style={{fontSize:13,color:'#475569',display:'flex',alignItems:'flex-start',gap:8,marginBottom:8}}>
                                                    <FaMotorcycle style={{marginTop:3,color:'#94a3b8'}}/>
                                                    <div>
                                                        <strong style={{color:'#000',fontWeight:800}}>Info Pengiriman:</strong><br/>
                                                        {order.deliveryMethod==='diantar' ? order.estimatedDelivery : 'Ambil di Apotek Klinik Pratama IPB'}
                                                    </div>
                                                </div>
                                                {order.shippingAddress?.address&&<div style={{fontSize:13,color:'#475569',display:'flex',alignItems:'flex-start',gap:8}}><FaMapMarkerAlt style={{marginTop:3,color:'#94a3b8'}}/><div><strong style={{color:'#000',fontWeight:800}}>Alamat:</strong><br/>{order.shippingAddress.address}{order.shippingAddress.detail&&`, ${order.shippingAddress.detail}`}</div></div>}
                                            </div>

                                            {order.requiresPrescription&&order.prescription&&(
                                                <div style={{marginTop:16,background:order.prescription.status==='approved'?'#ecfdf5':order.prescription.status==='rejected'?'#fef2f2':'#fffbeb',border:`1px solid ${order.prescription.status==='approved'?'#a7f3d0':order.prescription.status==='rejected'?'#fecaca':'#fde68a'}`,borderRadius:16,padding:'12px 16px',fontSize:13,display:'flex',alignItems:'flex-start',gap:10}}>
                                                    {order.prescription.status==='pending'&&<><div style={{background:'#fef3c7',padding:6,borderRadius:'50%'}}><FaClock size={14} style={{color:'#d97706'}}/></div><div style={{color:'#92400e',lineHeight:1.5}}><strong>Resep sedang diverifikasi.</strong><br/>Harap tunggu, admin akan segera mengecek resep Anda.</div></>}
                                                    {order.prescription.status==='approved'&&<><div style={{background:'#dcfce7',padding:6,borderRadius:'50%'}}><FaCheckCircle size={14} style={{color:'#16a34a'}}/></div><div style={{color:'#065f46',lineHeight:1.5}}><strong>Resep disetujui!</strong><br/>Silakan lanjutkan ke proses pembayaran.</div></>}
                                                    {order.prescription.status==='rejected'&&<><div style={{background:'#fee2e2',padding:6,borderRadius:'50%'}}><FaTimesCircle size={14} style={{color:'#dc2626'}}/></div><div style={{color:'#991b1b',lineHeight:1.5}}><strong>Resep ditolak.</strong><br/>Alasan: {order.prescription.rejectedReason}</div></>}
                                                </div>
                                            )}
                                        </Col>

                                        <Col md={5} lg={4} style={{display:'flex',flexDirection:'column',justifyContent:'space-between',borderLeft:'1px dashed #e2e8f0',paddingLeft:24,marginTop:{xs:20,md:0}}}>
                                            <div style={{textAlign:'right',marginBottom:24}}>
                                                <div style={{fontSize:13,color:'#64748b',marginBottom:4,fontWeight:600}}>Total Belanja</div>
                                                <div style={{fontSize:24,fontWeight:900,color:'#000',letterSpacing:-0.5}}>{fmt(order.totalAmount)}</div>
                                                {order.shippingCost>0&&<div style={{fontSize:12,color:'#94a3b8',marginTop:4,fontWeight:500}}>Termasuk Ongkir <span style={{color:'#000',fontWeight:800}}>{fmt(order.shippingCost)}</span></div>}
                                                {order.isStudentDiscount&&<div style={{fontSize:12,color:'#8b5cf6',marginTop:4,fontWeight:800}}><FaStar style={{marginRight:4}}/>Diskon Mhs Diterapkan</div>}
                                            </div>
                                            
                                            <div style={{display:'flex',flexDirection:'column',gap:10}}>
                                                {['waiting_prescription','prescription_rejected'].includes(order.status)&&(
                                                    <>
                                                        <button className="btn-p" style={{justifyContent:'center',padding:'12px', background:'#000'}} onClick={()=>{setRxOrderId(order._id);setShowRxUpload(true);}}>
                                                            <FaUpload size={14}/> Upload Ulang Resep
                                                        </button>
                                                        <button className="btn-danger-sm" style={{width:'100%',padding:'12px'}} onClick={()=>cancelOrder(order._id)}>Batalkan Pesanan</button>
                                                    </>
                                                )}

                                                {order.status==='pending'&&order.totalAmount>0&&(
                                                    <>
                                                        <button className="btn-p" style={{justifyContent:'center',padding:'12px',background:'#000'}} onClick={()=>bayarLagi(order)}>
                                                            <FaExternalLinkAlt size={14}/> Lanjut Bayar
                                                        </button>
                                                        <button className="btn-danger-sm" style={{width:'100%',padding:'12px'}} onClick={()=>cancelOrder(order._id)}>Batalkan Pesanan</button>
                                                    </>
                                                )}

                                                {order.status==='pending'&&order.totalAmount===0&&(
                                                    <button className="btn-success" style={{justifyContent:'center',padding:'12px'}} onClick={()=>confirmFreeFromOrders(order._id)}>
                                                        <FaCheckCircle size={14}/> Konfirmasi (Gratis)
                                                    </button>
                                                )}

                                                {order.status==='terkirim'&&(
                                                    <button className="btn-success" style={{justifyContent:'center',padding:'12px'}} onClick={()=>selesaikanOrder(order._id)}>
                                                        <FaCheckCircle size={14}/> Pesanan Diterima
                                                    </button>
                                                )}

                                                {canRefundInstant(order)&&(
                                                    <button className="btn-o" style={{color:'#dc2626',borderColor:'#fecaca',justifyContent:'center',display:'flex',alignItems:'center',gap:8}} onClick={()=>openRefundModal(order,'instant')}>
                                                        ↩️ Ajukan Refund
                                                    </button>
                                                )}

                                                {['terkirim', 'selesai'].includes(order.status) && !(order.isStudentDiscount && Number(order.totalAmount) === 0) && (
                                                    canRefundWithVideo(order) ? (
                                                        <button
                                                            className="btn-o"
                                                            style={{color:'#dc2626',borderColor:'#fecaca',justifyContent:'center',display:'flex',alignItems:'center',gap:8}}
                                                            onClick={()=>openRefundModal(order,'video')}
                                                        >
                                                            🎥 Komplain & Refund
                                                            <span style={{fontSize:10,background:'#fee2e2',color:'#b91c1c',borderRadius:6,padding:'2px 6px',fontWeight:700}}>
                                                                {refundHoursLeft(order)}j lagi
                                                            </span>
                                                        </button>
                                                    ) : (
                                                        <div style={{background:'#f1f5f9',borderRadius:12,padding:'10px 14px',fontSize:12,color:'#94a3b8',textAlign:'center',fontWeight:600}}>
                                                            ⏰ Batas komplain telah berakhir
                                                        </div>
                                                    )
                                                )}

                                                {['refund_requested','refund_rejected','refunded'].includes(order.status)&&(
                                                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                                                        {order.status==='refund_requested'&&(
                                                            <div style={{background:'#fffbeb',borderRadius:12,padding:'12px',fontSize:12,border:'1px solid #fcd34d',textAlign:'center',color:'#92400e',fontWeight:600}}>
                                                                ⏳ Refund sedang ditinjau admin. Mohon tunggu 1×24 jam.
                                                            </div>
                                                        )}
                                                        {order.status==='refund_rejected'&&(
                                                            <div style={{background:'#fef2f2',borderRadius:12,padding:'12px',fontSize:12,border:'1px solid #fecaca',textAlign:'center',color:'#b91c1c',fontWeight:600}}>
                                                                ❌ Refund Ditolak
                                                                {order.refundRejectReason&&<div style={{fontWeight:400,marginTop:4,fontStyle:'italic'}}>Alasan: {order.refundRejectReason}</div>}
                                                            </div>
                                                        )}
                                                        {order.status==='refunded'&&(
                                                            <div style={{background:'#f0fdf4',borderRadius:12,padding:'12px',fontSize:12,border:'1px solid #bbf7d0',textAlign:'center',color:'#166534',fontWeight:600}}>
                                                                ✅ Dana telah dikembalikan ke rekening Anda
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </Col>
                                    </Row>
                                </div>
                            ))
                        })()}
                    </div>
                )}

                {/* ─── REFUND MODAL ─────────────────────────────────────── */}
                {refundModal&&(
                    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(4px)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={() => setRefundModal(null)}>
                        <div className="slide-up" onClick={e => e.stopPropagation()} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:520,maxHeight:'75vh',overflowY:'auto',boxShadow:'0 25px 50px -12px rgba(0,0,0,.25)'}}>
                            <div style={{padding:'24px 32px',borderBottom:'1px solid #f1f5f9',position:'sticky',top:0,background:'#fff',zIndex:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                <h5 style={{fontWeight:800,fontSize:18,color:'#0f172a',margin:0}}>
                                    {refundModal.type==='instant' ? '↩️ Ajukan Refund' : '🎥 Komplain Barang'}
                                </h5>
                                <button onClick={()=>setRefundModal(null)} style={{background:'#f1f5f9',border:'none',fontSize:20,width:36,height:36,borderRadius:'50%',cursor:'pointer',color:'#64748b',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                            </div>
                            
                            <div style={{padding:'24px 32px'}}>
                                <div style={{background:refundModal.type==='instant'?'#eff6ff':'#fffbeb',border:`1px solid ${refundModal.type==='instant'?'#bfdbfe':'#fde68a'}`,borderRadius:16,padding:'16px 20px',fontSize:14,color:refundModal.type==='instant'?'#1e40af':'#92400e',marginBottom:24,lineHeight:1.6}}>
                                    {refundModal.type==='instant' ? (
                                        <><strong>Refund Langsung:</strong> Dana akan dikembalikan karena pesanan belum diproses. Biaya layanan payment gateway tidak termasuk dalam refund.</>
                                    ) : (
                                        <><strong>Komplain Bukti Video:</strong> Wajib melampirkan video unboxing (maks 50MB) yang jelas menunjukkan ketidaksesuaian barang. Biaya payment gateway tidak di-refund.</>
                                    )}
                                </div>

                                <div style={{background:'#f8fafc',borderRadius:16,padding:'16px 20px',marginBottom:24,border:'1px solid #f1f5f9'}}>
                                    <div style={{fontSize:12,color:'#64748b',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>Detail Pesanan</div>
                                    <div style={{fontSize:15,fontWeight:800,color:'#000'}}>{refundModal.order.orderNumber}</div>
                                    <div style={{fontSize:16,color:'#000',fontWeight:900,marginTop:4}}>{fmt(refundModal.order.totalAmount)}</div>
                                </div>

                                {refundModal.type==='video'&&(
                                    <div style={{marginBottom:24}}>
                                        <label style={{fontSize:13,fontWeight:800,color:'#000',display:'block',marginBottom:8}}>
                                            Upload Video Bukti <span style={{color:'#ef4444'}}>*</span>
                                        </label>
                                        <input ref={refundVideoRef} type="file" accept="video/*" style={{display:'none'}} onChange={e=>setRefundVideo(e.target.files?.[0]||null)} />
                                        <button onClick={()=>refundVideoRef.current?.click()} style={{width:'100%',padding:'16px',border:'2px dashed #cbd5e1',borderRadius:16,background:'#f8fafc',color:'#475569',fontSize:14,fontWeight:600,cursor:'pointer',transition:'all .2s'}}>
                                            {refundVideo ? `✅ ${refundVideo.name} (${(refundVideo.size/1024/1024).toFixed(1)}MB)` : '📁 Pilih Video (MP4/MOV, Maks 50MB)'}
                                        </button>
                                    </div>
                                )}

                                {/* Data rekening selalu tampil — sama seperti refund konsultasi */}
                                <div style={{marginBottom:24}}>
                                    <label style={{fontSize:13,fontWeight:800,color:'#000',display:'block',marginBottom:16}}>
                                        Rekening Tujuan Refund <span style={{color:'#ef4444'}}>*</span>
                                    </label>
                                    <div style={{display:'flex',flexDirection:'column',gap:12}}>
                                        <select className="ph-input" value={bankCode} onChange={e=>setBankCode(e.target.value)} style={{borderRadius:12}}>
                                            <option value="">— Pilih Bank —</option>
                                            {bankList.map(b=><option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
                                        </select>
                                        <input className="ph-input" value={accountNumber} onChange={e=>setAccountNumber(e.target.value.replace(/\D/g,''))} placeholder="Nomor Rekening" style={{borderRadius:12}} />
                                        <input className="ph-input" value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Nama Pemilik Rekening (sesuai buku tabungan)" style={{borderRadius:12}} />
                                    </div>
                                </div>

                                <div>
                                    <label style={{fontSize:13,fontWeight:800,color:'#000',display:'block',marginBottom:8}}>
                                        Alasan Lengkap <span style={{color:'#ef4444'}}>*</span>
                                    </label>
                                    <textarea className="ph-input" value={refundReason} onChange={e=>setRefundReason(e.target.value)} rows={4} placeholder={refundModal.type==='instant' ? 'Mengapa Anda membatalkan pesanan ini?' : 'Jelaskan apa yang kurang/rusak/salah...'} style={{borderRadius:16,resize:'none'}} />
                                </div>
                            </div>

                            <div style={{padding:'20px 32px',borderTop:'1px solid #f1f5f9',display:'flex',gap:12,background:'#f8fafc',borderBottomLeftRadius:24,borderBottomRightRadius:24}}>
                                <button onClick={()=>setRefundModal(null)} className="btn-o" style={{flex:1}}>Batal</button>
                                <button onClick={handleRefundSubmit} disabled={submittingRefund||(refundModal.type==='video'&&!refundVideo)||!refundReason.trim()||!bankCode||!accountNumber.trim()||!accountName.trim()} className="btn-p" style={{flex:2,justifyContent:'center',background:((refundModal.type==='video'&&!refundVideo)||!refundReason.trim()||!bankCode||!accountNumber.trim()||!accountName.trim())?'#94a3b8':'#dc2626'}}>
                                    {submittingRefund ? <><Spinner size="sm" animation="border"/> Memproses...</> : 'Kirim Pengajuan'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── CART MODAL ───────────────────────────────────────── */}
                {showCart&&(
                    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(4px)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={() => setShowCart(false)}>
                        <div className="slide-up" onClick={e => e.stopPropagation()} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:640,maxHeight:'85vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 25px 50px -12px rgba(0,0,0,.25)'}}>
                            <div style={{padding:'24px 32px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                <h5 style={{fontWeight:800,marginBottom:0,fontSize:20,display:'flex',alignItems:'center',gap:10}}><FaShoppingCart style={{color:'#000'}}/> Keranjang Belanja</h5>
                                <button onClick={()=>setShowCart(false)} style={{background:'#f1f5f9',border:'none',fontSize:20,width:36,height:36,borderRadius:'50%',cursor:'pointer',color:'#64748b',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                            </div>
                            
                            <div style={{padding:'24px 32px',overflowY:'auto',flex:1}}>
                                {cartHasRx&&(
                                    <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:16,padding:'16px 20px',marginBottom:24,fontSize:14,color:'#92400e',display:'flex',alignItems:'flex-start',gap:12,lineHeight:1.6}}>
                                        <FaExclamationTriangle size={18} style={{marginTop:2,flexShrink:0,color:'#d97706'}}/>
                                        <span><strong>Ada obat resep di keranjang.</strong> Anda perlu menyelesaikan checkout lalu mengupload foto resep. Pembayaran akan terbuka setelah admin menyetujui resep.</span>
                                    </div>
                                )}

                                {isStudent&&quota.isStudent&&quota.remaining>0&&(
                                    <div style={{background:'linear-gradient(135deg, #ede9fe, #ddd6fe)',borderRadius:16,padding:'16px 20px',marginBottom:24,fontSize:14,color:'#5b21b6',display:'flex',alignItems:'center',gap:12,fontWeight:600}}>
                                        <div style={{background:'#fff',padding:8,borderRadius:'50%',color:'#7c3aed'}}><FaGraduationCap size={16}/></div>
                                        <span>Kuota gratis tersisa: <strong style={{color:'#4c1d95'}}>{quota.remaining} pcs</strong> untuk obat bertanda 🎓</span>
                                    </div>
                                )}

                                {cart.length===0?(
                                    <div style={{textAlign:'center',padding:'60px 0'}}>
                                        <FaShoppingCart size={48} style={{color:'#cbd5e1',marginBottom:16}}/>
                                        <h5 style={{fontWeight:800,color:'#000'}}>Keranjang Masih Kosong</h5>
                                        <p style={{color:'#94a3b8',fontSize:15}}>Belum ada obat yang ditambahkan.</p>
                                    </div>
                                ) : (
                                    <div style={{display:'flex',flexDirection:'column',gap:16}}>
                                        {(()=>{
                                            // Hitung isFree per item dengan melacak kuota yang terpakai secara berurutan
                                            let usedInCart = 0;
                                            return cart.map(item=>{
                                            const freeQty = (isStudent && item.availableForStudentQuota && !item.requiresPrescription)
                                                ? Math.min(item.quantity, Math.max(0, quota.remaining - usedInCart))
                                                : 0;
                                            if (freeQty > 0) usedInCart += freeQty;
                                            const isFree = freeQty >= item.quantity;
                                            return (
                                                <div key={item._id} style={{display:'flex',alignItems:'center',padding:'16px',background:'#f8fafc',borderRadius:16,border:'1px solid #f1f5f9'}}>
                                                    <div style={{width:64,height:64,background:'#fff',borderRadius:12,padding:8,border:'1px solid #e2e8f0',marginRight:16}}>
                                                        <ProductImage src={item.image?resolveImg(item.image):null} alt={item.name} isGrid={false} />
                                                    </div>
                                                    <div style={{flex:1}}>
                                                        <div style={{fontWeight:700,fontSize:15,color:'#0f172a',marginBottom:4}}>{item.name} {item.requiresPrescription&&<span className="rx-badge" style={{verticalAlign:'middle'}}><FaFileImage size={8}/>Resep</span>}{isFree&&<span className="free-badge" style={{verticalAlign:'middle'}}><FaStar size={8}/>Gratis</span>}</div>
                                                        <div style={{fontSize:13,color:'#64748b',fontWeight:500}}>{isFree?<span style={{color:'#7c3aed',fontWeight:800}}>Rp0 (gratis mhs)</span>:<span style={{color:'#000',fontWeight:800}}>{fmt(item.price)}</span>} / pcs</div>
                                                    </div>
                                                    <div style={{display:'flex',alignItems:'center',gap:12,background:'#fff',padding:'6px 8px',borderRadius:12,border:'1px solid #e2e8f0'}}>
                                                        <button style={{width:28,height:28,borderRadius:8,background:'#f1f5f9',border:'none',color:'#000',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={(e)=>{e.stopPropagation(); updateQuantity(item._id,item.quantity-1)}}><FaMinus size={10}/></button>
                                                        <span style={{width:24,textAlign:'center',fontSize:14,fontWeight:900,color:'#000'}}>{item.quantity}</span>
                                                        <button style={{width:28,height:28,borderRadius:8,background:'#f1f5f9',border:'none',color:'#000',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={(e)=>{e.stopPropagation(); updateQuantity(item._id,item.quantity+1)}}><FaPlus size={10}/></button>
                                                    </div>
                                                    <div style={{marginLeft:24,textAlign:'right',minWidth:90}}>
                                                        <div style={{fontWeight:900,fontSize:16,color:isFree?'#7c3aed':'#000',marginBottom:4,letterSpacing:'-0.5px'}}>{isFree?'Rp0':fmt(item.price*item.quantity)}</div>
                                                        <button style={{background:'none',border:'none',color:'#ef4444',fontSize:12,fontWeight:700,cursor:'pointer',padding:0}} onClick={(e)=>{e.stopPropagation(); removeFromCart(item._id)}}>Hapus</button>
                                                    </div>
                                                </div>
                                            );
                                        });
                                        })()}
                                        <div style={{marginTop:8,padding:'20px 24px',background:'#eff6ff',borderRadius:16,display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid #bfdbfe'}}>
                                            <span style={{fontWeight:700,color:'#1e40af',fontSize:15}}>Subtotal Obat</span>
                                            <span style={{color:'#000',fontWeight:900,fontSize:20,letterSpacing:'-0.5px'}}>{fmt(cartSubtotal())}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div style={{padding:'20px 32px',borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff'}}>
                                {cart.length>0 ? (
                                    <button style={{background:'none',border:'none',color:'#ef4444',fontWeight:700,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',gap:8}} onClick={(e)=>{e.stopPropagation(); clearCart()}}><FaTrash/> Kosongkan</button>
                                ) : <div/>}
                                
                                <div style={{display:'flex',gap:12}}>
                                    <button className="btn-o" onClick={()=>setShowCart(false)}>Kembali</button>
                                    {cart.length>0&&(
                                        <button className="btn-p" style={{background:'#000'}} onClick={(e)=>{e.stopPropagation(); handleCheckoutClick()}}>
                                            {cartHasRx?<><FaFileImage size={14}/> Checkout & Resep</>:<><FaArrowRight size={14}/> Lanjut Checkout</>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── CHECKOUT MODAL ───────────────────────────────────── */}
                {showCheckout&&(
                    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(4px)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={() => setShowCheckout(false)}>
                        <div className="slide-up" onClick={e => e.stopPropagation()} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:680,maxHeight:'70vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 25px 50px -12px rgba(0,0,0,.25)'}}>
                            <div style={{padding:'24px 32px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff',zIndex:10}}>
                                <h5 style={{fontWeight:800,marginBottom:0,fontSize:20,display:'flex',alignItems:'center',gap:10}}><FaTruck style={{color:'#000'}}/> Selesaikan Pesanan</h5>
                                <button onClick={()=>setShowCheckout(false)} style={{background:'#f1f5f9',border:'none',fontSize:20,width:36,height:36,borderRadius:'50%',cursor:'pointer',color:'#64748b',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                            </div>
                            
                            <div style={{padding:'24px 32px',overflowY:'auto',flex:1}}>
                                <div style={{marginBottom:32}}>
                                    <h6 style={{fontWeight:800,marginBottom:16,fontSize:15,color:'#0f172a',display:'flex',alignItems:'center',gap:8}}><div style={{width:24,height:24,background:'#000',color:'#fff',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>1</div> Lokasi Pengiriman</h6>
                                    <button className="map-btn" style={{padding:'16px'}} onClick={(e)=>{e.stopPropagation(); setShowMap(true)}}>
                                        <FaMapMarkerAlt size={16}/> {selectedAddress ? 'Ubah Lokasi di Peta' : 'Pilih Lokasi di Peta'}
                                    </button>
                                    
                                    {selectedAddress&&(
                                        <div className="fade-in" style={{marginTop:16,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:16,padding:'16px 20px'}}>
                                            <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                                                <FaMapMarkerAlt style={{color:'#3b82f6',marginTop:4}}/>
                                                <div>
                                                    <p style={{fontSize:14,color:'#334155',margin:0,fontWeight:700,lineHeight:1.5}}>{selectedAddress.address}</p>
                                                    <div style={{marginTop:12}}>
                                                        <label style={{fontSize:12,fontWeight:700,color:'#64748b',marginBottom:6,display:'block',textTransform:'uppercase',letterSpacing:0.5}}>Detail Tambahan (Opsional)</label>
                                                        <input type="text" className="ph-input" placeholder="mis. Blok A2 No. 10, rumah pagar hitam" value={addressDetail} onChange={e=>setAddressDetail(e.target.value)} style={{borderRadius:12}}/>
                                                    </div>
                                                </div>
                                            </div>
                                            <button className="btn-p" style={{marginTop:16,width:'100%',justifyContent:'center',background:'#000'}} onClick={(e)=>{e.stopPropagation(); calculateShipping()}} disabled={loadingShipping}>
                                                {loadingShipping?<><Spinner size="sm" animation="border"/> Menghitung...</>:<><FaRoute/> Cek Opsi Pengiriman</>}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {shippingResult&&(
                                    <div className="fade-in" style={{marginBottom:32}}>
                                        <h6 style={{fontWeight:800,marginBottom:16,fontSize:15,color:'#0f172a',display:'flex',alignItems:'center',gap:8}}><div style={{width:24,height:24,background:'#000',color:'#fff',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>2</div> Pilih Pengiriman</h6>
                                        <div style={{background:shippingResult.canDeliver?'#ecfdf5':'#fffbeb',border:`1px solid ${shippingResult.canDeliver?'#a7f3d0':'#fde68a'}`,borderRadius:12,padding:'12px 16px',marginBottom:16,fontSize:14,color:shippingResult.canDeliver?'#065f46':'#92400e',display:'flex',alignItems:'center',gap:8,fontWeight:600}}>
                                            <FaInfoCircle/> {shippingResult.message}
                                        </div>
                                        
                                        <div style={{display:'flex',flexDirection:'column',gap:12}}>
                                            {shippingResult.options.map(opt=>(
                                                <div key={opt.method} className={`delivery-opt ${selectedDelivery?.method===opt.method?'sel':''}`} onClick={(e)=>{e.stopPropagation(); setSelectedDelivery(opt)}} style={{margin:0}}>
                                                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                                        <div style={{display:'flex',alignItems:'center',gap:16}}>
                                                            <div style={{width:48,height:48,borderRadius:14,background:opt.method==='diantar'?'#eff6ff':'#ecfdf5',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                                                {opt.method==='diantar'?<FaMotorcycle size={20} style={{color:'#2563eb'}}/>:<FaStore size={20} style={{color:'#16a34a'}}/>}
                                                            </div>
                                                            <div>
                                                                <div style={{fontWeight:800,fontSize:15,color:'#000',marginBottom:4}}>{opt.label}</div>
                                                                <div style={{fontSize:13,color:'#64748b',fontWeight:500}}>{opt.description}</div>
                                                            </div>
                                                        </div>
                                                        <div style={{fontWeight:900,color:opt.cost===0?'#16a34a':'#000',fontSize:18}}>{opt.cost===0?'Gratis':fmt(opt.cost)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {selectedDelivery?.method==='diantar'&&(
                                            <div className="fade-in" style={{marginTop:16,background:'#f8fafc',padding:'16px',borderRadius:16,border:'1px solid #e2e8f0'}}>
                                                <label style={{fontSize:13,fontWeight:800,color:'#000',marginBottom:8,display:'block'}}>Nomor WhatsApp Aktif <span style={{color:'#ef4444'}}>*</span></label>
                                                <input type="tel" className="ph-input" placeholder="mis. 08123456789" value={phone} onChange={e=>setPhone(e.target.value)} style={{borderRadius:12}}/>
                                                <p style={{fontSize:12,color:'#94a3b8',margin:'6px 0 0',fontWeight:500}}>Kurir akan menghubungi nomor ini saat pengiriman.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedDelivery&&(
                                    <div className="fade-in">
                                        <h6 style={{fontWeight:800,marginBottom:16,fontSize:15,color:'#0f172a',display:'flex',alignItems:'center',gap:8}}><div style={{width:24,height:24,background:'#000',color:'#fff',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>3</div> Ringkasan Pembayaran</h6>
                                        <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:20,padding:'24px'}}>
                                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:12,fontSize:14}}>
                                                <span style={{color:'#64748b',fontWeight:600}}>Total Harga Obat</span>
                                                <span style={{fontWeight:800,color:'#000'}}>{fmt(cartSubtotal())}</span>
                                            </div>
                                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16,fontSize:14}}>
                                                <span style={{color:'#64748b',fontWeight:600}}>Ongkos Kirim</span>
                                                <span style={{color:selectedDelivery.cost===0?'#16a34a':'#000',fontWeight:800}}>{selectedDelivery.cost===0?'Gratis':fmt(selectedDelivery.cost)}</span>
                                            </div>
                                            <div style={{borderTop:'1px dashed #cbd5e1',margin:'16px 0'}}/>
                                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                                <span style={{fontWeight:800,fontSize:16,color:'#0f172a'}}>Total Tagihan</span>
                                                <span style={{color:'#000',fontWeight:900,fontSize:24,letterSpacing:-0.5}}>{fmt(computedTotal())}</span>
                                            </div>
                                        </div>

                                        <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:12}}>
                                            {computedTotal()>0&&!cartHasRx&&(
                                                <div style={{background:'linear-gradient(135deg, #0f172a, #000)',color:'#fff',borderRadius:16,padding:'16px 20px',display:'flex',alignItems:'center',gap:16}}>
                                                    <div style={{background:'rgba(255,255,255,0.2)',padding:10,borderRadius:'50%'}}><FaLock size={20}/></div>
                                                    <div>
                                                        <div style={{fontWeight:800,fontSize:15,marginBottom:2}}>Pembayaran Aman via Xendit</div>
                                                        <div style={{opacity:.9,fontSize:13}}>Mendukung BCA, BNI, BRI, OVO, DANA, QRIS, dll.</div>
                                                    </div>
                                                </div>
                                            )}
                                            {cartHasRx&&(
                                                <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:16,padding:'16px 20px',color:'#92400e',display:'flex',alignItems:'center',gap:16}}>
                                                    <div style={{background:'#fef3c7',padding:10,borderRadius:'50%'}}><FaFileImage size={20} style={{color:'#d97706'}}/></div>
                                                    <div>
                                                        <div style={{fontWeight:800,fontSize:14,marginBottom:2}}>Tahap Upload Resep</div>
                                                        <div style={{fontSize:13,opacity:0.9}}>Pembayaran Xendit akan terbuka setelah admin memverifikasi resep.</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div style={{padding:'20px 32px',borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff',borderBottomLeftRadius:24,borderBottomRightRadius:24}}>
                                <span style={{fontSize:13,color:'#94a3b8',fontWeight:700}}>Klinik Pratama IPB</span>
                                <div style={{display:'flex',gap:12}}>
                                    <button className="btn-o" onClick={()=>setShowCheckout(false)}>Batal</button>
                                    <button className="btn-p" style={{background:'#000'}} onClick={(e)=>{e.stopPropagation(); createOrder()}} disabled={!selectedDelivery||(selectedDelivery?.method==='diantar'&&!phone.trim())||creatingOrder}>
                                        {creatingOrder?<><Spinner size="sm" animation="border"/> Memproses...</>
                                            :cartHasRx?'Lanjut Upload Resep'
                                            :computedTotal()>0?'Bayar Sekarang'
                                            :'Konfirmasi Pesanan'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── DETAIL OBAT MODAL (KECIL) ────────────────────────── */}
                {selectedMed&&(
                    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(4px)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={() => setSelectedMed(null)}>
                        <div className="slide-up" onClick={e => e.stopPropagation()} style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:360,overflow:'hidden',boxShadow:'0 25px 50px -12px rgba(0,0,0,.25)'}}>
                            <div style={{position:'relative',background:'#f8fafc',padding:'24px 20px 16px',textAlign:'center'}}>
                                <div style={{height: 120, display:'flex', alignItems:'center', justifyContent:'center'}}>
                                    <ProductImage src={selectedMed.image?resolveImg(selectedMed.image):null} alt={selectedMed.name} isGrid={false} />
                                </div>
                            </div>
                            
                            <div style={{padding:'20px 24px'}}>
                                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
                                    {selectedMed.requiresPrescription&&<span style={{background:'#fef3c7',color:'#b45309',padding:'3px 8px',borderRadius:6,fontSize:10,fontWeight:800}}><FaFileImage style={{marginRight:4}}/>Butuh Resep</span>}
                                    {selectedMed.availableForStudentQuota&&!selectedMed.requiresPrescription&&<span style={{background:'#ede9fe',color:'#7c3aed',padding:'3px 8px',borderRadius:6,fontSize:10,fontWeight:800}}><FaStar style={{marginRight:4}}/>Gratis Mhs</span>}
                                    <span style={{background:'#f1f5f9',color:'#64748b',padding:'3px 8px',borderRadius:6,fontSize:10,fontWeight:700}}>{CATEGORIES.find(c=>c.value===selectedMed.category)?.label||selectedMed.category}</span>
                                </div>
                                
                                <h4 style={{fontWeight:800,marginBottom:4,color:'#0f172a',fontSize:18,lineHeight:1.3}}>{selectedMed.name}</h4>
                                <p style={{fontSize:12,color:'#94a3b8',marginBottom:20}}>{selectedMed.genericName||'\u00A0'}</p>
                                
                                <div style={{background:'#f8fafc',borderRadius:12,padding:16,border:'1px solid #f1f5f9'}}>
                                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:13}}>
                                        <span style={{color:'#64748b',fontWeight:600}}>Harga / Satuan</span>
                                        <span style={{fontWeight:900,color:'#000'}}>{fmt(selectedMed.price)} / {selectedMed.unit||'pcs'}</span>
                                    </div>
                                    {selectedMed.description&&(
                                        <div style={{marginTop:8,paddingTop:12,borderTop:'1px dashed #cbd5e1',fontSize:12,color:'#475569',lineHeight:1.5}}>
                                            <strong style={{color:'#000',display:'block',marginBottom:4,fontWeight:800}}>Deskripsi:</strong>
                                            {selectedMed.description}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div style={{padding:'16px 24px',borderTop:'1px solid #f1f5f9',background:'#fff'}}>
                                <button className="btn-p" disabled={selectedMed.isActive===false}
                                    onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); if (!user) { setGuestModal(true); return; } addToCart(selectedMed); setSelectedMed(null); toast.success(`${selectedMed.name} ditambahkan`); }}
                                    style={{width:'100%',justifyContent:'center',padding:'14px',fontSize:14, background:'#000'}}>
                                    <FaShoppingCart size={14}/> {selectedMed.isActive===false?'Sedang Tidak Tersedia':'Tambahkan ke Keranjang'}
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