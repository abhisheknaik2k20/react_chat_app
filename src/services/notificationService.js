import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    updateDoc,
    doc,
    where,
    getDocs,
    writeBatch,
    limit
} from 'firebase/firestore';
import { db, requestNotificationPermission, onMessageListener } from '../firebase_config';

class NotificationService {
    constructor() {
        this.notificationPermission = false;
        this.fcmToken = null;
        this.soundEnabled = true;
        this.activeChats = new Set();
        this.notificationQueue = [];
        this.init();
    }

    // Initialize notification service
    async init() {
        try {
            // Initialize sound settings
            this.initSoundSettings();

            // Request notification permission and get FCM token
            this.fcmToken = await requestNotificationPermission();
            this.notificationPermission = !!this.fcmToken;

            if (this.notificationPermission) {
                // Listen for foreground messages
                this.listenForMessages();
            }
        } catch (error) {
            console.error('Error initializing notifications:', error);
        }
    }

    // Listen for foreground FCM messages
    listenForMessages() {
        onMessageListener()
            .then((payload) => {
                console.log('Received foreground message:', payload);
                this.showLocalNotification(payload);
            })
            .catch((err) => console.log('Failed to receive message:', err));
    }

    // Show local notification with enhanced features
    showLocalNotification(payload) {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return;
        }

        const { title, body, icon } = payload.notification || payload.data;
        const type = payload.data?.type || 'message';

        // Skip notification if chat is currently active (user is viewing)
        if (this.activeChats.has(payload.data?.chatRoomId)) {
            return;
        }

        // Play notification sound
        this.playNotificationSound(type);

        const notification = new Notification(title, {
            body,
            icon: icon || '/logo192.png',
            badge: '/logo192.png',
            tag: payload.data?.chatRoomId || 'chat-message',
            requireInteraction: type === 'call',
            silent: !this.soundEnabled,
            data: payload.data
        });

        notification.onclick = (event) => {
            event.preventDefault();
            window.focus();

            // Navigate to specific chat if chatRoomId is provided
            if (payload.data?.chatRoomId) {
                this.navigateToChat(payload.data.chatRoomId);
            }

            notification.close();
        };

        // Auto close after duration based on type
        const duration = type === 'call' ? 30000 : 5000;
        setTimeout(() => {
            notification.close();
        }, duration);

