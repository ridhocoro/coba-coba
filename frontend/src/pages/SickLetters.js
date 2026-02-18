import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
    FaUser, 
    FaEnvelope, 
    FaLock, 
    FaPhone, 
    FaMapMarkerAlt, 
    FaCity, 
    FaBuilding,
    FaMailBulk,
    FaEye,
    FaEyeSlash,
    FaCheckCircle,
    FaTimesCircle
} from 'react-icons/fa';

const Register = () => {
    const navigate = useNavigate();
    const { register } = useAuth();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        address: {
            street: '',
            city: '',
            province: '',
            postalCode: ''
        }
    });
    const [errors, setErrors] = useState({});
    const [agreeTerms, setAgreeTerms] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }

        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: null
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        // Name validation
        if (!formData.name.trim()) {
            newErrors.name = 'Nama lengkap harus diisi';
        } else if (formData.name.length < 3) {
            newErrors.name = 'Nama lengkap minimal 3 karakter';
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email) {
            newErrors.email = 'Email harus diisi';
        } else if (!emailRegex.test(formData.email)) {
            newErrors.email = 'Format email tidak valid';
        }

        // Password validation
        if (!formData.password) {
            newErrors.password = 'Password harus diisi';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password minimal 6 karakter';
        } else if (!/(?=.*[0-9])/.test(formData.password)) {
            newErrors.password = 'Password harus mengandung angka';
        }

        // Confirm password
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Password tidak cocok';
        }

        // Phone validation
        const phoneRegex = /^[0-9]{10,13}$/;
        if (!formData.phone) {
            newErrors.phone = 'Nomor telepon harus diisi';
        } else if (!phoneRegex.test(formData.phone.replace(/\D/g, ''))) {
            newErrors.phone = 'Nomor telepon tidak valid (10-13 digit)';
        }

        // Address validation
        if (!formData.address.street) {
            newErrors['address.street'] = 'Alamat jalan harus diisi';
        }
        if (!formData.address.city) {
            newErrors['address.city'] = 'Kota harus diisi';
        }
        if (!formData.address.province) {
            newErrors['address.province'] = 'Provinsi harus diisi';
        }
        if (!formData.address.postalCode) {
            newErrors['address.postalCode'] = 'Kode pos harus diisi';
        } else if (!/^[0-9]{5}$/.test(formData.address.postalCode)) {
            newErrors['address.postalCode'] = 'Kode pos harus 5 digit';
        }

        // Terms agreement
        if (!agreeTerms) {
            newErrors.agreeTerms = 'Anda harus menyetujui syarat dan ketentuan';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        
        try {
            // Remove confirmPassword before sending
            const { confirmPassword, ...registerData } = formData;
            const success = await register(registerData);
            
            if (success) {
                navigate('/');
            }
        } catch (error) {
            console.error('Registration error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getPasswordStrength = () => {
        const password = formData.password;
        if (!password) return { score: 0, label: 'Kosong', variant: 'secondary' };
        
        let score = 0;
        if (password.length >= 6) score++;
        if (password.length >= 8) score++;
        if (/(?=.*[0-9])/.test(password)) score++;
        if (/(?=.*[a-z])/.test(password)) score++;
        if (/(?=.*[A-Z])/.test(password)) score++;
        if (/(?=.*[!@#$%^&*])/.test(password)) score++;
        
        if (score <= 2) return { score: 20, label: 'Lemah', variant: 'danger' };
        if (score <= 4) return { score: 60, label: 'Sedang', variant: 'warning' };
        return { score: 100, label: 'Kuat', variant: 'success' };
    };

    const passwordStrength = getPasswordStrength();

    return (
        <Container className="py-5">
            <Row className="justify-content-center">
                <Col lg={8}>
                    <Card className="shadow-lg border-0">
                        <Card.Header className="bg-primary text-white text-center py-4">
                            <h3 className="mb-0">Daftar Akun Baru</h3>
                            <p className="text-white-50 mb-0 mt-2">
                                Bergabunglah dengan Klinik Pratama IPB untuk akses semua layanan
                            </p>
                        </Card.Header>
                        <Card.Body className="p-5">
                            <Form onSubmit={handleSubmit}>
                                {/* Personal Information */}
                                <h5 className="mb-4 pb-2 border-bottom">
                                    <FaUser className="me-2 text-primary" />
                                    Informasi Pribadi
                                </h5>

                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-4">
                                            <Form.Label className="fw-bold">
                                                Nama Lengkap <span className="text-danger">*</span>
                                            </Form.Label>
                                            <InputGroup>
                                                <InputGroup.Text className="bg-light border-end-0">
                                                    <FaUser className="text-muted" />
                                                </InputGroup.Text>
                                                <Form.Control
                                                    type="text"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    placeholder="Masukkan nama lengkap"
                                                    className="border-start-0"
                                                    isInvalid={!!errors.name}
                                                />
                                                {formData.name && formData.name.length >= 3 && (
                                                    <InputGroup.Text className="bg-light border-start-0">
                                                        <FaCheckCircle className="text-success" />
                                                    </InputGroup.Text>
                                                )}
                                            </InputGroup>
                                            <Form.Control.Feedback type="invalid">
                                                {errors.name}
                                            </Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>

                                    <Col md={6}>
                                        <Form.Group className="mb-4">
                                            <Form.Label className="fw-bold">
                                                Email <span className="text-danger">*</span>
                                            </Form.Label>
                                            <InputGroup>
                                                <InputGroup.Text className="bg-light border-end-0">
                                                    <FaEnvelope className="text-muted" />
                                                </InputGroup.Text>
                                                <Form.Control
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    placeholder="contoh@email.com"
                                                    className="border-start-0"
                                                    isInvalid={!!errors.email}
                                                />
                                            </InputGroup>
                                            <Form.Control.Feedback type="invalid">
                                                {errors.email}
                                            </Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-4">
                                            <Form.Label className="fw-bold">
                                                Password <span className="text-danger">*</span>
                                            </Form.Label>
                                            <InputGroup>
                                                <InputGroup.Text className="bg-light border-end-0">
                                                    <FaLock className="text-muted" />
                                                </InputGroup.Text>
                                                <Form.Control
                                                    type={showPassword ? "text" : "password"}
                                                    name="password"
                                                    value={formData.password}
                                                    onChange={handleChange}
                                                    placeholder="Minimal 6 karakter"
                                                    className="border-start-0 border-end-0"
                                                    isInvalid={!!errors.password}
                                                />
                                                <InputGroup.Text 
                                                    className="bg-light border-start-0 cursor-pointer"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    {showPassword ? <FaEyeSlash className="text-muted" /> : <FaEye className="text-muted" />}
                                                </InputGroup.Text>
                                            </InputGroup>
                                            <Form.Control.Feedback type="invalid">
                                                {errors.password}
                                            </Form.Control.Feedback>
                                            
                                            {formData.password && (
                                                <div className="mt-2">
                                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                                        <small className="text-muted">Kekuatan Password:</small>
                                                        <small className={`text-${passwordStrength.variant} fw-bold`}>
                                                            {passwordStrength.label}
                                                        </small>
                                                    </div>
                                                    <div className="progress" style={{ height: '6px' }}>
                                                        <div 
                                                            className={`progress-bar bg-${passwordStrength.variant}`}
                                                            style={{ width: `${passwordStrength.score}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </Form.Group>
                                    </Col>

                                    <Col md={6}>
                                        <Form.Group className="mb-4">
                                            <Form.Label className="fw-bold">
                                                Konfirmasi Password <span className="text-danger">*</span>
                                            </Form.Label>
                                            <InputGroup>
                                                <InputGroup.Text className="bg-light border-end-0">
                                                    <FaLock className="text-muted" />
                                                </InputGroup.Text>
                                                <Form.Control
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    name="confirmPassword"
                                                    value={formData.confirmPassword}
                                                    onChange={handleChange}
                                                    placeholder="Ulangi password"
                                                    className="border-start-0 border-end-0"
                                                    isInvalid={!!errors.confirmPassword}
                                                />
                                                <InputGroup.Text 
                                                    className="bg-light border-start-0"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    {showConfirmPassword ? <FaEyeSlash className="text-muted" /> : <FaEye className="text-muted" />}
                                                </InputGroup.Text>
                                            </InputGroup>
                                            <Form.Control.Feedback type="invalid">
                                                {errors.confirmPassword}
                                            </Form.Control.Feedback>
                                            {formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && (
                                                <Form.Text className="text-success">
                                                    <FaCheckCircle className="me-1" />
                                                    Password cocok
                                                </Form.Text>
                                            )}
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <Row>
                                    <Col md={12}>
                                        <Form.Group className="mb-4">
                                            <Form.Label className="fw-bold">
                                                Nomor Telepon <span className="text-danger">*</span>
                                            </Form.Label>
                                            <InputGroup>
                                                <InputGroup.Text className="bg-light border-end-0">
                                                    <FaPhone className="text-muted" />
                                                </InputGroup.Text>
                                                <Form.Control
                                                    type="tel"
                                                    name="phone"
                                                    value={formData.phone}
                                                    onChange={handleChange}
                                                    placeholder="081234567890"
                                                    className="border-start-0"
                                                    isInvalid={!!errors.phone}
                                                />
                                            </InputGroup>
                                            <Form.Control.Feedback type="invalid">
                                                {errors.phone}
                                            </Form.Control.Feedback>
                                            <Form.Text className="text-muted">
                                                Gunakan nomor yang aktif untuk konfirmasi dan pengiriman
                                            </Form.Text>
                                        </Form.Group>
                                    </Col>
                                </Row>

                                {/* Address Information */}
                                <h5 className="mb-4 mt-5 pb-2 border-bottom">
                                    <FaMapMarkerAlt className="me-2 text-primary" />
                                    Alamat Lengkap
                                </h5>

                                <Row>
                                    <Col md={12}>
                                        <Form.Group className="mb-4">
                                            <Form.Label className="fw-bold">
                                                Alamat Jalan <span className="text-danger">*</span>
                                            </Form.Label>
                                            <InputGroup>
                                                <InputGroup.Text className="bg-light border-end-0">
                                                    <FaMapMarkerAlt className="text-muted" />
                                                </InputGroup.Text>
                                                <Form.Control
                                                    type="text"
                                                    name="address.street"
                                                    value={formData.address.street}
                                                    onChange={handleChange}
                                                    placeholder="Nama jalan, nomor, RT/RW"
                                                    className="border-start-0"
                                                    isInvalid={!!errors['address.street']}
                                                />
                                            </InputGroup>
                                            <Form.Control.Feedback type="invalid">
                                                {errors['address.street']}
                                            </Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <Row>
                                    <Col md={4}>
                                        <Form.Group className="mb-4">
                                            <Form.Label className="fw-bold">
                                                Kota <span className="text-danger">*</span>
                                            </Form.Label>
                                            <InputGroup>
                                                <InputGroup.Text className="bg-light border-end-0">
                                                    <FaCity className="text-muted" />
                                                </InputGroup.Text>
                                                <Form.Control
                                                    type="text"
                                                    name="address.city"
                                                    value={formData.address.city}
                                                    onChange={handleChange}
                                                    placeholder="Kota"
                                                    className="border-start-0"
                                                    isInvalid={!!errors['address.city']}
                                                />
                                            </InputGroup>
                                            <Form.Control.Feedback type="invalid">
                                                {errors['address.city']}
                                            </Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>

                                    <Col md={4}>
                                        <Form.Group className="mb-4">
                                            <Form.Label className="fw-bold">
                                                Provinsi <span className="text-danger">*</span>
                                            </Form.Label>
                                            <InputGroup>
                                                <InputGroup.Text className="bg-light border-end-0">
                                                    <FaBuilding className="text-muted" />
                                                </InputGroup.Text>
                                                <Form.Control
                                                    type="text"
                                                    name="address.province"
                                                    value={formData.address.province}
                                                    onChange={handleChange}
                                                    placeholder="Provinsi"
                                                    className="border-start-0"
                                                    isInvalid={!!errors['address.province']}
                                                />
                                            </InputGroup>
                                            <Form.Control.Feedback type="invalid">
                                                {errors['address.province']}
                                            </Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>

                                    <Col md={4}>
                                        <Form.Group className="mb-4">
                                            <Form.Label className="fw-bold">
                                                Kode Pos <span className="text-danger">*</span>
                                            </Form.Label>
                                            <InputGroup>
                                                <InputGroup.Text className="bg-light border-end-0">
                                                    <FaMailBulk className="text-muted" />
                                                </InputGroup.Text>
                                                <Form.Control
                                                    type="text"
                                                    name="address.postalCode"
                                                    value={formData.address.postalCode}
                                                    onChange={handleChange}
                                                    placeholder="5 digit"
                                                    maxLength="5"
                                                    className="border-start-0"
                                                    isInvalid={!!errors['address.postalCode']}
                                                />
                                            </InputGroup>
                                            <Form.Control.Feedback type="invalid">
                                                {errors['address.postalCode']}
                                            </Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                </Row>

                                {/* Terms and Conditions */}
                                <Form.Group className="mb-4 mt-4">
                                    <Form.Check>
                                        <Form.Check.Input 
                                            type="checkbox"
                                            checked={agreeTerms}
                                            onChange={(e) => {
                                                setAgreeTerms(e.target.checked);
                                                if (errors.agreeTerms) {
                                                    setErrors(prev => ({ ...prev, agreeTerms: null }));
                                                }
                                            }}
                                            isInvalid={!!errors.agreeTerms}
                                        />
                                        <Form.Check.Label className="ms-2">
                                            Saya menyetujui <Link to="/terms" className="text-primary">Syarat dan Ketentuan</Link> serta{' '}
                                            <Link to="/privacy" className="text-primary">Kebijakan Privasi</Link> yang berlaku
                                        </Form.Check.Label>
                                        <Form.Control.Feedback type="invalid">
                                            {errors.agreeTerms}
                                        </Form.Control.Feedback>
                                    </Form.Check>
                                </Form.Group>

                                {/* Submit Button */}
                                <div className="d-grid gap-3 mt-5">
                                    <Button 
                                        type="submit" 
                                        variant="primary" 
                                        size="lg"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" />
                                                Mendaftarkan...
                                            </>
                                        ) : (
                                            'Daftar Sekarang'
                                        )}
                                    </Button>
                                    
                                    <div className="text-center">
                                        <span className="text-muted">Sudah punya akun? </span>
                                        <Link to="/login" className="text-primary fw-bold">
                                            Login di sini
                                        </Link>
                                    </div>
                                </div>
                            </Form>
                        </Card.Body>
                        <Card.Footer className="bg-light text-center py-3">
                            <small className="text-muted">
                                Dengan mendaftar, Anda mendapatkan akses ke semua layanan:
                                Konsultasi Online, Farmasi, Surat Sakit, dan Janji Temu
                            </small>
                        </Card.Footer>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default Register;