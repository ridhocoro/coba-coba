import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Card, Badge } from 'react-bootstrap';
import { FaClipboardList, FaCheckCircle, FaArrowLeft, FaClock, FaPhone, FaMobileAlt } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const MedicalCheckUp = () => {
    const [isHeroVisible, setIsHeroVisible] = useState(false);
    const [isContentVisible, setIsContentVisible] = useState(false);
    
    const heroRef = useRef(null);
    const contentRef = useRef(null);

    const pemeriksaan = [
        'Pemeriksaan tanda vital (tekanan darah, suhu, nadi, pernapasan, BB, TB)',
        'Pemeriksaan mata dengan Snellen chart',
        'Pemeriksaan rekam jantung / EKG',
        'Darah lengkap, gula darah puasa, asam urat',
        'Profil lipid, fungsi hati, fungsi ginjal',
        'Urin lengkap',
        'Pemeriksaan dokter umum',
    ];

    const appSteps = [
        'Download aplikasi IPB Lecture (dosen) atau IPB Staff (tendik)',
        'Klik haloKLINIK',
        'Klik Riwayat',
        'Klik Rekam Medis',
        'Klik Kunjungan Sehat',
    ];

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const targetId = entry.target.getAttribute('data-section');
                        if (targetId === 'hero') {
                            setIsHeroVisible(true);
                        } else if (targetId === 'content') {
                            setIsContentVisible(true);
                        }
                    }
                });
            },
            { 
                threshold: 0.15,
                rootMargin: '0px'
            }
        );

        if (heroRef.current) observer.observe(heroRef.current);
        if (contentRef.current) observer.observe(contentRef.current);

        return () => observer.disconnect();
    }, []);

    return (
        <div className="service-detail-page">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');
                
                .service-detail-page, .service-detail-page * {
                    font-family: 'Poppins', sans-serif;
                }

                /* State awal - tersembunyi */
                .hero-content, .hero-icon, .hero-badge, .hero-title, .hero-text,
                .examination-card, .steps-card, .schedule-card, .contact-card {
                    opacity: 0;
                }

                /* Animasi fade in dari kiri */
                .animate-fade-in-left {
                    animation: fadeInLeft 0.8s ease-out forwards;
                }

                /* Animasi fade in dari kanan */
                .animate-fade-in-right {
                    animation: fadeInRight 0.8s ease-out forwards;
                }

                /* Animasi fade in dari bawah */
                .animate-fade-in-up {
                    animation: fadeInUp 0.8s ease-out forwards;
                }

                @keyframes fadeInLeft {
                    from {
                        opacity: 0;
                        transform: translateX(-30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes fadeInRight {
                    from {
                        opacity: 0;
                        transform: translateX(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                /* Hover effects */
                .hover-card {
                    transition: all 0.25s ease;
                }

                .hover-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.08) !important;
                }

                .examination-item {
                    transition: all 0.25s ease;
                }

                .examination-item:hover {
                    transform: translateX(5px);
                    background: #fff0e0 !important;
                }

                .step-item {
                    transition: all 0.25s ease;
                }

                .step-item:hover {
                    transform: translateX(5px);
                    background: #fff8f0 !important;
                    border-radius: 8px;
                }
            `}</style>

            {/* Hero Section */}
            <div 
                ref={heroRef}
                data-section="hero"
                className="service-hero" 
                style={{ background: 'linear-gradient(135deg, #fd7e14 0%, #d96a0a 100%)', padding: '60px 0 40px' }}
            >
                <Container>
                    <div className={`hero-content ${isHeroVisible ? 'animate-fade-in-left' : ''}`}>
                        <Link to="/" className="btn btn-outline-light btn-sm mb-4">
                            <FaArrowLeft className="me-2" /> Kembali ke Beranda
                        </Link>
                    </div>
                    
                    <div className="d-flex align-items-center gap-3 mb-3">
                        <div className={`hero-icon ${isHeroVisible ? 'animate-fade-in-left' : ''}`} style={{ animationDelay: '0.1s' }}>
                            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '16px', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FaClipboardList size={28} color="white" />
                            </div>
                        </div>
                        <div>
                            <div className={`hero-badge ${isHeroVisible ? 'animate-fade-in-left' : ''}`} style={{ animationDelay: '0.2s' }}>
                                <Badge bg="light" text="warning" className="mb-2">Layanan Kesehatan</Badge>
                            </div>
                            <h1 
                                className={`hero-title ${isHeroVisible ? 'animate-fade-in-left' : ''}`} 
                                style={{ animationDelay: '0.3s', fontSize: '2rem' }}
                            >
                                Medical Check Up
                            </h1>
                        </div>
                    </div>
                    
                    <p 
                        className={`hero-text ${isHeroVisible ? 'animate-fade-in-left' : ''}`}
                        style={{ animationDelay: '0.4s', maxWidth: 600, color: 'rgba(255,255,255,0.8)' }}
                    >
                        Pemeriksaan kesehatan menyeluruh untuk deteksi dini berbagai penyakit — hasil langsung di hari yang sama.
                    </p>
                </Container>
            </div>

            {/* Content Section */}
            <div 
                ref={contentRef}
                data-section="content"
                style={{ background: '#f8f9fa', padding: '48px 0' }}
            >
                <Container>
                    <Row className="g-4">
                        <Col lg={8}>
                            <div className={`examination-card ${isContentVisible ? 'animate-fade-in-up' : ''}`} style={{ animationDelay: '0.1s' }}>
                                <Card className="border-0 shadow-sm rounded-4 mb-4 hover-card">
                                    <Card.Body className="p-4">
                                        <h5 className="fw-bold mb-3" style={{ color: '#fd7e14' }}>Jenis Pemeriksaan MCU</h5>
                                        <div className="d-flex flex-column gap-2">
                                            {pemeriksaan.map((item, i) => (
                                                <div 
                                                    key={i} 
                                                    className={`examination-item d-flex align-items-start gap-2 p-3 ${isContentVisible ? 'animate-fade-in-up' : ''}`}
                                                    style={{ 
                                                        background: '#fff8f0', 
                                                        borderRadius: 10,
                                                        animationDelay: `${0.2 + i * 0.05}s`
                                                    }}
                                                >
                                                    <FaCheckCircle color="#fd7e14" size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                                                    <span style={{ fontSize: 14, color: '#4a5568' }}>{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </Card.Body>
                                </Card>
                            </div>

                            <div className={`steps-card ${isContentVisible ? 'animate-fade-in-up' : ''}`} style={{ animationDelay: '0.3s' }}>
                                <Card className="border-0 shadow-sm rounded-4 hover-card">
                                    <Card.Body className="p-4">
                                        <h5 className="fw-bold mb-3" style={{ color: '#fd7e14' }}>
                                            <FaMobileAlt className="me-2" />Cara Melihat Hasil MCU
                                        </h5>
                                        <p style={{ fontSize: 14, color: '#4a5568', marginBottom: 16 }}>
                                            Hasil MCU akan muncul pukul <strong>15.00 WIB</strong> pada hari yang sama dan dikirimkan melalui aplikasi IPB Staff / IPB Lecture.
                                        </p>
                                        <div className="d-flex flex-column gap-2">
                                            {appSteps.map((step, i) => (
                                                <div 
                                                    key={i} 
                                                    className={`step-item d-flex align-items-center gap-3 p-2 ${isContentVisible ? 'animate-fade-in-up' : ''}`}
                                                    style={{ animationDelay: `${0.4 + i * 0.05}s` }}
                                                >
                                                    <div style={{ background: '#fd7e14', color: 'white', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                                        {i + 1}
                                                    </div>
                                                    <span style={{ fontSize: 14, color: '#4a5568' }}>{step}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </Card.Body>
                                </Card>
                            </div>
                        </Col>

                        <Col lg={4}>
                            <div className={`schedule-card ${isContentVisible ? 'animate-fade-in-right' : ''}`} style={{ animationDelay: '0.1s' }}>
                                <Card className="border-0 shadow-sm rounded-4 mb-4 hover-card">
                                    <Card.Body className="p-4">
                                        <h6 className="fw-bold mb-3">
                                            <FaClock className="me-2" style={{ color: '#fd7e14' }} /> Jadwal MCU
                                        </h6>
                                        <div style={{ fontSize: 14 }}>
                                            <div className="d-flex justify-content-between py-2 border-bottom">
                                                <span className="text-muted">Hari Pemeriksaan</span>
                                                <span className="fw-medium">Senin – Jumat</span>
                                            </div>
                                            <div className="d-flex justify-content-between py-2 border-bottom">
                                                <span className="text-muted">Waktu Daftar</span>
                                                <span className="fw-medium">08.00 – 11.00 WIB</span>
                                            </div>
                                            <div className="d-flex justify-content-between py-2">
                                                <span className="text-muted">Hasil Keluar</span>
                                                <span className="fw-medium">15.00 WIB</span>
                                            </div>
                                        </div>
                                        <p className="mb-0 mt-2" style={{ fontSize: 12, color: '#6c757d' }}>*Kecuali hari libur nasional</p>
                                    </Card.Body>
                                </Card>
                            </div>

                            <div className={`contact-card ${isContentVisible ? 'animate-fade-in-right' : ''}`} style={{ animationDelay: '0.2s' }}>
                                <Card className="border-0 shadow-sm rounded-4 hover-card" style={{ background: '#fd7e14' }}>
                                    <Card.Body className="p-4">
                                        <h6 className="fw-bold mb-3 text-white">
                                            <FaPhone className="me-2" /> Hubungi Kami
                                        </h6>
                                        <p className="text-white-50 mb-1" style={{ fontSize: 13 }}>WhatsApp</p>
                                        <p className="text-white fw-bold mb-3">087775692881</p>
                                        <p className="text-white-50 mb-1" style={{ fontSize: 13 }}>Telepon</p>
                                        <p className="text-white mb-0" style={{ fontSize: 13 }}>(+62251) 8422094</p>
                                    </Card.Body>
                                </Card>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </div>
        </div>
    );
};

export default MedicalCheckUp;