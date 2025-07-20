import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './ProfileModal.css';

const ProfileModal = ({ user, onClose }) => {
    const { updateUserProfile, uploadProfilePicture } = useAuth();
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        displayName: user?.displayName || '',
        status: user?.status || '',
        bio: user?.bio || ''
    });
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = React.useRef(null);

    const handleSave = async () => {
        try {
            setError('');
            await updateUserProfile(formData);
            setEditing(false);
        } catch (error) {
            setError('Failed to update profile');
            console.error('Error updating profile:', error);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            setError('File size must be less than 5MB');
            return;
        }

        try {
            setUploading(true);
            setError('');
            await uploadProfilePicture(file);
        } catch (error) {
            setError('Failed to upload profile picture');
            console.error('Error uploading picture:', error);
        } finally {
            setUploading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const formatLastSeen = (timestamp) => {
        if (!timestamp) return 'Never';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Profile</h2>
                    <button className="close-btn" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="modal-content">
                    {error && (
                        <div className="error-message">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                            {error}
                        </div>
                    )}

                    <div className="profile-header">
                        <div className="profile-avatar-section">
                            <div className="profile-avatar-container">
                                <div className="profile-avatar">
                                    {user?.photoURL ? (
                                        <img src={user.photoURL} alt="Profile" />
                                    ) : (
                                        <span>{user?.displayName?.[0] || user?.email?.[0] || '?'}</span>
                                    )}
                                    {uploading && (
                                        <div className="upload-overlay">
                                            <div className="spinner"></div>
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="change-photo-btn"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                        <circle cx="12" cy="13" r="4" />
                                    </svg>
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                />
                            </div>
                            <div className={`status-indicator ${user?.isOnline ? 'online' : 'offline'}`}></div>
                        </div>

                        <div className="profile-info">
                            <h3>{user?.displayName || 'Unknown User'}</h3>
                            <p className="profile-email">{user?.email}</p>
                            <p className="profile-status">
                                {user?.isOnline ? 'Online' : `Last seen: ${formatLastSeen(user?.lastSeen)}`}
                            </p>
                        </div>
                    </div>

                    <div className="profile-details">
                        {editing ? (
                            <div className="edit-form">
                                <div className="form-group">
                                    <label>Display Name</label>
                                    <input
                                        type="text"
                                        name="displayName"
                                        value={formData.displayName}
                                        onChange={handleInputChange}
                                        placeholder="Enter display name"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Status</label>
                                    <input
                                        type="text"
                                        name="status"
                                        value={formData.status}
                                        onChange={handleInputChange}
                                        placeholder="What's your status?"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Bio</label>
                                    <textarea
                                        name="bio"
                                        value={formData.bio}
                                        onChange={handleInputChange}
                                        placeholder="Tell us about yourself..."
                                        rows="3"
                                    />
                                </div>

                                <div className="form-actions">
                                    <button
                                        className="cancel-btn"
                                        onClick={() => {
                                            setEditing(false);
                                            setFormData({
                                                displayName: user?.displayName || '',
                                                status: user?.status || '',
                                                bio: user?.bio || ''
                                            });
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="save-btn"
                                        onClick={handleSave}
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="view-mode">
                                <div className="detail-item">
                                    <label>Status</label>
                                    <p>{user?.status || 'No status set'}</p>
                                </div>

                                <div className="detail-item">
                                    <label>Bio</label>
                                    <p>{user?.bio || 'No bio available'}</p>
                                </div>

                                <div className="detail-item">
                                    <label>Member Since</label>
                                    <p>{user?.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</p>
                                </div>

                                <button
                                    className="edit-btn"
                                    onClick={() => setEditing(true)}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    Edit Profile
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
