import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import io from 'socket.io-client';
import api, { API_URL } from '../utils/api';
import { toast } from 'react-hot-toast';

const NotificationContext = createContext();
export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [socket, setSocket] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const response = await api.get('/api/notifications');
            setNotifications(response.data.notifications);
            setUnreadCount(response.data.unreadCount);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const newSocket = io(API_URL, {
            auth: { token: localStorage.getItem('token') },
            query: { userId: user.id }
        });
        setSocket(newSocket);
        newSocket.emit('join-user', user.id);

        newSocket.on('new-notification', (notification) => {
            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(prev => prev + 1);
            const toastMessages = {
                consultation_request: '📋 Permintaan konsultasi baru',
                new_message: '💬 Pesan baru',
                consultation_reply: '💬 Dokter membalas pesan Anda',
                sick_letter_issued: '📄 Surat sakit telah terbit',
                appointment_request: '📅 Permintaan janji temu baru',
                payment_verified: '💰 Pembayaran diverifikasi',
                payment_pending: '💰 Pembayaran menunggu verifikasi',
                order_shipped: '📦 Pesanan obat dikirim',
                appointment_confirmed: '✅ Janji temu dikonfirmasi',
                appointment_rejected: '❌ Janji temu ditolak',
            };
            toast.success(toastMessages[notification.type] || notification.title, { duration: 5000 });
        });

        newSocket.on('unread-count', (count) => setUnreadCount(count));
        fetchNotifications();

        return () => { newSocket.close(); };
    }, [user, fetchNotifications]);

    const markAsRead = async (notificationId) => {
        try {
            const response = await api.put(`/api/notifications/${notificationId}/read`);
            setUnreadCount(response.data.unreadCount);
            setNotifications(prev => prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n));
        } catch (error) { console.error('Error marking as read:', error); }
    };

    const markAllAsRead = async () => {
        try {
            await api.put('/api/notifications/read-all');
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (error) { console.error('Error marking all as read:', error); }
    };

    const handleNotificationClick = (notification) => {
        if (!notification.isRead) markAsRead(notification._id);
        if (notification.data?.url) {
            // BUG-26 fix: use React Router navigate() — window.location.href resets all React state
            navigate(notification.data.url);
        }
        setShowDropdown(false);
    };

    return (
        <NotificationContext.Provider value={{
            notifications, unreadCount, showDropdown, setShowDropdown,
            markAsRead, markAllAsRead, handleNotificationClick, fetchNotifications,
            // BUG-23 fix: expose socket so pages (Consultations, ConsultationChat) can
            // reuse this connection instead of creating a duplicate socket
            socket,
        }}>
            {children}
        </NotificationContext.Provider>
    );
};