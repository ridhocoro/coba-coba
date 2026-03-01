import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, ListGroup, Badge, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import {
    FaUserMd, FaCalendarAlt, FaClock, FaHistory,
    FaHeartbeat, FaPills, FaArrowRight,
    FaCheckCircle, FaHourglassHalf, FaUser
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
        { icon: <FaUserMd />, title: 'Konsultasi Online', color: 'primary', link: '/consultations', desc: 'Chat dengan dokter' },
        { icon: <FaCalendarAlt />, title: 'Buat Janji Temu', color: 'success', link: '/appointments', desc: 'Booking jadwal ke klinik' },
        { icon: <FaPills />, title: 'Beli Obat', color: 'info', link: '/pharmacy', desc: 'Pesan obat online' },
        { icon: <FaHeartbeat />, title: 'Cek Kesehatan', color: 'warning', link: '/health-check', desc: 'Hitung BMI & kalori' }
    ];

    const getConsultationBadge = (status) => {
        const map = { ongoing: ['success','Berlangsung'], paid: ['info','Dibayar'], scheduled: ['purple','Terjadwal'], pending_payment: ['warning','Menunggu Bayar'], completed: ['primary','Selesai'], cancelled: ['danger','Dibatalkan'], expired: ['secondary','Kadaluarsa'], rejected_payment: ['danger','Bayar Ditolak'], no_show: ['warning','Tidak Hadir'] };
        const [bg, label] = map[status] || ['secondary', status];
        return <Badge bg={bg}>{label}</Badge>;
    };

    const getAppointmentBadge = (status) => {
        const map = { pending: ['warning','Menunggu Konfirmasi'], confirmed: ['success','Dikonfirmasi'], completed: ['primary','Selesai'], cancelled: ['danger','Dibatalkan'], rejected: ['danger','Ditolak'] };
        const [bg, label] = map[status] || ['secondary', status];
        return <Badge bg={bg}>{label}</Badge>;
    };

    if (loading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Memuat dashboard...</p>
        </Container>
    );

    return (
        <Container className="py-4">
            <Row className="mb-4">
                <Col>
                    <Card className="border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                        <Card.Body className="p-4 text-white">
                            <Row className="align-items-center">
                                <Col md={8}>
                                    <h2 className="mb-1 fw-bold">Halo, {user?.name}! 👋</h2>
                                    <p className="mb-3 opacity-75">Semoga Anda sehat selalu. Ada yang bisa kami bantu?</p>
                                    <Button as={Link} to="/profile" variant="light" size="sm" className="rounded-pill px-3">
                                        <FaUser className="me-1" /> Lihat Profil
                                    </Button>
                                </Col>
                                <Col md={4} className="text-end d-none d-md-block">
                                    <FaHeartbeat size={70} className="opacity-25" />
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Row className="mb-4 g-3">
                {[
                    { label: 'Total Konsultasi', value: stats.consultations, icon: FaUserMd, bg: 'primary' },
                    { label: 'Berlangsung', value: stats.ongoing, icon: FaClock, bg: 'success' },
                    { label: 'Menunggu', value: stats.waiting, icon: FaHourglassHalf, bg: 'warning' },
                    { label: 'Janji Temu', value: stats.appointments, icon: FaCalendarAlt, bg: 'info' }
                ].map((s, i) => (
                    <Col md={3} xs={6} key={i}>
                        <Card className={`border-0 shadow-sm bg-${s.bg} text-white`}>
                            <Card.Body className="py-3">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="small opacity-75 mb-1">{s.label}</div>
                                        <h2 className="mb-0 fw-bold">{s.value}</h2>
                                    </div>
                                    <s.icon size={32} className="opacity-25" />
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            <h5 className="mb-3 fw-bold">Layanan Cepat</h5>
            <Row className="mb-4 g-3">
                {quickActions.map((action, idx) => (
                    <Col md={3} xs={6} key={idx}>
                        <Card as={Link} to={action.link} className="text-decoration-none h-100 border-0 shadow-sm text-center hover-card">
                            <Card.Body className="p-3">
                                <div className={`text-${action.color} mb-2`} style={{ fontSize: '2rem' }}>{action.icon}</div>
                                <div className="fw-bold small">{action.title}</div>
                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>{action.desc}</div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Row className="g-4">
                <Col md={7}>
                    <Card className="border-0 shadow-sm">
                        <Card.Header className="bg-white border-0 pt-3 pb-0">
                            <div className="d-flex justify-content-between align-items-center">
                                <h6 className="fw-bold mb-0"><FaHistory className="me-2 text-primary" />Konsultasi Terbaru</h6>
                                <Button as={Link} to="/consultations" variant="link" size="sm" className="p-0">Semua <FaArrowRight size={11} /></Button>
                            </div>
                        </Card.Header>
                        <Card.Body className="pt-2">
                            {recentConsultations.length === 0 ? (
                                <div className="text-center py-4 text-muted">
                                    <FaUserMd size={36} className="mb-2 opacity-25" />
                                    <p className="mb-2 small">Belum ada konsultasi</p>
                                    <Button as={Link} to="/consultations" variant="primary" size="sm">Mulai Konsultasi</Button>
                                </div>
                            ) : (
                                <ListGroup variant="flush">
                                    {recentConsultations.map(c => (
                                        <ListGroup.Item key={c._id} className="px-0 py-2 border-bottom">
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <div className="fw-semibold small">dr. {c.doctorId?.name}</div>
                                                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                        {c.doctorId?.specialization} · {new Date(c.createdAt).toLocaleDateString('id-ID')}
                                                    </div>
                                                    {c.symptoms && (
                                                        <div className="text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                                                            {c.symptoms.length > 60 ? c.symptoms.slice(0, 60) + '...' : c.symptoms}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="ms-2 flex-shrink-0">{getConsultationBadge(c.status)}</div>
                                            </div>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            )}
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={5}>
                    <Card className="border-0 shadow-sm">
                        <Card.Header className="bg-white border-0 pt-3 pb-0">
                            <div className="d-flex justify-content-between align-items-center">
                                <h6 className="fw-bold mb-0"><FaCalendarAlt className="me-2 text-success" />Janji Temu Mendatang</h6>
                                <Button as={Link} to="/appointments" variant="link" size="sm" className="p-0">Semua <FaArrowRight size={11} /></Button>
                            </div>
                        </Card.Header>
                        <Card.Body className="pt-2">
                            {upcomingAppointments.length === 0 ? (
                                <div className="text-center py-4 text-muted">
                                    <FaCalendarAlt size={36} className="mb-2 opacity-25" />
                                    <p className="mb-2 small">Tidak ada janji temu mendatang</p>
                                    <Button as={Link} to="/appointments" variant="success" size="sm">Buat Janji</Button>
                                </div>
                            ) : (
                                <ListGroup variant="flush">
                                    {upcomingAppointments.map(a => (
                                        <ListGroup.Item key={a._id} className="px-0 py-2 border-bottom">
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <div className="fw-semibold small">dr. {a.doctorId?.name}</div>
                                                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                        {new Date(a.appointmentDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                    </div>
                                                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                        <FaClock size={10} className="me-1" />Pukul {a.appointmentTime} · Antrian #{a.queueNumber}
                                                    </div>
                                                </div>
                                                <div className="ms-2 flex-shrink-0">{getAppointmentBadge(a.status)}</div>
                                            </div>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <style>{`
                .hover-card { transition: all 0.25s ease; }
                .hover-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
            `}</style>
        </Container>
    );
};

export default UserDashboard;