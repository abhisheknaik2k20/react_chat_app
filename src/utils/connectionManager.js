// Connection state manager to prevent unnecessary operations when offline
import { getApp } from 'firebase/app';
import { getFirestore, enableNetwork, disableNetwork } from 'firebase/firestore';

class ConnectionManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.isFirebaseOnline = true;
        this.db = getFirestore(getApp());
        this.listeners = new Set();

        this.setupListeners();
    }

    setupListeners() {
        // Browser online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.enableFirebaseNetwork();
            this.notifyListeners('online');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.disableFirebaseNetwork();
            this.notifyListeners('offline');
        });
    }

    async enableFirebaseNetwork() {
        if (!this.isFirebaseOnline) {
            try {
                await enableNetwork(this.db);
                this.isFirebaseOnline = true;
                console.log('Firebase network enabled');
            } catch (error) {
                console.error('Error enabling Firebase network:', error);
            }
        }
    }

    async disableFirebaseNetwork() {
        if (this.isFirebaseOnline) {
            try {
                await disableNetwork(this.db);
                this.isFirebaseOnline = false;
                console.log('Firebase network disabled');
            } catch (error) {
                console.error('Error disabling Firebase network:', error);
            }
        }
    }

    // Check if operations should be attempted
    canPerformOperation() {
        return this.isOnline && this.isFirebaseOnline;
    }

    // Add listener for connection state changes
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    // Notify all listeners of connection state changes
    notifyListeners(state) {
        this.listeners.forEach(callback => {
            try {
                callback(state, this.isOnline);
            } catch (error) {
                console.error('Error in connection listener:', error);
            }
        });
    }

    getConnectionState() {
        return {
            isOnline: this.isOnline,
            isFirebaseOnline: this.isFirebaseOnline,
            canPerformOperation: this.canPerformOperation()
        };
    }
}

// Create global connection manager instance
const connectionManager = new ConnectionManager();

export default connectionManager;