        return notification;
    }

    // Create notification record
    async createNotification(recipientId, senderId, type, data) {
        try {
            const notificationData = {
                recipientId,
                senderId,
                type, // 'message', 'call', 'friend_request', etc.
                data,
                read: false,
                timestamp: serverTimestamp()
            };

            await addDoc(collection(db, 'notifications'), notificationData);
        } catch (error) {
            console.error('Error creating notification:', error);
        }
    }

    // Listen to user notifications
    listenToNotifications(userId, callback) {
        const q = query(
            collection(db, 'notifications'),
            where('recipientId', '==', userId),
            orderBy('timestamp', 'desc')
        );

        return onSnapshot(q, (querySnapshot) => {
            const notifications = [];
            querySnapshot.forEach((doc) => {
                notifications.push({ id: doc.id, ...doc.data() });
            });
            callback(notifications);
        });
    }

    // Mark notification as read
    async markAsRead(notificationId) {
        try {
            const notificationRef = doc(db, 'notifications', notificationId);
            await updateDoc(notificationRef, {
                read: true,
                readAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    // Mark all notifications as read
    async markAllAsRead(userId) {
        try {
            const q = query(
                collection(db, 'notifications'),
                where('recipientId', '==', userId),
                where('read', '==', false)
            );

            const snapshot = await getDocs(q);
            const batch = writeBatch(db);

            snapshot.forEach((doc) => {
                batch.update(doc.ref, {
                    read: true,
                    readAt: serverTimestamp()
                });
            });

            await batch.commit();
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    // Send push notification (this would typically be done server-side)
    async sendPushNotification(fcmToken, title, body, data = {}) {
        // This is a placeholder - in a real app, you'd send this from your backend
        console.log('Push notification would be sent:', {
            token: fcmToken,
            title,
            body,
            data
        });
    }

    // Get notification permission status
    getNotificationPermission() {
        if (!('Notification' in window)) {
            return 'not-supported';
        }
        return Notification.permission;
    }

    // Request notification permission
    async requestPermission() {
        if (!('Notification' in window)) {
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            this.notificationPermission = permission === 'granted';

            if (this.notificationPermission) {
                this.fcmToken = await requestNotificationPermission();
            }

            return this.notificationPermission;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }

    // Get FCM token
    getFCMToken() {
        return this.fcmToken;
    }

    // Schedule local notification (for reminders, etc.)
    scheduleLocalNotification(title, body, delay = 0) {
        setTimeout(() => {
            if (this.notificationPermission) {
                new Notification(title, {
                    body,
                    icon: '/logo192.png',
                    badge: '/logo192.png'
                });
            }
        }, delay);
    }

    // Play notification sound based on type
    playNotificationSound(type = 'message') {
        if (!this.soundEnabled) return;

        try {
            const audio = new Audio();
            switch (type) {
                case 'message':
                    audio.src = '/sounds/message.mp3';
                    break;
                case 'call':
                    audio.src = '/sounds/call.mp3';
                    break;
                case 'notification':
                    audio.src = '/sounds/notification.mp3';
                    break;
                default:
                    audio.src = '/sounds/default.mp3';
            }
            audio.volume = 0.5;
            audio.play().catch(e => console.log('Could not play sound:', e));
        } catch (error) {
            console.log('Error playing notification sound:', error);
        }
    }

    // Set active chat (to suppress notifications)
    setActiveChat(chatRoomId) {
        if (chatRoomId) {
            this.activeChats.add(chatRoomId);
        }
    }

    // Remove active chat
    removeActiveChat(chatRoomId) {
        if (chatRoomId) {
            this.activeChats.delete(chatRoomId);
        }
    }

    // Toggle sound settings
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('notificationSound', this.soundEnabled.toString());
        return this.soundEnabled;
    }

    // Get sound settings
    getSoundEnabled() {
        return this.soundEnabled;
    }

    // Navigate to chat (can be overridden by app)
    navigateToChat(chatRoomId) {
        // This can be overridden by the app to handle navigation
        console.log('Navigate to chat:', chatRoomId);

        // Dispatch custom event for navigation
        window.dispatchEvent(new CustomEvent('navigateToChat', {
            detail: { chatRoomId }
        }));
    }

    // Create community notification
    async createCommunityNotification(communityId, senderId, type, data) {
        try {
            // Get community members
            const membersQuery = query(
                collection(db, 'communities', communityId, 'members')
            );
            const membersSnapshot = await getDocs(membersQuery);

            const batch = writeBatch(db);

            membersSnapshot.forEach((doc) => {
                const memberId = doc.data().userId;
                if (memberId !== senderId) { // Don't notify sender
                    const notificationRef = doc(collection(db, 'notifications'));
                    batch.set(notificationRef, {
                        recipientId: memberId,
                        senderId,
                        type,
                        data: {
                            ...data,
                            communityId
                        },
                        read: false,
                        timestamp: serverTimestamp()
                    });
                }
            });

            await batch.commit();
        } catch (error) {
            console.error('Error creating community notification:', error);
            throw error;
        }
    }

    // Get notification summary
    async getNotificationSummary(userId) {
        try {
            const q = query(
                collection(db, 'notifications'),
                where('recipientId', '==', userId),
                where('read', '==', false),
                orderBy('timestamp', 'desc'),
                limit(10)
            );

            const snapshot = await getDocs(q);
            const notifications = [];
            snapshot.forEach(doc => {
                notifications.push({ id: doc.id, ...doc.data() });
            });

            return {
                unreadCount: notifications.length,
                recentNotifications: notifications
            };
        } catch (error) {
            console.error('Error getting notification summary:', error);
            return { unreadCount: 0, recentNotifications: [] };
        }
    }

    // Batch create notifications
    async batchCreateNotifications(notifications) {
        try {
            const batch = writeBatch(db);

            notifications.forEach(notification => {
                const notificationRef = doc(collection(db, 'notifications'));
                batch.set(notificationRef, {
                    ...notification,
                    timestamp: serverTimestamp()
                });
            });

            await batch.commit();
        } catch (error) {
            console.error('Error batch creating notifications:', error);
            throw error;
        }
    }

    // Initialize sound settings from localStorage
    initSoundSettings() {
        const savedSetting = localStorage.getItem('notificationSound');
        if (savedSetting !== null) {
            this.soundEnabled = savedSetting === 'true';
        }
    }
}

const notificationService = new NotificationService();
export default notificationService;
