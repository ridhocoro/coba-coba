import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Card, Badge } from 'react-bootstrap';
import { FaFlask, FaArrowLeft, FaClock, FaPhone } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const Laboratorium = () => {
    const [isHeroVisible, setIsHeroVisible] = useState(false);
    const [isContentVisible, setIsContentVisible] = useState(false);
    
    const heroRef = useRef(null);
    const contentRef = useRef(null);

    const pemeriksaan = [
        { kategori: 'Hematologi', detail: 'Darah rutin, Darah lengkap, Golongan Darah + Rhesus' },
        { kategori: 'Urinalisa', detail: 'Urine rutin, Urine lengkap' },
        { kategori: 'Kimia Darah', detail: 'Gula darah puasa/2 jam PP/sewaktu, HbA1C, Kolesterol total, HDL, LDL, Trigliserida, Ureum, Kreatinin, Asam Urat, SGOT, SGPT' },
        { kategori: 'Infeksi & Serologi', detail: 'Widal, HBsAg, Tes Antigen' },
        { kategori: 'Hemostasis', detail: 'Masa pendarahan (BT), Masa pembekuan (CT)' },
        { kategori: 'Narkoba', detail: '6 parameter: Cocaine, Metamfetamin, Morphine, Benzodiazepine, Amphetamin, THC' },
        { kategori: 'Tuberkulosis', detail: 'TCM (Tes Cepat Molekuler)' },
        { kategori: 'Elektrolit', detail: 'Kalium (K), Natrium (Na), Klorida (CL), Kalsium (Ca)' },
        { kategori: 'Analisa Feses', detail: 'Pemeriksaan feses lengkap' },
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
                .about-card, .examination-card, .schedule-card, .contact-card {
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
                    background: #e8fcf5 !important;
                }
            `}</style>

            {/* Hero Section */}
            <div 
                ref={heroRef}
                data-section="hero"
                className="service-hero" 
                style={{ background: 'linear-gradient(135deg, #20c997 0%, #198a6f 100%)', padding: '60px 0 40px' }}
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
                                <FaFlask size={28} color="white" />
                            </div>
                        </div>
                        <div>
                            <div className={`hero-badge ${isHeroVisible ? 'animate-fade-in-left' : ''}`} style={{ animationDelay: '0.2s' }}>
                                <Badge bg="light" text="success" className="mb-2">Layanan Kesehatan</Badge>
                            </div>
                            <h1 
                                className={`hero-title ${isHeroVisible ? 'animate-fade-in-left' : ''}`} 
                                style={{ animationDelay: '0.3s', fontSize: '2rem' }}
                            >
                                Laboratorium
                            </h1>
                        </div>
                    </div>
                    
                    <p 
                        className={`hero-text ${isHeroVisible ? 'animate-fade-in-left' : ''}`}
                        style={{ animationDelay: '0.4s', maxWidth: 600, color: 'rgba(255,255,255,0.8)' }}
                    >
                        Pemeriksaan spesimen klinik yang akurat dan terpercaya — alat dikalibrasi rutin untuk memastikan keakuratan hasil.
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
                            <div className={`about-card ${isContentVisible ? 'animate-fade-in-up' : ''}`} style={{ animationDelay: '0.1s' }}>
                                <Card className="border-0 shadow-sm rounded-4 mb-4 hover-card">
                                    <Card.Body className="p-4">
                                        <h5 className="fw-bold mb-3" style={{ color: '#20c997' }}>Tentang Laboratorium</h5>
                                        <p style={{ color: '#4a5568', lineHeight: 1.8, marginBottom: 0 }}>
                                            Laboratorium Klinik IPB Dramaga memegang peran penting dalam dunia kesehatan sebagai fasilitas yang menyediakan berbagai layanan pemeriksaan spesimen klinik. Untuk menjaga keakuratan hasil, semua alat laboratorium dikalibrasi setahun sekali oleh teknisi terlatih menggunakan standar referensi yang telah disetujui badan standar.
                                        </p>
                                    </Card.Body>
                                </Card>
                            </div>

                            <div className={`examination-card ${isContentVisible ? 'animate-fade-in-up' : ''}`} style={{ animationDelay: '0.2s' }}>
                                <Card className="border-0 shadow-sm rounded-4 hover-card">
                                    <Card.Body className="p-4">
                                        <h5 className="fw-bold mb-4" style={{ color: '#20c997' }}>Jenis Pemeriksaan</h5>
                                        <div className="d-flex flex-column gap-2">
                                            {pemeriksaan.map((item, i) => (
                                                <div 
                                                    key={i} 
                                                    className={`examination-item p-3 ${isContentVisible ? 'animate-fade-in-up' : ''}`}
                                                    style={{ 
                                                        background: '#f0fdf8', 
                                                        borderRadius: 10, 
                                                        borderLeft: '3px solid #20c997',
                                                        animationDelay: `${0.3 + i * 0.05}s`
                                                    }}
                                                >
                                                    <p className="fw-bold mb-1" style={{ fontSize: 14, color: '#20c997' }}>{item.kategori}</p>
                                                    <p className="mb-0" style={{ fontSize: 13, color: '#4a5568' }}>{item.detail}</p>
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
                                            <FaClock className="me-2" style={{ color: '#20c997' }} /> Jam Operasional
                                        </h6>
                                        <div style={{ fontSize: 14 }}>
                                            <div className="d-flex justify-content-between py-2 border-bottom">
                                                <span className="text-muted">Senin – Jumat</span>
                                                <span className="fw-medium">08.00 – 20.00 WIB</span>
                                            </div>
                                            <div className="d-flex justify-content-between py-2">
                                                <span className="text-muted">Sabtu</span>
                                                <span className="fw-medium">08.00 – 18.00 WIB</span>
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </div>

                            <div className={`contact-card ${isContentVisible ? 'animate-fade-in-right' : ''}`} style={{ animationDelay: '0.2s' }}>
                                <Card className="border-0 shadow-sm rounded-4 hover-card" style={{ background: '#20c997' }}>
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

export default Laboratorium;