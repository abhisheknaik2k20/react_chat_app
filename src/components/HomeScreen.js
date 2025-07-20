import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase_config';
import './HomeScreen.css';

const HomeScreen = () => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser) {
            navigate('/auth');
            return;
        }

        const q = query(collection(db, 'messages'), orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const messageList = [];
            querySnapshot.forEach((doc) => {
                messageList.push({ id: doc.id, ...doc.data() });
            });
            setMessages(messageList);
        });

        return () => unsubscribe();
    }, [currentUser, navigate]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (newMessage.trim() === '' || loading) return;

        setLoading(true);
        try {
            await addDoc(collection(db, 'messages'), {
                text: newMessage,
                timestamp: serverTimestamp(),
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || currentUser.email.split('@')[0]
            });
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
        setLoading(false);
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp.seconds * 1000).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getInitials = (email) => {
        return email.charAt(0).toUpperCase();
    };

    return (
        <div className="home-screen">
            <div className="chat-container">
                <header className="chat-header">
                    <div className="header-left">
                        <h1 className="chat-title">ChatApp</h1>
                        <div className="online-status">
                            <span className="status-indicator"></span>
                            <span className="status-text">Online</span>
                        </div>
                    </div>
                    <div className="header-right">
                        <div className="user-info">
                            <div className="user-avatar">
                                {getInitials(currentUser?.email || '')}
                            </div>
                            <span className="user-name">
                                {currentUser?.displayName || currentUser?.email?.split('@')[0]}
                            </span>
                        </div>
                        <button onClick={handleLogout} className="logout-button">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16,17 21,12 16,7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            Logout
                        </button>
                    </div>
                </header>

                <main className="chat-main">
                    <div className="messages-container">
                        {messages.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                </div>
                                <h3>Welcome to ChatApp!</h3>
                                <p>Send your first message to begin your professional conversation</p>
                            </div>
                        ) : (
                            messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`message ${message.uid === currentUser.uid ? 'message-own' : 'message-other'
                                        }`}
                                >
                                    <div className="message-avatar">
                                        {getInitials(message.email)}
                                    </div>
                                    <div className="message-content">
                                        <div className="message-header">
                                            <span className="message-author">
                                                {message.displayName}
                                            </span>
                                            <span className="message-time">
                                                {formatTime(message.timestamp)}
                                            </span>
                                        </div>
                                        <div className="message-text">
                                            {message.text}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </main>

                <footer className="chat-footer">
                    <form onSubmit={handleSendMessage} className="message-form">
                        <div className="input-container">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type your message..."
                                className="message-input"
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                className="send-button"
                                disabled={loading || newMessage.trim() === ''}
                            >
                                {loading ? (
                                    <span className="loading-spinner"></span>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                        <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </form>
                </footer>
            </div>
        </div>
    );
};

export default HomeScreen;
