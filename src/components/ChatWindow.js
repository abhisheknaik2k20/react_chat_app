import React, { useState, useEffect, useRef, useCallback } from 'react';
import messageService from '../services/messageService';
import ReactMarkdown from 'react-markdown';
import './ChatWindow.css';

const ChatWindow = ({ chat, currentUser, onSendMessage, onFileUpload }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [editingMessage, setEditingMessage] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(''); // Add debounced search
    const [showSearch, setShowSearch] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [longPressTimer, setLongPressTimer] = useState(null);
    const [longPressing, setLongPressing] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef(null);
    const messageInputRef = useRef(null);

    useEffect(() => {
        if (!chat?.id) return;

        // Listen to messages in real-time
        const unsubscribe = messageService.listenToMessages(chat.id, (messages) => {
            console.log('Messages updated:', messages.length, 'messages received');
            setMessages(messages);

            // If we have a selected message that no longer exists, clear the selection
            if (selectedMessage && !messages.find(m => m.id === selectedMessage.id)) {
                setSelectedMessage(null);
            }

            // If we're editing a message that no longer exists, cancel editing
            if (editingMessage && !messages.find(m => m.id === editingMessage.id)) {
                setEditingMessage(null);
                setNewMessage('');
            }
        });

        return () => unsubscribe();
    }, [chat?.id, selectedMessage, editingMessage]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectedMessage && !event.target.closest('.message.selected')) {
                setSelectedMessage(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [selectedMessage]);

    // Debounce search query to reduce expensive search operations
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300); // 300ms delay

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Define handleSearch before using it in useEffect
    const handleSearch = useCallback(async () => {
        if (!debouncedSearchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        try {
            // Use the optimized search with limited results
            const results = await messageService.searchMessages(chat.id, debouncedSearchQuery, 30);
            setSearchResults(results);
        } catch (error) {
            console.error('Error searching messages:', error);
        }
    }, [chat.id, debouncedSearchQuery]);

    // Execute search when debounced query changes
    useEffect(() => {
        if (debouncedSearchQuery.trim()) {
            handleSearch();
        } else {
            setSearchResults([]);
        }
    }, [debouncedSearchQuery, handleSearch]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        if (editingMessage) {
            await handleEditMessage();
        } else {
            setIsSending(true);
            try {
                await onSendMessage(newMessage);
                setNewMessage('');
            } catch (error) {
                console.error('Error sending message:', error);
            } finally {
                setIsSending(false);
            }
        }
    };

    const handleEditMessage = async () => {
        if (isSending) return;

        setIsSending(true);
        try {
            await messageService.editMessage(chat.id, editingMessage.id, newMessage);
            setEditingMessage(null);
            setNewMessage('');
        } catch (error) {
            console.error('Error editing message:', error);
            if (error.message === 'Message not found') {
                alert('This message no longer exists and cannot be edited.');
            } else {
                alert('Failed to edit message. Please try again.');
            }
            // Reset editing state on error
            setEditingMessage(null);
            setNewMessage('');
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteMessage = async (messageId) => {
        const confirmDelete = window.confirm('Are you sure you want to delete this message? This action cannot be undone.');

        if (confirmDelete) {
            try {
                // Optimistically remove the message from local state for immediate feedback
                setMessages(prevMessages => prevMessages.filter(m => m.id !== messageId));
                setSelectedMessage(null); // Close the actions overlay immediately

                await messageService.deleteMessage(chat.id, messageId);

                console.log('Message deleted successfully:', messageId);
            } catch (error) {
                console.error('Error deleting message:', error);

                // If deletion failed, we need to refresh the messages to restore the UI
                // The real-time listener will handle this automatically

                if (error.message === 'Message not found') {
                    alert('This message has already been deleted.');
                } else {
                    alert('Failed to delete message. Please try again.');
                }
            }
        } else {
            setSelectedMessage(null); // Close the actions overlay if cancelled
        }
    };

    const startEdit = (message) => {
        setEditingMessage(message);
        setNewMessage(message.text);
        setSelectedMessage(null);
        // Focus the input field
        setTimeout(() => {
            if (messageInputRef.current) {
                messageInputRef.current.focus();
                messageInputRef.current.setSelectionRange(message.text.length, message.text.length);
            }
        }, 100);
    };

    const cancelEdit = () => {
        setEditingMessage(null);
        setNewMessage('');
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const today = new Date();
        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        if (messageDate.getTime() === todayDate.getTime()) {
            return 'Today';
        } else if (messageDate.getTime() === todayDate.getTime() - 86400000) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString();
        }
    };

    const groupMessagesByDate = (messages) => {
        const groups = {};
        messages.forEach(message => {
            const date = formatDate(message.timestamp);
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(message);
        });
        return groups;
    };

    const renderMessage = (message) => {
        const isOwn = message.senderId === currentUser.uid;
        const isSelected = selectedMessage?.id === message.id;
        const isLongPressing = longPressing === message.id;

        return (
            <div
                key={message.id}
                className={`message ${isOwn ? 'own' : 'other'} ${isSelected ? 'selected' : ''} ${isLongPressing ? 'long-pressing' : ''}`}
                onMouseDown={() => handleMouseDown(message)}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onTouchStart={() => handleMouseDown(message)}
                onTouchEnd={handleMouseUp}
            >
                <div className="message-content">
                    {message.type === 'text' && (
                        <div className="message-text">
                            <ReactMarkdown>{message.text}</ReactMarkdown>
                            {message.edited && <span className="edited-indicator">(edited)</span>}
                        </div>
                    )}

                    {message.type === 'image' && (
                        <div className="message-image">
                            <img src={message.fileUrl} alt={message.fileName} />
                            <div className="file-info">
                                <span className="file-name">{message.fileName}</span>
                            </div>
                        </div>
                    )}

                    {message.type === 'file' && (
                        <div className="message-file">
                            <div className="file-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14,2 14,8 20,8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10,9 9,9 8,9"></polyline>
                                </svg>
                            </div>
                            <div className="file-details">
                                <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
                                    {message.fileName}
                                </a>
                                <span className="file-size">
                                    {(message.fileSize / 1024 / 1024).toFixed(2)} MB
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="message-meta">
                        <span className="message-time">{formatTime(message.timestamp)}</span>
                    </div>

                    {/* Message Actions - Only show when selected */}
                    {isSelected && isOwn && (
                        <div className="message-actions-overlay">
                            <button
                                onClick={() => {
                                    startEdit(message);
                                    closeMessageActions();
                                }}
                                className="action-btn edit-btn"
                                title="Edit"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button
                                onClick={() => {
                                    handleDeleteMessage(message.id);
                                    closeMessageActions();
                                }}
                                className="action-btn delete-btn"
                                title="Delete"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3,6 5,6 21,6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                            </button>
                            <button
                                onClick={closeMessageActions}
                                className="action-btn close-btn"
                                title="Close"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const handleMouseDown = (message) => {
        if (message.senderId !== currentUser.uid) return;

        setLongPressing(message.id);

        const timer = setTimeout(() => {
            setSelectedMessage(message);
            setLongPressing(null);
        }, 500); // 500ms long press

        setLongPressTimer(timer);
    };

    const handleMouseUp = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
        setLongPressing(null);
    };

    const handleMouseLeave = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
        setLongPressing(null);
    };

    const closeMessageActions = () => {
        setSelectedMessage(null);
    };

    if (!chat) {
        return (
            <div className="chat-window">
                <div className="no-chat-selected">
                    <h3>Select a chat to start messaging</h3>
                </div>
            </div>
        );
    }

    const messageGroups = groupMessagesByDate(messages);

    return (
        <div className="chat-window">
            {/* Chat Header */}
            <div className="chat-header">
                <div className="chat-info">
                    <div className="contact-avatar">
                        {chat.contact?.photoURL ? (
                            <img src={chat.contact.photoURL} alt={chat.contact.displayName} />
                        ) : (
                            <span>{chat.contact?.displayName?.[0] || '?'}</span>
                        )}
                    </div>
                    <div className="contact-details">
                        <div className="contact-name">{chat.contact?.displayName || 'Unknown'}</div>
                        <div className="contact-status">
                            {chat.contact?.isOnline ? 'online' : 'last seen recently'}
                        </div>
                    </div>
                </div>

                <div className="chat-actions">
                    <button
                        className="chat-action-btn"
                        title="Video call"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 7l-7 5 7 5V7z"></path>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                    </button>
                    <button
                        className="chat-action-btn"
                        title="Voice call"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </button>
                    <button
                        className={`chat-action-btn ${showSearch ? 'active' : ''}`}
                        onClick={() => setShowSearch(!showSearch)}
                        title="Search messages"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="M21 21l-4.35-4.35"></path>
                        </svg>
                    </button>
                    <button
                        className="chat-action-btn"
                        title="Menu"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            {showSearch && (
                <div className="search-bar">
                    <input
                        type="text"
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button onClick={handleSearch}>Search</button>
                </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
                <div className="search-results">
                    <h4>Search Results ({searchResults.length})</h4>
                    <div className="results-list">
                        {searchResults.map(message => (
                            <div key={message.id} className="search-result">
                                <span className="result-text">{message.text}</span>
                                <span className="result-time">{formatTime(message.timestamp)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <div className="messages-container">
                {Object.entries(messageGroups).map(([date, msgs]) => (
                    <div key={date} className="message-group">
                        <div className="date-separator">
                            <span>{date}</span>
                        </div>
                        {msgs.map(renderMessage)}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form className="message-input-container" onSubmit={handleSendMessage}>
                {editingMessage && (
                    <div className="editing-indicator">
                        <div className="editing-info">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            <span>Editing message</span>
                        </div>
                        <button type="button" onClick={cancelEdit} className="cancel-edit">
                            Cancel
                        </button>
                    </div>
                )}

                <div className="input-row">
                    <button
                        type="button"
                        className="input-btn"
                        onClick={onFileUpload}
                        title="Attach"
                        disabled={editingMessage} // Disable file upload when editing
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                        </svg>
                    </button>

                    <div className="message-input-wrapper">
                        <textarea
                            ref={messageInputRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={editingMessage ? "Edit your message..." : "Type a message"}
                            className="message-input"
                            rows="1"
                            disabled={isSending}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                } else if (e.key === 'Escape' && editingMessage) {
                                    e.preventDefault();
                                    cancelEdit();
                                }
                            }}
                        />
                    </div>

                    {newMessage.trim() ? (
                        <button
                            type="submit"
                            className={`send-button ${editingMessage ? 'editing' : ''} ${isSending ? 'sending' : ''}`}
                            disabled={!newMessage.trim() || isSending}
                            title={editingMessage ? "Save changes" : "Send message"}
                        >
                            {isSending ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinner">
                                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                                </svg>
                            ) : editingMessage ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20,6 9,17 4,12"></polyline>
                                </svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
                                </svg>
                            )}
                        </button>
                    ) : (
                        !editingMessage && (
                            <button type="button" className="input-btn" title="Voice message">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                    <line x1="12" y1="19" x2="12" y2="23"></line>
                                    <line x1="8" y1="23" x2="16" y2="23"></line>
                                </svg>
                            </button>
                        )
                    )}
                </div>
            </form>
        </div>
    );
};

export default ChatWindow;
