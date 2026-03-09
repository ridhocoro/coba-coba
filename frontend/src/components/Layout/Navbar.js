import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, NavDropdown, Badge } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import api from '../../utils/api';
import {
    FaUserMd, FaClipboardList, FaPills, FaCalendarAlt,
    FaHeartbeat, FaSignInAlt, FaUserPlus, FaSignOutAlt,
    FaUser, FaShieldAlt, FaStethoscope,
    FaHome, FaChartLine, FaCreditCard,
    FaBox, FaUsers, FaMoneyBillWave, FaPrescription,
} from 'react-icons/fa';

const Navigation = () => {
    const { user, logout } = useAuth();
    const { unreadCount } = useNotifications();
    const navigate = useNavigate();
    const [pendingPayments, setPendingPayments] = useState(0);

    useEffect(() => {
        if (user?.role === 'admin') {
            api.get('/api/admin/payments/pending')
                .then(res => setPendingPayments(res.data.payments?.length || 0))
                .catch(() => setPendingPayments(0));
        }
    }, [user]);

    // Dokter tidak pakai Navbar — DoctorDashboard punya sidebar sendiri.
    // Pengecekan ini sebagai safety net; App.js sudah menyembunyikan Navbar
    // untuk role dokter, tapi kalau komponen ini dipanggil langsung, tetap aman.
    if (user?.role === 'doctor') return null;

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

                <Navbar.Toggle aria-controls="main-navbar" />
                <Navbar.Collapse id="main-navbar">

                    {/* ========== NAV UTAMA: USER ========== */}
                    {user?.role === 'user' && (
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

                    {/* ========== NAV UTAMA: ADMIN ========== */}
                    {user?.role === 'admin' && (
                        <Nav className="me-auto">
                            <Nav.Link as={Link} to="/admin">
                                <FaHome className="me-1" /> Dashboard
                            </Nav.Link>
                            <Nav.Link as={Link} to="/admin/verify-payments">
                                <FaMoneyBillWave className="me-1" /> Verifikasi
                                {pendingPayments > 0 && (
                                    <Badge bg="danger" className="ms-1">{pendingPayments}</Badge>
                                )}
                            </Nav.Link>
                            <Nav.Link as={Link} to="/admin/doctors">
                                <FaUserMd className="me-1" /> Dokter
                            </Nav.Link>
                            <Nav.Link as={Link} to="/admin/users">
                                <FaUsers className="me-1" /> Pengguna
                            </Nav.Link>
                        </Nav>
                    )}

                    {/* ========== NAV: BELUM LOGIN ========== */}
                    {!user && (
                        <Nav className="me-auto">
                            <Nav.Link as={Link} to="/health-check">
                                <FaClipboardList className="me-1" /> Cek Kesehatan
                            </Nav.Link>
                        </Nav>
                    )}

                    {/* ========== NAV KANAN ========== */}
                    <Nav className="align-items-center">
                        {user && <NotificationDropdown />}

                        {user ? (
                            <>
                                {/* ----- Dropdown: USER ----- */}
                                {user.role === 'user' && (
                                    <NavDropdown
                                        title={<span><FaUser className="me-1" />{user.name?.split(' ')[0]}</span>}
                                        id="user-dropdown"
                                        align="end"
                                    >
                                        <NavDropdown.Header className="text-muted small">Menu User</NavDropdown.Header>
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
                                        <NavDropdown.Item onClick={handleLogout} className="text-danger">
                                            <FaSignOutAlt className="me-2" /> Logout
                                        </NavDropdown.Item>
                                    </NavDropdown>
                                )}

                                {/* ----- Dropdown: ADMIN ----- */}
                                {user.role === 'admin' && (
                                    <NavDropdown
                                        title={<span className="text-warning"><FaShieldAlt className="me-1" />Admin</span>}
                                        id="admin-dropdown"
                                        align="end"
                                    >
                                        <NavDropdown.Header className="text-muted small">Panel Administrasi</NavDropdown.Header>
                                        <NavDropdown.Item as={Link} to="/admin">
                                            <FaChartLine className="me-2" /> Dashboard
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/verify-payments">
                                            <FaMoneyBillWave className="me-2" /> Verifikasi Pembayaran
                                            {pendingPayments > 0 && (
                                                <Badge bg="danger" className="ms-2">{pendingPayments}</Badge>
                                            )}
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/doctors">
                                            <FaUserMd className="me-2" /> Kelola Dokter
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/users">
                                            <FaUsers className="me-2" /> Kelola Pengguna
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/consultations">
                                            <FaPrescription className="me-2" /> Semua Konsultasi
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/appointments">
                                            <FaCalendarAlt className="me-2" /> Semua Janji Temu
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin/pharmacy">
                                            <FaPills className="me-2" /> Manajemen Farmasi
                                        </NavDropdown.Item>
                                        <NavDropdown.Divider />
                                        <NavDropdown.Item as={Link} to="/profile">
                                            <FaUser className="me-2" /> Profil Saya
                                        </NavDropdown.Item>
                                        <NavDropdown.Divider />
                                        <NavDropdown.Item onClick={handleLogout} className="text-danger">
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