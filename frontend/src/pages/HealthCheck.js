import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { 
    FaWeight, 
    FaFire, 
    FaHeartbeat, 
    FaArrowRight,
    FaClipboardList,
    FaCheckCircle,
    FaUserMd,
    FaCalendarAlt
} from 'react-icons/fa';

const HealthCheck = () => {
    const features = [
        {
            icon: <FaWeight size={36} />,
            title: 'Kalkulator BMI',
            description: 'Hitung Indeks Massa Tubuh dan ketahui kategori berat badan ideal Anda',
            link: '/health-check/bmi',
            color: '#0d6efd',
            bgColor: '#e7f1ff'
        },
        {
            icon: <FaFire size={36} />,
            title: 'Kalkulator Kalori',
            description: 'Hitung kebutuhan kalori harian berdasarkan BMR dan tingkat aktivitas',
            link: '/health-check/calories',
            color: '#dc3545',
            bgColor: '#fee9e9'
        },
        {
            icon: <FaHeartbeat size={36} />,
            title: 'Cek Tekanan Darah',
            description: 'Periksa kategori tekanan darah dan dapatkan rekomendasi kesehatan',
            link: '/health-check/blood-pressure',
            color: '#198754',
            bgColor: '#e8f5e9'
        }
    ];

    return (
        <div className="health-check-page">
            {/* Simple Header */}
            <section className="py-5 bg-white">
                <Container>
                    <Row className="justify-content-center">
                        <Col lg={8} className="text-center">
                            <div className="mb-4">
                                <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill">
                                    🩺 CEK KESEHATAN
                                </span>
                            </div>
                            <h1 className="display-5 fw-bold mb-3" style={{ color: '#212529' }}>
                                <FaClipboardList className="me-3 text-primary" />
                                Cek Kesehatan Mandiri
                            </h1>
                            <p className="text-secondary mb-0" style={{ fontSize: '1.1rem' }}>
                                Pantau kondisi kesehatan Anda kapan saja dengan alat sederhana dan akurat
                            </p>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Features Section */}
            <Container className="pb-5">
                <Row className="g-4">
                    {features.map((feature, index) => (
                        <Col lg={4} md={6} key={index}>
                            <Card className="h-100 border-0 shadow-sm hover-card">
                                <Card.Body className="p-4">
                                    <div 
                                        className="feature-icon rounded-3 mb-4"
                                        style={{ 
                                            backgroundColor: feature.bgColor,
                                            color: feature.color,
                                            width: '64px',
                                            height: '64px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        {feature.icon}
                                    </div>
                                    
                                    <Card.Title as="h5" className="fw-bold mb-3">
                                        {feature.title}
                                    </Card.Title>
                                    
                                    <Card.Text className="text-secondary mb-4" style={{ fontSize: '0.95rem' }}>
                                        {feature.description}
                                    </Card.Text>

                                    <Button 
                                        as={Link} 
                                        to={feature.link} 
                                        variant="link"
                                        className="p-0 text-decoration-none"
                                        style={{ color: feature.color }}
                                    >
                                        Mulai Cek
                                        <FaArrowRight className="ms-2" size={12} />
                                    </Button>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>

                {/* Info Section - Gabungan */}
                <Row className="mt-5">
                    <Col>
                        <Card className="border-0 bg-light border">
                            <Card.Body className="p-4">
                                <Row className="align-items-center">
                                    <Col lg={8}>
                                        <h5 className="fw-bold mb-3">🩺 Butuh Konsultasi dengan Dokter?</h5>
                                        <p className="text-secondary mb-3 mb-lg-0">
                                            Hasil pemeriksaan menunjukkan hal yang mengkhawatirkan? 
                                            Konsultasikan dengan dokter spesialis kami secara online atau buat janji temu.
                                        </p>
                                    </Col>
                                    <Col lg={4}>
                                        <div className="d-flex gap-2 justify-content-lg-end">
                                            <Button 
                                                as={Link} 
                                                to="/consultations" 
                                                variant="primary"
                                                size="sm"
                                                className="rounded-pill px-4"
                                            >
                                                <FaUserMd className="me-2" />
                                                Konsultasi
                                            </Button>
                                            <Button 
                                                as={Link} 
                                                to="/appointments" 
                                                variant="outline-primary"
                                                size="sm"
                                                className="rounded-pill px-4"
                                            >
                                                <FaCalendarAlt className="me-2" />
                                                Janji Temu
                                            </Button>
                                        </div>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>

            <style jsx="true">{`
                .hover-card {
                    transition: all 0.3s ease;
                }
                .hover-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.05) !important;
                }
                .feature-icon {
                    transition: all 0.3s ease;
                }
                .hover-card:hover .feature-icon {
                    transform: scale(1.1) rotate(5deg);
                }
                .bg-primary-subtle {
                    background-color: #e7f1ff;
                }
            `}</style>
        </div>
    );
};

export default HealthCheck;