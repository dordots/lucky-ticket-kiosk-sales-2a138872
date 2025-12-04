import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config';

const COLLECTION_NAME = 'notifications';

// Get all notifications
export const getAllNotifications = async (orderByField = 'created_date', limitCount = 100) => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME);
    const orderDirection = orderByField.startsWith('-') ? 'desc' : 'asc';
    const fieldName = orderByField.startsWith('-') ? orderByField.substring(1) : orderByField;
    
    let q = query(notificationsRef, orderBy(fieldName, orderDirection));
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_date: doc.data().created_date?.toDate?.()?.toISOString() || doc.data().created_date
    }));
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw error;
  }
};

// Get notifications by filter
export const getNotificationsByFilter = async (filters = {}) => {
  try {
    // Get current user to filter by user_id (required by Firebase Rules)
    const { getCurrentUser } = await import('./auth');
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return [];
    }
    
    const notificationsRef = collection(db, COLLECTION_NAME);
    
    // Always filter by user_id first (required by Firebase Rules)
    let q = query(notificationsRef, where('user_id', '==', currentUser.uid));
    
    // Apply additional filters (but avoid composite index issues)
    // If is_read filter is provided, we'll filter in memory to avoid index requirement
    const needsIsReadFilter = filters.is_read !== undefined;
    const otherFilters = { ...filters };
    if (needsIsReadFilter) {
      delete otherFilters.is_read;
    }
    
    // Apply other filters
    Object.keys(otherFilters).forEach(key => {
      if (key !== 'user_id') {
        q = query(q, where(key, '==', otherFilters[key]));
      }
    });
    
    // Only order by created_date if we don't need is_read filter (to avoid composite index)
    if (!needsIsReadFilter) {
      q = query(q, orderBy('created_date', 'desc'));
    }
    
    const querySnapshot = await getDocs(q);
    let results = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_date: doc.data().created_date?.toDate?.()?.toISOString() || doc.data().created_date
    }));
    
    // Filter by is_read in memory if needed
    if (needsIsReadFilter) {
      results = results.filter(n => n.is_read === filters.is_read);
    }
    
    // Sort by created_date if we filtered in memory
    if (needsIsReadFilter) {
      results.sort((a, b) => {
        const dateA = new Date(a.created_date || 0);
        const dateB = new Date(b.created_date || 0);
        return dateB - dateA;
      });
    }
    
    return results;
  } catch (error) {
    console.error('Error filtering notifications:', error);
    throw error;
  }
};

// Get single notification by ID
export const getNotificationById = async (notificationId) => {
  try {
    const notificationRef = doc(db, COLLECTION_NAME, notificationId);
    const notificationSnap = await getDoc(notificationRef);
    
    if (notificationSnap.exists()) {
      return {
        id: notificationSnap.id,
        ...notificationSnap.data(),
        created_date: notificationSnap.data().created_date?.toDate?.()?.toISOString() || notificationSnap.data().created_date
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting notification:', error);
    throw error;
  }
};

// Create new notification
export const createNotification = async (notificationData) => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME);
    const newNotification = {
      ...notificationData,
      created_date: Timestamp.now(),
      updated_date: Timestamp.now()
    };
    const docRef = await addDoc(notificationsRef, newNotification);
    return {
      id: docRef.id,
      ...newNotification,
      created_date: newNotification.created_date.toDate().toISOString()
    };
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Update notification
export const updateNotification = async (notificationId, updateData) => {
  try {
    const notificationRef = doc(db, COLLECTION_NAME, notificationId);
    await updateDoc(notificationRef, {
      ...updateData,
      updated_date: Timestamp.now()
    });
    return await getNotificationById(notificationId);
  } catch (error) {
    console.error('Error updating notification:', error);
    throw error;
  }
};

// Delete notification
export const deleteNotification = async (notificationId) => {
  try {
    const notificationRef = doc(db, COLLECTION_NAME, notificationId);
    await deleteDoc(notificationRef);
    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

