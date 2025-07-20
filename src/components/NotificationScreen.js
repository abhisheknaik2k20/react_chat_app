import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase_config';
import './NotificationScreen.css';

const NotificationScreen = ({ toggleSidebar }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const { currentUser } = useAuth();

    useEffect(() => {
        if (!currentUser) return;

        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
            const notificationsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setNotifications(notificationsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const markAsRead = async (notificationId) => {
        try {
            const notificationRef = doc(db, 'notifications', notificationId);
            await updateDoc(notificationRef, {
                read: true,
                readAt: new Date()
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const deleteNotification = async (notificationId) => {
        try {
            await deleteDoc(doc(db, 'notifications', notificationId));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const markAllAsRead = async () => {
        const unreadNotifications = notifications.filter(n => !n.read);
        const updatePromises = unreadNotifications.map(notification =>
            updateDoc(doc(db, 'notifications', notification.id), {
                read: true,
                readAt: new Date()
            })
        );

        try {
            await Promise.all(updatePromises);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'message':
                return '💬';
            case 'call':
                return '📞';
            case 'video_call':
                return '📹';
            case 'community':
                return '👥';
            case 'status':
                return '📸';
            case 'friend_request':
                return '👤';
            default:
                return '🔔';
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const now = new Date();
        const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diffInMinutes = Math.floor((now - time) / (1000 * 60));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
        return time.toLocaleDateString();
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    if (loading) {
        return (
            <div className="notification-screen">
                <div className="loading">
                    <div className="loading-spinner"></div>
                    <p>Loading notifications...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="notification-screen">
            <div className="notification-header">
                <div className="header-content">
                    <h2>Notifications</h2>
                    {unreadCount > 0 && (
                        <button className="mark-all-read-btn" onClick={markAllAsRead}>
                            Mark all as read ({unreadCount})
                        </button>
                    )}
                </div>
            </div>

            <div className="notifications-content">
                {notifications.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🔔</div>
                        <h3>No notifications yet</h3>
                        <p>When you receive messages, calls, or other updates, they'll appear here.</p>
                    </div>
                ) : (
                    <div className="notifications-list">
                        {notifications.map(notification => (
                            <div
                                key={notification.id}
                                className={`notification-item ${!notification.read ? 'unread' : ''}`}
                                onClick={() => !notification.read && markAsRead(notification.id)}
                            >
                                <div className="notification-icon">
                                    {getNotificationIcon(notification.type)}
                                </div>
                                <div className="notification-content">
                                    <div className="notification-title">
                                        {notification.title}
                                    </div>
                                    <div className="notification-message">
                                        {notification.message}
                                    </div>
                                    <div className="notification-time">
                                        {formatTime(notification.createdAt)}
                                    </div>
                                </div>
                                <div className="notification-actions">
                                    {!notification.read && (
                                        <div className="unread-indicator"></div>
                                    )}
                                    <button
                                        className="delete-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteNotification(notification.id);
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Notification Types Legend */}
            <div className="notification-legend">
                <h4>Notification Types</h4>
                <div className="legend-items">
                    <div className="legend-item">
                        <span className="legend-icon">💬</span>
                        <span>Messages</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-icon">📞</span>
                        <span>Voice Calls</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-icon">📹</span>
                        <span>Video Calls</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-icon">👥</span>
                        <span>Communities</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-icon">📸</span>
                        <span>Status Updates</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationScreen;
