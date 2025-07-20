import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase_config';
import './StatusScreen.css';

const StatusScreen = ({ toggleSidebar }) => {
    const [communities, setCommunities] = useState([]);
    const [userStatuses, setUserStatuses] = useState([]);
    const [currentUserStatus, setCurrentUserStatus] = useState(null);
    const [selectedImages, setSelectedImages] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [showCreateCommunity, setShowCreateCommunity] = useState(false);
    const [newCommunityName, setNewCommunityName] = useState('');
    const [newCommunityDescription, setNewCommunityDescription] = useState('');
    const fileInputRef = useRef(null);

    const { currentUser, userProfile } = useAuth();

    useEffect(() => {
        if (!currentUser) return;

        // Listen to communities
        const communitiesQuery = query(
            collection(db, 'communities'),
            orderBy('lastActivity', 'desc'),
            limit(20)
        );

        const unsubscribeCommunities = onSnapshot(communitiesQuery, (snapshot) => {
            const communitiesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCommunities(communitiesData);
        });

        // Listen to user statuses
        const statusQuery = query(
            collection(db, 'users'),
            orderBy('lastStatusUpdate', 'desc')
        );

        const unsubscribeStatus = onSnapshot(statusQuery, (snapshot) => {
            const statusData = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(user => user.statusImages && user.statusImages.length > 0);

            setUserStatuses(statusData);

            // Set current user status
            const currentUserStatusData = statusData.find(user => user.uid === currentUser.uid);
            setCurrentUserStatus(currentUserStatusData);
        });

        return () => {
            unsubscribeCommunities();
            unsubscribeStatus();
        };
    }, [currentUser]);

    const handleImageSelect = (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            setSelectedImages(files);
            uploadStatusImages(files);
        }
    };

    const uploadStatusImages = async (files) => {
        if (!currentUser || files.length === 0) return;

        setIsUploading(true);
        try {
            const uploadPromises = files.map(async (file) => {
                const storageRef = ref(storage, `status/${currentUser.uid}/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                return await getDownloadURL(snapshot.ref);
            });

            const imageUrls = await Promise.all(uploadPromises);

            // Update user document with new status images
            const userRef = doc(db, 'users', currentUser.uid);
            const statusImages = imageUrls.map(url => ({
                name: userProfile?.displayName || currentUser.displayName || '',
                imageUrl: url,
                createdAt: serverTimestamp()
            }));

            await updateDoc(userRef, {
                statusImages: arrayUnion(...statusImages),
                lastStatusUpdate: serverTimestamp()
            });

            setSelectedImages([]);
        } catch (error) {
            console.error('Error uploading status images:', error);
            alert('Failed to upload status images');
        } finally {
            setIsUploading(false);
        }
    };

    const createCommunity = async () => {
        if (!currentUser || !newCommunityName.trim()) return;

        try {
            await addDoc(collection(db, 'communities'), {
                name: newCommunityName.trim(),
                description: newCommunityDescription.trim(),
                members: [{
                    uid: currentUser.uid,
                    name: userProfile?.displayName || currentUser.displayName || '',
                    email: currentUser.email,
                    photoURL: userProfile?.photoURL || currentUser.photoURL || '',
                    role: 'admin'
                }],
                createdAt: serverTimestamp(),
                lastActivity: serverTimestamp(),
                createdBy: currentUser.uid
            });

            setNewCommunityName('');
            setNewCommunityDescription('');
            setShowCreateCommunity(false);
        } catch (error) {
            console.error('Error creating community:', error);
            alert('Failed to create community');
        }
    };

    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return '';
        const now = new Date();
        const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diffInMinutes = Math.floor((now - time) / (1000 * 60));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        return `${Math.floor(diffInMinutes / 1440)}d ago`;
    };

    return (
        <div className="status-screen">
            <div className="status-header">
                <div className="status-tabs">
                    <div className="tab active">Status</div>
                    <div className="tab">Communities</div>
                </div>
            </div>

            <div className="status-content">
                {/* My Status Section */}
                <div className="my-status-section">
                    <div className="my-status-item" onClick={() => fileInputRef.current?.click()}>
                        <div className="status-avatar">
                            {currentUserStatus?.statusImages?.length > 0 ? (
                                <img
                                    src={currentUserStatus.statusImages[currentUserStatus.statusImages.length - 1]?.imageUrl}
                                    alt="My Status"
                                    className="status-ring"
                                />
                            ) : (
                                <div className="avatar-placeholder">
                                    <img
                                        src={userProfile?.photoURL || currentUser?.photoURL || '/default-avatar.png'}
                                        alt="Profile"
                                        onError={(e) => {
                                            e.target.src = '/default-avatar.png';
                                        }}
                                    />
                                    <div className="add-status-icon">+</div>
                                </div>
                            )}
                        </div>
                        <div className="status-info">
                            <div className="status-name">My Status</div>
                            <div className="status-time">
                                {currentUserStatus?.statusImages?.length > 0
                                    ? formatTimeAgo(currentUserStatus.statusImages[currentUserStatus.statusImages.length - 1]?.createdAt)
                                    : 'Tap to add status update'
                                }
                            </div>
                        </div>
                        {isUploading && <div className="upload-spinner">⌛</div>}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageSelect}
                        style={{ display: 'none' }}
                    />
                </div>

                {/* Recent Updates */}
                {userStatuses.length > 0 && (
                    <div className="recent-updates">
                        <h3>Recent updates</h3>
                        {userStatuses
                            .filter(user => user.uid !== currentUser?.uid)
                            .map(user => (
                                <div key={user.id} className="status-item">
                                    <div className="status-avatar">
                                        <img
                                            src={user.statusImages[user.statusImages.length - 1]?.imageUrl}
                                            alt={user.name}
                                            className="status-ring"
                                        />
                                    </div>
                                    <div className="status-info">
                                        <div className="status-name">{user.name || user.username}</div>
                                        <div className="status-time">
                                            {formatTimeAgo(user.statusImages[user.statusImages.length - 1]?.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                )}

                {/* Communities Section */}
                <div className="communities-section">
                    <div className="communities-header">
                        <h3>Communities</h3>
                        <button
                            className="create-community-btn"
                            onClick={() => setShowCreateCommunity(true)}
                        >
                            +
                        </button>
                    </div>

                    {communities.map(community => (
                        <div key={community.id} className="community-item">
                            <div className="community-avatar">
                                <div className="community-icon">👥</div>
                            </div>
                            <div className="community-info">
                                <div className="community-name">{community.name}</div>
                                <div className="community-description">
                                    {community.description || `${community.members?.length || 0} members`}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Create Community Modal */}
            {showCreateCommunity && (
                <div className="create-community-modal">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Create Community</h3>
                            <button
                                className="close-btn"
                                onClick={() => setShowCreateCommunity(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <input
                                type="text"
                                placeholder="Community name"
                                value={newCommunityName}
                                onChange={(e) => setNewCommunityName(e.target.value)}
                                className="community-input"
                            />
                            <textarea
                                placeholder="Community description (optional)"
                                value={newCommunityDescription}
                                onChange={(e) => setNewCommunityDescription(e.target.value)}
                                className="community-textarea"
                            />
                        </div>
                        <div className="modal-footer">
                            <button
                                className="cancel-btn"
                                onClick={() => setShowCreateCommunity(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="create-btn"
                                onClick={createCommunity}
                                disabled={!newCommunityName.trim()}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatusScreen;
