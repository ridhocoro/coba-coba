import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, ListGroup, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { 
    FaUserMd, FaCalendarAlt, FaClock, FaUsers,
    FaFileMedical, FaComment, FaArrowRight, FaCheckCircle,
    FaHourglassHalf, FaStethoscope, FaClipboardList
} from 'react-icons/fa';

const DoctorDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        todayAppointments: 0,
        pendingSickLetters: 0,
        totalPatients: 0,
        ongoingConsultations: 0
    });
    const [todaySchedule, setTodaySchedule] = useState([]);
    const [pendingSickLetters, setPendingSickLetters] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDoctorData();
    }, []);

    const fetchDoctorData = async () => {
        try {
            const token = localStorage.getItem('token');
            
            // Fetch pending sick letters
            const sickRes = await axios.get(
                'http://localhost:5000/api/consultations/doctor/pending',
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setPendingSickLetters(sickRes.data.letters || []);
            
            // TODO: Fetch appointments, patients, etc
            
            setStats({
                todayAppointments: 3,
                pendingSickLetters: sickRes.data.letters?.length || 0,
                totalPatients: 45,
                ongoingConsultations: 2
            });
            
            // Dummy today schedule
            setTodaySchedule([
                { time: '09:00', patient: 'Budi Santoso', type: 'Konsultasi' },
                { time: '10:30', patient: 'Siti Aminah', type: 'Janji Temu' },
                { time: '13:00', patient: 'Ahmad Rizki', type: 'Konsultasi' }
            ]);

        } catch (error) {
            console.error('Error fetching doctor data:', error);
        } finally {
            setLoading(false);
        }
    };

    const quickActions = [
        { icon: <FaCalendarAlt />, title: 'Jadwal Praktek', color: 'primary', link: '/doctor/appointments' },
        { icon: <FaFileMedical />, title: 'Surat Sakit', color: 'warning', link: '/doctor/sick-letters', badge: stats.pendingSickLetters },
        { icon: <FaUsers />, title: 'Pasien Saya', color: 'success', link: '/doctor/patients' },
        { icon: <FaClipboardList />, title: 'Laporan', color: 'info', link: '/doctor/reports' }
    ];

    return (
        <Container className="py-4">
            {/* Welcome Section */}
            <Row className="mb-4">
                <Col>
                    <Card className="border-0 bg-gradient-primary text-white">
                        <Card.Body className="p-4">
                            <Row className="align-items-center">
                                <Col md={8}>
                                    <h2 className="mb-2">Selamat Datang, dr. {user?.name}!</h2>
                                    <p className="mb-0 opacity-75">
                                        Semoga hari Anda menyenangkan. Berikut ringkasan aktivitas hari ini.
                                    </p>
                                </Col>
                                <Col md={4} className="text-end">
                                    <FaStethoscope size={60} className="opacity-50" />
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
                                    <h6 className="text-white-50 mb-2">Janji Temu Hari Ini</h6>
                                    <h2 className="mb-0">{stats.todayAppointments}</h2>
                                </div>
                                <FaCalendarAlt size={40} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="border-0 shadow-sm bg-warning text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Surat Sakit Pending</h6>
                                    <h2 className="mb-0">{stats.pendingSickLetters}</h2>
                                </div>
                                <FaFileMedical size={40} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="border-0 shadow-sm bg-success text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Total Pasien</h6>
                                    <h2 className="mb-0">{stats.totalPatients}</h2>
                                </div>
                                <FaUsers size={40} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="border-0 shadow-sm bg-info text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Konsultasi Berlangsung</h6>
                                    <h2 className="mb-0">{stats.ongoingConsultations}</h2>
                                </div>
                                <FaComment size={40} className="opacity-50" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Quick Actions */}
            <Row className="mb-5 g-4">
                {quickActions.map((action, idx) => (
                    <Col md={3} key={idx}>
                        <Card 
                            as={Link} 
                            to={action.link}
                            className="text-decoration-none h-100 border-0 shadow-sm hover-card position-relative"
                            style={{ cursor: 'pointer' }}
                        >
                            {action.badge > 0 && (
                                <Badge 
                                    bg="danger" 
                                    className="position-absolute top-0 end-0 m-3"
                                    pill
                                >
                                    {action.badge}
                                </Badge>
                            )}
                            <Card.Body className="text-center p-4">
                                <div className={`text-${action.color} mb-3`} style={{ fontSize: '2.5rem' }}>
                                    {action.icon}
                                </div>
                                <h6 className="fw-bold mb-0">{action.title}</h6>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Row>
                {/* Today's Schedule */}
                <Col md={7} className="mb-4">
                    <Card className="border-0 shadow-sm h-100">
                        <Card.Header className="bg-white border-0 pt-4">
                            <h5 className="mb-0">
                                <FaClock className="me-2 text-primary" />
                                Jadwal Praktek Hari Ini
                            </h5>
                        </Card.Header>
                        <Card.Body>
                            {todaySchedule.length === 0 ? (
                                <p className="text-muted text-center py-4">Tidak ada jadwal hari ini</p>
                            ) : (
                                <ListGroup variant="flush">
                                    {todaySchedule.map((item, idx) => (
                                        <ListGroup.Item key={idx} className="px-0 border-0 border-bottom py-3">
                                            <Row className="align-items-center">
                                                <Col md={2}>
                                                    <Badge bg="primary">{item.time}</Badge>
                                                </Col>
                                                <Col md={6}>
                                                    <strong>{item.patient}</strong>
                                                    <p className="small text-muted mb-0">{item.type}</p>
                                                </Col>
                                                <Col md={4} className="text-end">
                                                    <Button size="sm" variant="outline-primary">
                                                        Mulai
                                                    </Button>
                                                </Col>
                                            </Row>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            )}
                        </Card.Body>
                    </Card>
                </Col>

                {/* Pending Sick Letters */}
                <Col md={5} className="mb-4">
                    <Card className="border-0 shadow-sm h-100">
                        <Card.Header className="bg-white border-0 pt-4">
                            <div className="d-flex justify-content-between align-items-center">
                                <h5 className="mb-0">
                                    <FaFileMedical className="me-2 text-warning" />
                                    Surat Sakit Menunggu
                                </h5>
                                <Button 
                                    as={Link} 
                                    to="/doctor/sick-letters" 
                                    variant="link" 
                                    size="sm"
                                    className="text-warning"
                                >
                                    Lihat Semua <FaArrowRight className="ms-1" size={12} />
                                </Button>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {pendingSickLetters.length === 0 ? (
                                <p className="text-muted text-center py-4">
                                    <FaFileMedical size={40} className="mb-3 opacity-50" />
                                    <br />
                                    Tidak ada surat sakit menunggu
                                </p>
                            ) : (
                                <ListGroup variant="flush">
                                    {pendingSickLetters.slice(0, 3).map(letter => (
                                        <ListGroup.Item key={letter._id} className="px-0 border-0 border-bottom py-3">
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <strong>{letter.userId?.name}</strong>
                                                    <p className="small text-muted mb-0">
                                                        {letter.diagnosis}
                                                    </p>
                                                </div>
                                                <Badge bg="warning">Menunggu</Badge>
                                            </div>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default DoctorDashboard;