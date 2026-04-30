const express    = require('express');
const router     = express.Router();
const { body, validationResult } = require('express-validator');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const SibApiV3Sdk = require('@getbrevo/brevo');
const { User }   = require('../models/mysql');
const { Op }     = require('sequelize');
const auth       = require('../middleware/auth');
const { sendWhatsApp } = require('../utils/fonnte');

// ─── Config ──────────────────────────────────────────────────────────────────
const OTP_EXPIRES_MIN   = 5;
const RESEND_COOLDOWN_S = 60;
const RESEND_MAX        = 3;
const RESEND_WINDOW_MS  = 60 * 60 * 1000;

// ─── Brevo Config ─────────────────────────────────────────────────────────────
const brevoClient = SibApiV3Sdk.ApiClient.instance;
brevoClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
const transactionalEmailsApi = new SibApiV3Sdk.TransactionalEmailsApi();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function normalisePhone(raw) {
    let p = String(raw).replace(/[\s\-]/g, '').replace(/[^\d+]/g, '');
    if (p.startsWith('+62')) return p;
    if (p.startsWith('62'))  return '+' + p;
    if (p.startsWith('0'))   return '+62' + p.slice(1);
    return '+62' + p;
}

function stripHtml(str) {
    return String(str).replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
}

async function sendOtpEmail(email, name, otp) {
    try {
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.sender  = {
            name  : 'Klinik Pratama IPB',
            email : process.env.BREVO_SENDER_EMAIL,
        };
        sendSmtpEmail.to      = [{ email, name }];
        sendSmtpEmail.subject = 'Kode OTP Verifikasi — Klinik Pratama IPB';
        sendSmtpEmail.htmlContent = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
  .wrap{max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08)}
  .hdr{background:linear-gradient(135deg,#0d6efd,#0a58ca);padding:28px 36px;text-align:center}
  .hdr h1{color:#fff;margin:0;font-size:20px} .hdr p{color:rgba(255,255,255,.85);margin:4px 0 0;font-size:13px}
  .body{padding:32px 36px}
  .body p{color:#444;font-size:14px;line-height:1.6;margin:0 0 14px}
  .otp-box{background:#f0f7ff;border:2px dashed #0d6efd;border-radius:10px;padding:18px;text-align:center;margin:20px 0}
  .otp{font-size:38px;font-weight:700;color:#0d6efd;letter-spacing:10px}
  .note{background:#fff8e1;border-left:4px solid #ffc107;border-radius:4px;padding:10px 14px;font-size:12px;color:#7a6000;margin-bottom:12px}
  .footer{border-top:1px solid #e9ecef;padding:16px 36px;text-align:center;color:#aaa;font-size:11px}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>🏥 Klinik Pratama IPB</h1><p>Verifikasi Akun Anda</p></div>
  <div class="body">
    <p>Halo, <strong>${name}</strong>!</p>
    <p>Gunakan kode OTP berikut untuk menyelesaikan pendaftaran:</p>
    <div class="otp-box"><div class="otp">${otp}</div></div>
    <div class="note">⏰ <strong>Kode ini hanya berlaku ${OTP_EXPIRES_MIN} menit</strong> dan hanya bisa digunakan satu kali.</div>
    <p>Jika Anda tidak mendaftar, abaikan email ini.</p>
  </div>
  <div class="footer">© ${new Date().getFullYear()} Klinik Pratama IPB — Email otomatis, jangan dibalas.</div>
</div>
</body></html>`;

        await transactionalEmailsApi.sendTransacEmail(sendSmtpEmail);
        console.log(`[Brevo] OTP email terkirim ke ${email}`);
    } catch (error) {
        console.error('[Brevo] Error sending OTP email:', error?.response?.body || error.message);
        throw error;
    }
}

const ipResendMap   = new Map();
const otpVerifyMap  = new Map();
const OTP_VERIFY_MAX    = 5;
const OTP_VERIFY_WINDOW = 15 * 60 * 1000;

function checkOtpVerifyLimit(identifier) {
    const now = Date.now();
    const rec = otpVerifyMap.get(identifier) || { count: 0, windowStart: now };
    if (now - rec.windowStart > OTP_VERIFY_WINDOW) {
        otpVerifyMap.set(identifier, { count: 1, windowStart: now });
        return { allowed: true, remaining: OTP_VERIFY_MAX - 1 };
    }
    if (rec.count >= OTP_VERIFY_MAX) {
        const waitMin = Math.ceil((OTP_VERIFY_WINDOW - (now - rec.windowStart)) / 60000);
        return { allowed: false, waitMin };
    }
    rec.count++;
    otpVerifyMap.set(identifier, rec);
    return { allowed: true, remaining: OTP_VERIFY_MAX - rec.count };
}

function resetOtpVerifyLimit(identifier) {
    otpVerifyMap.delete(identifier);
}

const loginLimitMap = new Map();
const LOGIN_MAX    = 10;
const LOGIN_WINDOW = 15 * 60 * 1000;

function checkLoginLimit(ip) {
    const now = Date.now();
    const rec = loginLimitMap.get(ip) || { count: 0, windowStart: now };
    if (now - rec.windowStart > LOGIN_WINDOW) {
        loginLimitMap.set(ip, { count: 1, windowStart: now });
        return { allowed: true };
    }
    if (rec.count >= LOGIN_MAX) {
        const waitMin = Math.ceil((LOGIN_WINDOW - (now - rec.windowStart)) / 60000);
        return { allowed: false, waitMin };
    }
    rec.count++;
    loginLimitMap.set(ip, rec);
    return { allowed: true };
}

function resetLoginLimit(ip) {
    loginLimitMap.delete(ip);
}

function checkIpResend(ip) {
    const now = Date.now();
    const rec = ipResendMap.get(ip) || { count: 0, windowStart: now, lastSent: 0 };
    if (now - rec.windowStart > RESEND_WINDOW_MS) {
        ipResendMap.set(ip, { count: 1, windowStart: now, lastSent: now });
        return { allowed: true };
    }
    if (rec.count >= RESEND_MAX) {
        return { allowed: false, reason: 'ip_limit' };
    }
    rec.count++;
    rec.lastSent = now;
    ipResendMap.set(ip, rec);
    return { allowed: true };
}

// ─── POST /register ───────────────────────────────────────────────────────────
router.post('/register', [
    body('name').notEmpty().withMessage('Nama harus diisi'),
    body('email').isEmail().normalizeEmail().withMessage('Format email tidak valid'),
    body('phone').notEmpty().withMessage('NoHP harus diisi'),
    body('dateOfBirth').notEmpty().withMessage('Tanggal lahir harus diisi'),
    body('gender').isIn(['laki-laki', 'perempuan']).withMessage('Jenis kelamin tidak valid'),
    body('password')
        .isLength({ min: 8 }).withMessage('Password minimal 8 karakter')
        .matches(/[A-Z]/).withMessage('Password harus mengandung huruf besar')
        .matches(/[a-z]/).withMessage('Password harus mengandung huruf kecil')
        .matches(/[0-9]/).withMessage('Password harus mengandung angka'),
    body('confirmPassword').notEmpty(),
], async (req, res) => {
    try {
        const errs = validationResult(req);
        if (!errs.isEmpty()) return res.status(400).json({ message: errs.array()[0].msg });

        let { name, email, password, confirmPassword, phone, dateOfBirth, gender } = req.body;

        name = stripHtml(name);
        if (!name) return res.status(400).json({ message: 'Nama tidak valid' });

        if (password !== confirmPassword)
            return res.status(400).json({ message: 'Password dan konfirmasi password tidak cocok' });

        phone = normalisePhone(phone);
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 10)
            return res.status(400).json({ message: 'NoHP minimal 10 digit' });

        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) {
            if (existingEmail.isVerified) {
                return res.status(400).json({ message: 'Email sudah digunakan' });
            }
            const otp = generateOtp();
            existingEmail.name               = name;
            existingEmail.password           = password;
            existingEmail.phone              = phone;
            existingEmail.dateOfBirth        = dateOfBirth;
            existingEmail.gender             = gender;
            existingEmail.emailOtp           = otp;
            existingEmail.emailOtpExpires    = new Date(Date.now() + OTP_EXPIRES_MIN * 60000);
            existingEmail.emailOtpInvalidated = false;
            existingEmail.otpResendCount     = 0;
            existingEmail.otpResendWindowStart = new Date();
            existingEmail.createdAt          = new Date();
            await existingEmail.save();
            await sendOtpEmail(email, name, otp);
            return res.status(200).json({
                message : 'Akun belum terverifikasi. Kode OTP baru telah dikirim ke email Anda.',
                email,
                needsVerification: true,
            });
        }

        const existingPhone = await User.findOne({ where: { phone, isVerified: true } });
        if (existingPhone)
            return res.status(400).json({ message: 'Nomor HP sudah digunakan' });

        const role = email.toLowerCase().endsWith('@apps.ipb.ac.id') ? 'mahasiswa' : 'user';

        const otp  = generateOtp();
        const user = User.build({
            name, email, password, phone, dateOfBirth, gender, role,
            isVerified           : false,
            emailOtp             : otp,
            emailOtpExpires      : new Date(Date.now() + OTP_EXPIRES_MIN * 60000),
            emailOtpInvalidated  : false,
            otpResendCount       : 0,
            otpResendWindowStart : new Date(),
        });
        await user.save();
        await sendOtpEmail(email, name, otp);

        res.status(201).json({
            message : 'Kode OTP telah dikirim ke email Anda.',
            email,
            needsVerification: true,
        });
    } catch (err) {
        console.error('[auth] register:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ─── POST /verify-otp ─────────────────────────────────────────────────────────
router.post('/verify-otp', [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP harus 6 digit'),
], async (req, res) => {
    try {
        const errs = validationResult(req);
        if (!errs.isEmpty()) return res.status(400).json({ message: errs.array()[0].msg });

        const { email, otp } = req.body;

        const rl = checkOtpVerifyLimit(email);
        if (!rl.allowed) {
            return res.status(429).json({
                message  : `Terlalu banyak percobaan. Coba lagi dalam ${rl.waitMin} menit.`,
                rateLimit: true,
            });
        }

        const user = await User.findOne({ where: { email } });

        if (!user || user.isVerified)
            return res.status(400).json({ message: 'Akun tidak ditemukan atau sudah terverifikasi' });

        if (user.emailOtpInvalidated)
            return res.status(400).json({ message: 'Kode OTP sudah tidak berlaku. Gunakan kode terbaru dari email.' });

        if (!user.emailOtpExpires || new Date() > user.emailOtpExpires) {
            return res.status(400).json({ message: 'Kode OTP sudah kedaluwarsa.', expired: true });
        }

        if (user.emailOtp !== otp) {
            const remaining = rl.remaining;
            return res.status(400).json({
                message: remaining > 0
                    ? `Kode OTP salah. Sisa percobaan: ${remaining}`
                    : 'Kode OTP salah.',
            });
        }

        resetOtpVerifyLimit(email);
        user.isVerified          = true;
        user.emailOtp            = null;
        user.emailOtpExpires     = null;
        user.emailOtpInvalidated = false;
        await user.save();

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '24h' }
        );

        res.json({
            message : 'Verifikasi berhasil! Selamat datang.',
            token,
            user    : { id: user.id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        console.error('[auth] verify-otp:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ─── POST /resend-otp ─────────────────────────────────────────────────────────
router.post('/resend-otp', [
    body('email').isEmail().normalizeEmail(),
], async (req, res) => {
    try {
        const errs = validationResult(req);
        if (!errs.isEmpty()) return res.status(400).json({ message: errs.array()[0].msg });

        const { email } = req.body;
        const ip        = req.ip || req.connection?.remoteAddress || 'unknown';
        const user      = await User.findOne({ where: { email } });

        if (!user || user.isVerified)
            return res.status(400).json({ message: 'Akun tidak ditemukan atau sudah terverifikasi' });

        const now = Date.now();

        if (user.emailOtpExpires) {
            const lastSentAt = user.emailOtpExpires.getTime() - OTP_EXPIRES_MIN * 60000;
            const elapsed    = now - lastSentAt;
            if (elapsed < RESEND_COOLDOWN_S * 1000) {
                const remaining = Math.ceil((RESEND_COOLDOWN_S * 1000 - elapsed) / 1000);
                return res.status(429).json({
                    message         : `Tunggu ${remaining} detik sebelum kirim ulang.`,
                    cooldownSeconds : remaining,
                });
            }
        }

        if (user.otpResendWindowStart && (now - user.otpResendWindowStart.getTime()) < RESEND_WINDOW_MS) {
            if ((user.otpResendCount || 0) >= RESEND_MAX) {
                return res.status(429).json({
                    message   : 'Batas pengiriman OTP tercapai (3x per jam). Coba lagi nanti.',
                    rateLimit : true,
                });
            }
        } else {
            user.otpResendCount       = 0;
            user.otpResendWindowStart = new Date();
        }

        const ipCheck = checkIpResend(ip);
        if (!ipCheck.allowed) {
            return res.status(429).json({
                message   : 'Terlalu banyak permintaan dari perangkat ini. Coba lagi dalam 1 jam.',
                rateLimit : true,
            });
        }

        const newOtp = generateOtp();
        user.emailOtp            = newOtp;
        user.emailOtpExpires     = new Date(now + OTP_EXPIRES_MIN * 60000);
        user.emailOtpInvalidated = false;
        user.otpResendCount      = (user.otpResendCount || 0) + 1;
        await user.save();

        await sendOtpEmail(email, user.name, newOtp);

        res.json({
            message         : 'Kode OTP baru telah dikirim ke email Anda.',
            cooldownSeconds : RESEND_COOLDOWN_S,
        });
    } catch (err) {
        console.error('[auth] resend-otp:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ─── POST /login ──────────────────────────────────────────────────────────────
router.post('/login', [
    body('email')
        .notEmpty().withMessage('Email harus diisi')
        .isEmail().withMessage('Format email tidak valid')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password harus diisi'),
], async (req, res) => {
    try {
        const errs = validationResult(req);
        if (!errs.isEmpty()) {
            return res.status(400).json({ message: errs.array()[0].msg });
        }

        const ip = req.ip || req.connection?.remoteAddress || 'unknown';

        const rl = checkLoginLimit(ip);
        if (!rl.allowed) {
            return res.status(429).json({
                message  : `Terlalu banyak percobaan login. Coba lagi dalam ${rl.waitMin} menit.`,
                rateLimit: true,
            });
        }

        const { email, password } = req.body;
        const user = await User.findOne({ where: { email } });

        if (!user) return res.status(400).json({ message: 'Email atau password salah' });

        if (user.isVerified === false)
            return res.status(403).json({
                message: 'Akun belum diverifikasi. Cek email Anda.',
                needsVerification: true,
                email,
            });

        if (user.isActive === false)
            return res.status(403).json({ message: 'Akun Anda telah dinonaktifkan. Hubungi admin.' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ message: 'Email atau password salah' });

        resetLoginLimit(ip);

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '24h' }
        );

        res.json({
            token,
            user: { id: user.id, name: user.name, email, role: user.role },
        });
    } catch (err) {
        console.error('[auth] login:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ─── GET /me ──────────────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.userId, {
            attributes: { exclude: ['password', 'emailOtp'] }
        });
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ─── POST /forgot-email ───────────────────────────────────────────────────────
router.post('/forgot-email', [
    body('phone').notEmpty().withMessage('Nomor HP harus diisi'),
], async (req, res) => {
    try {
        const errs = validationResult(req);
        if (!errs.isEmpty()) return res.status(400).json({ message: errs.array()[0].msg });

        let { phone } = req.body;
        phone = normalisePhone(phone);

        const digits = phone.replace(/\D/g, '');
        const altFormats = [phone, digits, '0' + digits.slice(2)];
        const user = await User.findOne({
            where: {
                phone: { [Op.in]: altFormats },
                isVerified: { [Op.ne]: false },
            }
        });
        if (!user)
            return res.status(404).json({ message: 'Nomor HP tidak terdaftar' });

        const ip  = req.ip || req.connection?.remoteAddress || 'unknown';
        const now = Date.now();

        if (user.emailOtpExpires) {
            const lastSentAt = user.emailOtpExpires.getTime() - OTP_EXPIRES_MIN * 60000;
            const elapsed    = now - lastSentAt;
            if (elapsed < RESEND_COOLDOWN_S * 1000) {
                const remaining = Math.ceil((RESEND_COOLDOWN_S * 1000 - elapsed) / 1000);
                return res.status(429).json({ message: `Tunggu ${remaining} detik.`, cooldownSeconds: remaining });
            }
        }

        const ipCheck = checkIpResend(ip + ':forgot-email');
        if (!ipCheck.allowed)
            return res.status(429).json({ message: 'Terlalu banyak permintaan. Coba lagi nanti.' });

        const otp = generateOtp();
        user.emailOtp            = otp;
        user.emailOtpExpires     = new Date(now + OTP_EXPIRES_MIN * 60000);
        user.emailOtpInvalidated = false;
        await user.save();

        await sendWhatsApp(phone,
            `*Klinik Pratama IPB*\nKode OTP untuk melihat email terdaftar:\n\n*${otp}*\n\nBerlaku 5 menit. Jangan bagikan kode ini kepada siapapun.`
        );

        res.json({ message: 'Kode OTP telah dikirim via WhatsApp.', cooldownSeconds: RESEND_COOLDOWN_S });
    } catch (err) {
        console.error('[auth] forgot-email:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ─── POST /forgot-email/verify ────────────────────────────────────────────────
router.post('/forgot-email/verify', [
    body('phone').notEmpty(),
    body('otp').isLength({ min: 6, max: 6 }),
], async (req, res) => {
    try {
        const errs = validationResult(req);
        if (!errs.isEmpty()) return res.status(400).json({ message: errs.array()[0].msg });

        let { phone, otp } = req.body;
        phone = normalisePhone(phone);

        const digits2 = phone.replace(/\D/g, '');
        const altFormats2 = [phone, digits2, '0' + digits2.slice(2)];
        const user = await User.findOne({
            where: {
                phone: { [Op.in]: altFormats2 },
                isVerified: { [Op.ne]: false },
            }
        });
        if (!user)
            return res.status(404).json({ message: 'Nomor HP tidak terdaftar' });

        if (user.emailOtp && user.emailOtpInvalidated)
            return res.status(400).json({ message: 'Kode OTP sudah tidak berlaku.' });
        if (!user.emailOtp || !user.emailOtpExpires || new Date() > user.emailOtpExpires)
            return res.status(400).json({ message: 'Kode OTP sudah kedaluwarsa.', expired: true });
        if (user.emailOtp !== otp)
            return res.status(400).json({ message: 'Kode OTP salah, silakan coba lagi' });

        user.emailOtp            = null;
        user.emailOtpExpires     = null;
        user.emailOtpInvalidated = false;
        await user.save();

        const [localPart, domain] = user.email.split('@');
        const masked = localPart.length <= 2
            ? localPart[0] + '***'
            : localPart[0] + '*'.repeat(Math.min(localPart.length - 2, 5)) + localPart.slice(-1);
        const maskedEmail = `${masked}@${domain}`;

        res.json({ message: 'Verifikasi berhasil.', email: maskedEmail });
    } catch (err) {
        console.error('[auth] forgot-email/verify:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ─── Forgot Password & Reset ──────────────────────────────────────────────────
const rateLimitStore = new Map();
const checkRateLimit = (key) => {
    const now = Date.now(), WINDOW = 15 * 60 * 1000, MAX = 3;
    const rec = rateLimitStore.get(key);
    if (!rec || now - rec.firstRequestAt > WINDOW) {
        rateLimitStore.set(key, { count: 1, firstRequestAt: now });
        return { allowed: true };
    }
    if (rec.count >= MAX) {
        return { allowed: false, waitMin: Math.ceil((WINDOW - (now - rec.firstRequestAt)) / 60000) };
    }
    rec.count++;
    return { allowed: true };
};

router.post('/forgot-password', [
    body('email').isEmail().normalizeEmail().withMessage('Email tidak valid'),
], async (req, res) => {
    try {
        const errs = validationResult(req);
        if (!errs.isEmpty()) return res.status(400).json({ message: errs.array()[0].msg });
        const { email } = req.body;
        const rl = checkRateLimit(email);
        if (!rl.allowed)
            return res.status(429).json({ message: `Terlalu banyak permintaan. Coba lagi dalam ${rl.waitMin} menit.` });
        const user = await User.findOne({ where: { email } });
        if (!user || user.isVerified === false)
            return res.json({ message: 'Jika email terdaftar, link reset password akan dikirim ke email Anda.' });
        if (!user.isActive)
            return res.status(403).json({ message: 'Akun Anda telah dinonaktifkan.' });
        const resetToken  = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken   = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.sender  = {
            name  : 'Klinik Pratama IPB',
            email : process.env.BREVO_SENDER_EMAIL,
        };
        sendSmtpEmail.to      = [{ email, name: user.name }];
        sendSmtpEmail.subject = 'Reset Password - Klinik Pratama IPB';
        sendSmtpEmail.htmlContent = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
  .wrap{max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08)}
  .hdr{background:linear-gradient(135deg,#0d6efd,#0a58ca);padding:28px 36px;text-align:center}
  .hdr h1{color:#fff;margin:0;font-size:20px}
  .body{padding:32px 36px}
  .body p{color:#444;font-size:14px;line-height:1.6;margin:0 0 14px}
  .button{display:inline-block;background:#0d6efd;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold}
  .note{background:#fff8e1;border-left:4px solid #ffc107;padding:10px 14px;font-size:12px;color:#7a6000;margin:12px 0}
  .footer{border-top:1px solid #e9ecef;padding:16px 36px;text-align:center;color:#aaa;font-size:11px}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>🏥 Klinik Pratama IPB</h1></div>
  <div class="body">
    <p>Halo, <strong>${user.name}</strong>!</p>
    <p>Kami menerima permintaan untuk reset password Anda.</p>
    <p>Klik tombol di bawah untuk membuat password baru:</p>
    <p><a href="${resetLink}" class="button">Reset Password</a></p>
    <div class="note">Link ini akan berlaku selama <strong>15 menit</strong>. Jika Anda tidak meminta reset password, abaikan email ini.</div>
  </div>
  <div class="footer">© ${new Date().getFullYear()} Klinik Pratama IPB — Email otomatis, jangan dibalas.</div>
</div>
</body></html>`;
        await transactionalEmailsApi.sendTransacEmail(sendSmtpEmail);

        res.json({ message: 'Jika email terdaftar, link reset password akan dikirim ke email Anda.' });
    } catch (err) {
        console.error('[auth] forgot-password:', err);
        res.status(500).json({ message: 'Gagal mengirim email.' });
    }
});

router.get('/reset-password/validate', async (req, res) => {
    try {
        const { token, email } = req.query;
        if (!token || !email) return res.status(400).json({ message: 'Token atau email tidak valid.' });
        const hashed = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            where: {
                email: decodeURIComponent(email),
                resetPasswordToken: hashed,
                resetPasswordExpires: { [Op.gt]: new Date() }
            }
        });
        if (!user) return res.status(400).json({ message: 'Link tidak valid atau sudah kedaluwarsa.' });
        res.json({ valid: true, name: user.name });
    } catch (err) {
        console.error('[auth] reset-password/validate:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/reset-password', [
    body('token').notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password')
        .isLength({ min: 8 }).withMessage('Password minimal 8 karakter')
        .matches(/[A-Z]/).withMessage('Password harus mengandung huruf besar')
        .matches(/[a-z]/).withMessage('Password harus mengandung huruf kecil')
        .matches(/[0-9]/).withMessage('Password harus mengandung angka'),
    body('confirmPassword').notEmpty(),
], async (req, res) => {
    try {
        const errs = validationResult(req);
        if (!errs.isEmpty()) return res.status(400).json({ message: errs.array()[0].msg });
        const { token, email, password, confirmPassword } = req.body;
        if (password !== confirmPassword)
            return res.status(400).json({ message: 'Konfirmasi password tidak cocok.' });
        const hashed = crypto.createHash('sha256').update(token).digest('hex');
        const user   = await User.findOne({
            where: {
                email,
                resetPasswordToken: hashed,
                resetPasswordExpires: { [Op.gt]: new Date() }
            }
        });
        if (!user) return res.status(400).json({ message: 'Link tidak valid atau sudah kedaluwarsa.' });
        user.password             = password;
        user.resetPasswordToken   = null;
        user.resetPasswordExpires = null;
        await user.save();
        res.json({ message: 'Password berhasil diubah.' });
    } catch (err) {
        console.error('[auth] reset-password:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;