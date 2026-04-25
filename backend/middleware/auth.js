const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // Support token via query param untuk download PDF via window.open
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;
    
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('FATAL: JWT_SECRET tidak dikonfigurasi di .env!');
        return res.status(500).json({ message: 'Konfigurasi server error' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};