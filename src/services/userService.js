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
    orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase_config';

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

    // Update user profile
    async updateUserProfile(userId, updates) {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                ...updates,
                updatedAt: serverTimestamp()
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

    // Get user by ID
    async getUserById(userId) {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    }

    // Search users
    async searchUsers(searchTerm) {
        try {
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);
            const users = [];

            snapshot.forEach((doc) => {
                const userData = doc.data();
                if (
                    userData.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    userData.email?.toLowerCase().includes(searchTerm.toLowerCase())
                ) {
                    users.push({ id: doc.id, ...userData });
                }
            });

            return users;
        } catch (error) {
            console.error('Error searching users:', error);
            return [];
        }
    }

    // Get all users (for contacts list)
    async getAllUsers(excludeUserId = null) {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, orderBy('displayName', 'asc'));
            const snapshot = await getDocs(q);
            const users = [];

            snapshot.forEach((doc) => {
                if (doc.id !== excludeUserId) {
                    users.push({ id: doc.id, ...doc.data() });
                }
            });

            return users;
        } catch (error) {
            console.error('Error getting users:', error);
            return [];
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
    listenToUsers(excludeUserId, callback) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('displayName', 'asc'));

        return onSnapshot(q, (snapshot) => {
            const users = [];
            snapshot.forEach((doc) => {
                if (doc.id !== excludeUserId) {
                    users.push({ id: doc.id, ...doc.data() });
                }
            });
            callback(users);
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

    // Get user's contacts
    async getUserContacts(userId) {
        try {
            const contactsRef = collection(db, 'users', userId, 'contacts');
            const snapshot = await getDocs(contactsRef);
            const contacts = [];

            snapshot.forEach((doc) => {
                contacts.push({ id: doc.id, ...doc.data() });
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
