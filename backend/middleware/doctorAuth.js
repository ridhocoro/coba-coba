const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // Auth middleware harus dipanggil sebelum ini
    if (!req.userId) {
        return res.status(401).json({ 
            success: false,
            message: 'No token, authorization denied' 
        });
    }

    // Cek apakah user adalah dokter
    if (req.userRole !== 'doctor') {
        return res.status(403).json({ 
            success: false,
            message: 'Access denied. Doctor only.' 
        });
    }

    // Log hanya saat development
    if (process.env.NODE_ENV !== 'production') {
        // Throttle: hanya log sekali per userId per 60 detik agar tidak spam
        const now = Date.now();
        if (!global._doctorAuthLog) global._doctorAuthLog = {};
        if (!global._doctorAuthLog[req.userId] || now - global._doctorAuthLog[req.userId] > 60000) {
            global._doctorAuthLog[req.userId] = now;
            console.log(`[Auth] Doctor verified: ${req.userId} (${new Date().toLocaleTimeString('id-ID')})`);
        }
    }
    next();
};