import React from 'react';
import { Link } from 'react-router-dom';
import {
    FaWeight,
    FaFire,
    FaHeartbeat,
    FaArrowRight,
    FaUserMd,
    FaCalendarAlt,
    FaVideo,
} from 'react-icons/fa';

const features = [
    {
        icon       : <FaWeight size={22} />,
        title      : 'Kalkulator BMI',
        description: 'Hitung Indeks Massa Tubuh dan ketahui kategori berat badan Anda',
        link       : '/health-check/bmi',
        accent     : '#2563eb',
        lightBg    : '#eff6ff',
        time       : '1 menit',
    },
    {
        icon       : <FaFire size={22} />,
        title      : 'Kalkulator Kalori',
        description: 'Hitung kebutuhan kalori harian berdasarkan BMR dan aktivitas',
        link       : '/health-check/calories',
        accent     : '#dc2626',
        lightBg    : '#fef2f2',
        time       : '2 menit',
    },
    {
        icon       : <FaHeartbeat size={22} />,
        title      : 'Cek Tekanan Darah',
        description: 'Periksa kategori tekanan darah Anda (sistolik & diastolik)',
        link       : '/health-check/blood-pressure',
        accent     : '#16a34a',
        lightBg    : '#f0fdf4',
        time       : '1 menit',
    },
    {
        icon       : <FaVideo size={22} />,
        title      : 'Vital Sign Scanner',
        description: 'Ukur detak jantung, HRV, laju napas, hemoglobin & tekanan darah via kamera wajah (rPPG)',
        link       : '/health-check/vital-scan',
        accent     : '#7c3aed',
        lightBg    : '#f5f3ff',
        time       : '30 detik',
        badge      : 'Baru 🆕',
    },
];

const WHY_ITEMS = [
    'Deteksi dini masalah kesehatan',
    'Pantau perkembangan kondisi tubuh',
    'Motivasi untuk hidup lebih sehat',
    'Persiapan sebelum konsultasi dokter',
];

