import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import { FaPhone, FaShieldAlt, FaEnvelope, FaCheckCircle } from 'react-icons/fa';

const OTP_EXPIRES_S   = 5 * 60;
const RESEND_COOLDOWN = 60;

export default function ForgotEmail() {
    const [step,     setStep]     = useState('phone');  // 'phone' | 'otp' | 'result'
    const [phone,    setPhone]    = useState('');
    const [phoneErr, setPhoneErr] = useState('');
    const [sending,  setSending]  = useState(false);
    const [cooldown, setCooldown] = useState(0);

    // OTP state
    const [otp,        setOtp]        = useState(['','','','','','']);
    const [otpTimer,   setOtpTimer]   = useState(OTP_EXPIRES_S);
    const [expired,    setExpired]    = useState(false);
    const [otpErr,     setOtpErr]     = useState('');
    const [verifying,  setVerifying]  = useState(false);
    const [maskedEmail,setMaskedEmail]= useState('');

    const inputs = useRef([]);

    // ── Timers ───────────────────────────────────────────────────────────────
    useEffect(() => {
        if (step !== 'otp') return;
        if (otpTimer <= 0) { setExpired(true); return; }
        const t = setTimeout(() => setOtpTimer(v => v - 1), 1000);
        return () => clearTimeout(t);
    }, [otpTimer, step]);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(v => v - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

    // ── Step 1: kirim OTP ke WA ──────────────────────────────────────────────
    const handleSendOtp = async (e) => {
        e.preventDefault();
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 10) { setPhoneErr('NoHP minimal 10 digit'); return; }
        setSending(true);
        try {
            const res = await api.post('/api/auth/forgot-email', { phone });
            toast.success('Kode OTP dikirim via WhatsApp!');
            setCooldown(res.data.cooldownSeconds || RESEND_COOLDOWN);
            setOtpTimer(OTP_EXPIRES_S);
            setExpired(false);
            setOtp(['','','','','','']);
            setStep('otp');
        } catch (err) {
            const msg = err.response?.data?.message || 'Gagal mengirim OTP';
            if (err.response?.data?.cooldownSeconds) setCooldown(err.response.data.cooldownSeconds);
            setPhoneErr(msg);
        } finally { setSending(false); }
    };

    // ── OTP input ────────────────────────────────────────────────────────────
    const handleOtpChange = (i, val) => {
        if (!/^\d?$/.test(val)) return;
        const next = [...otp]; next[i] = val; setOtp(next); setOtpErr('');
        if (val && i < 5) inputs.current[i + 1]?.focus();
    };
    const handleKeyDown = (i, e) => {
        if (e.key === 'Backspace' && !otp[i] && i > 0) inputs.current[i - 1]?.focus();
    };
    const handlePaste = (e) => {
        const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (paste.length === 6) { setOtp(paste.split('')); inputs.current[5]?.focus(); }
    };

    // ── Step 2: verifikasi OTP ───────────────────────────────────────────────
    const handleVerify = async (e) => {
        e.preventDefault();
        const code = otp.join('');
        if (code.length < 6) { setOtpErr('Masukkan 6 digit kode OTP'); return; }
        if (expired) { setOtpErr('OTP sudah kedaluwarsa.'); return; }
        setVerifying(true);
        try {
            const res = await api.post('/api/auth/forgot-email/verify', { phone, otp: code });
            setMaskedEmail(res.data.email);
            setStep('result');
        } catch (err) {
            const data = err.response?.data;
            if (data?.expired) { setExpired(true); setOtpErr('OTP sudah kedaluwarsa.'); }
            else { setOtpErr(data?.message || 'Kode OTP salah, silakan coba lagi'); setOtp(['','','','','','']); inputs.current[0]?.focus(); }
        } finally { setVerifying(false); }
    };

    // ── Resend ───────────────────────────────────────────────────────────────
    const handleResend = async () => {
        if (cooldown > 0) return;
        setSending(true);
        try {
            const res = await api.post('/api/auth/forgot-email', { phone });
            toast.success('Kode OTP baru dikirim via WhatsApp');
            setCooldown(res.data.cooldownSeconds || RESEND_COOLDOWN);
            setOtpTimer(OTP_EXPIRES_S); setExpired(false);
            setOtp(['','','','','','']); setOtpErr('');
            inputs.current[0]?.focus();
        } catch (err) {
            const msg = err.response?.data?.message || 'Gagal kirim ulang';
            if (err.response?.data?.cooldownSeconds) setCooldown(err.response.data.cooldownSeconds);
            toast.error(msg);
        } finally { setSending(false); }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', padding: '24px 0' }}>
            <div style={{ maxWidth: 440, margin: '0 auto', width: '100%', padding: '0 16px' }}>
                {/* Header */}
                <div className="text-center mb-4">
                    <div className="bg-white shadow-sm rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                        style={{ width: 64, height: 64 }}>
                        {step === 'result'
                            ? <FaCheckCircle size={28} className="text-success"/>
                            : step === 'otp'
                                ? <FaShieldAlt size={28} className="text-primary"/>
                                : <FaEnvelope size={28} className="text-primary"/>}
                    </div>
                    <h5 className="fw-bold mb-1">
                        {step === 'phone' ? 'Lupa Email?' : step === 'otp' ? 'Verifikasi WhatsApp' : 'Email Ditemukan'}
                    </h5>
                    <p className="text-secondary small mb-0">
                        {step === 'phone' && 'Masukkan nomor HP terdaftar, OTP akan dikirim via WhatsApp'}
                        {step === 'otp'   && `OTP dikirim ke WhatsApp nomor ${phone}`}
                        {step === 'result'&& 'Ini email yang terdaftar dengan nomor HP Anda'}
                    </p>
                </div>

                <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
                    <div className="card-body p-4">

                        {/* ── Step 1: Input NoHP ── */}
                        {step === 'phone' && (
                            <form onSubmit={handleSendOtp}>
                                <div className="mb-4">
                                    <label className="form-label fw-medium small text-secondary">Nomor HP</label>
                                    <div className="input-group" style={{ height: 46 }}>
                                        <span className="input-group-text bg-white border-end-0 text-secondary"
                                            style={{ borderRadius: '8px 0 0 8px' }}>
                                            <FaPhone size={13}/>
                                        </span>
                                        <input type="tel"
                                            className={`form-control border-start-0 bg-white ${phoneErr ? 'is-invalid' : ''}`}
                                            style={{ height: 46, borderRadius: '0 8px 8px 0', fontSize: 14 }}
                                            placeholder="081234567890 atau +6281234567890"
                                            value={phone}
                                            onChange={e => {
                                                const v = e.target.value.replace(/[\s\-]/g, '').replace(/[^\d+]/g, '').replace(/(?!^\+)\+/g, '');
                                                setPhone(v); setPhoneErr('');
                                            }} maxLength={16}/>
                                        {phoneErr && <div className="invalid-feedback">{phoneErr}</div>}
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary w-100 fw-medium"
                                    style={{ height: 48, borderRadius: 8 }} disabled={sending}>
                                    {sending ? <><span className="spinner-border spinner-border-sm me-2"/>Mengirim...</> : 'Kirim OTP via WhatsApp'}
                                </button>
                            </form>
                        )}

                        {/* ── Step 2: OTP ── */}
                        {step === 'otp' && (
                            <form onSubmit={handleVerify}>
                                {!expired ? (
                                    <div className="text-center mb-3">
                                        <span className={`badge bg-opacity-10 px-3 py-2 ${otpTimer <= 60 ? 'bg-danger text-danger' : 'bg-secondary text-secondary'}`}
                                            style={{ fontSize: 13 }}>
                                            ⏱ OTP berlaku: {fmt(otpTimer)}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="alert alert-warning py-2 text-center small mb-3">OTP sudah kedaluwarsa.</div>
                                )}

                                <div className="d-flex justify-content-center gap-2 mb-3">
                                    {otp.map((digit, i) => (
                                        <input key={i} ref={el => inputs.current[i] = el}
                                            type="text" inputMode="numeric" maxLength={1} value={digit}
                                            onChange={e => handleOtpChange(i, e.target.value)}
                                            onKeyDown={e => handleKeyDown(i, e)}
                                            onPaste={i === 0 ? handlePaste : undefined}
                                            className={`form-control text-center fw-bold ${otpErr ? 'is-invalid border-danger' : digit ? 'border-primary' : ''}`}
                                            style={{ width: 46, height: 54, fontSize: 22, borderRadius: 10, backgroundColor: digit ? '#eff6ff' : '#fff' }}/>
                                    ))}
                                </div>
                                {otpErr && <div className="text-danger text-center small mb-3">{otpErr}</div>}

                                <button type="submit" className="btn btn-primary w-100 fw-medium mb-3"
                                    style={{ height: 48, borderRadius: 8 }} disabled={verifying || otp.join('').length < 6}>
                                    {verifying ? <><span className="spinner-border spinner-border-sm me-2"/>Verifikasi...</> : 'Verifikasi'}
                                </button>

                                <div className="text-center">
                                    {cooldown > 0
                                        ? <small className="text-muted">Kirim ulang dalam <strong>{cooldown}s</strong></small>
                                        : <button type="button" className="btn btn-link btn-sm text-decoration-none p-0"
                                            onClick={handleResend} disabled={sending}>
                                            {sending ? 'Mengirim...' : '🔄 Kirim Ulang OTP'}
                                          </button>}
                                </div>
                            </form>
                        )}

                        {/* ── Step 3: Hasil ── */}
                        {step === 'result' && (
                            <div className="text-center">
                                <div className="alert alert-success py-3 mb-4">
                                    <div className="fw-bold mb-1">Email terdaftar:</div>
                                    <div className="fs-5 fw-bold text-success">{maskedEmail}</div>
                                </div>
                                <p className="text-secondary small mb-4">
                                    Gunakan email di atas untuk login. Sebagian karakter disembunyikan demi keamanan.
                                </p>
                                <Link to="/login" className="btn btn-primary w-100 fw-medium" style={{ height: 46, borderRadius: 8, lineHeight: '30px' }}>
                                    Ke Halaman Login
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                <p className="text-center small text-secondary mt-3 mb-0">
                    <Link to="/login" className="text-primary text-decoration-none">← Kembali ke Login</Link>
                </p>
            </div>
        </div>
    );
}