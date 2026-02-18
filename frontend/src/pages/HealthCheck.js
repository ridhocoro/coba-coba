import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { 
    FaWeight, 
    FaFire, 
    FaHeartbeat, 
    FaArrowRight,
    FaClipboardList,
    FaChartLine,
    FaShieldAlt,
    FaClock,
    FaCheckCircle,  // ✅ TAMBAHKAN INI!
    FaStar,
    FaUserMd
} from 'react-icons/fa';

const HealthCheck = () => {
    const features = [
        {
            icon: <FaWeight size={48} className="text-primary" />,
            title: 'Kalkulator BMI',
            description: 'Hitung Indeks Massa Tubuh dan ketahui kategori berat badan ideal Anda',
            link: '/health-check/bmi',
            color: 'primary',
            time: '1 menit',
            benefits: ['Deteksi berat badan kurang/lebih', 'Saran kesehatan', 'Gratis']
        },
        {
            icon: <FaFire size={48} className="text-danger" />,
            title: 'Kalkulator Kalori',
            description: 'Hitung kebutuhan kalori harian berdasarkan BMR dan tingkat aktivitas',
            link: '/health-check/calories',
            color: 'danger',
            time: '2 menit',
            benefits: ['Rekomendasi asupan', 'Target turun/naik BB', 'Personalisasi']
        },
        {
            icon: <FaHeartbeat size={48} className="text-success" />,
            title: 'Cek Tekanan Darah',
            description: 'Periksa kategori tekanan darah dan dapatkan rekomendasi kesehatan',
            link: '/health-check/blood-pressure',
            color: 'success',
            time: '1 menit',
            benefits: ['Deteksi hipertensi', 'Tips pencegahan', 'Monitoring']
        }
    ];

    const stats = [
        { value: '10K+', label: 'Pemeriksaan', icon: FaChartLine },
        { value: '5K+', label: 'Pengguna Aktif', icon: FaShieldAlt },
        { value: '24/7', label: 'Akses Gratis', icon: FaClock }
    ];

    return (
        <div className="health-check-page">
            {/* Hero Section */}
            <section className="bg-gradient-primary text-white py-5">
                <Container className="py-5">
                    <Row className="align-items-center">
                        <Col lg={8} className="mx-auto text-center">
                            <h1 className="display-4 fw-bold mb-4">
                                <FaClipboardList className="me-3" />
                                Cek Kesehatan Mandiri
                            </h1>
                            <p className="lead mb-4">
                                Pantau kondisi kesehatan Anda kapan saja, di mana saja.
                                <br />
                                <span className="fw-bold">Gratis, tanpa perlu login!</span>
                            </p>
                            <div className="d-flex justify-content-center gap-3">
                                {stats.map((stat, idx) => (
                                    <div key={idx} className="text-center">
                                        <stat.icon size={32} className="mb-2" />
                                        <h3 className="mb-0 fw-bold">{stat.value}</h3>
                                        <small>{stat.label}</small>
                                    </div>
                                ))}
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Features Section */}
            <Container className="py-5">
                <Row className="mb-5 text-center">
                    <Col>
                        <h2 className="display-6 fw-bold mb-3">Pilih Pemeriksaan</h2>
                        <p className="lead text-muted">
                            Lengkapi data diri Anda dan dapatkan hasil instan
                        </p>
                    </Col>
                </Row>

                <Row className="g-4 mb-5">
                    {features.map((feature, index) => (
                        <Col lg={4} key={index}>
                            <Card className="h-100 shadow-sm hover-card border-0">
                                <Card.Body className="text-center p-4">
                                    <div className={`feature-icon-wrapper bg-${feature.color} bg-opacity-10 rounded-circle p-3 d-inline-block mb-4`}>
                                        {feature.icon}
                                    </div>
                                    <Card.Title as="h4" className="fw-bold mb-3">
                                        {feature.title}
                                    </Card.Title>
                                    <Card.Text className="text-muted mb-4">
                                        {feature.description}
                                    </Card.Text>
                                    
                                    <div className="benefits-list mb-4">
                                        {feature.benefits.map((benefit, idx) => (
                                            <div key={idx} className="d-flex align-items-center mb-2">
                                                <FaCheckCircle className={`text-${feature.color} me-2`} size={16} />
                                                <small>{benefit}</small>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <span className="badge bg-light text-dark p-2">
                                            <FaClock className="me-1" />
                                            {feature.time}
                                        </span>
                                        <span className="badge bg-success">Gratis</span>
                                    </div>

                                    <Button 
                                        as={Link} 
                                        to={feature.link} 
                                        variant={`outline-${feature.color}`}
                                        className="w-100 rounded-pill"
                                        size="lg"
                                    >
                                        Mulai Cek <FaArrowRight className="ms-2" />
                                    </Button>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>

                {/* Info Section */}
                <Row className="mt-5">
                    <Col lg={6} className="mb-4">
                        <Card className="border-0 bg-light h-100">
                            <Card.Body className="p-4">
                                <h4 className="fw-bold mb-4">❓ Mengapa Perlu Cek Kesehatan Mandiri?</h4>
                                <ul className="list-unstyled">
                                    <li className="d-flex mb-3">
                                        <FaCheckCircle className="text-success me-3 mt-1" size={20} />
                                        <div>
                                            <strong>Deteksi Dini</strong>
                                            <p className="text-muted mb-0">Kenali risiko kesehatan sejak awal</p>
                                        </div>
                                    </li>
                                    <li className="d-flex mb-3">
                                        <FaCheckCircle className="text-success me-3 mt-1" size={20} />
                                        <div>
                                            <strong>Pantau Perkembangan</strong>
                                            <p className="text-muted mb-0">Evaluasi efektivitas program kesehatan</p>
                                        </div>
                                    </li>
                                    <li className="d-flex mb-3">
                                        <FaCheckCircle className="text-success me-3 mt-1" size={20} />
                                        <div>
                                            <strong>Edukasi Kesehatan</strong>
                                            <p className="text-muted mb-0">Pahami kondisi tubuh lebih baik</p>
                                        </div>
                                    </li>
                                    <li className="d-flex">
                                        <FaCheckCircle className="text-success me-3 mt-1" size={20} />
                                        <div>
                                            <strong>Persiapan Konsultasi</strong>
                                            <p className="text-muted mb-0">Data pendukung untuk dokter</p>
                                        </div>
                                    </li>
                                </ul>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col lg={6} className="mb-4">
                        <Card className="border-0 bg-primary text-white h-100">
                            <Card.Body className="p-4">
                                <h4 className="fw-bold mb-4">🩺 Butuh Konsultasi Dokter?</h4>
                                <p className="mb-4">
                                    Hasil pemeriksaan menunjukkan hal yang mengkhawatirkan? 
                                    Konsultasikan dengan dokter spesialis kami secara online.
                                </p>
                                <div className="d-flex gap-3">
                                    <Button 
                                        as={Link} 
                                        to="/consultations" 
                                        variant="light"
                                        size="lg"
                                        className="rounded-pill"
                                    >
                                        Konsultasi Online
                                    </Button>
                                    <Button 
                                        as={Link} 
                                        to="/appointments" 
                                        variant="outline-light"
                                        size="lg"
                                        className="rounded-pill"
                                    >
                                        Buat Janji Temu
                                    </Button>
                                </div>
                                <p className="mt-4 mb-0 small opacity-75">
                                    *Dokter spesialis tersedia 24/7
                                </p>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>

            <style jsx="true">{`
                .bg-gradient-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .hover-card {
                    transition: all 0.3s ease;
                }
                .hover-card:hover {
                    transform: translateY(-10px);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1) !important;
                }
                .feature-icon-wrapper {
                    width: 96px;
                    height: 96px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto;
                }
                .benefits-list {
                    min-height: 100px;
                }
            `}</style>
        </div>
    );
};

export default HealthCheck;