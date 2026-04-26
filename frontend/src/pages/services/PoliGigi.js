import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Card, Badge } from 'react-bootstrap';
import { FaTooth, FaCheckCircle, FaArrowLeft, FaClock, FaPhone, FaUserMd } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const PoliGigi = () => {
    const [isHeroVisible, setIsHeroVisible] = useState(false);
    const [isContentVisible, setIsContentVisible] = useState(false);
    
    const heroRef = useRef(null);
    const contentRef = useRef(null);

    const layanan = [
        'Konsultasi & Pemeriksaan Gigi',
        'Penambalan Gigi dengan GIC',
        'Penambalan Gigi dengan Light Cure',
        'Penambalan dengan Tumpatan Sementara',
        'Pencabutan Gigi Susu',
        'Pencabutan Gigi Tetap',
        'Pembersihan Karang Gigi',
        'Perawatan Saluran Akar Gigi',
    ];

    const dokter = [
        { name: 'drg. Titik Nurhayati', jadwal: 'Selasa & Kamis: 08.00 – 14.00 WIB' },
        { name: 'drg. Dwi Haida Mairani', jadwal: 'Senin, Rabu & Sabtu: 08.00 – 14.00 | Jumat: 09.00 – 14.00 WIB' },
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
                .about-card, .services-card, .doctor-card, .schedule-card, .contact-card {
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

                .service-item {
                    transition: all 0.25s ease;
                }

                .service-item:hover {
                    transform: translateX(5px);
                    background: #f3ebff !important;
                    border-radius: 8px;
                }

                .doctor-item {
                    transition: all 0.25s ease;
                }

                .doctor-item:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 4px 12px rgba(111, 66, 193, 0.15);
                }

                .tip-card {
                    transition: all 0.25s ease;
                }

                .tip-card:hover {
                    transform: scale(1.01);
                    background: #fff8e0 !important;
                }
            `}</style>

            {/* Hero Section */}
            <div 
                ref={heroRef}
                data-section="hero"
                className="service-hero" 
                style={{ background: 'linear-gradient(135deg, #6f42c1 0%, #59359a 100%)', padding: '60px 0 40px' }}
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
                                <FaTooth size={28} color="white" />
                            </div>
                        </div>
                        <div>
                            <div className={`hero-badge ${isHeroVisible ? 'animate-fade-in-left' : ''}`} style={{ animationDelay: '0.2s' }}>
                                <Badge bg="light" style={{ color: '#6f42c1' }} className="mb-2">Layanan Kesehatan</Badge>
                            </div>
                            <h1 
                                className={`hero-title ${isHeroVisible ? 'animate-fade-in-left' : ''}`} 
                                style={{ animationDelay: '0.3s', fontSize: '2rem' }}
                            >
                                Poli Gigi
                            </h1>
                        </div>
                    </div>
                    
                    <p 
                        className={`hero-text ${isHeroVisible ? 'animate-fade-in-left' : ''}`}
                        style={{ animationDelay: '0.4s', maxWidth: 600, color: 'rgba(255,255,255,0.8)' }}
                    >
                        Perawatan gigi dan mulut terpadu — pemeriksaan, pencegahan, hingga pengobatan oleh dokter gigi berpengalaman.
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
                                        <h5 className="fw-bold mb-3" style={{ color: '#6f42c1' }}>Tentang Poli Gigi</h5>
                                        <p style={{ color: '#4a5568', lineHeight: 1.8, marginBottom: 0 }}>
                                            Poli Gigi adalah unit yang disediakan fasilitas kesehatan yang berfokus kepada kesehatan gigi dan mulut — mulai dari pemeriksaan, pencegahan, hingga pengobatan penyakit gigi dan mulut. Pelayanan dilakukan oleh kolaborasi antara dokter gigi dan perawat gigi. Ruangan dilengkapi dengan sinar UV untuk sterilisasi dan suction aerosol untuk menghisap partikel droplets sehingga memberikan rasa aman selama perawatan.
                                        </p>
                                    </Card.Body>
                                </Card>
                            </div>

                            <div className={`services-card ${isContentVisible ? 'animate-fade-in-up' : ''}`} style={{ animationDelay: '0.2s' }}>
                                <Card className="border-0 shadow-sm rounded-4 mb-4 hover-card">
                                    <Card.Body className="p-4">
                                        <h5 className="fw-bold mb-4" style={{ color: '#6f42c1' }}>Layanan yang Tersedia</h5>
                                        <Row className="g-2">
                                            {layanan.map((item, i) => (
                                                <Col md={6} key={i}>
                                                    <div 
                                                        className={`service-item d-flex align-items-start gap-2 p-2 ${isContentVisible ? 'animate-fade-in-up' : ''}`}
                                                        style={{ animationDelay: `${0.25 + i * 0.03}s` }}
                                                    >
                                                        <FaCheckCircle color="#6f42c1" size={16} style={{ marginTop: 3, flexShrink: 0 }} />
                                                        <span style={{ fontSize: 14, color: '#4a5568' }}>{item}</span>
                                                    </div>
                                                </Col>
                                            ))}
                                        </Row>
                                    </Card.Body>
                                </Card>
                            </div>

                            <div className={`doctor-card ${isContentVisible ? 'animate-fade-in-up' : ''}`} style={{ animationDelay: '0.3s' }}>
                                <Card className="border-0 shadow-sm rounded-4 hover-card">
                                    <Card.Body className="p-4">
                                        <h5 className="fw-bold mb-4" style={{ color: '#6f42c1' }}>
                                            <FaUserMd className="me-2" />Jadwal Dokter Gigi
                                        </h5>
                                        <Row className="g-3">
                                            {dokter.map((d, i) => (
                                                <Col md={6} key={i}>
                                                    <div 
                                                        className={`doctor-item ${isContentVisible ? 'animate-fade-in-up' : ''}`}
                                                        style={{ 
                                                            background: '#f5f0ff', 
                                                            borderRadius: 12, 
                                                            padding: 16,
                                                            animationDelay: `${0.4 + i * 0.1}s`
                                                        }}
                                                    >
                                                        <p className="fw-bold mb-1" style={{ color: '#6f42c1', fontSize: 14 }}>{d.name}</p>
                                                        <p className="mb-0" style={{ color: '#4a5568', fontSize: 13, lineHeight: 1.6 }}>{d.jadwal}</p>
                                                    </div>
                                                </Col>
                                            ))}
                                        </Row>
                                        <div 
                                            className={`tip-card ${isContentVisible ? 'animate-fade-in-up' : ''}`} 
                                            style={{ 
                                                background: '#fff3cd', 
                                                borderRadius: 10, 
                                                padding: '12px 16px', 
                                                marginTop: 16,
                                                animationDelay: '0.5s'
                                            }}
                                        >
                                            <p className="mb-0" style={{ fontSize: 13, color: '#856404' }}>
                                                💡 Periksakan kondisi kesehatan gigi dan mulut setiap <strong>6 bulan sekali</strong>.
                                            </p>
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
                                            <FaClock className="me-2" style={{ color: '#6f42c1' }} /> Jam Operasional
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
                                <Card className="border-0 shadow-sm rounded-4 hover-card" style={{ background: '#6f42c1' }}>
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

export default PoliGigi;