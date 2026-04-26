// Admin/Dashboard.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import api from '../../utils/api';
import { fmtDoctorName } from '../../utils/format';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler,
);

/* ─── Formatters ─────────────────────────────────────────── */
const fmtNum  = n => Number(n || 0).toLocaleString('id-ID');
const fmtDate = d => {
  const dt = new Date(d);
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};
const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','Mei','Jun',
  'Jul','Agu','Sep','Okt','Nov','Des',
];

/* ─── Primitive Components ───────────────────────────────── */
const Card = ({ children, style = {} }) => (
  <div style={{
    background: '#fff', borderRadius: 12,
    border: '1px solid #e2e8f0', padding: 20, ...style,
  }}>
    {children}
  </div>
);

const StatBox = ({ label, value, icon, color = '#2563eb', onClick, clickable, loading }) => (
  <div
    onClick={onClick}
    style={{
      background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
      padding: '16px 18px', cursor: clickable ? 'pointer' : 'default',
      transition: 'all .15s', borderLeft: `4px solid ${color}`,
    }}
    onMouseEnter={e => { if (clickable) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{
          fontSize: 11, color: '#64748b', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6,
        }}>
          {label}
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>
          {loading ? <span style={{ fontSize: 18 }}>⏳</span> : value}
        </div>
      </div>
      <span style={{ fontSize: 28 }}>{icon}</span>
    </div>
    {clickable && !loading && (
      <div style={{ fontSize: 11, color, marginTop: 8, fontWeight: 600 }}>Klik untuk lihat →</div>
    )}
  </div>
);

/* ─── Period selector options ────────────────────────────── */
const PERIOD_OPTS = [
  { v: 'today',  l: 'Hari Ini' },
  { v: '7d',     l: '7 Hari' },
  { v: '30d',    l: '30 Hari' },
  { v: 'custom', l: 'Pilih Tanggal' },
];

/* ─── Analytics mode options ─────────────────────────────── */
const ANALYTICS_MODES = [
  { v: '7d',      l: '7 Hari Terakhir' },
  { v: '30d',     l: '30 Hari Terakhir' },
  { v: 'compare', l: 'Perbandingan Bulan' },
];

/* ─── Chart.js shared options ────────────────────────────── */
const chartOptions = (title) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: false },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#94a3b8',
      bodyColor: '#f1f5f9',
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: ctx => ` ${ctx.dataset.label || 'Jumlah'}: ${fmtNum(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#94a3b8', font: { size: 11 } },
    },
    y: {
      grid: { color: '#f1f5f9' },
      ticks: { color: '#94a3b8', font: { size: 11 }, precision: 0 },
      beginAtZero: true,
    },
  },
});

const compareChartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: { color: '#475569', font: { size: 11 }, boxWidth: 12, padding: 12 },
    },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#94a3b8',
      bodyColor: '#f1f5f9',
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: ctx => ` ${ctx.dataset.label}: ${fmtNum(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#94a3b8', font: { size: 10 } },
    },
    y: {
      grid: { color: '#f1f5f9' },
      ticks: { color: '#94a3b8', font: { size: 11 }, precision: 0 },
      beginAtZero: true,
    },
  },
});

