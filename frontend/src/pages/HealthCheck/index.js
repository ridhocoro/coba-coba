import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { 
    FaWeight, 
    FaFire, 
    FaHeartbeat, 
    FaArrowRight,
    FaClipboardList,
    FaChartLine
} from 'react-icons/fa';

const HealthCheck = () => {
    const features = [
        {
            icon: <FaWeight size={40} className="text-primary" />,
            title: 'Kalkulator BMI',
            description: 'Hitung Indeks Massa Tubuh dan ketahui kategori berat badan Anda',
            link: '/health-check/bmi',
            color: 'primary',
            time: '1 menit'
        },
        {
            icon: <FaFire size={40} className="text-danger" />,
            title: 'Kalkulator Kalori',
            description: 'Hitung kebutuhan kalori harian berdasarkan BMR dan aktivitas',
            link: '/health-check/calories',
            color: 'danger',
            time: '2 menit'
        },
        {
            icon: <FaHeartbeat size={40} className="text-success" />,
            title: 'Cek Tekanan Darah',
            description: 'Periksa kategori tekanan darah Anda (sistolik & diastolik)',
            link: '/health-check/blood-pressure',
            color: 'success',
            time: '1 menit'
        }
    ];

    return (
        <Container className="py-5">
            {/* Header */}
            <Row className="mb-5 text-center">
                <Col>
                    <h1 className="display-4 mb-3">
                        <FaClipboardList className="me-3 text-primary" />
                        Cek Kesehatan Mandiri
                    </h1>
                    <p className="lead text-muted">
                        Gunakan alat kesehatan mandiri kami untuk memantau kondisi tubuh Anda.
                        <br />
                        <strong>Gratis, tanpa perlu login!</strong>
                    </p>
                </Col>
            </Row>

            {/* Features Grid */}
            <Row className="g-4 mb-5">
                {features.map((feature, index) => (
                    <Col md={4} key={index}>
                        <Card className="h-100 shadow-sm">
                            <Card.Body className="text-center p-4">
                                <div className={`mb-3 text-${feature.color}`}>
                                    {feature.icon}
                                </div>
                                <Card.Title as="h4">{feature.title}</Card.Title>
                                <Card.Text className="text-muted mb-3">
                                    {feature.description}
                                </Card.Text>
                                <Card.Text>
                                    <span className="badge bg-light text-dark p-2">
                                        ⏱️ Estimasi: {feature.time}
                                    </span>
                                </Card.Text>
                                <Button 
                                    as={Link} 
                                    to={feature.link} 
                                    variant={`outline-${feature.color}`}
                                    className="mt-2"
                                >
                                    Mulai Cek <FaArrowRight className="ms-2" />
                                </Button>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Statistics */}
            <Row className="mb-5">
                <Col md={12}>
                    <Card className="bg-primary text-white">
                        <Card.Body className="p-4">
                            <Row className="align-items-center">
                                <Col md={8}>
                                    <h4>📊 10.000+ Pemeriksaan Telah Dilakukan</h4>
                                    <p className="mb-0">
                                        Ribuan pengguna telah memanfaatkan fitur cek kesehatan mandiri kami.
                                        Akurat, cepat, dan terpercaya.
                                    </p>
                                </Col>
                                <Col md={4} className="text-end">
                                    <FaChartLine size={60} />
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* FAQ/Info Section */}
            <Row>
                <Col md={6}>
                    <Card className="bg-light border-0">
                        <Card.Body>
                            <h5>❓ Mengapa perlu cek kesehatan mandiri?</h5>
                            <ul className="list-unstyled">
                                <li className="mb-2">✓ Deteksi dini masalah kesehatan</li>
                                <li className="mb-2">✓ Pantau perkembangan kondisi tubuh</li>
                                <li className="mb-2">✓ Motivasi untuk hidup lebih sehat</li>
                                <li className="mb-2">✓ Persiapan sebelum konsultasi dokter</li>
                            </ul>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="bg-light border-0">
                        <Card.Body>
                            <h5>🩺 Butuh bantuan dokter?</h5>
                            <p>
                                Hasil pemeriksaan menunjukkan hal yang mengkhawatirkan?
                                Konsultasikan dengan dokter kami secara online.
                            </p>
                            <Button 
                                as={Link} 
                                to="/consultations" 
                                variant="primary"
                                size="sm"
                            >
                                Konsultasi Sekarang
                            </Button>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default HealthCheck;