import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, NavDropdown, Badge } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import api from '../../utils/api';
import ipbLogo from './ipb-logo.png';
import {
    FaUserMd, FaPills, FaCalendarAlt,
    FaHeartbeat, FaSignInAlt, FaUserPlus, FaSignOutAlt,
    FaUser, FaShieldAlt, FaStethoscope,
    FaBox, FaUsers, FaMoneyBillWave, FaHistory,
    FaWeight, FaFire,FaVideo
} from 'react-icons/fa';

const Navigation = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
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

    const isHealthActive = location.pathname.startsWith('/health-check');
    const currentTab = new URLSearchParams(location.search).get('tab');

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
                * { font-family: 'Poppins', sans-serif !important; }
                                .minimalist-navbar {
                    background: rgba(255, 255, 255, 0.95) !important;
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid #f3f4f6 !important;
                }
                
                /* === STYLE UNTUK BRAND/LOGO === */
                .brand-container {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    text-decoration: none;
                    transition: transform 0.2s ease;
                }
                .brand-container:hover {
                    transform: scale(1.02);
                }
                .brand-logo {
                    width: 40px;
                    height: 40px;
                    object-fit: contain;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
                    transition: filter 0.2s ease;
                }
                .brand-container:hover .brand-logo {
                    filter: drop-shadow(0 4px 8px rgba(37, 99, 235, 0.2));
                }
                
                .brand-text {
                    font-weight: 800;
                    color: #111827 !important;
                    letter-spacing: -0.5px;
                    transition: color 0.2s ease;
                    font-size: 1.25rem;
                    margin: 0;
                }
                .brand-container:hover .brand-text {
                    color: #2563eb !important;
                }
                
                /* === STYLE UNTUK MENU LINK BIASA === */
                .nav-link-custom {
                    color: #4b5563 !important;
                    font-weight: 500;
                    font-size: 0.95rem;
                    position: relative;
                    padding: 8px 12px !important;
                    margin: 0 4px;
                    transition: color 0.2s ease;
                }
                .nav-link-custom:hover,
                .nav-link-custom.active-link {
                    color: #2563eb !important;
                    font-weight: 700;
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
                .nav-link-custom:hover::after,
                .nav-link-custom.active-link::after {
                    width: 80%;
                }

                /* === STYLE KHUSUS UNTUK MENU DROPDOWN (CEK KESEHATAN DLL) === */
                .custom-dropdown .dropdown-toggle {
                    color: #4b5563 !important;
                    font-weight: 500;
                    font-size: 0.95rem;
                    padding: 8px 12px !important;
                    margin: 0 4px;
                    transition: color 0.2s ease;
                }
                .custom-dropdown .dropdown-toggle:hover {
                    color: #2563eb !important;
                }
                .custom-dropdown.active-dropdown .dropdown-toggle {
                    color: #2563eb !important;
                    font-weight: 700;
                }

                /* === STYLE DROPDOWN ITEM === */
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
                .dropdown-item:hover, .dropdown-item.active {
                    background-color: #f3f4f6;
                    color: #111827;
                }
                .dropdown-item.text-danger:hover {
                    background-color: #fef2f2;
                    color: #dc2626 !important;
                }

                /* === STYLE TOMBOL LOGIN & DAFTAR (BEBAS EFEK BIRU LINK) === */
                .login-btn {
                    background-color: #2563eb !important;
                    color: white !important;
                    border-radius: 20px;
                    padding: 8px 20px !important;
                    font-size: 0.95rem;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .login-btn:hover {
                    background-color: #1d4ed8 !important;
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
                }
                .register-btn {
                    background-color: transparent !important;
                    color: #374151 !important;
                    border: 1px solid #d1d5db !important;
                    border-radius: 20px;
                    padding: 8px 20px !important;
                    font-size: 0.95rem;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .register-btn:hover {
                    background-color: #f9fafb !important;
                    color: #111827 !important;
                    border-color: #9ca3af !important;
                }

                @keyframes fadeDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                /* === RESPONSIVE LOGO === */
                @media (max-width: 991px) {
                    .brand-logo {
                        width: 36px;
                        height: 36px;
                    }
                    .brand-text {
                        font-size: 1.1rem;
                    }
                }
            `}</style>

            <Navbar expand="lg" sticky="top" className="minimalist-navbar py-2 py-lg-3">
                <Container>
                    <Navbar.Brand as={Link} to="/" className="brand-container">
                        <img 
                            src={ipbLogo} 
                            alt="IPB Logo" 
                            className="brand-logo"
                        />
                        <span className="brand-text">Klinik IPB</span>
                    </Navbar.Brand>
                    
                    <Navbar.Toggle aria-controls="basic-navbar-nav" className="border-0 shadow-none" />
                    
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="me-auto ms-lg-4">
                            {/* Menu User / Guest */}
                            {user?.role !== 'admin' && (
                                <>
                                    <Nav.Link as={Link} to="/appointments" className={`nav-link-custom d-flex align-items-center ${location.pathname.startsWith('/appointments') ? 'active-link' : ''}`}>
                                        <FaCalendarAlt className="me-2 d-lg-none" /> Janji Temu
                                    </Nav.Link>
                                    <Nav.Link as={Link} to="/consultations" className={`nav-link-custom d-flex align-items-center ${location.pathname.startsWith('/consultations') ? 'active-link' : ''}`}>
                                        <FaStethoscope className="me-2 d-lg-none" /> Konsultasi
                                    </Nav.Link>
                                    <Nav.Link as={Link} to="/pharmacy" className={`nav-link-custom d-flex align-items-center ${location.pathname.startsWith('/pharmacy') ? 'active-link' : ''}`}>
                                        <FaPills className="me-2 d-lg-none" /> Farmasi
                                    </Nav.Link>
                                    
                                    {/* Gunakan class custom-dropdown di sini */}
                                    <NavDropdown
                                        title={<span><FaHeartbeat className="me-2 d-lg-none" />Cek Kesehatan</span>}
                                        id="health-check-dropdown"
                                        className={`custom-dropdown ${isHealthActive ? 'active-dropdown' : ''}`}
                                    >
                                        <NavDropdown.Item as={Link} to="/health-check/bmi" className={location.pathname === '/health-check/bmi' ? 'active' : ''}>
                                            <FaWeight className="me-2 text-muted" /> BMI Calculator
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/health-check/blood-pressure" className={location.pathname === '/health-check/blood-pressure' ? 'active' : ''}>
                                            <FaHeartbeat className="me-2 text-muted" /> Blood Pressure Checker
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/health-check/calories" className={location.pathname === '/health-check/calories' ? 'active' : ''}>
                                            <FaFire className="me-2 text-muted" /> Calorie Calculator
                                        </NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/health-check/vital-scan" className={location.pathname === '/health-check/vital-sign' ? 'active' : ''}>
                                            <FaVideo className="me-2 text-muted" /> Vital Sign Scanner
                                        </NavDropdown.Item>
                                    </NavDropdown>
                                </>
                            )}
                            
                            {/* Menu Khusus Admin */}
                            {user?.role === 'admin' && (
                                <>
                                    <Nav.Link as={Link} to="/admin" className={`nav-link-custom text-danger d-flex align-items-center ${location.pathname === '/admin' && !currentTab ? 'active-link' : ''}`}>
                                        <FaShieldAlt className="me-2" /> Admin Panel
                                    </Nav.Link>
                                    <NavDropdown 
                                        title={<span><FaUsers className="me-1"/> Kelola Users</span>} 
                                        id="admin-users-dropdown" 
                                        className={`custom-dropdown ${(currentTab === 'users' || currentTab === 'doctors') ? 'active-dropdown' : ''}`}
                                    >
                                        <NavDropdown.Item as={Link} to="/admin?tab=users" className={currentTab === 'users' ? 'active' : ''}><FaUsers className="me-2 text-muted"/> Semua User</NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin?tab=doctors" className={currentTab === 'doctors' ? 'active' : ''}><FaUserMd className="me-2 text-muted"/> Dokter</NavDropdown.Item>
                                    </NavDropdown>
                                    <NavDropdown 
                                        title={<span><FaBox className="me-1"/> Layanan</span>} 
                                        id="admin-services-dropdown" 
                                        className={`custom-dropdown ${(currentTab === 'appointments' || currentTab === 'consultations' || currentTab === 'pharmacy') ? 'active-dropdown' : ''}`}
                                    >
                                        <NavDropdown.Item as={Link} to="/admin?tab=appointments" className={currentTab === 'appointments' ? 'active' : ''}><FaCalendarAlt className="me-2 text-muted"/> Janji Temu Offline</NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin?tab=consultations" className={currentTab === 'consultations' ? 'active' : ''}><FaStethoscope className="me-2 text-muted"/> Konsultasi Online</NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/admin?tab=pharmacy" className={currentTab === 'pharmacy' ? 'active' : ''}><FaPills className="me-2 text-muted"/> Inventaris Obat</NavDropdown.Item>
                                    </NavDropdown>
                                    <Nav.Link as={Link} to="/admin?tab=payments" className={`nav-link-custom d-flex align-items-center ${currentTab === 'payments' ? 'active-link' : ''}`}>
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
                                    <Nav.Link as={Link} to="/register" className="register-btn">
                                        <FaUserPlus className="me-1 d-lg-none" /> Daftar
                                    </Nav.Link>
                                    <Nav.Link as={Link} to="/login" className="login-btn">
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