import React from 'react';
import { Navbar, Nav, Container, NavDropdown, Badge } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import { 
    FaUserMd, FaClipboardList, FaPills, FaCalendarAlt, 
    FaHeartbeat, FaSignInAlt, FaUserPlus, FaSignOutAlt,
    FaUser, FaCog, FaShieldAlt, FaStethoscope, FaFileMedical,
    FaHome, FaChartLine, FaHistory, FaCreditCard,
    FaBox, FaUsers, FaMoneyBillWave, FaPrescription
} from 'react-icons/fa';

const Navigation = () => {
    const { user, logout } = useAuth();
    const { unreadCount } = useNotifications();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <Navbar bg="light" expand="lg" className="shadow-sm sticky-top">
            <Container>
                <Navbar.Brand as={Link} to="/" className="fw-bold text-primary">
                    <FaHeartbeat className="me-2" />
                    Klinik Pratama IPB
                </Navbar.Brand>
                
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    {/* Menu Navigasi Utama - Tampil untuk semua yang sudah login */}
                    {user && (
                        <Nav className="me-auto">
                            <Nav.Link as={Link} to="/dashboard">
                                <FaHome className="me-1" /> Dashboard
                            </Nav.Link>
                            <Nav.Link as={Link} to="/health-check">
                                <FaClipboardList className="me-1" /> Cek Kesehatan
                            </Nav.Link>
                            <Nav.Link as={Link} to="/consultations">
                                <FaUserMd className="me-1" /> Konsultasi
                            </Nav.Link>
                            <Nav.Link as={Link} to="/pharmacy">
                                <FaPills className="me-1" /> Farmasi
                            </Nav.Link>
                            <Nav.Link as={Link} to="/appointments">
                                <FaCalendarAlt className="me-1" /> Janji Temu
                            </Nav.Link>
                        </Nav>
                    )}

                    {/* Menu untuk yang BELUM login */}
                    {!user && (
                        <Nav className="me-auto">
                            <Nav.Link as={Link} to="/health-check">
                                <FaClipboardList className="me-1" /> Cek Kesehatan
                            </Nav.Link>
                        </Nav>
                    )}
                    
                    <Nav className="align-items-center">
                        {/* Notification Bell (untuk semua yang login) */}
                        {user && <NotificationDropdown />}

                        {user ? (
                            <>
                                {/* ========== MENU UNTUK USER BIASA ========== */}
                                {user.role === 'user' && (
                                    <NavDropdown 
                                        title={
                                            <span>
                                                <FaUser className="me-1" />
                                                {user.name?.split(' ')[0]}
                                            </span>
                                        }
                                        id="user-dropdown"
                                        align="end"
                                    >
                                        <NavDropdown.Header className="text-muted small">
                                            Menu User
                                        </NavDropdown.Header>
                                        <NavDropdown.Item as={Link} to="/dashboard">
                                            <FaHome className="me-2" /> Dashboard
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/profile">
                                            <FaUser className="me-2" /> Profil Saya
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/consultations">
                                            <FaUserMd className="me-2" /> Konsultasi Saya
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/appointments">
                                            <FaCalendarAlt className="me-2" /> Janji Temu Saya
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/payments">
                                            <FaCreditCard className="me-2" /> Riwayat Pembayaran
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/pharmacy">
                                            <FaBox className="me-2" /> Pesanan Obat
                                        </NavDropdown.Item>
                                        <NavDropdown.Divider />
                                        <NavDropdown.Item onClick={handleLogout}>
                                            <FaSignOutAlt className="me-2" /> Logout
                                        </NavDropdown.Item>
                                    </NavDropdown>
                                )}

                                {/* ========== MENU UNTUK DOKTER ========== */}
                                {user.role === 'doctor' && (
                                    <NavDropdown 
                                        title={
                                            <span className="text-success">
                                                <FaStethoscope className="me-1" />
                                                Dr. {user.name?.split(' ')[0]}
                                            </span>
                                        }
                                        id="doctor-dropdown"
                                        align="end"
                                    >
                                        <NavDropdown.Header className="text-muted small">
                                            Panel Dokter
                                        </NavDropdown.Header>
                                        <NavDropdown.Item as={Link} to="/doctor">
                                            <FaChartLine className="me-2" /> Dashboard Dokter
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/doctor/appointments">
                                            <FaCalendarAlt className="me-2" /> Jadwal Praktek
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/doctor/sick-letters">
                                            <FaFileMedical className="me-2" /> 
                                            Surat Sakit
                                            <Badge bg="warning" className="ms-2">{unreadCount}</Badge>
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/doctor/patients">
                                            <FaUsers className="me-2" /> Pasien Saya
                                        </NavDropdown.Item>
                                        <NavDropdown.Divider />
                                        <NavDropdown.Item as={Link} to="/profile">
                                            <FaUser className="me-2" /> Profil Saya
                                        </NavDropdown.Item>
                                        <NavDropdown.Divider />
                                        <NavDropdown.Item onClick={handleLogout}>
                                            <FaSignOutAlt className="me-2" /> Logout
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/doctor/appointments">
                                            <FaCalendarAlt className="me-2" /> Janji Temu
                                        </NavDropdown.Item>
                                    </NavDropdown>
                                )}
                                
                                {/* ========== MENU UNTUK ADMIN ========== */}
                                {user.role === 'admin' && (
                                    <NavDropdown 
                                        title={
                                            <span className="text-warning">
                                                <FaShieldAlt className="me-1" />
                                                Admin
                                            </span>
                                        }
                                        id="admin-dropdown"
                                        align="end"
                                    >
                                        <NavDropdown.Header className="text-muted small">
                                            Panel Administrasi
                                        </NavDropdown.Header>
                                        <NavDropdown.Item as={Link} to="/admin">
                                            <FaChartLine className="me-2" /> Dashboard
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/verify-payments">
                                            <FaMoneyBillWave className="me-2" /> 
                                            Verifikasi Pembayaran
                                            <Badge bg="danger" className="ms-2">3</Badge>
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/doctors">
                                            <FaUserMd className="me-2" /> Kelola Dokter
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/users">
                                            <FaUsers className="me-2" /> Kelola User
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/consultations">
                                            <FaPrescription className="me-2" /> Semua Konsultasi
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/appointments">
                                            <FaCalendarAlt className="me-2" /> Semua Janji
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/pharmacy">
                                            <FaPills className="me-2" /> Manajemen Farmasi
                                        </NavDropdown.Item>
                                        <NavDropdown.Divider />
                                        <NavDropdown.Item as={Link} to="/profile">
                                            <FaUser className="me-2" /> Profil Saya
                                        </NavDropdown.Item>
                                        <NavDropdown.Divider />
                                        <NavDropdown.Item onClick={handleLogout}>
                                            <FaSignOutAlt className="me-2" /> Logout
                                        </NavDropdown.Item>
                                    </NavDropdown>
                                )}
                            </>
                        ) : (
                            <>
                                <Nav.Link as={Link} to="/login">
                                    <FaSignInAlt className="me-1" /> Login
                                </Nav.Link>
                                <Nav.Link as={Link} to="/register">
                                    <FaUserPlus className="me-1" /> Register
                                </Nav.Link>
                            </>
                        )}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

export default Navigation;