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

// Generate unique code for ticket
export const generateUniqueCode = async (category = 'custom', kioskId = null) => {
  const maxAttempts = 10;
  let attempts = 0;
  
  // Get current user's kiosk_id if not provided
  if (!kioskId) {
    try {
      const { getCurrentUser } = await import('./auth');
      const currentUser = await getCurrentUser();
      if (currentUser) {
        kioskId = currentUser.kiosk_id;
      }
    } catch (error) {
      console.error('Error getting current user for code generation:', error);
    }
  }
  
  while (attempts < maxAttempts) {
    // Generate code based on category
    let code;
    if (category === 'pais') {
      // For Pais tickets: PAIS-XXXXX (random 5 chars)
      code = 'PAIS-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    } else {
      // For custom tickets: CUST-XXXXX (random 5 chars)
      code = 'CUST-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    }
    
    // Check if code already exists (only in the same kiosk)
    try {
      const ticketTypesRef = collection(db, COLLECTION_NAME);
      let codeQuery = query(ticketTypesRef, where('code', '==', code));
      
      // If kioskId is provided, filter by it (for permissions)
      if (kioskId) {
        codeQuery = query(codeQuery, where('kiosk_id', '==', kioskId));
      }
      
      const codeSnapshot = await getDocs(codeQuery);
      
      if (codeSnapshot.empty) {
        return code; // Code is unique
      }
    } catch (error) {
      console.error('Error checking code uniqueness:', error);
      // If error checking, return the code anyway (better than failing)
      if (attempts === maxAttempts - 1) {
        return code;
      }
    }
    
    attempts++;
  }
  
  // Fallback: use timestamp if all attempts failed
  const timestamp = Date.now().toString(36).toUpperCase().slice(-5);
  return category === 'pais' ? `PAIS-${timestamp}` : `CUST-${timestamp}`;
};

// Get all ticket types (optionally filtered by kiosk_id)
export const getAllTicketTypes = async (kioskId = null) => {
  try {
    const ticketTypesRef = collection(db, COLLECTION_NAME);
    let q = query(ticketTypesRef);
    
    // Filter by kiosk_id if provided
    if (kioskId) {
      q = query(q, where('kiosk_id', '==', kioskId));
    }
    
    const querySnapshot = await getDocs(q);
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

// Get ticket types by kiosk ID
export const getTicketTypesByKiosk = async (kioskId) => {
  try {
    return await getAllTicketTypes(kioskId);
  } catch (error) {
    console.error('Error getting ticket types by kiosk:', error);
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
    // Get current user to determine kiosk_id if not provided
    let kioskId = ticketTypeData.kiosk_id;
    
    if (!kioskId) {
      const { getCurrentUser } = await import('./auth');
      const currentUser = await getCurrentUser();
      if (currentUser) {
        kioskId = currentUser.kiosk_id;
      }
    }
    
    if (!kioskId) {
      throw new Error('kiosk_id is required for creating a ticket type');
    }
    
    const ticketTypesRef = collection(db, COLLECTION_NAME);
    const newTicketType = {
      ...ticketTypeData,
      kiosk_id: kioskId,
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

