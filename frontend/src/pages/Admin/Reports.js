// Admin/Reports.js
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { FaInfoCircle } from 'react-icons/fa';

const PERIOD_OPTS = [
  { v: 'today', l: 'Hari Ini' },
  { v: '7d', l: '7 Hari' },
  { v: '30d', l: '30 Hari' },
  { v: 'custom', l: 'Pilih Tanggal' },
];

// Status yang dikecualikan dari laporan
const EXCLUDED_STATUSES = ['waiting_prescription', 'prescription_rejected', 'refunded', 'refund_requested', 'refund_rejected', 'expired', 'cancelled'];

const Reports = () => {
  const [tab, setTab] = useState('revenue');
  const [subTab, setSubTab] = useState('all');
  const [period, setPeriod] = useState('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const getParams = useCallback(() => {
    const p = new URLSearchParams();
    if (period !== 'custom') {
      p.set('period', period);
    } else {
      if (from) p.set('from', from);
      if (to) p.set('to', to);
    }
    if (tab === 'revenue' && subTab !== 'all') {
      p.set('jenis', subTab === 'consultation' ? 'Konsultasi' : 'Farmasi');
    }
    return p.toString();
  }, [period, from, to, tab, subTab]);

  const handlePreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = tab === 'revenue'
        ? '/api/admin/reports/revenue'
        : '/api/admin/reports/subsidi-mahasiswa';
      
      const url = `${endpoint}?${getParams()}&format=json`;
      console.log('Fetching report:', url);
      
      const response = await api.get(url);
      
      if (response.data && response.data.success !== false) {
        // Filter tambahan di frontend untuk memastikan status yang dikecualikan tidak masuk
        if (tab === 'revenue' && response.data.rows) {
          response.data.rows = response.data.rows.filter(row => 
            !EXCLUDED_STATUSES.includes(row.status?.toLowerCase())
          );
        }
        setPreview(response.data);
      } else {
        throw new Error(response.data?.message || 'Gagal memuat laporan');
      }
    } catch (err) {
      console.error('Report fetch error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Gagal memuat laporan';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [tab, getParams]);

  useEffect(() => {
    if (period === 'custom' && (!from || !to)) return;
    handlePreview();
  }, [tab, period, from, to, subTab, handlePreview]);

  const handleExportCSV = () => {
    const base = tab === 'revenue' ? '/api/admin/reports/revenue' : '/api/admin/reports/subsidi-mahasiswa';
    const token = localStorage.getItem('token');
    const params = getParams();
    const url = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${base}?${params}&format=csv`;
    
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
      })
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const dateStr = from || to || period;
        a.download = `laporan-${tab}-${dateStr}-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success('Export berhasil');
      })
      .catch(err => {
        console.error('Export error:', err);
        toast.error('Gagal export CSV');
      });
  };

  const filteredRows = () => {
    if (!preview?.rows) return [];
    let rows = preview.rows;
    
    // Filter berdasarkan subTab
    if (subTab === 'consultation') {
      rows = rows.filter(r => r.jenis === 'Konsultasi');
    } else if (subTab === 'pharmacy') {
      rows = rows.filter(r => r.jenis === 'Farmasi');
    }
    
    // Filter status yang dikecualikan
    rows = rows.filter(row => !EXCLUDED_STATUSES.includes(row.status?.toLowerCase()));
    
    return rows;
  };

  const subTotal = (rows) => rows.reduce((s, r) => s + (r.nominal || 0), 0);

  const styles = {
    tabBar: { display: 'flex', gap: 6, marginBottom: 20, borderBottom: '2px solid #e2e8f0', paddingBottom: 0 },
    tabBtn: (active) => ({
      padding: '8px 16px',
      border: 'none',
      background: 'none',
      color: active ? '#2563eb' : '#64748b',
      fontWeight: active ? 700 : 400,
      fontSize: 13,
      cursor: 'pointer',
      borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
      marginBottom: -2,
      transition: 'all .2s'
    }),
    subTabBar: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
    subTabBtn: (active, color = '#2563eb') => ({
      padding: '5px 14px',
      borderRadius: 20,
      border: `1px solid ${active ? color : '#e2e8f0'}`,
      background: active ? color : '#fff',
      color: active ? '#fff' : '#475569',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all .2s'
    }),
    periodBar: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
    periodBtn: (active) => ({
      padding: '6px 14px',
      borderRadius: 20,
      border: `1px solid ${active ? '#2563eb' : '#e2e8f0'}`,
      background: active ? '#2563eb' : '#fff',
      color: active ? '#fff' : '#475569',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all .2s'
    }),
    dateInput: { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 },
    btn: (color) => ({
      padding: '8px 18px',
      borderRadius: 8,
      border: 'none',
      background: color,
      color: '#fff',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'opacity .2s'
    }),
    table: { 
      width: '100%', 
      borderCollapse: 'collapse', 
      background: '#fff', 
      borderRadius: 10, 
      overflow: 'hidden', 
      border: '1px solid #e2e8f0', 
      fontSize: 12 
    },
    th: { 
      padding: '10px 12px', 
      background: '#f8fafc', 
      color: '#64748b', 
      fontWeight: 600, 
      fontSize: 11, 
      textTransform: 'uppercase', 
      textAlign: 'left' 
    },
    td: { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#0f172a' },
    summaryCard: (color) => ({ 
      background: color + '15', 
      border: `1px solid ${color}40`, 
      borderRadius: 10, 
      padding: '14px 18px', 
      flex: 1,
      minWidth: 150
    }),
    errorBox: {
      background: '#fee2e2',
      border: '1px solid #fecaca',
      borderRadius: 8,
      padding: '12px 16px',
      marginBottom: 16,
      color: '#991b1b',
      fontSize: 13,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10
    },
    loadingBox: {
      textAlign: 'center',
      padding: 40,
      color: '#64748b'
    },
    infoBox: {
      background: '#eff6ff',
      border: '1px solid #bfdbfe',
      borderRadius: 8,
      padding: '8px 12px',
      marginBottom: 16,
      fontSize: 12,
      color: '#1e40af',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  };

  const fmtRp = n => typeof n === 'number' ? `Rp ${n.toLocaleString('id-ID')}` : (n ?? '-');

  const colsRevenue = ['Tanggal', 'Jenis', 'ID Transaksi', 'Nama Pasien', 'Nama Dokter', 'Nominal', 'Ongkir', 'Total Qty', 'Status'];
  const keysRevenue = ['tanggal', 'jenis', 'id_transaksi', 'nama_pasien', 'nama_dokter', 'nominal', 'ongkir', 'total_qty', 'status'];
  const rpKeys = ['nominal', 'ongkir'];

  const colsSubsidi = ['Tanggal', 'Email Mahasiswa', 'Nama', 'Nama Obat', 'Qty', 'Harga Satuan', 'Total Subsidi'];
  const keysSubsidi = ['tanggal', 'email_mahasiswa', 'nama_mahasiswa', 'nama_obat', 'qty', 'harga_satuan', 'total_subsidi'];
  const rpKeysSubsidi = ['harga_satuan', 'total_subsidi'];

  const cols = tab === 'revenue' ? colsRevenue : colsSubsidi;
  const keys = tab === 'revenue' ? keysRevenue : keysSubsidi;
  const rpK = tab === 'revenue' ? rpKeys : rpKeysSubsidi;

  const rows = filteredRows();
  const rowsAll = preview?.rows?.filter(r => !EXCLUDED_STATUSES.includes(r.status?.toLowerCase())) || [];
  const rowsConsult = rowsAll.filter(r => r.jenis === 'Konsultasi');
  const rowsPharm = rowsAll.filter(r => r.jenis === 'Farmasi');

  return (
    <div>
      {/* Main tab */}
      <div style={styles.tabBar}>
        <button 
          style={styles.tabBtn(tab === 'revenue')} 
          onClick={() => { 
            setTab('revenue'); 
            setSubTab('all'); 
            setPreview(null); 
            setError(null);
          }}
        >
          💰 Laporan Pendapatan
        </button>
        <button 
          style={styles.tabBtn(tab === 'subsidi')} 
          onClick={() => { 
            setTab('subsidi'); 
            setSubTab('all'); 
            setPreview(null); 
            setError(null);
          }}
        >
          🎓 Subsidi Mahasiswa
        </button>
      </div>

      {/* Info box tentang status yang dikecualikan */}
      {tab === 'revenue' && (
        <div style={styles.infoBox}>
          <FaInfoCircle size={14} />
          <span>Laporan tidak menampilkan data dengan status: Menunggu Verifikasi Resep, Resep Ditolak, Refund, Expired, dan Dibatalkan.</span>
        </div>
      )}

      {/* Sub-tab hanya untuk revenue */}
      {tab === 'revenue' && preview && (
        <div style={styles.subTabBar}>
          <button style={styles.subTabBtn(subTab === 'all')} onClick={() => setSubTab('all')}>
            Semua ({rowsAll.length})
          </button>
          <button style={styles.subTabBtn(subTab === 'consultation', '#2563eb')} onClick={() => setSubTab('consultation')}>
            💬 Konsultasi ({rowsConsult.length})
          </button>
          <button style={styles.subTabBtn(subTab === 'pharmacy', '#7c3aed')} onClick={() => setSubTab('pharmacy')}>
            💊 Farmasi ({rowsPharm.length})
          </button>
        </div>
      )}

      {/* Period filter */}
      <div style={styles.periodBar}>
        {PERIOD_OPTS.map(o => (
          <button 
            key={o.v} 
            style={styles.periodBtn(period === o.v)} 
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
              style={styles.dateInput} 
              value={from} 
              onChange={e => setFrom(e.target.value)} 
            />
            <span style={{ fontSize: 12, color: '#64748b' }}>s/d</span>
            <input 
              type="date" 
              style={styles.dateInput} 
              value={to} 
              onChange={e => setTo(e.target.value)} 
            />
          </>
        )}
        <button 
          style={styles.btn('#2563eb')} 
          disabled={loading} 
          onClick={handlePreview}
        >
          {loading ? '⏳ Memuat...' : '👁️ Preview'}
        </button>
        <button 
          style={styles.btn('#16a34a')} 
          onClick={handleExportCSV}
          disabled={!preview || loading}
        >
          ⬇️ Export CSV
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div style={styles.errorBox}>
          <span>⚠️ {error}</span>
          <button 
            onClick={handlePreview} 
            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={styles.loadingBox}>
          <div>⏳ Memuat data laporan...</div>
        </div>
      )}

      {/* Summary cards (revenue only) */}
      {preview && tab === 'revenue' && !loading && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={styles.summaryCard('#2563eb')}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>TOTAL SEMUA</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{fmtRp(subTotal(rowsAll))}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{rowsAll.length} transaksi</div>
          </div>
          <div style={styles.summaryCard('#2563eb')}>
            <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, marginBottom: 4 }}>💬 KONSULTASI</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{fmtRp(subTotal(rowsConsult))}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{rowsConsult.length} transaksi</div>
          </div>
          <div style={styles.summaryCard('#7c3aed')}>
            <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600, marginBottom: 4 }}>💊 FARMASI</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{fmtRp(subTotal(rowsPharm))}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{rowsPharm.length} transaksi</div>
          </div>
        </div>
      )}

      {/* Summary for subsidi */}
      {preview && tab === 'subsidi' && !loading && (
        <div style={{ ...styles.summaryCard('#7c3aed'), marginBottom: 18, display: 'inline-block' }}>
          <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600, marginBottom: 4 }}>TOTAL SUBSIDI</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Rp {(preview.grandTotal || 0).toLocaleString('id-ID')}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{preview.rows?.length || 0} item</div>
        </div>
      )}

      {/* Table */}
      {preview && !loading && (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {cols.map(c => <th key={c} style={styles.th}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  {keys.map(k => (
                    <td key={k} style={{ ...styles.td, fontWeight: k === 'jenis' ? 600 : 400 }}>
                      {k === 'jenis' ? (
                        <span style={{
                          background: row[k] === 'Konsultasi' ? '#dbeafe' : '#ede9fe',
                          color: row[k] === 'Konsultasi' ? '#1e40af' : '#5b21b6',
                          borderRadius: 20,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 700
                        }}>
                          {row[k]}
                        </span>
                      ) : rpK.includes(k) ? fmtRp(row[k]) : (row[k] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length > 200 && (
                <tr>
                  <td colSpan={cols.length} style={{ ...styles.td, textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                    ... {rows.length - 200} baris lainnya. Export CSV untuk data lengkap.
                  </td>
                </tr>
              )}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={cols.length} style={{ ...styles.td, textAlign: 'center', color: '#94a3b8', padding: 32 }}>
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