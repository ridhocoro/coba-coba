import React from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { 
    FaHeartbeat,
    FaStethoscope, 
    FaPills, 
    FaCalendarAlt, 
    FaArrowRight,
    FaCheckCircle,
    FaStar,
    FaUserMd,
    FaClock,
    FaMapMarkerAlt,
    FaPhone,
    FaEnvelope,
    FaClipboardCheck,  // Ganti FaShieldAlt dengan ini
    FaUsers,
    FaHospital,
    FaClinicMedical
} from 'react-icons/fa';

const Home = () => {
    // Layanan Utama
    const services = [
        {
            icon: <FaHeartbeat size={32} />,
            title: 'Cek Kesehatan Mandiri',
            description: 'Hitung BMI, kebutuhan kalori, dan cek tekanan darah secara mandiri',
            link: '/health-check',
            color: '#0d6efd',
            features: ['Kalkulator BMI', 'Kalori Harian', 'Tekanan Darah']
        },
        {
            icon: <FaStethoscope size={32} />,
            title: 'Konsultasi Online',
            description: 'Konsultasi dengan dokter melalui chat, kapan saja dan di mana saja',
            link: '/consultations',
            color: '#198754',
            features: ['Chat Real-time', 'Resep Digital', 'Rekam Medis']
        },
        {
            icon: <FaPills size={32} />,
            title: 'Farmasi Online',
            description: 'Pesan obat dengan sistem delivery ke rumah atau kampus',
            link: '/pharmacy',
            color: '#dc3545',
            features: ['Katalog Obat', 'Pengiriman', 'Resep Online']
        },
        {
            icon: <FaCalendarAlt size={32} />,
            title: 'Janji Temu',
            description: 'Booking jadwal konsultasi langsung di klinik tanpa antri lama',
            link: '/appointments',
            color: '#0dcaf0',
            features: ['Pilih Jadwal', 'Pilih Dokter', 'No. Antrian']
        }
    ];

    // 4 Jenis Poli Klinik
    const polyclinics = [
        {
            icon: <FaUserMd size={36} />,
            title: 'Poli Umum',
            description: 'Pelayanan kesehatan umum untuk sivitas akademika dan masyarakat',
            features: ['Pemeriksaan umum', 'Pengobatan', 'Rujukan'],
            color: '#0d6efd',
            bgColor: '#e7f1ff'
        },
        {
            icon: <FaHeartbeat size={36} />,
            title: 'Poli Gizi',
            description: 'Konsultasi gizi dan pola makan sehat untuk segala usia',
            features: ['Konsultasi gizi', 'Diet sehat', 'Edukasi makanan'],
            color: '#198754',
            bgColor: '#e8f5e9'
        },
        {
            icon: <FaUsers size={36} />,
            title: 'Poli KIA',
            description: 'Kesehatan Ibu dan Anak, termasuk pemeriksaan kehamilan dan imunisasi',
            features: ['Ibu hamil', 'Balita', 'KB'],
            color: '#dc3545',
            bgColor: '#fee9e9'
        },
        {
            icon: <FaClinicMedical size={36} />,
            title: 'Poli Gigi',
            description: 'Perawatan gigi dan mulut dengan tenaga medis profesional',
            features: ['Perawatan gigi', 'Pembersihan karang', 'Tambal gigi'],
            color: '#6f42c1',
            bgColor: '#f0e7fe'
        }
    ];

    const testimonials = [
        {
            name: 'Rina Wijaya',
            role: 'Pasien Umum',
            content: 'Pelayanan cepat dan ramah. Saya bisa konsultasi online tanpa harus ke klinik.',
            rating: 5,
            date: '2 hari lalu'
        },
        {
            name: 'Bambang Susanto',
            role: 'Dosen IPB',
            content: 'Fitur booking online sangat membantu. Saya bisa atur jadwal periksa sesuai waktu luang.',
            rating: 5,
            date: '5 hari lalu'
        },
        {
            name: 'Dewi Lestari',
            role: 'Mahasiswi IPB',
            content: 'Poli gizi-nya lengkap, saya dapat rekomendasi menu sehat untuk skripsi.',
            rating: 4,
            date: '1 minggu lalu'
        }
    ];

    const advantages = [
        {
            icon: FaClock,
            title: 'Praktis & Cepat',
            description: 'Booking online, konsultasi via chat, obat diantar'
        },
        {
            icon: FaClipboardCheck,  // Diganti dari FaShieldAlt
            title: 'Terstandar',
            description: 'Tenaga medis profesional dan berpengalaman'
        },
        {
            icon: FaMapMarkerAlt,
            title: 'Lokasi Strategis',
            description: 'Di dalam kampus IPB, mudah dijangkau'
        },
        {
            icon: FaUsers,
            title: 'Untuk Semua',
            description: 'Sivitas akademika & masyarakat umum'
        }
    ];

    const faqs = [
        {
            question: 'Apakah perlu daftar untuk konsultasi?',
            answer: 'Ya, Anda perlu mendaftar akun untuk menggunakan fitur konsultasi online dan janji temu. Pendaftaran gratis dan hanya membutuhkan waktu 2 menit.'
        },
        {
            question: 'Bagaimana cara pembayaran?',
            answer: 'Kami menerima transfer bank BCA, Mandiri, BNI, BRI, dan QRIS. Semua transaksi aman dan terenkripsi.'
        },
        {
            question: 'Apakah menerima BPJS?',
            answer: 'Ya, Klinik Pratama IPB menerima BPJS Kesehatan untuk pelayanan langsung di klinik. Silakan bawa kartu BPJS saat berkunjung.'
        },
        {
            question: 'Jam operasional klinik?',
            answer: 'Pelayanan kami tersedia setiap hari kerja, dari Senin hingga Jumat mulai pukul 08.00 hingga 20.00 WIB. Pada hari Sabtu kami juga membuka layanan dari pukul 08.00 hingga 18.00 WIB.'
        }
    ];

    return (
        <div className="home-page">
            {/* Hero Section - Minimalis */}
            <section className="hero-section py-5">
                <Container>
                    <Row className="align-items-center min-vh-75">
                        <Col lg={6} className="order-lg-1 order-2">
                            <div className="hero-badge mb-4">
                                <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill">
                                    🏥 Klinik Dramaga IPB
                                </span>
                            </div>
                            <h1 className="display-4 fw-bold mb-4" style={{ lineHeight: 1.2 }}>
                                Layanan Kesehatan Modern{' '}
                                <span className="text-primary">di Lingkungan Kampus</span>
                            </h1>
                            <p className="lead text-secondary mb-5" style={{ fontSize: '1.2rem', maxWidth: '90%' }}>
                                Solusi kesehatan terpadu untuk sivitas akademika IPB dan masyarakat umum 
                                dengan teknologi terkini dan pelayanan profesional.
                            </p>
                            
                            <div className="d-flex flex-wrap gap-3">
                                <Button 
                                    as={Link} 
                                    to="/appointments" 
                                    variant="primary" 
                                    size="lg"
                                    className="rounded-pill px-4 py-3 shadow-sm"
                                >
                                    <FaCalendarAlt className="me-2" />
                                    Buat Janji Temu
                                </Button>
                                <Button 
                                    as={Link} 
                                    to="/consultations" 
                                    variant="outline-primary" 
                                    size="lg"
                                    className="rounded-pill px-4 py-3"
                                >
                                    <FaStethoscope className="me-2" />
                                    Konsultasi Online
                                </Button>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Keunggulan Layanan - Subtle */}
            <section className="advantages-section py-4 bg-light-subtle">
                <Container>
                    <Row className="g-4">
                        {advantages.map((item, index) => (
                            <Col md={3} sm={6} key={index}>
                                <div className="d-flex align-items-center">
                                    <div className="advantage-icon bg-white rounded-circle p-3 me-3 shadow-sm">
                                        <item.icon size={24} className="text-primary" />
                                    </div>
                                    <div>
                                        <h6 className="fw-bold mb-1">{item.title}</h6>
                                        <p className="text-secondary small mb-0">{item.description}</p>
                                    </div>
                                </div>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>

            {/* Layanan Kami */}
            <section className="services-section py-5">
                <Container>
                    <Row className="mb-5">
                        <Col md={8} className="mx-auto text-center">
                            <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill mb-3">
                                ✦ LAYANAN
                            </span>
                            <h2 className="display-6 fw-bold mb-3">Solusi Kesehatan Lengkap</h2>
                            <p className="text-secondary">
                                Berbagai layanan kesehatan dapat diakses dengan mudah melalui satu platform
                            </p>
                        </Col>
                    </Row>

                    <Row className="g-4">
                        {services.map((service, index) => (
                            <Col lg={3} md={6} key={index}>
                                <Card className="h-100 border-0 shadow-sm hover-card">
                                    <Card.Body className="p-4">
                                        <div 
                                            className="service-icon rounded-3 mb-4"
                                            style={{ 
                                                backgroundColor: `${service.color}15`,
                                                color: service.color,
                                                width: '60px',
                                                height: '60px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {service.icon}
                                        </div>
                                        
                                        <Card.Title as="h5" className="fw-bold mb-3">
                                            {service.title}
                                        </Card.Title>
                                        
                                        <Card.Text className="text-secondary mb-4">
                                            {service.description}
                                        </Card.Text>
                                        
                                        <div className="features-list mb-4">
                                            {service.features.map((feature, idx) => (
                                                <div key={idx} className="d-flex align-items-center mb-2">
                                                    <FaCheckCircle 
                                                        className="me-2" 
                                                        size={14}
                                                        style={{ color: service.color }}
                                                    />
                                                    <small className="text-secondary">{feature}</small>
                                                </div>
                                            ))}
                                        </div>

                                        <Button 
                                            as={Link} 
                                            to={service.link} 
                                            variant="link"
                                            className="p-0 text-decoration-none"
                                            style={{ color: service.color }}
                                        >
                                            Selengkapnya
                                            <FaArrowRight className="ms-2" size={12} />
                                        </Button>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>

            {/* 4 Jenis Poli Klinik */}
            <section className="polyclinics-section py-5 bg-light-subtle">
                <Container>
                    <Row className="mb-5">
                        <Col md={8} className="mx-auto text-center">
                            <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill mb-3">
                                🏥 POLI KLINIK
                            </span>
                            <h2 className="display-6 fw-bold mb-3">Layanan Poli Klinik</h2>
                            <p className="text-secondary">
                                Dilayani oleh tenaga medis profesional di bidangnya masing-masing
                            </p>
                        </Col>
                    </Row>

                    <Row className="g-4">
                        {polyclinics.map((poly, index) => (
                            <Col lg={3} md={6} key={index}>
                                <Card className="border-0 shadow-sm h-100 poly-card">
                                    <Card.Body className="p-4">
                                        <div 
                                            className="poly-icon rounded-4 mb-4"
                                            style={{ 
                                                backgroundColor: poly.bgColor,
                                                color: poly.color,
                                                width: '70px',
                                                height: '70px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {poly.icon}
                                        </div>
                                        
                                        <Card.Title as="h5" className="fw-bold mb-3">
                                            {poly.title}
                                        </Card.Title>
                                        
                                        <Card.Text className="text-secondary mb-4" style={{ fontSize: '0.95rem' }}>
                                            {poly.description}
                                        </Card.Text>
                                        
                                        <div className="poly-features mb-4">
                                            {poly.features.map((feature, idx) => (
                                                <div key={idx} className="d-flex align-items-center mb-2">
                                                    <div 
                                                        className="rounded-circle me-2"
                                                        style={{ 
                                                            width: '6px', 
                                                            height: '6px', 
                                                            backgroundColor: poly.color 
                                                        }}
                                                    />
                                                    <small className="text-secondary">{feature}</small>
                                                </div>
                                            ))}
                                        </div>

                                        <Button 
                                            as={Link}
                                            to="/appointments"
                                            variant="outline-secondary"
                                            size="sm"
                                            className="rounded-pill"
                                            style={{ borderColor: poly.color, color: poly.color }}
                                            onMouseEnter={(e) => {
                                                e.target.style.backgroundColor = poly.color;
                                                e.target.style.color = 'white';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.target.style.backgroundColor = 'transparent';
                                                e.target.style.color = poly.color;
                                            }}
                                        >
                                            Buat Janji
                                        </Button>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>

            {/* Testimonials */}
            <section className="testimonials-section py-5">
                <Container>
                    <Row className="mb-5">
                        <Col md={8} className="mx-auto text-center">
                            <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill mb-3">
                                💬 TESTIMONIAL
                            </span>
                            <h2 className="display-6 fw-bold mb-3">Apa Kata Mereka</h2>
                            <p className="text-secondary">
                                Pengalaman nyata dari pengguna layanan Klinik Pratama IPB
                            </p>
                        </Col>
                    </Row>

                    <Row className="g-4">
                        {testimonials.map((testimonial, index) => (
                            <Col lg={4} md={6} key={index}>
                                <Card className="h-100 border-0 shadow-sm testimonial-card">
                                    <Card.Body className="p-4">
                                        <div className="d-flex mb-3">
                                            {[...Array(5)].map((_, i) => (
                                                <FaStar 
                                                    key={i} 
                                                    className={i < testimonial.rating ? 'text-warning' : 'text-secondary opacity-25'}
                                                    size={16}
                                                />
                                            ))}
                                        </div>
                                        
                                        <Card.Text className="text-secondary mb-4 fst-italic">
                                            "{testimonial.content}"
                                        </Card.Text>
                                        
                                        <div className="d-flex align-items-center">
                                            <div className="flex-grow-1">
                                                <h6 className="fw-bold mb-1">{testimonial.name}</h6>
                                                <div className="d-flex align-items-center">
                                                    <small className="text-secondary">
                                                        {testimonial.role}
                                                    </small>
                                                    <span className="mx-2 text-secondary">•</span>
                                                    <small className="text-secondary">
                                                        {testimonial.date}
                                                    </small>
                                                </div>
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>

            {/* FAQ Section */}
            <section className="faq-section py-5 bg-light-subtle">
                <Container>
                    <Row className="mb-5">
                        <Col md={8} className="mx-auto text-center">
                            <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill mb-3">
                                ❓ FAQ
                            </span>
                            <h2 className="display-6 fw-bold mb-3">Pertanyaan Umum</h2>
                            <p className="text-secondary">
                                Informasi yang sering ditanyakan seputar layanan kami
                            </p>
                        </Col>
                    </Row>

                    <Row className="g-4">
                        {faqs.map((faq, index) => (
                            <Col md={6} key={index}>
                                <Card className="border-0 shadow-sm h-100">
                                    <Card.Body className="p-4">
                                        <h5 className="fw-bold mb-3">{faq.question}</h5>
                                        <p className="text-secondary mb-0">{faq.answer}</p>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>


            <style jsx="true">{`
                .min-vh-75 {
                    min-height: 70vh;
                }

                .hero-badge .badge {
                    font-weight: 500;
                    letter-spacing: 0.3px;
                    background-color: #e7f1ff;
                }

                .hero-image-wrapper {
                    position: relative;
                }

                .floating {
                    animation: float 6s ease-in-out infinite;
                }

                @keyframes float {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-20px); }
                    100% { transform: translateY(0px); }
                }

                .advantage-icon {
                    transition: all 0.3s ease;
                }

                .advantage-icon:hover {
                    transform: scale(1.1);
                }

                .hover-card {
                    transition: all 0.3s ease;
                }

                .hover-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.05) !important;
                }

                .service-icon {
                    transition: all 0.3s ease;
                }

                .hover-card:hover .service-icon {
                    transform: scale(1.1) rotate(5deg);
                }

                .poly-card {
                    transition: all 0.3s ease;
                }

                .poly-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 30px rgba(0,0,0,0.1) !important;
                }

                .poly-icon {
                    transition: all 0.3s ease;
                }

                .poly-card:hover .poly-icon {
                    transform: scale(1.1);
                }

                .testimonial-card {
                    transition: all 0.3s ease;
                }

                .testimonial-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 30px rgba(0,0,0,0.1) !important;
                }

                .faq-section .card {
                    transition: all 0.3s ease;
                }

                .faq-section .card:hover {
                    transform: translateX(5px);
                    box-shadow: 0 5px 20px rgba(0,0,0,0.05) !important;
                }
            `}</style>
        </div>
    );
};

export default Home;