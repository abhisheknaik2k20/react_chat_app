import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from 'firebase/auth';
import { auth } from '../firebase_config';
import userService from '../services/userService';
import notificationService from '../services/notificationService';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const signup = async (email, password, displayName) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // Update the user's display name
        if (displayName) {
            await updateProfile(userCredential.user, { displayName });
        }

        // Create user profile in Firestore
        await userService.createUserProfile(userCredential.user, { displayName });

        return userCredential;
    };

    const login = async (email, password) => {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // Update user status to online
        await userService.updateUserStatus(userCredential.user.uid, true);

        // Update FCM token for notifications
        const fcmToken = notificationService.getFCMToken();
        if (fcmToken) {
            await userService.updateFCMToken(userCredential.user.uid, fcmToken);
        }

        return userCredential;
    };

    const logout = async () => {
        if (currentUser) {
            // Update user status to offline
            await userService.updateUserStatus(currentUser.uid, false);
        }
        return signOut(auth);
    };    // Memoize expensive operations
    const updateUserProfile = useCallback(async (updates) => {
        if (!currentUser) return;

        try {
            // Update Firebase Auth profile if display name is being updated
            if (updates.displayName) {
                await updateProfile(currentUser, { displayName: updates.displayName });
            }

            // Update Firestore profile with batch operation if multiple fields
            await userService.updateUserProfile(currentUser.uid, updates);

            // Update local state
            setUserProfile(prev => ({ ...prev, ...updates }));
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    }, [currentUser]);

    const uploadProfilePicture = useCallback(async (file) => {
        if (!currentUser) return;

        try {
            const photoURL = await userService.uploadProfilePicture(currentUser.uid, file);

            // Update Firebase Auth profile
            await updateProfile(currentUser, { photoURL });

            // Update local state
            setUserProfile(prev => ({ ...prev, photoURL }));

            return photoURL;
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            throw error;
        }
    }, [currentUser]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            if (user) {
                // Get or create user profile
                const profile = await userService.createUserProfile(user);
                setUserProfile(profile);

                // Set user online
                await userService.updateUserStatus(user.uid, true);

                // Setup notification token
                const fcmToken = notificationService.getFCMToken();
                if (fcmToken) {
                    await userService.updateFCMToken(user.uid, fcmToken);
                }
            } else {
                setUserProfile(null);
            }

            setLoading(false);
        });

        return () => {
            unsubscribe();
        };
    }, []); // Empty dependency array since onAuthStateChanged should only be set up once

    // Handle cleanup on app close
    useEffect(() => {
        const handleBeforeUnload = async () => {
            if (currentUser) {
                await userService.updateUserStatus(currentUser.uid, false);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [currentUser]);

    // Update user presence based on visibility
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (currentUser) {
                const isOnline = !document.hidden;
                await userService.updateUserStatus(currentUser.uid, isOnline);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [currentUser]);

    const value = {
        currentUser,
        userProfile,
        signup,
        login,
        logout,
        updateUserProfile,
        uploadProfilePicture
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
