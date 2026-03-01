import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const STATUS_CFG = {
  paid:      { color: '#58a6ff', label: 'Menunggu Mulai' },
  scheduled: { color: '#a371f7', label: 'Terjadwal' },
  ongoing:   { color: '#3fb950', label: 'Berlangsung' },
  completed: { color: '#8b949e', label: 'Selesai' },
  cancelled: { color: '#f85149', label: 'Dibatalkan' },
  no_show:   { color: '#f0883e', label: 'Tidak Hadir' },
};

const StatusBadge = ({ status }) => {
  const c = STATUS_CFG[status] || { color: '#8b949e', label: status };
  return (
    <span style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}40`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  );
};

const fmtDate = (d) => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

const DoctorConsultations = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active'); // active | history
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState('');

  useEffect(() => {
    if (user && user.role !== 'doctor') { navigate('/'); return; }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/consultations/doctor/history');
      setConsultations(r.data.consultations || []);
    } catch { toast.error('Gagal memuat konsultasi'); }
    finally { setLoading(false); }
  };

  const handleStart = async (id) => {
    setProcessing(id + '_start');
    try {
      await api.put(`/api/consultations/${id}/start`);
      toast.success('Konsultasi dimulai!');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal'); }
    finally { setProcessing(''); }
  };

  const handleEnd = async (id) => {
    if (!window.confirm('Akhiri konsultasi ini?')) return;
    setProcessing(id + '_end');
    try {
      await api.put(`/api/consultations/${id}/end`);
      toast.success('Konsultasi selesai');
      fetchData();
    } catch { toast.error('Gagal mengakhiri'); }
    finally { setProcessing(''); }
  };

  const active = consultations.filter(c => ['paid', 'scheduled', 'ongoing'].includes(c.status));
  const history = consultations.filter(c => ['completed', 'cancelled', 'no_show'].includes(c.status));
  const displayed = (tab === 'active' ? active : history).filter(c => {
    const q = search.toLowerCase();
    return !search || c.userId?.name?.toLowerCase().includes(q) || c.symptoms?.toLowerCase().includes(q);
  });

  const s = { fontFamily: "'DM Sans', sans-serif" };

  return (
    <div style={{ ...s, minHeight: '100vh', background: '#0d1117', padding: '28px 20px' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h4 style={{ color: '#e6edf3', fontWeight: 800, marginBottom: 2 }}>Konsultasi Saya</h4>
            <p style={{ color: '#8b949e', fontSize: 13, margin: 0 }}>Kelola dan pantau sesi konsultasi dengan pasien</p>
          </div>
          <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>↻ Refresh</button>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Perlu Aksi', count: consultations.filter(c => c.status === 'paid').length, color: '#58a6ff' },
            { label: 'Terjadwal', count: consultations.filter(c => c.status === 'scheduled').length, color: '#a371f7' },
            { label: 'Berlangsung', count: consultations.filter(c => c.status === 'ongoing').length, color: '#3fb950' },
            { label: 'Selesai', count: consultations.filter(c => c.status === 'completed').length, color: '#8b949e' },
          ].map(item => (
            <div key={item.label} style={{ background: '#161b22', border: `1px solid ${item.color}30`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ color: item.color, fontWeight: 800, fontSize: 26 }}>{item.count}</div>
              <div style={{ color: '#8b949e', fontSize: 12 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs + Search */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
            {[['active', `⚡ Aktif (${active.length})`], ['history', `📂 Riwayat (${history.length})`]].map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: tab === v ? '#1f6feb' : 'transparent', color: tab === v ? '#fff' : '#8b949e'
              }}>{l}</button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari pasien..."
            style={{ flex: 1, minWidth: 180, background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '8px 14px', color: '#e6edf3', fontSize: 13 }} />
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#8b949e' }}>Memuat...</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#8b949e', background: '#161b22', borderRadius: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{tab === 'active' ? '✨' : '📂'}</div>
            <div style={{ fontWeight: 600 }}>{tab === 'active' ? 'Tidak ada konsultasi aktif' : 'Belum ada riwayat'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayed.map(c => (
              <div key={c._id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>👤</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: '#e6edf3', fontWeight: 600, fontSize: 14 }}>{c.userId?.name || 'Pasien'}</span>
                        <StatusBadge status={c.status} />
                        <span style={{ fontSize: 11, color: '#8b949e', background: '#21262d', padding: '1px 8px', borderRadius: 20 }}>
                          {c.consultationType === 'chat' ? '💬' : c.consultationType === 'voice_call' ? '📞' : '📹'}
                          {' '}{c.scheduleType === 'instant' ? '⚡' : '📅'}
                        </span>
                      </div>
                      {c.symptoms && (
                        <div style={{ color: '#8b949e', fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
                          Keluhan: {c.symptoms}
                        </div>
                      )}
                      <div style={{ color: '#8b949e', fontSize: 11, marginTop: 2 }}>
                        {fmtDate(c.createdAt)}
                        {c.scheduledAt && ` · Jadwal: ${fmtDate(c.scheduledAt)}`}
                      </div>
                      {c.rating && <div style={{ marginTop: 4, color: '#ca8a04', fontSize: 12 }}>{'⭐'.repeat(c.rating)} {c.ratingComment && `"${c.ratingComment}"`}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                      {['paid', 'scheduled'].includes(c.status) && (
                        <button onClick={() => handleStart(c._id)} disabled={processing === c._id + '_start'}
                          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1a7f37', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                          {processing === c._id + '_start' ? '...' : '▶ Mulai'}
                        </button>
                      )}
                      {c.status === 'ongoing' && (
                        <>
                          <button onClick={() => navigate(`/consultations/${c._id}`)}
                            style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1f6feb', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                            💬 Buka Chat
                          </button>
                          <button onClick={() => handleEnd(c._id)} disabled={processing === c._id + '_end'}
                            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #f85149', background: 'transparent', color: '#f85149', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                            {processing === c._id + '_end' ? '...' : '■ Akhiri'}
                          </button>
                        </>
                      )}
                      {['completed', 'cancelled', 'no_show'].includes(c.status) && (
                        <button onClick={() => navigate(`/consultations/${c._id}`)}
                          style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                          Lihat →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorConsultations;