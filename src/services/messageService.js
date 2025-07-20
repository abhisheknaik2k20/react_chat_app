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
    setDoc,
    getDoc,
    increment
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase_config';
import { v4 as uuidv4 } from 'uuid';

class MessageService {
    // Create chat room ID from user IDs
    createChatRoomId(userId1, userId2) {
        return [userId1, userId2].sort().join('_');
    }

    // Send text message
    async sendMessage(chatRoomId, message, userId, userEmail, displayName) {
        try {
            const messageData = {
                text: message,
                senderId: userId,
                senderEmail: userEmail,
                senderName: displayName,
                timestamp: serverTimestamp(),
                type: 'text'
            };

            const docRef = await addDoc(collection(db, 'chatRooms', chatRoomId, 'messages'), messageData);

            // Update chat room last activity with the document ID
            await this.updateChatRoomActivity(chatRoomId, { ...messageData, id: docRef.id });

            return { ...messageData, id: docRef.id };
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    // Send file message
    async sendFileMessage(chatRoomId, file, userId, userEmail, displayName) {
        try {
            const fileId = uuidv4();
            const fileRef = ref(storage, `chatFiles/${chatRoomId}/${fileId}_${file.name}`);

            // Upload file
            const uploadResult = await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            const messageData = {
                fileName: file.name,
                fileUrl: downloadURL,
                fileSize: file.size,
                fileType: file.type,
                senderId: userId,
                senderEmail: userEmail,
                senderName: displayName,
                timestamp: serverTimestamp(),
                type: this.getFileType(file.type)
            };

            const docRef = await addDoc(collection(db, 'chatRooms', chatRoomId, 'messages'), messageData);

            await this.updateChatRoomActivity(chatRoomId, { ...messageData, id: docRef.id });

            return { ...messageData, id: docRef.id };
        } catch (error) {
            console.error('Error sending file:', error);
            throw error;
        }
    }

    // Get file type category
    getFileType(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType.includes('pdf')) return 'pdf';
        if (mimeType.includes('document') || mimeType.includes('word')) return 'document';
        return 'file';
    }

    // Listen to messages in real-time
    listenToMessages(chatRoomId, callback) {
        const q = query(
            collection(db, 'chatRooms', chatRoomId, 'messages'),
            orderBy('timestamp', 'asc')
        );

        return onSnapshot(q, (querySnapshot) => {
            const messages = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Always use the Firestore document ID as the primary ID
                messages.push({
                    ...data,
                    id: doc.id,
                    firestoreId: doc.id // Backup reference
                });
            });
            callback(messages);
        }, (error) => {
            console.error('Error listening to messages:', error);
            callback([]); // Return empty array on error
        });
    }

    // Real-time listener for user's chat rooms
    listenToUserChatRooms(userId, callback) {
        try {
            const q = query(
                collection(db, 'chatRooms'),
                where('participants', 'array-contains', userId),
                orderBy('lastActivity', 'desc')
            );

            return onSnapshot(q, (snapshot) => {
                const chatRooms = [];
                snapshot.forEach((doc) => {
                    chatRooms.push({ id: doc.id, ...doc.data() });
                });
                callback(chatRooms);
            });
        } catch (error) {
            console.error('Error listening to chat rooms:', error);
            callback([]);
        }
    }

    // Update chat room activity
    async updateChatRoomActivity(chatRoomId, lastMessage) {
        try {
            const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
            await setDoc(chatRoomRef, {
                lastMessage: {
                    text: lastMessage.text || lastMessage.fileName || 'File',
                    timestamp: lastMessage.timestamp,
                    senderId: lastMessage.senderId,
                    type: lastMessage.type
                },
                lastActivity: serverTimestamp(),
                messageCount: increment(1)
            }, { merge: true });
        } catch (error) {
            console.error('Error updating chat room activity:', error);
        }
    }

    // Get user's chat rooms
    async getUserChatRooms(userId) {
        try {
            const q = query(
                collection(db, 'chatRooms'),
                where('participants', 'array-contains', userId),
                orderBy('lastActivity', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const chatRooms = [];

            querySnapshot.forEach((doc) => {
                chatRooms.push({ id: doc.id, ...doc.data() });
            });

            return chatRooms;
        } catch (error) {
            console.error('Error getting chat rooms:', error);
            return [];
        }
    }

    // Create or get chat room
    async createOrGetChatRoom(user1, user2) {
        // Ensure both users have the required uid field
        const user1Id = user1.uid || user1.id;
        const user2Id = user2.uid || user2.id;

        if (!user1Id || !user2Id) {
            throw new Error('Both users must have a valid ID');
        }

        const chatRoomId = this.createChatRoomId(user1Id, user2Id);
        const chatRoomRef = doc(db, 'chatRooms', chatRoomId);

        try {
            const chatRoomDoc = await getDoc(chatRoomRef);

            if (!chatRoomDoc.exists()) {
                // Ensure all required fields are present with defaults
                const user1Data = {
                    email: user1.email || '',
                    displayName: user1.displayName || (user1.email ? user1.email.split('@')[0] : 'Unknown User'),
                    photoURL: user1.photoURL || null
                };

                const user2Data = {
                    email: user2.email || '',
                    displayName: user2.displayName || (user2.email ? user2.email.split('@')[0] : 'Unknown User'),
                    photoURL: user2.photoURL || null
                };

                // Create new chat room
                await setDoc(chatRoomRef, {
                    participants: [user1Id, user2Id],
                    participantDetails: {
                        [user1Id]: user1Data,
                        [user2Id]: user2Data
                    },
                    createdAt: serverTimestamp(),
                    lastActivity: serverTimestamp(),
                    messageCount: 0
                });
            }

            return chatRoomId;
        } catch (error) {
            console.error('Error creating chat room:', error);
            throw error;
        }
    }

    // Delete message
    async deleteMessage(chatRoomId, messageId) {
        try {
            const messageRef = doc(db, 'chatRooms', chatRoomId, 'messages', messageId);

            // Check if message exists first
            const messageDoc = await getDoc(messageRef);
            if (!messageDoc.exists()) {
                throw new Error('Message not found');
            }

            await deleteDoc(messageRef);
        } catch (error) {
            console.error('Error deleting message:', error);
            throw error;
        }
    }

    // Edit message
    async editMessage(chatRoomId, messageId, newText) {
        try {
            const messageRef = doc(db, 'chatRooms', chatRoomId, 'messages', messageId);

            // Check if message exists first
            const messageDoc = await getDoc(messageRef);
            if (!messageDoc.exists()) {
                throw new Error('Message not found');
            }

            await updateDoc(messageRef, {
                text: newText,
                edited: true,
                editedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error editing message:', error);
            throw error;
        }
    }

    // React to message
    async reactToMessage(chatRoomId, messageId, userId, emoji) {
        try {
            const messageRef = doc(db, 'chatRooms', chatRoomId, 'messages', messageId);
            const messageDoc = await getDoc(messageRef);

            if (messageDoc.exists()) {
                const data = messageDoc.data();
                const reactions = data.reactions || {};

                if (!reactions[emoji]) {
                    reactions[emoji] = [];
                }

                const userIndex = reactions[emoji].indexOf(userId);
                if (userIndex > -1) {
                    reactions[emoji].splice(userIndex, 1);
                    if (reactions[emoji].length === 0) {
                        delete reactions[emoji];
                    }
                } else {
                    reactions[emoji].push(userId);
                }

                await updateDoc(messageRef, { reactions });
            }
        } catch (error) {
            console.error('Error reacting to message:', error);
            throw error;
        }
    }

    // Search messages
    async searchMessages(chatRoomId, searchTerm) {
        try {
            const q = query(
                collection(db, 'chatRooms', chatRoomId, 'messages'),
                orderBy('timestamp', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const messages = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.text && data.text.toLowerCase().includes(searchTerm.toLowerCase())) {
                    messages.push({ id: doc.id, ...data });
                }
            });

            return messages;
        } catch (error) {
            console.error('Error searching messages:', error);
            return [];
        }
    }
}

const messageService = new MessageService();
export default messageService;
