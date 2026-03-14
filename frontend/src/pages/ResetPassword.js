import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup, Spinner } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FaLock, FaEye, FaEyeSlash, FaArrowLeft, FaCheckCircle, FaTimesCircle, FaHeartbeat } from 'react-icons/fa';
import api from '../utils/api';

const ResetPassword = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    const [validating, setValidating] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [userName, setUserName] = useState('');
    const [tokenError, setTokenError] = useState('');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    // Validasi token saat halaman dimuat
    useEffect(() => {
        const validateToken = async () => {
            if (!token || !email) {
                setTokenError('Link tidak valid. Silakan minta link reset password baru.');
                setValidating(false);
                return;
            }

            try {
                const res = await api.get('/api/auth/reset-password/validate', {
                    params: { token, email }
                });
                setTokenValid(true);
                setUserName(res.data.name);
            } catch (err) {
                setTokenError(
                    err.response?.data?.message ||
                    'Link tidak valid atau sudah kedaluwarsa. Silakan minta link baru.'
                );
            } finally {
                setValidating(false);
            }
        };

        validateToken();
    }, [token, email]);

    // Kekuatan password
    const getPasswordStrength = (pwd) => {
        if (!pwd) return null;
        const hasUpper   = /[A-Z]/.test(pwd);
        const hasLower   = /[a-z]/.test(pwd);
        const hasNum     = /[0-9]/.test(pwd);
        const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
        const long       = pwd.length >= 8;
        const score = [hasUpper, hasLower, hasNum, hasSpecial, long].filter(Boolean).length;
        if (score <= 2) return { label: 'Lemah',       color: '#dc3545', width: '25%'  };
        if (score === 3) return { label: 'Sedang',      color: '#fd7e14', width: '50%'  };
        if (score === 4) return { label: 'Kuat',        color: '#20c997', width: '75%'  };
        return              { label: 'Sangat Kuat', color: '#198754', width: '100%' };
    };

    // Cek per-syarat untuk ditampilkan sebagai checklist
    const pwdRules = password ? [
        { ok: password.length >= 8,    text: 'Minimal 8 karakter'  },
        { ok: /[A-Z]/.test(password),  text: 'Huruf besar (A-Z)'   },
        { ok: /[a-z]/.test(password),  text: 'Huruf kecil (a-z)'   },
        { ok: /[0-9]/.test(password),  text: 'Angka (0-9)'          },
    ] : [];

    const strength = getPasswordStrength(password);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Konfirmasi password tidak cocok.');
            return;
        }

        if (password.length < 8) {
            setError('Password minimal 8 karakter.');
            return;
        }
        if (!/[A-Z]/.test(password)) {
            setError('Password harus mengandung minimal 1 huruf besar (A-Z).');
            return;
        }
        if (!/[a-z]/.test(password)) {
            setError('Password harus mengandung minimal 1 huruf kecil (a-z).');
            return;
        }
        if (!/[0-9]/.test(password)) {
            setError('Password harus mengandung minimal 1 angka (0-9).');
            return;
        }

        setLoading(true);

        try {
            await api.post('/api/auth/reset-password', {
                token,
                email,
                password,
                confirmPassword
            });
            setSuccess(true);
            setTimeout(() => navigate('/login'), 4000);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                'Gagal mereset password. Silakan coba lagi.'
            );
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        fontSize: '1rem',
        height: '52px',
        borderColor: '#dee2e6'
    };

    // ── Loading state ─────────────────────────────────────────────────────────
    if (validating) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
                <div className="text-center">
                    <Spinner animation="border" variant="primary" style={{ width: 48, height: 48 }} />
                    <p className="text-secondary mt-3">Memvalidasi link reset password...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f8f9fa',
            display: 'flex',
            alignItems: 'center',
            padding: '0'
        }}>
            <Container fluid style={{ maxWidth: '500px' }}>
                <Row className="justify-content-center">
                    <Col xs={12}>
                        <div className="text-center mb-4">
                            <div style={{
                                width: 56, height: 56,
                                background: tokenValid
                                    ? 'linear-gradient(135deg, #0d6efd, #0a58ca)'
                                    : 'linear-gradient(135deg, #dc3545, #b02a37)',
                                borderRadius: '16px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 12
                            }}>
                                {tokenValid
                                    ? <FaHeartbeat color="#fff" size={24} />
                                    : <FaTimesCircle color="#fff" size={24} />
                                }
                            </div>
                            <h4 className="fw-bold mb-1" style={{ color: '#212529' }}>
                                {tokenValid ? 'Buat Password Baru' : 'Link Tidak Valid'}
                            </h4>
                            <p className="text-secondary mb-0">
                                {tokenValid
                                    ? `Halo ${userName}, silakan buat password baru Anda`
                                    : 'Link reset password tidak dapat digunakan'
                                }
                            </p>
                        </div>

                        <Card className="border-0 shadow" style={{ borderRadius: '16px' }}>
                            <Card.Body className="p-5">

                                {/* ── Token tidak valid ──────────────────────────── */}
                                {!tokenValid && (
                                    <div className="text-center py-2">
                                        <div style={{
                                            width: 64, height: 64,
                                            background: '#fee2e2',
                                            borderRadius: '50%',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: 16
                                        }}>
                                            <FaTimesCircle size={30} color="#dc3545" />
                                        </div>
                                        <Alert variant="danger" className="text-start small">
                                            {tokenError}
                                        </Alert>
                                        <Link to="/forgot-password">
                                            <Button
                                                variant="primary"
                                                className="w-100 fw-medium"
                                                style={{ borderRadius: '10px', height: '48px' }}
                                            >
                                                Minta Link Reset Baru
                                            </Button>
                                        </Link>
                                    </div>
                                )}

                                {/* ── Berhasil reset ─────────────────────────────── */}
                                {tokenValid && success && (
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
                                        <h5 className="fw-bold mb-2">Password Berhasil Diubah!</h5>
                                        <p className="text-secondary mb-4" style={{ fontSize: '0.95rem' }}>
                                            Password Anda telah berhasil diperbarui. Anda akan diarahkan ke halaman login dalam beberapa detik...
                                        </p>
                                        <Link to="/login">
                                            <Button
                                                variant="primary"
                                                className="w-100 fw-medium"
                                                style={{ borderRadius: '10px', height: '48px' }}
                                            >
                                                Login Sekarang
                                            </Button>
                                        </Link>
                                    </div>
                                )}

                                {/* ── Form reset password ─────────────────────────── */}
                                {tokenValid && !success && (
                                    <>
                                        {error && (
                                            <Alert variant="danger" className="small py-2 mb-4">
                                                {error}
                                            </Alert>
                                        )}

                                        <Form onSubmit={handleSubmit}>
                                            {/* Password baru */}
                                            <Form.Group className="mb-3">
                                                <Form.Label className="fw-medium text-secondary">Password Baru</Form.Label>
                                                <InputGroup style={{ height: '52px' }}>
                                                    <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '10px 0 0 10px' }}>
                                                        <FaLock className="text-secondary" size={16} />
                                                    </InputGroup.Text>
                                                    <Form.Control
                                                        type={showPassword ? 'text' : 'password'}
                                                        placeholder="Min. 8 karakter, huruf besar, kecil, angka"
                                                        value={password}
                                                        onChange={e => setPassword(e.target.value)}
                                                        className="border-start-0 border-end-0 bg-white"
                                                        style={{ ...inputStyle, borderRadius: 0 }}
                                                        required
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
                                                        {showPassword
                                                            ? <FaEyeSlash className="text-secondary" size={16} />
                                                            : <FaEye className="text-secondary" size={16} />
                                                        }
                                                    </Button>
                                                </InputGroup>

                                                {/* Indikator kekuatan + checklist syarat */}
                                                {password && (
                                                    <div className="mt-2">
                                                        <div style={{ height: 4, background: '#e9ecef', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                                                            <div style={{
                                                                height: '100%',
                                                                width: strength?.width || '0%',
                                                                background: strength?.color || '#e9ecef',
                                                                borderRadius: 4,
                                                                transition: 'width 0.3s ease'
                                                            }} />
                                                        </div>
                                                        <div className="d-flex flex-wrap gap-2">
                                                            {pwdRules.map((r, i) => (
                                                                <small key={i} style={{
                                                                    color: r.ok ? '#198754' : '#dc3545',
                                                                    fontSize: '0.75rem',
                                                                    display: 'flex', alignItems: 'center', gap: 3
                                                                }}>
                                                                    {r.ok ? '✓' : '✗'} {r.text}
                                                                </small>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </Form.Group>

                                            {/* Konfirmasi password */}
                                            <Form.Group className="mb-4">
                                                <Form.Label className="fw-medium text-secondary">Konfirmasi Password</Form.Label>
                                                <InputGroup style={{ height: '52px' }}>
                                                    <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '10px 0 0 10px' }}>
                                                        <FaLock className="text-secondary" size={16} />
                                                    </InputGroup.Text>
                                                    <Form.Control
                                                        type={showConfirm ? 'text' : 'password'}
                                                        placeholder="Ulangi password baru"
                                                        value={confirmPassword}
                                                        onChange={e => setConfirmPassword(e.target.value)}
                                                        className="border-start-0 border-end-0 bg-white"
                                                        style={{
                                                            ...inputStyle,
                                                            borderRadius: 0,
                                                            borderColor: confirmPassword && password !== confirmPassword ? '#dc3545' : '#dee2e6'
                                                        }}
                                                        required
                                                    />
                                                    <Button
                                                        variant="light"
                                                        className="border bg-white"
                                                        onClick={() => setShowConfirm(!showConfirm)}
                                                        type="button"
                                                        style={{
                                                            borderColor: confirmPassword && password !== confirmPassword ? '#dc3545' : '#dee2e6',
                                                            borderRadius: '0 10px 10px 0',
                                                            height: '52px',
                                                            width: '52px'
                                                        }}
                                                    >
                                                        {showConfirm
                                                            ? <FaEyeSlash className="text-secondary" size={16} />
                                                            : <FaEye className="text-secondary" size={16} />
                                                        }
                                                    </Button>
                                                </InputGroup>
                                                {confirmPassword && password !== confirmPassword && (
                                                    <small className="text-danger" style={{ fontSize: '0.78rem' }}>
                                                        Password tidak cocok
                                                    </small>
                                                )}
                                                {confirmPassword && password === confirmPassword && confirmPassword.length >= 6 && (
                                                    <small className="text-success" style={{ fontSize: '0.78rem' }}>
                                                        ✓ Password cocok
                                                    </small>
                                                )}
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
                                                {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
                                            </Button>
                                        </Form>
                                    </>
                                )}

                                {!success && (
                                    <div className="text-center mt-2">
                                        <Link
                                            to="/login"
                                            className="text-secondary text-decoration-none small d-inline-flex align-items-center gap-1"
                                        >
                                            <FaArrowLeft size={12} /> Kembali ke halaman Login
                                        </Link>
                                    </div>
                                )}
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

export default ResetPassword;