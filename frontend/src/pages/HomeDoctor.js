import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
    FaCalendarAlt, FaCommentMedical, FaFileMedical, FaUsers,
    FaCheckCircle, FaHourglassHalf, FaArrowRight, FaBell,
    FaStethoscope, FaUserMd, FaClock, FaHeartbeat,
    FaClipboardList, FaSync
} from 'react-icons/fa';

const HomeDoctor = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ todayAppointments: 0, pendingAppointments: 0, totalPatients: 0, ongoingConsultations: 0 });
    const [todaySchedule, setTodaySchedule] = useState([]);
    const [pendingConsultations, setPendingConsultations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [time, setTime] = useState(new Date());
    const [noProfile, setNoProfile] = useState(false);

    useEffect(() => {
        fetchData();
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Cek doctor profile dulu
            try {
                const profileRes = await api.get('/api/doctors/my/profile');
                if (profileRes.data?.needsProfile) { setNoProfile(true); setLoading(false); return; }
            } catch (e) {
                if (e.response?.status === 404) { setNoProfile(true); setLoading(false); return; }
            }

            const [apptRes, consRes] = await Promise.allSettled([
                api.get('/api/appointments/doctor/stats'),
                api.get('/api/consultations/doctor/pending')
            ]);

            if (apptRes.status === 'fulfilled') {
                const d = apptRes.value.data;
                setStats(prev => ({ ...prev, todayAppointments: d.stats?.todayAppointments ?? 0, pendingAppointments: d.stats?.pendingAppointments ?? 0, totalPatients: d.stats?.totalPatients ?? 0 }));
                setTodaySchedule(d.todaySchedule || []);
            }
            if (consRes.status === 'fulfilled') {
                const cons = consRes.value.data?.consultations || [];
                setStats(prev => ({ ...prev, ongoingConsultations: cons.filter(c => c.status === 'ongoing').length }));
                setPendingConsultations(cons.filter(c => ['paid', 'ongoing'].includes(c.status)).slice(0, 4));
            }
        } catch {/* silent */} finally {
            setLoading(false);
        }
    };

    const greeting = () => {
        const h = time.getHours();
        if (h < 11) return 'Selamat Pagi';
        if (h < 15) return 'Selamat Siang';
        if (h < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    };

    const statusStyle = {
        paid:    { bg: '#dbeafe', color: '#1d4ed8', label: 'Menunggu Dokter' },
        ongoing: { bg: '#d1fae5', color: '#065f46', label: 'Sedang Berlangsung' },
    };

    if (noProfile) return (
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div style={{ maxWidth: 480, textAlign: 'center' }}>
                <div style={{ fontSize: 60, marginBottom: 16 }}>🏥</div>
                <h3 style={{ fontWeight: 800, color: '#1e293b' }}>Profil Dokter Belum Terdaftar</h3>
                <p style={{ color: '#64748b', lineHeight: 1.7 }}>
                    Akun Anda sudah aktif sebagai dokter, namun profil klinik belum dibuat oleh administrator.
                    Silakan hubungi admin untuk menghubungkan akun Anda.
                </p>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 16, fontSize: 13, color: '#475569' }}>
                    Admin: buka <strong>Kelola Dokter → Hubungkan Akun</strong>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#f0f9f4', fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                .doc-card { transition: transform 0.18s, box-shadow 0.18s; cursor: pointer; }
                .doc-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0,0,0,0.10) !important; }
                .schedule-row { transition: background 0.15s; }
                .schedule-row:hover { background: #f0fdf4 !important; }
            `}</style>

            <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 20px' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}>
                            <FaUserMd color="#fff" size={24} />
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{greeting()},</p>
                            <h2 style={{ margin: 0, fontWeight: 800, fontSize: 22, color: '#064e3b' }}>dr. {user?.name}</h2>
                            <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>● Dokter Aktif</span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: '#064e3b', letterSpacing: -1 }}>
                            {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>
                            {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                        <button onClick={fetchData} style={{ marginTop: 4, background: 'none', border: '1px solid #d1fae5', borderRadius: 8, padding: '3px 10px', fontSize: 12, color: '#065f46', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <FaSync size={10} /> Refresh
                        </button>
                    </div>
                </div>

                {/* Alert konsultasi aktif */}
                {stats.ongoingConsultations > 0 && (
                    <div style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', borderRadius: 14, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #6ee7b7' }}>
                        <FaBell color="#059669" size={16} style={{ animation: 'pulse 1.5s infinite' }} />
                        <div style={{ flex: 1 }}>
                            <strong style={{ color: '#065f46', fontSize: 14 }}>{stats.ongoingConsultations} konsultasi sedang berlangsung</strong>
                            <span style={{ color: '#047857', fontSize: 14 }}> — pasien menunggu respons Anda</span>
                        </div>
                        <button onClick={() => navigate('/doctor/consultations')}
                            style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            Buka Chat
                        </button>
                    </div>
                )}

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
                    {[
                        { label: 'Janji Hari Ini', value: stats.todayAppointments, icon: FaCalendarAlt, color: '#3b82f6', bg: '#eff6ff' },
                        { label: 'Menunggu Konfirmasi', value: stats.pendingAppointments, icon: FaHourglassHalf, color: '#f59e0b', bg: '#fffbeb' },
                        { label: 'Total Pasien', value: stats.totalPatients, icon: FaUsers, color: '#8b5cf6', bg: '#f5f3ff' },
                        { label: 'Konsultasi Aktif', value: stats.ongoingConsultations, icon: FaCommentMedical, color: '#10b981', bg: '#f0fdf4' },
                    ].map((s, i) => (
                        <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <s.icon color={s.color} size={20} />
                            </div>
                            <div>
                                <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{loading ? '…' : s.value}</div>
                                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                    {/* Menu Cepat */}
                    <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                        <h4 style={{ fontWeight: 700, fontSize: 15, color: '#064e3b', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FaClipboardList size={16} color="#10b981" /> Menu Cepat
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {[
                                { icon: FaCalendarAlt, label: 'Janji Temu', sub: `${stats.pendingAppointments} menunggu`, path: '/doctor/appointments', color: '#3b82f6', badge: stats.pendingAppointments },
                                { icon: FaCommentMedical, label: 'Konsultasi', sub: `${stats.ongoingConsultations} aktif`, path: '/doctor/consultations', color: '#10b981', badge: stats.ongoingConsultations },
                                { icon: FaFileMedical, label: 'Surat Sakit', sub: 'Kelola surat', path: '/doctor/sick-letters', color: '#f59e0b' },
                                { icon: FaUsers, label: 'Pasien Saya', sub: `${stats.totalPatients} pasien`, path: '/doctor/patients', color: '#8b5cf6' },
                            ].map((m, i) => (
                                <div key={i} className="doc-card" onClick={() => navigate(m.path)}
                                    style={{ background: '#f8fafc', borderRadius: 12, padding: '14px', position: 'relative', border: '1px solid #f1f5f9' }}>
                                    {m.badge > 0 && (
                                        <span style={{ position: 'absolute', top: 8, right: 8, background: '#ef4444', color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>{m.badge}</span>
                                    )}
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: m.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                        <m.icon color={m.color} size={16} />
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{m.label}</div>
                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{m.sub}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Jadwal Hari Ini */}
                    <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                            <h4 style={{ fontWeight: 700, fontSize: 15, color: '#064e3b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FaClock size={15} color="#3b82f6" /> Jadwal Hari Ini
                            </h4>
                            <Link to="/doctor/appointments" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                Semua <FaArrowRight size={10} />
                            </Link>
                        </div>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>Memuat...</div>
                        ) : todaySchedule.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '28px 0' }}>
                                <FaCalendarAlt size={32} color="#e2e8f0" style={{ marginBottom: 8 }} />
                                <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Tidak ada jadwal hari ini</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {todaySchedule.slice(0, 5).map((apt, i) => (
                                    <div key={apt._id} className="schedule-row"
                                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: '#f8fafc' }}>
                                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#1d4ed8', flexShrink: 0 }}>
                                            {i + 1}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apt.userId?.name}</div>
                                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{apt.userId?.phone}</div>
                                        </div>
                                        <div style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                                            {apt.appointmentTime}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Konsultasi Perlu Ditangani */}
                    {pendingConsultations.length > 0 && (
                        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', gridColumn: '1 / -1' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h4 style={{ fontWeight: 700, fontSize: 15, color: '#064e3b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FaStethoscope size={15} color="#10b981" /> Konsultasi Perlu Ditangani
                                </h4>
                                <Link to="/doctor/consultations" style={{ fontSize: 12, color: '#10b981', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    Lihat Semua <FaArrowRight size={10} />
                                </Link>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                                {pendingConsultations.map(c => {
                                    const s = statusStyle[c.status] || { bg: '#f1f5f9', color: '#475569', label: c.status };
                                    return (
                                        <div key={c._id} className="doc-card"
                                            onClick={() => c.status === 'ongoing' ? navigate(`/consultations/${c._id}`) : navigate('/doctor/consultations')}
                                            style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{c.userId?.name}</div>
                                                <span style={{ background: s.bg, color: s.color, borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</span>
                                            </div>
                                            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, marginBottom: 10 }}>
                                                {c.symptoms?.slice(0, 65)}{c.symptoms?.length > 65 ? '...' : ''}
                                            </div>
                                            {c.status === 'ongoing' && (
                                                <div style={{ background: '#059669', color: '#fff', borderRadius: 8, padding: '5px 0', fontSize: 12, fontWeight: 600, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                    <FaCommentMedical size={11} /> Buka Chat
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>

                {/* Tips */}
                <div style={{ marginTop: 20, background: 'linear-gradient(135deg, #064e3b, #065f46)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <FaHeartbeat color="#6ee7b7" size={28} style={{ flexShrink: 0 }} />
                    <div>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Klinik Pratama IPB</div>
                        <div style={{ color: '#a7f3d0', fontSize: 13 }}>
                            Terima kasih atas dedikasi Anda melayani pasien. Akses fitur lengkap melalui menu di atas.
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default HomeDoctor;
