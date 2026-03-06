/**
 * DoctorConsultations.jsx  (ganti /frontend/src/pages/doctor/Consultations.js)
 *
 * Dashboard konsultasi dokter:
 * - Daftar konsultasi upcoming / aktif / riwayat
 * - Tombol Start & End session
 * - Badge status lengkap
 * - Real-time update via socket
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDT = (d) => d
    ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB'
    : '—';

const fmtRupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

const STATUS_CFG = {
    pending_payment      : { color: '#b45309', bg: '#fffbeb', label: 'Menunggu Bayar' },
    confirmed            : { color: '#1d4ed8', bg: '#eff6ff', label: 'Terkonfirmasi' },
    in_progress          : { color: '#15803d', bg: '#f0fdf4', label: '🟢 Berlangsung' },
    completed            : { color: '#0e7490', bg: '#ecfeff', label: 'Selesai' },
    no_show              : { color: '#b45309', bg: '#fffbeb', label: 'Pasien Tidak Hadir' },
    doctor_no_show       : { color: '#b91c1c', bg: '#fef2f2', label: 'Dokter Tidak Hadir' },
    cancelled_by_doctor  : { color: '#b91c1c', bg: '#fef2f2', label: 'Dibatalkan' },
    expired              : { color: '#6b7280', bg: '#f3f4f6', label: 'Kadaluarsa' },
    refunded             : { color: '#15803d', bg: '#f0fdf4', label: 'Refund Selesai' },
    // legacy
    paid: { color: '#1d4ed8', bg: '#eff6ff', label: 'Terkonfirmasi' },
    scheduled: { color: '#7e22ce', bg: '#f5f3ff', label: 'Terjadwal' },
    ongoing: { color: '#15803d', bg: '#f0fdf4', label: '🟢 Berlangsung' },
};

const StatusBadge = ({ status }) => {
    const c = STATUS_CFG[status] || { color: '#6b7280', bg: '#f3f4f6', label: status };
    return (
        <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}40`, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 600 }}>
            {c.label}
        </span>
    );
};

const TABS = [
    { key: 'active',    label: 'Aktif & Upcoming' },
    { key: 'today',     label: 'Hari Ini' },
    { key: 'history',   label: 'Riwayat' },
];

// ── Component ─────────────────────────────────────────────────────────────────
const DoctorConsultations = () => {
    const { user }  = useAuth();
    const navigate  = useNavigate();

    const [tab, setTab]               = useState('active');
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [processing, setProcessing] = useState({});

    // Socket
    useEffect(() => {
        const socket = io(API_URL, { auth: { token: localStorage.getItem('token') } });
        socket.on('consultation-status-update', ({ consultationId, status }) => {
            setConsultations(prev => prev.map(c =>
                c._id === consultationId ? { ...c, status } : c
            ));
        });
        return () => socket.disconnect();
    }, []);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [activeRes, histRes] = await Promise.all([
                api.get('/api/consultations/doctor/pending'),
                api.get('/api/consultations/doctor/history'),
            ]);
            const active = activeRes.data?.consultations || [];
            const hist   = histRes.data?.consultations || [];
            // Merge & deduplicate
            const map = new Map();
            [...active, ...hist].forEach(c => map.set(c._id, c));
            setConsultations(Array.from(map.values()));
        } catch {
            toast.error('Gagal memuat data konsultasi');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Filter per tab ─────────────────────────────────────────────────────────
    const activeList = consultations.filter(c =>
        ['confirmed', 'in_progress', 'paid', 'scheduled', 'ongoing', 'waiting_verification'].includes(c.status)
    );

    const todayList = consultations.filter(c => {
        if (!c.scheduledAt) return false;
        const d = new Date(c.scheduledAt);
        const now = new Date();
        return d.toDateString() === now.toDateString();
    });

    const histList = consultations.filter(c =>
        ['completed', 'no_show', 'doctor_no_show', 'cancelled_by_doctor', 'expired', 'refunded', 'refund_requested'].includes(c.status)
    );

    const listMap = { active: activeList, today: todayList, history: histList };
    const shown   = listMap[tab] || [];

    // ── Actions ─────────────────────────────────────────────────────────────────
    const handleStart = async (id) => {
        setProcessing(p => ({ ...p, [id]: 'start' }));
        try {
            const res = await api.put(`/api/consultations/${id}/start`);
            setConsultations(prev => prev.map(c => c._id === id ? res.data.consultation : c));
            toast.success('Sesi konsultasi dimulai');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal memulai sesi');
        } finally {
            setProcessing(p => ({ ...p, [id]: null }));
        }
    };

    const handleEnd = async (id) => {
        if (!window.confirm('Akhiri sesi konsultasi? Status akan ditentukan berdasarkan respons pasien.')) return;
        setProcessing(p => ({ ...p, [id]: 'end' }));
        try {
            const res = await api.put(`/api/consultations/${id}/end`);
            const { consultation } = res.data;
            setConsultations(prev => prev.map(c => c._id === id ? consultation : c));
            toast.success(consultation.status === 'no_show' ? 'Sesi selesai — pasien tidak hadir' : 'Sesi konsultasi selesai');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal mengakhiri sesi');
        } finally {
            setProcessing(p => ({ ...p, [id]: null }));
        }
    };

    // ── Card ─────────────────────────────────────────────────────────────────────
    const ConsultCard = ({ c }) => {
        const canStart = ['confirmed', 'paid', 'scheduled', 'ongoing'].includes(c.status) && c.status !== 'in_progress';
        const canEnd   = c.status === 'in_progress';
        const canChat  = ['confirmed', 'in_progress', 'completed', 'paid', 'scheduled', 'ongoing'].includes(c.status);
        const isProc   = processing[c._id];

        return (
            <div style={{
                background: '#fff', border: c.status === 'in_progress' ? '2px solid #22c55e' : '1px solid #e5e7eb',
                borderRadius: 14, padding: '16px 20px', marginBottom: 12,
                boxShadow: c.status === 'in_progress' ? '0 0 0 3px rgba(34,197,94,.15)' : '0 1px 3px rgba(0,0,0,.05)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                            {c.userId?.name || 'Pasien'}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {c.userId?.email} {c.userId?.phone && `· ${c.userId.phone}`}
                        </div>
                    </div>
                    <StatusBadge status={c.status} />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: '#374151', marginBottom: 12 }}>
                    <div>📅 <strong>Jadwal:</strong> {fmtDT(c.scheduledAt)}</div>
                    <div>🕐 <strong>Selesai:</strong> {fmtDT(c.scheduledEnd)}</div>
                    {c.consultationType && <div>🩺 {c.consultationType === 'video_call' ? '📹 Video Call' : '💬 Chat'}</div>}
                </div>

                {c.symptoms && (
                    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#374151', marginBottom: 12 }}>
                        <strong>Keluhan:</strong> {c.symptoms.slice(0,150)}{c.symptoms.length > 150 ? '…' : ''}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {canStart && (
                        <button
                            disabled={!!isProc}
                            onClick={() => handleStart(c._id)}
                            style={{ padding: '7px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: isProc ? .6 : 1 }}>
                            {isProc === 'start' ? '...' : '▶ Mulai Sesi'}
                        </button>
                    )}
                    {canEnd && (
                        <button
                            disabled={!!isProc}
                            onClick={() => handleEnd(c._id)}
                            style={{ padding: '7px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: isProc ? .6 : 1 }}>
                            {isProc === 'end' ? '...' : '⏹ Akhiri Sesi'}
                        </button>
                    )}
                    {canChat && (
                        <button
                            onClick={() => navigate(`/consultations/${c._id}`)}
                            style={{ padding: '7px 16px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                            💬 Buka Chat
                        </button>
                    )}
                </div>
            </div>
        );
    };

    // ── Render ───────────────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif", padding: '24px 16px' }}>
            <div style={{ maxWidth: 780, margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Konsultasi Online</h1>
                    <p style={{ color: '#6b7280', fontSize: 14 }}>Kelola sesi konsultasi pasien Anda</p>
                </div>

                {/* Stats strip */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Aktif/Upcoming', val: activeList.length, color: '#2563eb' },
                        { label: 'Hari Ini', val: todayList.length, color: '#22c55e' },
                        { label: 'Sedang Berlangsung', val: consultations.filter(c => c.status === 'in_progress').length, color: '#ef4444' },
                    ].map(s => (
                        <div key={s.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '12px 20px', flex: '1 1 120px' }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 20 }}>
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                                background: tab === t.key ? '#fff' : 'transparent',
                                color: tab === t.key ? '#111827' : '#6b7280',
                                boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
                            {t.label}
                            {t.key === 'active' && activeList.length > 0 && (
                                <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{activeList.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Refresh button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <button onClick={fetchAll} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                        🔄 Refresh
                    </button>
                </div>

                {/* List */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Memuat...</div>
                ) : shown.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                        <div style={{ color: '#6b7280', fontSize: 14 }}>
                            {tab === 'active' ? 'Tidak ada konsultasi aktif saat ini.' : tab === 'today' ? 'Tidak ada jadwal hari ini.' : 'Belum ada riwayat konsultasi.'}
                        </div>
                    </div>
                ) : (
                    shown.map(c => <ConsultCard key={c._id} c={c} />)
                )}
            </div>
        </div>
    );
};

export default DoctorConsultations;
