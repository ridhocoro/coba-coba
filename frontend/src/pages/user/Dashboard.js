import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, ListGroup, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { 
    FaUserMd, FaCalendarAlt, FaClock, FaHistory,
    FaHeartbeat, FaFileMedical, FaPills, FaComment,
    FaArrowRight, FaCheckCircle, FaHourglassHalf
} from 'react-icons/fa';

const UserDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        consultations: 0,
        appointments: 0,
        ongoing: 0,
        completed: 0
    });
    const [recentConsultations, setRecentConsultations] = useState([]);
    const [upcomingAppointments, setUpcomingAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        try {
            const token = localStorage.getItem('token');
            
            // Fetch consultations
            const consResponse = await axios.get(
                'http://localhost:5000/api/consultations/my-consultations',
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            const consultations = consResponse.data || [];
            
            // Hitung statistik
            const ongoing = consultations.filter(c => c.status === 'ongoing').length;
            const completed = consultations.filter(c => c.status === 'completed').length;
            const waiting = consultations.filter(c => ['pending', 'waiting_payment', 'paid'].includes(c.status)).length;
            
            setStats({
                consultations: consultations.length,
                appointments: 0, // nanti dari appointments
                ongoing,
                completed,
                waiting
            });
            
            // 5 konsultasi terbaru
            setRecentConsultations(consultations.slice(0, 5));
            
            // TODO: fetch appointments
            
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

    const getStatusBadge = (status) => {
        const variants = {
            ongoing: 'success',
            paid: 'info',
            waiting_payment: 'warning',
            pending: 'secondary',
            completed: 'primary'
        };
        const labels = {
            ongoing: 'Sedang Berlangsung',
            paid: 'Menunggu Dokter',
            waiting_payment: 'Menunggu Bayar',
            pending: 'Diproses',
            completed: 'Selesai'
        };
        return <Badge bg={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
    };

    return (
        <Container className="py-4">
            {/* Welcome Section */}
            <Row className="mb-4">
                <Col>
                    <Card className="border-0 bg-gradient-primary text-white">
                        <Card.Body className="p-4">
                            <Row className="align-items-center">
                                <Col md={8}>
                                    <h2 className="mb-2">Selamat Datang, {user?.name}!</h2>
                                    <p className="mb-0 opacity-75">
                                        Semoga Anda sehat selalu. Ada yang bisa kami bantu hari ini?
                                    </p>
                                </Col>
                                <Col md={4} className="text-end">
                                    <FaHeartbeat size={60} className="opacity-50" />
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Stats Cards */}
            <Row className="mb-4 g-4">
                <Col md={3}>
                    <Card className="border-0 shadow-sm bg-primary text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Total Konsultasi</h6>
                                    <h2 className="mb-0">{stats.consultations}</h2>
                                </div>
                                <FaUserMd size={40} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="border-0 shadow-sm bg-success text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Sedang Berlangsung</h6>
                                    <h2 className="mb-0">{stats.ongoing}</h2>
                                </div>
                                <FaClock size={40} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="border-0 shadow-sm bg-info text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Menunggu</h6>
                                    <h2 className="mb-0">{stats.waiting}</h2>
                                </div>
                                <FaHourglassHalf size={40} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="border-0 shadow-sm bg-warning text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Selesai</h6>
                                    <h2 className="mb-0">{stats.completed}</h2>
                                </div>
                                <FaCheckCircle size={40} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Quick Actions */}
            <Row className="mb-4">
                <Col>
                    <h5 className="mb-3">Layanan Cepat</h5>
                </Col>
            </Row>
            <Row className="mb-5 g-4">
                {quickActions.map((action, idx) => (
                    <Col md={3} key={idx}>
                        <Card 
                            as={Link} 
                            to={action.link}
                            className="text-decoration-none h-100 border-0 shadow-sm hover-card"
                            style={{ cursor: 'pointer' }}
                        >
                            <Card.Body className="text-center p-4">
                                <div className={`text-${action.color} mb-3`} style={{ fontSize: '2.5rem' }}>
                                    {action.icon}
                                </div>
                                <h6 className="fw-bold mb-2">{action.title}</h6>
                                <p className="small text-muted mb-0">{action.desc}</p>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Row>
                {/* Recent Consultations */}
                <Col md={7} className="mb-4">
                    <Card className="border-0 shadow-sm h-100">
                        <Card.Header className="bg-white border-0 pt-4">
                            <div className="d-flex justify-content-between align-items-center">
                                <h5 className="mb-0">
                                    <FaHistory className="me-2 text-primary" />
                                    Konsultasi Terbaru
                                </h5>
                                <Button 
                                    as={Link} 
                                    to="/consultations" 
                                    variant="link" 
                                    size="sm"
                                    className="text-primary"
                                >
                                    Lihat Semua <FaArrowRight className="ms-1" size={12} />
                                </Button>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {recentConsultations.length === 0 ? (
                                <p className="text-muted text-center py-4">Belum ada konsultasi</p>
                            ) : (
                                <ListGroup variant="flush">
                                    {recentConsultations.map(cons => (
                                        <ListGroup.Item 
                                            key={cons._id} 
                                            className="px-0 border-0 border-bottom py-3"
                                        >
                                            <Row>
                                                <Col md={8}>
                                                    <div className="d-flex align-items-center">
                                                        <FaUserMd className="text-primary me-2" />
                                                        <div>
                                                            <strong>dr. {cons.doctorId?.name}</strong>
                                                            <p className="small text-muted mb-0">
                                                                {new Date(cons.createdAt).toLocaleDateString('id-ID')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <p className="small text-muted mt-2 mb-0">
                                                        <strong>Keluhan:</strong> {cons.symptoms}
                                                    </p>
                                                </Col>
                                                <Col md={4} className="text-end">
                                                    {getStatusBadge(cons.status)}
                                                </Col>
                                            </Row>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            )}
                        </Card.Body>
                    </Card>
                </Col>

                {/* Upcoming Appointments */}
                <Col md={5} className="mb-4">
                    <Card className="border-0 shadow-sm h-100">
                        <Card.Header className="bg-white border-0 pt-4">
                            <div className="d-flex justify-content-between align-items-center">
                                <h5 className="mb-0">
                                    <FaCalendarAlt className="me-2 text-success" />
                                    Janji Temu Mendatang
                                </h5>
                                <Button 
                                    as={Link} 
                                    to="/appointments" 
                                    variant="link" 
                                    size="sm"
                                    className="text-success"
                                >
                                    Lihat Semua <FaArrowRight className="ms-1" size={12} />
                                </Button>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <p className="text-muted text-center py-4">
                                <FaCalendarAlt size={40} className="mb-3 opacity-50" />
                                <br />
                                Belum ada janji temu
                            </p>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <style jsx="true">{`
                .bg-gradient-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .hover-card {
                    transition: all 0.3s ease;
                }
                .hover-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important;
                }
            `}</style>
        </Container>
    );
};

export default UserDashboard;