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
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config';

const COLLECTION_NAME = 'sales';

// Get all sales (optionally filtered by kiosk_id)
export const getAllSales = async (limitCount = null, kioskId = null) => {
  try {
    const salesRef = collection(db, COLLECTION_NAME);
    let q = query(salesRef);
    
    // Filter by kiosk_id if provided
    if (kioskId) {
      q = query(q, where('kiosk_id', '==', kioskId));
    }
    
    q = query(q, orderBy('created_date', 'desc'));
    
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
    console.error('Error getting sales:', error);
    throw error;
  }
};

// Get sales by filter
export const getSalesByFilter = async (filters = {}) => {
  try {
    const salesRef = collection(db, COLLECTION_NAME);
    let q = query(salesRef);
    
    // Apply filters
    Object.keys(filters).forEach(key => {
      q = query(q, where(key, '==', filters[key]));
    });
    
    q = query(q, orderBy('created_date', 'desc'));
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_date: doc.data().created_date?.toDate?.()?.toISOString() || doc.data().created_date
    }));
  } catch (error) {
    console.error('Error filtering sales:', error);
    throw error;
  }
};

// Get sales by kiosk ID
export const getSalesByKiosk = async (kioskId, limitCount = null) => {
  try {
    return await getAllSales(limitCount, kioskId);
  } catch (error) {
    console.error('Error getting sales by kiosk:', error);
    throw error;
  }
};

// Get single sale by ID
export const getSaleById = async (saleId) => {
  try {
    const saleRef = doc(db, COLLECTION_NAME, saleId);
    const saleSnap = await getDoc(saleRef);
    
    if (saleSnap.exists()) {
      return {
        id: saleSnap.id,
        ...saleSnap.data(),
        created_date: saleSnap.data().created_date?.toDate?.()?.toISOString() || saleSnap.data().created_date
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting sale:', error);
    throw error;
  }
};

// Create new sale
export const createSale = async (saleData) => {
  try {
    // Get current user to determine kiosk_id if not provided
    let kioskId = saleData.kiosk_id;
    
    if (!kioskId) {
      const { getCurrentUser } = await import('./auth');
      const currentUser = await getCurrentUser();
      if (currentUser) {
        kioskId = currentUser.kiosk_id;
      }
    }
    
    if (!kioskId) {
      throw new Error('kiosk_id is required for creating a sale');
    }
    
    const salesRef = collection(db, COLLECTION_NAME);
    const newSale = {
      ...saleData,
      kiosk_id: kioskId,
      created_date: Timestamp.now(),
      updated_date: Timestamp.now()
    };
    const docRef = await addDoc(salesRef, newSale);
    return {
      id: docRef.id,
      ...newSale,
      created_date: newSale.created_date.toDate().toISOString()
    };
  } catch (error) {
    console.error('Error creating sale:', error);
    throw error;
  }
};

// Update sale
export const updateSale = async (saleId, updateData) => {
  try {
    const saleRef = doc(db, COLLECTION_NAME, saleId);
    await updateDoc(saleRef, {
      ...updateData,
      updated_date: Timestamp.now()
    });
    return await getSaleById(saleId);
  } catch (error) {
    console.error('Error updating sale:', error);
    throw error;
  }
};

// Delete sale
export const deleteSale = async (saleId) => {
  try {
    const saleRef = doc(db, COLLECTION_NAME, saleId);
    await deleteDoc(saleRef);
    return true;
  } catch (error) {
    console.error('Error deleting sale:', error);
    throw error;
  }
};

