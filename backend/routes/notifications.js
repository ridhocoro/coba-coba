const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// GET all notifications for current user
router.get('/', auth, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.userId })
            .sort('-createdAt')
            .limit(50);
        
        const unreadCount = await Notification.countDocuments({ 
            userId: req.userId, 
            isRead: false 
        });
        
        res.json({
            success: true,
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET unread count
router.get('/unread-count', auth, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ 
            userId: req.userId, 
            isRead: false 
        });
        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// MARK as read
router.put('/:id/read', auth, async (req, res) => {
    try {
        await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { isRead: true, readAt: new Date() }
        );
        
        const unreadCount = await Notification.countDocuments({ 
            userId: req.userId, 
            isRead: false 
        });
        
        res.json({ success: true, unreadCount });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// MARK all as read
router.put('/read-all', auth, async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.userId, isRead: false },
            { isRead: true, readAt: new Date() }
        );
        
        res.json({ success: true, unreadCount: 0 });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE notification
router.delete('/:id', auth, async (req, res) => {
    try {
        await Notification.findOneAndDelete({ 
            _id: req.params.id, 
            userId: req.userId 
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;