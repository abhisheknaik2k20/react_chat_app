import React, { useState } from 'react';
import './ContactsList.css';

const ContactsList = ({ contacts, onSelectContact, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredContacts = contacts.filter(contact =>
        contact.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleContactSelect = (contact) => {
        onSelectContact(contact);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="contacts-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Select Contact</h2>
                    <button className="close-btn" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="modal-content">
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="Search contacts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <div className="contacts-list">
                        {filteredContacts.length === 0 ? (
                            <div className="empty-state">
                                <p>No contacts found</p>
                            </div>
                        ) : (
                            filteredContacts.map((contact) => (
                                <div
                                    key={contact.id}
                                    className="contact-item"
                                    onClick={() => handleContactSelect(contact)}
                                >
                                    <div className="contact-avatar">
                                        {contact.photoURL ? (
                                            <img src={contact.photoURL} alt="Profile" />
                                        ) : (
                                            <span>{contact.displayName?.[0] || contact.email?.[0] || '?'}</span>
                                        )}
                                        <div className={`status-indicator ${contact.isOnline ? 'online' : 'offline'}`}></div>
                                    </div>

                                    <div className="contact-info">
                                        <div className="contact-name">
                                            {contact.displayName || contact.email.split('@')[0]}
                                        </div>
                                        <div className="contact-email">
                                            {contact.email}
                                        </div>
                                        {contact.status && (
                                            <div className="contact-status">
                                                {contact.status}
                                            </div>
                                        )}
                                    </div>

                                    <div className="contact-actions">
                                        <button
                                            className="chat-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleContactSelect(contact);
                                            }}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactsList;
