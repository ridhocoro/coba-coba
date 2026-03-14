const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name        : { type: String, required: true },
    email       : { type: String, required: true, unique: true },
    password    : { type: String, required: true },
    phone       : { type: String, required: true },
    dateOfBirth : { type: Date },
    gender      : { type: String, enum: ['laki-laki', 'perempuan', ''], default: '' },
    address     : {
        street: String, city: String,
        province: String, postalCode: String,
    },
    role     : { type: String, enum: ['user', 'mahasiswa', 'doctor', 'admin'], default: 'user' },
    isActive : { type: Boolean, default: true },

    // ── Email verification OTP ───────────────────────────────────────────────
    isVerified           : { type: Boolean, default: false },
    emailOtp             : { type: String  },  // plaintext sementara (di-hash saat set)
    emailOtpExpires      : { type: Date    },
    emailOtpInvalidated  : { type: Boolean, default: false },

    // ── OTP resend rate-limit (per email, persistent) ────────────────────────
    otpResendCount       : { type: Number, default: 0 },
    otpResendWindowStart : { type: Date   },

    // ── Reset password ───────────────────────────────────────────────────────
    resetPasswordToken   : String,
    resetPasswordExpires : Date,

    createdAt : { type: Date, default: Date.now },
});

// Index agar cron cleanup lebih efisien
userSchema.index({ isVerified: 1, createdAt: 1 });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);