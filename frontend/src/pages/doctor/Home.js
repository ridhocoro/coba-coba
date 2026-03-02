import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

const DoctorHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ todayAppointments: 0, pendingAppointments: 0, totalPatients: 0, ongoingConsultations: 0 });
  const [schedule, setSchedule] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  // ✅ FIX: default null (belum tahu), bukan false (sudah punya profil)
  const [noProfile, setNoProfile] = useState(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setNoProfile(null); // reset tiap fetch
    try {
      // ✅ FIX UTAMA: cek profil dokter via endpoint yang kini sudah ada
      // Jika 404 → noProfile = true, tampilkan pesan ke dokter
      // Jika sukses → lanjut ambil stats
      const profileRes = await api.get('/api/doctors/my/profile');

      // Profil ada, lanjutkan
      setNoProfile(false);

      const [appt, cons] = await Promise.allSettled([
        api.get('/api/appointments/doctor/stats'),
        api.get('/api/consultations/doctor/pending'),
      ]);

      if (appt.status === 'fulfilled') {
        const d = appt.value.data;
        setStats(p => ({
          ...p,
          todayAppointments: d.stats?.todayAppointments ?? 0,
          pendingAppointments: d.stats?.pendingAppointments ?? 0,
          totalPatients: d.stats?.totalPatients ?? 0
        }));
        setSchedule(d.todaySchedule || []);
      }
      if (cons.status === 'fulfilled') {
        const list = cons.value.data?.consultations || [];
        setStats(p => ({ ...p, ongoingConsultations: list.filter(c => c.status === 'ongoing').length }));
        setConsultations(list.filter(c => ['paid', 'scheduled', 'ongoing'].includes(c.status)).slice(0, 6));
      }
    } catch (e) {
      // ✅ FIX: 404 dari /my/profile → dokter belum punya profil di DB
      if (e.response?.status === 404) {
        setNoProfile(true);
      } else {
        // Error lain (network, 500) → set noProfile false, tampilkan halaman dengan data kosong
        setNoProfile(false);
        console.error('Dashboard fetch error:', e);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const greeting = () => {
    const h = time.getHours();
    if (h < 11) return 'Selamat Pagi';
    if (h < 15) return 'Selamat Siang';
    if (h < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const dayName = time.toLocaleDateString('id-ID', { weekday: 'long' });
  const dateStr = time.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  // ✅ Tampilkan loading selama cek profil pertama kali
  if (loading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <p>Memuat dashboard...</p>
      </div>
    </div>
  );

  // ✅ Tampilkan pesan noProfile HANYA jika sudah pasti noProfile = true
  if (noProfile === true) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: "'DM Sans', sans-serif", background: '#f8fafc' }}>
      <div style={{ maxWidth: 440, textAlign: 'center', background: '#fff', borderRadius: 20, padding: '48px 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🏥</div>
        <h3 style={{ fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Profil Dokter Belum Terdaftar</h3>
        <p style={{ color: '#64748b', lineHeight: 1.7, marginBottom: 20 }}>
          Akun Anda sudah aktif, namun profil klinik belum disiapkan oleh administrator. Silakan hubungi admin.
        </p>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, fontSize: 13, color: '#166534', marginBottom: 20 }}>
          Admin: buka <strong>Kelola Dokter → Tambah Dokter</strong> dan masukkan email akun Anda
        </div>
        <button
          onClick={fetchData}
          style={{ background: '#059669', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
          ↻ Cek Ulang
        </button>
      </div>
    </div>
  );

  const statusMap = {
    paid:            { color: '#1d4ed8', bg: '#dbeafe', label: 'Menunggu Mulai' },
    scheduled:       { color: '#6d28d9', bg: '#ede9fe', label: 'Terjadwal' },
    ongoing:         { color: '#065f46', bg: '#d1fae5', label: 'Berlangsung' },
    completed:       { color: '#374151', bg: '#f3f4f6', label: 'Selesai' },
    cancelled:       { color: '#991b1b', bg: '#fee2e2', label: 'Dibatalkan' },
    pending_payment: { color: '#92400e', bg: '#fef3c7', label: 'Menunggu Bayar' },
    no_show:         { color: '#92400e', bg: '#fef3c7', label: 'Tidak Hadir' },
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .dh-tile { transition: transform 0.15s, box-shadow 0.15s; cursor: pointer; }
        .dh-tile:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.10) !important; }
        .dh-row { transition: background 0.12s; }
        .dh-row:hover { background: #ecfdf5 !important; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .live-dot { animation: blink 1.6s infinite; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>

        {/* ── Header strip ── */}
        <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)', borderRadius: 20, padding: '28px 32px', marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, boxShadow: '0 4px 20px rgba(6,78,59,0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 58, height: 58, borderRadius: 16, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, backdropFilter: 'blur(8px)' }}>
              🩺
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#a7f3d0', fontWeight: 500 }}>{greeting()},</div>
              <div style={{ fontSize: 23, fontWeight: 700, color: '#fff' }}>dr. {user?.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6ee7b7' }} className="live-dot" />
                <span style={{ fontSize: 12, color: '#6ee7b7', fontWeight: 600 }}>Dokter Aktif</span>
                {stats.ongoingConsultations > 0 && (
                  <span style={{ marginLeft: 8, background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, padding: '1px 9px', fontSize: 11, fontWeight: 700 }}>
                    {stats.ongoingConsultations} konsultasi live
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: 13, color: '#a7f3d0', marginTop: 3 }}>{dayName}, {dateStr}</div>
            <button onClick={fetchData} style={{ marginTop: 8, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '4px 12px', fontSize: 12, color: '#d1fae5', cursor: 'pointer', fontFamily: 'inherit' }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* ── Alert: ada konsultasi aktif ── */}
        {stats.ongoingConsultations > 0 && (
          <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 14, padding: '13px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18 }}>🔔</span>
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#065f46', fontSize: 14 }}>{stats.ongoingConsultations} pasien sedang menunggu</strong>
              <span style={{ color: '#047857', fontSize: 14 }}> di ruang konsultasi</span>
            </div>
            <button onClick={() => navigate('/doctor/consultations')}
              style={{ background: '#059669', border: 'none', borderRadius: 9, padding: '7px 18px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              Buka Chat →
            </button>
          </div>
        )}

        {/* ── Stat tiles ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Janji Hari Ini', value: stats.todayAppointments, icon: '📅', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
            { label: 'Menunggu Konfirmasi', value: stats.pendingAppointments, icon: '⏳', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
            { label: 'Total Pasien', value: stats.totalPatients, icon: '👥', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
            { label: 'Konsultasi Aktif', value: stats.ongoingConsultations, icon: '💬', color: '#059669', bg: '#f0fdf4', border: '#6ee7b7' },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, borderRadius: 14, padding: '18px 20px', border: `1px solid ${s.border}` }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, marginBottom: 20 }}>

          {/* ── Menu akses cepat ── */}
          <div style={{ background: '#fff', borderRadius: 18, padding: 24, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#064e3b', marginBottom: 18 }}>⚡ Akses Cepat</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { icon: '📅', label: 'Janji Temu', sub: `${stats.pendingAppointments} menunggu`, path: '/doctor/appointments', badge: stats.pendingAppointments, color: '#2563eb', bg: '#eff6ff' },
                { icon: '💬', label: 'Konsultasi', sub: `${stats.ongoingConsultations} aktif`, path: '/doctor/consultations', badge: stats.ongoingConsultations, color: '#059669', bg: '#f0fdf4' },
                { icon: '🧾', label: 'Surat Sakit', sub: 'Kelola surat', path: '/doctor/sick-letters', color: '#d97706', bg: '#fffbeb' },
                { icon: '👥', label: 'Pasien Saya', sub: `${stats.totalPatients} total`, path: '/doctor/patients', color: '#7c3aed', bg: '#f5f3ff' },
              ].map((m, i) => (
                <div key={i} className="dh-tile" onClick={() => navigate(m.path)}
                  style={{ background: m.bg, borderRadius: 12, padding: '14px 12px', position: 'relative', border: `1px solid ${m.bg}` }}>
                  {m.badge > 0 && (
                    <span style={{ position: 'absolute', top: 8, right: 8, background: '#ef4444', color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '1px 6px', lineHeight: '16px' }}>{m.badge}</span>
                  )}
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{m.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Jadwal hari ini ── */}
          <div style={{ background: '#fff', borderRadius: 18, padding: 24, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#064e3b' }}>📋 Jadwal Hari Ini</div>
              <Link to="/doctor/appointments" style={{ fontSize: 12, color: '#059669', textDecoration: 'none', fontWeight: 600 }}>Lihat semua →</Link>
            </div>
            {schedule.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>Tidak ada jadwal hari ini</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {schedule.slice(0, 6).map((apt, i) => (
                  <div key={apt._id} className="dh-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: '#f8fafc' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apt.userId?.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{apt.userId?.phone || 'No HP tidak tersedia'}</div>
                    </div>
                    <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {apt.appointmentTime}
                    </div>
                    <div style={{ fontSize: 13, color: apt.status === 'confirmed' ? '#059669' : '#d97706', flexShrink: 0 }}>
                      {apt.status === 'confirmed' ? '✓' : '⏳'}
                    </div>
                  </div>
                ))}
                {schedule.length > 6 && (
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', paddingTop: 4 }}>
                    +{schedule.length - 6} jadwal lainnya
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Konsultasi perlu ditangani ── */}
        {consultations.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 18, padding: 24, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#064e3b' }}>🩺 Konsultasi Perlu Ditangani</div>
              <Link to="/doctor/consultations" style={{ fontSize: 12, color: '#059669', textDecoration: 'none', fontWeight: 600 }}>Lihat semua →</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {consultations.map(c => {
                const s = statusMap[c.status] || { color: '#475569', bg: '#f1f5f9', label: c.status };
                return (
                  <div key={c._id} className="dh-tile"
                    onClick={() => ['ongoing', 'paid', 'scheduled'].includes(c.status) ? navigate(`/consultations/${c._id}`) : navigate('/doctor/consultations')}
                    style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{c.userId?.name}</span>
                      <span style={{ background: s.bg, color: s.color, borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, marginBottom: c.status === 'ongoing' ? 10 : 0 }}>
                      {c.symptoms?.slice(0, 70)}{c.symptoms?.length > 70 ? '...' : ''}
                    </div>
                    {c.status === 'ongoing' && (
                      <div style={{ marginTop: 10, background: '#059669', color: '#fff', borderRadius: 8, padding: '6px 0', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                        💬 Buka Chat
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DoctorHome;
