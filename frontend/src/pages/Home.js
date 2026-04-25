import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    FaClipboardCheck,
    FaUsers,
    FaHospital,
    FaClinicMedical,
    FaChevronLeft,
    FaChevronRight,
    FaFacebook,
    FaInstagram,
    FaTwitter,
    FaWhatsapp,
    FaRegClock,
    FaPhoneAlt,
    FaMapPin,
    FaInfoCircle,
    FaShieldAlt,
    FaAmbulance,
    FaSyringe,
    FaBabyCarriage,
    FaTooth,
    FaEye,
    FaLungs,
    FaBone,
    FaPlayCircle,
    FaClipboardList,
    FaFlask,
    FaTruck
} from 'react-icons/fa';

// Data untuk carousel - infinite looping dengan clone slides
const originalCarouselImages = [
    {
        url: "/images/klinik.png",
        titleLine1: "SELAMAT DATANG DI",
        titleLine2: "Unit Kesehatan Terbaik",
        titleLine3: "IPB University",
        subtitle: '"Prestasi lahir dari tubuh yang sehat"',
        showText: true
    },
    {
        url: "/images/Janjicarousel.png",
        showText: false
    },
    {
        url: "/images/Konsulcarousel.png",
        showText: false
    }
];

// Untuk infinite looping, buat array dengan clone slides (tambah di awal dan akhir)
const getInfiniteSlides = (slides) => {
    if (slides.length === 0) return [];
    return [slides[slides.length - 1], ...slides, slides[0]];
};

