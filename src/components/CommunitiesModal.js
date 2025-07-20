import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import communityService from '../services/communityService';
import userService from '../services/userService';
import './CommunitiesModal.css';

const CommunitiesModal = ({ onClose, onSelectCommunity }) => {
    const [communities, setCommunities] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showInviteForm, setShowInviteForm] = useState(false);
    const [selectedCommunityForInvite, setSelectedCommunityForInvite] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [newCommunity, setNewCommunity] = useState({
        name: '',
        description: '',
        isPrivate: false,
        tags: []
    });
    const [communityImage, setCommunityImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('my'); // 'my' or 'discover'
    const fileInputRef = useRef(null);

    const { currentUser, userProfile } = useAuth();

    useEffect(() => {
        loadCommunities();
        loadAllUsers();

        // Set up real-time listener for communities
        const unsubscribe = communityService.listenToCommunities(
            currentUser.uid,
            (updatedCommunities) => {
                setCommunities(updatedCommunities);
            },
            activeTab === 'my' // Only user communities for 'my' tab
        );

        return () => unsubscribe && unsubscribe();
    }, [currentUser.uid, activeTab]);

    const loadCommunities = async () => {
        try {
            setLoading(true);
            let communitiesData;

            if (activeTab === 'my') {
                // Load only communities where user is a member
                communitiesData = await communityService.getUserCommunities(currentUser.uid);
            } else {
                // Load all public communities or where user is a member
                communitiesData = await communityService.getAllCommunities(currentUser.uid);
            }

            setCommunities(communitiesData);
        } catch (error) {
            console.error('Error loading communities:', error);
            setError('Failed to load communities');
        } finally {
            setLoading(false);
        }
    };

    const loadAllUsers = async () => {
        try {
            const users = await userService.getAllUsersOnce();
            setAllUsers(users.filter(user => user.uid !== currentUser.uid));
        } catch (error) {
            console.error('Error loading users:', error);
        }
    };

    // Reload communities when tab changes
    useEffect(() => {
        loadCommunities();
    }, [activeTab]);

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setError('Image size should be less than 5MB');
                return;
            }

            setCommunityImage(file);

            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => setImagePreview(e.target.result);
            reader.readAsDataURL(file);
        }
    };

    const resetCreateForm = () => {
        setNewCommunity({ name: '', description: '', isPrivate: false, tags: [] });
        setCommunityImage(null);
        setImagePreview('');
        setSelectedUsers([]);
        setError('');
    };

    const handleCreateCommunity = async (e) => {
        e.preventDefault();

        if (!newCommunity.name.trim()) {
            setError('Community name is required');
            return;
        }

        if (selectedUsers.length === 0) {
            setError('Please select at least one member');
            return;
        }

        try {
            setLoading(true);
            setError('');

            // Prepare community data
            const communityData = {
                name: newCommunity.name.trim(),
                description: newCommunity.description.trim(),
                isPrivate: newCommunity.isPrivate,
                tags: newCommunity.tags,
                createdBy: currentUser.uid,
                members: [
                    {
                        uid: currentUser.uid,
                        displayName: userProfile?.displayName || currentUser.displayName || 'User',
                        email: currentUser.email,
                        photoURL: userProfile?.photoURL || currentUser.photoURL || '',
                        role: 'admin',
                        joinedAt: new Date()
                    },
                    ...selectedUsers.map(user => ({
                        uid: user.uid,
                        displayName: user.displayName || user.name || 'User',
                        email: user.email,
                        photoURL: user.photoURL || '',
                        role: 'member',
                        joinedAt: new Date()
                    }))
                ]
            };

            // Create community with image
            await communityService.createCommunity(communityData, communityImage);

            // Reset form and close
            resetCreateForm();
            setShowCreateForm(false);

            // Reload communities
            await loadCommunities();
        } catch (error) {
            console.error('Error creating community:', error);
            setError(error.message || 'Failed to create community');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinCommunity = async (community) => {
        try {
            setLoading(true);

            const userInfo = {
                uid: currentUser.uid,
                displayName: userProfile?.displayName || currentUser.displayName || 'User',
                email: currentUser.email,
                photoURL: userProfile?.photoURL || currentUser.photoURL || '',
                role: 'member',
                joinedAt: new Date()
            };

            await communityService.joinCommunity(community.id, userInfo);
            await loadCommunities();
        } catch (error) {
            console.error('Error joining community:', error);
            setError(error.message || 'Failed to join community');
        } finally {
            setLoading(false);
        }
    };

    const handleLeaveCommunity = async (communityId, e) => {
        e.stopPropagation();

        if (!window.confirm('Are you sure you want to leave this community?')) {
            return;
        }

        try {
            setLoading(true);
            await communityService.leaveCommunity(communityId, currentUser.uid);
            await loadCommunities();
        } catch (error) {
            console.error('Error leaving community:', error);
            setError(error.message || 'Failed to leave community');
        } finally {
            setLoading(false);
        }
    };

    const handleInviteUsers = async () => {
        if (!selectedCommunityForInvite || selectedUsers.length === 0) {
            setError('Please select users to invite');
            return;
        }

        try {
            setLoading(true);

            const userInfos = selectedUsers.map(user => ({
                uid: user.uid,
                displayName: user.displayName || user.name || 'User',
                email: user.email,
                photoURL: user.photoURL || '',
                role: 'member',
                joinedAt: new Date()
            }));

            const invitedCount = await communityService.inviteUsersToCommaunity(
                selectedCommunityForInvite.id,
                userInfos,
                currentUser.uid
            );

            setShowInviteForm(false);
            setSelectedCommunityForInvite(null);
            setSelectedUsers([]);
            await loadCommunities();

            setError(`Successfully invited ${invitedCount} user(s)`);
            setTimeout(() => setError(''), 3000);
        } catch (error) {
            console.error('Error inviting users:', error);
            setError(error.message || 'Failed to invite users');
        } finally {
            setLoading(false);
        }
    };

    // Memoize filtered communities to avoid recalculation
    const filteredCommunities = useMemo(() => {
        if (!searchQuery.trim()) return communities;

        return communities.filter(community =>
            community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            community.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [communities, searchQuery]);

    const handleCommunitySelect = (community) => {
        onSelectCommunity(community);
        onClose();
    };

    const handleUserToggle = (user) => {
        setSelectedUsers(prev => {
            const isSelected = prev.some(u => u.uid === user.uid);
            if (isSelected) {
                return prev.filter(u => u.uid !== user.uid);
            } else {
                return [...prev, user];
            }
        });
    };

    const isUserMember = (community) => {
        return community.members && community.members.some(member => member.uid === currentUser.uid);
    };

    const canInviteUsers = (community) => {
        if (!community.members) return false;
        const userMember = community.members.find(member => member.uid === currentUser.uid);
        return userMember && (userMember.role === 'admin' || community.settings?.allowMemberInvites);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="communities-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Communities</h2>
                    <div className="header-actions">
                        <button
                            className="create-btn"
                            onClick={() => {
                                resetCreateForm();
                                setShowCreateForm(!showCreateForm);
                            }}
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
                        <div className={`message ${error.includes('Successfully') ? 'success' : 'error'}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                {error.includes('Successfully') ? (
                                    <polyline points="20,6 9,17 4,12"></polyline>
                                ) : (
                                    <>
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="15" y1="9" x2="9" y2="15"></line>
                                        <line x1="9" y1="9" x2="15" y2="15"></line>
                                    </>
                                )}
                            </svg>
                            {error}
                        </div>
                    )}

                    {showCreateForm && (
                        <div className="create-community-form">
                            <h3>Create New Community</h3>
                            <form onSubmit={handleCreateCommunity}>
                                {/* Community Image */}
                                <div className="form-group">
                                    <label>Community Image</label>
                                    <div className="image-upload-container">
                                        <div className="image-preview" onClick={() => fileInputRef.current?.click()}>
                                            {imagePreview ? (
                                                <img src={imagePreview} alt="Preview" />
                                            ) : (
                                                <div className="placeholder">
                                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                                        <polyline points="21,15 16,10 5,21"></polyline>
                                                    </svg>
                                                    <span>Add Image</span>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageSelect}
                                            style={{ display: 'none' }}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Community Name *</label>
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

                                {/* Member Selection */}
                                <div className="form-group">
                                    <label>Add Members ({selectedUsers.length} selected)</label>
                                    <div className="members-list">
                                        {allUsers.map((user) => (
                                            <div
                                                key={user.uid}
                                                className={`member-item ${selectedUsers.some(u => u.uid === user.uid) ? 'selected' : ''}`}
                                                onClick={() => handleUserToggle(user)}
                                            >
                                                <div className="member-avatar">
                                                    {user.photoURL ? (
                                                        <img src={user.photoURL} alt={user.displayName || user.name} />
                                                    ) : (
                                                        <span>{(user.displayName || user.name || user.email)[0].toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <div className="member-info">
                                                    <span className="member-name">{user.displayName || user.name || 'User'}</span>
                                                    <span className="member-email">{user.email}</span>
                                                </div>
                                                <div className="member-checkbox">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="20,6 9,17 4,12"></polyline>
                                                    </svg>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        type="button"
                                        className="cancel-btn"
                                        onClick={() => {
                                            resetCreateForm();
                                            setShowCreateForm(false);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="submit-btn"
                                        disabled={loading || !newCommunity.name.trim() || selectedUsers.length === 0}
                                    >
                                        {loading ? 'Creating...' : 'Create Community'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {showInviteForm && selectedCommunityForInvite && (
                        <div className="invite-form">
                            <h3>Invite to {selectedCommunityForInvite.name}</h3>
                            <div className="form-group">
                                <label>Select Users to Invite ({selectedUsers.length} selected)</label>
                                <div className="members-list">
                                    {allUsers.filter(user =>
                                        !selectedCommunityForInvite.members?.some(member => member.uid === user.uid)
                                    ).map((user) => (
                                        <div
                                            key={user.uid}
                                            className={`member-item ${selectedUsers.some(u => u.uid === user.uid) ? 'selected' : ''}`}
                                            onClick={() => handleUserToggle(user)}
                                        >
                                            <div className="member-avatar">
                                                {user.photoURL ? (
                                                    <img src={user.photoURL} alt={user.displayName || user.name} />
                                                ) : (
                                                    <span>{(user.displayName || user.name || user.email)[0].toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div className="member-info">
                                                <span className="member-name">{user.displayName || user.name || 'User'}</span>
                                                <span className="member-email">{user.email}</span>
                                            </div>
                                            <div className="member-checkbox">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="20,6 9,17 4,12"></polyline>
                                                </svg>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="form-actions">
                                <button
                                    className="cancel-btn"
                                    onClick={() => {
                                        setShowInviteForm(false);
                                        setSelectedCommunityForInvite(null);
                                        setSelectedUsers([]);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="submit-btn"
                                    onClick={handleInviteUsers}
                                    disabled={loading || selectedUsers.length === 0}
                                >
                                    {loading ? 'Inviting...' : `Invite ${selectedUsers.length} User(s)`}
                                </button>
                            </div>
                        </div>
                    )}

                    {!showCreateForm && !showInviteForm && (
                        <>
                            {/* Tab Navigation */}
                            <div className="tab-navigation">
                                <button
                                    className={`tab ${activeTab === 'my' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('my')}
                                >
                                    My Communities
                                </button>
                                <button
                                    className={`tab ${activeTab === 'discover' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('discover')}
                                >
                                    Discover
                                </button>
                            </div>

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
                                {loading ? (
                                    <div className="loading-state">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <path d="M12 2a10 10 0 0 1 10 10"></path>
                                        </svg>
                                        <p>Loading communities...</p>
                                    </div>
                                ) : filteredCommunities.length === 0 ? (
                                    <div className="empty-state">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="9" cy="7" r="4"></circle>
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                        </svg>
                                        <h3>
                                            {activeTab === 'my' ? 'No communities joined' : 'No communities found'}
                                        </h3>
                                        <p>
                                            {activeTab === 'my'
                                                ? 'Join or create your first community to get started'
                                                : searchQuery
                                                    ? 'Try adjusting your search terms'
                                                    : 'Discover and join communities that interest you'
                                            }
                                        </p>
                                    </div>
                                ) : (
                                    filteredCommunities.map((community) => {
                                        const isMember = isUserMember(community);
                                        const canInvite = canInviteUsers(community);

                                        return (
                                            <div
                                                key={community.id}
                                                className="community-item"
                                                onClick={() => isMember ? handleCommunitySelect(community) : null}
                                            >
                                                <div className="community-avatar">
                                                    {community.imageUrl ? (
                                                        <img src={community.imageUrl} alt={community.name} />
                                                    ) : (
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                            <circle cx="9" cy="7" r="4"></circle>
                                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                                        </svg>
                                                    )}
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
                                                            {isMember && (
                                                                <span className="badge member">
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <polyline points="20,6 9,17 4,12"></polyline>
                                                                    </svg>
                                                                    Member
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="community-description">{community.description}</p>
                                                    <div className="community-meta">
                                                        <span className="member-count">
                                                            {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}
                                                        </span>
                                                        <span className="last-activity">
                                                            {communityService.formatTimeString(community.lastActivity)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="community-actions">
                                                    {isMember ? (
                                                        <>
                                                            {canInvite && (
                                                                <button
                                                                    className="action-btn"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedCommunityForInvite(community);
                                                                        setSelectedUsers([]);
                                                                        setShowInviteForm(true);
                                                                    }}
                                                                    title="Invite users"
                                                                >
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                                        <circle cx="8.5" cy="7" r="4"></circle>
                                                                        <line x1="20" y1="8" x2="20" y2="14"></line>
                                                                        <line x1="23" y1="11" x2="17" y2="11"></line>
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            <button
                                                                className="action-btn leave"
                                                                onClick={(e) => handleLeaveCommunity(community.id, e)}
                                                                title="Leave community"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                                                    <polyline points="16,17 21,12 16,7"></polyline>
                                                                    <line x1="21" y1="12" x2="9" y2="12"></line>
                                                                </svg>
                                                            </button>
                                                            <svg className="enter-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="9,18 15,12 9,6"></polyline>
                                                            </svg>
                                                        </>
                                                    ) : (
                                                        <button
                                                            className="join-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleJoinCommunity(community);
                                                            }}
                                                            disabled={loading}
                                                        >
                                                            {loading ? 'Joining...' : 'Join'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommunitiesModal;
