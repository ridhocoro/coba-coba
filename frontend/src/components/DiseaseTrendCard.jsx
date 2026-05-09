// components/DiseaseTrendCard.jsx
// Komponen chart tren penyakit — bisa dipakai di dashboard Admin & Dokter
//
// Props:
//   apiEndpoint : string  — URL endpoint tren penyakit
//   title       : string  — judul card (opsional)

import React, { useState, useEffect, useCallback } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, ArcElement, Tooltip, Legend, Title,
} from 'chart.js';
import api from '../../utils/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title);

// ── Warna per kategori penyakit ──────────────────────────────
const CATEGORY_COLORS = {
  'ISPA':                 '#ef4444',
  'Hipertensi':           '#f97316',
  'Diabetes':             '#eab308',
  'Gangguan Pencernaan':  '#22c55e',
  'Penyakit Kulit':       '#14b8a6',
  'Gangguan Jantung':     '#e11d48',
  'Gangguan Paru':        '#06b6d4',
  'Gangguan Saraf':       '#8b5cf6',
  'Gangguan Mata':        '#3b82f6',
  'Gangguan Ginjal':      '#f59e0b',
  'Gangguan Mental':      '#a855f7',
  'Lainnya':              '#94a3b8',
};

const PERIOD_OPTS = [
  { v: '7d',  l: '7 Hari' },
  { v: '30d', l: '30 Hari' },
];

const fmtDate = d => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

const S = {
  card: {
    background: '#fff', borderRadius: 12,
    border: '1px solid #e2e8f0', padding: 20, marginBottom: 20,
  },
  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8,
  },
  title: { fontSize: 13, fontWeight: 700, color: '#0f172a' },
  chip: active => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', border: `1px solid ${active ? '#2563eb' : '#e2e8f0'}`,
    background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#475569',
  }),
  row: { display: 'flex', gap: 8, alignItems: 'center' },
  empty: {
    height: 200, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    color: '#94a3b8', gap: 8,
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 12 },
  dot: color => ({
    display: 'inline-block', width: 10, height: 10,
    borderRadius: '50%', background: color, marginRight: 4,
  }),
  legendItem: { display: 'flex', alignItems: 'center', fontSize: 11, color: '#475569' },
};

// ─────────────────────────────────────────────────────────────
const DiseaseTrendCard = ({
  apiEndpoint = '/api/admin/analytics/disease-trend',
  title = '🦠 Tren Penyakit',
}) => {
  const [period,  setPeriod]  = useState('30d');
  const [data,    setData]    = useState(null);   // raw { kategori -> [{tanggal, jumlah}] }
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState('bar');  // 'bar' | 'donut'

  // ── Fetch data ─────────────────────────────────────────────
  const fetchTrend = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`${apiEndpoint}?period=${period}`);
      setData(res.data?.data || null);
    } catch (e) {
      console.error('[DiseaseTrendCard]', e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, period]);

  useEffect(() => { fetchTrend(); }, [fetchTrend]);

  // ── Build chart data ───────────────────────────────────────

  // Donut: total per kategori
  const donutData = (() => {
    if (!data) return null;
    const labels  = Object.keys(data);
    const counts  = labels.map(k => data[k].reduce((s, r) => s + r.jumlah, 0));
    const colors  = labels.map(k => CATEGORY_COLORS[k] || '#94a3b8');
    return {
      labels,
      datasets: [{ data: counts, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }],
    };
  })();

  // Bar: per tanggal, stacked per kategori
  const barData = (() => {
    if (!data) return null;
    const allDates = [...new Set(
      Object.values(data).flatMap(arr => arr.map(r => r.tanggal))
    )].sort();

    const datasets = Object.entries(data).map(([kategori, arr]) => {
      const map = Object.fromEntries(arr.map(r => [r.tanggal, r.jumlah]));
      return {
        label: kategori,
        data: allDates.map(d => map[d] || 0),
        backgroundColor: CATEGORY_COLORS[kategori] || '#94a3b8',
        borderRadius: 3,
        stack: 'stack',
      };
    });

    return { labels: allDates.map(fmtDate), datasets };
  })();

  const hasData = data && Object.keys(data).length > 0;

  // ── Ringkasan top kategori ─────────────────────────────────
  const topKategori = (() => {
    if (!data) return [];
    return Object.entries(data)
      .map(([k, arr]) => ({ k, total: arr.reduce((s, r) => s + r.jumlah, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  })();

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={S.card}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>{title}</span>
        <div style={S.row}>
          {/* Period selector */}
          {PERIOD_OPTS.map(o => (
            <button key={o.v} style={S.chip(period === o.v)} onClick={() => setPeriod(o.v)}>
              {o.l}
            </button>
          ))}
          {/* View selector */}
          <button style={S.chip(view === 'bar')}   onClick={() => setView('bar')}>📊 Bar</button>
          <button style={S.chip(view === 'donut')} onClick={() => setView('donut')}>🍩 Donut</button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div style={S.empty}><span style={{ fontSize: 28 }}>⏳</span><span style={{ fontSize: 12 }}>Memuat data...</span></div>
      ) : !hasData ? (
        <div style={S.empty}><span style={{ fontSize: 32 }}>📭</span><span style={{ fontSize: 12 }}>Belum ada data klasifikasi penyakit</span></div>
      ) : (
        <>
          <div style={S.grid}>
            {/* Chart */}
            <div style={{ height: 220, position: 'relative' }}>
              {view === 'donut' ? (
                <Doughnut
                  data={donutData}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} kasus` } },
                    },
                  }}
                />
              ) : (
                <Bar
                  data={barData}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
                    scales: {
                      x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                      y: { stacked: true, grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 10 }, precision: 0 }, beginAtZero: true },
                    },
                  }}
                />
              )}
            </div>

            {/* Top 5 kategori */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Top Kategori
              </div>
              {topKategori.map(({ k, total }, i) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', width: 14 }}>{i + 1}.</span>
                  <span style={S.dot(CATEGORY_COLORS[k] || '#94a3b8')} />
                  <span style={{ flex: 1, fontSize: 12, color: '#334155' }}>{k}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    background: '#f1f5f9', borderRadius: 10,
                    padding: '2px 8px', color: '#475569',
                  }}>
                    {total} kasus
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={S.legend}>
            {Object.keys(data).map(k => (
              <div key={k} style={S.legendItem}>
                <span style={S.dot(CATEGORY_COLORS[k] || '#94a3b8')} />
                {k}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default DiseaseTrendCard;