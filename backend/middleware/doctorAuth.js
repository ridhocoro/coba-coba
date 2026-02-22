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
    
    console.log('✅ Doctor auth passed for user:', req.userId);
    next();
};