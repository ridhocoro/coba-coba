// Admin/Dashboard.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler, ArcElement,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import api from '../../utils/api';
import { fmtDoctorName } from '../../utils/format';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler, ArcElement,
);

/* ─── Formatters ─────────────────────────────────────────── */
const fmtNum  = n => Number(n || 0).toLocaleString('id-ID');
const fmtDate = d => {
  const dt = new Date(d);
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

/* ─── Colors ─────────────────────────────────────────────── */
const CATEGORY_COLORS = {
  'ISPA':                '#ef4444',
  'Hipertensi':          '#f97316',
  'Diabetes':            '#eab308',
  'Gangguan Pencernaan': '#22c55e',
  'Penyakit Kulit':      '#14b8a6',
  'Gangguan Jantung':    '#e11d48',
  'Gangguan Paru':       '#06b6d4',
  'Gangguan Saraf':      '#8b5cf6',
  'Gangguan Mata':       '#3b82f6',
  'Gangguan Ginjal':     '#f59e0b',
  'Gangguan Mental':     '#a855f7',
  'Karies Gigi':         '#84cc16',
  'Sakit Gusi':          '#10b981',
  'Abses Gigi':          '#f43f5e',
  'Gigi Sensitif':       '#fb923c',
  'Gigi Bungsu':         '#a16207',
  'Malnutrisi':          '#0ea5e9',
  'Obesitas':            '#6366f1',
  'Anemia':              '#ec4899',
  'Gangguan Makan':      '#d946ef',
  'Defisiensi Vitamin':  '#0d9488',
  'Kehamilan':           '#f472b6',
  'Gangguan Menstruasi': '#e879f9',
  'Kontrasepsi':         '#c084fc',
  'Tumbuh Kembang Anak': '#34d399',
  'Imunisasi':           '#60a5fa',
  'Lainnya':             '#94a3b8',
};

/* ─── Primitive Components ───────────────────────────────── */
const Card = ({ children, style = {} }) => (
  <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, ...style }}>
    {children}
  </div>
);

const StatBox = ({ label, value, icon, color = '#2563eb', onClick, clickable, loading }) => (
  <div onClick={onClick} style={{
    background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
    padding: '16px 18px', cursor: clickable ? 'pointer' : 'default',
    transition: 'all .15s', borderLeft: `4px solid ${color}`,
  }}
    onMouseEnter={e => { if (clickable) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>
          {loading ? <span style={{ fontSize: 18 }}>⏳</span> : value}
        </div>
      </div>
      <span style={{ fontSize: 28 }}>{icon}</span>
    </div>
    {clickable && !loading && <div style={{ fontSize: 11, color, marginTop: 8, fontWeight: 600 }}>Klik untuk lihat →</div>}
  </div>
);

/* ─── Period options ─────────────────────────────────────── */
const PERIOD_OPTS = [
  { v: 'today',  l: 'Hari Ini'      },
  { v: '7d',     l: '7 Hari'        },
  { v: '30d',    l: '30 Hari'       },
  { v: 'custom', l: 'Pilih Tanggal' },
];

const DISEASE_PERIOD_OPTS = [
  { v: '7d',  l: '7 Hari'  },
  { v: '30d', l: '30 Hari' },
  { v: '3m',  l: '3 Bulan' },
  { v: '6m',  l: '6 Bulan' },
];

const GENDER_OPTS = [
  { v: 'all',    l: 'Semua'        },
  { v: 'male',   l: '♂ Laki-laki' },
  { v: 'female', l: '♀ Perempuan' },
];

const ANALYTICS_MODES = [
  { v: '7d',      l: '7 Hari Terakhir'  },
  { v: '30d',     l: '30 Hari Terakhir' },
  { v: 'compare', l: 'Perbandingan Bulan'},
];

/* ─── Chart.js options ───────────────────────────────────── */
const chartOptions = () => ({
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e293b', titleColor: '#94a3b8', bodyColor: '#f1f5f9',
      padding: 10, cornerRadius: 8,
      callbacks: { label: ctx => ` ${ctx.dataset.label || 'Jumlah'}: ${fmtNum(ctx.parsed.y)}` },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
    y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 11 }, precision: 0 }, beginAtZero: true },
  },
});

