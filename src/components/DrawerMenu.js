import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import './DrawerMenu.css';

const DrawerMenu = ({ isOpen, onClose, onNavigate }) => {
    const { currentUser, userProfile, logout } = useAuth();
    const { isDarkMode, toggleTheme } = useTheme();

    if (!isOpen) return null;

    const menuItems = [
        {
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9,22 9,12 15,12 15,22" />
                </svg>
            ),
            label: 'Home',
            onClick: () => {
                onNavigate('home');
                onClose();
            }
        },
        {
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>
            ),
            label: 'Profile',
            onClick: () => {
                onNavigate('profile');
                onClose();
            }
        },
        {
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
            ),
            label: 'Web Login',
            onClick: () => {
                onNavigate('web-login');
                onClose();
            }
        }
    ];

    const handleLogout = async () => {
        try {
            await logout();
            onClose();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    return (
        <div className="drawer-overlay" onClick={onClose}>
            <div className="drawer-menu" onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                    <div className="drawer-profile">
                        <div className="drawer-avatar">
                            {userProfile?.photoURL ? (
                                <img src={userProfile.photoURL} alt="Profile" />
                            ) : (
                                <div className="avatar-placeholder">
                                    <span>{userProfile?.displayName?.[0] || currentUser?.email?.[0] || '?'}</span>
                                </div>
                            )}
                        </div>
                        <div className="drawer-user-info">
                            <h3>{userProfile?.displayName || currentUser?.displayName || 'User'}</h3>
                            <p>{currentUser?.email}</p>
                        </div>
                    </div>
                </div>

                <div className="drawer-content">
                    <div className="drawer-section">
                        {menuItems.map((item, index) => (
                            <button
                                key={index}
                                className="drawer-item"
                                onClick={item.onClick}
                            >
                                <span className="drawer-item-icon">{item.icon}</span>
                                <span className="drawer-item-label">{item.label}</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="drawer-item-arrow">
                                    <polyline points="9,18 15,12 9,6" />
                                </svg>
                            </button>
                        ))}
                    </div>

                    <div className="drawer-divider"></div>

                    <div className="drawer-section">
                        <div className="theme-toggle">
                            <div className="theme-toggle-info">
                                <span className="theme-toggle-icon">
                                    {isDarkMode ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="5" />
                                            <line x1="12" y1="1" x2="12" y2="3" />
                                            <line x1="12" y1="21" x2="12" y2="23" />
                                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                            <line x1="1" y1="12" x2="3" y2="12" />
                                            <line x1="21" y1="12" x2="23" y2="12" />
                                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                                        </svg>
                                    )}
                                </span>
                                <span className="theme-toggle-label">
                                    {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                                </span>
                            </div>
                            <button
                                className={`toggle-switch ${isDarkMode ? 'active' : ''}`}
                                onClick={toggleTheme}
                            >
                                <span className="toggle-slider"></span>
                            </button>
                        </div>
                    </div>

                    <div className="drawer-divider"></div>

                    <div className="drawer-section">
                        <button className="drawer-item logout-item" onClick={handleLogout}>
                            <span className="drawer-item-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16,17 21,12 16,7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                            </span>
                            <span className="drawer-item-label">Logout</span>
                        </button>
                    </div>
                </div>

                <div className="drawer-footer">
                    <p>Terms of Service | Privacy Policy</p>
                </div>
            </div>
        </div>
    );
};

export default DrawerMenu;
