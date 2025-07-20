import {
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    getDocs,
    query,
    onSnapshot,
    serverTimestamp,
    orderBy,
    limit,
    writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase_config';
import firestoreCache from '../utils/firestoreCache';
import connectionManager from '../utils/connectionManager';

class UserService {
    // Create or update user profile
    async createUserProfile(user, additionalData = {}) {
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            const userData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL || null,
                status: 'Online',
                lastSeen: serverTimestamp(),
                createdAt: serverTimestamp(),
                isOnline: true,
                fcmToken: null,
                ...additionalData
            };

            try {
                await setDoc(userRef, userData);
                return userData;
            } catch (error) {
                console.error('Error creating user profile:', error);
                throw error;
            }
        }

        return userDoc.data();
    }

    // Batch update multiple user statuses for efficiency
    async batchUpdateUserStatuses(updates) {
        try {
            const batch = writeBatch(db);
            const timestamp = serverTimestamp();

            updates.forEach(({ userId, isOnline, status }) => {
                const userRef = doc(db, 'users', userId);
                batch.update(userRef, {
                    isOnline,
                    lastSeen: timestamp,
                    ...(status && { status })
                });
            });

            await batch.commit();
        } catch (error) {
            console.error('Error batch updating user statuses:', error);
            throw error;
        }
    }

    // Update user status (online/offline)
    async updateUserStatus(userId, isOnline) {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                isOnline,
                lastSeen: serverTimestamp(),
                status: isOnline ? 'Online' : `Last seen ${new Date().toLocaleString()}`
            });
        } catch (error) {
            console.error('Error updating user status:', error);
        }
    }

    // Update user profile - OPTIMIZED: Added cache invalidation
    async updateUserProfile(userId, updates) {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });

            // Invalidate cache for this user
            firestoreCache.delete(`user_${userId}`);

            // Invalidate related search caches (clear all search caches to be safe)
            const cacheKeys = Array.from(firestoreCache.cache.keys());
            cacheKeys.forEach(key => {
                if (key.startsWith('search_users_')) {
                    firestoreCache.delete(key);
                }
            });
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }

    // Upload profile picture
    async uploadProfilePicture(userId, file) {
        try {
            const imageRef = ref(storage, `profilePictures/${userId}/${file.name}`);
            const uploadResult = await uploadBytes(imageRef, file);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            // Update user profile with new photo URL
            await this.updateUserProfile(userId, { photoURL: downloadURL });

            return downloadURL;
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            throw error;
        }
    }

    // Get user by ID - OPTIMIZED: Added caching to reduce reads
    async getUserById(userId) {
        const cacheKey = `user_${userId}`;

        // Check cache first
        const cachedUser = firestoreCache.get(cacheKey);
        if (cachedUser) {
            return cachedUser;
        }

        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = { id: userDoc.id, ...userDoc.data() };
                // Cache for 5 minutes
                firestoreCache.set(cacheKey, userData, 5 * 60 * 1000);
                return userData;
            }
            return null;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    }

    // Search users - OPTIMIZED: Limit results, use selective fields, add caching, and check connection
    async searchUsers(searchTerm, limitResults = 20) {
        // Check connection before expensive operation
        if (!connectionManager.canPerformOperation()) {
            console.log('Cannot perform search - offline or no connection');
            return [];
        }

        const cacheKey = `search_users_${searchTerm.toLowerCase()}_${limitResults}`;

        // Check cache first
        const cachedResults = firestoreCache.get(cacheKey);
        if (cachedResults) {
            return cachedResults;
        }

        try {
            const usersRef = collection(db, 'users');
            // Limit search results to reduce reads
            const q = query(usersRef, orderBy('displayName', 'asc'), limit(limitResults));
            const snapshot = await getDocs(q);
            const users = [];

            snapshot.forEach((doc) => {
                const userData = doc.data();
                if (
                    userData.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    userData.email?.toLowerCase().includes(searchTerm.toLowerCase())
                ) {
                    // Only include essential fields to reduce data transfer
                    users.push({
                        id: doc.id,
                        uid: userData.uid,
                        displayName: userData.displayName,
                        email: userData.email,
                        photoURL: userData.photoURL,
                        status: userData.status,
                        isOnline: userData.isOnline
                    });
                }
            });

            // Cache results for 2 minutes (shorter TTL for search results)
            firestoreCache.set(cacheKey, users, 2 * 60 * 1000);
            return users;
        } catch (error) {
            console.error('Error searching users:', error);
            return [];
        }
    }

    // Get all users (for contacts list) - OPTIMIZED: Limited results and selective fields
    async getAllUsers(excludeUserId = null, limitResults = 100) {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, orderBy('displayName', 'asc'), limit(limitResults));
            const snapshot = await getDocs(q);
            const users = [];

            snapshot.forEach((doc) => {
                if (doc.id !== excludeUserId) {
                    const userData = doc.data();
                    // Only include essential fields to reduce data transfer
                    users.push({
                        id: doc.id,
                        uid: userData.uid,
                        displayName: userData.displayName,
                        email: userData.email,
                        photoURL: userData.photoURL,
                        status: userData.status,
                        isOnline: userData.isOnline
                    });
                }
            });

            return users;
        } catch (error) {
            console.error('Error getting users:', error);
            return [];
        }
    }

    // Get all users once (for community creation)
    async getAllUsersOnce() {
        try {
            const usersCollection = collection(db, 'users');
            const q = query(usersCollection, orderBy('displayName'));
            const snapshot = await getDocs(q);

            const users = [];
            snapshot.forEach((doc) => {
                const userData = doc.data();
                users.push({
                    uid: doc.id,
                    ...userData,
                    id: doc.id, // Add id for compatibility
                    name: userData.displayName || userData.email?.split('@')[0] || 'User' // Add name for compatibility
                });
            });

            return users;
        } catch (error) {
            console.error('Error fetching all users:', error);
            throw error;
        }
    }

    // Listen to user presence
    listenToUserPresence(userId, callback) {
        const userRef = doc(db, 'users', userId);
        return onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
                callback(doc.data());
            }
        });
    }

    // Listen to all users (for contacts)
    // Listen to all users (for contacts) - optimized with limit and selective fields
    listenToUsers(excludeUserId, callback) {
        const usersRef = collection(db, 'users');
        const q = query(
            usersRef,
            orderBy('displayName', 'asc'),
            limit(100) // Limit to reduce data transfer costs
        );

        return onSnapshot(q, (snapshot) => {
            const users = [];
            snapshot.forEach((doc) => {
                if (doc.id !== excludeUserId) {
                    const userData = doc.data();
                    // Only include essential fields to reduce data transfer
                    users.push({
                        id: doc.id,
                        uid: userData.uid,
                        displayName: userData.displayName,
                        email: userData.email,
                        photoURL: userData.photoURL,
                        status: userData.status,
                        isOnline: userData.isOnline
                    });
                }
            });
            callback(users);
        }, (error) => {
            console.error('Error listening to users:', error);
            callback([]);
        });
    }

    // Update FCM token for push notifications
    async updateFCMToken(userId, token) {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                fcmToken: token,
                tokenUpdatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating FCM token:', error);
        }
    }

    // Add user to contacts
    async addContact(userId, contactId) {
        try {
            const userRef = doc(db, 'users', userId, 'contacts', contactId);
            const contactData = await this.getUserById(contactId);

            if (contactData) {
                await setDoc(userRef, {
                    ...contactData,
                    addedAt: serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error adding contact:', error);
            throw error;
        }
    }

    // Get user's contacts - OPTIMIZED: Limited results and selective fields
    async getUserContacts(userId, limitResults = 100) {
        try {
            const contactsRef = collection(db, 'users', userId, 'contacts');
            const q = query(contactsRef, orderBy('addedAt', 'desc'), limit(limitResults));
            const snapshot = await getDocs(q);
            const contacts = [];

            snapshot.forEach((doc) => {
                const contactData = doc.data();
                // Only include essential fields to reduce data transfer
                contacts.push({
                    id: doc.id,
                    displayName: contactData.displayName,
                    email: contactData.email,
                    photoURL: contactData.photoURL,
                    status: contactData.status,
                    isOnline: contactData.isOnline,
                    addedAt: contactData.addedAt
                });
            });

            return contacts;
        } catch (error) {
            console.error('Error getting contacts:', error);
            return [];
        }
    }

    // Block/Unblock user
    async toggleBlockUser(userId, targetUserId, block = true) {
        try {
            const userRef = doc(db, 'users', userId);
            const userData = await getDoc(userRef);

            if (userData.exists()) {
                const data = userData.data();
                const blockedUsers = data.blockedUsers || [];

                if (block) {
                    if (!blockedUsers.includes(targetUserId)) {
                        blockedUsers.push(targetUserId);
                    }
                } else {
                    const index = blockedUsers.indexOf(targetUserId);
                    if (index > -1) {
                        blockedUsers.splice(index, 1);
                    }
                }

                await updateDoc(userRef, { blockedUsers });
            }
        } catch (error) {
            console.error('Error toggling block user:', error);
            throw error;
        }
    }

    // Check if user is blocked
    async isUserBlocked(userId, targetUserId) {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const blockedUsers = userDoc.data().blockedUsers || [];
                return blockedUsers.includes(targetUserId);
            }
            return false;
        } catch (error) {
            console.error('Error checking if user is blocked:', error);
            return false;
        }
    }
}

const userService = new UserService();
export default userService;
