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

// Helper function to parse amount string "counter,vault" to numbers
const parseAmount = (amountString) => {
  if (!amountString || typeof amountString !== 'string') {
    return { counter: 0, vault: 0 };
  }
  const parts = amountString.split(',');
  return {
    counter: parseInt(parts[0] || '0', 10) || 0,
    vault: parseInt(parts[1] || '0', 10) || 0
  };
};

// Helper function to format amount numbers to string "counter,vault"
const formatAmount = (counter, vault) => {
  return `${counter || 0},${vault || 0}`;
};

// Normalize ticket type data for a specific kiosk
// amount is a map: { kioskId: "counter,vault" }
export const normalizeTicketType = (ticketData, kioskId = null) => {
  if (!ticketData) return null;
  
  const normalized = { ...ticketData };
  
  // Get amount map (default to empty object)
  const amountMap = normalized.amount || {};
  
  // If kioskId is provided, extract quantities for that kiosk
  if (kioskId && amountMap[kioskId]) {
    const { counter, vault } = parseAmount(amountMap[kioskId]);
    normalized.quantity_counter = counter;
    normalized.quantity_vault = vault;
  } else {
    // Default to 0 if no kiosk specified or no amount for this kiosk
    normalized.quantity_counter = 0;
    normalized.quantity_vault = 0;
  }
  
  // Backward compatibility: if old fields exist, migrate to amount
  if (normalized.kiosk_id && (normalized.quantity_counter !== undefined || normalized.quantity_vault !== undefined)) {
    const oldKioskId = normalized.kiosk_id;
    const oldCounter = normalized.quantity_counter ?? 0;
    const oldVault = normalized.quantity_vault ?? 0;
    
    // Migrate to amount map
    if (!normalized.amount) {
      normalized.amount = {};
    }
    normalized.amount[oldKioskId] = formatAmount(oldCounter, oldVault);
    
    // If this is the requested kiosk, keep the values
    if (kioskId === oldKioskId) {
      normalized.quantity_counter = oldCounter;
      normalized.quantity_vault = oldVault;
    }
  }
  
  // Calculate total quantity (for backward compatibility)
  normalized.quantity = normalized.quantity_counter + normalized.quantity_vault;
  
  // is_opened is per kiosk, stored in amount_is_opened map
  if (kioskId && normalized.amount_is_opened) {
    normalized.is_opened = normalized.amount_is_opened[kioskId] ?? false;
  } else {
    normalized.is_opened = normalized.is_opened ?? false;
  }
  
  return normalized;
};

