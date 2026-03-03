import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

const AdminHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, payRes] = await Promise.allSettled([
        api.get('/api/admin/stats'),
        api.get('/api/admin/payments/stats'),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (payRes.status === 'fulfilled') setPendingPayments(payRes.value.data.stats?.pending || 0);
    } catch {/* silent */} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const greeting = () => {
    const h = time.getHours();
    if (h < 11) return 'Selamat Pagi';
    if (h < 15) return 'Selamat Siang';
    if (h < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const menuGroups = [
    {
      label: 'Operasional',
      items: [
        { icon: '💳', label: 'Verifikasi Pembayaran', desc: 'Tinjau bukti transfer masuk', path: '/admin/verify-payments', badge: pendingPayments },
        { icon: '📋', label: 'Janji Temu', desc: 'Kelola & konfirmasi booking', path: '/admin/appointments' },
        { icon: '💬', label: 'Konsultasi', desc: 'Pantau sesi aktif', path: '/admin/consultations' },
        { icon: '🧾', label: 'Surat Sakit', desc: 'Terbitkan surat keterangan', path: '/admin', badge: stats?.pendingSickLetters },
      ]
    },
    {
      label: 'Manajemen Data',
      items: [
        { icon: '👨‍⚕️', label: 'Kelola Dokter', desc: 'Tambah, edit & jadwal dokter', path: '/admin/doctors' },
        { icon: '👥', label: 'Kelola Pengguna', desc: 'Manajemen akun & status', path: '/admin/users' },
        { icon: '💊', label: 'Farmasi', desc: 'Stok obat & pesanan', path: '/admin/pharmacy' },
        { icon: '📊', label: 'Laporan', desc: 'Statistik & ringkasan sistem', path: '/admin/reports' },
      ]
    }
  ];

  const statCards = [
    { label: 'Total Pasien', value: stats?.totalPatients ?? '—', icon: '👥', sub: 'terdaftar' },
    { label: 'Dokter Aktif', value: stats?.totalDoctors ?? '—', icon: '👨‍⚕️', sub: 'berpraktek' },
    { label: 'Konsultasi Hari Ini', value: stats?.todayConsultations ?? '—', icon: '💬', sub: 'sesi' },
    { label: 'Surat Sakit', value: stats?.pendingSickLetters ?? '—', icon: '🧾', sub: 'perlu diterbitkan' },
    { label: 'Pembayaran', value: pendingPayments ?? '—', icon: '💳', sub: 'perlu diverifikasi' },
    { label: 'Pendapatan', value: stats ? `Rp ${Number(stats.todayRevenue || 0).toLocaleString('id-ID')}` : '—', icon: '💰', sub: 'hari ini' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: '#0f172a' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .stat-card {
          transition: all 0.2s ease;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px -4px rgba(0,0,0,0.05);
        }
        .menu-card {
          transition: all 0.2s ease;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
        }
        .menu-card:hover {
          background: #f8fafc;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }
        .badge {
          background: #f1f5f9;
          color: #475569;
          border-radius: 20px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 600;
        }
        .badge-warning {
          background: #fef3c7;
          color: #b45309;
        }
        .btn-refresh {
          transition: all 0.2s ease;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 12px;
          color: #475569;
          cursor: pointer;
        }
        .btn-refresh:hover {
          background: #f8fafc;
        }
        .alert-banner {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-radius: 12px;
          padding: 14px 20px;
        }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>{greeting()},</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#0f172a' }}>{user?.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: 12, color: '#475569' }}>Administrator</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
              {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <button className="btn-refresh" onClick={fetchStats} style={{ marginTop: 10 }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Alert Banner */}
        {(pendingPayments > 0 || stats?.pendingSickLetters > 0) && (
          <div className="alert-banner" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#b45309' }}>●</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 500, color: '#b45309' }}>Perlu Tindakan: </span>
                <span style={{ color: '#92400e' }}>
                  {pendingPayments > 0 && `${pendingPayments} pembayaran menunggu verifikasi`}
                  {pendingPayments > 0 && stats?.pendingSickLetters > 0 && ' • '}
                  {stats?.pendingSickLetters > 0 && `${stats.pendingSickLetters} surat sakit draft`}
                </span>
              </div>
              <button 
                onClick={() => navigate('/admin/verify-payments')}
                style={{ background: '#b45309', border: 'none', borderRadius: 8, padding: '6px 16px', fontSize: 13, color: '#fff', cursor: 'pointer' }}
              >
                Verifikasi
              </button>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b', marginBottom: 12 }}>
            Statistik Hari Ini
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {statCards.map((s, i) => (
              <div key={i} className="stat-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>{s.label}</span>
                  <span style={{ fontSize: 20, opacity: 0.5 }}>{s.icon}</span>
                </div>
                <div style={{ fontSize: loading ? 18 : 24, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                  {loading ? '…' : s.value}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Menu Groups */}
        {menuGroups.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b', marginBottom: 12 }}>
              {group.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {group.items.map((item, ii) => (
                <div key={ii} className="menu-card" onClick={() => navigate(item.path)} style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500, color: '#0f172a', fontSize: 14 }}>{item.label}</span>
                        {item.badge > 0 && (
                          <span className="badge badge-warning">{item.badge}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{item.desc}</div>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: 14 }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div style={{ marginTop: 40, padding: '16px 0', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Klinik Pratama IPB — Admin Panel</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{user?.email}</span>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;