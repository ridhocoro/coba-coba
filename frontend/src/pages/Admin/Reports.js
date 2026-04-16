import React, { useState } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';

const PERIOD_OPTS = [
  { v:'today', l:'Hari Ini' },
  { v:'7d',   l:'7 Hari'   },
  { v:'30d',  l:'30 Hari'  },
  { v:'custom', l:'Pilih Tanggal' },
];

const Reports = () => {
  const [tab,     setTab]     = useState('revenue');       // 'revenue' | 'subsidi'
  const [subTab,  setSubTab]  = useState('all');           // 'all' | 'consultation' | 'pharmacy'
  const [period,  setPeriod]  = useState('30d');
  const [from,    setFrom]    = useState('');
  const [to,      setTo]      = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  const getParams = () => {
    const p = new URLSearchParams();
    if (period !== 'custom') p.set('period', period);
    else { if (from) p.set('from', from); if (to) p.set('to', to); }
    return p.toString();
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const endpoint = tab === 'revenue'
        ? '/api/admin/reports/revenue'
        : '/api/admin/reports/subsidi-mahasiswa';
      const r = await api.get(`${endpoint}?${getParams()}&format=json`);
      setPreview(r.data);
    } catch { toast.error('Gagal memuat laporan'); }
    finally { setLoading(false); }
  };

  const handleExportCSV = () => {
    const base  = tab === 'revenue' ? '/api/admin/reports/revenue' : '/api/admin/reports/subsidi-mahasiswa';
    const token = localStorage.getItem('token');
    const params = getParams();
    const subFilter = (tab === 'revenue' && subTab !== 'all') ? `&jenis=${subTab === 'consultation' ? 'Konsultasi' : 'Farmasi'}` : '';
    const url   = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${base}?${params}&format=csv${subFilter}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href     = URL.createObjectURL(blob);
        a.download = `laporan-${tab}-${subTab}-${from||period}-${to||''}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error('Gagal export CSV'));
  };

  // Filter rows berdasarkan subTab
  const filteredRows = () => {
    if (!preview?.rows) return [];
    if (subTab === 'all') return preview.rows;
    if (subTab === 'consultation') return preview.rows.filter(r => r.jenis === 'Konsultasi');
    if (subTab === 'pharmacy')     return preview.rows.filter(r => r.jenis === 'Farmasi');
    return preview.rows;
  };

  const subTotal = (rows) => rows.reduce((s, r) => s + (r.nominal || 0), 0);

  const S = {
    tabBar: { display:'flex', gap:6, marginBottom:20, borderBottom:'2px solid #e2e8f0', paddingBottom:0 },
    tabBtn: (a) => ({
      padding:'8px 16px', border:'none', background:'none',
      color: a?'#2563eb':'#64748b', fontWeight: a?700:400, fontSize:13, cursor:'pointer',
      borderBottom: a?'2px solid #2563eb':'2px solid transparent', marginBottom:-2,
    }),
    subTabBar: { display:'flex', gap:6, marginBottom:16 },
    subTabBtn: (a, color='#2563eb') => ({
      padding:'5px 14px', borderRadius:20, border:`1px solid ${a?color:'#e2e8f0'}`,
      background: a?color:'#fff', color: a?'#fff':'#475569', fontSize:12, fontWeight:600, cursor:'pointer',
    }),
    periodBar: { display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' },
    periodBtn: (a) => ({ padding:'6px 14px', borderRadius:20, border:`1px solid ${a?'#2563eb':'#e2e8f0'}`, background:a?'#2563eb':'#fff', color:a?'#fff':'#475569', fontSize:12, fontWeight:600, cursor:'pointer' }),
    dateInput: { padding:'6px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12 },
    btn: (c) => ({ padding:'8px 18px', borderRadius:8, border:'none', background:c, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }),
    table: { width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:10, overflow:'hidden', border:'1px solid #e2e8f0', fontSize:12 },
    th: { padding:'8px 12px', background:'#f8fafc', color:'#64748b', fontWeight:600, fontSize:10, textTransform:'uppercase', textAlign:'left' },
    td: { padding:'8px 12px', borderBottom:'1px solid #f1f5f9', color:'#0f172a' },
    summaryCard: (color) => ({ background: color + '15', border:`1px solid ${color}40`, borderRadius:10, padding:'14px 18px', flex:1 }),
  };

  const fmtRp = n => typeof n === 'number' ? `Rp ${n.toLocaleString('id-ID')}` : (n ?? '-');

  // Revenue columns
  const colsRevenue = ['Tanggal','Jenis','ID Transaksi','Nama Pasien','Nama Dokter','Nominal','Ongkir','Total Qty','Status'];
  const keysRevenue = ['tanggal','jenis','id_transaksi','nama_pasien','nama_dokter','nominal','ongkir','total_qty','status'];
  const rpKeys      = ['nominal','ongkir'];

  // Subsidi columns
  const colsSubsidi = ['Tanggal','Email Mahasiswa','Nama','Nama Obat','Qty','Harga Satuan','Total Subsidi'];
  const keysSubsidi = ['tanggal','email_mahasiswa','nama_mahasiswa','nama_obat','qty','harga_satuan','total_subsidi'];
  const rpKeysSubsidi = ['harga_satuan','total_subsidi'];

  const cols = tab === 'revenue' ? colsRevenue : colsSubsidi;
  const keys = tab === 'revenue' ? keysRevenue : keysSubsidi;
  const rpK  = tab === 'revenue' ? rpKeys : rpKeysSubsidi;

  const rows   = filteredRows();
  const rowsAll    = preview?.rows?.filter(r => true)         || [];
  const rowsConsult = preview?.rows?.filter(r => r.jenis === 'Konsultasi') || [];
  const rowsPharm   = preview?.rows?.filter(r => r.jenis === 'Farmasi')    || [];

  return (
    <div>
      {/* Main tab */}
      <div style={S.tabBar}>
        <button style={S.tabBtn(tab==='revenue')} onClick={() => { setTab('revenue'); setSubTab('all'); setPreview(null); }}>💰 Laporan Pendapatan</button>
        <button style={S.tabBtn(tab==='subsidi')} onClick={() => { setTab('subsidi'); setSubTab('all'); setPreview(null); }}>🎓 Subsidi Mahasiswa</button>
      </div>

      {/* Sub-tab hanya untuk revenue */}
      {tab === 'revenue' && preview && (
        <div style={S.subTabBar}>
          <button style={S.subTabBtn(subTab==='all')} onClick={() => setSubTab('all')}>
            Semua ({rowsAll.length})
          </button>
          <button style={S.subTabBtn(subTab==='consultation', '#2563eb')} onClick={() => setSubTab('consultation')}>
            💬 Konsultasi ({rowsConsult.length})
          </button>
          <button style={S.subTabBtn(subTab==='pharmacy', '#7c3aed')} onClick={() => setSubTab('pharmacy')}>
            💊 Farmasi ({rowsPharm.length})
          </button>
        </div>
      )}

      {/* Period filter */}
      <div style={S.periodBar}>
        {PERIOD_OPTS.map(o => (
          <button key={o.v} style={S.periodBtn(period===o.v)} onClick={() => setPeriod(o.v)}>{o.l}</button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" style={S.dateInput} value={from} onChange={e => setFrom(e.target.value)} />
            <span style={{ fontSize:12, color:'#64748b' }}>s/d</span>
            <input type="date" style={S.dateInput} value={to} onChange={e => setTo(e.target.value)} />
          </>
        )}
        <button style={S.btn('#2563eb')} disabled={loading} onClick={handlePreview}>
          {loading ? '⏳ Memuat...' : '👁️ Preview'}
        </button>
        <button style={S.btn('#16a34a')} onClick={handleExportCSV}>⬇️ Export CSV</button>
      </div>

      {/* Summary cards (revenue only) */}
      {preview && tab === 'revenue' && (
        <div style={{ display:'flex', gap:12, marginBottom:18, flexWrap:'wrap' }}>
          <div style={S.summaryCard('#2563eb')}>
            <div style={{ fontSize:11, color:'#64748b', fontWeight:600, marginBottom:4 }}>TOTAL SEMUA</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#0f172a' }}>{fmtRp(subTotal(rowsAll))}</div>
            <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{rowsAll.length} transaksi</div>
          </div>
          <div style={S.summaryCard('#2563eb')}>
            <div style={{ fontSize:11, color:'#2563eb', fontWeight:600, marginBottom:4 }}>💬 KONSULTASI</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#0f172a' }}>{fmtRp(subTotal(rowsConsult))}</div>
            <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{rowsConsult.length} transaksi</div>
          </div>
          <div style={S.summaryCard('#7c3aed')}>
            <div style={{ fontSize:11, color:'#7c3aed', fontWeight:600, marginBottom:4 }}>💊 FARMASI</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#0f172a' }}>{fmtRp(subTotal(rowsPharm))}</div>
            <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{rowsPharm.length} transaksi</div>
          </div>
        </div>
      )}

      {/* Summary for subsidi */}
      {preview && tab === 'subsidi' && (
        <div style={{ ...S.summaryCard('#7c3aed'), marginBottom:18, display:'inline-block' }}>
          <div style={{ fontSize:11, color:'#7c3aed', fontWeight:600, marginBottom:4 }}>TOTAL SUBSIDI</div>
          <div style={{ fontSize:20, fontWeight:700 }}>Rp {(preview.grandTotal||0).toLocaleString('id-ID')}</div>
          <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{preview.rows?.length||0} item</div>
        </div>
      )}

      {/* Table */}
      {preview && (
        <div style={{ overflowX:'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>{cols.map(c => <th key={c} style={S.th}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((row, i) => (
                <tr key={i} style={{ background: i%2===0?'#fff':'#fafafa' }}>
                  {keys.map(k => (
                    <td key={k} style={{ ...S.td, fontWeight: k==='jenis'?600:400 }}>
                      {k === 'jenis' ? (
                        <span style={{
                          background: row[k]==='Konsultasi'?'#dbeafe':'#ede9fe',
                          color: row[k]==='Konsultasi'?'#1e40af':'#5b21b6',
                          borderRadius:20, padding:'2px 8px', fontSize:11, fontWeight:700
                        }}>{row[k]}</span>
                      ) : rpK.includes(k) ? fmtRp(row[k]) : (row[k] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length > 200 && (
                <tr>
                  <td colSpan={cols.length} style={{ ...S.td, textAlign:'center', color:'#64748b', fontStyle:'italic' }}>
                    ... {rows.length - 200} baris lainnya. Export CSV untuk data lengkap.
                  </td>
                </tr>
              )}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={cols.length} style={{ ...S.td, textAlign:'center', color:'#94a3b8', padding:32 }}>
                    Tidak ada data untuk periode ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Reports;