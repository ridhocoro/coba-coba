import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

const SickLetters = () => {
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
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (status) params.set('status', status);
      const r = await api.get(`/api/admin/sick-letters?${params}`);
      setLetters(r.data.letters || []);
      setTotal(r.data.total || 0);
    } catch {}
    finally { setLoading(false); }
  }, [from, to, status, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const S = {
    toolbar: { display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' },
    dateInput: { padding:'6px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12 },
    select: { padding:'7px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12 },
    table: { width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:10, overflow:'hidden', border:'1px solid #e2e8f0', fontSize:13 },
    th: { padding:'10px 14px', background:'#f8fafc', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase', textAlign:'left' },
    td: { padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#0f172a' },
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Jakarta' }) : '-';
  const pages = Math.ceil(total / 30);

  return (
    <div>
      <div style={S.toolbar}>
        <input type="date" style={S.dateInput} value={from} onChange={e => setFrom(e.target.value)} placeholder="Dari" />
        <span style={{ fontSize:12, color:'#64748b' }}>s/d</span>
        <input type="date" style={S.dateInput} value={to} onChange={e => setTo(e.target.value)} placeholder="Sampai" />
        <select style={S.select} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="issued">Diterbitkan</option>
        </select>
        <span style={{ fontSize:12, color:'#64748b', marginLeft:'auto' }}>{total} surat</span>
      </div>

      {loading ? <p style={{ color:'#64748b' }}>Memuat...</p> : (
        <table style={S.table}>
          <thead><tr>{['No. Surat','Pasien','Dokter','Diagnosis','Tgl Mulai','Tgl Selesai','Status','Diterbitkan'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {letters.map(l => (
              <tr key={l._id}>
                <td style={S.td}><span style={{ fontFamily:'monospace', fontSize:12, color:'#2563eb' }}>{l.letterNumber}</span></td>
                <td style={S.td}><div style={{ fontWeight:600 }}>{l.userId?.name || '-'}</div><div style={{ fontSize:11, color:'#64748b' }}>{l.userId?.email}</div></td>
                <td style={S.td}>dr. {l.doctorId?.name || '-'}</td>
                <td style={{ ...S.td, maxWidth:200 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:12 }}>{l.diagnosis}</div></td>
                <td style={S.td}>{fmtDate(l.startDate)}</td>
                <td style={S.td}>{fmtDate(l.endDate)}</td>
                <td style={S.td}>
                  <span style={{ background: l.status==='issued'?'#dcfce7':'#fef3c7', color: l.status==='issued'?'#166534':'#92400e', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>
                    {l.status==='issued'?'Diterbitkan':'Draft'}
                  </span>
                </td>
                <td style={S.td}>{fmtDate(l.issuedAt)}</td>
              </tr>
            ))}
            {!letters.length && <tr><td colSpan={8} style={{ ...S.td, textAlign:'center', color:'#94a3b8' }}>Tidak ada surat sakit</td></tr>}
          </tbody>
        </table>
      )}

      {pages > 1 && (
        <div style={{ display:'flex', gap:6, marginTop:14, justifyContent:'center' }}>
          {Array.from({ length:pages }, (_, i) => i+1).slice(Math.max(0,page-3), page+2).map(p => (
            <button key={p} onClick={() => setPage(p)} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #e2e8f0', background: p===page?'#2563eb':'#fff', color: p===page?'#fff':'#475569', fontSize:12, cursor:'pointer' }}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
};
export default SickLetters;