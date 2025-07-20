import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    getDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    arrayUnion,
    arrayRemove,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase_config';

class CommunityService {
    constructor() {
        this.communitiesCollection = collection(db, 'communities');
    }

    // Create a new community
    async createCommunity(communityData, imageFile = null) {
        try {
            let imageUrl = '';

            // Upload image if provided
            if (imageFile) {
                const imageRef = ref(storage, `community-images/${Date.now()}_${imageFile.name}`);
                const snapshot = await uploadBytes(imageRef, imageFile);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            const community = {
                name: communityData.name,
                description: communityData.description || '',
                imageUrl: imageUrl,
                memberCount: communityData.members ? communityData.members.length : 1,
                lastActivity: serverTimestamp(),
                createdBy: communityData.createdBy,
                createdAt: serverTimestamp(),
                members: communityData.members || [],
                memberUids: communityData.members ? communityData.members.map(member => member.uid) : [],
                isPrivate: communityData.isPrivate || false,
                tags: communityData.tags || [],
                settings: {
                    allowMemberInvites: true,
                    allowFileSharing: true,
                    allowMediaSharing: true,
                    moderationEnabled: false
                }
            };

            const docRef = await addDoc(this.communitiesCollection, community);

            // Update the document with its ID
            await updateDoc(docRef, { id: docRef.id });

            return {
                id: docRef.id,
                ...community,
                createdAt: new Date(),
                lastActivity: new Date()
            };
        } catch (error) {
            console.error('Error creating community:', error);
            throw error;
        }
    }

    // Get all communities (public ones or where user is a member)
    async getAllCommunities(userId) {
        try {
            const q = query(
                this.communitiesCollection,
                orderBy('lastActivity', 'desc'),
                limit(50)
            );

            const snapshot = await getDocs(q);
            const communities = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                // Include public communities or communities where user is a member
                if (!data.isPrivate || (data.members && data.members.some(member => member.uid === userId))) {
                    communities.push({
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        lastActivity: data.lastActivity?.toDate() || new Date()
                    });
                }
            });

            return communities;
        } catch (error) {
            console.error('Error fetching communities:', error);
            throw error;
        }
    }

    // Get communities where user is a member
    async getUserCommunities(userId) {
        try {
            // Get all communities and filter client-side (like Flutter app)
            const q = query(
                this.communitiesCollection,
                orderBy('lastActivity', 'desc'),
                limit(100) // Reasonable limit for client-side filtering
            );

            const snapshot = await getDocs(q);
            const communities = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                // Check if user is a member by looking through the members array
                const isMember = data.members && Array.isArray(data.members) &&
                    data.members.some(member => member.uid === userId);

                if (isMember) {
                    communities.push({
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        lastActivity: data.lastActivity?.toDate() || new Date()
                    });
                }
            });

            return communities;
        } catch (error) {
            console.error('Error fetching user communities:', error);
            throw error;
        }
    }

    // Alternative method to get user communities using memberUids array (more efficient)
    async getUserCommunitiesEfficient(userId) {
        try {
            const q = query(
                this.communitiesCollection,
                where('memberUids', 'array-contains', userId),
                orderBy('lastActivity', 'desc')
            );

            const snapshot = await getDocs(q);
            const communities = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                communities.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    lastActivity: data.lastActivity?.toDate() || new Date()
                });
            });

            return communities;
        } catch (error) {
            console.error('Error fetching user communities (efficient):', error);
            // Fallback to client-side filtering if memberUids field doesn't exist
            return this.getUserCommunities(userId);
        }
    }

    // Listen to community updates
    listenToCommunities(userId, callback, userCommunitiesOnly = false) {
        const q = query(
            this.communitiesCollection,
            orderBy('lastActivity', 'desc'),
            limit(100)
        );

        return onSnapshot(q, (snapshot) => {
            const communities = [];

            snapshot.forEach((doc) => {
                const data = doc.data();

                if (userCommunitiesOnly) {
                    // Only include communities where user is a member
                    const isMember = data.members && Array.isArray(data.members) &&
                        data.members.some(member => member.uid === userId);

                    if (isMember) {
                        communities.push({
                            id: doc.id,
                            ...data,
                            createdAt: data.createdAt?.toDate() || new Date(),
                            lastActivity: data.lastActivity?.toDate() || new Date()
                        });
                    }
                } else {
                    // Include public communities or communities where user is a member
                    if (!data.isPrivate || (data.members && data.members.some(member => member.uid === userId))) {
                        communities.push({
                            id: doc.id,
                            ...data,
                            createdAt: data.createdAt?.toDate() || new Date(),
                            lastActivity: data.lastActivity?.toDate() || new Date()
                        });
                    }
                }
            });

            callback(communities);
        }, (error) => {
            console.error('Error listening to communities:', error);
            callback([]);
        });
    }

    // Join a community
    async joinCommunity(communityId, userInfo) {
        try {
            const communityRef = doc(this.communitiesCollection, communityId);
            const communityDoc = await getDoc(communityRef);

            if (!communityDoc.exists()) {
                throw new Error('Community not found');
            }

            const communityData = communityDoc.data();

            // Check if user is already a member
            if (communityData.members && communityData.members.some(member => member.uid === userInfo.uid)) {
                throw new Error('User is already a member of this community');
            }

            // Add user to community
            await updateDoc(communityRef, {
                members: arrayUnion(userInfo),
                memberUids: arrayUnion(userInfo.uid),
                memberCount: (communityData.memberCount || 0) + 1,
                lastActivity: serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('Error joining community:', error);
            throw error;
        }
    }

    // Leave a community
    async leaveCommunity(communityId, userId) {
        try {
            const communityRef = doc(this.communitiesCollection, communityId);
            const communityDoc = await getDoc(communityRef);

            if (!communityDoc.exists()) {
                throw new Error('Community not found');
            }

            const communityData = communityDoc.data();
            const member = communityData.members?.find(m => m.uid === userId);

            if (!member) {
                throw new Error('User is not a member of this community');
            }

            // Remove user from community
            await updateDoc(communityRef, {
                members: arrayRemove(member),
                memberUids: arrayRemove(userId),
                memberCount: Math.max((communityData.memberCount || 1) - 1, 0),
                lastActivity: serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('Error leaving community:', error);
            throw error;
        }
    }

    // Update community
    async updateCommunity(communityId, updates, imageFile = null) {
        try {
            const communityRef = doc(this.communitiesCollection, communityId);

            let updateData = {
                ...updates,
                lastActivity: serverTimestamp()
            };

            // Upload new image if provided
            if (imageFile) {
                const imageRef = ref(storage, `community-images/${Date.now()}_${imageFile.name}`);
                const snapshot = await uploadBytes(imageRef, imageFile);
                updateData.imageUrl = await getDownloadURL(snapshot.ref);
            }

            await updateDoc(communityRef, updateData);
            return true;
        } catch (error) {
            console.error('Error updating community:', error);
            throw error;
        }
    }

    // Delete community
    async deleteCommunity(communityId, userId) {
        try {
            const communityRef = doc(this.communitiesCollection, communityId);
            const communityDoc = await getDoc(communityRef);

            if (!communityDoc.exists()) {
                throw new Error('Community not found');
            }

            const communityData = communityDoc.data();

            // Check if user is the creator
            if (communityData.createdBy !== userId) {
                throw new Error('Only the community creator can delete this community');
            }

            await deleteDoc(communityRef);
            return true;
        } catch (error) {
            console.error('Error deleting community:', error);
            throw error;
        }
    }

    // Search communities
    async searchCommunities(searchTerm, userId) {
        try {
            const q = query(
                this.communitiesCollection,
                orderBy('name'),
                limit(20)
            );

            const snapshot = await getDocs(q);
            const communities = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                const name = data.name?.toLowerCase() || '';
                const description = data.description?.toLowerCase() || '';
                const search = searchTerm.toLowerCase();

                // Include if name or description matches and user has access
                if ((name.includes(search) || description.includes(search)) &&
                    (!data.isPrivate || (data.members && data.members.some(member => member.uid === userId)))) {
                    communities.push({
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        lastActivity: data.lastActivity?.toDate() || new Date()
                    });
                }
            });

            return communities;
        } catch (error) {
            console.error('Error searching communities:', error);
            throw error;
        }
    }

    // Get community by ID
    async getCommunityById(communityId) {
        try {
            const communityRef = doc(this.communitiesCollection, communityId);
            const communityDoc = await getDoc(communityRef);

            if (!communityDoc.exists()) {
                throw new Error('Community not found');
            }

            const data = communityDoc.data();
            return {
                id: communityDoc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                lastActivity: data.lastActivity?.toDate() || new Date()
            };
        } catch (error) {
            console.error('Error fetching community:', error);
            throw error;
        }
    }

    // Invite users to community
    async inviteUsersToCommaunity(communityId, userInfos, invitedBy) {
        try {
            const communityRef = doc(this.communitiesCollection, communityId);
            const communityDoc = await getDoc(communityRef);

            if (!communityDoc.exists()) {
                throw new Error('Community not found');
            }

            const communityData = communityDoc.data();
            const newMembers = [];

            // Filter out users who are already members
            for (const userInfo of userInfos) {
                if (!communityData.members?.some(member => member.uid === userInfo.uid)) {
                    newMembers.push(userInfo);
                }
            }

            if (newMembers.length === 0) {
                throw new Error('All selected users are already members');
            }

            // Add new members to community
            await updateDoc(communityRef, {
                members: arrayUnion(...newMembers),
                memberCount: (communityData.memberCount || 0) + newMembers.length,
                lastActivity: serverTimestamp()
            });

            return newMembers.length;
        } catch (error) {
            console.error('Error inviting users to community:', error);
            throw error;
        }
    }

    // Update community activity (when someone sends a message)
    async updateCommunityActivity(communityId) {
        try {
            const communityRef = doc(this.communitiesCollection, communityId);
            await updateDoc(communityRef, {
                lastActivity: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating community activity:', error);
        }
    }

    // Format time string (helper method)
    formatTimeString(timestamp) {
        if (!timestamp) return '';

        const now = new Date();
        const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 60) {
            return `${diffMinutes} min`;
        } else if (diffHours < 24) {
            return `${diffHours} hr`;
        } else {
            return `${diffDays} d`;
        }
    }

    // Helper method to create member structure with both member objects and UID array
    createMemberStructure(memberObjects) {
        return {
            members: memberObjects, // Full member objects for display
            memberUids: memberObjects.map(member => member.uid) // Simple UID array for querying
        };
    }
}

const communityService = new CommunityService();
export default communityService;
