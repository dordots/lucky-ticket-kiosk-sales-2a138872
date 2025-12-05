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
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config';

const COLLECTION_NAME = 'kiosks';

// Get all kiosks (only for system managers)
export const getAllKiosks = async () => {
  try {
    const kiosksRef = collection(db, COLLECTION_NAME);
    const querySnapshot = await getDocs(kiosksRef);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting kiosks:', error);
    throw error;
  }
};

// Get kiosk by ID
export const getKioskById = async (kioskId) => {
  try {
    const kioskRef = doc(db, COLLECTION_NAME, kioskId);
    const kioskSnap = await getDoc(kioskRef);
    
    if (kioskSnap.exists()) {
      return {
        id: kioskSnap.id,
        ...kioskSnap.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting kiosk:', error);
    throw error;
  }
};

// Get kiosks by franchisee ID
export const getKiosksByFranchisee = async (franchiseeId) => {
  try {
    const kiosksRef = collection(db, COLLECTION_NAME);
    const q = query(kiosksRef, where('franchisee_id', '==', franchiseeId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting kiosks by franchisee:', error);
    throw error;
  }
};

// Get kiosk for a specific user
export const getKioskForUser = async (userId) => {
  try {
    // First get user data to find their kiosk_id
    const { getUserById } = await import('./users');
    const user = await getUserById(userId);
    
    if (!user) {
      return null;
    }
    
    // System managers don't have a specific kiosk
    if (user.role === 'system_manager') {
      return null;
    }
    
    // If user has kiosk_id, get that kiosk
    if (user.kiosk_id) {
      return await getKioskById(user.kiosk_id);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting kiosk for user:', error);
    throw error;
  }
};

// Create new kiosk
export const createKiosk = async (kioskData) => {
  try {
    const kiosksRef = collection(db, COLLECTION_NAME);
    const newKiosk = {
      name: kioskData.name,
      location: kioskData.location || '',
      franchisee_id: kioskData.franchisee_id,
      is_active: kioskData.is_active !== false,
      settings: kioskData.settings || {},
      created_date: Timestamp.now(),
      updated_date: Timestamp.now()
    };
    const docRef = await addDoc(kiosksRef, newKiosk);
    return {
      id: docRef.id,
      ...newKiosk
    };
  } catch (error) {
    console.error('Error creating kiosk:', error);
    throw error;
  }
};

// Update kiosk
export const updateKiosk = async (kioskId, updateData) => {
  try {
    const kioskRef = doc(db, COLLECTION_NAME, kioskId);
    await updateDoc(kioskRef, {
      ...updateData,
      updated_date: Timestamp.now()
    });
    return await getKioskById(kioskId);
  } catch (error) {
    console.error('Error updating kiosk:', error);
    throw error;
  }
};

// Delete kiosk
export const deleteKiosk = async (kioskId) => {
  try {
    const kioskRef = doc(db, COLLECTION_NAME, kioskId);
    await deleteDoc(kioskRef);
    return true;
  } catch (error) {
    console.error('Error deleting kiosk:', error);
    throw error;
  }
};

// Get active kiosks count
export const getActiveKiosksCount = async () => {
  try {
    const kiosksRef = collection(db, COLLECTION_NAME);
    const q = query(kiosksRef, where('is_active', '==', true));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting active kiosks count:', error);
    throw error;
  }
};


