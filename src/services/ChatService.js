// ChatService.js - Comprehensive chat functionality inspired by SwiftTalk
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    updateDoc,
    deleteDoc,
    where,
    getDocs,
    writeBatch,
    arrayUnion,
    arrayRemove,
    getDoc,
    setDoc
} from 'firebase/firestore';
import { db } from '../firebase_config';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { NotificationService } from './notificationService';

export class ChatService {
    static storage = getStorage();

    // Create sorted chat room ID like Flutter version
    static createChatRoomId(userId1, userId2) {
        return [userId1, userId2].sort().join('_');
    }

    // Send text message
    static async sendMessage({ senderId, receiverId, message, senderName, senderEmail, chatType = 'individual', communityId = null }) {
        try {
            const messageData = {
                senderId,
                receiverId: chatType === 'community' ? communityId : receiverId,
                senderName,
                senderEmail,
                message,
                timestamp: serverTimestamp(),
                type: 'text',
                chatType
            };

            let collectionPath;
            if (chatType === 'community') {
                collectionPath = `communities/${communityId}/messages`;
            } else {
                const chatRoomId = this.createChatRoomId(senderId, receiverId);
                collectionPath = `chatRooms/${chatRoomId}/messages`;
            }

            const docRef = await addDoc(collection(db, collectionPath), messageData);

            // Send notification (implement based on your notification service)
            if (chatType !== 'community') {
                await NotificationService.sendMessageNotification(receiverId, senderName, message);
            }

            return docRef.id;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    // Send file message
    static async sendFileMessage({ senderId, receiverId, file, senderName, senderEmail, chatType = 'individual', communityId = null }) {
        try {
            // Upload file to Firebase Storage
            const fileUrl = await this.uploadFile(file, senderId);

            const messageData = {
                senderId,
                receiverId: chatType === 'community' ? communityId : receiverId,
                senderName,
                senderEmail,
                message: fileUrl,
                filename: file.name,
                fileSize: file.size,
                timestamp: serverTimestamp(),
                type: this.getFileType(file),
                chatType
            };

            let collectionPath;
            if (chatType === 'community') {
                collectionPath = `communities/${communityId}/messages`;
            } else {
                const chatRoomId = this.createChatRoomId(senderId, receiverId);
                collectionPath = `chatRooms/${chatRoomId}/messages`;
            }

            const docRef = await addDoc(collection(db, collectionPath), messageData);

            // Send notification
            if (chatType !== 'community') {
                await NotificationService.sendFileNotification(receiverId, senderName, file.name, this.getFileType(file));
            }

            return docRef.id;
        } catch (error) {
            console.error('Error sending file message:', error);
            throw error;
        }
    }

    // Upload file to Firebase Storage
    static async uploadFile(file, userId) {
        try {
            const fileType = this.getFileType(file);
            const timestamp = Date.now();
            const fileName = `${timestamp}_${file.name}`;
            const filePath = `files/${fileType}/${userId}/${fileName}`;

            const storageRef = ref(this.storage, filePath);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            return downloadURL;
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    }

    // Get file type based on file extension
    static getFileType(file) {
        const extension = file.name.split('.').pop().toLowerCase();

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
            return 'image';
        } else if (['mp4', 'mov', 'avi', 'mkv'].includes(extension)) {
            return 'video';
        } else if (['mp3', 'wav', 'm4a', 'aac'].includes(extension)) {
            return 'audio';
        } else if (['pdf'].includes(extension)) {
            return 'pdf';
        } else if (['doc', 'docx'].includes(extension)) {
            return 'document';
        } else if (['ppt', 'pptx'].includes(extension)) {
            return 'presentation';
        } else if (['xls', 'xlsx'].includes(extension)) {
            return 'spreadsheet';
        } else {
            return 'file';
        }
    }

    // Get messages stream for individual chat
    static getMessagesStream(userId1, userId2) {
        const chatRoomId = this.createChatRoomId(userId1, userId2);
        const messagesQuery = query(
            collection(db, `chatRooms/${chatRoomId}/messages`),
            orderBy('timestamp', 'asc')
        );
        return onSnapshot(messagesQuery, (snapshot) => {
            const messages = [];
            snapshot.forEach((doc) => {
                messages.push({ id: doc.id, ...doc.data() });
            });
            return messages;
        });
    }

    // Get community messages stream
    static getCommunityMessagesStream(communityId) {
        const messagesQuery = query(
            collection(db, `communities/${communityId}/messages`),
            orderBy('timestamp', 'asc')
        );
        return onSnapshot(messagesQuery, (snapshot) => {
            const messages = [];
            snapshot.forEach((doc) => {
                messages.push({ id: doc.id, ...doc.data() });
            });
            return messages;
        });
    }

    // Delete message
    static async deleteMessage(messageId, chatRoomId, isCommuityMessage = false) {
        try {
            let docPath;
            if (isCommuityMessage) {
                docPath = `communities/${chatRoomId}/messages/${messageId}`;
            } else {
                docPath = `chatRooms/${chatRoomId}/messages/${messageId}`;
            }

            await updateDoc(doc(db, docPath), {
                message: 'This message was deleted',
                type: 'deleted'
            });
        } catch (error) {
            console.error('Error deleting message:', error);
            throw error;
        }
    }

    // Edit message
    static async editMessage(messageId, newMessage, chatRoomId, isCommunityMessage = false) {
        try {
            let docPath;
            if (isCommunityMessage) {
                docPath = `communities/${chatRoomId}/messages/${messageId}`;
            } else {
                docPath = `chatRooms/${chatRoomId}/messages/${messageId}`;
            }

            await updateDoc(doc(db, docPath), {
                message: newMessage,
                edited: true,
                editedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error editing message:', error);
            throw error;
        }
    }

    // Initiate video call
    static async initiateCall(callerId, receiverId, callerName) {
        try {
            const chatRoomId = this.createChatRoomId(callerId, receiverId);

            // Create call document
            const callData = {
                callerId,
                receiverId,
                callerName,
                status: 'calling',
                timestamp: serverTimestamp(),
                chatRoomId
            };

            const callRef = await addDoc(collection(db, 'calls'), callData);

            // Update receiver's call status
            await updateDoc(doc(db, 'users', receiverId), {
                isCall: true,
                incomingCall: {
                    callId: callRef.id,
                    callerId,
                    callerName
                }
            });

            // Send call notification
            await NotificationService.sendCallNotification(receiverId, callerName);

            return callRef.id;
        } catch (error) {
            console.error('Error initiating call:', error);
            throw error;
        }
    }

    // End call
    static async endCall(callId, userId) {
        try {
            await updateDoc(doc(db, 'calls', callId), {
                status: 'ended',
                endedAt: serverTimestamp()
            });

            // Update user call status
            await updateDoc(doc(db, 'users', userId), {
                isCall: false,
                incomingCall: null
            });
        } catch (error) {
            console.error('Error ending call:', error);
            throw error;
        }
    }
}
