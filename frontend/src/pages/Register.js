import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import {
    FaUser, FaEnvelope, FaLock, FaPhone, FaEye, FaEyeSlash,
    FaCheckCircle, FaVenusMars, FaShieldAlt,
} from 'react-icons/fa';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalisePhoneDisplay(raw) {
    // Hanya izinkan angka + tanda + di awal; hapus spasi & dash
    return raw.replace(/[\s\-]/g, '').replace(/(?!^\+)[^\d]/g, '');
}

function passwordStrength(pw) {
    if (!pw) return { score: 0, label: '', variant: 'secondary' };
    let s = 0;
    if (pw.length >= 8)        s++;
    if (/[a-z]/.test(pw))      s++;
    if (/[A-Z]/.test(pw))      s++;
    if (/[0-9]/.test(pw))      s++;
    if (/[^a-zA-Z0-9]/.test(pw)) s++;
    if (s <= 2) return { score: 33,  label: 'Lemah',  variant: 'danger'  };
    if (s <= 3) return { score: 66,  label: 'Sedang', variant: 'warning' };
    return       { score: 100, label: 'Kuat',   variant: 'success' };
}

// ─── Step 1: Form pendaftaran ─────────────────────────────────────────────────
function RegisterForm({ onSuccess }) {
    const [form, setForm] = useState({
        name: '', email: '', phone: '', dobDay: '', dobMonth: '', dobYear: '',
        gender: '', password: '', confirmPassword: '',
    });
    const [errors,      setErrors]      = useState({});
    const [showPw,      setShowPw]      = useState(false);
    const [showCpw,     setShowCpw]     = useState(false);
    const [submitting,  setSubmitting]  = useState(false);
    const [dobOpen,     setDobOpen]     = useState(null); // 'day'|'month'|'year'|null

    // Jumlah hari sesuai bulan (dan tahun untuk Feb kabisat)
    const getDaysInMonth = (month, year) => {
        if (!month) return 31;
        const m = parseInt(month);
        const y = parseInt(year) || new Date().getFullYear();
        return new Date(y, m, 0).getDate(); // new Date(y, m, 0) → hari terakhir bulan m
    };

    const set = (field, val) => {
        setForm(f => {
            const next = { ...f, [field]: val };
            // Auto-reset dobDay jika melebihi jumlah hari bulan yang dipilih
            const maxDay = getDaysInMonth(
                field === 'dobMonth' ? val : f.dobMonth,
                field === 'dobYear'  ? val : f.dobYear
            );
            if (parseInt(next.dobDay) > maxDay) next.dobDay = '';
            return next;
        });
        setErrors(e => ({ ...e, [field]: undefined, submit: undefined }));
    };

    const handlePhone = (e) => {
        // Hanya digit + optional leading +
        const raw = e.target.value.replace(/[\s\-]/g, '');
        const cleaned = raw.replace(/[^\d+]/g, '').replace(/(?!^\+)\+/g, '');
        set('phone', cleaned);
    };

    const validate = () => {
        const e = {};
        if (!form.name.trim() || form.name.trim().length < 3)
            e.name = 'Nama minimal 3 karakter';
        if (!emailRegex.test(form.email))
            e.email = 'Format email tidak valid';
        const digits = form.phone.replace(/\D/g, '');
        if (digits.length < 10)
            e.phone = 'NoHP minimal 10 digit';
        if (!form.dobDay || !form.dobMonth || !form.dobYear)
            e.dateOfBirth = 'Tanggal lahir harus diisi lengkap';
        if (!form.gender)
            e.gender = 'Jenis kelamin harus dipilih';
        if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/[0-9]/.test(form.password))
            e.password = 'Password min. 8 karakter, harus ada huruf besar, huruf kecil, dan angka';
        if (form.password !== form.confirmPassword)
            e.confirmPassword = 'Password tidak cocok';
        setErrors(e);
        return !Object.keys(e).length;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setSubmitting(true);
        try {
            const phone = form.phone;
            await api.post('/api/auth/register', {
                name: form.name.trim(), email: form.email.trim().toLowerCase(),
                phone, dateOfBirth: form.dobYear && form.dobMonth && form.dobDay ? `${form.dobYear}-${form.dobMonth.padStart(2,'0')}-${form.dobDay.padStart(2,'0')}` : '', gender: form.gender,
                password: form.password, confirmPassword: form.confirmPassword,
            });
            onSuccess(form.email.trim().toLowerCase());
        } catch (err) {
            const msg = err.response?.data?.message || 'Gagal mendaftar';
            if (msg.toLowerCase().includes('email')) setErrors(e => ({ ...e, email: msg }));
            else if (msg.toLowerCase().includes('hp') || msg.toLowerCase().includes('nomor')) setErrors(e => ({ ...e, phone: msg }));
            else setErrors(e => ({ ...e, submit: msg }));
        } finally {
            setSubmitting(false);
        }
    };

    const pw = passwordStrength(form.password);

    // Helper: label dengan asterisk merah
    const Req = () => <span style={{color:'#dc3545', marginLeft:2}}>*</span>;

    const fieldStyle = { marginBottom: 20 };
    const labelStyle = { fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' };
    const inputBase  = {
        width: '100%', height: 48, padding: '0 14px 0 42px',
        border: '1px solid #dee2e6', borderRadius: 10, fontSize: 14,
        background: '#fff', outline: 'none', transition: 'border-color .2s',
        boxSizing: 'border-box',
    };
    const inputErr   = { borderColor: '#dc3545' };
    const iconStyle  = {
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        color: '#9ca3af', pointerEvents: 'none',
    };
    const helperStyle = { fontSize: 11.5, color: '#6b7280', marginTop: 4, lineHeight: 1.4 };
    const errStyle    = { fontSize: 11.5, color: '#dc3545', marginTop: 4 };

    return (
        <form onSubmit={handleSubmit} noValidate>
            {errors.submit && (
                <div className="alert alert-danger py-2 small mb-4" style={{borderRadius:8}}>{errors.submit}</div>
            )}

            {/* ── Nama Lengkap ── */}
            <div style={fieldStyle}>
                <label style={labelStyle}>Nama Lengkap <Req/></label>
                <div style={{position:'relative'}}>
                    <FaUser size={13} style={iconStyle}/>
                    <input type="text"
                        style={{...inputBase, ...(errors.name ? inputErr : {})}}
                        placeholder="Nama lengkap Anda"
                        value={form.name}
                        onChange={e => set('name', e.target.value.replace(/<[^>]*>/g, ''))}
                        maxLength={80}
                        onFocus={e=>e.target.style.borderColor='#0d6efd'}
                        onBlur={e=>e.target.style.borderColor=errors.name?'#dc3545':'#dee2e6'}
                    />
                </div>
                {errors.name && <div style={errStyle}>{errors.name}</div>}
            </div>

            {/* ── Email ── */}
            <div style={fieldStyle}>
                <label style={labelStyle}>Email <Req/></label>
                <div style={{position:'relative'}}>
                    <FaEnvelope size={13} style={iconStyle}/>
                    <input type="email"
                        style={{...inputBase, ...(errors.email ? inputErr : {})}}
                        placeholder="nama@email.com"
                        value={form.email}
                        onChange={e => set('email', e.target.value)}
                        onFocus={e=>e.target.style.borderColor='#0d6efd'}
                        onBlur={e=>e.target.style.borderColor=errors.email?'#dc3545':'#dee2e6'}
                    />
                </div>
                {errors.email
                    ? <div style={errStyle}>{errors.email}</div>
                    : form.email.toLowerCase().endsWith('@apps.ipb.ac.id')
                        ? <div style={{...helperStyle, color:'#16a34a', fontWeight:500}}>
                            <FaCheckCircle size={10} style={{marginRight:4}}/>Email mahasiswa IPB terdeteksi — kuota obat gratis aktif
                          </div>
                        : <div style={helperStyle}>
                            Gunakan email <strong>@apps.ipb.ac.id</strong> jika Anda mahasiswa untuk akses kuota obat gratis.
                          </div>
                }
            </div>

            {/* ── Nomor HP ── */}
            <div style={fieldStyle}>
                <label style={labelStyle}>Nomor HP <Req/></label>
                <div style={{position:'relative'}}>
                    <FaPhone size={13} style={iconStyle}/>
                    <input type="tel"
                        style={{...inputBase, ...(errors.phone ? inputErr : {})}}
                        placeholder="081234567890 atau +6281234567890"
                        value={form.phone}
                        onChange={handlePhone}
                        maxLength={16}
                        onFocus={e=>e.target.style.borderColor='#0d6efd'}
                        onBlur={e=>e.target.style.borderColor=errors.phone?'#dc3545':'#dee2e6'}
                    />
                </div>
                {errors.phone
                    ? <div style={errStyle}>{errors.phone}</div>
                    : <div style={helperStyle}>Hanya angka. Awalan 0 atau +62 / 62 diterima.</div>
                }
            </div>

            {/* ── Tanggal Lahir (full width) ── */}
            <div style={fieldStyle}>
                <label style={labelStyle}>Tanggal Lahir <Req/></label>
                <div style={{display:'flex', gap:8, position:'relative'}}>
                    {[
                        { key:'day',   label: form.dobDay   || 'Tanggal', items: Array.from({length:getDaysInMonth(form.dobMonth, form.dobYear)},(_,i)=>({val:String(i+1),label:String(i+1)})), flex:'0 0 100px' },
                        { key:'month', label: form.dobMonth ? ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][+form.dobMonth-1] : 'Bulan', items: ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((m,i)=>({val:String(i+1),label:m})), flex:'1' },
                        { key:'year',  label: form.dobYear  || 'Tahun',   items: Array.from({length:new Date().getFullYear()-1939},(_,i)=>{ const y=new Date().getFullYear()-i; return {val:String(y),label:String(y)}; }), flex:'0 0 90px' },
                    ].map(col=>(
                            <div key={col.key} style={{flex:col.flex, position:'relative'}}>
                                <button type="button"
                                    onClick={()=>setDobOpen(dobOpen===col.key?null:col.key)}
                                    style={{
                                        width:'100%', height:48, padding:'0 10px',
                                        background:'#fff',
                                        border:`1px solid ${errors.dateOfBirth?'#dc3545':'#dee2e6'}`,
                                        borderRadius:10, fontSize:13, textAlign:'center',
                                        display:'flex', alignItems:'center', justifyContent:'center', gap:4,
                                        cursor:'pointer',
                                        color:(col.key==='day'&&form.dobDay)||(col.key==='month'&&form.dobMonth)||(col.key==='year'&&form.dobYear)?'#212529':'#9ca3af',
                                        whiteSpace:'nowrap', overflow:'hidden',
                                        transition:'border-color .2s',
                                    }}>
                                    <span style={{overflow:'hidden',textOverflow:'ellipsis',fontSize:13}}>{col.label}</span>
                                    <span style={{fontSize:9,color:'#9ca3af',flexShrink:0}}>▾</span>
                                </button>
                                {dobOpen===col.key && (
                                    <div style={{
                                        position:'absolute', top:52, left:0, zIndex:9999,
                                        background:'#fff', border:'1px solid #e5e7eb',
                                        borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.12)',
                                        maxHeight:200, overflowY:'auto',
                                        minWidth: col.key==='month'?150:'100%',
                                        width: col.key==='month'?150:'100%',
                                    }}>
                                        {col.items.map(item=>{
                                            const selected=(col.key==='day'&&form.dobDay===item.val)||(col.key==='month'&&form.dobMonth===item.val)||(col.key==='year'&&form.dobYear===item.val);
                                            return (
                                                <div key={item.val}
                                                    onClick={()=>{ set(col.key==='day'?'dobDay':col.key==='month'?'dobMonth':'dobYear', item.val); setDobOpen(null); }}
                                                    style={{padding:'9px 14px',fontSize:13,cursor:'pointer',background:selected?'#eff6ff':'#fff',color:selected?'#0d6efd':'#374151',fontWeight:selected?600:'normal'}}
                                                    onMouseEnter={e=>{if(!selected)e.currentTarget.style.background='#f9fafb'}}
                                                    onMouseLeave={e=>{if(!selected)e.currentTarget.style.background='#fff'}}
                                                >{item.label}</div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                        {dobOpen && <div style={{position:'fixed',inset:0,zIndex:9998}} onClick={()=>setDobOpen(null)}/>}
                    </div>
                    {errors.dateOfBirth && <div style={errStyle}>{errors.dateOfBirth}</div>}
                </div>

            {/* ── Jenis Kelamin (full width) ── */}
            <div style={fieldStyle}>
                <label style={labelStyle}>Jenis Kelamin <Req/></label>
                    <div style={{position:'relative'}}>
                        <FaVenusMars size={13} style={iconStyle}/>
                        <select
                            style={{...inputBase, paddingLeft:42, appearance:'none', cursor:'pointer', ...(errors.gender?inputErr:{})}}
                            value={form.gender}
                            onChange={e => set('gender', e.target.value)}
                            onFocus={e=>e.target.style.borderColor='#0d6efd'}
                            onBlur={e=>e.target.style.borderColor=errors.gender?'#dc3545':'#dee2e6'}
                        >
                            <option value="">Pilih</option>
                            <option value="laki-laki">Laki-laki</option>
                            <option value="perempuan">Perempuan</option>
                        </select>
                        <span style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',fontSize:10,color:'#9ca3af'}}>▾</span>
                    </div>
                    {errors.gender && <div style={errStyle}>{errors.gender}</div>}
            </div>

            {/* ── Password ── */}
            <div style={fieldStyle}>
                <label style={labelStyle}>Password <Req/></label>
                <div style={{position:'relative'}}>
                    <FaLock size={13} style={iconStyle}/>
                    <input type={showPw ? 'text' : 'password'}
                        style={{...inputBase, paddingRight:44, ...(errors.password?inputErr:{})}}
                        placeholder="Min. 8 karakter, huruf besar, kecil, angka"
                        value={form.password}
                        onChange={e => set('password', e.target.value)}
                        onFocus={e=>e.target.style.borderColor='#0d6efd'}
                        onBlur={e=>e.target.style.borderColor=errors.password?'#dc3545':'#dee2e6'}
                    />
                    <button type="button"
                        onClick={() => setShowPw(v=>!v)}
                        style={{position:'absolute',right:0,top:0,height:48,width:44,background:'none',border:'none',cursor:'pointer',color:'#9ca3af',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {showPw ? <FaEyeSlash size={14}/> : <FaEye size={14}/>}
                    </button>
                </div>
                {errors.password
                    ? <div style={errStyle}>{errors.password}</div>
                    : form.password && (
                        <div style={{marginTop:8}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                                <span style={{fontSize:11.5,color:'#6b7280'}}>Kekuatan:</span>
                                <span style={{fontSize:11.5,fontWeight:600,color:pw.variant==='danger'?'#dc3545':pw.variant==='warning'?'#f59e0b':'#16a34a'}}>{pw.label}</span>
                            </div>
                            <div style={{height:3,background:'#e5e7eb',borderRadius:4,overflow:'hidden'}}>
                                <div style={{height:'100%',width:`${pw.score}%`,borderRadius:4,transition:'width .3s',background:pw.variant==='danger'?'#dc3545':pw.variant==='warning'?'#f59e0b':'#16a34a'}}/>
                            </div>
                        </div>
                    )
                }
            </div>

            {/* ── Konfirmasi Password ── */}
            <div style={{marginBottom:28}}>
                <label style={labelStyle}>Konfirmasi Password <Req/></label>
                <div style={{position:'relative'}}>
                    <FaLock size={13} style={iconStyle}/>
                    <input type={showCpw ? 'text' : 'password'}
                        style={{...inputBase, paddingRight:44, ...(errors.confirmPassword?inputErr:{})}}
                        placeholder="Ulangi password"
                        value={form.confirmPassword}
                        onChange={e => set('confirmPassword', e.target.value)}
                        onFocus={e=>e.target.style.borderColor='#0d6efd'}
                        onBlur={e=>e.target.style.borderColor=errors.confirmPassword?'#dc3545':'#dee2e6'}
                    />
                    <button type="button"
                        onClick={() => setShowCpw(v=>!v)}
                        style={{position:'absolute',right:0,top:0,height:48,width:44,background:'none',border:'none',cursor:'pointer',color:'#9ca3af',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {showCpw ? <FaEyeSlash size={14}/> : <FaEye size={14}/>}
                    </button>
                </div>
                {errors.confirmPassword
                    ? <div style={errStyle}>{errors.confirmPassword}</div>
                    : form.password && form.confirmPassword && form.password === form.confirmPassword &&
                        <div style={{...helperStyle,color:'#16a34a',fontWeight:500,marginTop:4}}>
                            <FaCheckCircle size={10} style={{marginRight:4}}/>Password cocok
                        </div>
                }
            </div>

            {/* ── Keterangan wajib ── */}
            <p style={{fontSize:11.5,color:'#9ca3af',marginBottom:16}}>
                <span style={{color:'#dc3545'}}>*</span> Kolom wajib diisi
            </p>

            <button type="submit"
                className="btn btn-primary w-100 fw-semibold"
                style={{height:50, borderRadius:10, fontSize:15, letterSpacing:.2}}
                disabled={submitting}>
                {submitting
                    ? <><span className="spinner-border spinner-border-sm me-2"/>Memproses...</>
                    : 'Daftar Sekarang'
                }
            </button>
        </form>
    );
}

// ─── Step 2: Verifikasi OTP ───────────────────────────────────────────────────
const OTP_EXPIRES_S   = 5 * 60;   // 5 menit
const RESEND_COOLDOWN = 60;        // detik

function OtpVerify({ email, onVerified, fromLogin = false }) {
    const [otp,          setOtp]          = useState(['', '', '', '', '', '']);
    const [submitting,   setSubmitting]   = useState(false);
    const [error,        setError]        = useState('');
    const [expired,      setExpired]      = useState(false);

    // Countdown untuk expiry OTP
    const [otpTimer,     setOtpTimer]     = useState(OTP_EXPIRES_S);
    // Cooldown tombol kirim ulang
    const [cooldown,     setCooldown]     = useState(fromLogin ? 0 : RESEND_COOLDOWN);
    const [resending,    setResending]    = useState(false);

    const inputs = useRef([]);

    // ── Timer OTP expiry ─────────────────────────────────────────────────────
    useEffect(() => {
        if (otpTimer <= 0) { setExpired(true); return; }
        const t = setTimeout(() => setOtpTimer(v => v - 1), 1000);
        return () => clearTimeout(t);
    }, [otpTimer]);

    // ── Cooldown kirim ulang ─────────────────────────────────────────────────
    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(v => v - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

    const handleOtpChange = (i, val) => {
        if (!/^\d?$/.test(val)) return;
        const next = [...otp];
        next[i] = val;
        setOtp(next);
        setError('');
        if (val && i < 5) inputs.current[i + 1]?.focus();
    };

    const handleKeyDown = (i, e) => {
        if (e.key === 'Backspace' && !otp[i] && i > 0) inputs.current[i - 1]?.focus();
    };

    const handlePaste = (e) => {
        const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (paste.length === 6) {
            setOtp(paste.split(''));
            inputs.current[5]?.focus();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const code = otp.join('');
        if (code.length < 6) { setError('Masukkan 6 digit kode OTP'); return; }
        if (expired) { setError('OTP sudah kedaluwarsa. Silakan kirim ulang.'); return; }
        setSubmitting(true);
        try {
            const res = await api.post('/api/auth/verify-otp', { email, otp: code });
            onVerified(res.data.token, res.data.user);
        } catch (err) {
            const data = err.response?.data;
            if (data?.expired) {
                setExpired(true);
                setError('OTP sudah kedaluwarsa. Silakan kirim ulang.');
            } else {
                setError(data?.message || 'Kode OTP salah, silakan coba lagi');
                setOtp(['', '', '', '', '', '']);
                inputs.current[0]?.focus();
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleResend = async () => {
        if (cooldown > 0) return;
        setResending(true);
        try {
            const res = await api.post('/api/auth/resend-otp', { email });
            setOtp(['', '', '', '', '', '']);
            setError('');
            setExpired(false);
            setOtpTimer(OTP_EXPIRES_S);
            setCooldown(res.data.cooldownSeconds || RESEND_COOLDOWN);
            toast.success('Kode OTP baru telah dikirim ke email Anda');
            inputs.current[0]?.focus();
        } catch (err) {
            const msg = err.response?.data?.message || 'Gagal mengirim ulang OTP';
            if (err.response?.data?.cooldownSeconds) {
                setCooldown(err.response.data.cooldownSeconds);
            }
            toast.error(msg);
        } finally {
            setResending(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="text-center mb-4">
                <div className="d-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 rounded-circle mb-3"
                    style={{ width: 64, height: 64 }}>
                    <FaShieldAlt size={28} className="text-primary"/>
                </div>
                <h5 className="fw-bold mb-1">Verifikasi Email</h5>
                <p className="text-secondary small mb-0">
                    Kode OTP dikirim ke <strong>{email}</strong>
                </p>
            </div>

            {/* OTP Timer */}
            {!expired ? (
                <div className="text-center mb-3">
                    <span className={`badge ${otpTimer <= 60 ? 'bg-danger' : 'bg-secondary'} bg-opacity-10 text-${otpTimer <= 60 ? 'danger' : 'secondary'} px-3 py-2`}
                        style={{ fontSize: 13 }}>
                        ⏱ OTP berlaku: {fmt(otpTimer)}
                    </span>
                </div>
            ) : (
                <div className="alert alert-warning py-2 text-center small mb-3">
                    Kode OTP sudah kedaluwarsa.
                </div>
            )}

            {/* 6 kotak OTP */}
            <div className="d-flex justify-content-center gap-2 mb-3">
                {otp.map((digit, i) => (
                    <input key={i}
                        ref={el => inputs.current[i] = el}
                        type="text" inputMode="numeric" maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleKeyDown(i, e)}
                        onPaste={i === 0 ? handlePaste : undefined}
                        className={`form-control text-center fw-bold ${error ? 'is-invalid border-danger' : digit ? 'border-primary' : ''}`}
                        style={{ width: 46, height: 54, fontSize: 22, borderRadius: 10,
                            backgroundColor: digit ? '#eff6ff' : '#fff',
                            transition: 'all .15s' }}
                    />
                ))}
            </div>

            {error && <div className="text-danger text-center small mb-3">{error}</div>}

            <button type="submit" className="btn btn-primary w-100 fw-medium mb-3"
                style={{ height: 48, borderRadius: 8 }} disabled={submitting || otp.join('').length < 6}>
                {submitting ? <><span className="spinner-border spinner-border-sm me-2"/>Memverifikasi...</> : 'Verifikasi'}
            </button>

            {/* Kirim ulang */}
            <div className="text-center">
                {cooldown > 0 ? (
                    <small className="text-muted">Kirim ulang dalam <strong>{cooldown}s</strong></small>
                ) : (
                    <button type="button" className="btn btn-link btn-sm text-decoration-none p-0"
                        onClick={handleResend} disabled={resending}>
                        {resending ? 'Mengirim...' : '🔄 Kirim Ulang OTP'}
                    </button>
                )}
            </div>
        </form>
    );
}

// ─── Main Register component ──────────────────────────────────────────────────
const Register = () => {
    const navigate  = useNavigate();
    const location  = useLocation();
    const { login: ctxLogin } = useAuth();
    // Support redirect dari Login saat akun belum terverifikasi
    const initStep  = location.state?.step  || 'form';
    const initEmail = location.state?.email || '';
    const [step,  setStep]  = useState(initStep);
    const [email, setEmail] = useState(initEmail);

    const handleFormSuccess = (registeredEmail) => {
        setEmail(registeredEmail);
        setStep('otp');
    };

    const handleVerified = useCallback(async (token, user) => {
        // Auto-login: simpan token ke localStorage & set context
        localStorage.setItem('token', token);
        localStorage.setItem('lastActivity', Date.now().toString());
        // Trigger AuthContext fetchUser via token change
        window.location.href = '/';  // Hard redirect agar AuthContext reload
    }, []);

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', padding: '24px 0' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
                * { font-family: 'Poppins', sans-serif !important; }
            `}</style>
            <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', padding: '0 16px' }}>
                {/* Header */}
                <div className="text-center mb-4">
                    <div className="bg-white shadow-sm rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                        style={{ width: 64, height: 64 }}>
                        <FaUser size={26} className="text-primary"/>
                    </div>
                    <h5 className="fw-bold mb-1">
                        {step === 'form' ? 'Buat Akun Baru' : 'Masukkan Kode OTP'}
                    </h5>
                    <p className="text-secondary small mb-0">
                        {step === 'form' ? 'Daftar untuk mengakses semua layanan' : 'Cek inbox email Anda'}
                    </p>
                </div>

                {/* Step indicator */}
                <div className="d-flex align-items-center justify-content-center gap-2 mb-4">
                    <div className="d-flex align-items-center gap-1">
                        <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                            style={{ width: 28, height: 28, fontSize: 12,
                                background: '#0d6efd', color: '#fff' }}>
                            {step === 'otp' ? <FaCheckCircle size={14}/> : '1'}
                        </div>
                        <small className={step === 'form' ? 'fw-bold text-primary' : 'text-muted'}>Data Diri</small>
                    </div>
                    <div style={{ width: 32, height: 2, background: step === 'otp' ? '#0d6efd' : '#dee2e6', borderRadius: 2 }}/>
                    <div className="d-flex align-items-center gap-1">
                        <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                            style={{ width: 28, height: 28, fontSize: 12,
                                background: step === 'otp' ? '#0d6efd' : '#dee2e6',
                                color: step === 'otp' ? '#fff' : '#6c757d' }}>
                            2
                        </div>
                        <small className={step === 'otp' ? 'fw-bold text-primary' : 'text-muted'}>Verifikasi</small>
                    </div>
                </div>

                <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
                    <div className="card-body p-4">
                        {step === 'form'
                            ? <RegisterForm onSuccess={handleFormSuccess}/>
                            : <OtpVerify email={email} onVerified={handleVerified} fromLogin={initStep==='otp'}/>
                        }
                    </div>
                </div>

                {step === 'form' && (
                    <p className="text-center small text-secondary mt-3 mb-0">
                        Sudah punya akun?{' '}
                        <Link to="/login" className="text-primary fw-medium text-decoration-none">Masuk</Link>
                    </p>
                )}

                <p className="text-center text-secondary small mt-3 mb-0">
                    © {new Date().getFullYear()} Klinik Pratama IPB
                </p>
            </div>
        </div>
    );
};

export default Register;