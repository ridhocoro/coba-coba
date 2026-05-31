import React, { useState, useEffect, useCallback } from 'react';
import api, { API_URL } from '../../utils/api';
import { fmtDoctorName } from '../../utils/format';

const fmtDate = d =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '-';

const fmtDateTime = d =>
  d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '-';

const openPdf = (url) => {
  const token = localStorage.getItem('token');
  window.open(`${API_URL}${url}?token=${token}`, '_blank');
};

const Badge = ({ color, children }) => {
  const colors = {
    green:  { background: '#dcfce7', color: '#166534' },
    yellow: { background: '#fef3c7', color: '#92400e' },
    red:    { background: '#fee2e2', color: '#991b1b' },
    gray:   { background: '#f1f5f9', color: '#475569' },
  };
  return (
    <span style={{ ...colors[color] || colors.gray, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
};

const Pagination = ({ page, pages, setPage }) => {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2);
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 14, justifyContent: 'center' }}>
      {nums.map(p => (
        <button key={p} onClick={() => setPage(p)}
          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: p === page ? '#2563eb' : '#fff', color: p === page ? '#fff' : '#475569', fontSize: 12, cursor: 'pointer' }}>
          {p}
        </button>
      ))}
    </div>
  );
};

const S = {
  input: { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', fontSize: 13 },
  th:    { padding: '10px 14px', background: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' },
  td:    { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', verticalAlign: 'middle' },
};

// ─── Tab: Surat Sakit ────────────────────────────────────────────────────────
const SickLetterTab = () => {
  const [letters, setLetters] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [status, setStatus]   = useState('');
  const [page, setPage]       = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (from)   params.set('from', from);
      if (to)     params.set('to', to);
      if (status) params.set('status', status);
      const r = await api.get(`/api/admin/sick-letters?${params}`);
      setLetters(r.data.letters || []);
      setTotal(r.data.total || 0);
    } catch {}
    finally { setLoading(false); }
  }, [from, to, status, page]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" style={S.input} value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} />
        <span style={{ fontSize: 12, color: '#64748b' }}>s/d</span>
        <input type="date" style={S.input} value={to} onChange={e => { setTo(e.target.value); setPage(1); }} />
        <select style={S.input} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="issued">Diterbitkan</option>
        </select>
        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>{total} surat</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Memuat...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead><tr>
              {['No. Surat', 'Pasien', 'Dokter', 'Diagnosis', 'Tgl Mulai', 'Tgl Selesai', 'Status', 'Diterbitkan', 'Aksi'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {letters.map(l => {
                const canPdf = l.status === 'issued' && (l.consultationId || l.appointmentId);
                return (
                  <tr key={l._id}>
                    <td style={S.td}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#2563eb' }}>{l.letterNumber}</span></td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600 }}>{l.userId?.name || '-'}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{l.userId?.email}</div>
                    </td>
                    <td style={S.td}>{fmtDoctorName(l.doctorId)}</td>
                    <td style={{ ...S.td, maxWidth: 180 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{l.diagnosis}</div>
                    </td>
                    <td style={S.td}>{fmtDate(l.startDate)}</td>
                    <td style={S.td}>{fmtDate(l.endDate)}</td>
                    <td style={S.td}>
                      <Badge color={l.status === 'issued' ? 'green' : 'yellow'}>
                        {l.status === 'issued' ? 'Diterbitkan' : 'Draft'}
                      </Badge>
                    </td>
                    <td style={S.td}>{fmtDate(l.issuedAt)}</td>
                    <td style={S.td}>
                      {canPdf ? (
                        <button
                          onClick={() => openPdf(`/api/admin/sick-letters/${l._id}/pdf`)}
                          style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                          ⬇ Download
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {l.status !== 'issued' ? 'Belum diterbitkan' : 'ID tidak tersedia'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!letters.length && (
                <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: 32 }}>Tidak ada surat sakit</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={Math.ceil(total / 30)} setPage={setPage} />
    </>
  );
};

// ─── Tab: Resep Obat ─────────────────────────────────────────────────────────
const PrescriptionTab = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [total, setTotal]                 = useState(0);
  const [loading, setLoading]             = useState(true);
  const [from, setFrom]                   = useState('');
  const [to, setTo]                       = useState('');
  const [page, setPage]                   = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (from) params.set('from', from);
      if (to)   params.set('to', to);
      const r = await api.get(`/api/admin/prescriptions?${params}`);
      setPrescriptions(r.data.prescriptions || []);
      setTotal(r.data.total || 0);
    } catch {}
    finally { setLoading(false); }
  }, [from, to, page]);

  useEffect(() => { loadData(); }, [loadData]);

  // Cek apakah resep sudah kedaluwarsa berdasarkan validUntil
  const rxStatus = (rx) => {
    if (!rx.validUntil) return { color: 'gray', label: 'Tidak ada masa berlaku' };
    const expired = new Date(rx.validUntil) < new Date();
    return expired
      ? { color: 'red',   label: 'Kedaluwarsa' }
      : { color: 'green', label: 'Masih berlaku' };
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" style={S.input} value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} />
        <span style={{ fontSize: 12, color: '#64748b' }}>s/d</span>
        <input type="date" style={S.input} value={to} onChange={e => { setTo(e.target.value); setPage(1); }} />
        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>{total} resep</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Memuat...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead><tr>
              {['No. Resep', 'Pasien', 'Dokter', 'Obat', 'Diterbitkan', 'Berlaku s/d', 'Status', 'Aksi'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {prescriptions.map(rx => {
                const st = rxStatus(rx);
                return (
                  <tr key={rx.consultationId?.toString()}>
                    <td style={S.td}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7c3aed' }}>
                        {rx.prescriptionNumber || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>-</span>}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600 }}>{rx.userId?.name || '-'}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{rx.userId?.email}</div>
                    </td>
                    <td style={S.td}>{fmtDoctorName(rx.doctorId)}</td>
                    <td style={{ ...S.td, maxWidth: 200 }}>
                      {rx.medicines?.length > 0 ? (
                        <div>
                          <div style={{ fontSize: 12 }}>{rx.medicines[0].name}</div>
                          {rx.medicines.length > 1 && (
                            <div style={{ fontSize: 11, color: '#64748b' }}>+{rx.medicines.length - 1} obat lainnya</div>
                          )}
                        </div>
                      ) : rx.prescriptionText ? (
                        <div style={{ fontSize: 11, color: '#64748b', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rx.prescriptionText}
                        </div>
                      ) : '-'}
                    </td>
                    <td style={S.td}>{fmtDateTime(rx.issuedAt)}</td>
                    <td style={S.td}>{fmtDate(rx.validUntil)}</td>
                    <td style={S.td}><Badge color={st.color}>{st.label}</Badge></td>
                    <td style={S.td}>
                      <button
                        onClick={() => openPdf(`/api/consultations/${rx.consultationId}/prescription/pdf`)}
                        style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                        ⬇ Download
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!prescriptions.length && (
                <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: 32 }}>Tidak ada resep obat</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={Math.ceil(total / 30)} setPage={setPage} />
    </>
  );
};

// ─── Tab: Surat Rujukan ──────────────────────────────────────────────────────
const ReferralLetterTab = () => {
  const [letters, setLetters] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [status, setStatus]   = useState('');
  const [page, setPage]       = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (from)   params.set('from', from);
      if (to)     params.set('to', to);
      if (status) params.set('status', status);
      const r = await api.get(`/api/admin/referral-letters?${params}`);
      setLetters(r.data.letters || []);
      setTotal(r.data.total || 0);
    } catch {}
    finally { setLoading(false); }
  }, [from, to, status, page]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" style={S.input} value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} />
        <span style={{ fontSize: 12, color: '#64748b' }}>s/d</span>
        <input type="date" style={S.input} value={to} onChange={e => { setTo(e.target.value); setPage(1); }} />
        <select style={S.input} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="issued">Diterbitkan</option>
        </select>
        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>{total} surat</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Memuat...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead><tr>
              {['No. Surat', 'Pasien', 'Dokter', 'Diagnosis', 'Rujukan Ke', 'Spesialisasi', 'Status', 'Diterbitkan', 'Aksi'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {letters.map(l => {
                const canPdf = l.status === 'issued' && (l.consultationId || l.appointmentId);
                return (
                  <tr key={l._id}>
                    <td style={S.td}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7c3aed' }}>{l.letterNumber}</span></td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600 }}>{l.userId?.name || '-'}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{l.userId?.email}</div>
                    </td>
                    <td style={S.td}>{fmtDoctorName(l.doctorId)}</td>
                    <td style={{ ...S.td, maxWidth: 160 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{l.diagnosis}</div>
                    </td>
                    <td style={{ ...S.td, maxWidth: 160 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{l.referralTo || '-'}</div>
                    </td>
                    <td style={S.td}><span style={{ fontSize: 12, color: '#64748b' }}>{l.referralSpecialty || '-'}</span></td>
                    <td style={S.td}>
                      <Badge color={l.status === 'issued' ? 'green' : 'yellow'}>
                        {l.status === 'issued' ? 'Diterbitkan' : 'Draft'}
                      </Badge>
                    </td>
                    <td style={S.td}>{fmtDate(l.issuedAt)}</td>
                    <td style={S.td}>
                      {canPdf ? (
                        <button
                          onClick={() => openPdf(`/api/admin/referral-letters/${l._id}/pdf`)}
                          style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' }}>
                          ⬇ Download
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {l.status !== 'issued' ? 'Belum diterbitkan' : 'ID tidak tersedia'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!letters.length && (
                <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: 32 }}>Tidak ada surat rujukan</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={Math.ceil(total / 30)} setPage={setPage} />
    </>
  );
};

// ─── Main ────────────────────────────────────────────────────────────────────
const SickLetters = () => {
  const [tab, setTab] = useState('sick-letters');
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e2e8f0' }}>
        {[
          { key: 'sick-letters',     label: '📄 Surat Sakit'   },
          { key: 'referral-letters', label: '🔀 Surat Rujukan' },
          { key: 'prescriptions',    label: '💊 Resep Obat'    },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 18px', border: 'none',
            borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2, background: 'none',
            color: tab === t.key ? '#2563eb' : '#64748b',
            fontWeight: tab === t.key ? 700 : 400,
            fontSize: 13, cursor: 'pointer',
          }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'sick-letters'     && <SickLetterTab />}
      {tab === 'referral-letters' && <ReferralLetterTab />}
      {tab === 'prescriptions'    && <PrescriptionTab />}
    </div>
  );
};

export default SickLetters;