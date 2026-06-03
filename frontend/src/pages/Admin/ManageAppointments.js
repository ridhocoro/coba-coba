import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

import { toast } from 'react-hot-toast';
import { fmtDoctorName } from '../../utils/format';
import { getCache, setCache, hasCache } from '../../utils/cache';

const STATUS_CFG = {
  scheduled:          { bg:'#dbeafe', c:'#1e40af', l:'Terjadwal' },
  checked_in:         { bg:'#cffafe', c:'#0e7490', l:'Check-In' },
  completed:          { bg:'#dcfce7', c:'#166534', l:'Selesai' },
  no_show:            { bg:'#fee2e2', c:'#991b1b', l:'Tidak Hadir' },
  cancelled_by_user:  { bg:'#fee2e2', c:'#991b1b', l:'Dibatalkan Pasien' },
  cancelled_by_doctor:{ bg:'#fee2e2', c:'#991b1b', l:'Dibatalkan Dokter' },
  cancelled_by_admin: { bg:'#f1f5f9', c:'#475569', l:'Dibatalkan Admin' },
};

const PERIOD_OPTS = [{ v:'today', l:'Hari Ini' },{ v:'7d', l:'7 Hari' },{ v:'30d', l:'30 Hari' },{ v:'custom', l:'Pilih Tanggal' }];

