const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const auth = require('../middleware/auth');

// ─── Nodemailer Transporter ───────────────────────────────────────────────────
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// ─── Rate Limit Store (in-memory) ────────────────────────────────────────────
const rateLimitStore = new Map();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 menit

const checkRateLimit = (email) => {
  const now = Date.now();
  const record = rateLimitStore.get(email);

  if (!record || now - record.firstRequestAt > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(email, { count: 1, firstRequestAt: now });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    const waitMs = RATE_LIMIT_WINDOW - (now - record.firstRequestAt);
    const waitMin = Math.ceil(waitMs / 60000);
    return { allowed: false, waitMin };
  }

  record.count += 1;
  return { allowed: true };
};

// ─── Register ─────────────────────────────────────────────────────────────────
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty(),
  body('phone').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, phone, address } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'Email sudah terdaftar' });
    }

    user = new User({ name, email, password, phone, address });
    await user.save();

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET tidak dikonfigurasi di .env!');

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    res.status(201).json({ token, user: { id: user._id, name, email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
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
    if (!jwtSecret) throw new Error('JWT_SECRET tidak dikonfigurasi di .env!');

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    res.json({ token, user: { id: user._id, name: user.name, email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Get Current User ─────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Forgot Password ──────────────────────────────────────────────────────────
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Email tidak valid')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { email } = req.body;

    // Rate limit check
    const rateCheck = checkRateLimit(email);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        message: `Terlalu banyak permintaan. Silakan coba lagi dalam ${rateCheck.waitMin} menit.`
      });
    }

    const user = await User.findOne({ email });

    // Response generik agar tidak bisa enumerate user (security)
    if (!user) {
      return res.json({
        message: 'Jika email terdaftar, link reset password akan dikirim ke email Anda.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Akun Anda telah dinonaktifkan. Hubungi admin.' });
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 menit
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Klinik Pratama IPB" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset Password - Klinik Pratama IPB',
      html: `
        <!DOCTYPE html><html>
        <head><meta charset="UTF-8"><style>
          body{font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
          .container{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08)}
          .header{background:linear-gradient(135deg,#0d6efd,#0a58ca);padding:32px 40px;text-align:center}
          .header h1{color:#fff;margin:0;font-size:22px}
          .header p{color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px}
          .body{padding:36px 40px}
          .body p{color:#444;font-size:15px;line-height:1.6;margin:0 0 16px}
          .btn{display:inline-block;padding:14px 36px;background:#0d6efd;color:#fff!important;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;margin:8px 0 24px}
          .note{background:#fff8e1;border-left:4px solid #ffc107;border-radius:4px;padding:12px 16px;font-size:13px;color:#7a6000;margin-bottom:16px}
          .link-box{background:#f1f3f5;border-radius:6px;padding:10px 14px;font-size:12px;color:#555;word-break:break-all;margin-bottom:24px}
          .footer{border-top:1px solid #e9ecef;padding:20px 40px;text-align:center;color:#aaa;font-size:12px}
        </style></head>
        <body>
          <div class="container">
            <div class="header"><h1>🏥 Klinik Pratama IPB</h1><p>Reset Password Akun Anda</p></div>
            <div class="body">
              <p>Halo, <strong>${user.name}</strong>!</p>
              <p>Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah untuk membuat password baru:</p>
              <div style="text-align:center"><a href="${resetLink}" class="btn">Reset Password Saya</a></div>
              <div class="note">⏰ <strong>Link ini hanya berlaku 15 menit</strong> dan hanya bisa digunakan satu kali.</div>
              <p>Jika tombol tidak berfungsi, salin link berikut ke browser Anda:</p>
              <div class="link-box">${resetLink}</div>
              <p>Jika Anda tidak meminta reset password, abaikan email ini. Akun Anda tetap aman.</p>
            </div>
            <div class="footer">© ${new Date().getFullYear()} Klinik Pratama IPB — Email otomatis, jangan dibalas.</div>
          </div>
        </body></html>
      `,
    });

    res.json({ message: 'Jika email terdaftar, link reset password akan dikirim ke email Anda.' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Gagal mengirim email. Silakan coba lagi.' });
  }
});

// ─── Validate Reset Token ─────────────────────────────────────────────────────
router.get('/reset-password/validate', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({ message: 'Token atau email tidak valid.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      email: decodeURIComponent(email),
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: 'Link tidak valid atau sudah kedaluwarsa. Silakan minta link baru.'
      });
    }

    res.json({ valid: true, name: user.name });
  } catch (error) {
    console.error('Validate token error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Reset Password ───────────────────────────────────────────────────────────
router.post('/reset-password', [
  body('token').notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
  body('confirmPassword').notEmpty()
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
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: 'Link tidak valid atau sudah kedaluwarsa. Silakan minta link baru.'
      });
    }

    // Update password & hapus token (hanya bisa sekali)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password berhasil diubah. Silakan login dengan password baru Anda.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