const Home = () => {
    const [currentSlide, setCurrentSlide] = useState(1);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [carouselImages, setCarouselImages] = useState(getInfiniteSlides(originalCarouselImages));
    const [isInfiniteAnimating, setIsInfiniteAnimating] = useState(false);
    const autoPlayInterval = useRef(null);
    
    // Refs untuk scroll animation
    const welcomeRef = useRef(null);
    const servicesRef = useRef(null);
    const testimonialsRef = useRef(null);
    const [isWelcomeVisible, setIsWelcomeVisible] = useState(false);
    const [isServicesVisible, setIsServicesVisible] = useState(false);
    const [isTestimonialsVisible, setIsTestimonialsVisible] = useState(false);

    // Intersection Observer untuk animasi scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const targetId = entry.target.getAttribute('data-section');
                        switch(targetId) {
                            case 'welcome':
                                setIsWelcomeVisible(true);
                                break;
                            case 'services':
                                setIsServicesVisible(true);
                                break;
                            case 'testimonials':
                                setIsTestimonialsVisible(true);
                                break;
                            default:
                                break;
                        }
                    }
                });
            },
            { 
                threshold: 0.15,
                rootMargin: '0px'
            }
        );

        if (welcomeRef.current) observer.observe(welcomeRef.current);
        if (servicesRef.current) observer.observe(servicesRef.current);
        if (testimonialsRef.current) observer.observe(testimonialsRef.current);

        return () => observer.disconnect();
    }, []);

    // Handle infinite looping reset
    const handleInfiniteTransition = useCallback(() => {
        if (!isTransitioning) return;

        if (currentSlide >= carouselImages.length - 1) {
            setTimeout(() => {
                setIsTransitioning(false);
                setIsInfiniteAnimating(true);
                setCurrentSlide(1);
                setTimeout(() => {
                    setIsInfiniteAnimating(false);
                }, 50);
            }, 500);
        }
        else if (currentSlide <= 0) {
            setTimeout(() => {
                setIsTransitioning(false);
                setIsInfiniteAnimating(true);
                setCurrentSlide(carouselImages.length - 2);
                setTimeout(() => {
                    setIsInfiniteAnimating(false);
                }, 50);
            }, 500);
        } else {
            setTimeout(() => setIsTransitioning(false), 500);
        }
    }, [currentSlide, carouselImages.length, isTransitioning]);

    useEffect(() => {
        if (isTransitioning) {
            handleInfiniteTransition();
        }
    }, [currentSlide, isTransitioning, handleInfiniteTransition]);

    // Auto slide every 5 seconds
    useEffect(() => {
        autoPlayInterval.current = setInterval(() => {
            if (!isTransitioning && !isInfiniteAnimating) {
                nextSlide();
            }
        }, 5000);
        return () => {
            if (autoPlayInterval.current) clearInterval(autoPlayInterval.current);
        };
    }, [isTransitioning, isInfiniteAnimating]);

    const nextSlide = () => {
        if (isTransitioning || isInfiniteAnimating) return;
        setIsTransitioning(true);
        setCurrentSlide((prev) => prev + 1);
    };

    const goToSlide = (index) => {
        if (isTransitioning || isInfiniteAnimating) return;
        const carouselIndex = index + 1;
        if (carouselIndex === currentSlide) return;
        setIsTransitioning(true);
        setCurrentSlide(carouselIndex);
    };

    const getActualIndex = () => {
        if (currentSlide === 0) return originalCarouselImages.length - 1;
        if (currentSlide === carouselImages.length - 1) return 0;
        return currentSlide - 1;
    };

    const getYouTubeVideoId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const videoId = getYouTubeVideoId('https://youtu.be/jSwm2vSnOEM?si=l7LfgNTj9SIrARPX');

    const services = [
        {
            icon: <FaStethoscope size={28} />,
            title: 'Poli Umum',
            description: 'Pemeriksaan kesehatan umum, diagnosa, dan pengobatan berbagai penyakit',
            link: '/services/general',
            color: '#0d6efd'
        },
        {
            icon: <FaHeartbeat size={28} />,
            title: 'Poli Gizi',
            description: 'Konsultasi gizi, diet sehat, dan edukasi pola makan',
            link: '/services/nutrition',
            color: '#198754'
        },
        {
            icon: <FaBabyCarriage size={28} />,
            title: 'Poli KIA',
            description: 'Kesehatan Ibu dan Anak, pemeriksaan kehamilan, imunisasi',
            link: '/services/mch',
            color: '#dc3545'
        },
        {
            icon: <FaTooth size={28} />,
            title: 'Poli Gigi',
            description: 'Perawatan gigi dan mulut, tambal gigi, pembersihan karang',
            link: '/services/dental',
            color: '#6f42c1'
        },
        {
            icon: <FaClipboardList size={28} />,
            title: 'Medical Check Up',
            description: 'Pemeriksaan kesehatan menyeluruh untuk deteksi dini berbagai penyakit',
            link: '/services/medical-checkup',
            color: '#fd7e14'
        },
        {
            icon: <FaFlask size={28} />,
            title: 'Laboratorium',
            description: 'Pemeriksaan darah, urine, dan berbagai tes penunjang diagnosis',
            link: '/services/laboratory',
            color: '#20c997'
        },
        {
            icon: <FaPills size={28} />,
            title: 'Farmasi',
            description: 'Apotek dengan obat-obatan lengkap dan harga terjangkau',
            link: '/services/pharmacy',
            color: '#dc3545'
        },
        {
            icon: <FaAmbulance size={28} />,
            title: 'Ambulance',
            description: 'Layanan darurat 24 jam dengan ambulance siap sedia',
            link: '/services/ambulance',
            color: '#0dcaf0'
        }
    ];

    const testimonials = [
        {
            name: 'Bahlil',
            role: 'Menteri',
            content: 'Saya berharap program MBG dijalankan di IPB.',
            photo: '/images/testimoni1.png'
        },
        {
            name: 'Gibran Rakabuming',
            role: 'Wakil Presiden',
            content: 'YNTKTS.',
            photo: '/images/testimoni2.png'
        },
        {
            name: 'Noriyuki Makihara',
            role: 'Pria Solo',
            content: 'Dihina-hina saya diam, tapi hari ini akan saya sampaikan, saya akan lawan.',
            photo: '/images/testimoni3.png'
        }
    ];

    return (
        <div className="home-page">
            {/* Hero Section dengan Carousel */}
            <div className="carousel-wrapper">
                <Container>
                    <div className="hero-carousel-section">
                        <div className="carousel-container">
                            <div 
                                className="carousel-slides"
                                style={{ 
                                    transform: `translateX(-${currentSlide * 100}%)`,
                                    transition: isTransitioning && !isInfiniteAnimating ? 'transform 0.5s ease-in-out' : 'none'
                                }}
                            >
                                {carouselImages.map((image, index) => (
                                    <div 
                                        key={index}
                                        className="carousel-slide"
                                        style={{ backgroundImage: `url(${image.url})` }}
                                    >
                                        <div className="carousel-overlay">
                                            <Container className="h-100">
                                                <Row className="align-items-center h-100">
                                                    <Col lg={8}>
                                                        {image.showText && (
                                                            <div className="carousel-content">
                                                                <p className="carousel-pre-title">
                                                                    {image.titleLine1}
                                                                </p>
                                                                <h1 className="carousel-title">
                                                                    {image.titleLine2}
                                                                </h1>
                                                                <h2 className="carousel-subtitle">
                                                                    {image.titleLine3}
                                                                </h2>
                                                                <p className="carousel-quote">
                                                                    {image.subtitle}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </Col>
                                                </Row>
                                            </Container>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="carousel-dots">
                                {originalCarouselImages.map((_, index) => (
                                    <button
                                        key={index}
                                        className={`carousel-dot ${index === getActualIndex() ? 'active' : ''}`}
                                        onClick={() => goToSlide(index)}
                                        aria-label={`Go to slide ${index + 1}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </Container>
            </div>

            {/* Sambutan Section dengan Animasi Masuk */}
            <section 
                ref={welcomeRef}
                data-section="welcome"
                className="welcome-section py-5"
            >
                <Container>
                    <Row className="align-items-stretch">
                        <Col lg={7} className="mb-4 mb-lg-0">
                            <div className={`welcome-content h-100 p-4 bg-white rounded-4 shadow-sm ${isWelcomeVisible ? 'animate-fade-in-left' : ''}`}>
                                <h2 className="welcome-title mb-4">Selamat datang di Website Unit Kesehatan IPB University.</h2>
                                
                                <div className="welcome-text">
                                    <p className="welcome-paragraph">
                                        Website ini dimaksudkan sebagai sarana publikasi untuk memberikan informasi mengenai Unit Kesehatan IPB.
                                    </p>
                                    
                                    <p className="welcome-paragraph">
                                        Kritik dan saran yang ada sangat kami harapkan guna penyempurnaan website ini dimasa akan datang.
                                    </p>
                                    
                                    <p className="welcome-paragraph">
                                        Sampaikan kritik dan saran melalu email kami di <strong className="text-primary">unitkesehatan@apps.ipb.ac.id</strong>. 
                                        Semoga website ini memberikan manfaat dan inspirasi bagi para pembaca.
                                    </p>
                                    
                                    <p className="welcome-paragraph">
                                        Jangan lupa follow sosial media kami di instagram:{" "}
                                        <a 
                                            href="https://www.instagram.com/klinikipbdramaga/" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-danger fw-bold text-decoration-none instagram-link"
                                        >
                                            “klinikipbdramaga”
                                        </a>
                                        , agar selalu terupdate dengan berita terbaru.
                                    </p>
                                </div>
                                
                                <div className="head-unit-info mt-4 pt-3 border-top">
                                    <p className="head-unit-label mb-1">Kepala Unit Kesehatan IPB University</p>
                                    <p className="head-unit-name mb-0">drg. Titik Nurhayati</p>
                                </div>
                            </div>
                        </Col>

                        <Col lg={5}>
                            <div className={`video-wrapper h-100 bg-white rounded-4 shadow-sm overflow-hidden ${isWelcomeVisible ? 'animate-fade-in-right' : ''}`}>
                                {videoId ? (
                                    <div className="ratio ratio-16x9 h-100">
                                        <iframe 
                                            src={`https://www.youtube.com/embed/${videoId}`}
                                            title="IPBPedia Klinik IPB University"
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            className="rounded-4"
                                        ></iframe>
                                    </div>
                                ) : (
                                    <div className="d-flex align-items-center justify-content-center h-100 bg-light">
                                        <p className="text-muted">Video tidak tersedia</p>
                                    </div>
                                )}
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Layanan Kami Section dengan Animasi Masuk */}
            <section 
                ref={servicesRef}
                data-section="services"
                className="services-section py-5 bg-light"
            >
                <Container>
                    <Row className="mb-5">
                        <Col md={8} className="mx-auto text-center">
                            <h2 className="section-title mb-3">LAYANAN KAMI</h2>
                            <div className="divider mx-auto" style={{ width: '60px', height: '3px', backgroundColor: '#0d6efd', marginBottom: '20px' }}></div>
                            <p className="section-subtitle-text">
                                Berbagai layanan kesehatan tersedia untuk memenuhi kebutuhan Anda
                            </p>
                        </Col>
                    </Row>

                    <Row className="g-4 mb-4">
                        {services.slice(0, 4).map((service, index) => (
                            <Col lg={3} md={6} key={index}>
                                <Card className={`h-100 border-0 shadow-sm hover-card service-card ${isServicesVisible ? 'animate-fade-in-up' : ''}`} style={{ transitionDelay: `${index * 0.1}s` }}>
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
                                        
                                        <Card.Title as="h5" className="service-card-title mb-3">
                                            {service.title}
                                        </Card.Title>
                                        
                                        <Card.Text className="service-card-text mb-4">
                                            {service.description}
                                        </Card.Text>

                                        <Button 
                                            as={Link} 
                                            to={service.link} 
                                            variant="link"
                                            className="p-0 text-decoration-none fw-medium service-link"
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

                    <Row className="g-4">
                        {services.slice(4, 8).map((service, index) => (
                            <Col lg={3} md={6} key={index + 4}>
                                <Card className={`h-100 border-0 shadow-sm hover-card service-card ${isServicesVisible ? 'animate-fade-in-up' : ''}`} style={{ transitionDelay: `${(index + 4) * 0.1}s` }}>
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
                                        
                                        <Card.Title as="h5" className="service-card-title mb-3">
                                            {service.title}
                                        </Card.Title>
                                        
                                        <Card.Text className="service-card-text mb-4">
                                            {service.description}
                                        </Card.Text>

                                        <Button 
                                            as={Link} 
                                            to={service.link} 
                                            variant="link"
                                            className="p-0 text-decoration-none fw-medium service-link"
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

            {/* Testimonials Section dengan Animasi Masuk */}
            <section 
                ref={testimonialsRef}
                data-section="testimonials"
                className="testimonials-section py-5"
            >
                <Container>
                    <Row className="mb-5">
                        <Col md={8} className="mx-auto text-center">
                            <h2 className="section-title mb-3">Apa Kata MEREKA?</h2>
                            <div className="divider mx-auto" style={{ width: '60px', height: '3px', backgroundColor: '#0d6efd', marginBottom: '20px' }}></div>
                            <p className="section-subtitle-text">
                                Pengalaman nyata dari pengguna layanan Unit Kesehatan IPB
                            </p>
                        </Col>
                    </Row>

                    <Row className="g-4">
                        {testimonials.map((testimonial, index) => (
                            <Col lg={4} md={6} key={index}>
                                <Card className={`h-100 border-0 shadow-sm testimonial-card ${isTestimonialsVisible ? 'animate-fade-in-up' : ''}`} style={{ transitionDelay: `${index * 0.15}s` }}>
                                    <Card.Body className="p-4">
                                        <div className="testimonial-photo-wrapper">
                                            <div className="testimonial-photo-border">
                                                {testimonial.photo ? (
                                                    <img 
                                                        src={testimonial.photo} 
                                                        alt={testimonial.name}
                                                        className="testimonial-photo"
                                                    />
                                                ) : (
                                                    <div className="testimonial-photo-placeholder">
                                                        <FaUserMd size={48} className="text-secondary opacity-50" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="testimonial-name-wrapper">
                                            <h6 className="testimonial-name fw-bold mb-0">{testimonial.name}</h6>
                                            <span className="testimonial-role"> &nbsp;- {testimonial.role}</span>
                                        </div>
                                        
                                        <Card.Text className="testimonial-content text-secondary mt-3 mb-0">
                                            "{testimonial.content}"
                                        </Card.Text>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>

            <style jsx="true">{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');

                .home-page, .home-page * {
                    font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                /* ==================== SCROLL ANIMATION - HANYA SAAT MASUK ==================== */
                
                /* State awal - tersembunyi */
                .welcome-content, .video-wrapper, .service-card, .testimonial-card {
                    opacity: 0;
                }
                
                /* Animasi fade in dari kiri */
                .animate-fade-in-left {
                    animation: fadeInLeft 1s ease-out forwards;
                }
                
                /* Animasi fade in dari kanan */
                .animate-fade-in-right {
                    animation: fadeInRight 1s ease-out forwards;
                }
                
                /* Animasi fade in dari bawah */
                .animate-fade-in-up {
                    animation: fadeInUp 1s ease-out forwards;
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

                /* ==================== CAROUSEL STYLES ==================== */
                .carousel-wrapper {
                    margin-top: 40px;
                    margin-bottom: 0px;
                }

                .hero-carousel-section {
                    position: relative;
                    width: 100%;
                    overflow: hidden;
                    background: #000;
                    border-radius: 15px;
                    margin-top: 0;
                }

                .carousel-container {
                    position: relative;
                    width: 100%;
                    overflow: hidden;
                    border-radius: 0px;
                }

                .carousel-slides {
                    display: flex;
                    width: 100%;
                }

                .carousel-slide {
                    flex-shrink: 0;
                    width: 100%;
                    height: 400px;
                    background-size: 100% 100%;
                    background-position: center;
                    background-repeat: no-repeat;
                    position: relative;
                }

                .carousel-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 100%);
                    display: flex;
                    align-items: center;
                }

                .carousel-content {
                    animation: fadeInUpCarousel 0.8s ease-out;
                }

                .carousel-pre-title {
                    font-size: 13px;
                    letter-spacing: 3px;
                    font-weight: 600;
                    color: rgba(255,255,255,0.9);
                    margin-bottom: 10px;
                    text-transform: uppercase;
                    font-family: 'Poppins', sans-serif;
                }

                .carousel-title {
                    font-size: 42px;
                    font-weight: 800;
                    color: white;
                    margin-bottom: 6px;
                    line-height: 1.2;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                    font-family: 'Poppins', sans-serif;
                }

                .carousel-subtitle {
                    font-size: 36px;
                    font-weight: 800;
                    color: white;
                    margin-bottom: 16px;
                    line-height: 1.2;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                    font-family: 'Poppins', sans-serif;
                }

                .carousel-quote {
                    font-size: 18px;
                    font-weight: 500;
                    font-style: italic;
                    color: rgba(255,255,255,0.95);
                    margin-bottom: 0;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
                    font-family: 'Poppins', sans-serif;
                }

                @keyframes fadeInUpCarousel {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .carousel-dots {
                    position: absolute;
                    bottom: 12px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 8px;
                    z-index: 10;
                }

                .carousel-dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.5);
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    padding: 0;
                }

                .carousel-dot.active {
                    width: 20px;
                    border-radius: 10px;
                    background: white;
                }

                .carousel-dot:hover {
                    background: white;
                }

                /* ==================== WELCOME SECTION ==================== */
                .welcome-title {
                    font-size: 24px;
                    font-weight: 700;
                    color: #212529;
                    line-height: 1.3;
                    font-family: 'Poppins', sans-serif;
                }

                .welcome-paragraph {
                    font-size: 16px;
                    line-height: 1.6;
                    margin-bottom: 1rem;
                    color: #4a5568;
                    font-family: 'Poppins', sans-serif;
                }

                .head-unit-label {
                    font-size: 16px;
                    font-weight: 500;
                    color: #6c757d;
                    margin-bottom: 4px;
                    font-family: 'Poppins', sans-serif;
                }

                .head-unit-name {
                    font-size: 18px;
                    font-weight: 700;
                    color: #212529;
                    font-family: 'Poppins', sans-serif;
                }

                /* ==================== SERVICES SECTION ==================== */
                .section-title {
                    font-size: 32px;
                    font-weight: 700;
                    font-family: 'Poppins', sans-serif;
                }

                .section-subtitle-text {
                    font-size: 16px;
                    font-weight: 400;
                    color: #6c757d;
                    font-family: 'Poppins', sans-serif;
                }

                .service-card-title {
                    font-size: 18px;
                    font-weight: 700;
                    font-family: 'Poppins', sans-serif;
                }

                .service-card-text {
                    font-size: 13px;
                    line-height: 1.5;
                    color: #6c757d;
                    font-family: 'Poppins', sans-serif;
                }

                .service-link {
                    font-size: 13px;
                    font-weight: 500;
                    font-family: 'Poppins', sans-serif;
                }

                /* ==================== TESTIMONIALS SECTION ==================== */
                .testimonials-section {
                    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
                }

                .testimonial-card {
                    transition: all 0.25s ease;
                    text-align: center;
                    border-radius: 20px !important;
                    overflow: hidden;
                }

                .testimonial-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.08) !important;
                }

                .testimonial-photo-wrapper {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 16px;
                }

                .testimonial-photo-border {
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #0d6efd, #6f42c1, #0d6efd);
                    background-size: 200% 200%;
                    padding: 3px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: borderGradient 3s ease infinite;
                }

                @keyframes borderGradient {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                .testimonial-photo-placeholder {
                    width: 94px;
                    height: 94px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #e9ecef, #dee2e6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }

                .testimonial-photo {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 50%;
                }

                .testimonial-name-wrapper {
                    display: flex;
                    justify-content: center;
                    align-items: baseline;
                    flex-wrap: wrap;
                    margin-bottom: 12px;
                }

                .testimonial-name {
                    font-size: 16px;
                    font-weight: 700;
                    font-family: 'Poppins', sans-serif;
                    color: #212529;
                }

                .testimonial-role {
                    font-size: 14px;
                    font-weight: 500;
                    font-family: 'Poppins', sans-serif;
                    color: #6c757d;
                }

                .testimonial-content {
                    font-size: 14px;
                    line-height: 1.7;
                    font-family: 'Poppins', sans-serif;
                    text-align: justify;
                    color: #4a5568;
                }

                /* ==================== OTHER ==================== */
                .instagram-link {
                    transition: all 0.2s ease;
                    font-family: 'Poppins', sans-serif;
                }

                .instagram-link:hover {
                    text-decoration: underline !important;
                    opacity: 0.8;
                }

                .video-wrapper {
                    overflow: hidden;
                    transition: all 0.3s ease;
                }

                .video-wrapper iframe {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .hover-card {
                    transition: all 0.25s ease;
                }

                .hover-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.08) !important;
                }

                .service-icon {
                    transition: all 0.25s ease;
                }

                .hover-card:hover .service-icon {
                    transform: scale(1.05);
                }

                /* ==================== RESPONSIVE ==================== */
                @media (max-width: 992px) {
                    .carousel-slide { height: 280px; }
                    .carousel-title { font-size: 32px; }
                    .carousel-subtitle { font-size: 28px; }
                    .carousel-quote { font-size: 16px; }
                }

                @media (max-width: 768px) {
                    .carousel-slide { height: 250px; }
                    .carousel-title { font-size: 24px; }
                    .carousel-subtitle { font-size: 20px; }
                    .carousel-quote { font-size: 14px; }
                    .carousel-pre-title { font-size: 10px; letter-spacing: 2px; }
                    .welcome-title { font-size: 20px; }
                    .welcome-paragraph { font-size: 14px; }
                    .head-unit-name { font-size: 16px; }
                    .section-title { font-size: 28px; }
                    .carousel-wrapper { margin-top: 20px; }
                    .welcome-content { margin-bottom: 20px; }
                    .testimonial-photo-border { width: 80px; height: 80px; }
                    .testimonial-photo-placeholder { width: 74px; height: 74px; }
                    .testimonial-photo-placeholder svg { width: 36px; height: 36px; }
                    .testimonial-name { font-size: 14px; }
                    .testimonial-role { font-size: 12px; }
                    
                    /* Percepat animasi di mobile */
                    @keyframes fadeInUp {
                        from {
                            opacity: 0;
                            transform: translateY(20px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                }

                @media (max-width: 576px) {
                    .carousel-slide { height: 200px; }
                    .carousel-title { font-size: 18px; }
                    .carousel-subtitle { font-size: 16px; }
                    .carousel-quote { font-size: 11px; }
                    .carousel-pre-title { font-size: 8px; letter-spacing: 1px; }
                }
            `}</style>
        </div>
    );
};

export default Home;