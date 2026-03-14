import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
    FaUser, FaEnvelope, FaLock, FaPhone,
    FaEye, FaEyeSlash, FaCheckCircle,
    FaShieldAlt, FaPaperPlane, FaRedo,
} from 'react-icons/fa';

// ─── Konstanta ────────────────────────────────────────────────────────────────
const RESEND_COOLDOWN = 60; // detik

const Register = () => {
    const navigate  = useNavigate();
    const { register } = useAuth();

    // ── Form state ──────────────────────────────────────────────────────────
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', confirmPassword: '', phone: '',
    });
    const [errors,    setErrors]    = useState({});
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [showPw,    setShowPw]    = useState(false);
    const [showCpw,   setShowCpw]   = useState(false);
    const [loading,   setLoading]   = useState(false);

    // ── OTP state ────────────────────────────────────────────────────────────
    const [otpStep,     setOtpStep]     = useState(false);   // false = form, true = OTP input
    const [otp,         setOtp]         = useState(['', '', '', '', '', '']);
    const [otpSending,  setOtpSending]  = useState(false);
    const [otpError,    setOtpError]    = useState('');
    const [countdown,   setCountdown]   = useState(0);       // detik sisa cooldown
    const [attemptsLeft, setAttemptsLeft] = useState(5);

    const otpRefs = useRef([]);
    const countdownRef = useRef(null);

    // ── Countdown timer ─────────────────────────────────────────────────────
    useEffect(() => {
        return () => clearInterval(countdownRef.current);
    }, []);

    const startCountdown = (seconds = RESEND_COOLDOWN) => {
        setCountdown(seconds);
        clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    // ── Helpers ─────────────────────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    };

    const validateForm = () => {
        const e = {};
        if (!formData.name.trim() || formData.name.trim().length < 3)
            e.name = 'Nama minimal 3 karakter';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
            e.email = 'Format email tidak valid';
        if (formData.password.length < 6)
            e.password = 'Password minimal 6 karakter';
        else if (!/[0-9]/.test(formData.password))
            e.password = 'Password harus mengandung angka';
        if (formData.password !== formData.confirmPassword)
            e.confirmPassword = 'Password tidak cocok';
        const phone = formData.phone.replace(/[^\d+]/g, '');
        if (phone.length < 8 || phone.length > 15)
            e.phone = 'Nomor telepon 8–15 digit';
        if (!agreeTerms)
            e.agreeTerms = 'Anda harus menyetujui syarat dan ketentuan';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // ── Kirim OTP ────────────────────────────────────────────────────────────
    const sendOtp = async () => {
        if (!validateForm()) return;
        setOtpSending(true);
        setOtpError('');
        try {
            await api.post('/api/auth/send-otp', { email: formData.email });
            setOtpStep(true);
            setOtp(['', '', '', '', '', '']);
            setAttemptsLeft(5);
            startCountdown();
            // Fokus ke kotak OTP pertama setelah render
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } catch (err) {
            const msg = err.response?.data?.message || 'Gagal mengirim OTP.';
            const sec = err.response?.data?.secondsLeft;
            if (sec) startCountdown(sec);
            setOtpError(msg);
        } finally {
            setOtpSending(false);
        }
    };

    // ── Kirim ulang OTP ──────────────────────────────────────────────────────
    const resendOtp = async () => {
        if (countdown > 0) return;
        setOtpSending(true);
        setOtpError('');
        try {
            await api.post('/api/auth/send-otp', { email: formData.email });
            setOtp(['', '', '', '', '', '']);
            setAttemptsLeft(5);
            startCountdown();
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } catch (err) {
            const msg = err.response?.data?.message || 'Gagal kirim ulang OTP.';
            const sec = err.response?.data?.secondsLeft;
            if (sec) startCountdown(sec);
            setOtpError(msg);
        } finally {
            setOtpSending(false);
        }
    };

    // ── Handle input OTP per kotak ───────────────────────────────────────────
    const handleOtpChange = (idx, val) => {
        // Hanya angka
        const digit = val.replace(/\D/g, '').slice(-1);
        const next  = [...otp];
        next[idx] = digit;
        setOtp(next);
        setOtpError('');
        // Auto fokus ke kotak berikutnya
        if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
    };

    const handleOtpKeyDown = (idx, e) => {
        if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
            otpRefs.current[idx - 1]?.focus();
        }
        // Paste support
        if (e.key === 'v' && (e.ctrlKey || e.metaKey)) return;
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        const next = [...otp];
        pasted.split('').forEach((d, i) => { if (i < 6) next[i] = d; });
        setOtp(next);
        const lastIdx = Math.min(pasted.length, 5);
        otpRefs.current[lastIdx]?.focus();
    };

    // ── Submit register dengan OTP ───────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        const otpString = otp.join('');
        if (otpString.length < 6) {
            setOtpError('Masukkan 6 digit kode OTP');
            return;
        }
        setLoading(true);
        setOtpError('');
        try {
            const cleanPhone = formData.phone.replace(/[^\d+]/g, '');
            const success = await register({
                name    : formData.name.trim(),
                email   : formData.email,
                password: formData.password,
                phone   : cleanPhone,
                otp     : otpString,
            });
            if (success) navigate('/');
        } catch (error) {
            const msg = error.response?.data?.message || error.message || 'Terjadi kesalahan.';
            const left = error.response?.data?.attemptsLeft;
            if (left !== undefined) setAttemptsLeft(left);
            if (left === 0 || msg.toLowerCase().includes('kedaluwarsa') || msg.toLowerCase().includes('hangus')) {
                // OTP hangus, kembalikan ke form
                setOtpStep(false);
                setOtp(['', '', '', '', '', '']);
            }
            setOtpError(msg);
        } finally {
            setLoading(false);
        }
    };

    // ── Password strength ────────────────────────────────────────────────────
    const pwStrength = (() => {
        const p = formData.password;
        if (!p) return { score: 0, label: '', variant: 'secondary' };
        let s = 0;
        if (p.length >= 6) s++;
        if (p.length >= 8) s++;
        if (/[0-9]/.test(p)) s++;
        if (/[a-z]/.test(p)) s++;
        if (/[A-Z]/.test(p)) s++;
        if (s <= 2) return { score: 33,  label: 'Lemah',  variant: 'danger'  };
        if (s <= 4) return { score: 66,  label: 'Sedang', variant: 'warning' };
        return             { score: 100, label: 'Kuat',   variant: 'success' };
    })();

    const isIPBEmail = formData.email.toLowerCase().endsWith('@apps.ipb.ac.id');

    // ────────────────────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', padding: '20px 0' }}>
            <Container fluid style={{ maxWidth: '500px' }}>
                <Row className="justify-content-center">
                    <Col xs={12}>
                        {/* Header */}
                        <div className="text-center mb-4">
                            <div className="bg-white shadow-sm rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                                style={{ width: 64, height: 64 }}>
                                <FaUser size={28} color="#0d6efd" />
                            </div>
                            <h5 className="fw-bold mb-1">Buat Akun Baru</h5>
                            <p className="text-secondary small mb-0">Daftar untuk mengakses semua layanan</p>
                        </div>

                        <Card className="border-0 shadow-sm" style={{ borderRadius: 12 }}>
                            <Card.Body className="p-4">

                                {/* ═══════════════════════════════════════════
                                    STEP 1 — Formulir pendaftaran
                                ═══════════════════════════════════════════ */}
                                {!otpStep && (
                                    <>
                                        {errors.submit && <Alert variant="danger" className="small py-2 mb-3">{errors.submit}</Alert>}

                                        {/* Nama */}
                                        <Form.Group className="mb-3">
                                            <Form.Label className="fw-medium small text-secondary">Nama Lengkap</Form.Label>
                                            <InputGroup style={{ height: 48 }}>
                                                <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '8px 0 0 8px' }}>
                                                    <FaUser className="text-secondary" size={14} />
                                                </InputGroup.Text>
                                                <Form.Control type="text" name="name" value={formData.name}
                                                    onChange={handleChange} placeholder="Masukkan nama lengkap"
                                                    className="border-start-0 bg-white"
                                                    style={{ height: 48, borderRadius: '0 8px 8px 0' }}
                                                    isInvalid={!!errors.name} />
                                                {formData.name.trim().length >= 3 && !errors.name && (
                                                    <InputGroup.Text className="bg-white border-start-0" style={{ borderRadius: '0 8px 8px 0' }}>
                                                        <FaCheckCircle className="text-success" size={14} />
                                                    </InputGroup.Text>
                                                )}
                                                <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
                                            </InputGroup>
                                        </Form.Group>

                                        {/* Email */}
                                        <Form.Group className="mb-3">
                                            <Form.Label className="fw-medium small text-secondary">Email</Form.Label>
                                            <InputGroup style={{ height: 48 }}>
                                                <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '8px 0 0 8px' }}>
                                                    <FaEnvelope className="text-secondary" size={14} />
                                                </InputGroup.Text>
                                                <Form.Control type="email" name="email" value={formData.email}
                                                    onChange={handleChange} placeholder="nama@email.com"
                                                    className="border-start-0 bg-white"
                                                    style={{ height: 48, borderRadius: '0 8px 8px 0' }}
                                                    isInvalid={!!errors.email} />
                                                <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                                            </InputGroup>
                                            {isIPBEmail && (
                                                <div style={{ background: '#ede9fe', borderRadius: 6, padding: '6px 10px', marginTop: 6, fontSize: 12, color: '#5b21b6', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    🎓 Email mahasiswa IPB terdeteksi — harga obat gratis!
                                                </div>
                                            )}
                                        </Form.Group>

                                        {/* Telepon */}
                                        <Form.Group className="mb-3">
                                            <Form.Label className="fw-medium small text-secondary">Nomor Telepon</Form.Label>
                                            <InputGroup style={{ height: 48 }}>
                                                <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '8px 0 0 8px' }}>
                                                    <FaPhone className="text-secondary" size={14} />
                                                </InputGroup.Text>
                                                <Form.Control type="tel" name="phone" value={formData.phone}
                                                    onChange={handleChange} placeholder="08xxx atau +628xxx"
                                                    className="border-start-0 bg-white"
                                                    style={{ height: 48, borderRadius: '0 8px 8px 0' }}
                                                    isInvalid={!!errors.phone} />
                                                <Form.Control.Feedback type="invalid">{errors.phone}</Form.Control.Feedback>
                                            </InputGroup>
                                        </Form.Group>

                                        {/* Password */}
                                        <Form.Group className="mb-3">
                                            <Form.Label className="fw-medium small text-secondary">Password</Form.Label>
                                            <InputGroup style={{ height: 48 }}>
                                                <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '8px 0 0 8px' }}>
                                                    <FaLock className="text-secondary" size={14} />
                                                </InputGroup.Text>
                                                <Form.Control type={showPw ? 'text' : 'password'} name="password"
                                                    value={formData.password} onChange={handleChange}
                                                    placeholder="Min. 6 karakter, ada angka"
                                                    className="border-start-0 border-end-0 bg-white"
                                                    style={{ height: 48 }} isInvalid={!!errors.password} />
                                                <Button variant="light" className="border bg-white" type="button"
                                                    onClick={() => setShowPw(v => !v)}
                                                    style={{ borderRadius: '0 8px 8px 0', height: 48, width: 48 }}>
                                                    {showPw ? <FaEyeSlash size={14} className="text-secondary" /> : <FaEye size={14} className="text-secondary" />}
                                                </Button>
                                            </InputGroup>
                                            <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
                                            {formData.password && (
                                                <div className="mt-2">
                                                    <div className="d-flex justify-content-between mb-1">
                                                        <small className="text-muted">Kekuatan:</small>
                                                        <small className={`text-${pwStrength.variant} fw-bold`}>{pwStrength.label}</small>
                                                    </div>
                                                    <div className="progress" style={{ height: 4 }}>
                                                        <div className={`progress-bar bg-${pwStrength.variant}`} style={{ width: `${pwStrength.score}%` }} />
                                                    </div>
                                                </div>
                                            )}
                                        </Form.Group>

                                        {/* Konfirmasi Password */}
                                        <Form.Group className="mb-4">
                                            <Form.Label className="fw-medium small text-secondary">Konfirmasi Password</Form.Label>
                                            <InputGroup style={{ height: 48 }}>
                                                <InputGroup.Text className="bg-white border-end-0" style={{ borderRadius: '8px 0 0 8px' }}>
                                                    <FaLock className="text-secondary" size={14} />
                                                </InputGroup.Text>
                                                <Form.Control type={showCpw ? 'text' : 'password'} name="confirmPassword"
                                                    value={formData.confirmPassword} onChange={handleChange}
                                                    placeholder="Ulangi password"
                                                    className="border-start-0 border-end-0 bg-white"
                                                    style={{ height: 48 }} isInvalid={!!errors.confirmPassword} />
                                                <Button variant="light" className="border bg-white" type="button"
                                                    onClick={() => setShowCpw(v => !v)}
                                                    style={{ borderRadius: '0 8px 8px 0', height: 48, width: 48 }}>
                                                    {showCpw ? <FaEyeSlash size={14} className="text-secondary" /> : <FaEye size={14} className="text-secondary" />}
                                                </Button>
                                            </InputGroup>
                                            <Form.Control.Feedback type="invalid">{errors.confirmPassword}</Form.Control.Feedback>
                                            {formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && (
                                                <Form.Text className="text-success small"><FaCheckCircle className="me-1" />Password cocok</Form.Text>
                                            )}
                                        </Form.Group>

                                        {/* Syarat */}
                                        <Form.Group className="mb-4">
                                            <Form.Check>
                                                <Form.Check.Input type="checkbox" checked={agreeTerms}
                                                    onChange={e => { setAgreeTerms(e.target.checked); if (errors.agreeTerms) setErrors(p => ({ ...p, agreeTerms: null })); }}
                                                    isInvalid={!!errors.agreeTerms} />
                                                <Form.Check.Label className="small">
                                                    Saya menyetujui <Link to="/terms" className="text-primary text-decoration-none">Syarat dan Ketentuan</Link>
                                                </Form.Check.Label>
                                                <Form.Control.Feedback type="invalid">{errors.agreeTerms}</Form.Control.Feedback>
                                            </Form.Check>
                                        </Form.Group>

                                        {/* Tombol Kirim OTP */}
                                        <Button variant="primary" className="w-100 fw-medium mb-3"
                                            style={{ borderRadius: 8, height: 48, fontSize: '0.95rem' }}
                                            onClick={sendOtp} disabled={otpSending}>
                                            {otpSending
                                                ? 'Mengirim OTP...'
                                                : <><FaPaperPlane className="me-2" />Kirim Kode OTP ke Email</>}
                                        </Button>

                                        <div className="text-center">
                                            <span className="text-secondary small">
                                                Sudah punya akun?{' '}
                                                <Link to="/login" className="text-primary fw-medium text-decoration-none">Masuk</Link>
                                            </span>
                                        </div>
                                    </>
                                )}

                                {/* ═══════════════════════════════════════════
                                    STEP 2 — Input OTP
                                ═══════════════════════════════════════════ */}
                                {otpStep && (
                                    <Form onSubmit={handleSubmit}>
                                        {/* Ikon & Judul */}
                                        <div className="text-center mb-4">
                                            <div style={{ width: 56, height: 56, background: '#dbeafe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                                <FaShieldAlt size={24} color="#2563eb" />
                                            </div>
                                            <h6 className="fw-bold mb-1">Masukkan Kode OTP</h6>
                                            <p className="text-secondary small mb-0">
                                                Kode 6 digit telah dikirim ke<br />
                                                <strong className="text-dark">{formData.email}</strong>
                                            </p>
                                        </div>

                                        {/* 6 kotak OTP */}
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                                            {otp.map((digit, idx) => (
                                                <input
                                                    key={idx}
                                                    ref={el => (otpRefs.current[idx] = el)}
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={1}
                                                    value={digit}
                                                    onChange={e => handleOtpChange(idx, e.target.value)}
                                                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                                                    onPaste={idx === 0 ? handleOtpPaste : undefined}
                                                    style={{
                                                        width: 44, height: 52, textAlign: 'center',
                                                        fontSize: 22, fontWeight: 700,
                                                        border: `2px solid ${otpError ? '#dc3545' : digit ? '#0d6efd' : '#dee2e6'}`,
                                                        borderRadius: 10, outline: 'none',
                                                        transition: 'border-color .15s',
                                                        caretColor: 'transparent',
                                                    }}
                                                />
                                            ))}
                                        </div>

                                        {/* Error OTP */}
                                        {otpError && (
                                            <Alert variant="danger" className="small py-2 text-center mb-3">
                                                {otpError}
                                                {attemptsLeft < 5 && attemptsLeft > 0 && (
                                                    <> (Sisa percobaan: <strong>{attemptsLeft}</strong>)</>
                                                )}
                                            </Alert>
                                        )}

                                        {/* Kirim ulang */}
                                        <div className="text-center mb-3">
                                            {countdown > 0 ? (
                                                <small className="text-muted">
                                                    Kirim ulang dalam <strong>{countdown}s</strong>
                                                </small>
                                            ) : (
                                                <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none"
                                                    onClick={resendOtp} disabled={otpSending}>
                                                    <FaRedo className="me-1" size={11} />
                                                    {otpSending ? 'Mengirim...' : 'Kirim Ulang OTP'}
                                                </button>
                                            )}
                                        </div>

                                        {/* Tombol Daftar */}
                                        <Button type="submit" variant="primary" className="w-100 fw-medium mb-3"
                                            style={{ borderRadius: 8, height: 48, fontSize: '0.95rem' }}
                                            disabled={loading || otp.join('').length < 6}>
                                            {loading ? 'Mendaftarkan...' : <><FaCheckCircle className="me-2" />Verifikasi & Daftar</>}
                                        </Button>

                                        {/* Kembali */}
                                        <div className="text-center">
                                            <button type="button" className="btn btn-link btn-sm text-secondary text-decoration-none"
                                                onClick={() => { setOtpStep(false); setOtpError(''); }}>
                                                ← Kembali ubah data
                                            </button>
                                        </div>
                                    </Form>
                                )}

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