import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaHeartbeat } from 'react-icons/fa';

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const success = await login(email, password);
            setLoading(false);
            if (success) navigate('/');
            else setError('Email atau password salah. Silakan coba lagi.');
        } catch (err) {
            setLoading(false);
            // Akun belum verifikasi → arahkan ke halaman register step OTP
            if (err?.response?.data?.needsVerification) {
                navigate('/register', { state: { step: 'otp', email: email } });
            } else {
                setError(err?.response?.data?.message || 'Email atau password salah. Silakan coba lagi.');
            }
        }
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            backgroundColor: '#f8f9fa',
            display: 'flex', 
            alignItems: 'center',
            padding: '0'
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
                * { font-family: 'Poppins', sans-serif !important; }
            `}</style>
            <Container fluid style={{ maxWidth: '500px' }}>
                <Row className="justify-content-center">
                    <Col xs={12}>
                        {/* Simple Header */}
                        <div className="text-center mb-4">
                            <h4 className="fw-bold mb-1" style={{ color: '#212529' }}>Selamat Datang</h4>
                            <p className="text-secondary mb-0">Silakan masuk ke akun Anda</p>
                        </div>

                        <Card className="border-0 shadow" style={{ borderRadius: '16px' }}>
                            <Card.Body className="p-5">
                                {error && (
                                    <Alert variant="danger" className="small py-2 mb-4">
                                        {error}
                                    </Alert>
                                )}

                                <Form onSubmit={handleSubmit}>
                                    <Form.Group className="mb-4">
                                        <Form.Label className="fw-medium text-secondary">Email</Form.Label>
                                        <InputGroup style={{ height: '52px' }}>
                                            <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '10px 0 0 10px' }}>
                                                <FaEnvelope className="text-secondary" size={16} />
                                            </InputGroup.Text>
                                            <Form.Control
                                                type="email"
                                                placeholder="nama@email.com"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                className="border-start-0 bg-white"
                                                style={{ 
                                                    fontSize: '1rem', 
                                                    height: '52px',
                                                    borderRadius: '0 10px 10px 0',
                                                    borderColor: '#dee2e6'
                                                }}
                                                required
                                                autoComplete="email"
                                            />
                                        </InputGroup>
                                        <div className="text-end mt-1">
                                            <Link to="/forgot-email" className="small text-decoration-none" style={{ color: '#0d6efd' }}>
                                                Lupa email?
                                            </Link>
                                        </div>
                                    </Form.Group>

                                    <Form.Group className="mb-4">
                                        <Form.Label className="fw-medium text-secondary mb-1">Password</Form.Label>
                                        <InputGroup style={{ height: '52px' }}>
                                            <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '10px 0 0 10px' }}>
                                                <FaLock className="text-secondary" size={16} />
                                            </InputGroup.Text>
                                            <Form.Control
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                className="border-start-0 border-end-0 bg-white"
                                                style={{ 
                                                    fontSize: '1rem', 
                                                    height: '52px',
                                                    borderColor: '#dee2e6'
                                                }}
                                                required
                                                autoComplete="current-password"
                                            />
                                            <Button
                                                variant="light"
                                                className="border bg-white"
                                                onClick={() => setShowPassword(!showPassword)}
                                                type="button"
                                                style={{ 
                                                    borderColor: '#dee2e6',
                                                    borderRadius: '0 10px 10px 0',
                                                    height: '52px',
                                                    width: '52px'
                                                }}
                                            >
                                                {showPassword ? 
                                                    <FaEyeSlash className="text-secondary" size={16} /> : 
                                                    <FaEye className="text-secondary" size={16} />
                                                }
                                            </Button>
                                        </InputGroup>
                                        <div className="text-end mt-1">
                                            <Link to="/forgot-password" className="small text-decoration-none" style={{ color: '#0d6efd' }}>
                                                Lupa password?
                                            </Link>
                                        </div>
                                    </Form.Group>

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        className="w-100 fw-medium mb-3"
                                        style={{ 
                                            backgroundColor: '#0d6efd',
                                            border: 'none',
                                            borderRadius: '10px',
                                            height: '52px',
                                            fontSize: '1rem'
                                        }}
                                        disabled={loading}
                                    >
                                        {loading ? 'Memproses...' : 'Masuk'}
                                    </Button>

                                    <div className="text-center">
                                        <span className="text-secondary">
                                            Belum punya akun?{' '}
                                            <Link to="/register" className="text-primary fw-medium text-decoration-none">
                                                Daftar
                                            </Link>
                                        </span>
                                    </div>
                                </Form>
                            </Card.Body>
                        </Card>

                        <p className="text-center text-secondary mt-4 mb-0" style={{ fontSize: '0.9rem' }}>
                            © {new Date().getFullYear()} Klinik Pratama IPB
                        </p>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default Login;