/**
 * doctor/index.js — Root layout dokter
 * Sidebar + nav + socket init + badge state
 * Semua section diimport dari file terpisah.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

import {
    API_URL, colors,
} from './shared';
import NotifBell       from './NotifBell';
import SectionBeranda  from './Beranda';
import SectionJanjiTemu    from './JanjiTemu';
import SectionKonsultasi   from './Konsultasi';
import SectionPasien       from './Pasien';
import SectionResep        from './Resep';
import SectionSuratSakit   from './SuratSakit';
import SectionAturJadwal   from './AturJadwal';
import SectionProfile      from './Profile';
import SectionChatAdmin    from './ChatAdmin';

const NAV_ITEMS = [
    { key: 'beranda',    icon: '📊', label: 'Beranda'      },
    { key: 'janji',      icon: '🗓️', label: 'Janji Temu',  badge: true },
    { key: 'konsultasi', icon: '🩺', label: 'Konsultasi',  badge: true },
    { key: 'pasien',     icon: '👥', label: 'Pasien'       },
    { key: 'resep',      icon: '💊', label: 'Resep Obat'   },
    { key: 'surat',      icon: '📄', label: 'Surat Sakit'  },
    { key: 'jadwal',     icon: '📅', label: 'Atur Jadwal'  },
    { key: 'chat',       icon: '💬', label: 'Chat Admin',  badge: true },
];

// Helper function untuk format nama lengkap dengan gelar
const formatFullDoctorName = (doctor) => {
    if (!doctor) return 'Dokter';
    
    const titlePrefix = doctor.titlePrefix || '';
    const name = doctor.name || '';
    const titleSuffix = doctor.titleSuffix || '';
    
    
    // Format: dr. Reza Arap Sp.PD
    let fullName = '';
    if (titlePrefix) fullName += `${titlePrefix} `;
    fullName += name;
    if (titleSuffix) fullName += ` ${titleSuffix}`;
    
    return fullName;
};

// Helper function untuk format nama pendek untuk di card
const formatShortDoctorName = (doctor) => {
    if (!doctor) return 'Dokter';
    
    const titlePrefix = doctor.titlePrefix || '';
    const name = doctor.name || '';
    
    // Format: dr. Reza
    let shortName = '';
    if (titlePrefix) shortName += `${titlePrefix} `;
    
    // Ambil nama depan (first word)
    const firstName = name.split(' ')[0];
    shortName += firstName;
    
    return shortName;
};

const DoctorDashboard = () => {
    const { user, logout } = useAuth();
    const navigate         = useNavigate();
    const [active, setActive]       = useState('beranda');
    const [doctorInfo, setDoctorInfo] = useState(null);
    const [pendingAppt, setPendingAppt] = useState(0);
    const [pendingCons, setPendingCons] = useState(0);
    const [unreadChat,  setUnreadChat]  = useState(0);
    const socketRef  = useRef(null);
    const activeRef  = useRef('beranda');

    // Socket.IO init
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        let io;
        try {
            io = window.io ? window.io(API_URL, { auth: { token }, transports: ['websocket','polling'], reconnection: true }) : null;
        } catch { return; }
        if (!io) return;
        socketRef.current = io;
        io.on('connect', () => { io.emit('join-user', user?._id || user?.id); });
        io.on('admin-chat-message', () => {
            if (activeRef.current !== 'chat') {
                setUnreadChat(prev => prev + 1);
            }
        });
        return () => { io.disconnect(); socketRef.current = null; };
    }, [user]);

    // Fetch doctor info + badge counts
    useEffect(() => {
        const fetchBadges = async () => {
            try {
                const [pr, ar, cr, chatR] = await Promise.allSettled([
                    api.get('/api/doctors/my/profile'),
                    api.get('/api/appointments/doctor/list', { params: { status: 'scheduled' } }),
                    api.get('/api/consultations/doctor/pending'),
                    api.get('/api/doctors/my/chat'),
                ]);
                if (pr.status    === 'fulfilled') setDoctorInfo(pr.value.data.doctor);
                if (ar.status    === 'fulfilled') setPendingAppt(ar.value.data.appointments?.length || 0);
                if (cr.status    === 'fulfilled') setPendingCons(cr.value.data.consultations?.length || 0);
                if (chatR.status === 'fulfilled') setUnreadChat(chatR.value.data.unreadDoctor || 0);
            } catch { /* silent */ }
        };
        fetchBadges();
        const t = setInterval(fetchBadges, 60000);
        return () => clearInterval(t);
    }, []);

    const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

    const handleNav = (key) => {
        setActive(key);
        activeRef.current = key;
        if (key === 'chat') setUnreadChat(0);
    };

    const getBadge = (key) => {
        if (key === 'janji')      return pendingAppt > 0 ? pendingAppt : null;
        if (key === 'konsultasi') return pendingCons > 0 ? pendingCons : null;
        if (key === 'chat')       return unreadChat  > 0 ? unreadChat  : null;
        return null;
    };

    const photoFull = doctorInfo?.photo
        ? (doctorInfo.photo.startsWith('http') ? doctorInfo.photo : `${API_URL}${doctorInfo.photo}`)
        : null;

    const SIDEBAR_W = 230;

    const renderSection = () => {
        switch (active) {
            case 'beranda':    return <SectionBeranda />;
            case 'janji':      return <SectionJanjiTemu socketRef={socketRef} />;
            case 'konsultasi': return <SectionKonsultasi socketRef={socketRef} />;
            case 'pasien':     return <SectionPasien />;
            case 'resep':      return <SectionResep />;
            case 'surat':      return <SectionSuratSakit />;
            case 'jadwal':     return <SectionAturJadwal />;
            case 'chat':       return <SectionChatAdmin socketRef={socketRef} />;
            case 'profile':    return <SectionProfile />;
            default:           return <SectionBeranda />;
        }
    };

    // Nama dokter dengan gelar lengkap untuk ditampilkan
    const fullDoctorName = formatFullDoctorName(doctorInfo);
    
    const doctorSpecialization = doctorInfo?.specialization || 'Dokter';

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
                *, *::before, *::after { box-sizing: border-box; }
                body { margin: 0; background: ${colors.bg}; font-family: 'DM Sans', system-ui, sans-serif; color: ${colors.text}; }
                @keyframes spin { to { transform: rotate(360deg); } }
                ::-webkit-scrollbar { width: 5px; height: 5px; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                * { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
            `}</style>

            <div style={{ display: 'flex', minHeight: '100vh' }}>

                {/* ─── SIDEBAR ─── */}
                <aside style={{
                    width: SIDEBAR_W, minHeight: '100vh', background: colors.sidebar,
                    display: 'flex', flexDirection: 'column', flexShrink: 0,
                    position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
                    transition: 'width .2s',
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center',
                        padding: '16px 14px',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(255,255,255,.07)',
                        minHeight: 64, gap: 8,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 20, flexShrink: 0 }}>⚕️</span>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 13, color: '#fff', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Klinik IPB</div>
                                <div style={{ fontSize: 10, color: '#475569' }}>Dokter Dashboard</div>
                            </div>
                            <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                                <NotifBell socketRef={socketRef} />
                            </div>
                        </div>
                    </div>

                    {/* Doctor identity card - dengan gelar lengkap */}
                    <div
                        onClick={() => handleNav('profile')}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.07)', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', background: '#334155', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,.1)' }}>
                            {photoFull
                                ? <img src={photoFull} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                                : <span style={{ fontSize: 20 }}>👨‍⚕️</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Nama lengkap dengan gelar (dr. Reza Arap Sp.PD) */}
                            <div style={{ 
                                fontWeight: 700, fontSize: 12, color: '#e2e8f0', 
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                marginBottom: 2
                            }}>
                                {fullDoctorName}
                            </div>
                            {/* Spesialisasi */}
                            <div style={{ 
                                fontSize: 12, color: '#94a3b8', 
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {doctorSpecialization}
                            </div>
                        </div>
                    </div>

                    {/* Nav */}
                    <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
                        {NAV_ITEMS.map(item => {
                            const isAct = active === item.key;
                            const badge = getBadge(item.key);
                            return (
                                <button 
                                    key={item.key} 
                                    onClick={() => handleNav(item.key)} 
                                    style={{
                                        width: '100%', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 12,
                                        padding: '11px 12px',
                                        justifyContent: 'flex-start',
                                        background: isAct ? 'rgba(37,99,235,.35)' : 'transparent',
                                        border: isAct ? '1px solid rgba(37,99,235,.4)' : '1px solid transparent',
                                        borderRadius: 10, 
                                        cursor: 'pointer', 
                                        fontFamily: 'inherit', 
                                        marginBottom: 3,
                                        transition: 'all .15s', 
                                        position: 'relative',
                                    }}
                                >
                                    <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: isAct ? '#fff' : '#94a3b8', flex: 1, textAlign: 'left' }}>{item.label}</span>
                                    {badge && (
                                        <span style={{
                                            background: '#ef4444', 
                                            color: '#fff', 
                                            borderRadius: 10, 
                                            fontSize: 10, 
                                            fontWeight: 700,
                                            padding: '1px 6px', 
                                            minWidth: 16, 
                                            textAlign: 'center', 
                                            lineHeight: '16px',
                                        }}>{badge}</span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Logout */}
                    <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
                        <button 
                            onClick={handleLogout} 
                            style={{
                                width: '100%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 10,
                                padding: '10px 12px',
                                justifyContent: 'flex-start',
                                background: 'transparent', 
                                border: '1px solid transparent', 
                                borderRadius: 10,
                                cursor: 'pointer', 
                                fontFamily: 'inherit', 
                                color: '#ef4444',
                                fontSize: 13, 
                                fontWeight: 600, 
                                transition: 'background .15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.12)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <span style={{ fontSize: 17 }}>🚪</span>
                            Logout
                        </button>
                    </div>
                </aside>

                {/* ─── MAIN CONTENT ─── */}
                <main style={{ marginLeft: SIDEBAR_W, flex: 1, minWidth: 0, padding: '28px 32px', transition: 'margin-left .2s' }}>
                    {renderSection()}
                </main>
            </div>
        </>
    );
};

export default DoctorDashboard;