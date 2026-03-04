import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ── Status config lengkap ─────────────────────────────────────────────────────
const STATUS_CFG = {
    waiting_verification: { color: '#b45309', bg: '#fffbeb', label: 'Verifikasi Bayar' },
    confirmed:            { color: '#1d4ed8', bg: '#eff6ff', label: 'Terkonfirmasi' },
    in_progress:          { color: '#15803d', bg: '#f0fdf4', label: 'Berlangsung' },
    completed:            { color: '#0e7490', bg: '#ecfeff', label: 'Selesai' },
    no_show:              { color: '#b45309', bg: '#fffbeb', label: 'Tidak Hadir' },
    doctor_no_show:       { color: '#b91c1c', bg: '#fef2f2', label: 'Dokter Tidak Hadir' },
    cancelled_by_doctor:  { color: '#b91c1c', bg: '#fef2f2', label: 'Dibatalkan Dokter' },
    expired:              { color: '#6b7280', bg: '#f3f4f6', label: 'Kadaluarsa' },
    // legacy
    paid:      { color: '#1d4ed8', bg: '#eff6ff', label: 'Terkonfirmasi' },
    scheduled: { color: '#7e22ce', bg: '#f5f3ff', label: 'Terjadwal' },
    ongoing:   { color: '#15803d', bg: '#f0fdf4', label: 'Berlangsung' },
};

const StatusBadge = ({ status }) => {
    const c = STATUS_CFG[status] || { color: '#6b7280', bg: '#f3f4f6', label: status };
    return (
        <span style={{
            background: c.bg, color: c.color,
            border: `1px solid ${c.color}40`,
            borderRadius: 20, padding: '2px 10px',
            fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap'
        }}>
            {c.label}
        </span>
    );
};

const fmtDT = (d) => d
    ? new Date(d).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
    }) + ' WIB'
    : '-';

const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
    })
    : '-';

