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

const COLLECTION_NAME = 'ticketTypes';

// Get all ticket types
export const getAllTicketTypes = async () => {
  try {
    const ticketTypesRef = collection(db, COLLECTION_NAME);
    const querySnapshot = await getDocs(ticketTypesRef);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting ticket types:', error);
    throw error;
  }
};

// Get ticket types by filter
export const getTicketTypesByFilter = async (filters = {}) => {
  try {
    const ticketTypesRef = collection(db, COLLECTION_NAME);
    let q = query(ticketTypesRef);
    
    // Apply filters
    Object.keys(filters).forEach(key => {
      q = query(q, where(key, '==', filters[key]));
    });
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error filtering ticket types:', error);
    throw error;
  }
};

// Get single ticket type by ID
export const getTicketTypeById = async (ticketTypeId) => {
  try {
    const ticketTypeRef = doc(db, COLLECTION_NAME, ticketTypeId);
    const ticketTypeSnap = await getDoc(ticketTypeRef);
    
    if (ticketTypeSnap.exists()) {
      return {
        id: ticketTypeSnap.id,
        ...ticketTypeSnap.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting ticket type:', error);
    throw error;
  }
};

// Create new ticket type
export const createTicketType = async (ticketTypeData) => {
  try {
    const ticketTypesRef = collection(db, COLLECTION_NAME);
    const newTicketType = {
      ...ticketTypeData,
      created_date: Timestamp.now(),
      updated_date: Timestamp.now()
    };
    const docRef = await addDoc(ticketTypesRef, newTicketType);
    return {
      id: docRef.id,
      ...newTicketType
    };
  } catch (error) {
    console.error('Error creating ticket type:', error);
    throw error;
  }
};

// Update ticket type
export const updateTicketType = async (ticketTypeId, updateData) => {
  try {
    const ticketTypeRef = doc(db, COLLECTION_NAME, ticketTypeId);
    await updateDoc(ticketTypeRef, {
      ...updateData,
      updated_date: Timestamp.now()
    });
    return await getTicketTypeById(ticketTypeId);
  } catch (error) {
    console.error('Error updating ticket type:', error);
    throw error;
  }
};

// Delete ticket type
export const deleteTicketType = async (ticketTypeId) => {
  try {
    const ticketTypeRef = doc(db, COLLECTION_NAME, ticketTypeId);
    await deleteDoc(ticketTypeRef);
    return true;
  } catch (error) {
    console.error('Error deleting ticket type:', error);
    throw error;
  }
};

