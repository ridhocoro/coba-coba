// Admin/Dashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { fmtDoctorName } from '../../utils/format';

const fmt = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const fmtNum = n => Number(n || 0).toLocaleString('id-ID');

const Card = ({ children, style = {} }) => (
  <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, ...style }}>
    {children}
  </div>
);

const StatBox = ({ label, value, icon, color = '#2563eb', onClick, clickable, loading }) => (
  <div onClick={onClick} style={{
    background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 18px',
    cursor: clickable ? 'pointer' : 'default',
    transition: 'all .15s',
    borderLeft: `4px solid ${color}`,
  }}
    onMouseEnter={e => { if (clickable) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>
          {loading ? <span style={{ fontSize: 18 }}>⏳</span> : value}
        </div>
      </div>
      <span style={{ fontSize: 28 }}>{icon}</span>
    </div>
    {clickable && !loading && <div style={{ fontSize: 11, color: color, marginTop: 8, fontWeight: 600 }}>Klik untuk lihat →</div>}
  </div>
);

const PERIOD_OPTS = [
  { v: 'today', l: 'Hari Ini' },
  { v: '7d',   l: '7 Hari' },
  { v: '30d',  l: '30 Hari' },
  { v: 'custom', l: 'Pilih Tanggal' },
];

const AdminDashboard = ({ onNavigate }) => {
  const [ops, setOps]       = useState(null);
  const [fin, setFin]       = useState(null);
  const [growth, setGrowth] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = period === 'custom' 
        ? `period=custom&from=${from}&to=${to}` 
        : `period=${period}`;
      
      // Fetch all three endpoints in parallel
      const [opsR, finR, grwR] = await Promise.allSettled([
        api.get('/api/admin/analytics/operational'),
        api.get(`/api/admin/analytics/financial?${params}`),
        api.get(`/api/admin/analytics/growth?${params}`),
      ]);
      
      // Handle Operational Data
      if (opsR.status === 'fulfilled' && opsR.value?.data) {
        setOps(opsR.value.data);
      } else {
        console.error('Operational analytics error:', opsR.reason?.response?.data || opsR.reason?.message);
        setOps(null);
      }
      
      // Handle Financial Data
      if (finR.status === 'fulfilled' && finR.value?.data) {
        setFin(finR.value.data);
      } else {
        console.error('Financial analytics error:', finR.reason?.response?.data || finR.reason?.message);
        setFin(null);
      }
      
      // Handle Growth Data
      if (grwR.status === 'fulfilled' && grwR.value?.data) {
        setGrowth(grwR.value.data);
      } else {
        console.error('Growth analytics error:', grwR.reason?.response?.data || grwR.reason?.message);
        setGrowth(null);
      }
    } catch (e) {
      console.error('Dashboard fetch error:', e);
      setError('Gagal memuat data dashboard. Silakan coba lagi.');
    } finally { 
      setLoading(false); 
    }
  }, [period, from, to]);

  // Auto-fetch when period changes or custom dates are valid
  useEffect(() => { 
    if (period !== 'custom' || (from && to)) {
      fetchAll(); 
    }
  }, [fetchAll, period, from, to]);

  const S = {
    section: { marginBottom: 28 },
    sectionTitle: { fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 14 },
    grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 },
    grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 },
    periodBar: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' },
    periodBtn: (active) => ({
      padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? '#2563eb' : '#e2e8f0'}`,
      background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#475569',
      fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
    }),
    errorBox: {
      background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 12,
      padding: '16px 20px', textAlign: 'center', marginBottom: 20,
    },
    retryBtn: {
      marginTop: 12, padding: '8px 20px', background: '#ef4444',
      color: '#fff', border: 'none', borderRadius: 8, fontSize: 13,
      fontWeight: 600, cursor: 'pointer',
    },
  };

  // Error state
  if (error) {
    return (
      <div style={S.errorBox}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
        <p style={{ color: '#991b1b', marginBottom: 12 }}>{error}</p>
        <button onClick={fetchAll} style={S.retryBtn}>
          🔄 Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Period selector */}
      <div style={S.periodBar}>
        {PERIOD_OPTS.map(o => (
          <button 
            key={o.v} 
            style={S.periodBtn(period === o.v)} 
            onClick={() => {
              setPeriod(o.v);
              if (o.v !== 'custom') {
                setFrom('');
                setTo('');
              }
            }}
          >
            {o.l}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input 
              type="date" 
              value={from} 
              onChange={e => setFrom(e.target.value)}
              style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} 
            />
            <span style={{ color: '#64748b', fontSize: 12 }}>s/d</span>
            <input 
              type="date" 
              value={to} 
              onChange={e => setTo(e.target.value)}
              style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} 
            />
          </>
        )}
        {loading && <span style={{ fontSize: 12, color: '#64748b' }}>⏳ Memuat data...</span>}
      </div>

      {/* ── BLOK 1: Operasional ── */}
      <div style={S.section}>
        <p style={S.sectionTitle}>⚙️ Operasional Hari Ini</p>
        <div style={S.grid3}>
          <StatBox 
            label="Resep Menunggu Verifikasi"   
            value={fmtNum(ops?.pendingRx)}    
            icon="📋" 
            color="#f59e0b" 
            clickable 
            onClick={() => onNavigate('pharmacy')}
            loading={loading && !ops}
          />
          <StatBox 
            label="Pesanan Dibayar"  
            value={fmtNum(ops?.paidOrders)}   
            icon="💊" 
            color="#ef4444" 
            clickable 
            onClick={() => onNavigate('pharmacy')}
            loading={loading && !ops}
          />
          <StatBox 
            label="Siap Diambil"     
            value={fmtNum(ops?.pickupReady)}  
            icon="🏥" 
            color="#8b5cf6" 
            clickable 
            onClick={() => onNavigate('pharmacy')}
            loading={loading && !ops}
          />
          <StatBox 
            label="Janji Temu Hari Ini"   
            value={fmtNum(ops?.todayAppt)}    
            icon="📅" 
            color="#0891b2" 
            clickable 
            onClick={() => onNavigate('appointments')}
            loading={loading && !ops}
          />
          <StatBox 
            label="Konsultasi Hari Ini"   
            value={fmtNum(ops?.todayConsult)} 
            icon="💬" 
            color="#2563eb" 
            clickable 
            onClick={() => onNavigate('consultations')}
            loading={loading && !ops}
          />
        </div>
      </div>

      {/* ── BLOK 2: Finansial ── */}
      <div style={S.section}>
        <p style={S.sectionTitle}>💰 Finansial</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          <StatBox 
            label="Total Pendapatan"      
            value={fmt(fin?.revenue?.total)}        
            icon="💵" 
            color="#16a34a" 
            loading={loading && !fin}
          />
          <StatBox 
            label="Pendapatan Konsultasi" 
            value={fmt(fin?.revenue?.consultation)}  
            icon="🩺" 
            color="#2563eb" 
            loading={loading && !fin}
          />
          <StatBox 
            label="Pendapatan Farmasi"    
            value={fmt(fin?.revenue?.pharmacy)}      
            icon="💊" 
            color="#7c3aed" 
            loading={loading && !fin}
          />
          <StatBox 
            label="Konsultasi Selesai"    
            value={fmtNum(fin?.completed?.consultations)} 
            icon="✅" 
            color="#0891b2" 
            loading={loading && !fin}
          />
          <StatBox 
            label="Pesanan Selesai"       
            value={fmtNum(fin?.completed?.orders)}   
            icon="📦" 
            color="#d97706" 
            loading={loading && !fin}
          />
          <StatBox 
            label="Janji Temu Selesai"    
            value={fmtNum(fin?.completed?.appointments)} 
            icon="🤝" 
            color="#059669" 
            loading={loading && !fin}
          />
          <StatBox 
            label="Rating Rata-rata"      
            value={`${fin?.avgRating || 0} ⭐`}     
            icon="⭐" 
            color="#f59e0b" 
            loading={loading && !fin}
          />
        </div>
      </div>

      {/* ── BLOK 3: Growth ── */}
      <div style={S.section}>
        <p style={S.sectionTitle}>📈 Growth & Statistik</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
          <StatBox 
            label="Pasien Baru (periode)"    
            value={fmtNum(growth?.newPatients)}   
            icon="👤" 
            color="#2563eb" 
            clickable 
            onClick={() => onNavigate('users')}
            loading={loading && !growth}
          />
          <StatBox 
            label="Total Pasien"   
            value={fmtNum(growth?.totalPatients)} 
            icon="👥" 
            color="#0891b2" 
            loading={loading && !growth}
          />
          <StatBox 
            label="Total Dokter"   
            value={fmtNum(growth?.totalDoctors)}  
            icon="👨‍⚕️" 
            color="#7c3aed" 
            clickable 
            onClick={() => onNavigate('doctors')}
            loading={loading && !growth}
          />
          <StatBox 
            label="Dokter Aktif"   
            value={fmtNum(growth?.activeDoctors)} 
            icon="✅" 
            color="#16a34a" 
            loading={loading && !growth}
          />
        </div>

        {/* Tabel rating dokter */}
        {growth?.doctors && growth.doctors.length > 0 && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', margin: 0 }}>⭐ Rating & Ulasan Dokter</p>
              <button 
                onClick={() => onNavigate('doctors')}
                style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Lihat semua →
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11 }}>Nama Dokter</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11 }}>Spesialisasi</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 11 }}>Rating</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 11 }}>Total Ulasan</th>
                  </tr>
                </thead>
                <tbody>
                  {growth.doctors.slice(0, 5).map(d => (
                    <tr key={d._id || d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>
                        {d.formattedName || fmtDoctorName(d)}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#475569' }}>
                        {d.specialization || '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>{d.rating || 0}</span>
                        <span style={{ color: '#94a3b8', fontSize: 11 }}> / 5</span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: '#475569' }}>
                        {fmtNum(d.totalReviews)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {growth.doctors.length > 5 && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button 
                  onClick={() => onNavigate('doctors')}
                  style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  + {growth.doctors.length - 5} dokter lainnya
                </button>
              </div>
            )}
          </Card>
        )}

        {/* Empty state for doctors */}
        {growth?.doctors && growth.doctors.length === 0 && !loading && (
          <Card>
            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
              <span style={{ fontSize: 32 }}>👨‍⚕️</span>
              <p style={{ fontSize: 13, marginTop: 8 }}>Belum ada data dokter</p>
            </div>
          </Card>
        )}
      </div>

      {/* Loading skeleton untuk initial load */}
      {loading && !ops && !fin && !growth && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <p>Memuat dashboard...</p>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;