const HealthCheck = () => (
    <div style={{ background: '#fafafa', minHeight: '100vh', padding: '48px 0 80px' }}>
        <style>{`
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap');

            .hci-wrap { max-width: 860px; margin: 0 auto; padding: 0 24px; font-family: 'DM Sans', sans-serif; }

            .hci-card {
                background: #fff;
                border: 1px solid #e5e7eb;
                border-radius: 16px;
                padding: 28px;
                display: flex;
                flex-direction: column;
                gap: 14px;
                text-decoration: none;
                transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
                height: 100%;
            }
            .hci-card:hover {
                box-shadow: 0 8px 32px rgba(0,0,0,0.08);
                transform: translateY(-3px);
                border-color: transparent;
            }
            .hci-card:hover .hci-arrow { transform: translateX(4px); }
            .hci-arrow { transition: transform 0.2s; display: inline-flex; }

            .hci-info-card {
                background: #fff;
                border: 1px solid #e5e7eb;
                border-radius: 16px;
                padding: 28px;
            }

            .hci-btn-solid {
                display: inline-flex; align-items: center; gap: 8px;
                background: #0f172a; color: #fff;
                border: none; border-radius: 10px;
                padding: 10px 20px; font-size: 13px; font-weight: 600;
                text-decoration: none; cursor: pointer;
                transition: background 0.15s;
                font-family: 'DM Sans', sans-serif;
                white-space: nowrap;
            }
            .hci-btn-solid:hover { background: #1e293b; color: #fff; }

            .hci-btn-outline {
                display: inline-flex; align-items: center; gap: 8px;
                background: transparent; color: #374151;
                border: 1px solid #d1d5db; border-radius: 10px;
                padding: 10px 20px; font-size: 13px; font-weight: 600;
                text-decoration: none; cursor: pointer;
                transition: border-color 0.15s, background 0.15s;
                font-family: 'DM Sans', sans-serif;
                white-space: nowrap;
            }
            .hci-btn-outline:hover { border-color: #9ca3af; background: #f9fafb; color: #374151; }

            @keyframes hciFadeUp {
                from { opacity: 0; transform: translateY(16px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .hci-fade { animation: hciFadeUp 0.45s ease both; }
            .hci-d1 { animation-delay: 0.05s; }
            .hci-d2 { animation-delay: 0.12s; }
            .hci-d3 { animation-delay: 0.19s; }
            .hci-d4 { animation-delay: 0.26s; }
            .hci-d5 { animation-delay: 0.33s; }
            .hci-d6 { animation-delay: 0.40s; }

            @media (max-width: 640px) {
                .hci-grid    { grid-template-columns: 1fr !important; }
                .hci-bottom  { grid-template-columns: 1fr !important; }
                .hci-cta-row { flex-direction: column; align-items: flex-start !important; }
            }
        `}</style>

        <div className="hci-wrap">

            {/* ── Header ── */}
            <div className="hci-fade hci-d1" style={{ marginBottom: 40 }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: '#f1f5f9', borderRadius: 20,
                    padding: '5px 14px', marginBottom: 18,
                }}>
                    <span style={{ fontSize: 13 }}>🩺</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: '.5px', textTransform: 'uppercase' }}>
                        Cek Kesehatan Mandiri
                    </span>
                </div>

                <h1 style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: 'clamp(26px, 5vw, 38px)',
                    fontWeight: 400,
                    color: '#0f172a',
                    lineHeight: 1.2,
                    marginBottom: 12,
                }}>
                    Pantau Kesehatan<br />
                    <span style={{ color: '#2563eb' }}>Mulai dari Sekarang</span>
                </h1>

                <p style={{ fontSize: 15, color: '#6b7280', maxWidth: 480, lineHeight: 1.7, margin: 0 }}>
                    Gunakan alat sederhana kami untuk memantau kondisi tubuh.{' '}
                    <strong style={{ color: '#0f172a' }}>Gratis, tanpa perlu login.</strong>
                </p>
            </div>

            {/* ── Feature Cards ── */}
            <div
                className="hci-grid"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 16,
                    marginBottom: 20,
                    alignItems: 'stretch',
                }}
            >
                {features.map((f, i) => (
                    <Link
                        key={f.link}
                        to={f.link}
                        className={`hci-card hci-fade hci-d${i + 2}`}
                    >
                        {/* Icon */}
                        <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: f.lightBg, color: f.accent,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            {f.icon}
                        </div>

                        {/* Text — flex:1 mendorong footer selalu ke bawah */}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
                                {f.title}
                            </div>
                            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                                {f.description}
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                                <span style={{
                                    fontSize: 11, fontWeight: 600, color: '#94a3b8',
                                    background: '#f8fafc', border: '1px solid #e5e7eb',
                                    borderRadius: 6, padding: '3px 9px',
                                }}>
                                    ⏱ {f.time}
                                </span>
                                {f.badge && (
                                    <span style={{
                                        fontSize: 11, fontWeight: 700, color: '#7c3aed',
                                        background: '#f5f3ff', border: '1px solid #ddd6fe',
                                        borderRadius: 6, padding: '3px 9px',
                                    }}>{f.badge}</span>
                                )}
                            </div>
                            <span className="hci-arrow" style={{ color: f.accent, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                                Mulai <FaArrowRight size={11} />
                            </span>
                        </div>
                    </Link>
                ))}
            </div>

            {/* ── Bottom: Why + CTA ── */}
            <div
                className="hci-bottom"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
            >
                {/* Why card */}
                <div className="hci-info-card hci-fade hci-d5">
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 16 }}>
                        Mengapa cek kesehatan mandiri?
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                        {WHY_ITEMS.map(item => (
                            <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <div style={{
                                    width: 18, height: 18, borderRadius: '50%',
                                    background: '#eff6ff', color: '#2563eb',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 9, fontWeight: 800, flexShrink: 0, marginTop: 1,
                                }}>✓</div>
                                <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CTA card */}
                <div className="hci-info-card hci-fade hci-d6" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20 }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 16 }}>
                            Butuh bantuan dokter?
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
                            Konsultasikan hasil pemeriksaan Anda
                        </div>
                        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                            Hasil menunjukkan sesuatu yang mengkhawatirkan?
                            Dokter kami siap membantu secara online maupun tatap muka.
                        </div>
                    </div>
                    <div className="hci-cta-row" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Link to="/consultations" className="hci-btn-solid">
                            <FaUserMd size={13} /> Konsultasi
                        </Link>
                        <Link to="/appointments" className="hci-btn-outline">
                            <FaCalendarAlt size={13} /> Janji Temu
                        </Link>
                    </div>
                </div>
            </div>

        </div>
    </div>
);

export default HealthCheck;