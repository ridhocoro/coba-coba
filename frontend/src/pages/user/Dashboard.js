import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, ListGroup, Badge, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import {
    FaUserMd, FaCalendarAlt, FaClock, FaHistory,
    FaHeartbeat, FaPills, FaArrowRight,
    FaHourglassHalf, FaUser,
    FaCheckCircle, FaStethoscope, FaFileMedical
} from 'react-icons/fa';

const UserDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ consultations: 0, appointments: 0, ongoing: 0, completed: 0, waiting: 0 });
    const [recentConsultations, setRecentConsultations] = useState([]);
    const [upcomingAppointments, setUpcomingAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchUserData(); }, []);

    const fetchUserData = async () => {
        try {
            const [consRes, apptRes] = await Promise.allSettled([
                api.get(`/api/consultations/my-consultations`),
                api.get(`/api/appointments/my-appointments`)
            ]);

            const consultations = consRes.status === 'fulfilled' ? (consRes.value.data || []) : [];
            const ongoing = consultations.filter(c => c.status === 'ongoing').length;
            const completed = consultations.filter(c => c.status === 'completed').length;
            const waiting = consultations.filter(c => ['pending_payment', 'paid', 'scheduled'].includes(c.status)).length;
            setRecentConsultations(consultations.slice(0, 5));

            const appointments = apptRes.status === 'fulfilled' ? (apptRes.value.data || []) : [];
            const now = new Date();
            const upcoming = appointments
                .filter(a => ['pending', 'confirmed'].includes(a.status) && new Date(a.appointmentDate) >= now)
                .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate))
                .slice(0, 3);
            setUpcomingAppointments(upcoming);

            setStats({ consultations: consultations.length, appointments: appointments.length, ongoing, completed, waiting });
        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const quickActions = [
        { icon: <FaStethoscope />, title: 'Konsultasi Online', color: '#0d6efd', link: '/consultations', desc: 'Chat dengan dokter' },
        { icon: <FaCalendarAlt />, title: 'Buat Janji Temu', color: '#198754', link: '/appointments', desc: 'Booking jadwal ke klinik' },
        { icon: <FaPills />, title: 'Beli Obat', color: '#dc3545', link: '/pharmacy', desc: 'Pesan obat online' },
        { icon: <FaHeartbeat />, title: 'Cek Kesehatan', color: '#0dcaf0', link: '/health-check', desc: 'Hitung BMI & kalori' }
    ];

    const getConsultationBadge = (status) => {
        const map = { 
            ongoing: ['success','Berlangsung'], 
            paid: ['info','Dibayar'], 
            scheduled: ['purple','Terjadwal'], 
            pending_payment: ['warning','Menunggu Bayar'], 
            completed: ['primary','Selesai'], 
            cancelled: ['danger','Dibatalkan'], 
            expired: ['secondary','Kadaluarsa'], 
            rejected_payment: ['danger','Bayar Ditolak'], 
            no_show: ['warning','Tidak Hadir'] 
        };
        const [bg, label] = map[status] || ['secondary', status];
        return <Badge bg={bg} className="rounded-pill px-3 py-1 fw-normal">{label}</Badge>;
    };

    const getAppointmentBadge = (status) => {
        const map = { 
            pending: ['warning','Menunggu Konfirmasi'], 
            confirmed: ['success','Dikonfirmasi'], 
            completed: ['primary','Selesai'], 
            cancelled: ['danger','Dibatalkan'], 
            rejected: ['danger','Ditolak'] 
        };
        const [bg, label] = map[status] || ['secondary', status];
        return <Badge bg={bg} className="rounded-pill px-3 py-1 fw-normal">{label}</Badge>;
    };

    if (loading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-secondary">Memuat dashboard...</p>
        </Container>
    );

    return (
        <div className="dashboard-page">
            {/* Hero Section - Welcome */}
            <section className="welcome-section py-4">
                <Container>
                    <Row className="align-items-center">
                        <Col>
                            <div className="hero-badge mb-3">
                                <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill">
                                    👋 SELAMAT DATANG
                                </span>
                            </div>
                            <h1 className="display-5 fw-bold mb-2">
                                Halo, {user?.name}! 
                            </h1>
                            <p className="text-secondary mb-0" style={{ fontSize: '1.1rem', maxWidth: '600px' }}>
                                Semoga Anda sehat selalu. Kelola kesehatan Anda dengan mudah melalui dashboard ini.
                            </p>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Stats Cards - Minimalis */}
            <section className="stats-section py-3">
                <Container>
                    <Row className="g-3">
                        <Col md={3} xs={6}>
                            <Card className="border-0 shadow-sm stat-card">
                                <Card.Body className="p-3">
                                    <div className="d-flex align-items-center">
                                        <div className="stat-icon bg-primary-subtle rounded-3 p-2 me-3">
                                            <FaUserMd size={20} className="text-primary" />
                                        </div>
                                        <div>
                                            <div className="text-secondary small mb-1">Total Konsultasi</div>
                                            <h3 className="fw-bold mb-0">{stats.consultations}</h3>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={3} xs={6}>
                            <Card className="border-0 shadow-sm stat-card">
                                <Card.Body className="p-3">
                                    <div className="d-flex align-items-center">
                                        <div className="stat-icon bg-success-subtle rounded-3 p-2 me-3">
                                            <FaClock size={20} className="text-success" />
                                        </div>
                                        <div>
                                            <div className="text-secondary small mb-1">Berlangsung</div>
                                            <h3 className="fw-bold mb-0">{stats.ongoing}</h3>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={3} xs={6}>
                            <Card className="border-0 shadow-sm stat-card">
                                <Card.Body className="p-3">
                                    <div className="d-flex align-items-center">
                                        <div className="stat-icon bg-warning-subtle rounded-3 p-2 me-3">
                                            <FaHourglassHalf size={20} className="text-warning" />
                                        </div>
                                        <div>
                                            <div className="text-secondary small mb-1">Menunggu</div>
                                            <h3 className="fw-bold mb-0">{stats.waiting}</h3>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={3} xs={6}>
                            <Card className="border-0 shadow-sm stat-card">
                                <Card.Body className="p-3">
                                    <div className="d-flex align-items-center">
                                        <div className="stat-icon bg-info-subtle rounded-3 p-2 me-3">
                                            <FaCalendarAlt size={20} className="text-info" />
                                        </div>
                                        <div>
                                            <div className="text-secondary small mb-1">Janji Temu</div>
                                            <h3 className="fw-bold mb-0">{stats.appointments}</h3>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Quick Actions - Minimalis */}
            <section className="quick-actions-section py-4">
                <Container>
                    <Row className="mb-4">
                        <Col>
                            <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill mb-2">
                                ⚡ LAYANAN CEPAT
                            </span>
                            <h5 className="fw-bold mb-0">Akses Layanan</h5>
                        </Col>
                    </Row>

                    <Row className="g-3">
                        {quickActions.map((action, idx) => (
                            <Col md={3} xs={6} key={idx}>
                                <Card as={Link} to={action.link} className="text-decoration-none border-0 shadow-sm hover-card quick-action-card">
                                    <Card.Body className="p-3 text-center">
                                        <div 
                                            className="action-icon rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center"
                                            style={{ 
                                                backgroundColor: `${action.color}15`,
                                                color: action.color,
                                                width: '48px',
                                                height: '48px',
                                                fontSize: '1.5rem'
                                            }}
                                        >
                                            {action.icon}
                                        </div>
                                        <h6 className="fw-bold mb-1" style={{ color: '#111827' }}>{action.title}</h6>
                                        <small className="text-secondary">{action.desc}</small>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>

            {/* Recent Activity */}
            <section className="activity-section py-4">
                <Container>
                    <Row className="g-4">
                        {/* Recent Consultations */}
                        <Col md={7}>
                            <Card className="border-0 shadow-sm hover-card">
                                <Card.Header className="bg-transparent border-0 pt-4 pb-0">
                                    <div className="d-flex justify-content-between align-items-center px-2">
                                        <div>
                                            <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill mb-2">
                                                📋 TERBARU
                                            </span>
                                            <h5 className="fw-bold mb-0">Konsultasi Terbaru</h5>
                                        </div>
                                        <Button 
                                            as={Link} 
                                            to="/consultations" 
                                            variant="link" 
                                            className="text-decoration-none p-0"
                                            style={{ color: '#0d6efd' }}
                                        >
                                            Lihat Semua <FaArrowRight size={11} className="ms-1" />
                                        </Button>
                                    </div>
                                </Card.Header>
                                <Card.Body className="pt-3">
                                    {recentConsultations.length === 0 ? (
                                        <div className="text-center py-5">
                                            <div className="empty-state-icon bg-light rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center" 
                                                style={{ width: '60px', height: '60px' }}>
                                                <FaFileMedical size={24} className="text-secondary" />
                                            </div>
                                            <p className="text-secondary mb-3">Belum ada konsultasi</p>
                                            <Button 
                                                as={Link} 
                                                to="/consultations" 
                                                variant="primary" 
                                                size="sm"
                                                className="rounded-pill px-4"
                                            >
                                                Mulai Konsultasi
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="consultation-list">
                                            {recentConsultations.map((c, index) => (
                                                <div key={c._id} className={`px-2 py-3 ${index !== recentConsultations.length - 1 ? 'border-bottom' : ''}`}>
                                                    <div className="d-flex justify-content-between align-items-start">
                                                        <div className="d-flex">
                                                            <div className="doctor-avatar bg-light rounded-circle d-flex align-items-center justify-content-center me-3"
                                                                style={{ width: '40px', height: '40px' }}>
                                                                <FaUserMd className="text-secondary" />
                                                            </div>
                                                            <div>
                                                                <h6 className="fw-semibold mb-1">dr. {c.doctorId?.name}</h6>
                                                                <div className="d-flex flex-wrap gap-2 mb-1">
                                                                    <small className="text-secondary">
                                                                        {c.doctorId?.specialization}
                                                                    </small>
                                                                    <span className="text-secondary">•</span>
                                                                    <small className="text-secondary">
                                                                        {new Date(c.createdAt).toLocaleDateString('id-ID')}
                                                                    </small>
                                                                </div>
                                                                {c.symptoms && (
                                                                    <small className="text-secondary d-block" style={{ maxWidth: '300px' }}>
                                                                        {c.symptoms.length > 50 ? c.symptoms.slice(0, 50) + '...' : c.symptoms}
                                                                    </small>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            {getConsultationBadge(c.status)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>

                        {/* Upcoming Appointments */}
                        <Col md={5}>
                            <Card className="border-0 shadow-sm hover-card">
                                <Card.Header className="bg-transparent border-0 pt-4 pb-0">
                                    <div className="d-flex justify-content-between align-items-center px-2">
                                        <div>
                                            <span className="badge bg-success-subtle text-success px-3 py-2 rounded-pill mb-2">
                                                📅 MENDATANG
                                            </span>
                                            <h5 className="fw-bold mb-0">Janji Temu</h5>
                                        </div>
                                        <Button 
                                            as={Link} 
                                            to="/appointments" 
                                            variant="link" 
                                            className="text-decoration-none p-0"
                                            style={{ color: '#198754' }}
                                        >
                                            Lihat Semua <FaArrowRight size={11} className="ms-1" />
                                        </Button>
                                    </div>
                                </Card.Header>
                                <Card.Body className="pt-3">
                                    {upcomingAppointments.length === 0 ? (
                                        <div className="text-center py-5">
                                            <div className="empty-state-icon bg-light rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center" 
                                                style={{ width: '60px', height: '60px' }}>
                                                <FaCalendarAlt size={24} className="text-secondary" />
                                            </div>
                                            <p className="text-secondary mb-3">Tidak ada janji temu</p>
                                            <Button 
                                                as={Link} 
                                                to="/appointments" 
                                                variant="success" 
                                                size="sm"
                                                className="rounded-pill px-4"
                                            >
                                                Buat Janji
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="appointment-list">
                                            {upcomingAppointments.map((a, index) => (
                                                <div key={a._id} className={`px-2 py-3 ${index !== upcomingAppointments.length - 1 ? 'border-bottom' : ''}`}>
                                                    <div className="d-flex justify-content-between align-items-start">
                                                        <div className="d-flex">
                                                            <div className="appointment-icon bg-light rounded-circle d-flex align-items-center justify-content-center me-3"
                                                                style={{ width: '40px', height: '40px' }}>
                                                                <FaCalendarAlt className="text-success" />
                                                            </div>
                                                            <div>
                                                                <h6 className="fw-semibold mb-1">dr. {a.doctorId?.name}</h6>
                                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                                    <small className="text-secondary">
                                                                        {new Date(a.appointmentDate).toLocaleDateString('id-ID', { 
                                                                            weekday: 'short', 
                                                                            day: 'numeric', 
                                                                            month: 'short' 
                                                                        })}
                                                                    </small>
                                                                </div>
                                                                <div className="d-flex align-items-center gap-3">
                                                                    <small className="text-secondary">
                                                                        <FaClock size={10} className="me-1" />
                                                                        {a.appointmentTime}
                                                                    </small>
                                                                    <small className="text-secondary">
                                                                        Antrian #{a.queueNumber}
                                                                    </small>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            {getAppointmentBadge(a.status)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </section>

            <style jsx="true">{`
                .dashboard-page {
                    background-color: #ffffff;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    min-height: 100vh;
                }

                .hero-badge .badge {
                    font-weight: 500;
                    letter-spacing: 0.3px;
                    background-color: #e7f1ff;
                }

                .stat-card {
                    transition: all 0.3s ease;
                    border-radius: 12px !important;
                }

                .stat-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.05) !important;
                }

                .stat-icon {
                    transition: all 0.3s ease;
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .stat-card:hover .stat-icon {
                    transform: scale(1.1);
                }

                .quick-action-card {
                    transition: all 0.3s ease;
                    border-radius: 16px !important;
                }

                .quick-action-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.05) !important;
                }

                .action-icon {
                    transition: all 0.3s ease;
                }

                .quick-action-card:hover .action-icon {
                    transform: scale(1.1) rotate(5deg);
                }

                .hover-card {
                    transition: all 0.3s ease;
                    border-radius: 16px !important;
                }

                .hover-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.05) !important;
                }

                .empty-state-icon {
                    transition: all 0.3s ease;
                }

                .border-bottom {
                    border-bottom: 1px solid #f0f0f0 !important;
                }

                .doctor-avatar, .appointment-icon {
                    transition: all 0.3s ease;
                }

                .border-bottom:hover .doctor-avatar,
                .border-bottom:hover .appointment-icon {
                    transform: scale(1.05);
                }

                .badge {
                    font-weight: 500;
                    letter-spacing: 0.3px;
                }

                .bg-primary-subtle {
                    background-color: #e7f1ff !important;
                }

                .bg-success-subtle {
                    background-color: #e8f5e9 !important;
                }

                .bg-warning-subtle {
                    background-color: #fff3e0 !important;
                }

                .bg-info-subtle {
                    background-color: #e3f2fd !important;
                }

                .text-secondary {
                    color: #6b7280 !important;
                }

                .btn-link {
                    font-size: 0.9rem;
                }

                .btn-link:hover {
                    text-decoration: underline !important;
                }
            `}</style>

            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </div>
    );
};

export default UserDashboard;