// ── Komponen kartu konsultasi ─────────────────────────────────────────────────
const ConsultCard = ({ cons, onStart, onEnd, onChat, processing }) => {
    const canStart = cons.status === 'confirmed';
    const canEnd   = cons.status === 'in_progress';
    const canChat  = ['confirmed', 'in_progress', 'completed',
                      'paid', 'scheduled', 'ongoing'].includes(cons.status);

    return (
        <div style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
            padding: '16px 18px', marginBottom: 10,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            fontFamily: "'Inter', sans-serif"
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                {/* Info pasien */}
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 20 }}>👤</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                            {cons.userId?.name || 'Pasien'}
                        </span>
                        <StatusBadge status={cons.status} />
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginLeft: 28 }}>
                        {cons.userId?.email}
                        {cons.userId?.phone && ` · ${cons.userId.phone}`}
                    </div>
                    {cons.scheduledAt && (
                        <div style={{ fontSize: 12, color: '#374151', marginTop: 6, marginLeft: 28 }}>
                            📅 <strong>Jadwal:</strong> {fmtDT(cons.scheduledAt)}
                        </div>
                    )}
                    {cons.symptoms && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, marginLeft: 28 }}>
                            🩺 <em>{cons.symptoms.substring(0, 80)}{cons.symptoms.length > 80 ? '...' : ''}</em>
                        </div>
                    )}
                </div>

                {/* Tombol aksi */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 130 }}>
                    {canStart && (
                        <button
                            onClick={() => onStart(cons._id)}
                            disabled={!!processing}
                            style={{
                                padding: '8px 14px', borderRadius: 8, border: 'none',
                                background: '#15803d', color: '#fff',
                                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                opacity: processing ? 0.6 : 1
                            }}
                        >
                            ▶ Mulai Sesi
                        </button>
                    )}
                    {canEnd && (
                        <button
                            onClick={() => onEnd(cons._id)}
                            disabled={!!processing}
                            style={{
                                padding: '8px 14px', borderRadius: 8, border: 'none',
                                background: '#b91c1c', color: '#fff',
                                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                opacity: processing ? 0.6 : 1
                            }}
                        >
                            ■ Akhiri Sesi
                        </button>
                    )}
                    {canChat && (
                        <button
                            onClick={() => onChat(cons._id)}
                            style={{
                                padding: '8px 14px', borderRadius: 8, border: '1px solid #2563eb',
                                background: 'transparent', color: '#2563eb',
                                fontWeight: 600, fontSize: 13, cursor: 'pointer'
                            }}
                        >
                            💬 {cons.status === 'in_progress' ? 'Buka Chat' : 'Lihat Chat'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Halaman utama ─────────────────────────────────────────────────────────────
const DoctorConsultations = () => {
    const { user }    = useAuth();
    const navigate    = useNavigate();
    const [all, setAll]           = useState([]);
    const [loading, setLoading]   = useState(true);
    const [tab, setTab]           = useState('active'); // 'active' | 'history'
    const [search, setSearch]     = useState('');
    const [processing, setProcessing] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/api/consultations/doctor/all');
            setAll(r.data.consultations || []);
        } catch {
            toast.error('Gagal memuat konsultasi');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user && user.role !== 'doctor') { navigate('/'); return; }
        fetchData();
    }, [user, navigate, fetchData]);

    const handleStart = async (id) => {
        if (!window.confirm('Mulai sesi konsultasi ini sekarang?')) return;
        setProcessing(id);
        try {
            await api.put(`/api/consultations/${id}/start`);
            toast.success('Sesi dimulai');
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal memulai sesi');
        } finally {
            setProcessing('');
        }
    };

    const handleEnd = async (id) => {
        if (!window.confirm('Akhiri sesi konsultasi ini?')) return;
        setProcessing(id);
        try {
            await api.put(`/api/consultations/${id}/end`);
            toast.success('Sesi diakhiri');
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal mengakhiri sesi');
        } finally {
            setProcessing('');
        }
    };

    // ── Filter ──────────────────────────────────────────────────────────────
    const ACTIVE_STATUSES = ['waiting_verification', 'confirmed', 'in_progress',
                             'paid', 'scheduled', 'ongoing'];
    const HISTORY_STATUSES = ['completed', 'no_show', 'doctor_no_show',
                              'cancelled_by_doctor', 'expired'];

    const filtered = all
        .filter(c => tab === 'active'
            ? ACTIVE_STATUSES.includes(c.status)
            : HISTORY_STATUSES.includes(c.status)
        )
        .filter(c => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return c.userId?.name?.toLowerCase().includes(q)
                || c.userId?.email?.toLowerCase().includes(q);
        })
        // Sort: aktif → by jadwal ascending, history → by jadwal descending
        .sort((a, b) => tab === 'active'
            ? new Date(a.scheduledAt) - new Date(b.scheduledAt)
            : new Date(b.scheduledAt) - new Date(a.scheduledAt)
        );

    // Group aktif berdasarkan tanggal
    const grouped = tab === 'active'
        ? filtered.reduce((acc, c) => {
            const key = c.scheduledAt
                ? fmtDate(c.scheduledAt)
                : 'Tanpa jadwal';
            if (!acc[key]) acc[key] = [];
            acc[key].push(c);
            return acc;
        }, {})
        : null;

    const s = { fontFamily: "'Inter', -apple-system, sans-serif" };

    return (
        <div style={{ ...s, minHeight: '100vh', background: '#f9fafb', padding: '24px 16px' }}>
            <div style={{ maxWidth: 800, margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                    <h4 style={{ fontWeight: 800, color: '#111827', marginBottom: 4 }}>
                        Konsultasi Online
                    </h4>
                    <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                        Kelola sesi konsultasi dengan pasien Anda
                    </p>
                </div>

                {/* Tab + Search */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                        {[['active', '⚡ Aktif'], ['history', '📂 Riwayat']].map(([v, label]) => (
                            <button key={v} onClick={() => setTab(v)}
                                style={{
                                    padding: '9px 18px', border: 'none', cursor: 'pointer',
                                    fontSize: 13, fontWeight: 600,
                                    background: tab === v ? '#2563eb' : 'transparent',
                                    color: tab === v ? '#fff' : '#6b7280'
                                }}>{label}</button>
                        ))}
                    </div>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Cari nama / email pasien..."
                        style={{
                            flex: 1, minWidth: 200, padding: '9px 14px',
                            border: '1px solid #e5e7eb', borderRadius: 10,
                            fontSize: 13, outline: 'none', background: '#fff'
                        }}
                    />
                    <button onClick={fetchData}
                        style={{
                            padding: '9px 16px', border: '1px solid #e5e7eb',
                            borderRadius: 10, background: '#fff', cursor: 'pointer',
                            fontSize: 13, color: '#374151'
                        }}>
                        🔄 Refresh
                    </button>
                </div>

                {/* Konten */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Memuat...</div>
                ) : filtered.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: 48,
                        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14
                    }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>
                            {tab === 'active' ? '📭' : '📂'}
                        </div>
                        <div style={{ fontWeight: 600, color: '#374151' }}>
                            {tab === 'active' ? 'Tidak ada konsultasi aktif' : 'Belum ada riwayat konsultasi'}
                        </div>
                        {tab === 'active' && (
                            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                                Konsultasi yang sudah dikonfirmasi akan muncul di sini
                            </div>
                        )}
                    </div>
                ) : tab === 'active' ? (
                    // Grouped by date
                    Object.entries(grouped).map(([date, items]) => (
                        <div key={date} style={{ marginBottom: 24 }}>
                            <div style={{
                                fontSize: 12, fontWeight: 700, color: '#6b7280',
                                textTransform: 'uppercase', letterSpacing: 1,
                                marginBottom: 10, paddingBottom: 6,
                                borderBottom: '1px solid #e5e7eb'
                            }}>
                                📅 {date} · {items.length} konsultasi
                            </div>
                            {items.map(c => (
                                <ConsultCard
                                    key={c._id}
                                    cons={c}
                                    onStart={handleStart}
                                    onEnd={handleEnd}
                                    onChat={(id) => navigate(`/consultations/${id}`)}
                                    processing={processing === c._id ? processing : ''}
                                />
                            ))}
                        </div>
                    ))
                ) : (
                    // History flat list
                    filtered.map(c => (
                        <ConsultCard
                            key={c._id}
                            cons={c}
                            onStart={handleStart}
                            onEnd={handleEnd}
                            onChat={(id) => navigate(`/consultations/${id}`)}
                            processing={processing === c._id ? processing : ''}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default DoctorConsultations;