/* ─── Helper: current year/month ─────────────────────────── */
const getYM = (offsetMonths = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return { year: d.getFullYear(), month: d.getMonth() }; // month 0-indexed
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
const AdminDashboard = ({ onNavigate }) => {

  /* ── Ops + Growth ── */
  const [ops,     setOps]     = useState(null);
  const [growth,  setGrowth]  = useState(null);
  const [period,  setPeriod]  = useState('30d');
  const [from,    setFrom]    = useState('');
  const [to,      setTo]      = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* ── Analytics (frequency charts) ── */
  const [analyticsMode,    setAnalyticsMode]    = useState('30d');
  const [apptData,         setApptData]         = useState(null);   // Chart.js data object
  const [consultData,      setConsultData]      = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  /* ── Compare month pickers ── */
  const cur  = getYM(0);
  const prev = getYM(-1);
  const [monthA, setMonthA] = useState({ year: cur.year,  month: cur.month  });
  const [monthB, setMonthB] = useState({ year: prev.year, month: prev.month });

  /* ════════ Fetch ops + growth ════════ */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = period === 'custom'
        ? `period=custom&from=${from}&to=${to}`
        : `period=${period}`;

      const [opsR, grwR] = await Promise.allSettled([
        api.get('/api/admin/analytics/operational'),
        api.get(`/api/admin/analytics/growth?${params}`),
      ]);

      setOps(opsR.status === 'fulfilled'  ? opsR.value?.data  : null);
      setGrowth(grwR.status === 'fulfilled' ? grwR.value?.data : null);

      if (opsR.status  === 'rejected') console.error('[Dashboard] operational:', opsR.reason?.message);
      if (grwR.status  === 'rejected') console.error('[Dashboard] growth:',      grwR.reason?.message);
    } catch (e) {
      setError('Gagal memuat data dashboard. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [period, from, to]);

  useEffect(() => {
    if (period !== 'custom' || (from && to)) fetchAll();
  }, [fetchAll, period, from, to]);

  /* ════════ Fetch analytics (frequency time-series) ════════
   *
   * Endpoint yang digunakan:
   *   GET /api/admin/analytics/appointments/frequency?period=7d|30d
   *   GET /api/admin/analytics/appointments/frequency?period=month&year=YYYY&month=MM
   *   GET /api/admin/analytics/consultations/frequency?period=7d|30d
   *   GET /api/admin/analytics/consultations/frequency?period=month&year=YYYY&month=MM
   *
   * Response shape: { success: true, data: [{ date: "2025-04-01", count: 12 }, ...] }
   *
   ═══════════════════════════════════════════════════════════ */
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      /* ── mode 7d / 30d ── */
      if (analyticsMode !== 'compare') {
        const [apptR, consultR] = await Promise.allSettled([
          api.get(`/api/admin/analytics/appointments/frequency?period=${analyticsMode}`),
          api.get(`/api/admin/analytics/consultations/frequency?period=${analyticsMode}`),
        ]);

        const toPoints = r =>
          (r.status === 'fulfilled' ? r.value?.data?.data || [] : [])
            .map(item => ({ label: fmtDate(item.date), count: item.count || 0 }));

        const apptPoints    = toPoints(apptR);
        const consultPoints = toPoints(consultR);

        setApptData({
          labels: apptPoints.map(p => p.label),
          datasets: [{
            label: 'Janji Temu',
            data: apptPoints.map(p => p.count),
            borderColor: '#0891b2',
            backgroundColor: 'rgba(8,145,178,.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: '#0891b2',
          }],
        });

        setConsultData({
          labels: consultPoints.map(p => p.label),
          datasets: [{
            label: 'Konsultasi',
            data: consultPoints.map(p => p.count),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: '#2563eb',
          }],
        });

      /* ── mode compare ── */
      } else {
        const pad    = m => String(m + 1).padStart(2, '0');
        const qA     = `period=month&year=${monthA.year}&month=${pad(monthA.month)}`;
        const qB     = `period=month&year=${monthB.year}&month=${pad(monthB.month)}`;
        const labelA = `${MONTH_NAMES[monthA.month]} ${monthA.year}`;
        const labelB = `${MONTH_NAMES[monthB.month]} ${monthB.year}`;

        const [apptAr, apptBr, consultAr, consultBr] = await Promise.allSettled([
          api.get(`/api/admin/analytics/appointments/frequency?${qA}`),
          api.get(`/api/admin/analytics/appointments/frequency?${qB}`),
          api.get(`/api/admin/analytics/consultations/frequency?${qA}`),
          api.get(`/api/admin/analytics/consultations/frequency?${qB}`),
        ]);

        /* Merge two month arrays into day-keyed map [1..31] */
        const mergeMonths = (rA, rB) => {
          const mapA = {}, mapB = {};
          (rA.status === 'fulfilled' ? rA.value?.data?.data || [] : [])
            .forEach(r => { mapA[new Date(r.date).getDate()] = r.count || 0; });
          (rB.status === 'fulfilled' ? rB.value?.data?.data || [] : [])
            .forEach(r => { mapB[new Date(r.date).getDate()] = r.count || 0; });
          const maxDay = Math.max(
            ...Object.keys(mapA).map(Number),
            ...Object.keys(mapB).map(Number),
            0,
          );
          const days    = Array.from({ length: maxDay || 0 }, (_, i) => String(i + 1));
          const countA  = days.map((_, i) => mapA[i + 1] || 0);
          const countB  = days.map((_, i) => mapB[i + 1] || 0);
          return { days, countA, countB };
        };

        const appt    = mergeMonths(apptAr,    apptBr);
        const consult = mergeMonths(consultAr,  consultBr);

        setApptData({
          labels: appt.days,
          datasets: [
            {
              label: labelA,
              data: appt.countA,
              backgroundColor: 'rgba(8,145,178,.75)',
              borderColor: '#0891b2',
              borderWidth: 1,
              borderRadius: 4,
            },
            {
              label: labelB,
              data: appt.countB,
              backgroundColor: 'rgba(8,145,178,.3)',
              borderColor: '#0891b2',
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        });

        setConsultData({
          labels: consult.days,
          datasets: [
            {
              label: labelA,
              data: consult.countA,
              backgroundColor: 'rgba(37,99,235,.75)',
              borderColor: '#2563eb',
              borderWidth: 1,
              borderRadius: 4,
            },
            {
              label: labelB,
              data: consult.countB,
              backgroundColor: 'rgba(37,99,235,.3)',
              borderColor: '#2563eb',
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        });
      }
    } catch (e) {
      console.error('[Dashboard] analytics error:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsMode, monthA, monthB]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  /* ════════ Styles ════════ */
  const S = {
    section:      { marginBottom: 28 },
    sectionTitle: {
      fontSize: 13, fontWeight: 700, color: '#475569',
      textTransform: 'uppercase', letterSpacing: .8, marginBottom: 14,
    },
    grid3: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: 12,
    },
    row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 },
    chip: active => ({
      padding: '6px 14px', borderRadius: 20,
      border: `1px solid ${active ? '#2563eb' : '#e2e8f0'}`,
      background: active ? '#2563eb' : '#fff',
      color: active ? '#fff' : '#475569',
      fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
    }),
    dateInput: {
      padding: '5px 10px', border: '1px solid #e2e8f0',
      borderRadius: 8, fontSize: 12, color: '#475569',
    },
    chartWrap: { height: 200, position: 'relative' },
    emptyChart: {
      height: 200, display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#94a3b8',
    },
    errorBox: {
      background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 12,
      padding: '16px 20px', textAlign: 'center', marginBottom: 20,
    },
    retryBtn: {
      marginTop: 12, padding: '8px 20px', background: '#ef4444',
      color: '#fff', border: 'none', borderRadius: 8,
      fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
  };

  /* ─── Month select sub-component ─────────────────────────── */
  const MonthSelect = ({ label, value, onChange }) => {
    const curYear = new Date().getFullYear();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{label}</span>
        <select value={value.month} onChange={e => onChange({ ...value, month: +e.target.value })} style={S.dateInput}>
          {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={value.year} onChange={e => onChange({ ...value, year: +e.target.value })} style={S.dateInput}>
          {[curYear - 1, curYear].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    );
  };

  /* ─── Frequency chart card ───────────────────────────────── */
  const FreqCard = ({ title, icon, color, data, isCompare }) => {
    const isEmpty = !data || !data.labels || data.labels.length === 0;
    const ChartComp = isCompare ? Bar : Line;
    const opts = isCompare ? compareChartOptions() : chartOptions(title);

    return (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{
            display: 'inline-block', width: 10, height: 10,
            borderRadius: '50%', background: color, flexShrink: 0,
          }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{icon} {title}</span>
        </div>

        {analyticsLoading ? (
          <div style={S.emptyChart}>
            <span style={{ fontSize: 24 }}>⏳</span>
            <span style={{ fontSize: 12 }}>Memuat data...</span>
          </div>
        ) : isEmpty ? (
          <div style={S.emptyChart}>
            <span style={{ fontSize: 30 }}>📭</span>
            <span style={{ fontSize: 12 }}>Tidak ada data untuk periode ini</span>
          </div>
        ) : (
          <div style={S.chartWrap}>
            <ChartComp data={data} options={opts} />
          </div>
        )}
      </Card>
    );
  };

  /* ─── Rating rata-rata dari growth.doctors ───────────────── */
  const avgDoctorRating = (() => {
    if (!growth?.doctors || growth.doctors.length === 0) return 0;
    const rated = growth.doctors.filter(d => d.rating > 0);
    if (rated.length === 0) return 0;
    const avg = rated.reduce((s, d) => s + parseFloat(d.rating || 0), 0) / rated.length;
    return avg.toFixed(1);
  })();

  /* ─── Error state ─────────────────────────────────────────── */
  if (error) {
    return (
      <div style={S.errorBox}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
        <p style={{ color: '#991b1b', marginBottom: 12 }}>{error}</p>
        <button onClick={fetchAll} style={S.retryBtn}>🔄 Coba Lagi</button>
      </div>
    );
  }

  /* ════════════════════════ RENDER ═══════════════════════════ */
  return (
    <div>

      {/* ── Period selector (untuk Operasional & Growth) ── */}
      <div style={S.row}>
        {PERIOD_OPTS.map(o => (
          <button
            key={o.v}
            style={S.chip(period === o.v)}
            onClick={() => {
              setPeriod(o.v);
              if (o.v !== 'custom') { setFrom(''); setTo(''); }
            }}
          >
            {o.l}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={S.dateInput} />
            <span style={{ color: '#64748b', fontSize: 12 }}>s/d</span>
            <input type="date" value={to}   onChange={e => setTo(e.target.value)}   style={S.dateInput} />
          </>
        )}
        {loading && <span style={{ fontSize: 12, color: '#94a3b8' }}>⏳ Memuat...</span>}
      </div>

      {/* ════════════════════════════════════════════════════
          BLOK 1 — Operasional Hari Ini
      ════════════════════════════════════════════════════ */}
      <div style={S.section}>
        <p style={S.sectionTitle}>⚙️ Operasional Hari Ini</p>
        <div style={S.grid3}>
          <StatBox
            label="Resep Menunggu Verifikasi"
            value={fmtNum(ops?.pendingRx)}
            icon="📋" color="#f59e0b" clickable
            onClick={() => onNavigate('pharmacy')}
            loading={loading && !ops}
          />
          <StatBox
            label="Perlu Disiapkan"
            value={fmtNum(ops?.needsPreparation)}
            icon="💊" color="#ef4444" clickable
            onClick={() => onNavigate('pharmacy')}
            loading={loading && !ops}
          />
          <StatBox
            label="Siap Diambil"
            value={fmtNum(ops?.pickupReady)}
            icon="🏥" color="#8b5cf6" clickable
            onClick={() => onNavigate('pharmacy')}
            loading={loading && !ops}
          />
          <StatBox
            label="Janji Temu Hari Ini"
            value={fmtNum(ops?.todayAppt)}
            icon="📅" color="#0891b2" clickable
            onClick={() => onNavigate('appointments')}
            loading={loading && !ops}
          />
          <StatBox
            label="Konsultasi Hari Ini"
            value={fmtNum(ops?.todayConsult)}
            icon="💬" color="#2563eb" clickable
            onClick={() => onNavigate('consultations')}
            loading={loading && !ops}
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          BLOK 2 — Analytics Frekuensi
      ════════════════════════════════════════════════════ */}
      <div style={S.section}>
        <p style={S.sectionTitle}>📊 Analytics Frekuensi</p>

        {/* Mode bar */}
        <div style={S.row}>
          {ANALYTICS_MODES.map(o => (
            <button key={o.v} style={S.chip(analyticsMode === o.v)} onClick={() => setAnalyticsMode(o.v)}>
              {o.l}
            </button>
          ))}
          {/* Compare pickers */}
          {analyticsMode === 'compare' && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <MonthSelect label="Bulan A:" value={monthA} onChange={setMonthA} />
              <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>vs</span>
              <MonthSelect label="Bulan B:" value={monthB} onChange={setMonthB} />
            </div>
          )}
          {analyticsLoading && <span style={{ fontSize: 12, color: '#94a3b8' }}>⏳ Memuat grafik...</span>}
        </div>

        {/* Grafik side-by-side */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <FreqCard
            title="Janji Temu" icon="📅" color="#0891b2"
            data={apptData} isCompare={analyticsMode === 'compare'}
          />
          <FreqCard
            title="Konsultasi" icon="💬" color="#2563eb"
            data={consultData} isCompare={analyticsMode === 'compare'}
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          BLOK 3 — Growth & Statistik
          "Pasien Baru" = pasien yang created_at-nya jatuh
          dalam rentang periode yang sedang dipilih.
          Misal: periode "7 Hari" → pasien yang mendaftar
          dalam 7 hari terakhir; "Hari Ini" → yang mendaftar
          hari ini; "Custom" → sesuai tanggal yang dipilih.
      ════════════════════════════════════════════════════ */}
      <div style={S.section}>
        <p style={S.sectionTitle}>📈 Growth & Statistik</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <StatBox
            label={`Pasien Baru (${PERIOD_OPTS.find(o => o.v === period)?.l || period})`}
            value={fmtNum(growth?.newPatients)}
            icon="👤" color="#2563eb" clickable
            onClick={() => onNavigate('users')}
            loading={loading && !growth}
          />
          <StatBox
            label="Total Pasien"
            value={fmtNum(growth?.totalPatients)}
            icon="👥" color="#0891b2"
            loading={loading && !growth}
          />
          <StatBox
            label="Total Dokter"
            value={fmtNum(growth?.totalDoctors)}
            icon="👨‍⚕️" color="#7c3aed" clickable
            onClick={() => onNavigate('doctors')}
            loading={loading && !growth}
          />
          <StatBox
            label="Dokter Aktif"
            value={fmtNum(growth?.activeDoctors)}
            icon="✅" color="#16a34a"
            loading={loading && !growth}
          />
          {/* Rating rata-rata dari semua dokter aktif (field Doctor.rating di MySQL) */}
          <StatBox
            label="Rating Rata-rata Dokter"
            value={loading && !growth ? undefined : `${avgDoctorRating} ⭐`}
            icon="⭐" color="#f59e0b"
            loading={loading && !growth}
          />
        </div>
      </div>

      {/* Initial loading skeleton */}
      {loading && !ops && !growth && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <p>Memuat dashboard...</p>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;