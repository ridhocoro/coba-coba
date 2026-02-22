import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import io from 'socket.io-client';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [socket, setSocket] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                'http://localhost:5000/api/notifications',
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNotifications(response.data.notifications);
            setUnreadCount(response.data.unreadCount);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;

        // Koneksi Socket.io
        const newSocket = io('http://localhost:5000');
        setSocket(newSocket);

        // Join user room
        newSocket.emit('join-user', user.id);

        // Listen for new notifications
        newSocket.on('new-notification', (notification) => {
            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(prev => prev + 1);
            
            // Tampilkan toast berdasarkan tipe notifikasi
            const toastMessages = {
                consultation_request: '📋 Permintaan konsultasi baru',
                new_message: '💬 Pesan baru',
                sick_letter_issued: '📄 Surat sakit telah terbit',
                payment_verified: '💰 Pembayaran diverifikasi',
                order_shipped: '📦 Pesanan obat dikirim',
                order_delivered: '✅ Pesanan obat sampai'
            };
            
            toast.success(toastMessages[notification.type] || notification.title, {
                duration: 5000,
                position: 'top-right'
            });
        });

        // Listen for unread count updates
        newSocket.on('unread-count', (count) => {
            setUnreadCount(count);
        });

        // Fetch existing notifications
        fetchNotifications();

        return () => {
            newSocket.close();
        };
    }, [user, fetchNotifications]);

    const markAsRead = async (notificationId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.put(
                `http://localhost:5000/api/notifications/${notificationId}/read`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setUnreadCount(response.data.unreadCount);
            setNotifications(prev =>
                prev.map(n =>
                    n._id === notificationId ? { ...n, isRead: true } : n
                )
            );
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(
                'http://localhost:5000/api/notifications/read-all',
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setUnreadCount(0);
            setNotifications(prev =>
                prev.map(n => ({ ...n, isRead: true }))
            );
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const handleNotificationClick = (notification) => {
        // Mark as read if not already read
        if (!notification.isRead) {
            markAsRead(notification._id);
        }
        
        // Navigate to the URL
        if (notification.data?.url) {
            window.location.href = notification.data.url;
        }
        
        setShowDropdown(false);
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            showDropdown,
            setShowDropdown,
            markAsRead,
            markAllAsRead,
            handleNotificationClick,
            fetchNotifications
        }}>
            {children}
        </NotificationContext.Provider>
    );
};