import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
    FaUsers, FaUserMd, FaMoneyBillWave, FaCalendarCheck,
    FaFileMedical, FaPills, FaArrowRight, FaShieldAlt
} from 'react-icons/fa';

const AdminDashboard = () => {
    const { user } = useAuth();

    const menuItems = [
        { icon: <FaUsers />, title: 'Verifikasi Pembayaran', desc: 'Lihat pembayaran pending', color: 'warning', link: '/admin/verify-payments', count: 3 },
        { icon: <FaUserMd />, title: 'Kelola Dokter', desc: 'Tambah/edit data dokter', color: 'primary', link: '/admin/doctors' },
        { icon: <FaCalendarCheck />, title: 'Janji Temu', desc: 'Lihat semua jadwal', color: 'success', link: '/admin/appointments' },
        { icon: <FaFileMedical />, title: 'Surat Sakit', desc: 'Kelola surat sakit', color: 'info', link: '/admin/sick-letters' },
        { icon: <FaPills />, title: 'Farmasi', desc: 'Manajemen stok obat', color: 'danger', link: '/admin/pharmacy' },
        { icon: <FaUsers />, title: 'Pengguna', desc: 'Data semua user', color: 'secondary', link: '/admin/users' }
    ];

    return (
        <Container className="py-4">
            <Row className="mb-4">
                <Col>
                    <Card className="border-0 bg-gradient-primary text-white">
                        <Card.Body className="p-4">
                            <Row className="align-items-center">
                                <Col md={8}>
                                    <h2 className="mb-2">Panel Admin</h2>
                                    <p className="mb-0 opacity-75">
                                        Selamat datang, {user?.name}. Kelola semua aspek aplikasi dari sini.
                                    </p>
                                </Col>
                                <Col md={4} className="text-end">
                                    <FaShieldAlt size={60} className="opacity-50" />
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Row className="g-4">
                {menuItems.map((item, idx) => (
                    <Col md={4} key={idx}>
                        <Card 
                            as={Link}
                            to={item.link}
                            className="text-decoration-none h-100 border-0 shadow-sm hover-card position-relative"
                        >
                            {item.count && (
                                <span className="position-absolute top-0 end-0 m-3 badge bg-danger rounded-pill">
                                    {item.count}
                                </span>
                            )}
                            <Card.Body className="p-4">
                                <div className={`text-${item.color} mb-3`} style={{ fontSize: '2.5rem' }}>
                                    {item.icon}
                                </div>
                                <h5 className="fw-bold mb-2">{item.title}</h5>
                                <p className="text-muted small mb-3">{item.desc}</p>
                                <div className={`text-${item.color}`}>
                                    Kelola <FaArrowRight size={12} className="ms-1" />
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>
        </Container>
    );
};

export default AdminDashboard;