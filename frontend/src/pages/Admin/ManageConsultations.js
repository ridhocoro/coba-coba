import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { fmtDoctorName } from '../../utils/format';


const STATUS_CFG = {
  confirmed:          { bg:'#dbeafe', c:'#1e40af', l:'Terkonfirmasi' },
  in_progress:        { bg:'#cffafe', c:'#0e7490', l:'Berlangsung' },
  completed:          { bg:'#dcfce7', c:'#166534', l:'Selesai' },
  pending_payment:    { bg:'#fef3c7', c:'#b45309', l:'Menunggu Bayar' },
  cancelled_by_user:  { bg:'#fee2e2', c:'#991b1b', l:'Dibatalkan Pasien' },
  cancelled_by_doctor:{ bg:'#fee2e2', c:'#991b1b', l:'Dibatalkan Dokter' },
  cancelled_by_admin: { bg:'#fee2e2', c:'#991b1b', l:'Dibatalkan Admin' },
  doctor_no_show:     { bg:'#fee2e2', c:'#991b1b', l:'Dokter Tidak Hadir' },
  refunded:           { bg:'#f0fdf4', c:'#166534', l:'Refunded' },
  expired:            { bg:'#f1f5f9', c:'#475569', l:'Kedaluwarsa' },
  no_show:            { bg:'#fef2f2', c:'#b91c1c', l:'Tidak Hadir' },
};

const PERIOD_OPTS = [
  { v:'today', l:'Hari Ini' }, { v:'7d', l:'7 Hari' }, { v:'30d', l:'30 Hari' }, { v:'custom', l:'Pilih Tanggal' },
];

const ManageConsultations = () => {
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState('7d');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [status, setStatus]   = useState('');
  const [page, setPage]       = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (period !== 'custom') params.set('period', period);
      else { if (from) params.set('from', from); if (to) params.set('to', to); }
      if (status) params.set('status', status);
      const r = await api.get(`/api/admin/consultations?${params}`);
      setItems(r.data.consultations || []);
      setTotal(r.data.total || 0);
    } catch { }
    finally { setLoading(false); }
  }, [period, from, to, status, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const S = {
    periodBar: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
    periodBtn: (a) => ({ padding: '6px 14px', borderRadius: 20, border: `1px solid ${a?'#2563eb':'#e2e8f0'}`, background: a?'#2563eb':'#fff', color: a?'#fff':'#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }),
    table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', fontSize: 13 },
    th: { padding: '10px 14px', background: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', textAlign: 'left' },
    td: { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#0f172a' },
    select: { padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 },
    dateInput: { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 },
  };

  const fmtDate = d => d ? new Date(d).toLocaleString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Jakarta' }) : '-';
  const pages = Math.ceil(total / 30);

  return (
    <div>
      <div style={S.periodBar}>
        {PERIOD_OPTS.map(o => <button key={o.v} style={S.periodBtn(period===o.v)} onClick={() => { setPeriod(o.v); setPage(1); }}>{o.l}</button>)}
        {period === 'custom' && (
          <>
            <input type="date" style={S.dateInput} value={from} onChange={e => setFrom(e.target.value)} />
            <span style={{ fontSize: 12, color: '#64748b' }}>s/d</span>
            <input type="date" style={S.dateInput} value={to} onChange={e => setTo(e.target.value)} />
          </>
        )}
        <select style={S.select} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Semua Status</option>
          {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}
        </select>
        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>{total} konsultasi</span>
      </div>

      {loading ? <p style={{ color:'#64748b' }}>Memuat...</p> : (
        <table style={S.table}>
          <thead><tr>{['Jadwal','Pasien','Dokter','Tipe','Durasi','Status','Nominal','Kategori Penyakit'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map(c => {
              const cfg = STATUS_CFG[c.status] || { bg:'#f1f5f9', c:'#475569', l: c.status };
              return (
                <tr key={c._id}>
                  <td style={S.td}>{fmtDate(c.scheduledAt)}</td>
                  <td style={S.td}><div style={{ fontWeight:600 }}>{c.userId?.name || '-'}</div><div style={{ fontSize:11, color:'#64748b' }}>{c.userId?.email}</div></td>
                  <td style={S.td}>{fmtDoctorName(c.doctorId) || '-'}<div style={{ fontSize:11, color:'#64748b' }}>{c.doctorId?.specialization}</div></td>
                  <td style={S.td}>{c.consultationType === 'video_call' ? '📹 Video' : '💬 Chat'}</td>
                  <td style={S.td}>{c.durationMin != null ? `${c.durationMin} mnt` : '-'}</td>
                  <td style={S.td}><span style={{ background: cfg.bg, color: cfg.c, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{cfg.l}</span></td>
                  <td style={S.td}>{c.amount ? `Rp ${c.amount.toLocaleString('id-ID')}` : '-'}</td>
                  <td style={S.td}>
                    {c.disease_category ? (
                        <span style={{
                            background: c.disease_category === 'Tidak Dikenali' ? '#fef3c7' : '#eff6ff',
                            color:      c.disease_category === 'Tidak Dikenali' ? '#92400e' : '#1d4ed8',
                            borderRadius: 20, padding: '2px 10px',
                            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                        }}>
                            {c.disease_category === 'Tidak Dikenali' ? '⚠️ Tdk Dikenali' : c.disease_category}
                        </span>
                    ) : (
                        <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
                    )}
                </td>
                </tr>
              );
            })}
            {!items.length && <tr><td colSpan={8} style={{ ...S.td, textAlign:'center', color:'#94a3b8' }}>Tidak ada data</td></tr>}
          </tbody>
        </table>
      )}

      {pages > 1 && (
        <div style={{ display:'flex', gap:6, marginTop:14, justifyContent:'center' }}>
          {Array.from({ length: pages }, (_, i) => i+1).slice(Math.max(0,page-3), page+2).map(p => (
            <button key={p} onClick={() => setPage(p)} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #e2e8f0', background: p===page?'#2563eb':'#fff', color: p===page?'#fff':'#475569', fontSize:12, cursor:'pointer' }}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
};
export default ManageConsultations;