import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import { Container, Spinner, Modal, Table, Button } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    FaMoneyBillWave, FaSearch, FaCheckCircle, FaTimesCircle,
    FaClock, FaEye, FaFileInvoice, FaHourglass, FaDownload,
    FaReceipt, FaFilter, FaChevronDown
} from 'react-icons/fa';

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const fmtRupiah = (n) => {
    const num = parseFloat(n);
    if (isNaN(num)) return 'Rp 0';
    return 'Rp' + num.toLocaleString('id-ID');
};

const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-';

const fmtDateFull = (d) => d
    ? new Date(d).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }) + ' WIB'
    : '-';

const getTypeLabel = (type) => {
    const map = {
        consultation : '🩺 Konsultasi',
        medicine     : '💊 Obat & Farmasi',
        order        : '💊 Obat & Farmasi',   // paymentType dari DB adalah 'order'
        appointment  : '📅 Janji Temu',
    };
    return map[type] || type;
};

/* Normalise payment method: extract the real channel name */
const fmtPaymentMethod = (method) => {
    if (!method) return 'Xendit';
    const m = method.toUpperCase();
    // VA banks
    const vaMatch = m.match(/(?:VA[_\s-]?)?(BCA|BNI|BRI|MANDIRI|PERMATA|CIMB|DANAMON|BTN|BSI|SAHABAT_SAMPOERNA)/);
    if (vaMatch) return vaMatch[1].replace('_', ' ') + ' Virtual Account';
    // E-wallets
    if (m.includes('OVO'))   return 'OVO';
    if (m.includes('DANA'))  return 'DANA';
    if (m.includes('GOPAY') || m.includes('GoPay')) return 'GoPay';
    if (m.includes('SHOPEEPAY') || m.includes('ShopeePay')) return 'ShopeePay';
    if (m.includes('LINKAJA')) return 'LinkAja';
    if (m.includes('ASTRAPAY')) return 'AstraPay';
    // QRIS
    if (m.includes('QRIS')) return 'QRIS';
    // Retail
    if (m.includes('ALFAMART')) return 'Alfamart';
    if (m.includes('INDOMARET')) return 'Indomaret';
    // Credit card
    if (m.includes('CREDIT') || m.includes('CARD')) return 'Kartu Kredit';
    // Fallback: capitalise first letter
    return method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
};

const STATUS_CFG = {
    paid      : { label: 'Berhasil',   color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' },
    pending   : { label: 'Menunggu',   color: '#b45309', bg: '#fef9c3', border: '#fde68a' },
    failed    : { label: 'Gagal',      color: '#b91c1c', bg: '#fee2e2', border: '#fecaca' },
    refunded  : { label: 'Direfund',   color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' },
    expired   : { label: 'Kedaluarsa', color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' },
};

const TYPE_ICON_BG = {
    consultation : { bg: '#eff6ff', icon: '🩺' },
    medicine     : { bg: '#f0fdf4', icon: '💊' },
    order        : { bg: '#f0fdf4', icon: '💊' },   // alias untuk 'medicine'
    appointment  : { bg: '#fdf4ff', icon: '📅' },
};

/* ─── Sub-components ─────────────────────────────────────────────────────────── */
const StatusPill = ({ status }) => {
    const cfg = STATUS_CFG[status] || { label: status, color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: cfg.bg, color: cfg.color,
            border: `1px solid ${cfg.border}`,
            borderRadius: 20, padding: '4px 12px',
            fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
            {cfg.label}
        </span>
    );
};

const TypeBadge = ({ type }) => {
    const cfg = TYPE_ICON_BG[type] || { bg: '#f3f4f6', icon: '📄' };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: cfg.bg, borderRadius: 10,
            padding: '4px 10px', fontSize: 12, fontWeight: 600, color: '#374151',
        }}>
            {getTypeLabel(type)}
        </span>
    );
};

