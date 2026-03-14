const express    = require('express');
const router     = express.Router();
const { body, validationResult } = require('express-validator');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const User       = require('../models/User');
const auth       = require('../middleware/auth');

// ─── Nodemailer Transporter ───────────────────────────────────────────────────
const createTransporter = () => nodemailer.createTransport({
    host  : process.env.SMTP_HOST || 'smtp.gmail.com',
    port  : parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth  : { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// ─── Rate Limit Store — untuk forgot-password (in-memory) ────────────────────
const rateLimitStore = new Map();
const RATE_LIMIT_MAX    = 3;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 menit

const checkRateLimit = (email) => {
    const now    = Date.now();
    const record = rateLimitStore.get(email);
    if (!record || now - record.firstRequestAt > RATE_LIMIT_WINDOW) {
        rateLimitStore.set(email, { count: 1, firstRequestAt: now });
        return { allowed: true };
    }
    if (record.count >= RATE_LIMIT_MAX) {
        const waitMin = Math.ceil((RATE_LIMIT_WINDOW - (now - record.firstRequestAt)) / 60000);
        return { allowed: false, waitMin };
    }
    record.count += 1;
    return { allowed: true };
};

// ─── OTP Store (in-memory, hashed, server-side only) ─────────────────────────
// Struktur: email → { hashedOtp, expiresAt, attempts, lastSentAt }
// TIDAK pernah menyimpan OTP plaintext di server
const otpStore = new Map();

const OTP_EXPIRE_MS    = 10 * 60 * 1000; // 10 menit
const OTP_MAX_ATTEMPTS = 5;              // maks 5x percobaan salah → OTP hangus
const OTP_RESEND_WAIT  = 60 * 1000;     // 60 detik cooldown kirim ulang
const OTP_RATE_MAX     = 5;             // maks 5 request OTP per jam per email
const OTP_RATE_WINDOW  = 60 * 60 * 1000;

const otpRateLimitStore = new Map();

const checkOtpRateLimit = (email) => {
    const now = Date.now();
    const rec = otpRateLimitStore.get(email);
    if (!rec || now - rec.windowStart > OTP_RATE_WINDOW) {
        otpRateLimitStore.set(email, { count: 1, windowStart: now });
        return { allowed: true };
    }
    if (rec.count >= OTP_RATE_MAX) {
        const waitMin = Math.ceil((OTP_RATE_WINDOW - (now - rec.windowStart)) / 60000);
        return { allowed: false, waitMin };
    }
    rec.count += 1;
    return { allowed: true };
};

// Generate OTP — kembalikan plaintext (untuk dikirim email) + hash (untuk disimpan)
const generateOtp = () => {
    const otp    = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed = crypto.createHash('sha256').update(otp).digest('hex');
    return { otp, hashed };
};

// Bersihkan otpStore dari entry yang sudah expired (setiap 5 menit)
setInterval(() => {
    const now = Date.now();
    for (const [email, data] of otpStore.entries()) {
        if (now > data.expiresAt) otpStore.delete(email);
    }
    for (const [email, data] of rateLimitStore.entries()) {
        if (now - data.firstRequestAt > RATE_LIMIT_WINDOW) rateLimitStore.delete(email);
    }
    for (const [email, data] of otpRateLimitStore.entries()) {
        if (now - data.windowStart > OTP_RATE_WINDOW) otpRateLimitStore.delete(email);
    }
}, 5 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/send-otp
// Kirim OTP 6-digit ke email. Email harus belum terdaftar.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send-otp', [
    body('email')
        .isEmail().withMessage('Format email tidak valid')
        .normalizeEmail(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg });
        }

        const { email } = req.body;

        // Rate limit per email
        const rateCheck = checkOtpRateLimit(email);
        if (!rateCheck.allowed) {
            return res.status(429).json({
                message: `Terlalu banyak permintaan OTP. Coba lagi dalam ${rateCheck.waitMin} menit.`
            });
        }

        // Email sudah terdaftar? Tolak (hindari user lama request OTP berulang)
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: 'Email sudah terdaftar. Silakan login.' });
        }

        // Cooldown kirim ulang (60 detik)
        const prev = otpStore.get(email);
        if (prev) {
            const secondsLeft = Math.ceil((prev.lastSentAt + OTP_RESEND_WAIT - Date.now()) / 1000);
            if (secondsLeft > 0) {
                return res.status(429).json({
                    message : `Harap tunggu ${secondsLeft} detik sebelum kirim ulang OTP.`,
                    secondsLeft
                });
            }
        }

        const { otp, hashed } = generateOtp();

        // Simpan HANYA hash — plaintext OTP tidak disimpan di server
        otpStore.set(email, {
            hashedOtp : hashed,
            expiresAt : Date.now() + OTP_EXPIRE_MS,
            attempts  : 0,
            lastSentAt: Date.now(),
        });

        // Kirim email
        const transporter = createTransporter();
        await transporter.sendMail({
            from   : `"Klinik Pratama IPB" <${process.env.SMTP_USER}>`,
            to     : email,
            subject: 'Kode OTP Pendaftaran – Klinik Pratama IPB',
            html   : `
<!DOCTYPE html><html>
<head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
  .wrap{max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08)}
  .hdr{background:linear-gradient(135deg,#0d6efd,#0a58ca);padding:32px 40px;text-align:center}
  .hdr h1{color:#fff;margin:0;font-size:22px}.hdr p{color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px}
  .body{padding:36px 40px;text-align:center}
  .body p{color:#444;font-size:15px;line-height:1.6;margin:0 0 12px;text-align:left}
  .otp{background:#f0f5ff;border:2px dashed #0d6efd;border-radius:12px;padding:20px 10px;margin:20px 0;
       letter-spacing:12px;font-size:38px;font-weight:700;color:#0d6efd;text-align:center}
  .note{background:#fff8e1;border-left:4px solid #ffc107;border-radius:4px;padding:12px 16px;
        font-size:13px;color:#7a6000;margin-bottom:16px;text-align:left}
  .ftr{border-top:1px solid #e9ecef;padding:16px 40px;text-align:center;color:#aaa;font-size:12px}
</style></head>
<body>
  <div class="wrap">
    <div class="hdr"><h1>🏥 Klinik Pratama IPB</h1><p>Verifikasi Email Pendaftaran</p></div>
    <div class="body">
      <p>Halo! Gunakan kode OTP berikut untuk menyelesaikan pendaftaran akun Anda:</p>
      <div class="otp">${otp}</div>
      <div class="note">⏰ <strong>Berlaku 10 menit</strong> · Jangan bagikan kode ini kepada siapapun termasuk pihak klinik.</div>
      <p style="font-size:13px;color:#888">Jika Anda tidak meminta kode ini, abaikan email ini. Tidak ada tindakan yang perlu dilakukan.</p>
    </div>
    <div class="ftr">© ${new Date().getFullYear()} Klinik Pratama IPB — Email otomatis, jangan dibalas.</div>
  </div>
</body></html>
            `,
        });

        res.json({ message: 'Kode OTP telah dikirim ke email Anda. Berlaku 10 menit.' });

    } catch (error) {
        console.error('[OTP] send-otp error:', error);
        res.status(500).json({ message: 'Gagal mengirim OTP. Silakan coba lagi.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Register + validasi OTP dalam satu langkah.
// OTP divalidasi ulang di sini (bukan hanya di /verify-otp) agar tidak bisa dibypass.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register', [
    body('name').trim().isLength({ min: 3 }).withMessage('Nama minimal 3 karakter'),
    body('email').isEmail().normalizeEmail().withMessage('Format email tidak valid'),
    body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter')
        .matches(/[0-9]/).withMessage('Password harus mengandung angka'),
    body('phone').notEmpty().withMessage('Nomor telepon harus diisi'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric()
        .withMessage('OTP harus 6 digit angka'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg });
        }

        const { name, email, password, phone, otp, address } = req.body;

        // ── Validasi OTP ──────────────────────────────────────────────────────
        const record = otpStore.get(email);

        if (!record) {
            return res.status(400).json({ message: 'OTP tidak ditemukan atau sudah kedaluwarsa. Kirim ulang OTP terlebih dahulu.' });
        }
        if (Date.now() > record.expiresAt) {
            otpStore.delete(email);
            return res.status(400).json({ message: 'OTP sudah kedaluwarsa. Silakan kirim ulang.' });
        }
        if (record.attempts >= OTP_MAX_ATTEMPTS) {
            otpStore.delete(email);
            return res.status(429).json({ message: 'Terlalu banyak percobaan OTP salah. Silakan kirim ulang.' });
        }

        const hashedInput = crypto.createHash('sha256').update(otp).digest('hex');
        if (hashedInput !== record.hashedOtp) {
            record.attempts += 1;
            const remaining = OTP_MAX_ATTEMPTS - record.attempts;
            if (remaining <= 0) {
                otpStore.delete(email);
                return res.status(400).json({ message: 'OTP salah. Batas percobaan habis. Silakan kirim ulang OTP.' });
            }
            return res.status(400).json({
                message     : `OTP salah. Sisa percobaan: ${remaining}.`,
                attemptsLeft: remaining
            });
        }

        // ── Cek email belum terdaftar (double check) ──────────────────────────
        const existing = await User.findOne({ email });
        if (existing) {
            otpStore.delete(email);
            return res.status(400).json({ message: 'Email sudah terdaftar. Silakan login.' });
        }

        // ── Buat user baru ─────────────────────────────────────────────────────
        const user = new User({ name, email, password, phone, address });
        await user.save();

        // Hapus OTP setelah register berhasil (one-time use)
        otpStore.delete(email);

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) throw new Error('JWT_SECRET tidak dikonfigurasi');

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            jwtSecret,
            { expiresIn: process.env.JWT_EXPIRE || '24h' }
        );

        res.status(201).json({
            token,
            user: { id: user._id, name, email, role: user.role }
        });

    } catch (error) {
        console.error('[Auth] register error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
], async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Email atau password salah' });
        }
        if (user.isActive === false) {
            return res.status(403).json({ message: 'Akun Anda telah dinonaktifkan. Hubungi admin.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Email atau password salah' });
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) throw new Error('JWT_SECRET tidak dikonfigurasi');

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            jwtSecret,
            { expiresIn: process.env.JWT_EXPIRE || '24h' }
        );

        res.json({ token, user: { id: user._id, name: user.name, email, role: user.role } });

    } catch (error) {
        console.error('[Auth] login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', [
    body('email').isEmail().normalizeEmail().withMessage('Email tidak valid'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg });
        }

        const { email } = req.body;

        const rateCheck = checkRateLimit(email);
        if (!rateCheck.allowed) {
            return res.status(429).json({
                message: `Terlalu banyak permintaan. Coba lagi dalam ${rateCheck.waitMin} menit.`
            });
        }

        const user = await User.findOne({ email });
        // Response generik agar tidak bisa enumerate user
        if (!user) {
            return res.json({ message: 'Jika email terdaftar, link reset password akan dikirim.' });
        }
        if (!user.isActive) {
            return res.status(403).json({ message: 'Akun Anda telah dinonaktifkan. Hubungi admin.' });
        }

        const resetToken  = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.resetPasswordToken   = hashedToken;
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
        await user.save();

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetLink   = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

        const transporter = createTransporter();
        await transporter.sendMail({
            from   : `"Klinik Pratama IPB" <${process.env.SMTP_USER}>`,
            to     : email,
            subject: 'Reset Password – Klinik Pratama IPB',
            html   : `
<!DOCTYPE html><html>
<head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
  .wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08)}
  .hdr{background:linear-gradient(135deg,#0d6efd,#0a58ca);padding:32px 40px;text-align:center}
  .hdr h1{color:#fff;margin:0;font-size:22px}.hdr p{color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px}
  .body{padding:36px 40px}
  .body p{color:#444;font-size:15px;line-height:1.6;margin:0 0 16px}
  .btn{display:inline-block;padding:14px 36px;background:#0d6efd;color:#fff!important;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;margin:8px 0 24px}
  .note{background:#fff8e1;border-left:4px solid #ffc107;border-radius:4px;padding:12px 16px;font-size:13px;color:#7a6000;margin-bottom:16px}
  .link-box{background:#f1f3f5;border-radius:6px;padding:10px 14px;font-size:12px;color:#555;word-break:break-all;margin-bottom:24px}
  .ftr{border-top:1px solid #e9ecef;padding:20px 40px;text-align:center;color:#aaa;font-size:12px}
</style></head>
<body>
  <div class="wrap">
    <div class="hdr"><h1>🏥 Klinik Pratama IPB</h1><p>Reset Password Akun Anda</p></div>
    <div class="body">
      <p>Halo, <strong>${user.name}</strong>!</p>
      <p>Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah:</p>
      <div style="text-align:center"><a href="${resetLink}" class="btn">Reset Password Saya</a></div>
      <div class="note">⏰ <strong>Link berlaku 15 menit</strong> dan hanya bisa digunakan satu kali.</div>
      <p>Jika tombol tidak berfungsi, salin link ini ke browser:</p>
      <div class="link-box">${resetLink}</div>
      <p>Jika Anda tidak meminta ini, abaikan email ini.</p>
    </div>
    <div class="ftr">© ${new Date().getFullYear()} Klinik Pratama IPB — Email otomatis, jangan dibalas.</div>
  </div>
</body></html>
            `,
        });

        res.json({ message: 'Jika email terdaftar, link reset password akan dikirim.' });

    } catch (error) {
        console.error('[Auth] forgot-password error:', error);
        res.status(500).json({ message: 'Gagal mengirim email. Silakan coba lagi.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/reset-password/validate
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reset-password/validate', async (req, res) => {
    try {
        const { token, email } = req.query;
        if (!token || !email) {
            return res.status(400).json({ message: 'Token atau email tidak valid.' });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            email             : decodeURIComponent(email),
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: 'Link tidak valid atau sudah kedaluwarsa.' });
        }

        res.json({ valid: true, name: user.name });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-password', [
    body('token').notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
    body('confirmPassword').notEmpty(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg });
        }

        const { token, email, password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Konfirmasi password tidak cocok.' });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            email,
            resetPasswordToken  : hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: 'Link tidak valid atau sudah kedaluwarsa.' });
        }

        user.password             = password;
        user.resetPasswordToken   = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password berhasil diubah. Silakan login.' });

    } catch (error) {
        console.error('[Auth] reset-password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;