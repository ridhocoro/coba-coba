import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';

const STATUS_CFG = {
  draft:            { color: '#8b949e', bg: '#21262d', label: 'Draft' },
  pending_payment:  { color: '#f0883e', bg: '#3d1f00', label: 'Menunggu Bayar' },
  paid:             { color: '#58a6ff', bg: '#0c2d6b', label: 'Sudah Bayar' },
  scheduled:        { color: '#a371f7', bg: '#2d1b69', label: 'Terjadwal' },
  ongoing:          { color: '#3fb950', bg: '#0a3d1e', label: 'Berlangsung' },
  completed:        { color: '#58a6ff', bg: '#0c2d6b', label: 'Selesai' },
  cancelled:        { color: '#f85149', bg: '#3d0c09', label: 'Dibatalkan' },
  expired:          { color: '#8b949e', bg: '#21262d', label: 'Kadaluarsa' },
  rejected_payment: { color: '#f85149', bg: '#3d0c09', label: 'Bayar Ditolak' },
  no_show:          { color: '#f0883e', bg: '#3d1f00', label: 'Tidak Hadir' },
};

const StatusBadge = ({ status }) => {
  const c = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}40`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  );
};

const fmtDate = (d) => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const fmtRupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

const ManageConsultations = () => {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/consultations');
      setConsultations(r.data || []);
    } catch { toast.error('Gagal memuat konsultasi'); }
    finally { setLoading(false); }
  };

  const handleAction = async (action, consultationId, extraData = {}) => {
    setProcessing(true);
    try {
      const map = {
        'mark-paid':       () => api.put(`/api/consultations/${consultationId}/mark-paid`),
        'reject-payment':  () => api.put(`/api/consultations/${consultationId}/reject-payment`, extraData),
        'start':           () => api.put(`/api/consultations/${consultationId}/start`),
        'end':             () => api.put(`/api/consultations/${consultationId}/end`),
        'no-show':         () => api.put(`/api/consultations/${consultationId}/no-show`, extraData),
        'cancel':          () => api.put(`/api/consultations/${consultationId}/cancel`, extraData),
      };
      if (!map[action]) return;
      await map[action]();
      toast.success('Berhasil diproses');
      setShowDetail(false);
      setShowRejectForm(false);
      setRejectReason('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses');
    } finally { setProcessing(false); }
  };

  const downloadPDF = async (c) => {
    try {
      const r = await api.get(`/api/consultations/${c._id}/sick-letter/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url; a.download = `surat-sakit-${c._id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch { toast.error('Surat sakit belum tersedia'); }
  };

  const filtered = consultations.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || c.userId?.name?.toLowerCase().includes(q)
      || c.doctorId?.name?.toLowerCase().includes(q)
      || c.symptoms?.toLowerCase().includes(q);
    return matchSearch && (filterStatus === 'all' || c.status === filterStatus);
  });

  const s = { fontFamily: "'DM Sans', sans-serif", color: '#e6edf3' };

  const DetailPanel = ({ c }) => (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) setShowDetail(false); }}>
      <div style={{ background: '#0d1117', borderLeft: '1px solid #30363d', width: '100%', maxWidth: 500, height: '100vh', overflowY: 'auto', padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h5 style={{ color: '#e6edf3', fontWeight: 700, margin: 0 }}>Detail Konsultasi</h5>
          <button onClick={() => setShowDetail(false)} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <StatusBadge status={c.status} />
          <span style={{ color: '#8b949e', fontSize: 12 }}>#{c._id.slice(-8)}</span>
        </div>

        {[
          ['Pasien', c.userId?.name || '-'],
          ['Email', c.userId?.email || '-'],
          ['Dokter', `dr. ${c.doctorId?.name || '-'}`],
          ['Spesialis', c.doctorId?.specialization || '-'],
          ['Tipe', c.consultationType === 'chat' ? 'Chat' : c.consultationType === 'voice_call' ? 'Voice Call' : 'Video Call'],
          ['Jadwal', c.scheduleType === 'instant' ? 'Instant' : 'Terjadwal'],
          ...(c.scheduledAt ? [['Waktu Jadwal', fmtDate(c.scheduledAt)]] : []),
          ['Dibuat', fmtDate(c.createdAt)],
          ...(c.paymentDeadline ? [['Batas Bayar', fmtDate(c.paymentDeadline)]] : []),
          ['Biaya', fmtRupiah(c.doctorId?.consultationFee)],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #21262d' }}>
            <span style={{ color: '#8b949e', fontSize: 13 }}>{k}</span>
            <span style={{ color: '#e6edf3', fontSize: 13, fontWeight: 500, textAlign: 'right', maxWidth: 280 }}>{v}</span>
          </div>
        ))}

        {c.symptoms && (
          <div style={{ marginTop: 16 }}>
            <div style={{ color: '#8b949e', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>KELUHAN</div>
            <div style={{ background: '#161b22', borderRadius: 8, padding: '10px 12px', color: '#c9d1d9', fontSize: 13 }}>{c.symptoms}</div>
          </div>
        )}

        {c.prescription && (
          <div style={{ marginTop: 12 }}>
            <div style={{ color: '#8b949e', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>RESEP</div>
            <div style={{ background: '#0a3d1e', border: '1px solid #2ea04330', borderRadius: 8, padding: '10px 12px', color: '#3fb950', fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{c.prescription}</div>
          </div>
        )}

        {c.rating && (
          <div style={{ marginTop: 12 }}>
            <div style={{ color: '#8b949e', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>RATING PASIEN</div>
            <div style={{ background: '#161b22', borderRadius: 8, padding: '8px 12px', color: '#ca8a04', fontSize: 13 }}>
              {'⭐'.repeat(c.rating)} {c.ratingComment && `— "${c.ratingComment}"`}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ marginTop: 24 }}>
          <div style={{ color: '#8b949e', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>TINDAKAN ADMIN</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Verifikasi Pembayaran */}
            {c.status === 'pending_payment' && (
              <>
                {!showRejectForm ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => handleAction('mark-paid', c._id)} disabled={processing}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#1a7f37', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: processing ? 0.5 : 1 }}>
                      ✓ Verifikasi Bayar
                    </button>
                    <button onClick={() => setShowRejectForm(true)}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #f85149', background: 'transparent', color: '#f85149', fontWeight: 700, cursor: 'pointer' }}>
                      ✗ Tolak
                    </button>
                  </div>
                ) : (
                  <div style={{ background: '#1a0a0a', border: '1px solid #f8514940', borderRadius: 10, padding: 14 }}>
                    <div style={{ color: '#f85149', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Alasan Penolakan</div>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                      placeholder="Contoh: Bukti transfer tidak valid..."
                      style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px', color: '#e6edf3', fontSize: 13, resize: 'none', marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setShowRejectForm(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>Batal</button>
                      <button onClick={() => handleAction('reject-payment', c._id, { reason: rejectReason })} disabled={processing}
                        style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#c0392b', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                        Konfirmasi Tolak
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Mulai (kalau paid/scheduled) */}
            {['paid', 'scheduled'].includes(c.status) && (
              <button onClick={() => handleAction('start', c._id)} disabled={processing}
                style={{ padding: '10px', borderRadius: 8, border: 'none', background: '#1f6feb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                ▶ Mulai Konsultasi
              </button>
            )}

            {/* No-show (scheduled) */}
            {c.status === 'scheduled' && (
              <button onClick={() => handleAction('no-show', c._id, { reason: 'Ditandai no-show oleh admin' })} disabled={processing}
                style={{ padding: '10px', borderRadius: 8, border: '1px solid #f0883e', background: 'transparent', color: '#f0883e', fontWeight: 700, cursor: 'pointer' }}>
                ✗ Tandai Tidak Hadir
              </button>
            )}

            {/* End (ongoing) */}
            {c.status === 'ongoing' && (
              <button onClick={() => handleAction('end', c._id)} disabled={processing}
                style={{ padding: '10px', borderRadius: 8, border: 'none', background: '#854d0e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                ■ Akhiri Konsultasi
              </button>
            )}

            {/* Cancel */}
            {['pending_payment', 'paid', 'scheduled'].includes(c.status) && (
              <button onClick={() => handleAction('cancel', c._id, { reason: 'Dibatalkan oleh admin' })} disabled={processing}
                style={{ padding: '10px', borderRadius: 8, border: '1px solid #f85149', background: 'transparent', color: '#f85149', fontWeight: 600, cursor: 'pointer' }}>
                ✗ Batalkan Konsultasi
              </button>
            )}

            {/* Download PDF */}
            {c.sickLetter?.status === 'issued' && (
              <button onClick={() => downloadPDF(c)}
                style={{ padding: '10px', borderRadius: 8, border: 'none', background: '#21262d', color: '#8b949e', fontWeight: 600, cursor: 'pointer' }}>
                📄 Unduh Surat Sakit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ ...s, minHeight: '100vh', background: '#0d1117', padding: '28px 20px' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontWeight: 800, color: '#e6edf3', marginBottom: 4 }}>Kelola Konsultasi</h4>
          <p style={{ color: '#8b949e', fontSize: 13, margin: 0 }}>Verifikasi pembayaran & pantau status konsultasi</p>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Menunggu Bayar', count: consultations.filter(c => c.status === 'pending_payment').length, color: '#f0883e' },
            { label: 'Berlangsung', count: consultations.filter(c => c.status === 'ongoing').length, color: '#3fb950' },
            { label: 'Terjadwal', count: consultations.filter(c => c.status === 'scheduled').length, color: '#a371f7' },
            { label: 'Selesai', count: consultations.filter(c => c.status === 'completed').length, color: '#58a6ff' },
          ].map(item => (
            <div key={item.label} style={{ background: '#161b22', border: `1px solid ${item.color}30`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}
              onClick={() => setFilterStatus(consultations.filter(c => c.label === item.label).length ? item.label.toLowerCase().replace(' ', '_') : 'all')}>
              <div style={{ color: item.color, fontWeight: 800, fontSize: 28 }}>{item.count}</div>
              <div style={{ color: '#8b949e', fontSize: 12 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari pasien, dokter, keluhan..."
            style={{ flex: 1, minWidth: 200, background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '8px 14px', color: '#e6edf3', fontSize: 13 }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '8px 14px', color: '#e6edf3', fontSize: 13 }}>
            <option value="all">Semua Status</option>
            {Object.entries(STATUS_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>
          <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>↻ Refresh</button>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#8b949e' }}>Memuat...</div>
        ) : (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #30363d', background: '#0d1117' }}>
                    {['Pasien', 'Dokter', 'Tipe', 'Status', 'Dibuat', 'Batas Bayar', 'Aksi'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', color: '#8b949e', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#8b949e' }}>Tidak ada konsultasi</td></tr>
                  ) : filtered.map(c => (
                    <tr key={c._id} style={{ borderBottom: '1px solid #21262d', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1c2128'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#e6edf3' }}>{c.userId?.name || '-'}</div>
                        <div style={{ color: '#8b949e', fontSize: 11 }}>{c.userId?.email || '-'}</div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#c9d1d9' }}>dr. {c.doctorId?.name || '-'}</td>
                      <td style={{ padding: '10px 14px', color: '#8b949e' }}>
                        {c.consultationType === 'chat' ? '💬' : c.consultationType === 'voice_call' ? '📞' : '📹'}
                        {' '}{c.scheduleType === 'scheduled' ? '📅' : '⚡'}
                      </td>
                      <td style={{ padding: '10px 14px' }}><StatusBadge status={c.status} /></td>
                      <td style={{ padding: '10px 14px', color: '#8b949e', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.createdAt)}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {c.paymentDeadline ? (
                          <span style={{ color: new Date(c.paymentDeadline) < new Date() ? '#f85149' : '#f0883e', fontSize: 12 }}>
                            {fmtDate(c.paymentDeadline)}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => { setSelected(c); setShowRejectForm(false); setShowDetail(true); }}
                          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#58a6ff', cursor: 'pointer', fontSize: 12 }}>
                          Detail →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {showDetail && selected && <DetailPanel c={selected} />}
    </div>
  );
};

export default ManageConsultations;