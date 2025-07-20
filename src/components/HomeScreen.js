import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase_config';
import messageService from '../services/messageService';
import userService from '../services/userService';
import notificationService from '../services/notificationService';
import ChatWindow from './ChatWindow';
import ContactsList from './ContactsList';
import ProfileModal from './ProfileModal';
import FileUploadModal from './FileUploadModal';
import CommunitiesModal from './CommunitiesModal';
import './HomeScreen.css';

const HomeScreen = () => {
    const [selectedChat, setSelectedChat] = useState(null);
    const [friends, setFriends] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [showProfile, setShowProfile] = useState(false);
    const [showContacts, setShowContacts] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [showFileUpload, setShowFileUpload] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showCommunities, setShowCommunities] = useState(false);
    const notificationRef = useRef(null);

    const { currentUser, userProfile, logout } = useAuth();
    const navigate = useNavigate();

    // Close notification dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Add friend to Firestore
    const addFriend = async (friendId, friendData) => {
        if (!currentUser || friendId === currentUser.uid) return;

        try {
            const friendRef = doc(db, 'users', currentUser.uid, 'friends', friendId);
            await setDoc(friendRef, {
                id: friendId,
                displayName: friendData.displayName || friendData.email?.split('@')[0] || 'Unknown',
                email: friendData.email || '',
                photoURL: friendData.photoURL || null,
                lastContact: new Date(),
                addedAt: new Date()
            });
            console.log('Friend added to Firestore:', friendId);
        } catch (error) {
            console.error('Error adding friend:', error);
        }
    };

    // Load friends with real-time listener
    useEffect(() => {
        if (!currentUser) return;

        const friendsRef = collection(db, 'users', currentUser.uid, 'friends');
        const friendsQuery = query(friendsRef, orderBy('lastContact', 'desc'));

        const unsubscribe = onSnapshot(friendsQuery, (snapshot) => {
            const friendsList = [];
            snapshot.forEach((doc) => {
                friendsList.push({ id: doc.id, ...doc.data() });
            });
            console.log('Friends loaded:', friendsList.length);
            setFriends(friendsList);
        }, (error) => {
            console.error('Error loading friends:', error);
        });

        return () => unsubscribe();
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) {
            navigate('/auth');
            return;
        }

        // Load user's contacts
        const unsubscribeContacts = userService.listenToUsers(currentUser.uid, (users) => {
            setContacts(users);
        });

        // Listen to notifications
        const unsubscribeNotifications = notificationService.listenToNotifications(
            currentUser.uid,
            (notifications) => {
                setNotifications(notifications);
            }
        );

        // Listen for navigation events from notification service
        const handleNavigateToChat = (event) => {
            const { chatRoomId } = event.detail;
            handleNavigateToChat(chatRoomId);
        };

        window.addEventListener('navigateToChat', handleNavigateToChat);

        return () => {
            unsubscribeContacts();
            unsubscribeNotifications();
            window.removeEventListener('navigateToChat', handleNavigateToChat);
        };
    }, [currentUser, navigate]);

    const handleSelectChat = async (contact) => {
        try {
            console.log('handleSelectChat called with contact:', contact);

            // Remove active chat from notification service (to stop suppressing notifications)
            if (selectedChat?.id) {
                notificationService.removeActiveChat(selectedChat.id);
            }

            // Ensure contact has all required fields
            const sanitizedContact = {
                uid: contact.id || contact.uid,
                email: contact.email || '',
                displayName: contact.displayName || (contact.email ? contact.email.split('@')[0] : 'Unknown User'),
                photoURL: contact.photoURL || null
            };

            console.log('Sanitized contact:', sanitizedContact);
            console.log('Current user:', currentUser);

            const chatRoomId = await messageService.createOrGetChatRoom(currentUser, sanitizedContact);
            const newChat = {
                id: chatRoomId,
                contact: sanitizedContact,
                messages: []
            };

            setSelectedChat(newChat);
            setShowContacts(false);

            // Add this contact as a friend
            await addFriend(sanitizedContact.uid, sanitizedContact);

            // Set this chat as active in notification service (to suppress notifications)
            notificationService.setActiveChat(chatRoomId);
            await markChatNotificationsAsRead(chatRoomId);
        } catch (error) {
            console.error('Error selecting chat:', error);
        }
    };

    const handleSendMessage = async (message, file = null) => {
        if (!selectedChat) return;

        try {
            if (file) {
                await messageService.sendFileMessage(
                    selectedChat.id,
                    file,
                    currentUser.uid,
                    currentUser.email,
                    userProfile?.displayName || currentUser.displayName
                );
            } else {
                await messageService.sendMessage(
                    selectedChat.id,
                    message,
                    currentUser.uid,
                    currentUser.email,
                    userProfile?.displayName || currentUser.displayName
                );
            }

            // Create notification for recipient
            await notificationService.createNotification(
                selectedChat.contact.id,
                currentUser.uid,
                'message',
                {
                    chatRoomId: selectedChat.id,
                    message: file ? 'Sent a file' : message,
                    senderName: userProfile?.displayName || currentUser.displayName
                }
            );

            // Update friend's last contact time
            await addFriend(selectedChat.contact.id, selectedChat.contact);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const filteredContacts = contacts.filter(contact =>
        contact.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getUnreadCount = () => {
        return notifications.filter(n => !n.read).length;
    };

    const handleNavigateToChat = async (chatRoomId) => {
        try {
            // Extract user IDs from chat room ID
            const userIds = chatRoomId.split('_');
            const otherUserId = userIds.find(id => id !== currentUser.uid);

            if (otherUserId) {
                // Find the friend in our friends list
                const friend = friends.find(f => f.id === otherUserId);
                if (friend) {
                    await handleSelectChat(friend);
                } else {
                    // If not in friends list, try to get from contacts
                    const contact = contacts.find(c => c.id === otherUserId);
                    if (contact) {
                        await handleSelectChat(contact);
                    }
                }
            }
        } catch (error) {
            console.error('Error navigating to chat:', error);
        }
    };

    const markChatNotificationsAsRead = async (chatRoomId) => {
        try {
            const chatNotifications = notifications.filter(
                n => !n.read && n.data?.chatRoomId === chatRoomId
            );

            for (const notification of chatNotifications) {
                await notificationService.markAsRead(notification.id);
            }
        } catch (error) {
            console.error('Error marking chat notifications as read:', error);
        }
    };

    const handleNotificationClick = () => {
        setShowNotifications(!showNotifications);
    };

    const handleMarkAllNotificationsRead = async () => {
        try {
            await notificationService.markAllAsRead(currentUser.uid);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const formatNotificationTime = (timestamp) => {
        if (!timestamp) return '';

        let date;
        if (timestamp.toDate) {
            // Firestore timestamp
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            // JavaScript Date object
            date = timestamp;
        } else {
            // String or number timestamp
            date = new Date(timestamp);
        }

        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const renderFriendsList = () => {
        // Filter friends based on search query
        const filteredFriends = friends.filter((friend) => {
            const name = friend.displayName || friend.email || '';
            return name.toLowerCase().includes(searchQuery.toLowerCase());
        });

        // Filter contacts that haven't been added as friends yet but match search
        const filteredNewContacts = searchQuery ? contacts.filter(contact => {
            const isAlreadyFriend = friends.some(friend => friend.id === contact.id);
            const matchesSearch = contact.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                contact.email?.toLowerCase().includes(searchQuery.toLowerCase());
            return !isAlreadyFriend && matchesSearch;
        }) : [];

        if (filteredFriends.length === 0 && filteredNewContacts.length === 0) {
            if (searchQuery) {
                return (
                    <div className="no-chats">
                        <div className="no-chats-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                <path d="M9 10h6" />
                                <path d="M9 14h3" />
                            </svg>
                        </div>
                        <h3>No friends found</h3>
                        <p>No friends found for "{searchQuery}"</p>
                        <p>Try searching with a different term</p>
                    </div>
                );
            } else {
                return (
                    <div className="no-chats">
                        <div className="no-chats-icon">
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                <path d="M12 8v8" />
                                <path d="M8 12h8" />
                            </svg>
                        </div>
                        <h3>Welcome to ChatApp</h3>
                        <p>You haven't started any conversations yet</p>
                        <button
                            onClick={() => setShowContacts(true)}
                            className="start-chat-btn"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                <line x1="12" y1="8" x2="12" y2="16" />
                                <line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                            Start your first chat
                        </button>
                    </div>
                );
            }
        }

        const getLastMessagePreview = (friend) => {
            const relevantNotifications = notifications.filter(n => {
                if (n.data?.chatRoomId) {
                    const chatRoomId = n.data.chatRoomId;
                    const userIds = chatRoomId.split('_');
                    return userIds.includes(friend.id);
                }
                return false;
            });

            if (relevantNotifications.length > 0) {
                const lastNotification = relevantNotifications.sort((a, b) => {
                    const timestampA = a.timestamp?.toDate?.() || new Date(a.timestamp);
                    const timestampB = b.timestamp?.toDate?.() || new Date(b.timestamp);
                    return timestampB - timestampA;
                })[0];

                const isFromCurrentUser = lastNotification.senderId === currentUser.uid;
                const prefix = isFromCurrentUser ? 'You: ' : '';
                const message = lastNotification.data?.message || 'New message';

                return `${prefix}${message.length > 35 ? message.substring(0, 35) + '...' : message}`;
            }

            return friend.lastMessage || 'Tap to start chatting';
        };

        const getOnlineStatus = (friend) => {
            // Simulate online status - in a real app, you'd have this data from Firestore
            const isOnline = Math.random() > 0.5; // Random for demo
            return isOnline;
        };

        const getMessageStatus = (friend) => {
            const relevantNotifications = notifications.filter(n => {
                if (n.data?.chatRoomId) {
                    const chatRoomId = n.data.chatRoomId;
                    const userIds = chatRoomId.split('_');
                    return userIds.includes(friend.id) && n.senderId === currentUser.uid;
                }
                return false;
            });

            if (relevantNotifications.length > 0) {
                // Simulate message status - delivered, read, etc.
                return 'delivered'; // 'sent', 'delivered', 'read'
            }
            return null;
        };

        return (
            <>
                {/* Existing friends */}
                {filteredFriends.map((friend) => {
                    const unreadCount = notifications.filter(n => {
                        if (!n.read && n.data?.chatRoomId) {
                            const chatRoomId = n.data.chatRoomId;
                            const userIds = chatRoomId.split('_');
                            return userIds.includes(friend.id);
                        }
                        return false;
                    }).length;

                    const chatRoomId = messageService.createChatRoomId(currentUser.uid, friend.id);
                    const isSelected = selectedChat?.id === chatRoomId;
                    const lastMessagePreview = getLastMessagePreview(friend);
                    const isOnline = getOnlineStatus(friend);
                    const messageStatus = getMessageStatus(friend);
                    const hasUnread = unreadCount > 0;

                    return (
                        <div
                            key={friend.id}
                            className={`chat-item ${isSelected ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}`}
                            onClick={() => handleSelectChat(friend)}
                        >
                            <div className="chat-avatar-container">
                                <div className="chat-avatar">
                                    {friend.photoURL ? (
                                        <img src={friend.photoURL} alt={friend.displayName} />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            <span>{friend.displayName?.[0]?.toUpperCase() || friend.email?.[0]?.toUpperCase() || '?'}</span>
                                        </div>
                                    )}
                                </div>
                                {isOnline && <div className="online-indicator"></div>}
                            </div>

                            <div className="chat-content">
                                <div className="chat-header">
                                    <div className="chat-name">
                                        {friend.displayName || friend.email?.split('@')[0] || 'Unknown'}
                                        {friend.isTyping && <span className="typing-indicator">typing...</span>}
                                    </div>
                                    <div className="chat-meta">
                                        <div className="chat-time">
                                            {friend.lastContact ?
                                                formatNotificationTime(friend.lastContact) :
                                                'new'
                                            }
                                        </div>
                                        {messageStatus && (
                                            <div className="message-status">
                                                {messageStatus === 'sent' && (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="20,6 9,17 4,12" />
                                                    </svg>
                                                )}
                                                {messageStatus === 'delivered' && (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="20,6 9,17 4,12" />
                                                        <polyline points="16,6 5,17 0,12" />
                                                    </svg>
                                                )}
                                                {messageStatus === 'read' && (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4FC3F7" strokeWidth="2">
                                                        <polyline points="20,6 9,17 4,12" />
                                                        <polyline points="16,6 5,17 0,12" />
                                                    </svg>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="chat-preview-row">
                                    <div className={`chat-preview ${hasUnread ? 'unread' : ''}`}>
                                        {lastMessagePreview}
                                    </div>
                                    <div className="chat-indicators">
                                        {friend.isPinned && (
                                            <div className="pin-indicator">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M16 4v4l-4 4-4-4V4h8zm-4 8l4 4v4l-4-4-4 4v-4l4-4z" />
                                                </svg>
                                            </div>
                                        )}
                                        {friend.isMuted && (
                                            <div className="mute-indicator">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M11 5L6 9H2v6h4l5 4V5zM22 9l-6 6m0-6l6 6" />
                                                </svg>
                                            </div>
                                        )}
                                        {hasUnread && (
                                            <div className="unread-badge">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Section separator if we have both friends and new contacts */}
                {filteredFriends.length > 0 && filteredNewContacts.length > 0 && (
                    <div className="section-separator">
                        <span>New Contacts</span>
                    </div>
                )}

                {/* New contacts that match search */}
                {filteredNewContacts.map((contact) => (
                    <div
                        key={`new-${contact.id}`}
                        className="chat-item new-contact"
                        onClick={() => handleSelectChat(contact)}
                    >
                        <div className="chat-avatar-container">
                            <div className="chat-avatar">
                                {contact.photoURL ? (
                                    <img src={contact.photoURL} alt={contact.displayName} />
                                ) : (
                                    <div className="avatar-placeholder new">
                                        <span>{contact.displayName?.[0]?.toUpperCase() || contact.email?.[0]?.toUpperCase() || '?'}</span>
                                    </div>
                                )}
                            </div>
                            <div className="new-contact-indicator">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="16" />
                                    <line x1="8" y1="12" x2="16" y2="12" />
                                </svg>
                            </div>
                        </div>

                        <div className="chat-content">
                            <div className="chat-header">
                                <div className="chat-name">
                                    {contact.displayName || contact.email?.split('@')[0]}
                                </div>
                                <div className="chat-meta">
                                    <div className="new-chat-label">
                                        Start chat
                                    </div>
                                </div>
                            </div>

                            <div className="chat-preview-row">
                                <div className="chat-preview">
                                    {contact.status || 'Available to chat'}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </>
        );
    };

    return (
        <div className="home-screen">
            <div className="chat-container">
                {/* Sidebar */}
                <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                    <div className="sidebar-header">
                        <div className="sidebar-user" onClick={() => setShowProfile(true)}>
                            <div className="user-avatar">
                                {userProfile?.photoURL ? (
                                    <img src={userProfile.photoURL} alt="Profile" />
                                ) : (
                                    <span>{userProfile?.displayName?.[0] || currentUser?.email?.[0] || '?'}</span>
                                )}
                            </div>
                            {!sidebarCollapsed && (
                                <div className="user-details">
                                    <span className="user-name">
                                        {userProfile?.displayName || currentUser?.displayName || 'User'}
                                    </span>
                                    <span className="user-status">
                                        {userProfile?.status || 'Online'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {!sidebarCollapsed && (
                            <div className="sidebar-actions">
                                <button
                                    className="action-btn"
                                    onClick={() => setShowContacts(true)}
                                    title="New Chat"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                        <line x1="12" y1="8" x2="12" y2="16" />
                                        <line x1="8" y1="12" x2="16" y2="12" />
                                    </svg>
                                </button>

                                <button
                                    className="action-btn"
                                    onClick={() => setShowCommunities(true)}
                                    title="Communities"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="9" cy="7" r="4"></circle>
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                    </svg>
                                </button>

                                <div className="notification-container" ref={notificationRef}>
                                    <button
                                        className="action-btn notification-btn"
                                        onClick={handleNotificationClick}
                                        title="Notifications"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                        </svg>
                                        {getUnreadCount() > 0 && (
                                            <span className="notification-badge">{getUnreadCount()}</span>
                                        )}
                                    </button>

                                    {showNotifications && (
                                        <div className="notification-dropdown">
                                            <div className="notification-header">
                                                <span>Notifications</span>
                                                {getUnreadCount() > 0 && (
                                                    <button
                                                        className="action-btn"
                                                        onClick={handleMarkAllNotificationsRead}
                                                        style={{ fontSize: '12px', padding: '4px 8px', height: 'auto', width: 'auto', borderRadius: '4px' }}
                                                    >
                                                        Mark all read
                                                    </button>
                                                )}
                                            </div>
                                            {notifications.length === 0 ? (
                                                <div className="notification-item">
                                                    <div className="notification-title">No notifications yet</div>
                                                </div>
                                            ) : (
                                                notifications.slice(0, 10).map((notification) => (
                                                    <div
                                                        key={notification.id}
                                                        className={`notification-item ${!notification.read ? 'unread' : ''}`}
                                                        onClick={() => {
                                                            if (notification.data?.chatRoomId) {
                                                                handleNavigateToChat(notification.data.chatRoomId);
                                                                setShowNotifications(false);
                                                            }
                                                            if (!notification.read) {
                                                                notificationService.markAsRead(notification.id);
                                                            }
                                                        }}
                                                    >
                                                        <div className="notification-title">
                                                            {notification.data?.senderName || 'Someone'}
                                                        </div>
                                                        <div className="notification-message">
                                                            {notification.data?.message || 'sent you a message'}
                                                        </div>
                                                        <div className="notification-time">
                                                            {formatNotificationTime(notification.timestamp)}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="action-btn"
                                    onClick={handleLogout}
                                    title="Logout"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16,17 21,12 16,7" />
                                        <line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        <button
                            className="toggle-btn"
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points={sidebarCollapsed ? "9,18 15,12 9,6" : "15,18 9,12 15,6"} />
                            </svg>
                        </button>
                    </div>

                    {!sidebarCollapsed && (
                        <>
                            <div className="search-container">
                                <input
                                    type="text"
                                    placeholder="Search or start new chat"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="search-input"
                                />
                            </div>

                            <div className="chat-list">
                                {renderFriendsList()}
                            </div>
                        </>
                    )}
                </div>

                {/* Main Chat Area */}
                <div className="main-content">
                    {selectedChat ? (
                        <ChatWindow
                            chat={selectedChat}
                            currentUser={currentUser}
                            onSendMessage={handleSendMessage}
                            onFileUpload={() => setShowFileUpload(true)}
                        />
                    ) : (
                        <div className="welcome-screen">
                            <div className="welcome-content">
                                <h2>Welcome to ChatApp</h2>
                                <p>Select a conversation or start a new chat to begin messaging</p>
                                <button
                                    onClick={() => setShowContacts(true)}
                                    className="start-chat-btn"
                                >
                                    Start New Chat
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showProfile && (
                <ProfileModal
                    user={userProfile}
                    onClose={() => setShowProfile(false)}
                />
            )}

            {showContacts && (
                <ContactsList
                    contacts={filteredContacts}
                    onSelectContact={handleSelectChat}
                    onClose={() => setShowContacts(false)}
                />
            )}

            {showFileUpload && (
                <FileUploadModal
                    onUpload={(file) => {
                        handleSendMessage('', file);
                        setShowFileUpload(false);
                    }}
                    onClose={() => setShowFileUpload(false)}
                />
            )}

            {showCommunities && (
                <CommunitiesModal
                    onSelectCommunity={(community) => {
                        // Handle community selection
                        console.log('Selected community:', community);
                        setShowCommunities(false);
                    }}
                    onClose={() => setShowCommunities(false)}
                />
            )}
        </div>
    );
};

export default HomeScreen;
