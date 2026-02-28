import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
    FaUser, 
    FaEnvelope, 
    FaLock, 
    FaPhone, 
    FaEye,
    FaEyeSlash,
    FaCheckCircle
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
        phone: ''
    });
    const [errors, setErrors] = useState({});
    const [agreeTerms, setAgreeTerms] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

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

        // Phone validation - Mendukung nomor internasional
        const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,10}[-\s.]?[0-9]{1,10}$/;
        if (!formData.phone) {
            newErrors.phone = 'Nomor telepon harus diisi';
        } else {
            // Remove all non-digit characters except leading +
            const cleanedPhone = formData.phone.replace(/[^\d+]/g, '');
            if (cleanedPhone.length < 8 || cleanedPhone.length > 15) {
                newErrors.phone = 'Nomor telepon harus 8-15 digit (termasuk kode negara)';
            }
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
            // Clean phone number before sending
            const cleanedPhone = formData.phone.replace(/[^\d+]/g, '');
            
            // Remove confirmPassword before sending
            const { confirmPassword, ...registerData } = {
                ...formData,
                phone: cleanedPhone
            };
            
            const success = await register(registerData);
            
            if (success) {
                navigate('/');
            }
        } catch (error) {
            console.error('Registration error:', error);
            setErrors({ submit: error.message || 'Terjadi kesalahan saat mendaftar' });
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
        
        if (score <= 2) return { score: 33, label: 'Lemah', variant: 'danger' };
        if (score <= 4) return { score: 66, label: 'Sedang', variant: 'warning' };
        return { score: 100, label: 'Kuat', variant: 'success' };
    };

    const passwordStrength = getPasswordStrength();

    return (
        <div style={{ 
            minHeight: '100vh', 
            backgroundColor: '#f8f9fa',
            display: 'flex', 
            alignItems: 'center',
            padding: '20px 0'
        }}>
            <Container fluid style={{ maxWidth: '500px' }}>
                <Row className="justify-content-center">
                    <Col xs={12}>
                        {/* Simple Header */}
                        <div className="text-center mb-4">
                            <div
                                className="bg-white shadow-sm rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                                style={{ width: 64, height: 64 }}
                            >
                                <FaUser size={28} color="#0d6efd" />
                            </div>
                            <h5 className="fw-bold mb-1" style={{ color: '#212529' }}>Buat Akun Baru</h5>
                            <p className="text-secondary small mb-0">Daftar untuk mengakses semua layanan</p>
                        </div>

                        <Card className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                            <Card.Body className="p-4">
                                {errors.submit && (
                                    <Alert variant="danger" className="small py-2 mb-4">
                                        {errors.submit}
                                    </Alert>
                                )}

                                <Form onSubmit={handleSubmit}>
                                    {/* Nama Lengkap */}
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-medium small text-secondary">Nama Lengkap</Form.Label>
                                        <InputGroup style={{ height: '48px' }}>
                                            <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '8px 0 0 8px' }}>
                                                <FaUser className="text-secondary" size={14} />
                                            </InputGroup.Text>
                                            <Form.Control
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                placeholder="Masukkan nama lengkap"
                                                className="border-start-0 bg-white"
                                                style={{ 
                                                    fontSize: '0.95rem',
                                                    height: '48px',
                                                    borderRadius: '0 8px 8px 0',
                                                    borderColor: '#dee2e6'
                                                }}
                                                isInvalid={!!errors.name}
                                            />
                                            {formData.name && formData.name.length >= 3 && !errors.name && (
                                                <InputGroup.Text className="bg-white border-start-0" style={{ borderRadius: '0 8px 8px 0' }}>
                                                    <FaCheckCircle className="text-success" size={14} />
                                                </InputGroup.Text>
                                            )}
                                        </InputGroup>
                                        <Form.Control.Feedback type="invalid">
                                            {errors.name}
                                        </Form.Control.Feedback>
                                    </Form.Group>

                                    {/* Email */}
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-medium small text-secondary">Email</Form.Label>
                                        <InputGroup style={{ height: '48px' }}>
                                            <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '8px 0 0 8px' }}>
                                                <FaEnvelope className="text-secondary" size={14} />
                                            </InputGroup.Text>
                                            <Form.Control
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                placeholder="nama@email.com"
                                                className="border-start-0 bg-white"
                                                style={{ 
                                                    fontSize: '0.95rem',
                                                    height: '48px',
                                                    borderRadius: '0 8px 8px 0',
                                                    borderColor: '#dee2e6'
                                                }}
                                                isInvalid={!!errors.email}
                                            />
                                        </InputGroup>
                                        <Form.Control.Feedback type="invalid">
                                            {errors.email}
                                        </Form.Control.Feedback>
                                    </Form.Group>

                                    {/* Nomor Telepon */}
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-medium small text-secondary">Nomor Telepon</Form.Label>
                                        <InputGroup style={{ height: '48px' }}>
                                            <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '8px 0 0 8px' }}>
                                                <FaPhone className="text-secondary" size={14} />
                                            </InputGroup.Text>
                                            <Form.Control
                                                type="tel"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                placeholder="+6281234567890 atau 081234567890"
                                                className="border-start-0 bg-white"
                                                style={{ 
                                                    fontSize: '0.95rem',
                                                    height: '48px',
                                                    borderRadius: '0 8px 8px 0',
                                                    borderColor: '#dee2e6'
                                                }}
                                                isInvalid={!!errors.phone}
                                            />
                                        </InputGroup>
                                        <Form.Control.Feedback type="invalid">
                                            {errors.phone}
                                        </Form.Control.Feedback>
                                        <Form.Text className="text-muted small">
                                            Gunakan format internasional: +62xxx atau 08xxx
                                        </Form.Text>
                                    </Form.Group>

                                    {/* Password */}
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-medium small text-secondary">Password</Form.Label>
                                        <InputGroup style={{ height: '48px' }}>
                                            <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '8px 0 0 8px' }}>
                                                <FaLock className="text-secondary" size={14} />
                                            </InputGroup.Text>
                                            <Form.Control
                                                type={showPassword ? "text" : "password"}
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                placeholder="Minimal 6 karakter, mengandung angka"
                                                className="border-start-0 border-end-0 bg-white"
                                                style={{ 
                                                    fontSize: '0.95rem',
                                                    height: '48px',
                                                    borderColor: '#dee2e6'
                                                }}
                                                isInvalid={!!errors.password}
                                            />
                                            <Button
                                                variant="light"
                                                className="border bg-white"
                                                onClick={() => setShowPassword(!showPassword)}
                                                type="button"
                                                style={{ 
                                                    borderColor: '#dee2e6',
                                                    borderRadius: '0 8px 8px 0',
                                                    height: '48px',
                                                    width: '48px'
                                                }}
                                            >
                                                {showPassword ? 
                                                    <FaEyeSlash className="text-secondary" size={14} /> : 
                                                    <FaEye className="text-secondary" size={14} />
                                                }
                                            </Button>
                                        </InputGroup>
                                        <Form.Control.Feedback type="invalid">
                                            {errors.password}
                                        </Form.Control.Feedback>
                                        
                                        {formData.password && (
                                            <div className="mt-2">
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <small className="text-muted">Kekuatan password:</small>
                                                    <small className={`text-${passwordStrength.variant} fw-bold`}>
                                                        {passwordStrength.label}
                                                    </small>
                                                </div>
                                                <div className="progress" style={{ height: '4px' }}>
                                                    <div 
                                                        className={`progress-bar bg-${passwordStrength.variant}`}
                                                        style={{ width: `${passwordStrength.score}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </Form.Group>

                                    {/* Konfirmasi Password */}
                                    <Form.Group className="mb-4">
                                        <Form.Label className="fw-medium small text-secondary">Konfirmasi Password</Form.Label>
                                        <InputGroup style={{ height: '48px' }}>
                                            <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '8px 0 0 8px' }}>
                                                <FaLock className="text-secondary" size={14} />
                                            </InputGroup.Text>
                                            <Form.Control
                                                type={showConfirmPassword ? "text" : "password"}
                                                name="confirmPassword"
                                                value={formData.confirmPassword}
                                                onChange={handleChange}
                                                placeholder="Ulangi password"
                                                className="border-start-0 border-end-0 bg-white"
                                                style={{ 
                                                    fontSize: '0.95rem',
                                                    height: '48px',
                                                    borderColor: '#dee2e6'
                                                }}
                                                isInvalid={!!errors.confirmPassword}
                                            />
                                            <Button
                                                variant="light"
                                                className="border bg-white"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                type="button"
                                                style={{ 
                                                    borderColor: '#dee2e6',
                                                    borderRadius: '0 8px 8px 0',
                                                    height: '48px',
                                                    width: '48px'
                                                }}
                                            >
                                                {showConfirmPassword ? 
                                                    <FaEyeSlash className="text-secondary" size={14} /> : 
                                                    <FaEye className="text-secondary" size={14} />
                                                }
                                            </Button>
                                        </InputGroup>
                                        <Form.Control.Feedback type="invalid">
                                            {errors.confirmPassword}
                                        </Form.Control.Feedback>
                                        {formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && (
                                            <Form.Text className="text-success small">
                                                <FaCheckCircle className="me-1" />
                                                Password cocok
                                            </Form.Text>
                                        )}
                                    </Form.Group>

                                    {/* Terms and Conditions */}
                                    <Form.Group className="mb-4">
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
                                            <Form.Check.Label className="small">
                                                Saya menyetujui <Link to="/terms" className="text-primary text-decoration-none">Syarat dan Ketentuan</Link> yang berlaku
                                            </Form.Check.Label>
                                            <Form.Control.Feedback type="invalid">
                                                {errors.agreeTerms}
                                            </Form.Control.Feedback>
                                        </Form.Check>
                                    </Form.Group>

                                    {/* Submit Button */}
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        className="w-100 fw-medium mb-3"
                                        style={{ 
                                            backgroundColor: '#0d6efd',
                                            border: 'none',
                                            borderRadius: '8px',
                                            height: '48px',
                                            fontSize: '0.95rem'
                                        }}
                                        disabled={loading}
                                    >
                                        {loading ? 'Memproses...' : 'Daftar'}
                                    </Button>

                                    <div className="text-center">
                                        <span className="text-secondary small">
                                            Sudah punya akun?{' '}
                                            <Link to="/login" className="text-primary fw-medium text-decoration-none">
                                                Masuk
                                            </Link>
                                        </span>
                                    </div>
                                </Form>
                            </Card.Body>
                        </Card>

                        <p className="text-center text-secondary small mt-4 mb-0">
                            © {new Date().getFullYear()} Klinik Pratama IPB
                        </p>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default Register;