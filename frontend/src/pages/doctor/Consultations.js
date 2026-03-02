import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const STATUS_CFG = {
  paid:      { color: '#2563eb', label: 'Menunggu Mulai' },
  scheduled: { color: '#7e22ce', label: 'Terjadwal' },
  ongoing:   { color: '#16a34a', label: 'Berlangsung' },
  completed: { color: '#6b7280', label: 'Selesai' },
  cancelled: { color: '#b91c1c', label: 'Dibatalkan' },
  no_show:   { color: '#b45309', label: 'Tidak Hadir' },
};

const StatusBadge = ({ status }) => {
  const c = STATUS_CFG[status] || { color: '#6b7280', label: status };
  return (
    <span style={{ background: `${c.color}10`, color: c.color, border: `1px solid ${c.color}30`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
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

  const s = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

  return (
    <div style={{ ...s, minHeight: '100vh', background: '#ffffff', padding: '28px 20px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h4 style={{ color: '#111827', fontWeight: 800, marginBottom: 2 }}>Konsultasi Saya</h4>
            <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Kelola dan pantau sesi konsultasi dengan pasien</p>
          </div>
          <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>↻ Refresh</button>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Perlu Aksi', count: consultations.filter(c => c.status === 'paid').length, color: '#2563eb' },
            { label: 'Terjadwal', count: consultations.filter(c => c.status === 'scheduled').length, color: '#7e22ce' },
            { label: 'Berlangsung', count: consultations.filter(c => c.status === 'ongoing').length, color: '#16a34a' },
            { label: 'Selesai', count: consultations.filter(c => c.status === 'completed').length, color: '#6b7280' },
          ].map(item => (
            <div key={item.label} style={{ background: '#ffffff', border: `1px solid ${item.color}20`, borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: item.color, fontWeight: 800, fontSize: 26 }}>{item.count}</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs + Search */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
            {[['active', `⚡ Aktif (${active.length})`], ['history', `📂 Riwayat (${history.length})`]].map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: tab === v ? '#2563eb' : 'transparent', color: tab === v ? '#fff' : '#6b7280'
              }}>{l}</button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari pasien..."
            style={{ flex: 1, minWidth: 180, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 14px', color: '#111827', fontSize: 13 }} />
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Memuat...</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6b7280', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{tab === 'active' ? '✨' : '📂'}</div>
            <div style={{ fontWeight: 600 }}>{tab === 'active' ? 'Tidak ada konsultasi aktif' : 'Belum ada riwayat'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayed.map(c => (
              <div key={c._id} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>👤</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: '#111827', fontWeight: 600, fontSize: 14 }}>{c.userId?.name || 'Pasien'}</span>
                        <StatusBadge status={c.status} />
                        <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '1px 8px', borderRadius: 20 }}>
                          {c.consultationType === 'chat' ? '💬' : c.consultationType === 'voice_call' ? '📞' : '📹'}
                          {' '}{c.scheduleType === 'instant' ? '⚡' : '📅'}
                        </span>
                      </div>
                      {c.symptoms && (
                        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
                          Keluhan: {c.symptoms}
                        </div>
                      )}
                      <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
                        {fmtDate(c.createdAt)}
                        {c.scheduledAt && ` · Jadwal: ${fmtDate(c.scheduledAt)}`}
                      </div>
                      {c.rating && <div style={{ marginTop: 4, color: '#ca8a04', fontSize: 12 }}>{'⭐'.repeat(c.rating)} {c.ratingComment && `"${c.ratingComment}"`}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                      {['paid', 'scheduled'].includes(c.status) && (
                        <button onClick={() => handleStart(c._id)} disabled={processing === c._id + '_start'}
                          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                          {processing === c._id + '_start' ? '...' : '▶ Mulai'}
                        </button>
                      )}
                      {c.status === 'ongoing' && (
                        <>
                          <button onClick={() => navigate(`/consultations/${c._id}`)}
                            style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                            💬 Buka Chat
                          </button>
                          <button onClick={() => handleEnd(c._id)} disabled={processing === c._id + '_end'}
                            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #b91c1c', background: 'transparent', color: '#b91c1c', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                            {processing === c._id + '_end' ? '...' : '■ Akhiri'}
                          </button>
                        </>
                      )}
                      {['completed', 'cancelled', 'no_show'].includes(c.status) && (
                        <button onClick={() => navigate(`/consultations/${c._id}`)}
                          style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
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