const ManageAppointments = () => {
  const [items, setItems]     = useState(() => getCache('admin:appointments:data', []));
  const [total, setTotal]     = useState(() => getCache('admin:appointments:total', 0));
  const [loading, setLoading] = useState(() => !hasCache('admin:appointments:data'));
  const [period, setPeriod]   = useState('7d');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [status, setStatus]   = useState('');
  const [page, setPage]       = useState(1);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFor, setCancelFor] = useState('admin');
  const [cancelling, setCancelling] = useState(false);

  const fetchData = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (period !== 'custom') params.set('period', period);
      else { if (from) params.set('from', from); if (to) params.set('to', to); }
      if (status) params.set('status', status);
      const r = await api.get(`/api/admin/appointments?${params}`);
      setItems(r.data.appointments || []);
      setTotal(r.data.total || 0);
      if (page === 1 && period === '7d' && !status) {
        setCache('admin:appointments:data', r.data.appointments || []);
        setCache('admin:appointments:total', r.data.total || 0);
      }
    } catch (err) {
      console.error('Gagal memuat janji temu:', err);
      if (!background) toast.error('Gagal memuat data janji temu');
    }
    finally { if (!background) setLoading(false); }
  }, [period, from, to, status, page]);

  useEffect(() => { 
    const isBg = page === 1 && period === '7d' && !status && hasCache('admin:appointments:data');
    fetchData(isBg); 
  }, [fetchData]);

  const handleCheckIn = async (id) => {
    try {
      await api.put(`/api/admin/appointments/${id}/check-in`);
      toast.success('Check-in berhasil');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal check-in'); }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) { toast.error('Alasan wajib diisi'); return; }
    setCancelling(true);
    try {
      await api.put(`/api/admin/appointments/${cancelModal._id}/cancel`, { reason: cancelReason, cancelledFor: cancelFor });
      toast.success('Janji temu dibatalkan & notifikasi terkirim');
      setCancelModal(null); setCancelReason(''); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal membatalkan'); }
    finally { setCancelling(false); }
  };

  const S = {
    periodBar: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
    periodBtn: (a) => ({ padding:'6px 14px', borderRadius:20, border:`1px solid ${a?'#2563eb':'#e2e8f0'}`, background:a?'#2563eb':'#fff', color:a?'#fff':'#475569', fontSize:12, fontWeight:600, cursor:'pointer' }),
    table: { width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:10, overflow:'hidden', border:'1px solid #e2e8f0', fontSize:13 },
    th: { padding:'10px 14px', background:'#f8fafc', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase', textAlign:'left' },
    td: { padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#0f172a', verticalAlign:'middle' },
    btn: (c) => ({ padding:'5px 12px', borderRadius:6, border:'none', background:c, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', marginRight:4 }),
    select: { padding:'7px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12 },
    dateInput: { padding:'6px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12 },
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
    modal: { background:'#fff', borderRadius:16, width:'100%', maxWidth:440, padding:24 },
    label: { fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 },
    field: { width:'100%', padding:'8px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, boxSizing:'border-box' },
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Jakarta' }) : '-';
  const pages = Math.ceil(total / 30);

  return (
    <div>
      <div style={S.periodBar}>
        {PERIOD_OPTS.map(o => <button key={o.v} style={S.periodBtn(period===o.v)} onClick={() => { setPeriod(o.v); setPage(1); }}>{o.l}</button>)}
        {period === 'custom' && <>
          <input type="date" style={S.dateInput} value={from} onChange={e => setFrom(e.target.value)} />
          <span style={{ fontSize:12, color:'#64748b' }}>s/d</span>
          <input type="date" style={S.dateInput} value={to} onChange={e => setTo(e.target.value)} />
        </>}
        <select style={S.select} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Semua Status</option>
          {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}
        </select>
        <span style={{ fontSize:12, color:'#64748b', marginLeft:'auto' }}>{total} janji temu</span>
      </div>

      {loading ? <p style={{ color:'#64748b' }}>Memuat...</p> : (
        <table style={S.table}>
          <thead><tr>{['Jadwal','Pasien','Dokter','Keluhan','Status','Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map(appt => {
              const cfg = STATUS_CFG[appt.status] || { bg:'#f1f5f9', c:'#475569', l:appt.status };
              const canCheckIn = appt.status === 'scheduled';
              const canCancel  = ['scheduled','checked_in'].includes(appt.status);
              return (
                <tr key={appt._id}>
                  <td style={S.td}><div style={{ fontWeight:600 }}>{fmtDate(appt.scheduledAt)}</div><div style={{ fontSize:12, color:'#2563eb' }}>{appt.appointmentTime} WIB</div></td>
                  <td style={S.td}><div style={{ fontWeight:600 }}>{appt.userId?.name || '-'}</div><div style={{ fontSize:11, color:'#64748b' }}>{appt.userId?.phone}</div></td>
                  <td style={S.td}>{fmtDoctorName(appt.doctorId) || '-'}</td>
                  <td style={{ ...S.td, maxWidth:160 }}><div style={{ fontSize:12, color:'#475569', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{appt.complaint || '-'}</div></td>
                  <td style={S.td}><span style={{ background:cfg.bg, color:cfg.c, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{cfg.l}</span></td>
                  <td style={S.td}>
                    {canCheckIn && <button style={S.btn('#16a34a')} onClick={() => handleCheckIn(appt._id)}>✅ Check-In</button>}
                    {canCancel  && <button style={S.btn('#ef4444')} onClick={() => { setCancelModal(appt); setCancelReason(''); setCancelFor('admin'); }}>❌ Batalkan</button>}
                  </td>
                </tr>
              );
            })}
            {!items.length && <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'#94a3b8' }}>Tidak ada data</td></tr>}
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

      {cancelModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
              <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>❌ Batalkan Janji Temu</h3>
              <button onClick={() => setCancelModal(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ fontSize:13, color:'#475569', marginBottom:14 }}>
              <div><strong>Pasien:</strong> {cancelModal.userId?.name}</div>
              <div><strong>Dokter:</strong> {fmtDoctorName(cancelModal.doctorId)}</div>
              <div><strong>Jadwal:</strong> {cancelModal.appointmentTime} WIB</div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={S.label}>Dibatalkan atas nama</label>
              <select style={{ ...S.field }} value={cancelFor} onChange={e => setCancelFor(e.target.value)}>
                <option value="admin">Admin</option>
                <option value="doctor">Dokter</option>
              </select>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={S.label}>Alasan Pembatalan <span style={{ color:'#ef4444' }}>*</span></label>
              <textarea rows={3} style={{ ...S.field, resize:'vertical' }} placeholder="Masukkan alasan yang akan dikirim ke pasien & dokter..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button style={{ flex:1, padding:'10px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:'#64748b', fontWeight:600, cursor:'pointer' }} onClick={() => setCancelModal(null)}>Batal</button>
              <button style={{ flex:2, padding:'10px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', fontWeight:700, cursor:'pointer', opacity: cancelling ? 0.6 : 1 }} disabled={cancelling} onClick={handleCancel}>{cancelling?'Memproses...':'Konfirmasi Pembatalan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ManageAppointments;