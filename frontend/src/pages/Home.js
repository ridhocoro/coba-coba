import React from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { 
    FaHeartbeat,
    FaStethoscope, 
    FaPills, 
    FaCalendarAlt, 
    FaFileMedical,
    FaUserMd,
    FaClock,
    FaHospital,
    FaArrowRight,
    FaCheckCircle,
    FaStar,
    FaShieldAlt
} from 'react-icons/fa';

const Home = () => {
    const services = [
        {
            icon: <FaHeartbeat size={40} />,
            title: 'Cek Kesehatan Mandiri',
            description: 'Hitung BMI, kalori harian, dan cek tekanan darah secara gratis tanpa login',
            link: '/health-check',
            color: 'primary',
            features: ['Kalkulator BMI', 'Kalori Harian', 'Tekanan Darah']
        },
        {
            icon: <FaStethoscope size={40} />,
            title: 'Konsultasi Online',
            description: 'Konsultasi dengan dokter spesialis kapan saja, di mana saja',
            link: '/consultations',
            color: 'success',
            features: ['Chat Real-time', 'Resep Digital', 'Rekam Medis']
        },
        {
            icon: <FaFileMedical size={40} />,
            title: 'Surat Sakit Online',
            description: 'Permintaan surat sakit resmi dari dokter',
            link: '/sick-letters',
            color: 'warning',
            features: ['PDF Resmi', 'Tanda Tangan Digital', 'Verifikasi Cepat']
        },
        {
            icon: <FaPills size={40} />,
            title: 'Farmasi Online',
            description: 'Beli obat dengan sistem delivery ke rumah Anda',
            link: '/pharmacy',
            color: 'danger',
            features: ['Katalog Obat', 'Keranjang', 'Delivery 1-3 Hari']
        },
        {
            icon: <FaCalendarAlt size={40} />,
            title: 'Buat Janji Temu',
            description: 'Booking jadwal konsultasi langsung di klinik',
            link: '/appointments',
            color: 'info',
            features: ['Pilih Dokter', 'Pilih Jadwal', 'No. Antrian']
        }
    ];

    const doctors = [
        {
            name: 'dr. Ahmad Syauqi, Sp.PD',
            specialty: 'Penyakit Dalam',
            experience: '15 tahun',
            rating: 4.9,
            patients: '2.5rb+',
            image: '/images/doctor-1.jpg',
            schedule: 'Sen-Jum, 08:00-15:00'
        },
        {
            name: 'dr. Siti Rahma, Sp.A',
            specialty: 'Spesialis Anak',
            experience: '12 tahun',
            rating: 4.8,
            patients: '1.8rb+',
            image: '/images/doctor-2.jpg',
            schedule: 'Sel-Sab, 09:00-16:00'
        },
        {
            name: 'dr. Budi Santoso, Sp.JP',
            specialty: 'Spesialis Jantung',
            experience: '20 tahun',
            rating: 5.0,
            patients: '3.2rb+',
            image: '/images/doctor-3.jpg',
            schedule: 'Sen-Rab, 10:00-14:00'
        }
    ];

    const testimonials = [
        {
            name: 'Rina Wijaya',
            role: 'Pasien',
            content: 'Pelayanan sangat cepat dan dokter-dokternya profesional. Saya bisa konsultasi tanpa harus antri lama.',
            rating: 5,
            date: '2 hari lalu'
        },
        {
            name: 'Bambang Susanto',
            role: 'Sivitas IPB',
            content: 'Fitur konsultasi online sangat membantu. Saya bisa chat dokter dari rumah tanpa harus ke klinik.',
            rating: 5,
            date: '5 hari lalu'
        },
        {
            name: 'Dewi Lestari',
            role: 'Pasien BPJS',
            content: 'Sistemnya mudah digunakan, pembayaran online juga praktis. Surat sakit langsung dapat PDF.',
            rating: 4,
            date: '1 minggu lalu'
        }
    ];

    const stats = [
        { value: '10.000+', label: 'Pasien', icon: FaUserMd },
        { value: '50+', label: 'Dokter', icon: FaStar },
        { value: '24/7', label: 'Layanan', icon: FaClock },
        { value: '100%', label: 'Terpercaya', icon: FaShieldAlt }
    ];

    return (
        <div className="home-page">
            {/* Hero Section */}
            <section className="hero-section bg-primary text-white position-relative overflow-hidden">
                <div className="hero-overlay"></div>
                <Container className="position-relative py-5">
                    <Row className="align-items-center min-vh-75 py-5">
                        <Col lg={7} className="text-lg-start text-center">
                            <h1 className="display-3 fw-bold mb-4 animate__animated animate__fadeInUp">
                                Selamat Datang di <span className="text-warning">Klinik Pratama IPB</span>
                            </h1>
                            <p className="lead mb-4 animate__animated animate__fadeInUp animate__delay-1s">
                                Layanan Kesehatan Modern untuk Sivitas Akademika dan Masyarakat Umum
                                dengan teknologi terkini dan pelayanan profesional.
                            </p>
                            <div className="d-flex gap-3 justify-content-lg-start justify-content-center animate__animated animate__fadeInUp animate__delay-2s">
                                <Button 
                                    as={Link} 
                                    to="/appointments" 
                                    variant="light" 
                                    size="lg"
                                    className="rounded-pill px-4"
                                >
                                    📅 Buat Janji Temu
                                    <FaArrowRight className="ms-2" />
                                </Button>
                                <Button 
                                    as={Link} 
                                    to="/consultations" 
                                    variant="outline-light" 
                                    size="lg"
                                    className="rounded-pill px-4"
                                >
                                    💬 Konsultasi Online
                                </Button>
                            </div>
                        </Col>
                        <Col lg={5} className="d-none d-lg-block">
                            <img 
                                src="/images/hero-doctor.png" 
                                alt="Dokter"
                                className="img-fluid floating"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://via.placeholder.com/500x400?text=Klinik+IPB';
                                }}
                            />
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Stats Section */}
            <section className="stats-section py-5 bg-light">
                <Container>
                    <Row className="g-4">
                        {stats.map((stat, index) => (
                            <Col md={3} key={index}>
                                <div className="text-center">
                                    <stat.icon size={40} className="text-primary mb-3" />
                                    <h2 className="fw-bold mb-1">{stat.value}</h2>
                                    <p className="text-muted mb-0">{stat.label}</p>
                                </div>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>

            {/* Services Section */}
            <section className="services-section py-5">
                <Container>
                    <Row className="mb-5 text-center">
                        <Col>
                            <h2 className="display-6 fw-bold mb-3">Layanan Kami</h2>
                            <p className="lead text-muted">
                                Solusi kesehatan lengkap untuk Anda dan keluarga
                            </p>
                        </Col>
                    </Row>

                    <Row className="g-4">
                        {services.map((service, index) => (
                            <Col lg={4} md={6} key={index}>
                                <Card className="h-100 shadow-sm border-0 hover-card">
                                    <Card.Body className="p-4">
                                        <div className={`feature-icon-wrapper bg-${service.color} bg-opacity-10 rounded-circle mb-4`}>
                                            <div className={`text-${service.color}`}>
                                                {service.icon}
                                            </div>
                                        </div>
                                        <Card.Title as="h4" className="fw-bold mb-3">
                                            {service.title}
                                        </Card.Title>
                                        <Card.Text className="text-muted mb-4">
                                            {service.description}
                                        </Card.Text>
                                        
                                        <div className="feature-list mb-4">
                                            {service.features.map((feature, idx) => (
                                                <div key={idx} className="d-flex align-items-center mb-2">
                                                    <FaCheckCircle className={`text-${service.color} me-2`} size={14} />
                                                    <small>{feature}</small>
                                                </div>
                                            ))}
                                        </div>

                                        <Button 
                                            as={Link} 
                                            to={service.link} 
                                            variant={`outline-${service.color}`}
                                            className="w-100 rounded-pill"
                                        >
                                            Mulai Sekarang
                                            <FaArrowRight className="ms-2" size={14} />
                                        </Button>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>

            {/* Doctors Section */}
            <section className="doctors-section py-5 bg-light">
                <Container>
                    <Row className="mb-5 text-center">
                        <Col>
                            <h2 className="display-6 fw-bold mb-3">Dokter Spesialis Kami</h2>
                            <p className="lead text-muted">
                                Ditangani oleh tim dokter yang berpengalaman di bidangnya
                            </p>
                        </Col>
                    </Row>

                    <Row className="g-4">
                        {doctors.map((doctor, index) => (
                            <Col lg={4} md={6} key={index}>
                                <Card className="h-100 shadow-sm border-0 hover-card">
                                    <Card.Img 
                                        variant="top" 
                                        src={doctor.image}
                                        style={{ height: '250px', objectFit: 'cover' }}
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = 'https://via.placeholder.com/300x250?text=Dokter';
                                        }}
                                    />
                                    <Card.Body className="p-4">
                                        <Card.Title as="h5" className="fw-bold mb-1">
                                            {doctor.name}
                                        </Card.Title>
                                        <Card.Subtitle className="text-primary mb-2">
                                            {doctor.specialty}
                                        </Card.Subtitle>
                                        
                                        <div className="d-flex align-items-center mb-2">
                                            <FaStar className="text-warning me-1" />
                                            <span className="fw-bold me-1">{doctor.rating}</span>
                                            <span className="text-muted">({doctor.patients} pasien)</span>
                                        </div>
                                        
                                        <div className="text-muted small mb-3">
                                            <FaClock className="me-1" />
                                            {doctor.schedule}
                                            <br />
                                            <FaUserMd className="me-1 mt-1" />
                                            Pengalaman: {doctor.experience}
                                        </div>

                                        <Button 
                                            as={Link}
                                            to="/appointments"
                                            variant="primary"
                                            size="sm"
                                            className="w-100"
                                        >
                                            Buat Janji Temu
                                        </Button>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>

            {/* Testimonials Section */}
            <section className="testimonials-section py-5">
                <Container>
                    <Row className="mb-5 text-center">
                        <Col>
                            <h2 className="display-6 fw-bold mb-3">Apa Kata Pasien</h2>
                            <p className="lead text-muted">
                                Pengalaman nyata dari pasien yang telah menggunakan layanan kami
                            </p>
                        </Col>
                    </Row>

                    <Row className="g-4">
                        {testimonials.map((testimonial, index) => (
                            <Col lg={4} md={6} key={index}>
                                <Card className="h-100 shadow-sm border-0">
                                    <Card.Body className="p-4">
                                        <div className="d-flex mb-3">
                                            {[...Array(5)].map((_, i) => (
                                                <FaStar 
                                                    key={i} 
                                                    className={i < testimonial.rating ? 'text-warning' : 'text-secondary'}
                                                    size={16}
                                                />
                                            ))}
                                        </div>
                                        
                                        <Card.Text className="fst-italic mb-4">
                                            "{testimonial.content}"
                                        </Card.Text>
                                        
                                        <div className="d-flex align-items-center">
                                            <div className="flex-grow-1">
                                                <h6 className="fw-bold mb-0">{testimonial.name}</h6>
                                                <small className="text-muted">
                                                    {testimonial.role} • {testimonial.date}
                                                </small>
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>

            {/* CTA Section */}
            <section className="cta-section py-5 bg-primary text-white">
                <Container className="text-center py-4">
                    <h2 className="display-6 fw-bold mb-4">
                        Siap untuk memulai hidup sehat?
                    </h2>
                    <p className="lead mb-4">
                        Daftar sekarang dan dapatkan akses ke semua layanan kami
                    </p>
                    <div className="d-flex gap-3 justify-content-center">
                        <Button 
                            as={Link}
                            to="/register"
                            variant="light" 
                            size="lg"
                            className="rounded-pill px-5"
                        >
                            Daftar Sekarang
                        </Button>
                        <Button 
                            as={Link}
                            to="/health-check"
                            variant="outline-light" 
                            size="lg"
                            className="rounded-pill px-5"
                        >
                            Cek Kesehatan
                        </Button>
                    </div>
                </Container>
            </section>

            {/* FAQ Section */}
            <section className="faq-section py-5 bg-light">
                <Container>
                    <Row className="mb-5 text-center">
                        <Col>
                            <h2 className="display-6 fw-bold mb-3">Pertanyaan Umum</h2>
                            <p className="lead text-muted">
                                Temukan jawaban atas pertanyaan yang sering diajukan
                            </p>
                        </Col>
                    </Row>

                    <Row className="g-4">
                        <Col md={6}>
                            <Card className="border-0 shadow-sm h-100">
                                <Card.Body className="p-4">
                                    <h5 className="fw-bold mb-3">❓ Apakah perlu daftar untuk konsultasi?</h5>
                                    <p className="text-muted mb-0">
                                        Ya, Anda perlu mendaftar akun terlebih dahulu untuk menggunakan 
                                        fitur konsultasi online, surat sakit, dan janji temu.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={6}>
                            <Card className="border-0 shadow-sm h-100">
                                <Card.Body className="p-4">
                                    <h5 className="fw-bold mb-3">❓ Bagaimana cara pembayaran?</h5>
                                    <p className="text-muted mb-0">
                                        Kami menerima pembayaran melalui transfer bank, e-wallet, 
                                        dan kartu kredit. Semua transaksi aman dan terjamin.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={6}>
                            <Card className="border-0 shadow-sm h-100">
                                <Card.Body className="p-4">
                                    <h5 className="fw-bold mb-3">❓ Apakah BPJS diterima?</h5>
                                    <p className="text-muted mb-0">
                                        Ya, Klinik Pratama IPB menerima BPJS Kesehatan untuk 
                                        pelayanan langsung di klinik.
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={6}>
                            <Card className="border-0 shadow-sm h-100">
                                <Card.Body className="p-4">
                                    <h5 className="fw-bold mb-3">❓ Jam operasional klinik?</h5>
                                    <p className="text-muted mb-0">
                                        Poli umum: Senin-Jumat 08:00-16:00, Sabtu 08:00-14:00
                                        IGD: 24 jam non-stop
                                    </p>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </section>

            <style jsx="true">{`
                .hero-section {
                    position: relative;
                    background: linear-gradient(135deg, #0d6efd 0%, #0b5ed7 100%);
                }
                
                .hero-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: url('/images/pattern.png') repeat;
                    opacity: 0.1;
                }
                
                .min-vh-75 {
                    min-height: 75vh;
                }
                
                .floating {
                    animation: floating 3s ease-in-out infinite;
                }
                
                @keyframes floating {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-20px); }
                    100% { transform: translateY(0px); }
                }
                
                .hover-card {
                    transition: all 0.3s ease;
                }
                
                .hover-card:hover {
                    transform: translateY(-10px);
                    box-shadow: 0 15px 30px rgba(0,0,0,0.1) !important;
                }
                
                .feature-icon-wrapper {
                    width: 80px;
                    height: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                }
                
                .feature-list {
                    min-height: 80px;
                }
            `}</style>
        </div>
    );
};

export default Home;