// Generate unique code for ticket (no kiosk_id needed anymore)
export const generateUniqueCode = async (category = 'custom') => {
  const maxAttempts = 10;
  let attempts = 0;
  
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
    
    // Check if code already exists (globally, not per kiosk)
    try {
      const ticketTypesRef = collection(db, COLLECTION_NAME);
      const codeQuery = query(ticketTypesRef, where('code', '==', code));
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

// Get all ticket types (for a specific kiosk, returns all tickets with their amounts for that kiosk)
export const getAllTicketTypes = async (kioskId = null) => {
  try {
    const ticketTypesRef = collection(db, COLLECTION_NAME);
    const querySnapshot = await getDocs(query(ticketTypesRef));
    
    return querySnapshot.docs.map(doc => normalizeTicketType({
      id: doc.id,
      ...doc.data()
    }, kioskId));
  } catch (error) {
    console.error('Error getting ticket types:', error);
    throw error;
  }
};

// Get ticket types by filter (filters apply to ticket properties, not kiosk-specific)
export const getTicketTypesByFilter = async (filters = {}, kioskId = null) => {
  try {
    const ticketTypesRef = collection(db, COLLECTION_NAME);
    let q = query(ticketTypesRef);
    
    // Apply filters (excluding kiosk_id since we don't use it anymore)
    Object.keys(filters).forEach(key => {
      if (key !== 'kiosk_id') {
        q = query(q, where(key, '==', filters[key]));
      }
    });
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => normalizeTicketType({
      id: doc.id,
      ...doc.data()
    }, kioskId || filters.kiosk_id));
  } catch (error) {
    console.error('Error filtering ticket types:', error);
    throw error;
  }
};

// Get ticket types by kiosk ID (returns all tickets with amounts for that kiosk)
export const getTicketTypesByKiosk = async (kioskId) => {
  try {
    if (!kioskId) {
      throw new Error('kioskId is required');
    }
    return await getAllTicketTypes(kioskId);
  } catch (error) {
    console.error('Error getting ticket types by kiosk:', error);
    throw error;
  }
};

// Get single ticket type by ID (for a specific kiosk)
export const getTicketTypeById = async (ticketTypeId, kioskId = null) => {
  try {
    const ticketTypeRef = doc(db, COLLECTION_NAME, ticketTypeId);
    const ticketTypeSnap = await getDoc(ticketTypeRef);
    
    if (ticketTypeSnap.exists()) {
      return normalizeTicketType({
        id: ticketTypeSnap.id,
        ...ticketTypeSnap.data()
      }, kioskId);
    }
    return null;
  } catch (error) {
    console.error('Error getting ticket type:', error);
    throw error;
  }
};

// Create new ticket type (no kiosk_id needed, but can set initial amount for a kiosk)
export const createTicketType = async (ticketTypeData) => {
  try {
    const ticketTypesRef = collection(db, COLLECTION_NAME);
    
    // Extract kiosk-specific data if provided
    const { kiosk_id, quantity_counter, quantity_vault, is_opened, ...ticketData } = ticketTypeData;
    
    // Initialize amount map
    const amount = {};
    const amount_is_opened = {};
    
    // If kiosk_id and quantities provided, add to amount map
    if (kiosk_id && (quantity_counter !== undefined || quantity_vault !== undefined)) {
      amount[kiosk_id] = formatAmount(quantity_counter || 0, quantity_vault || 0);
      amount_is_opened[kiosk_id] = is_opened ?? false;
    }
    
    const newTicketType = {
      ...ticketData,
      amount,
      amount_is_opened,
      created_date: Timestamp.now(),
      updated_date: Timestamp.now()
    };
    
    const docRef = await addDoc(ticketTypesRef, newTicketType);
    return normalizeTicketType({
      id: docRef.id,
      ...newTicketType
    }, kiosk_id);
  } catch (error) {
    console.error('Error creating ticket type:', error);
    throw error;
  }
};

// Update ticket type (can update global properties or kiosk-specific amounts)
export const updateTicketType = async (ticketTypeId, updateData, kioskId = null) => {
  try {
    const ticketTypeRef = doc(db, COLLECTION_NAME, ticketTypeId);
    
    // Get current ticket data
    const current = await getTicketTypeById(ticketTypeId);
    if (!current) {
      throw new Error('Ticket type not found');
    }
    
    // Get current amount map
    const amount = current.amount || {};
    const amount_is_opened = current.amount_is_opened || {};
    
    // Extract kiosk-specific updates
    const { quantity_counter, quantity_vault, is_opened, ...globalUpdates } = updateData;
    
    // If kioskId and quantities provided, update amount map
    if (kioskId && (quantity_counter !== undefined || quantity_vault !== undefined)) {
      const currentAmount = amount[kioskId] || '0,0';
      const { counter: currentCounter, vault: currentVault } = parseAmount(currentAmount);
      
      const newCounter = quantity_counter !== undefined ? quantity_counter : currentCounter;
      const newVault = quantity_vault !== undefined ? quantity_vault : currentVault;
      
      amount[kioskId] = formatAmount(newCounter, newVault);
      
      if (is_opened !== undefined) {
        amount_is_opened[kioskId] = is_opened;
      }
    }
    
    // Prepare update
    const cleanUpdateData = {
      ...globalUpdates,
      amount,
      amount_is_opened,
      updated_date: Timestamp.now()
    };
    
    await updateDoc(ticketTypeRef, cleanUpdateData);
    return await getTicketTypeById(ticketTypeId, kioskId);
  } catch (error) {
    console.error('Error updating ticket type:', error);
    throw error;
  }
};

// Transfer inventory from vault to counter (for a specific kiosk)
export const transferInventoryFromVaultToCounter = async (ticketTypeId, quantity, kioskId) => {
  try {
    if (!kioskId) {
      throw new Error('kioskId is required for transfer');
    }
    
    const ticketType = await getTicketTypeById(ticketTypeId, kioskId);
    if (!ticketType) {
      throw new Error('Ticket type not found');
    }
    
    const currentVault = ticketType.quantity_vault ?? 0;
    const currentCounter = ticketType.quantity_counter ?? 0;
    
    if (quantity > currentVault) {
      throw new Error(`Cannot transfer ${quantity} tickets. Only ${currentVault} available in vault.`);
    }
    
    const newVault = currentVault - quantity;
    const newCounter = currentCounter + quantity;
    
    await updateTicketType(ticketTypeId, {
      quantity_vault: newVault,
      quantity_counter: newCounter,
      is_opened: false // New tickets from vault are not opened
    }, kioskId);
    
    return await getTicketTypeById(ticketTypeId, kioskId);
  } catch (error) {
    console.error('Error transferring inventory:', error);
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
