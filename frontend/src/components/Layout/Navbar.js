import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, NavDropdown, Badge } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import api from '../../utils/api';
import {
    FaUserMd, FaPills, FaCalendarAlt,
    FaHeartbeat, FaSignInAlt, FaUserPlus, FaSignOutAlt,
    FaUser, FaShieldAlt, FaStethoscope,
    FaBox, FaUsers, FaMoneyBillWave, FaHistory
} from 'react-icons/fa';

const Navigation = () => {
    const { user, logout } = useAuth();
    const { unreadCount } = useNotifications(); // Jika tidak dipakai, abaikan warning eslint
    const navigate = useNavigate();
    const [pendingPayments, setPendingPayments] = useState(0);

    useEffect(() => {
        if (user?.role === 'admin') {
            api.get('/api/admin/payments/pending')
                .then(res => setPendingPayments(res.data.payments?.length || 0))
                .catch(() => setPendingPayments(0));
        }
    }, [user]);

    if (user?.role === 'doctor') return null;

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <>
            <style>{`
                .minimalist-navbar {
                    background: rgba(255, 255, 255, 0.95) !important;
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid #f3f4f6 !important;
                }
                .brand-text {
                    font-weight: 800;
                    color: #111827 !important;
                    letter-spacing: -0.5px;
                    transition: color 0.2s ease;
                }
                .brand-text:hover {
                    color: #2563eb !important;
                }
                .nav-link-custom {
                    color: #4b5563 !important;
                    font-weight: 500;
                    font-size: 0.95rem;
                    position: relative;
                    padding: 8px 12px !important;
                    margin: 0 4px;
                    transition: color 0.2s ease;
                }
                .nav-link-custom:hover {
                    color: #2563eb !important;
                }
                .nav-link-custom::after {
                    content: '';
                    position: absolute;
                    width: 0;
                    height: 2px;
                    bottom: 0;
                    left: 50%;
                    background-color: #2563eb;
                    transition: all 0.3s ease;
                    transform: translateX(-50%);
                    border-radius: 2px;
                }
                .nav-link-custom:hover::after {
                    width: 80%;
                }
                .dropdown-menu {
                    border: 1px solid #f3f4f6;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.05);
                    padding: 8px;
                    animation: fadeDown 0.2s ease-out forwards;
                }
                .dropdown-item {
                    border-radius: 8px;
                    padding: 8px 16px;
                    font-size: 0.95rem;
                    font-weight: 500;
                    color: #4b5563;
                    transition: all 0.2s;
                }
                .dropdown-item:hover {
                    background-color: #f3f4f6;
                    color: #111827;
                }
                .dropdown-item.text-danger:hover {
                    background-color: #fef2f2;
                    color: #dc2626 !important;
                }
                .login-btn {
                    background-color: #2563eb;
                    color: white !important;
                    border-radius: 20px;
                    padding: 8px 20px !important;
                    transition: all 0.2s;
                }
                .login-btn:hover {
                    background-color: #1d4ed8;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
                }
                .register-btn {
                    border: 1px solid #e5e7eb;
                    border-radius: 20px;
                    padding: 8px 20px !important;
                    transition: all 0.2s;
                }
                .register-btn:hover {
                    background-color: #f9fafb;
                    border-color: #d1d5db;
                }
                @keyframes fadeDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <Navbar expand="lg" sticky="top" className="minimalist-navbar py-2 py-lg-3">
                <Container>
                    <Navbar.Brand as={Link} to="/" className="brand-text fs-4">
                        Klinik IPB
                    </Navbar.Brand>
                    
                    <Navbar.Toggle aria-controls="basic-navbar-nav" className="border-0 shadow-none" />
                    
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="me-auto ms-lg-4">
                            {/* Menu User / Guest */}
                            {user?.role !== 'admin' && (
                                <>
                                    <Nav.Link as={Link} to="/appointments" className="nav-link-custom d-flex align-items-center">
                                        <FaCalendarAlt className="me-2 d-lg-none" /> Janji Temu
                                    </Nav.Link>
                                    <Nav.Link as={Link} to="/consultations" className="nav-link-custom d-flex align-items-center">
                                        <FaStethoscope className="me-2 d-lg-none" /> Konsultasi
                                    </Nav.Link>
                                    <Nav.Link as={Link} to="/pharmacy" className="nav-link-custom d-flex align-items-center">
                                        <FaPills className="me-2 d-lg-none" /> Farmasi
                                    </Nav.Link>
                                    <Nav.Link as={Link} to="/health-check" className="nav-link-custom d-flex align-items-center">
                                        <FaHeartbeat className="me-2 d-lg-none" /> Cek Kesehatan
                                    </Nav.Link>
                                </>
                            )}
                            
                            {/* Menu Khusus Admin */}
                            {user?.role === 'admin' && (
                                <>
                                    <Nav.Link as={Link} to="/admin" className="nav-link-custom text-danger d-flex align-items-center">
                                        <FaShieldAlt className="me-2" /> Admin Panel
                                    </Nav.Link>
                                    <NavDropdown title={<span><FaUsers className="me-1"/> Kelola Users</span>} id="admin-users-dropdown" className="nav-link-custom">
                                        <NavDropdown.Item as={Link} to="/admin?tab=users"><FaUsers className="me-2 text-muted"/> Semua User</NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin?tab=doctors"><FaUserMd className="me-2 text-muted"/> Dokter</NavDropdown.Item>
                                    </NavDropdown>
                                    <NavDropdown title={<span><FaBox className="me-1"/> Layanan</span>} id="admin-services-dropdown" className="nav-link-custom">
                                        <NavDropdown.Item as={Link} to="/admin?tab=appointments"><FaCalendarAlt className="me-2 text-muted"/> Janji Temu Offline</NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin?tab=consultations"><FaStethoscope className="me-2 text-muted"/> Konsultasi Online</NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin?tab=pharmacy"><FaPills className="me-2 text-muted"/> Inventaris Obat</NavDropdown.Item>
                                    </NavDropdown>
                                    <Nav.Link as={Link} to="/admin?tab=payments" className="nav-link-custom d-flex align-items-center">
                                        <FaMoneyBillWave className="me-2 d-lg-none" /> Keuangan
                                        {pendingPayments > 0 && <Badge bg="danger" className="ms-2 rounded-pill">{pendingPayments}</Badge>}
                                    </Nav.Link>
                                </>
                            )}
                        </Nav>

                        <Nav className="align-items-lg-center gap-2 mt-3 mt-lg-0">
                            {user ? (
                                <>
                                    <NotificationDropdown />
                                    {user.role === 'admin' ? (
                                        <NavDropdown title={<span style={{ fontWeight: 600, color: '#111827' }}>Admin</span>} id="basic-nav-dropdown" align="end">
                                            <NavDropdown.Item onClick={handleLogout} className="text-danger">
                                                <FaSignOutAlt className="me-2" /> Logout
                                            </NavDropdown.Item>
                                        </NavDropdown>
                                    ) : (
                                        <NavDropdown 
                                            title={<span style={{ fontWeight: 600, color: '#111827' }}>{user.name}</span>} 
                                            id="basic-nav-dropdown" 
                                            align="end"
                                        >
                                            <NavDropdown.Item as={Link} to="/profile">
                                                <FaUser className="me-2 text-muted" /> Profil
                                            </NavDropdown.Item>
                                            <NavDropdown.Item as={Link} to="/payments">
                                                <FaHistory className="me-2 text-muted" /> Riwayat Pembayaran
                                            </NavDropdown.Item>
                                            <NavDropdown.Divider style={{ borderColor: '#f3f4f6', margin: '4px 0' }} />
                                            <NavDropdown.Item onClick={handleLogout} className="text-danger">
                                                <FaSignOutAlt className="me-2" /> Logout
                                            </NavDropdown.Item>
                                        </NavDropdown>
                                    )}
                                </>
                            ) : (
                                <div className="d-flex gap-2">
                                    <Nav.Link as={Link} to="/register" className="nav-link-custom register-btn">
                                        <FaUserPlus className="me-1 d-lg-none" /> Daftar
                                    </Nav.Link>
                                    <Nav.Link as={Link} to="/login" className="nav-link-custom login-btn">
                                        <FaSignInAlt className="me-1 d-lg-none" /> Login
                                    </Nav.Link>
                                </div>
                            )}
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
        </>
    );
};

export default Navigation;