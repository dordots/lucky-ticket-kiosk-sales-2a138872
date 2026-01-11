import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config';

const COLLECTION_NAME = 'users';

// Get all users
export const getAllUsers = async () => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    const querySnapshot = await getDocs(usersRef);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
};

// Get user by ID
export const getUserById = async (userId) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return {
        id: userSnap.id,
        ...userSnap.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

// Update user
export const updateUser = async (userId, updateData) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    await updateDoc(userRef, {
      ...updateData,
      updated_date: Timestamp.now()
    });
    return await getUserById(userId);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

// Get count of active users
export const getActiveUsersCount = async () => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    const querySnapshot = await getDocs(usersRef);
    const activeUsers = querySnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.is_active !== false; // Consider undefined/null as active
    });
    return activeUsers.length;
  } catch (error) {
    console.error('Error getting active users count:', error);
    throw error;
  }
};

// Get count of active users by kiosk
export const getActiveUsersCountByKiosk = async (kioskId) => {
  try {
    if (!kioskId) {
      return 0;
    }
    const usersRef = collection(db, COLLECTION_NAME);
    const q = query(usersRef, where('kiosk_id', '==', kioskId));
    const querySnapshot = await getDocs(q);
    const activeUsers = querySnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.is_active !== false; // Consider undefined/null as active
    });
    return activeUsers.length;
  } catch (error) {
    console.error('Error getting active users count by kiosk:', error);
    throw error;
  }
};

// Check if user limit is reached for a specific kiosk
export const checkUserLimit = async (maxUsers = 4, kioskId = null) => {
  try {
    let activeCount;
    if (kioskId) {
      activeCount = await getActiveUsersCountByKiosk(kioskId);
    } else {
      activeCount = await getActiveUsersCount();
    }
    return {
      isLimitReached: activeCount >= maxUsers,
      currentCount: activeCount,
      maxUsers: maxUsers
    };
  } catch (error) {
    console.error('Error checking user limit:', error);
    throw error;
  }
};

// Get users by kiosk ID
export const getUsersByKiosk = async (kioskId) => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    const q = query(usersRef, where('kiosk_id', '==', kioskId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting users by kiosk:', error);
    throw error;
  }
};

// Get users by role
export const getUsersByRole = async (role) => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    const q = query(usersRef, where('role', '==', role));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting users by role:', error);
    throw error;
  }
};

// Delete user document
export const deleteUserDoc = async (userId) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    await deleteDoc(userRef);
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

// Helper function to check if user is system manager
export const isSystemManager = (user) => {
  return user?.role === 'system_manager';
};

// Helper function to check if user is franchisee
export const isFranchisee = (user) => {
  return user?.role === 'franchisee';
};

// Helper function to check if user is assistant
export const isAssistant = (user) => {
  return user?.role === 'assistant';
};

// Helper function to check if user can access a kiosk
export const canAccessKiosk = (user, kioskId) => {
  if (!user || !kioskId) return false;
  
  // System managers can access all kiosks
  if (isSystemManager(user)) return true;
  
  // Check if user's kiosk_id matches
  if (user.kiosk_id === kioskId) return true;
  
  // Check if kiosk_id is in user's kiosk_ids array (for franchisees with multiple kiosks)
  if (user.kiosk_ids && Array.isArray(user.kiosk_ids) && user.kiosk_ids.includes(kioskId)) {
    return true;
  }
  
  return false;
};
