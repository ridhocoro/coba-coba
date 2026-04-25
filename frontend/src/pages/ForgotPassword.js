import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { 
    FaEnvelope, 
    FaArrowLeft, 
    FaCheckCircle, 
    FaKey,           // Ganti dengan icon kunci (lebih sesuai untuk lupa password)
    FaEnvelopeOpenText,  // Alternatif: amplop terbuka dengan teks
    FaQuestionCircle,    // Alternatif: tanda tanya
    FaLock              // Alternatif: gembok
} from 'react-icons/fa';
import api from '../utils/api';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.post('/api/auth/forgot-password', { email });
            setSuccess(true);
        } catch (err) {
            const msg = err.response?.data?.message || 'Terjadi kesalahan. Silakan coba lagi.';
            setError(msg);
        } finally {
            setLoading(false);
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
                        <div className="text-center mb-4">
                            <div style={{
                                width: 56, height: 56,
                                background: 'linear-gradient(135deg, #0d6efd, #0a58ca)',
                                borderRadius: '16px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 12
                            }}>
                                {/* GANTI ICON HEART DENGAN ICON KUNCI */}
                                <FaKey color="#fff" size={24} />
                            </div>
                            <h4 className="fw-bold mb-1" style={{ color: '#212529' }}>Lupa Password</h4>
                            <p className="text-secondary mb-0">
                                Masukkan email Anda untuk mendapatkan link reset password
                            </p>
                        </div>

                        <Card className="border-0 shadow" style={{ borderRadius: '16px' }}>
                            <Card.Body className="p-5">
                                {success ? (
                                    <div className="text-center py-2">
                                        <div style={{
                                            width: 64, height: 64,
                                            background: '#d1fae5',
                                            borderRadius: '50%',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: 16
                                        }}>
                                            <FaCheckCircle size={30} color="#059669" />
                                        </div>
                                        <h5 className="fw-bold mb-2">Email Terkirim!</h5>
                                        <p className="text-secondary mb-1" style={{ fontSize: '0.95rem' }}>
                                            Kami telah mengirim link reset password ke:
                                        </p>
                                        <p className="fw-semibold text-primary mb-3">{email}</p>
                                        <Alert variant="warning" className="text-start small py-2 mb-4">
                                            <strong>Perhatian:</strong>
                                            <ul className="mb-0 mt-1 ps-3">
                                                <li>Link berlaku selama <strong>15 menit</strong></li>
                                                <li>Link hanya bisa digunakan <strong>satu kali</strong></li>
                                                <li>Periksa folder <strong>Spam/Junk</strong> jika tidak ada di Inbox</li>
                                            </ul>
                                        </Alert>
                                        <Button
                                            variant="outline-secondary"
                                            className="w-100"
                                            style={{ borderRadius: '10px', height: '48px' }}
                                            onClick={() => { setSuccess(false); setEmail(''); }}
                                        >
                                            Kirim Ulang ke Email Lain
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        {error && (
                                            <Alert variant="danger" className="small py-2 mb-4">
                                                {error}
                                            </Alert>
                                        )}

                                        <Form onSubmit={handleSubmit}>
                                            <Form.Group className="mb-4">
                                                <Form.Label className="fw-medium text-secondary">
                                                    Alamat Email
                                                </Form.Label>
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
                                                <Form.Text className="text-muted">
                                                    Gunakan email yang terdaftar di akun Anda.
                                                </Form.Text>
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
                                                {loading ? 'Mengirim...' : 'Kirim Link Reset Password'}
                                            </Button>
                                        </Form>
                                    </>
                                )}

                                <div className="text-center mt-2">
                                    <Link
                                        to="/login"
                                        className="text-secondary text-decoration-none small d-inline-flex align-items-center gap-1"
                                    >
                                        <FaArrowLeft size={12} /> Kembali ke halaman Login
                                    </Link>
                                </div>
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

export default ForgotPassword;