/* ─── Custom Animated Dropdown Component ─────────────────────────────────────── */
const CustomDropdown = ({ value, options, onChange, icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label || 'Pilih...';

    return (
        <div ref={wrapperRef} style={{ position: 'relative', flexShrink: 0 }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: '#f8fafc', border: `1px solid ${isOpen ? '#cbd5e1' : '#e2e8f0'}`,
                    borderRadius: 10, padding: '9px 14px', fontSize: 13, color: '#374151',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    minWidth: 160, justifyContent: 'space-between',
                    boxShadow: isOpen ? '0 2px 8px rgba(0,0,0,0.04)' : 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {icon}
                    <span style={{ userSelect: 'none', fontWeight: 500 }}>{selectedLabel}</span>
                </div>
                <FaChevronDown 
                    size={10} 
                    style={{ 
                        color: '#94a3b8', 
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
                    }} 
                />
            </div>
            
            {isOpen && (
                <div className="custom-dropdown-menu">
                    {options.map(opt => (
                        <div 
                            key={opt.value} 
                            className={`custom-dropdown-item ${value === opt.value ? 'active' : ''}`} 
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ─── Main Component ─────────────────────────────────────────────────────────── */
const PaymentHistory = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [payments, setPayments]               = useState([]);
    const [loading, setLoading]                 = useState(true);
    const [search, setSearch]                   = useState('');
    const [filterStatus, setFilterStatus]       = useState('all');
    const [filterType, setFilterType]           = useState('all');
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [stats, setStats]                     = useState({ total: 0, paid: 0, pending: 0, totalAmount: 0 });

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const res  = await api.get('/api/xendit/history');
            const data = res.data.payments || [];
            setPayments(data);
            setStats({
                total      : data.length,
                paid       : data.filter(p => p.status === 'paid').length,
                pending    : data.filter(p => p.status === 'pending').length,
                // Total dibayar: hanya status 'paid' (bukan refunded)
                totalAmount: data.filter(p => p.status === 'paid')
                                 .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
            });
        } catch {
            toast.error('Gagal memuat riwayat pembayaran');
        } finally {
            setLoading(false);
        }
    }, []);

    /* ── CSV Export ─────────────────────────────────────────────────────────── */
    const exportCSV = () => {
        const rows = [
            ['ID Transaksi', 'Layanan', 'Dokter/Info', 'Metode Bayar', 'Jumlah (Rp)', 'Tanggal', 'Status'],
            ...filtered.map(p => [
                p.transactionId || '-',
                getTypeLabel(p.paymentType),
                p.doctorName ? `${p.doctorName}${p.doctorSpec ? ' · ' + p.doctorSpec : ''}` : '-',
                fmtPaymentMethod(p.paymentMethod),
                p.amount || 0,
                fmtDate(p.paidAt || p.createdAt),
                STATUS_CFG[p.status]?.label || p.status,
            ]),
        ];
        const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `riwayat-pembayaran-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('File CSV berhasil diunduh');
    };

    /* ── Filter ─────────────────────────────────────────────────────────────── */
    const filtered = payments.filter(p => {
        const q           = search.toLowerCase();
        const matchSearch = !search ||
            p.transactionId?.toLowerCase().includes(q) ||
            getTypeLabel(p.paymentType).toLowerCase().includes(q) ||
            p.doctorName?.toLowerCase().includes(q) ||
            fmtPaymentMethod(p.paymentMethod).toLowerCase().includes(q);
        const matchStatus = filterStatus === 'all' || p.status === filterStatus;
        // 'order' adalah alias DB untuk 'medicine'
        const normType    = p.paymentType === 'order' ? 'medicine' : p.paymentType;
        const matchType   = filterType   === 'all' || normType === filterType;
        return matchSearch && matchStatus && matchType;
    });

    /* ── Dropdown Options ───────────────────────────────────────────────────── */
    const statusOptions = [
        { value: 'all', label: 'Semua Status' },
        { value: 'paid', label: '✅ Berhasil' },
        { value: 'pending', label: '⏳ Menunggu' },
        { value: 'failed', label: '❌ Gagal' },
        { value: 'refunded', label: '↩️ Direfund' },
        { value: 'expired', label: '⛔ Kedaluarsa' },
    ];

    const typeOptions = [
        { value: 'all', label: 'Semua Layanan' },
        { value: 'consultation', label: '🩺 Konsultasi' },
        { value: 'medicine', label: '💊 Obat & Farmasi' },
    ];

    /* ── Loading ─────────────────────────────────────────────────────────────── */
    if (loading) return (
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <Spinner animation="border" style={{ color: '#2563eb', width: 40, height: 40 }} />
            <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Memuat riwayat pembayaran...</p>
        </div>
    );

    /* ── Inline styles ───────────────────────────────────────────────────────── */
    const S = {
        page      : { background: '#f8fafc', minHeight: '100vh', padding: '28px 0 60px' },
        wrap      : { maxWidth: 1100, margin: '0 auto', padding: '0 20px' },
        pageTitle : { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 2 },
        pageSub   : { fontSize: 13, color: '#94a3b8', marginBottom: 28 },

        // Stats
        statsGrid : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 16, marginBottom: 28 },
        statCard  : (accent) => ({
            background: '#fff',
            border: `1px solid #f1f5f9`,
            borderRadius: 16,
            padding: '20px 24px',
            display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            borderLeft: `4px solid ${accent}`,
        }),
        statIcon  : (bg) => ({
            width: 44, height: 44, borderRadius: 12,
            background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
        }),
        statVal   : { fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 },
        statLbl   : { fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 500 },

        // Toolbar (MENDAPATKAN Z-INDEX AGAR DROPDOWN TIDAK TERPOTONG)
        toolbar   : {
            position: 'relative', // FIX: Menjaga stacking context
            zIndex: 50,           // FIX: Pastikan lebih tinggi dari tabel
            background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9',
            padding: '16px 20px', marginBottom: 20,
            display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        },
        searchBox : {
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 10, padding: '9px 14px', flex: '1 1 220px', minWidth: 180,
        },
        searchInp : {
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, color: '#374151', width: '100%',
        },
        btnExport : {
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#0f172a', color: '#fff', border: 'none',
            borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', flexShrink: 0, transition: 'background .15s',
        },
        btnRefresh: {
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#fff', color: '#475569', border: '1px solid #e2e8f0',
            borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s ease',
        },
        countBadge: {
            marginLeft: 'auto', fontSize: 12, color: '#94a3b8', fontWeight: 500, flexShrink: 0,
        },

        // Table card
        tableCard : {
            position: 'relative', // FIX: Menjaga stacking context tabel
            zIndex: 10,           // FIX: Lebih rendah dari toolbar
            background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9',
            overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        },
        th        : {
            padding: '12px 16px', background: '#f8fafc',
            fontSize: 11, fontWeight: 700, color: '#94a3b8',
            textTransform: 'uppercase', letterSpacing: '.6px',
            borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap',
        },
        td        : {
            padding: '14px 16px', fontSize: 13, color: '#374151',
            borderBottom: '1px solid #f8fafc', verticalAlign: 'middle',
        },
        // Eye button
        btnEye    : {
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
            width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#475569', transition: 'all .15s',
        },
    };

    const STATS = [
        { label: 'Total Transaksi', value: stats.total,               accent: '#6366f1', iconBg: '#eef2ff', icon: '📄' },
        { label: 'Berhasil',        value: stats.paid,                accent: '#22c55e', iconBg: '#dcfce7', icon: '✅' },
        { label: 'Menunggu Bayar',  value: stats.pending,             accent: '#f59e0b', iconBg: '#fef9c3', icon: '⏳' },
        { label: 'Total Dibayar',   value: fmtRupiah(stats.totalAmount), accent: '#2563eb', iconBg: '#eff6ff', icon: '💰' },
    ];

    return (
        <div style={S.page}>
            <style>{`
                /* Animasi Fade In dan Slide Up untuk kotak di halaman */
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .animate-fade-up {
                    animation: fadeSlideUp 0.4s ease-out forwards;
                    opacity: 0;
                }

                /* Animasi khusus baris tabel (tanpa slide/translateY agar tidak muncul scrollbar mendadak) */
                @keyframes fadeInRow {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                .animate-fade-row {
                    animation: fadeInRow 0.4s ease-out forwards;
                    opacity: 0;
                }

                /* Animasi Menu Dropdown */
                .custom-dropdown-menu {
                    position: absolute;
                    top: calc(100% + 6px);
                    left: 0;
                    min-width: 100%;
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
                    padding: 8px;
                    z-index: 100; /* FIX: Z-index internal dropdown tertinggi */
                    animation: slideDownMenu 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    transform-origin: top center;
                }
                
                .custom-dropdown-item {
                    padding: 10px 14px;
                    font-size: 13px;
                    font-weight: 500;
                    color: #475569;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    white-space: nowrap;
                }

                .custom-dropdown-item:hover {
                    background: #f1f5f9;
                    color: #0f172a;
                }

                .custom-dropdown-item.active {
                    background: #eff6ff;
                    color: #2563eb;
                    font-weight: 600;
                }

                @keyframes slideDownMenu {
                    0% { opacity: 0; transform: scaleY(0.95) translateY(-5px); }
                    100% { opacity: 1; transform: scaleY(1) translateY(0); }
                }

                /* Styles Lainnya */
                .ph-row:hover td { background: #f8fafc !important; }
                .ph-eye:hover { background: #eff6ff !important; border-color: #bfdbfe !important; color: #2563eb !important; }
                .ph-export:hover { background: #1e293b !important; }
                .ph-refresh:hover { background: #f8fafc !important; border-color: #cbd5e1 !important;}
                @media (max-width: 640px) {
                    .ph-hide-sm { display: none !important; }
                }
            `}</style>

            <div style={S.wrap}>
                {/* ── Header ── */}
                <div className="animate-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💳</div>
                            <h4 style={S.pageTitle}>Riwayat Pembayaran</h4>
                        </div>
                        <p style={S.pageSub}>Semua transaksi pembayaran Anda</p>
                    </div>
                </div>

                {/* ── Stats ── */}
                <div style={S.statsGrid}>
                    {STATS.map((s, idx) => (
                        <div key={s.label} className="animate-fade-up" style={{ ...S.statCard(s.accent), animationDelay: `${idx * 0.1}s` }}>
                            <div style={S.statIcon(s.iconBg)}>{s.icon}</div>
                            <div>
                                <div style={S.statVal}>{s.value}</div>
                                <div style={S.statLbl}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Toolbar ── */}
                <div className="animate-fade-up" style={{ ...S.toolbar, animationDelay: '0.4s' }}>
                    {/* Search */}
                    <div style={S.searchBox}>
                        <FaSearch size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
                        <input
                            style={S.searchInp}
                            placeholder="Cari ID transaksi, layanan, atau dokter..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
                        )}
                    </div>

                    {/* Status filter (Custom Animated Dropdown) */}
                    <CustomDropdown 
                        value={filterStatus}
                        options={statusOptions}
                        onChange={setFilterStatus}
                        icon={<FaFilter size={11} style={{ color: '#94a3b8' }} />}
                    />

                    {/* Type filter (Custom Animated Dropdown) */}
                    <CustomDropdown 
                        value={filterType}
                        options={typeOptions}
                        onChange={setFilterType}
                    />

                    {/* Count */}
                    <span style={S.countBadge}>{filtered.length} transaksi</span>

                    {/* Refresh */}
                    <button className="ph-refresh" style={S.btnRefresh} onClick={fetchHistory}>
                        🔄 <span>Refresh</span>
                    </button>

                    {/* Export CSV */}
                    <button className="ph-export" style={S.btnExport} onClick={exportCSV} disabled={filtered.length === 0}>
                        <FaDownload size={12} />
                        Export CSV
                    </button>
                </div>

                {/* ── Table ── */}
                <div className="animate-fade-up" style={{ ...S.tableCard, animationDelay: '0.5s' }}>
                    {filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
                            <p style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>Tidak ada transaksi ditemukan</p>
                            <p style={{ fontSize: 13, margin: 0 }}>
                                {search || filterStatus !== 'all' || filterType !== 'all'
                                    ? 'Coba ubah filter pencarian Anda.'
                                    : 'Belum ada riwayat pembayaran.'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['ID Transaksi', 'Layanan', 'Metode Bayar', 'Jumlah', 'Tanggal', 'Status', 'Aksi'].map(h => (
                                            <th key={h} style={{ ...S.th, textAlign: h === 'Aksi' ? 'right' : 'left' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((p, i) => (
                                        <tr key={p._id || i} className="ph-row animate-fade-row" style={{ animationDelay: `${0.5 + (i * 0.05)}s` }}>
                                            {/* ID Transaksi */}
                                            <td style={S.td}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{
                                                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                                        background: TYPE_ICON_BG[p.paymentType]?.bg || '#f3f4f6',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                                                    }}>
                                                        {TYPE_ICON_BG[p.paymentType]?.icon || '📄'}
                                                    </div>
                                                    <code style={{ fontSize: 11, color: '#6b7280', background: '#f8fafc', padding: '2px 6px', borderRadius: 5, border: '1px solid #e5e7eb' }}>
                                                        {p.transactionId || '—'}
                                                    </code>
                                                </div>
                                            </td>

                                            {/* Layanan */}
                                            <td style={S.td}>
                                                <TypeBadge type={p.paymentType} />
                                                {p.doctorName && (
                                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                                        {p.doctorName}{p.doctorSpec && ` · ${p.doctorSpec}`}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Metode */}
                                            <td style={{ ...S.td }} className="ph-hide-sm">
                                                <span style={{
                                                    fontSize: 12, fontWeight: 600, color: '#475569',
                                                    background: '#f8fafc', border: '1px solid #e5e7eb',
                                                    borderRadius: 6, padding: '3px 9px',
                                                }}>
                                                    {fmtPaymentMethod(p.paymentMethod)}
                                                </span>
                                            </td>

                                            {/* Jumlah */}
                                            <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                                                <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                                                    {fmtRupiah(p.amount)}
                                                </span>
                                            </td>

                                            {/* Tanggal */}
                                            <td style={{ ...S.td, whiteSpace: 'nowrap' }} className="ph-hide-sm">
                                                <span style={{ fontSize: 12, color: '#6b7280' }}>
                                                    {fmtDate(p.paidAt || p.createdAt)}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td style={S.td}>
                                                <StatusPill status={p.status} />
                                            </td>

                                            {/* Aksi */}
                                            <td style={{ ...S.td, textAlign: 'right' }}>
                                                <button
                                                    className="ph-eye"
                                                    style={S.btnEye}
                                                    title="Lihat detail"
                                                    onClick={() => { setSelectedPayment(p); setShowDetailModal(true); }}
                                                >
                                                    <FaEye size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal Detail ── */}
            <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} centered size="md">
                <Modal.Header closeButton style={{ borderBottom: '1px solid #f1f5f9', padding: '20px 24px' }}>
                    <Modal.Title style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧾</div>
                        Detail Transaksi
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ padding: '0' }}>
                    {selectedPayment && (() => {
                        const cfg = STATUS_CFG[selectedPayment.status] || STATUS_CFG.expired;
                        return (
                            <>
                                {/* Status banner */}
                                <div style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <StatusPill status={selectedPayment.status} />
                                    <span style={{ fontSize: 13, color: cfg.color, fontWeight: 500 }}>
                                        {selectedPayment.status === 'paid'    && 'Pembayaran berhasil dikonfirmasi'}
                                        {selectedPayment.status === 'pending' && 'Menunggu konfirmasi pembayaran'}
                                        {selectedPayment.status === 'failed'  && 'Pembayaran tidak berhasil diproses'}
                                        {selectedPayment.status === 'refunded'&& 'Dana telah dikembalikan ke Anda'}
                                        {selectedPayment.status === 'expired' && 'Batas waktu pembayaran telah lewat'}
                                    </span>
                                </div>

                                {/* Detail rows */}
                                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                                    {[
                                        { label: 'ID Transaksi',   value: <code style={{ fontSize: 12, background: '#f8fafc', padding: '2px 8px', borderRadius: 5, border: '1px solid #e5e7eb', color: '#374151' }}>{selectedPayment.transactionId || '—'}</code> },
                                        { label: 'Layanan',        value: <TypeBadge type={selectedPayment.paymentType} /> },
                                        selectedPayment.doctorName ? { label: 'Dokter / Info', value: <span style={{ fontWeight: 600 }}>{selectedPayment.doctorName}{selectedPayment.doctorSpec && ` · ${selectedPayment.doctorSpec}`}</span> } : null,
                                        { label: 'Metode Bayar',   value: <span style={{ fontWeight: 600 }}>{fmtPaymentMethod(selectedPayment.paymentMethod)}</span> },
                                        { label: 'Jumlah',         value: <span style={{ fontWeight: 800, fontSize: 18, color: '#0f172a' }}>{fmtRupiah(selectedPayment.amount)}</span> },
                                        { label: 'Tanggal',        value: fmtDateFull(selectedPayment.paidAt || selectedPayment.createdAt) },
                                    ].filter(Boolean).map((row, i, arr) => (
                                        <div key={row.label} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '12px 0',
                                            borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none',
                                        }}>
                                            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, flexShrink: 0, marginRight: 16 }}>{row.label}</span>
                                            <span style={{ fontSize: 13, color: '#374151', textAlign: 'right' }}>{row.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        );
                    })()}
                </Modal.Body>
                <Modal.Footer style={{ borderTop: '1px solid #f1f5f9', padding: '14px 24px' }}>
                    <button
                        onClick={() => setShowDetailModal(false)}
                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 20px', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                    >
                        Tutup
                    </button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default PaymentHistory;