import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
    Container, Row, Col, Card, Form, Button,
    Alert, Spinner, Tab, Tabs, Badge
} from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
    FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt,
    FaLock, FaEdit, FaSave, FaTimes, FaShieldAlt
} from 'react-icons/fa';

const Profile = () => {
    const { user, setUser } = useAuth();

    // --- State profil ---
    const [profileData, setProfileData] = useState({
        name: '',
        phone: '',
        address: {
            street: '',
            city: '',
            province: '',
            postalCode: ''
        }
    });
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // --- State ganti password ---
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [savingPassword, setSavingPassword] = useState(false);
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await api.get(`/api/users/profile`);
            const u = res.data;
            setProfileData({
                name: u.name || '',
                phone: u.phone || '',
                address: {
                    street: u.address?.street || '',
                    city: u.address?.city || '',
                    province: u.address?.province || '',
                    postalCode: u.address?.postalCode || ''
                }
            });
        } catch (err) {
            toast.error('Gagal memuat profil');
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('address.')) {
            const field = name.split('.')[1];
            setProfileData(prev => ({
                ...prev,
                address: { ...prev.address, [field]: value }
            }));
        } else {
            setProfileData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!profileData.name.trim() || !profileData.phone.trim()) {
            toast.error('Nama dan nomor telepon wajib diisi');
            return;
        }
        setSavingProfile(true);
        try {
            const res = await api.put(`/api/users/profile`,
                profileData
            );
            toast.success('Profil berhasil diperbarui');
            setEditMode(false);
            // Update context user juga
            if (setUser) {
                setUser(prev => ({ ...prev, name: profileData.name }));
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menyimpan profil');
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({ ...prev, [name]: value }));
    };

    const handleSavePassword = async (e) => {
        e.preventDefault();
        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
            toast.error('Semua field password harus diisi');
            return;
        }
        if (passwordData.newPassword.length < 6) {
            toast.error('Password baru minimal 6 karakter');
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('Konfirmasi password tidak cocok');
            return;
        }
        setSavingPassword(true);
        try {
            await api.put(`/api/users/change-password`,
                {
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                }
            );
            toast.success('Password berhasil diubah');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal mengubah password');
        } finally {
            setSavingPassword(false);
        }
    };

    const getRoleBadge = (role) => {
        const map = { admin: 'danger', doctor: 'primary', user: 'success' };
        const label = { admin: 'Admin', doctor: 'Dokter', user: 'Pasien' };
        return <Badge bg={map[role] || 'secondary'}>{label[role] || role}</Badge>;
    };

    if (loadingProfile) {
        return (
            <Container className="py-5 text-center">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2 text-muted">Memuat profil...</p>
            </Container>
        );
    }

    return (
        <Container className="py-4" style={{ maxWidth: 800 }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
                * { font-family: 'Poppins', sans-serif !important; }
            `}</style>
            {/* Header */}
            <Row className="mb-4">
                <Col>
                    <Card className="border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #0d6efd, #0b5ed7)' }}>
                        <Card.Body className="p-4 text-white">
                            <Row className="align-items-center">
                                <Col xs="auto">
                                    <div
                                        className="rounded-circle bg-white d-flex align-items-center justify-content-center"
                                        style={{ width: 72, height: 72 }}
                                    >
                                        <FaUser size={32} className="text-primary" />
                                    </div>
                                </Col>
                                <Col>
                                    <h4 className="mb-1 fw-bold">{profileData.name || user?.name}</h4>
                                    <p className="mb-1 opacity-75 small">{user?.email}</p>
                                    {getRoleBadge(user?.role)}
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Tabs */}
            <Tabs defaultActiveKey="profile" className="mb-3">

                {/* ===== TAB PROFIL ===== */}
                <Tab eventKey="profile" title={<span><FaUser className="me-1" />Data Profil</span>}>
                    <Card className="border-0 shadow-sm">
                        <Card.Body className="p-4">
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h5 className="fw-bold mb-0">Informasi Pribadi</h5>
                                {!editMode ? (
                                    <Button
                                        variant="outline-primary"
                                        size="sm"
                                        onClick={() => setEditMode(true)}
                                    >
                                        <FaEdit className="me-1" /> Edit Profil
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        onClick={() => { setEditMode(false); fetchProfile(); }}
                                    >
                                        <FaTimes className="me-1" /> Batal
                                    </Button>
                                )}
                            </div>

                            <Form onSubmit={handleSaveProfile}>
                                <Row className="g-3">
                                    {/* Email (read-only) */}
                                    <Col md={12}>
                                        <Form.Group>
                                            <Form.Label className="fw-semibold">
                                                <FaEnvelope className="me-1 text-muted" /> Email
                                            </Form.Label>
                                            <Form.Control
                                                type="email"
                                                value={user?.email || ''}
                                                disabled
                                                className="bg-light"
                                            />
                                            <Form.Text className="text-muted">Email tidak dapat diubah.</Form.Text>
                                        </Form.Group>
                                    </Col>

                                    {/* Nama */}
                                    <Col md={6}>
                                        <Form.Group>
                                            <Form.Label className="fw-semibold">
                                                <FaUser className="me-1 text-muted" /> Nama Lengkap <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="name"
                                                value={profileData.name}
                                                onChange={handleProfileChange}
                                                disabled={!editMode}
                                                placeholder="Nama lengkap"
                                            />
                                        </Form.Group>
                                    </Col>

                                    {/* Telepon */}
                                    <Col md={6}>
                                        <Form.Group>
                                            <Form.Label className="fw-semibold">
                                                <FaPhone className="me-1 text-muted" /> Nomor Telepon <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="tel"
                                                name="phone"
                                                value={profileData.phone}
                                                onChange={handleProfileChange}
                                                disabled={!editMode}
                                                placeholder="08xxxxxxxxxx"
                                            />
                                        </Form.Group>
                                    </Col>

                                    {/* Alamat */}
                                    <Col md={12}>
                                        <hr className="my-1" />
                                        <p className="fw-semibold mb-2">
                                            <FaMapMarkerAlt className="me-1 text-muted" /> Alamat
                                        </p>
                                    </Col>
                                    <Col md={12}>
                                        <Form.Group>
                                            <Form.Label>Jalan / Nama Jalan</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="address.street"
                                                value={profileData.address.street}
                                                onChange={handleProfileChange}
                                                disabled={!editMode}
                                                placeholder="Jl. Contoh No. 1"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label>Kota</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="address.city"
                                                value={profileData.address.city}
                                                onChange={handleProfileChange}
                                                disabled={!editMode}
                                                placeholder="Bogor"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label>Provinsi</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="address.province"
                                                value={profileData.address.province}
                                                onChange={handleProfileChange}
                                                disabled={!editMode}
                                                placeholder="Jawa Barat"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label>Kode Pos</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="address.postalCode"
                                                value={profileData.address.postalCode}
                                                onChange={handleProfileChange}
                                                disabled={!editMode}
                                                placeholder="16680"
                                            />
                                        </Form.Group>
                                    </Col>

                                    {editMode && (
                                        <Col md={12}>
                                            <Button
                                                type="submit"
                                                variant="primary"
                                                disabled={savingProfile}
                                                className="px-4"
                                            >
                                                {savingProfile
                                                    ? <><Spinner size="sm" className="me-1" /> Menyimpan...</>
                                                    : <><FaSave className="me-1" /> Simpan Perubahan</>
                                                }
                                            </Button>
                                        </Col>
                                    )}
                                </Row>
                            </Form>
                        </Card.Body>
                    </Card>
                </Tab>

                {/* ===== TAB GANTI PASSWORD ===== */}
                <Tab eventKey="password" title={<span><FaLock className="me-1" />Keamanan</span>}>
                    <Card className="border-0 shadow-sm">
                        <Card.Body className="p-4">
                            <div className="d-flex align-items-center mb-4">
                                <FaShieldAlt className="text-primary me-2" size={20} />
                                <h5 className="fw-bold mb-0">Ganti Password</h5>
                            </div>

                            <Alert variant="info" className="small">
                                Password baru minimal 6 karakter. Setelah ganti password, Anda tidak perlu login ulang.
                            </Alert>

                            <Form onSubmit={handleSavePassword} style={{ maxWidth: 480 }}>
                                <Row className="g-3">
                                    <Col md={12}>
                                        <Form.Group>
                                            <Form.Label className="fw-semibold">Password Saat Ini</Form.Label>
                                            <div className="input-group">
                                                <Form.Control
                                                    type={showPasswords.current ? 'text' : 'password'}
                                                    name="currentPassword"
                                                    value={passwordData.currentPassword}
                                                    onChange={handlePasswordChange}
                                                    placeholder="Masukkan password lama"
                                                />
                                                <Button
                                                    variant="outline-secondary"
                                                    onClick={() => setShowPasswords(p => ({ ...p, current: !p.current }))}
                                                >
                                                    {showPasswords.current ? '🙈' : '👁️'}
                                                </Button>
                                            </div>
                                        </Form.Group>
                                    </Col>

                                    <Col md={12}>
                                        <Form.Group>
                                            <Form.Label className="fw-semibold">Password Baru</Form.Label>
                                            <div className="input-group">
                                                <Form.Control
                                                    type={showPasswords.new ? 'text' : 'password'}
                                                    name="newPassword"
                                                    value={passwordData.newPassword}
                                                    onChange={handlePasswordChange}
                                                    placeholder="Minimal 6 karakter"
                                                />
                                                <Button
                                                    variant="outline-secondary"
                                                    onClick={() => setShowPasswords(p => ({ ...p, new: !p.new }))}
                                                >
                                                    {showPasswords.new ? '🙈' : '👁️'}
                                                </Button>
                                            </div>
                                            {passwordData.newPassword && passwordData.newPassword.length < 6 && (
                                                <Form.Text className="text-danger">Minimal 6 karakter</Form.Text>
                                            )}
                                        </Form.Group>
                                    </Col>

                                    <Col md={12}>
                                        <Form.Group>
                                            <Form.Label className="fw-semibold">Konfirmasi Password Baru</Form.Label>
                                            <div className="input-group">
                                                <Form.Control
                                                    type={showPasswords.confirm ? 'text' : 'password'}
                                                    name="confirmPassword"
                                                    value={passwordData.confirmPassword}
                                                    onChange={handlePasswordChange}
                                                    placeholder="Ulangi password baru"
                                                    isInvalid={
                                                        passwordData.confirmPassword.length > 0 &&
                                                        passwordData.confirmPassword !== passwordData.newPassword
                                                    }
                                                />
                                                <Button
                                                    variant="outline-secondary"
                                                    onClick={() => setShowPasswords(p => ({ ...p, confirm: !p.confirm }))}
                                                >
                                                    {showPasswords.confirm ? '🙈' : '👁️'}
                                                </Button>
                                                <Form.Control.Feedback type="invalid">
                                                    Password tidak cocok
                                                </Form.Control.Feedback>
                                            </div>
                                        </Form.Group>
                                    </Col>

                                    <Col md={12}>
                                        <Button
                                            type="submit"
                                            variant="warning"
                                            disabled={savingPassword}
                                            className="px-4"
                                        >
                                            {savingPassword
                                                ? <><Spinner size="sm" className="me-1" /> Menyimpan...</>
                                                : <><FaLock className="me-1" /> Ganti Password</>
                                            }
                                        </Button>
                                    </Col>
                                </Row>
                            </Form>
                        </Card.Body>
                    </Card>
                </Tab>
            </Tabs>
        </Container>
    );
};

export default Profile;