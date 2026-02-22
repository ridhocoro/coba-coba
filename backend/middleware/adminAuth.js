const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    if (!req.userId) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    if (req.userRole !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    next();
};