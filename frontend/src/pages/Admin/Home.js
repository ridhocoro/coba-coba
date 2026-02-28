import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

const COLORS = {
  bg: '#0f172a',
  surface: '#1e293b',
  surfaceHover: '#263347',
  border: '#334155',
  accent: '#38bdf8',
  accentGreen: '#34d399',
  accentAmber: '#fbbf24',
  accentRed: '#f87171',
  accentPurple: '#a78bfa',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textDim: '#64748b',
};

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
        { icon: '💳', label: 'Verifikasi Pembayaran', desc: 'Tinjau bukti transfer masuk', path: '/admin/verify-payments', badge: pendingPayments, badgeColor: COLORS.accentRed },
        { icon: '📋', label: 'Janji Temu', desc: 'Kelola & konfirmasi booking', path: '/admin/appointments', badgeColor: COLORS.accentAmber },
        { icon: '💬', label: 'Konsultasi', desc: 'Pantau sesi aktif', path: '/admin/consultations', badgeColor: COLORS.accentGreen },
        { icon: '🧾', label: 'Surat Sakit', desc: 'Terbitkan surat keterangan', path: '/admin', badge: stats?.pendingSickLetters, badgeColor: COLORS.accentAmber },
      ]
    },
    {
      label: 'Manajemen Data',
      items: [
        { icon: '👨‍⚕️', label: 'Kelola Dokter', desc: 'Tambah, edit & jadwal dokter', path: '/admin/doctors', badgeColor: COLORS.accent },
        { icon: '👥', label: 'Kelola Pengguna', desc: 'Manajemen akun & status', path: '/admin/users', badgeColor: COLORS.accentPurple },
        { icon: '💊', label: 'Farmasi', desc: 'Stok obat & pesanan', path: '/admin/pharmacy', badgeColor: COLORS.accentGreen },
        { icon: '📊', label: 'Laporan', desc: 'Statistik & ringkasan sistem', path: '/admin', badgeColor: COLORS.accent },
      ]
    }
  ];

  const statCards = [
    { label: 'Total Pasien', value: stats?.totalPatients ?? '—', icon: '👥', color: COLORS.accent, sub: 'terdaftar' },
    { label: 'Dokter Aktif', value: stats?.totalDoctors ?? '—', icon: '👨‍⚕️', color: COLORS.accentGreen, sub: 'berpraktek' },
    { label: 'Konsultasi Hari Ini', value: stats?.todayConsultations ?? '—', icon: '💬', color: COLORS.accentPurple, sub: 'sesi' },
    { label: 'Surat Sakit Draft', value: stats?.pendingSickLetters ?? '—', icon: '🧾', color: COLORS.accentAmber, sub: 'perlu diterbitkan' },
    { label: 'Pembayaran Pending', value: pendingPayments ?? '—', icon: '💳', color: COLORS.accentRed, sub: 'perlu diverifikasi', urgent: pendingPayments > 0 },
    { label: 'Pendapatan Hari Ini', value: stats ? `Rp ${Number(stats.todayRevenue || 0).toLocaleString('id-ID')}` : '—', icon: '💰', color: COLORS.accentGreen, sub: 'terverifikasi' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: COLORS.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .ah-card { transition: background 0.15s, transform 0.15s, box-shadow 0.15s; }
        .ah-card:hover { background: ${COLORS.surfaceHover} !important; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important; }
        .ah-menu { transition: background 0.15s, transform 0.15s; cursor: pointer; }
        .ah-menu:hover { background: ${COLORS.surfaceHover} !important; transform: translateY(-2px); }
        .ah-btn { transition: opacity 0.15s, transform 0.12s; cursor: pointer; }
        .ah-btn:hover { opacity: 0.85; transform: scale(0.98); }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
        .urgent-dot { animation: pulse-dot 1.5s infinite; }
      `}</style>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '36px 24px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #1d4ed8, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 0 20px rgba(56,189,248,0.25)' }}>
              🛡️
            </div>
            <div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, fontWeight: 500, marginBottom: 2 }}>{greeting()},</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{user?.name}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#1e3a5f', borderRadius: 20, padding: '2px 10px', marginTop: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS.accentGreen }} className="urgent-dot" />
                <span style={{ fontSize: 11, color: COLORS.accentGreen, fontWeight: 600 }}>Administrator Aktif</span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
              {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ fontSize: 13, color: COLORS.textMuted }}>
              {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <button className="ah-btn" onClick={fetchStats} style={{ marginTop: 8, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '5px 14px', fontSize: 12, color: COLORS.textMuted, fontFamily: 'inherit' }}>
              ↻ Refresh Data
            </button>
          </div>
        </div>

        {/* ── Alert Urgent ── */}
        {(pendingPayments > 0 || (stats?.pendingSickLetters > 0)) && (
          <div style={{ background: 'linear-gradient(135deg, #451a03, #78350f)', border: '1px solid #92400e', borderRadius: 14, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18 }}>🔔</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, color: '#fcd34d', fontSize: 14 }}>Perlu Tindakan: </span>
              <span style={{ color: '#fde68a', fontSize: 14 }}>
                {pendingPayments > 0 && `${pendingPayments} pembayaran menunggu verifikasi`}
                {pendingPayments > 0 && stats?.pendingSickLetters > 0 && ' · '}
                {stats?.pendingSickLetters > 0 && `${stats.pendingSickLetters} surat sakit draft`}
              </span>
            </div>
            <button className="ah-btn" onClick={() => navigate('/admin/verify-payments')}
              style={{ background: '#d97706', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: 'inherit' }}>
              Verifikasi Sekarang →
            </button>
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 36 }}>
          {statCards.map((s, i) => (
            <div key={i} className={`ah-card ${s.urgent ? 'urgent-dot' : ''}`}
              style={{ background: COLORS.surface, borderRadius: 14, padding: '18px 16px', border: `1px solid ${s.urgent ? COLORS.accentRed + '60' : COLORS.border}`, boxShadow: s.urgent ? `0 0 16px ${COLORS.accentRed}25` : 'none', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 22, opacity: 0.2 }}>{s.icon}</div>
              <div style={{ fontSize: 11, color: COLORS.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: loading ? 18 : 26, fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: 4 }}>
                {loading ? '…' : s.value}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textDim }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Menu Groups ── */}
        {menuGroups.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: COLORS.textDim, marginBottom: 12, paddingLeft: 4 }}>
              {group.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {group.items.map((item, ii) => (
                <div key={ii} className="ah-menu" onClick={() => navigate(item.path)}
                  style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
                  {item.badge > 0 && (
                    <span style={{ position: 'absolute', top: 12, right: 14, background: item.badgeColor, color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '2px 8px', minWidth: 24, textAlign: 'center' }}>
                      {item.badge}
                    </span>
                  )}
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text, marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: COLORS.textDim }}>{item.desc}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', color: COLORS.textDim, fontSize: 18, flexShrink: 0 }}>›</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── Footer ── */}
        <div style={{ marginTop: 8, padding: '16px 20px', background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 12, color: COLORS.textDim }}>🏥 Klinik Pratama IPB — Sistem Manajemen v1.0</span>
          <span style={{ fontSize: 12, color: COLORS.textDim }}>Login sebagai: <strong style={{ color: COLORS.textMuted }}>{user?.email}</strong></span>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;
