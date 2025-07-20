import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './CommunitiesModal.css';

const CommunitiesModal = ({ onClose, onSelectCommunity }) => {
    const [communities, setCommunities] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newCommunity, setNewCommunity] = useState({
        name: '',
        description: '',
        isPrivate: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { currentUser } = useAuth();

    useEffect(() => {
        loadCommunities();
    }, []);

    const loadCommunities = async () => {
        try {
            // Load communities where user is a member
            // This would typically fetch from Firestore
            setCommunities([
                {
                    id: 'general',
                    name: 'General Discussion',
                    description: 'General chat for everyone',
                    memberCount: 15,
                    isPrivate: false,
                    lastActivity: new Date()
                },
                {
                    id: 'dev-team',
                    name: 'Development Team',
                    description: 'Private channel for developers',
                    memberCount: 8,
                    isPrivate: true,
                    lastActivity: new Date()
                }
            ]);
        } catch (error) {
            console.error('Error loading communities:', error);
            setError('Failed to load communities');
        }
    };

    const handleCreateCommunity = async (e) => {
        e.preventDefault();

        if (!newCommunity.name.trim()) {
            setError('Community name is required');
            return;
        }

        try {
            setLoading(true);
            setError('');

            // Create community in Firestore
            const communityData = {
                ...newCommunity,
                createdBy: currentUser.uid,
                createdAt: new Date(),
                members: [currentUser.uid],
                memberCount: 1
            };

            // This would typically save to Firestore
            console.log('Creating community:', communityData);

            // Reset form
            setNewCommunity({ name: '', description: '', isPrivate: false });
            setShowCreateForm(false);

            // Reload communities
            await loadCommunities();
        } catch (error) {
            console.error('Error creating community:', error);
            setError('Failed to create community');
        } finally {
            setLoading(false);
        }
    };

    // Memoize filtered communities to avoid recalculation
    const filteredCommunities = useMemo(() =>
        communities.filter(community =>
            community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            community.description.toLowerCase().includes(searchQuery.toLowerCase())
        ), [communities, searchQuery]
    );

    const handleCommunitySelect = (community) => {
        onSelectCommunity(community);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="communities-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Communities</h2>
                    <div className="header-actions">
                        <button
                            className="create-btn"
                            onClick={() => setShowCreateForm(!showCreateForm)}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Create
                        </button>
                        <button className="close-btn" onClick={onClose}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
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

                    {showCreateForm && (
                        <div className="create-community-form">
                            <h3>Create New Community</h3>
                            <form onSubmit={handleCreateCommunity}>
                                <div className="form-group">
                                    <label>Community Name</label>
                                    <input
                                        type="text"
                                        placeholder="Enter community name"
                                        value={newCommunity.name}
                                        onChange={(e) => setNewCommunity(prev => ({ ...prev, name: e.target.value }))}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        placeholder="What's this community about?"
                                        value={newCommunity.description}
                                        onChange={(e) => setNewCommunity(prev => ({ ...prev, description: e.target.value }))}
                                        rows="3"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={newCommunity.isPrivate}
                                            onChange={(e) => setNewCommunity(prev => ({ ...prev, isPrivate: e.target.checked }))}
                                        />
                                        <span className="checkbox-custom"></span>
                                        Private Community
                                    </label>
                                    <p className="help-text">
                                        Private communities require an invitation to join
                                    </p>
                                </div>

                                <div className="form-actions">
                                    <button
                                        type="button"
                                        className="cancel-btn"
                                        onClick={() => setShowCreateForm(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="submit-btn"
                                        disabled={loading}
                                    >
                                        {loading ? 'Creating...' : 'Create Community'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="Search communities..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <div className="communities-list">
                        {filteredCommunities.length === 0 ? (
                            <div className="empty-state">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                                <h3>No communities found</h3>
                                <p>Create your first community to get started</p>
                            </div>
                        ) : (
                            filteredCommunities.map((community) => (
                                <div
                                    key={community.id}
                                    className="community-item"
                                    onClick={() => handleCommunitySelect(community)}
                                >
                                    <div className="community-avatar">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="9" cy="7" r="4"></circle>
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                        </svg>
                                    </div>

                                    <div className="community-info">
                                        <div className="community-header">
                                            <h4>{community.name}</h4>
                                            <div className="community-badges">
                                                {community.isPrivate && (
                                                    <span className="badge private">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                            <circle cx="12" cy="7" r="4"></circle>
                                                        </svg>
                                                        Private
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="community-description">{community.description}</p>
                                        <div className="community-meta">
                                            <span className="member-count">
                                                {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="community-action">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="9,18 15,12 9,6"></polyline>
                                        </svg>
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

export default CommunitiesModal;
