import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
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
    const [chatRooms, setChatRooms] = useState([]);
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

    const loadChatRooms = useCallback(async () => {
        if (!currentUser) return;
        try {
            const rooms = await messageService.getUserChatRooms(currentUser.uid);
            console.log('Loaded chat rooms:', rooms.length);
            setChatRooms(rooms);
        } catch (error) {
            console.error('Error loading chat rooms:', error);
        }
    }, [currentUser]);

    // Real-time listener for chat rooms
    useEffect(() => {
        if (!currentUser) return;

        // Set up real-time listener for chat rooms using onSnapshot
        const unsubscribe = messageService.listenToUserChatRooms(currentUser.uid, (rooms) => {
            console.log('Chat rooms updated in real-time:', rooms.length);
            setChatRooms(rooms);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
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

        // Load user's chat rooms
        loadChatRooms();

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
    }, [currentUser, navigate, loadChatRooms]);

    const handleSelectChat = async (contact) => {
        try {
            // Remove active chat from notification service (to stop suppressing notifications)
            if (selectedChat?.id) {
                notificationService.removeActiveChat(selectedChat.id);
            }

            const chatRoomId = await messageService.createOrGetChatRoom(currentUser, contact);
            const newChat = {
                id: chatRoomId,
                contact,
                messages: []
            };

            setSelectedChat(newChat);
            setShowContacts(false);

            // Set this chat as active in notification service (to suppress notifications)
            notificationService.setActiveChat(chatRoomId);

            // Mark notifications for this chat as read
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

            // Refresh chat rooms list
            loadChatRooms();
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
            // Find the chat room
            const room = chatRooms.find(r => r.id === chatRoomId);
            if (room) {
                const otherUserId = room.participants.find(p => p !== currentUser.uid);
                const contact = room.participantDetails[otherUserId];
                if (contact) {
                    await handleSelectChat({ id: otherUserId, ...contact });
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
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
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

    const renderChatList = () => {
        // Filter chat rooms based on search query
        const filteredChatRooms = chatRooms.filter((room) => {
            const otherUserId = room.participants.find(p => p !== currentUser.uid);
            const contact = room.participantDetails[otherUserId];
            const name = contact?.displayName || contact?.email || '';
            const lastMessage = room.lastMessage?.text || '';
            return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
        });

        // Filter contacts that haven't been messaged yet but match search
        const filteredNewContacts = searchQuery ? contacts.filter(contact => {
            const hasExistingChat = chatRooms.some(room =>
                room.participants.includes(contact.id)
            );
            const matchesSearch = contact.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                contact.email?.toLowerCase().includes(searchQuery.toLowerCase());
            return !hasExistingChat && matchesSearch;
        }) : [];

        if (filteredChatRooms.length === 0 && filteredNewContacts.length === 0) {
            if (searchQuery) {
                return (
                    <div className="no-chats">
                        <p>No chats found for "{searchQuery}"</p>
                    </div>
                );
            } else {
                return (
                    <div className="no-chats">
                        <p>No conversations yet</p>
                        <button
                            onClick={() => setShowContacts(true)}
                            className="start-chat-btn"
                        >
                            Start a new chat
                        </button>
                    </div>
                );
            }
        }

        return (
            <>
                {/* Existing chat rooms */}
                {filteredChatRooms.map((room) => {
                    const otherUserId = room.participants.find(p => p !== currentUser.uid);
                    const contact = room.participantDetails[otherUserId];
                    const lastMessage = room.lastMessage;
                    const unreadCount = notifications.filter(n =>
                        !n.read && n.data?.chatRoomId === room.id
                    ).length;

                    return (
                        <div
                            key={room.id}
                            className={`chat-item ${selectedChat?.id === room.id ? 'active' : ''}`}
                            onClick={() => {
                                if (contact) {
                                    setSelectedChat({
                                        id: room.id,
                                        contact: { id: otherUserId, ...contact }
                                    });
                                    markChatNotificationsAsRead(room.id);
                                }
                            }}
                        >
                            <div className="chat-avatar">
                                {contact?.photoURL ? (
                                    <img src={contact.photoURL} alt={contact.displayName} />
                                ) : (
                                    <span>{contact?.displayName?.[0] || contact?.email?.[0] || '?'}</span>
                                )}
                            </div>
                            <div className="chat-info">
                                <div className="chat-header-info">
                                    <div className="chat-name">
                                        {contact?.displayName || contact?.email || 'Unknown'}
                                    </div>
                                    <div className="chat-time">
                                        {lastMessage?.timestamp ?
                                            formatNotificationTime(lastMessage.timestamp) :
                                            ''
                                        }
                                    </div>
                                </div>
                                <div className="chat-preview-container">
                                    <div className="chat-preview">
                                        {lastMessage?.text || 'No messages yet'}
                                    </div>
                                    {unreadCount > 0 && (
                                        <div className="unread-badge">
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* New contacts that match search */}
                {filteredNewContacts.map((contact) => (
                    <div
                        key={`new-${contact.id}`}
                        className="chat-item new-contact"
                        onClick={() => handleSelectChat(contact)}
                    >
                        <div className="chat-avatar">
                            {contact.photoURL ? (
                                <img src={contact.photoURL} alt={contact.displayName} />
                            ) : (
                                <span>{contact.displayName?.[0] || contact.email?.[0] || '?'}</span>
                            )}
                        </div>
                        <div className="chat-info">
                            <div className="chat-header-info">
                                <div className="chat-name">
                                    {contact.displayName || contact.email}
                                </div>
                                <div className="chat-status">
                                    Start chat
                                </div>
                            </div>
                            <div className="chat-preview">
                                {contact.status || 'Available'}
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
                                {renderChatList()}
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