const compareChartOptions = () => ({
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { color: '#475569', font: { size: 11 }, boxWidth: 12, padding: 12 } },
    tooltip: {
      backgroundColor: '#1e293b', titleColor: '#94a3b8', bodyColor: '#f1f5f9', padding: 10, cornerRadius: 8,
      callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtNum(ctx.parsed.y)}` },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
    y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 11 }, precision: 0 }, beginAtZero: true },
  },
});

/* ─── Helper ─────────────────────────────────────────────── */
const getYM = (offsetMonths = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return { year: d.getFullYear(), month: d.getMonth() };
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

  /* ── Analytics frequency ── */
  const [analyticsMode,    setAnalyticsMode]    = useState('30d');
  const [apptData,         setApptData]         = useState(null);
  const [consultData,      setConsultData]      = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  /* ── Compare month pickers ── */
  const cur  = getYM(0);
  const prev = getYM(-1);
  const [monthA, setMonthA] = useState({ year: cur.year,  month: cur.month  });
  const [monthB, setMonthB] = useState({ year: prev.year, month: prev.month });

  /* ── ML Metrics ── */
  const [mlMetrics, setMlMetrics] = useState(null);
  const [mlMetricsLoading, setMlMetricsLoading] = useState(true);

  /* ── Disease Trend ── */
  const [diseasePeriod,  setDiseasePeriod]  = useState('30d');
  const [diseaseGender,  setDiseaseGender]  = useState('all');
  const [diseaseData,    setDiseaseData]    = useState(null);
  const [diseaseLoading, setDiseaseLoading] = useState(true);

  /* ── AI Insight ── */
  const [aiInsight,        setAiInsight]        = useState(null);
  const [aiInsightLoading, setAiInsightLoading] = useState(false);
  const [aiFromCache,      setAiFromCache]      = useState(false);
  const lastInsightKeyRef = useRef(null); // guard: hindari re-fetch data identik

  /* ════════ Fetch disease trend ════════ */
  const fetchDiseaseTrend = useCallback(async () => {
    setDiseaseLoading(true);
    // Reset fingerprint agar AI insight ikut refresh saat period/gender berubah
    lastInsightKeyRef.current = null;
    setAiInsight(null);
    try {
      const genderParam = diseaseGender !== 'all' ? `&gender=${diseaseGender}` : '';
      const endpoint = diseaseGender === 'all'
        ? `/api/admin/analytics/disease-trend?period=${diseasePeriod}`
        : `/api/admin/analytics/disease-trend-gender?period=${diseasePeriod}${genderParam}`;
      const res = await api.get(endpoint);
      setDiseaseData(res.data?.data || null);
    } catch (e) {
      console.error('[Dashboard] disease-trend error:', e);
      setDiseaseData(null);
    } finally {
      setDiseaseLoading(false);
    }
  }, [diseasePeriod, diseaseGender]);

  const fetchMlMetrics = useCallback(async () => {
    setMlMetricsLoading(true);
    try {
      const res = await api.get('/api/admin/analytics/ml-metrics');
      if (res.data?.success) setMlMetrics(res.data.data);
    } catch (e) {
      console.error('[Dashboard] ML metrics error:', e);
    } finally {
      setMlMetricsLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchDiseaseTrend(); 
    fetchMlMetrics(); 
  }, [fetchDiseaseTrend, fetchMlMetrics]);

  /* ════════ Fetch AI insight ════════ */
  const fetchAiInsight = useCallback(async (data) => {
    if (!data || Object.keys(data).length === 0) return;

    // Buat fingerprint: kombinasi period + gender + nama kategori + total
    const topKeys = Object.entries(data)
      .map(([k, arr]) => `${k}:${arr.reduce((s, r) => s + r.jumlah, 0)}`)
      .sort().join('|');
    const fingerprint = `admin:${diseasePeriod}:${diseaseGender}:${topKeys}`;

    // Jika data identik dengan fetch terakhir — skip (cegah re-call saat re-render)
    if (lastInsightKeyRef.current === fingerprint && aiInsight) return;

    // Cek sessionStorage (cache sisi klien, hilang saat tab ditutup)
    const sessionKey = `ai-insight:${fingerprint}`;
    try {
      const stored = sessionStorage.getItem(sessionKey);
      if (stored) {
        setAiInsight(stored);
        setAiFromCache(true);
        lastInsightKeyRef.current = fingerprint;
        return;
      }
    } catch (_) { /* sessionStorage blocked */ }

    lastInsightKeyRef.current = fingerprint;
    setAiInsightLoading(true);
    try {
      const res = await api.post('/api/admin/analytics/ai-insight', {
        diseaseData: data,
        period: diseasePeriod,
        gender: diseaseGender === 'all' ? null : diseaseGender,
        role: 'admin',
      });
      const insight = res.data?.insight || null;
      setAiInsight(insight);
      setAiFromCache(res.data?.fromCache || false);
      // Simpan ke sessionStorage agar tidak re-call selama tab masih buka
      if (insight) {
        try { sessionStorage.setItem(sessionKey, insight); } catch (_) {}
      }
    } catch (e) {
      setAiInsight(null);
    } finally {
      setAiInsightLoading(false);
    }
  }, [diseasePeriod, diseaseGender, aiInsight]);

  useEffect(() => {
    if (diseaseData) fetchAiInsight(diseaseData);
  }, [diseaseData, fetchAiInsight]);

  /* ════════ Fetch ops + growth ════════ */
  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = period === 'custom' ? `period=custom&from=${from}&to=${to}` : `period=${period}`;
      const [opsR, grwR] = await Promise.allSettled([
        api.get('/api/admin/analytics/operational'),
        api.get(`/api/admin/analytics/growth?${params}`),
      ]);
      setOps(opsR.status === 'fulfilled'  ? opsR.value?.data  : null);
      setGrowth(grwR.status === 'fulfilled' ? grwR.value?.data : null);
    } catch (e) {
      setError('Gagal memuat data dashboard. Silakan coba lagi.');
    } finally { setLoading(false); }
  }, [period, from, to]);

  useEffect(() => { if (period !== 'custom' || (from && to)) fetchAll(); }, [fetchAll, period, from, to]);

  /* ════════ Fetch analytics frequency ════════ */
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
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
        setApptData({ labels: apptPoints.map(p => p.label), datasets: [{ label: 'Janji Temu', data: apptPoints.map(p => p.count), borderColor: '#0891b2', backgroundColor: 'rgba(8,145,178,.12)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#0891b2' }] });
        setConsultData({ labels: consultPoints.map(p => p.label), datasets: [{ label: 'Konsultasi', data: consultPoints.map(p => p.count), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.12)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#2563eb' }] });
      } else {
        const pad  = m => String(m + 1).padStart(2, '0');
        const qA   = `period=month&year=${monthA.year}&month=${pad(monthA.month)}`;
        const qB   = `period=month&year=${monthB.year}&month=${pad(monthB.month)}`;
        const labelA = `${MONTH_NAMES[monthA.month]} ${monthA.year}`;
        const labelB = `${MONTH_NAMES[monthB.month]} ${monthB.year}`;
        const [apptAr, apptBr, consultAr, consultBr] = await Promise.allSettled([
          api.get(`/api/admin/analytics/appointments/frequency?${qA}`),
          api.get(`/api/admin/analytics/appointments/frequency?${qB}`),
          api.get(`/api/admin/analytics/consultations/frequency?${qA}`),
          api.get(`/api/admin/analytics/consultations/frequency?${qB}`),
        ]);
        const mergeMonths = (rA, rB) => {
          const mapA = {}, mapB = {};
          (rA.status === 'fulfilled' ? rA.value?.data?.data || [] : []).forEach(r => { mapA[new Date(r.date).getDate()] = r.count || 0; });
          (rB.status === 'fulfilled' ? rB.value?.data?.data || [] : []).forEach(r => { mapB[new Date(r.date).getDate()] = r.count || 0; });
          const maxDay = Math.max(...Object.keys(mapA).map(Number), ...Object.keys(mapB).map(Number), 0);
          const days   = Array.from({ length: maxDay || 0 }, (_, i) => String(i + 1));
          return { days, countA: days.map((_, i) => mapA[i+1] || 0), countB: days.map((_, i) => mapB[i+1] || 0) };
        };
        const appt    = mergeMonths(apptAr, apptBr);
        const consult = mergeMonths(consultAr, consultBr);
        setApptData({ labels: appt.days, datasets: [
          { label: labelA, data: appt.countA, backgroundColor: 'rgba(8,145,178,.75)', borderColor: '#0891b2', borderWidth: 1, borderRadius: 4 },
          { label: labelB, data: appt.countB, backgroundColor: 'rgba(8,145,178,.3)',  borderColor: '#0891b2', borderWidth: 1, borderRadius: 4 },
        ]});
        setConsultData({ labels: consult.days, datasets: [
          { label: labelA, data: consult.countA, backgroundColor: 'rgba(37,99,235,.75)', borderColor: '#2563eb', borderWidth: 1, borderRadius: 4 },
          { label: labelB, data: consult.countB, backgroundColor: 'rgba(37,99,235,.3)',  borderColor: '#2563eb', borderWidth: 1, borderRadius: 4 },
        ]});
      }
    } catch (e) { console.error('[Dashboard] analytics error:', e); }
    finally { setAnalyticsLoading(false); }
  }, [analyticsMode, monthA, monthB]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  /* ════════ Build chart data dari diseaseData ════════ */
  const buildChartData = (data) => {
    if (!data || Object.keys(data).length === 0) return null;

    const topKategori = Object.entries(data)
      .map(([k, arr]) => ({ k, total: arr.reduce((s, r) => s + r.jumlah, 0) }))
      .sort((a, b) => b.total - a.total);

    const hBarData = {
      labels: topKategori.map(x => x.k),
      datasets: [{
        label: 'Total Kasus',
        data: topKategori.map(x => x.total),
        backgroundColor: topKategori.map(x => (CATEGORY_COLORS[x.k] || '#94a3b8') + 'cc'),
        borderColor:     topKategori.map(x => CATEGORY_COLORS[x.k] || '#94a3b8'),
        borderWidth: 1.5, borderRadius: 4,
      }],
    };

    const allDates = [...new Set(Object.values(data).flat().map(r => r.tanggal))].sort();
    const isLongPeriod = allDates.length > 30;

    let lineLabels, lineDatasets;
    if (isLongPeriod) {
      // Aggregate ke mingguan
      const weekly = {};
      allDates.forEach(d => {
        const dt = new Date(d + 'T00:00:00+07:00');
        const day = dt.getDay();
        const mon = new Date(dt);
        mon.setDate(dt.getDate() - day + (day === 0 ? -6 : 1));
        const wk = mon.toISOString().slice(0, 10);
        if (!weekly[wk]) weekly[wk] = [];
        weekly[wk].push(d);
      });
      const weekKeys = Object.keys(weekly).sort();
      lineLabels = weekKeys.map(w => new Date(w + 'T00:00:00+07:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
      lineDatasets = topKategori.slice(0, 5).map(({ k }) => ({
        label: k,
        data: weekKeys.map(wk => weekly[wk].reduce((s, d) => { const e = (data[k] || []).find(r => r.tanggal === d); return s + (e ? e.jumlah : 0); }, 0)),
        borderColor: CATEGORY_COLORS[k] || '#94a3b8',
        backgroundColor: (CATEGORY_COLORS[k] || '#94a3b8') + '22',
        fill: false, tension: 0.35, pointRadius: 3,
        pointBackgroundColor: CATEGORY_COLORS[k] || '#94a3b8',
      }));
    } else {
      lineLabels = allDates.map(d => new Date(d + 'T00:00:00+07:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
      lineDatasets = topKategori.slice(0, 5).map(({ k }) => ({
        label: k,
        data: allDates.map(d => { const e = (data[k] || []).find(r => r.tanggal === d); return e ? e.jumlah : 0; }),
        borderColor: CATEGORY_COLORS[k] || '#94a3b8',
        backgroundColor: (CATEGORY_COLORS[k] || '#94a3b8') + '22',
        fill: false, tension: 0.35, pointRadius: 3,
        pointBackgroundColor: CATEGORY_COLORS[k] || '#94a3b8',
      }));
    }

    return { topKategori, hBarData, lineLabels, lineDatasets };
  };

  const chartData = buildChartData(diseaseData);

  /* ════════ Styles ════════ */
  const S = {
    section:      { marginBottom: 28 },
    sectionTitle: { fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 14 },
    grid3:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 },
    row:          { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 },
    chip: active => ({
      padding: '6px 14px', borderRadius: 20,
      border: `1px solid ${active ? '#2563eb' : '#e2e8f0'}`,
      background: active ? '#2563eb' : '#fff',
      color: active ? '#fff' : '#475569',
      fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
    }),
    chipPurple: active => ({
      padding: '6px 14px', borderRadius: 20,
      border: `1px solid ${active ? '#7c3aed' : '#e2e8f0'}`,
      background: active ? '#7c3aed' : '#fff',
      color: active ? '#fff' : '#475569',
      fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
    }),
    dateInput:  { padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#475569' },
    chartWrap:  { height: 200, position: 'relative' },
    emptyChart: { height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#94a3b8' },
    errorBox:   { background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 20px', textAlign: 'center', marginBottom: 20 },
    retryBtn:   { marginTop: 12, padding: '8px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  };

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

  const FreqCard = ({ title, icon, color, data, isCompare }) => {
    const isEmpty = !data || !data.labels || data.labels.length === 0;
    const ChartComp = isCompare ? Bar : Line;
    const opts = isCompare ? compareChartOptions() : chartOptions();
    return (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{icon} {title}</span>
        </div>
        {analyticsLoading ? (
          <div style={S.emptyChart}><span style={{ fontSize: 24 }}>⏳</span><span style={{ fontSize: 12 }}>Memuat data...</span></div>
        ) : isEmpty ? (
          <div style={S.emptyChart}><span style={{ fontSize: 30 }}>📭</span><span style={{ fontSize: 12 }}>Tidak ada data untuk periode ini</span></div>
        ) : (
          <div style={S.chartWrap}><ChartComp data={data} options={opts} /></div>
        )}
      </Card>
    );
  };

  const avgDoctorRating = (() => {
    if (!growth?.doctors || growth.doctors.length === 0) return 0;
    const rated = growth.doctors.filter(d => d.rating > 0);
    if (rated.length === 0) return 0;
    return (rated.reduce((s, d) => s + parseFloat(d.rating || 0), 0) / rated.length).toFixed(1);
  })();

  if (error) {
    return (
      <div style={S.errorBox}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
        <p style={{ color: '#991b1b', marginBottom: 12 }}>{error}</p>
        <button onClick={fetchAll} style={S.retryBtn}>🔄 Coba Lagi</button>
      </div>
    );
  }

  /* ════════════════════════ RENDER ════════════════════════ */
  return (
    <div>

      {/* ── BLOK 1: Operasional ── */}
      <div style={S.section}>
        <p style={S.sectionTitle}>⚙️ Operasional Hari Ini</p>
        <div style={S.grid3}>
          <StatBox label="Resep Menunggu Verifikasi" value={fmtNum(ops?.pendingRx)}        icon="📋" color="#f59e0b" clickable onClick={() => onNavigate('pharmacy')}       loading={loading && !ops} />
          <StatBox label="Perlu Disiapkan"           value={fmtNum(ops?.needsPreparation)} icon="💊" color="#ef4444" clickable onClick={() => onNavigate('pharmacy')}       loading={loading && !ops} />
          <StatBox label="Siap Diambil"              value={fmtNum(ops?.pickupReady)}      icon="🏥" color="#8b5cf6" clickable onClick={() => onNavigate('pharmacy')}       loading={loading && !ops} />
          <StatBox label="Janji Temu Terkonfirmasi"       value={fmtNum(ops?.todayAppt)}        icon="📅" color="#0891b2" clickable onClick={() => onNavigate('appointments')}   loading={loading && !ops} />
          <StatBox label="Konsultasi Terkonfirmasi"       value={fmtNum(ops?.todayConsult)}     icon="💬" color="#2563eb" clickable onClick={() => onNavigate('consultations')}  loading={loading && !ops} />
        </div>
      </div>

      {/* ── BLOK 2: Analytics Frekuensi ── */}
      <div style={S.section}>
        <p style={S.sectionTitle}>📊 Analytics Frekuensi</p>
        <div style={S.row}>
          {ANALYTICS_MODES.map(o => (
            <button key={o.v} style={S.chip(analyticsMode === o.v)} onClick={() => setAnalyticsMode(o.v)}>{o.l}</button>
          ))}
          {analyticsMode === 'compare' && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <MonthSelect label="Bulan A:" value={monthA} onChange={setMonthA} />
              <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>vs</span>
              <MonthSelect label="Bulan B:" value={monthB} onChange={setMonthB} />
            </div>
          )}
          {analyticsLoading && <span style={{ fontSize: 12, color: '#94a3b8' }}>⏳ Memuat grafik...</span>}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <FreqCard title="Janji Temu" icon="📅" color="#0891b2" data={apptData}    isCompare={analyticsMode === 'compare'} />
          <FreqCard title="Konsultasi" icon="💬" color="#2563eb" data={consultData} isCompare={analyticsMode === 'compare'} />
        </div>
      </div>

      {/* ── BLOK 3: Growth ── */}
      <div style={S.section}>
        <p style={S.sectionTitle}>📈 Growth & Statistik</p>
        {/* ── Period selector ── */}
        <div style={S.row}>
          {PERIOD_OPTS.map(o => (
            <button key={o.v} style={S.chip(period === o.v)} onClick={() => { setPeriod(o.v); if (o.v !== 'custom') { setFrom(''); setTo(''); } }}>{o.l}</button>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <StatBox label={`Pasien Baru (${PERIOD_OPTS.find(o => o.v === period)?.l || period})`} value={fmtNum(growth?.newPatients)} icon="👤" color="#2563eb" clickable onClick={() => onNavigate('users')} loading={loading && !growth} />
          <StatBox label="Total Pasien"         value={fmtNum(growth?.totalPatients)} icon="👥" color="#0891b2" loading={loading && !growth} />
          <StatBox label="Total Dokter"         value={fmtNum(growth?.totalDoctors)}  icon="👨‍⚕️" color="#7c3aed" clickable onClick={() => onNavigate('doctors')} loading={loading && !growth} />
          <StatBox label="Dokter Aktif"         value={fmtNum(growth?.activeDoctors)} icon="✅" color="#16a34a" loading={loading && !growth} />
          <StatBox label="Rating Rata-rata Dokter" value={loading && !growth ? undefined : `${avgDoctorRating} ⭐`} icon="⭐" color="#f59e0b" loading={loading && !growth} />
        </div>
      </div>

      {loading && !ops && !growth && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <p>Memuat dashboard...</p>
        </div>
      )}

      {/* ── BLOK 4: Tren Penyakit ── */}
      <div style={S.section}>
        <p style={S.sectionTitle}>🦠 Tren Penyakit Pasien</p>

        {/* Period filter */}
        <div style={{ ...S.row, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, alignSelf: 'center' }}>Periode:</span>
          {DISEASE_PERIOD_OPTS.map(o => (
            <button key={o.v} style={S.chip(diseasePeriod === o.v)} onClick={() => setDiseasePeriod(o.v)}>{o.l}</button>
          ))}
        </div>

        {/* Gender filter */}
        <div style={{ ...S.row, marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, alignSelf: 'center' }}>Gender:</span>
          {GENDER_OPTS.map(o => (
            <button key={o.v} style={S.chipPurple(diseaseGender === o.v)} onClick={() => setDiseaseGender(o.v)}>{o.l}</button>
          ))}
          {diseaseLoading && <span style={{ fontSize: 12, color: '#94a3b8' }}>⏳ Memuat...</span>}
          <button
            onClick={async () => {
              if (!window.confirm('Classify ulang semua data lama yang belum terdeteksi ML?')) return;
              try {
                const r = await api.post('/api/admin/analytics/disease-backfill');
                alert(r.data.message);
                fetchDiseaseTrend();
              } catch(e) { alert('Backfill gagal: ' + (e.response?.data?.message || e.message)); }
            }}
            style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontFamily: 'inherit' }}
          >🔄 Classify Data Lama</button>
        </div>

        {diseaseLoading ? (
          <Card><div style={S.emptyChart}><span style={{ fontSize: 28 }}>⏳</span><span style={{ fontSize: 12 }}>Memuat data tren penyakit...</span></div></Card>
        ) : !chartData ? (
          <Card>
            <div style={S.emptyChart}>
              <span style={{ fontSize: 32 }}>📭</span>
              <span style={{ fontSize: 12 }}>Belum ada data klasifikasi penyakit</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Data akan muncul setelah pasien submit keluhan</span>
            </div>
          </Card>
        ) : (
          <>
            {/* ML Metrics Box */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>🎯 Evaluasi Performa Unified Pipeline (ML)</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginBottom: 10 }}>*Metrik dihitung pada seluruh dataset training global model, bukan pada filter rentang waktu/gender yang sedang aktif.</div>
              {mlMetricsLoading ? (
                <div style={{ fontSize: 13, color: '#64748b' }}>⏳ Memuat metrik...</div>
              ) : mlMetrics ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  <Card style={{ padding: '12px 16px', background: 'linear-gradient(to right, #f8fafc, #fff)', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Akurasi</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{(mlMetrics.accuracy * 100).toFixed(1)}%</div>
                  </Card>
                  <Card style={{ padding: '12px 16px', background: 'linear-gradient(to right, #f8fafc, #fff)', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>F1-Score</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{(mlMetrics.f1_score * 100).toFixed(1)}%</div>
                  </Card>
                  <Card style={{ padding: '12px 16px', background: 'linear-gradient(to right, #f8fafc, #fff)', borderLeft: '4px solid #8b5cf6' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Precision</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{(mlMetrics.precision * 100).toFixed(1)}%</div>
                  </Card>
                  <Card style={{ padding: '12px 16px', background: 'linear-gradient(to right, #f8fafc, #fff)', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Recall</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{(mlMetrics.recall * 100).toFixed(1)}%</div>
                  </Card>
                  <Card style={{ padding: '12px 16px', background: 'linear-gradient(to right, #f8fafc, #fff)', borderLeft: '4px solid #ec4899' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Pseudo R²</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{(mlMetrics.r2_pseudo * 100).toFixed(1)}%</div>
                  </Card>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Metrik belum tersedia.</div>
              )}
            </div>

            {/* AI Insight Box */}
            <Card style={{ marginBottom: 16, background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)', border: '1px solid #bfdbfe' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🤖</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>AI Analytics Insight</div>
                  {aiInsightLoading ? (
                    <div style={{ fontSize: 13, color: '#64748b' }}>⏳ Menganalisis data...</div>
                  ) : aiInsight ? (
                    <div>
                      <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.7 }}>{aiInsight}</div>
                      {aiFromCache && <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>⚡ Diperbarui dari cache (6 jam terakhir)</div>}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>Insight belum tersedia.</div>
                  )}
                </div>
              </div>
            </Card>

            {/* Two charts side by side */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
              {/* Horizontal Bar */}
              <Card style={{ flex: 1, minWidth: 280 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kategori Terbanyak</div>
                <div style={{ height: 260, position: 'relative' }}>
                  <Bar data={chartData.hBarData} options={{
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} kasus` } } },
                    scales: {
                      x: { beginAtZero: true, ticks: { font: { size: 10 }, stepSize: 1 }, grid: { color: '#f1f5f9' } },
                      y: { grid: { display: false }, ticks: { font: { size: 10 } } },
                    },
                  }} />
                </div>
              </Card>

              {/* Line Chart */}
              <Card style={{ flex: 1, minWidth: 280 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tren dari Waktu ke Waktu (Top 5)</div>
                <div style={{ height: 260, position: 'relative' }}>
                  <Line data={{ labels: chartData.lineLabels, datasets: chartData.lineDatasets }} options={{
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                      legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } },
                      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} kasus` } },
                    },
                    scales: {
                      x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } },
                      y: { beginAtZero: true, ticks: { font: { size: 10 }, stepSize: 1 }, grid: { color: '#f1f5f9' } },
                    },
                  }} />
                </div>
              </Card>
            </div>

            {/* Top kategori list */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ranking Kategori Penyakit</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {chartData.topKategori.slice(0, 10).map(({ k, total }, i) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f8fafc', borderRadius: 10 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', width: 16, flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS[k] || '#94a3b8', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: '#334155' }}>{k}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, background: '#fff', borderRadius: 8, padding: '2px 8px', color: '#475569' }}>{total}</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
