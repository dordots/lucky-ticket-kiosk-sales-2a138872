import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  updateDoc, 
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

