import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Card, Badge } from 'react-bootstrap';
import { FaStethoscope, FaCheckCircle, FaArrowLeft, FaClock, FaPhone } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const PoliUmum = () => {
    const [isHeroVisible, setIsHeroVisible] = useState(false);
    const [isContentVisible, setIsContentVisible] = useState(false);
    
    const heroRef = useRef(null);
    const contentRef = useRef(null);

    const layanan = [
        'Pemeriksaan Fisik & Pengukuran Tekanan Darah',
        'Pemeriksaan Penunjang (EKG dan USG)',
        'Pengobatan Penyakit Umum (flu, infeksi, dll)',
        'Pemeriksaan Kesehatan Berkala',
        'Deteksi Dini Penyakit Kronis (diabetes, hipertensi)',
        'Konsultasi Kesehatan & Gaya Hidup',
    ];

    const fungsi = [
        {
            title: 'Diagnosa & Perawatan Awal',
            desc: 'Menangani berbagai keluhan kesehatan mulai dari penyakit ringan hingga yang lebih serius dengan pemeriksaan menyeluruh.',
        },
        {
            title: 'Pencegahan Penyakit',
            desc: 'Screening, vaksinasi, penyuluhan kesehatan, dan pemeriksaan rutin untuk mencegah penyakit sejak dini.',
        },
        {
            title: 'Rujukan ke Spesialis',
            desc: 'Jika diperlukan penanganan lebih lanjut, dokter akan memberikan rujukan ke spesialis yang sesuai.',
        },
        {
            title: 'Konsultasi Kesehatan',
            desc: 'Konsultasi mengenai pola makan, gaya hidup sehat, dan pengelolaan stres sehari-hari.',
        },
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
                .about-card, .functions-card, .services-card, .schedule-card, .contact-card {
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

                .function-item {
                    transition: all 0.25s ease;
                }

                .function-item:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 4px 12px rgba(13, 110, 253, 0.15);
                }

                .service-item {
                    transition: all 0.25s ease;
                }

                .service-item:hover {
                    transform: translateX(5px);
                    background: #e8f0fe !important;
                    border-radius: 8px;
                }
            `}</style>

            {/* Hero Section */}
            <div 
                ref={heroRef}
                data-section="hero"
                className="service-hero" 
                style={{ background: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)', padding: '60px 0 40px' }}
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
                                <FaStethoscope size={28} color="white" />
                            </div>
                        </div>
                        <div>
                            <div className={`hero-badge ${isHeroVisible ? 'animate-fade-in-left' : ''}`} style={{ animationDelay: '0.2s' }}>
                                <Badge bg="light" text="primary" className="mb-2">Layanan Kesehatan</Badge>
                            </div>
                            <h1 
                                className={`hero-title ${isHeroVisible ? 'animate-fade-in-left' : ''}`} 
                                style={{ animationDelay: '0.3s', fontSize: '2rem' }}
                            >
                                Poli Umum
                            </h1>
                        </div>
                    </div>
                    
                    <p 
                        className={`hero-text ${isHeroVisible ? 'animate-fade-in-left' : ''}`}
                        style={{ animationDelay: '0.4s', maxWidth: 600, color: 'rgba(255,255,255,0.8)' }}
                    >
                        Fondasi penting dalam sistem kesehatan — akses mudah, diagnosa tepat, dan layanan komprehensif untuk semua keluhan kesehatan umum.
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
                                        <h5 className="fw-bold mb-3" style={{ color: '#0d6efd' }}>Tentang Poli Umum</h5>
                                        <p style={{ color: '#4a5568', lineHeight: 1.8 }}>
                                            Pelayanan poli umum merupakan fondasi penting dalam sistem kesehatan masyarakat. Dengan menyediakan akses yang mudah, pendidikan kesehatan, dan layanan medis yang komprehensif, Poli Umum berfungsi sebagai titik awal bagi pasien untuk mendapatkan diagnosis, perawatan, dan rujukan ke layanan kesehatan yang lebih spesifik jika diperlukan.
                                        </p>
                                        <p style={{ color: '#4a5568', lineHeight: 1.8, marginBottom: 0 }}>
                                            Poli umum berkontribusi besar dalam meningkatkan kualitas hidup masyarakat. Oleh karena itu, penting bagi masyarakat untuk memanfaatkan layanan ini secara optimal demi menjaga kesehatan dan mencegah penyakit.
                                        </p>
                                    </Card.Body>
                                </Card>
                            </div>

                            <div className={`functions-card ${isContentVisible ? 'animate-fade-in-up' : ''}`} style={{ animationDelay: '0.2s' }}>
                                <Card className="border-0 shadow-sm rounded-4 mb-4 hover-card">
                                    <Card.Body className="p-4">
                                        <h5 className="fw-bold mb-4" style={{ color: '#0d6efd' }}>Fungsi Poli Umum</h5>
                                        <Row className="g-3">
                                            {fungsi.map((item, i) => (
                                                <Col md={6} key={i}>
                                                    <div 
                                                        className={`function-item ${isContentVisible ? 'animate-fade-in-up' : ''}`}
                                                        style={{ 
                                                            background: '#f0f7ff', 
                                                            borderRadius: 12, 
                                                            padding: '16px', 
                                                            height: '100%',
                                                            animationDelay: `${0.25 + i * 0.1}s`
                                                        }}
                                                    >
                                                        <p className="fw-bold mb-1" style={{ color: '#0d6efd', fontSize: 14 }}>{item.title}</p>
                                                        <p className="mb-0" style={{ color: '#4a5568', fontSize: 13, lineHeight: 1.6 }}>{item.desc}</p>
                                                    </div>
                                                </Col>
                                            ))}
                                        </Row>
                                    </Card.Body>
                                </Card>
                            </div>

                            <div className={`services-card ${isContentVisible ? 'animate-fade-in-up' : ''}`} style={{ animationDelay: '0.3s' }}>
                                <Card className="border-0 shadow-sm rounded-4 hover-card">
                                    <Card.Body className="p-4">
                                        <h5 className="fw-bold mb-4" style={{ color: '#0d6efd' }}>Layanan yang Tersedia</h5>
                                        <Row className="g-2">
                                            {layanan.map((item, i) => (
                                                <Col md={6} key={i}>
                                                    <div 
                                                        className={`service-item d-flex align-items-start gap-2 p-2 ${isContentVisible ? 'animate-fade-in-up' : ''}`}
                                                        style={{ animationDelay: `${0.4 + i * 0.05}s` }}
                                                    >
                                                        <FaCheckCircle color="#0d6efd" size={16} style={{ marginTop: 3, flexShrink: 0 }} />
                                                        <span style={{ fontSize: 14, color: '#4a5568' }}>{item}</span>
                                                    </div>
                                                </Col>
                                            ))}
                                        </Row>
                                    </Card.Body>
                                </Card>
                            </div>
                        </Col>

                        <Col lg={4}>
                            <div className={`schedule-card ${isContentVisible ? 'animate-fade-in-right' : ''}`} style={{ animationDelay: '0.1s' }}>
                                <Card className="border-0 shadow-sm rounded-4 mb-4 hover-card">
                                    <Card.Body className="p-4">
                                        <h6 className="fw-bold mb-3">
                                            <FaClock className="me-2 text-primary" /> Jam Operasional
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
                                <Card className="border-0 shadow-sm rounded-4 hover-card" style={{ background: '#0d6efd' }}>
                                    <Card.Body className="p-4">
                                        <h6 className="fw-bold mb-3 text-white">
                                            <FaPhone className="me-2" /> Hubungi Kami
                                        </h6>
                                        <p className="text-white-50 mb-2" style={{ fontSize: 13 }}>WhatsApp / Telepon</p>
                                        <p className="text-white fw-bold mb-3">087775692881</p>
                                        <p className="text-white-50 mb-1" style={{ fontSize: 13 }}>Email</p>
                                        <p className="text-white mb-0" style={{ fontSize: 13 }}>unitkesehatan@apps.ipb.ac.id</p>
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

export default PoliUmum;