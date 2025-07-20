// Pagination utility for efficient Firestore data loading
import { query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';

class PaginationHelper {
    constructor(collection, orderByField = 'timestamp', limitPerPage = 20) {
        this.collection = collection;
        this.orderByField = orderByField;
        this.limitPerPage = limitPerPage;
        this.lastVisible = null;
        this.hasMore = true;
        this.isLoading = false;
    }

    // Get first page
    async getFirstPage() {
        if (this.isLoading) return [];

        this.isLoading = true;
        try {
            const q = query(
                this.collection,
                orderBy(this.orderByField, 'desc'),
                limit(this.limitPerPage)
            );

            const querySnapshot = await getDocs(q);
            const docs = [];

            querySnapshot.forEach((doc) => {
                docs.push({ id: doc.id, ...doc.data() });
            });

            // Get the last visible document
            this.lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
            this.hasMore = querySnapshot.docs.length === this.limitPerPage;

            return docs;
        } catch (error) {
            console.error('Error getting first page:', error);
            return [];
        } finally {
            this.isLoading = false;
        }
    }

    // Get next page
    async getNextPage() {
        if (!this.hasMore || this.isLoading || !this.lastVisible) return [];

        this.isLoading = true;
        try {
            const q = query(
                this.collection,
                orderBy(this.orderByField, 'desc'),
                startAfter(this.lastVisible),
                limit(this.limitPerPage)
            );

            const querySnapshot = await getDocs(q);
            const docs = [];

            querySnapshot.forEach((doc) => {
                docs.push({ id: doc.id, ...doc.data() });
            });

            // Update last visible document
            this.lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
            this.hasMore = querySnapshot.docs.length === this.limitPerPage;

            return docs;
        } catch (error) {
            console.error('Error getting next page:', error);
            return [];
        } finally {
            this.isLoading = false;
        }
    }

    // Reset pagination
    reset() {
        this.lastVisible = null;
        this.hasMore = true;
        this.isLoading = false;
    }

    // Check if there are more items to load
    canLoadMore() {
        return this.hasMore && !this.isLoading;
    }
}

export default PaginationHelper;
