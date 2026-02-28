import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
    FaUserMd, FaUsers, FaCalendarCheck, FaClipboardList,
    FaFileMedical, FaPills, FaMoneyCheckAlt, FaChartBar,
    FaExclamationTriangle, FaCheckCircle, FaClock, FaArrowRight,
    FaBell, FaShieldAlt, FaDatabase, FaCog
} from 'react-icons/fa';

const HomeAdmin = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [pendingPayments, setPendingPayments] = useState(0);
    const [pendingSickLetters, setPendingSickLetters] = useState(0);
    const [loading, setLoading] = useState(true);
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        fetchStats();
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchStats = async () => {
        try {
            const res = await api.get('/api/admin/stats');
            setStats(res.data);
            setPendingPayments(res.data.pendingPayments || 0);
            setPendingSickLetters(res.data.pendingSickLetters || 0);
        } catch {
            // fallback silent
        } finally {
            setLoading(false);
        }
    };

    const greeting = () => {
        const h = time.getHours();
        if (h < 11) return 'Selamat Pagi';
        if (h < 15) return 'Selamat Siang';
        if (h < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    };

    const menuItems = [
        {
            icon: FaMoneyCheckAlt,
            label: 'Verifikasi Pembayaran',
            desc: 'Tinjau bukti transfer masuk',
            path: '/admin/verify-payments',
            accent: '#10b981',
            badge: pendingPayments,
            badgeLabel: 'menunggu'
        },
        {
            icon: FaFileMedical,
            label: 'Surat Sakit',
            desc: 'Terbitkan surat keterangan sakit',
            path: '/admin',
            accent: '#f59e0b',
            badge: pendingSickLetters,
            badgeLabel: 'draft'
        },
        {
            icon: FaUserMd,
            label: 'Kelola Dokter',
            desc: 'Tambah, edit & atur jadwal dokter',
            path: '/admin/doctors',
            accent: '#3b82f6',
        },
        {
            icon: FaUsers,
            label: 'Kelola Pengguna',
            desc: 'Manajemen akun pasien & staf',
            path: '/admin/users',
            accent: '#8b5cf6',
        },
        {
            icon: FaCalendarCheck,
            label: 'Janji Temu',
            desc: 'Konfirmasi & kelola appointment',
            path: '/admin/appointments',
            accent: '#06b6d4',
        },
        {
            icon: FaClipboardList,
            label: 'Konsultasi',
            desc: 'Pantau sesi konsultasi aktif',
            path: '/admin/consultations',
            accent: '#ec4899',
        },
        {
            icon: FaPills,
            label: 'Farmasi',
            desc: 'Stok obat & kelola pesanan',
            path: '/admin/pharmacy',
            accent: '#14b8a6',
        },
        {
            icon: FaChartBar,
            label: 'Transaksi',
            desc: 'Riwayat semua transaksi keuangan',
            path: '/admin',
            accent: '#f97316',
        },
    ];

    const statCards = stats ? [
        { label: 'Total Pasien', value: stats.totalPatients ?? '-', icon: FaUsers, color: '#3b82f6' },
        { label: 'Dokter Aktif', value: stats.totalDoctors ?? '-', icon: FaUserMd, color: '#10b981' },
        { label: 'Konsultasi Hari Ini', value: stats.todayConsultations ?? '-', icon: FaClipboardList, color: '#8b5cf6' },
        { label: 'Pendapatan Hari Ini', value: `Rp ${Number(stats.todayRevenue || 0).toLocaleString('id-ID')}`, icon: FaMoneyCheckAlt, color: '#f59e0b', wide: true },
    ] : [];

    return (
        <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                .admin-card { transition: transform 0.18s ease, box-shadow 0.18s ease; cursor: pointer; }
                .admin-card:hover { transform: translateY(-4px); box-shadow: 0 12px 28px rgba(0,0,0,0.12) !important; }
                .stat-card { border-radius: 16px; border: none; overflow: hidden; }
                .menu-card { border-radius: 14px; border: none; background: #fff; padding: 20px; }
                .badge-dot { position: absolute; top: -6px; right: -6px; background: #ef4444; color: #fff;
                    border-radius: 20px; font-size: 11px; font-weight: 700; padding: 2px 7px;
                    border: 2px solid #fff; white-space: nowrap; }
                .pulse { animation: pulse 2s infinite; }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
            `}</style>

            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #1e40af, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FaShieldAlt color="#fff" size={22} />
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 500 }}>{greeting()},</p>
                                <h2 style={{ margin: 0, fontWeight: 800, fontSize: 22, color: '#0f172a' }}>{user?.name}</h2>
                            </div>
                        </div>
                        <span style={{ fontSize: 12, color: '#94a3b8', background: '#f1f5f9', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                            Administrator Sistem
                        </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: -1 }}>
                            {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>
                            {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                </div>

                {/* Alert jika ada pending items */}
                {(pendingPayments > 0 || pendingSickLetters > 0) && (
                    <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 14, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #fcd34d' }}>
                        <FaBell color="#d97706" size={18} className="pulse" />
                        <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 700, color: '#92400e', fontSize: 14 }}>Perlu Perhatian: </span>
                            <span style={{ color: '#78350f', fontSize: 14 }}>
                                {pendingPayments > 0 && <>{pendingPayments} pembayaran menunggu verifikasi{pendingSickLetters > 0 ? ' · ' : ''}</>}
                                {pendingSickLetters > 0 && <>{pendingSickLetters} surat sakit perlu diterbitkan</>}
                            </span>
                        </div>
                        <button onClick={() => navigate('/admin/verify-payments')}
                            style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            Tinjau
                        </button>
                    </div>
                )}

                {/* Stat Cards */}
                {!loading && stats && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                        {statCards.map((s, i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${s.color}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</p>
                                        <p style={{ margin: '4px 0 0', fontSize: s.wide ? 18 : 26, fontWeight: 800, color: '#0f172a' }}>{s.value}</p>
                                    </div>
                                    <div style={{ width: 42, height: 42, borderRadius: 12, background: s.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <s.icon color={s.color} size={20} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Menu Grid */}
                <h3 style={{ fontWeight: 700, fontSize: 16, color: '#374151', marginBottom: 16 }}>Menu Administrasi</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
                    {menuItems.map((item, i) => (
                        <div key={i} className="admin-card menu-card" onClick={() => navigate(item.path)}
                            style={{ position: 'relative', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                            {item.badge > 0 && (
                                <span className="badge-dot">{item.badge} {item.badgeLabel}</span>
                            )}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: item.accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <item.icon color={item.accent} size={20} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 3 }}>{item.label}</div>
                                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>{item.desc}</div>
                                </div>
                                <FaArrowRight color="#cbd5e1" size={12} style={{ marginTop: 4, flexShrink: 0 }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer info */}
                <div style={{ marginTop: 32, padding: '16px 20px', background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FaDatabase color="#10b981" size={14} />
                        <span style={{ fontSize: 13, color: '#64748b' }}>Klinik Pratama IPB — Sistem Manajemen v1.0</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <button onClick={() => navigate('/admin')}
                            style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <FaCog size={13} /> Pengaturan Lanjut
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default HomeAdmin;
