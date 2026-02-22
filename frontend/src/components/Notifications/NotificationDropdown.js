import React, { useRef, useEffect } from 'react';
import { Badge, ListGroup, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { 
    FaUserMd, FaCreditCard, FaTruck, FaClock, 
    FaFileMedical, FaBell, FaCheckCircle, FaComment,
    FaCalendarAlt, FaBox, FaMoneyBillWave
} from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

const NotificationDropdown = () => {
    const { 
        notifications, 
        unreadCount, 
        showDropdown, 
        setShowDropdown,
        markAllAsRead,
        handleNotificationClick 
    } = useNotifications();
    
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setShowDropdown]);

    const getIcon = (type) => {
        switch(type) {
            case 'consultation_request':
                return <FaUserMd className="text-primary" />;
            case 'consultation_started':
                return <FaComment className="text-info" />;
            case 'consultation_ended':
                return <FaCheckCircle className="text-success" />;
            case 'new_message':
                return <FaComment className="text-primary" />;
            case 'payment_success':
            case 'payment_verified':
                return <FaMoneyBillWave className="text-success" />;
            case 'order_shipped':
                return <FaTruck className="text-info" />;
            case 'order_delivered':
                return <FaCheckCircle className="text-success" />;
            case 'appointment_reminder':
                return <FaCalendarAlt className="text-warning" />;
            case 'sick_letter_draft':
                return <FaFileMedical className="text-secondary" />;
            case 'sick_letter_issued':
                return <FaFileMedical className="text-danger" />;
            default:
                return <FaBell className="text-secondary" />;
        }
    };

    const formatTime = (date) => {
        return formatDistanceToNow(new Date(date), { 
            addSuffix: true,
            locale: id 
        });
    };

    return (
        <div className="position-relative" ref={dropdownRef}>
            <button 
                className="btn btn-link position-relative text-dark p-2"
                onClick={() => setShowDropdown(!showDropdown)}
                style={{ textDecoration: 'none' }}
            >
                <FaBell size={20} />
                {unreadCount > 0 && (
                    <Badge 
                        bg="danger" 
                        pill 
                        className="position-absolute top-0 start-100 translate-middle"
                        style={{ fontSize: '0.7rem' }}
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                )}
            </button>

            {showDropdown && (
                <div 
                    className="position-absolute bg-white shadow-lg rounded"
                    style={{ 
                        width: '380px', 
                        maxHeight: '450px',
                        overflowY: 'auto',
                        right: '0',
                        top: '45px',
                        zIndex: 1000,
                        border: '1px solid rgba(0,0,0,0.1)'
                    }}
                >
                    <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                        <h6 className="mb-0 fw-bold">Notifikasi</h6>
                        {unreadCount > 0 && (
                            <Button 
                                variant="link" 
                                size="sm"
                                onClick={markAllAsRead}
                                className="text-decoration-none p-0"
                            >
                                Tandai semua dibaca
                            </Button>
                        )}
                    </div>

                    {notifications.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <FaBell size={40} className="mb-3 opacity-50" />
                            <p className="small mb-0">Tidak ada notifikasi</p>
                        </div>
                    ) : (
                        <ListGroup variant="flush">
                            {notifications.map(notif => (
                                <ListGroup.Item 
                                    key={notif._id}
                                    action
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`d-flex align-items-start p-3 border-bottom ${!notif.isRead ? 'bg-light' : ''}`}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="me-3 mt-1" style={{ fontSize: '1.2rem' }}>
                                        {getIcon(notif.type)}
                                    </div>
                                    <div className="flex-grow-1">
                                        <div className="d-flex justify-content-between">
                                            <strong className={!notif.isRead ? 'text-primary' : ''}>
                                                {notif.title}
                                            </strong>
                                            <small className="text-muted ms-2">
                                                {formatTime(notif.createdAt)}
                                            </small>
                                        </div>
                                        <p className="small text-muted mb-0">
                                            {notif.message}
                                        </p>
                                    </div>
                                    {!notif.isRead && (
                                        <div className="ms-2">
                                            <span className="badge bg-primary rounded-pill" style={{ width: '8px', height: '8px', padding: 0 }}> </span>
                                        </div>
                                    )}
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    )}

                    <div className="p-2 border-top text-center">
                        <Link 
                            to="/notifications" 
                            className="text-decoration-none small"
                            onClick={() => setShowDropdown(false)}
                        >
                            Lihat semua notifikasi
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;