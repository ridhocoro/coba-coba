import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Card, Badge } from 'react-bootstrap';
import { FaAmbulance, FaArrowLeft, FaClock, FaPhone, FaExclamationTriangle } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const Ambulance = () => {
    const [isHeroVisible, setIsHeroVisible] = useState(false);
    const [isContentVisible, setIsContentVisible] = useState(false);
    
    const heroRef = useRef(null);
    const contentRef = useRef(null);

    const fungsi = [
        {
            title: 'Transportasi Medis',
            desc: 'Mengangkut pasien dari lokasi kejadian ke fasilitas medis — sangat penting dalam kasus kecelakaan, serangan jantung, atau kondisi medis mendesak lainnya.',
        },
        {
            title: 'Perawatan Awal',
            desc: 'Tim medis dilengkapi untuk memberikan perawatan awal termasuk RJP, pengendalian perdarahan, dan administrasi obat-obatan darurat.',
        },
        {
            title: 'Pemantauan Kondisi Pasien',
            desc: 'Selama perjalanan, kondisi pasien terus dipantau menggunakan alat medis yang tersedia di ambulans.',
        },
    ];

    const jenisAmbulan = [
        { nama: 'Ambulans Darurat', keterangan: 'Untuk situasi kritis, dilengkapi peralatan medis lengkap.' },
        { nama: 'Ambulans Non-Darurat', keterangan: 'Untuk transportasi pasien yang tidak memerlukan perawatan intensif.' },
        { nama: 'Ambulans Khusus', keterangan: 'Dirancang untuk kebutuhan khusus (pediatri, mobilitas terbatas, dll).' },
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
                .emergency-banner, .about-card, .functions-card, .types-card,
                .schedule-card, .contact-card {
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

                .emergency-banner {
                    transition: all 0.25s ease;
                }

                .emergency-banner:hover {
                    transform: scale(1.01);
                }
            `}</style>

            {/* Hero Section */}
            <div 
                ref={heroRef}
                data-section="hero"
                className="service-hero" 
                style={{ background: 'linear-gradient(135deg, #0dcaf0 0%, #0aa2c0 100%)', padding: '60px 0 40px' }}
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
                                <FaAmbulance size={28} color="white" />
                            </div>
                        </div>
                        <div>
                            <div className={`hero-badge ${isHeroVisible ? 'animate-fade-in-left' : ''}`} style={{ animationDelay: '0.2s' }}>
                                <Badge bg="light" text="info" className="mb-2">Layanan Kesehatan</Badge>
                            </div>
                            <h1 
                                className={`hero-title ${isHeroVisible ? 'animate-fade-in-left' : ''}`} 
                                style={{ animationDelay: '0.3s', fontFamily: 'Poppins, sans-serif', fontSize: '2rem' }}
                            >
                                Pelayanan Ambulans
                            </h1>
                        </div>
                    </div>
                    
                    <p 
                        className={`hero-text ${isHeroVisible ? 'animate-fade-in-left' : ''}`}
                        style={{ animationDelay: '0.4s', fontFamily: 'Poppins, sans-serif', maxWidth: 600, color: 'rgba(255,255,255,0.8)' }}
                    >
                        Respons cepat dalam situasi darurat — transportasi medis dan perawatan awal yang tepat untuk menyelamatkan nyawa.
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
                    {/* Nomor Darurat Banner */}
                    <div className={`emergency-banner mb-4 p-4 rounded-4 d-flex align-items-center gap-3 ${isContentVisible ? 'animate-fade-in-up' : ''}`} style={{ background: '#dc3545', color: 'white' }}>
                        <FaExclamationTriangle size={32} />
                        <div>
                            <p className="fw-bold mb-0" style={{ fontSize: 18 }}>Nomor Darurat Ambulans</p>
                            <p className="mb-0" style={{ fontSize: 24, fontWeight: 800 }}>087775692881</p>
                        </div>
                    </div>

                    <Row className="g-4">
                        <Col lg={8}>
                            <div className={`about-card ${isContentVisible ? 'animate-fade-in-up' : ''}`} style={{ animationDelay: '0.1s' }}>
                                <Card className="border-0 shadow-sm rounded-4 mb-4 hover-card">
                                    <Card.Body className="p-4">
                                        <h5 className="fw-bold mb-3" style={{ color: '#0dcaf0' }}>Tentang Pelayanan Ambulans</h5>
                                        <p style={{ color: '#4a5568', lineHeight: 1.8, marginBottom: 0 }}>
                                            Pelayanan ambulans adalah aspek krusial dalam sistem kesehatan. Dalam situasi darurat medis, waktu sangat berharga untuk menyelamatkan nyawa. Ambulans tidak hanya berfungsi sebagai alat transportasi, tetapi juga sebagai unit medis yang dapat memberikan perawatan awal sebelum pasien tiba di rumah sakit.
                                        </p>
                                    </Card.Body>
                                </Card>
                            </div>

                            <div className={`functions-card ${isContentVisible ? 'animate-fade-in-up' : ''}`} style={{ animationDelay: '0.2s' }}>
                                <Card className="border-0 shadow-sm rounded-4 mb-4 hover-card">
                                    <Card.Body className="p-4">
                                        <h5 className="fw-bold mb-4" style={{ color: '#0dcaf0' }}>Fungsi Utama Ambulans</h5>
                                        <div className="d-flex flex-column gap-3">
                                            {fungsi.map((item, i) => (
                                                <div 
                                                    key={i} 
                                                    className={`p-3 ${isContentVisible ? 'animate-fade-in-up' : ''}`}
                                                    style={{ 
                                                        background: '#f0fdff', 
                                                        borderRadius: 12, 
                                                        borderLeft: '3px solid #0dcaf0',
                                                        animationDelay: `${0.3 + i * 0.1}s`
                                                    }}
                                                >
                                                    <p className="fw-bold mb-1" style={{ fontSize: 14, color: '#0aa2c0' }}>{item.title}</p>
                                                    <p className="mb-0" style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.6 }}>{item.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </Card.Body>
                                </Card>
                            </div>

                            <div className={`types-card ${isContentVisible ? 'animate-fade-in-up' : ''}`} style={{ animationDelay: '0.4s' }}>
                                <Card className="border-0 shadow-sm rounded-4 hover-card">
                                    <Card.Body className="p-4">
                                        <h5 className="fw-bold mb-4" style={{ color: '#0dcaf0' }}>Jenis Ambulans</h5>
                                        <Row className="g-3">
                                            {jenisAmbulan.map((item, i) => (
                                                <Col md={4} key={i}>
                                                    <div 
                                                        className={`p-3 ${isContentVisible ? 'animate-fade-in-up' : ''}`}
                                                        style={{ 
                                                            background: '#f0fdff', 
                                                            borderRadius: 12, 
                                                            padding: 16, 
                                                            height: '100%',
                                                            animationDelay: `${0.5 + i * 0.1}s`
                                                        }}
                                                    >
                                                        <p className="fw-bold mb-1" style={{ fontSize: 13, color: '#0aa2c0' }}>{item.nama}</p>
                                                        <p className="mb-0" style={{ fontSize: 12, color: '#4a5568', lineHeight: 1.6 }}>{item.keterangan}</p>
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
                                        <h6 className="fw-bold mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                            <FaClock className="me-2" style={{ color: '#0dcaf0' }} /> Ketersediaan
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
                                <Card className="border-0 shadow-sm rounded-4 hover-card" style={{ background: '#0dcaf0' }}>
                                    <Card.Body className="p-4">
                                        <h6 className="fw-bold mb-3 text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                            <FaPhone className="me-2" /> Panggil Ambulans
                                        </h6>
                                        <p className="text-white-50 mb-1" style={{ fontSize: 13 }}>Nomor Darurat</p>
                                        <p className="text-white fw-bold mb-3" style={{ fontSize: 18 }}>087775692881</p>
                                        <p className="text-white-50 mb-1" style={{ fontSize: 13 }}>Telepon Klinik</p>
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

export default Ambulance;