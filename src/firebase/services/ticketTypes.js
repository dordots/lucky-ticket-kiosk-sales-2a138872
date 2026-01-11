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
  
  // Extract kiosk-specific min_threshold from map (default_quantity_per_package remains global)
  if (kioskId) {
    const minThresholdMap = normalized.min_threshold_map || {};
    
    // Get kiosk-specific min_threshold, or fallback to old global value, or default
    normalized.min_threshold = minThresholdMap[kioskId] !== undefined 
      ? minThresholdMap[kioskId] 
      : (normalized.min_threshold !== undefined ? normalized.min_threshold : 10);
  } else {
    // If no kiosk specified, use old global value or default
    normalized.min_threshold = normalized.min_threshold !== undefined 
      ? normalized.min_threshold 
      : 10;
  }
  
  // default_quantity_per_package remains global (no map needed)
  
  // is_opened field removed - no longer used
  
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
    const { 
      kiosk_id, 
      quantity_counter, 
      quantity_vault, 
      default_quantity_per_package,
      min_threshold,
      ...ticketData 
    } = ticketTypeData;
    
    // Initialize maps
    const amount = {};
    const minThresholdMap = {};
    
    // If kiosk_id and quantities provided, add to amount map
    if (kiosk_id && (quantity_counter !== undefined || quantity_vault !== undefined)) {
      amount[kiosk_id] = formatAmount(quantity_counter || 0, quantity_vault || 0);
    }
    
    // If kiosk_id and min_threshold provided, add to min_threshold map
    if (kiosk_id && min_threshold !== undefined && min_threshold !== null) {
      minThresholdMap[kiosk_id] = min_threshold;
    }
    
    const newTicketType = {
      ...ticketData,
      amount,
      created_date: Timestamp.now(),
      updated_date: Timestamp.now()
    };
    
    // Add default_quantity_per_package as global field (not in map)
    if (default_quantity_per_package !== undefined && default_quantity_per_package !== null) {
      newTicketType.default_quantity_per_package = default_quantity_per_package;
    }
    
    // Only add min_threshold_map if it has values
    if (Object.keys(minThresholdMap).length > 0) {
      newTicketType.min_threshold_map = minThresholdMap;
    }
    
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
    
    // Get current ticket data directly from Firestore (raw data) to ensure we have the latest amount map
    const ticketTypeSnap = await getDoc(ticketTypeRef);
    if (!ticketTypeSnap.exists()) {
      throw new Error('Ticket type not found');
    }
    
    const ticketData = ticketTypeSnap.data();
    
    // Get current maps from raw data
    const amount = ticketData.amount || {};
    const minThresholdMap = ticketData.min_threshold_map || {};
    
    // Extract kiosk-specific updates
    const { 
      quantity_counter, 
      quantity_vault, 
      default_quantity_per_package, 
      min_threshold,
      ...globalUpdates 
    } = updateData;
    
    // If kioskId and quantities provided, update amount map
    if (kioskId && (quantity_counter !== undefined || quantity_vault !== undefined)) {
      const currentAmount = amount[kioskId] || '0,0';
      const { counter: currentCounter, vault: currentVault } = parseAmount(currentAmount);
      
      const newCounter = quantity_counter !== undefined ? quantity_counter : currentCounter;
      const newVault = quantity_vault !== undefined ? quantity_vault : currentVault;
      
      amount[kioskId] = formatAmount(newCounter, newVault);
    }
    
    // If kioskId and min_threshold provided, update min_threshold map
    if (kioskId && min_threshold !== undefined) {
      minThresholdMap[kioskId] = min_threshold;
    }
    
    // Prepare update
    const cleanUpdateData = {
      ...globalUpdates,
      amount,
      updated_date: Timestamp.now()
    };
    
    // Add default_quantity_per_package as global field (if provided)
    if (default_quantity_per_package !== undefined) {
      cleanUpdateData.default_quantity_per_package = default_quantity_per_package;
    }
    
    // Only add min_threshold_map if it has values (to avoid creating empty maps)
    if (Object.keys(minThresholdMap).length > 0) {
      cleanUpdateData.min_threshold_map = minThresholdMap;
    }
    
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
    }, kioskId);
    
    return await getTicketTypeById(ticketTypeId, kioskId);
  } catch (error) {
    console.error('Error transferring inventory:', error);
    throw error;
  }
};

// Remove inventory for a specific kiosk (delete kiosk entry from amount map)
export const removeKioskInventory = async (ticketTypeId, kioskId) => {
  try {
    const ticketTypeRef = doc(db, COLLECTION_NAME, ticketTypeId);
    
    // Get current ticket data directly from Firestore (raw data, not normalized)
    const ticketTypeSnap = await getDoc(ticketTypeRef);
    if (!ticketTypeSnap.exists()) {
      throw new Error('Ticket type not found');
    }
    
    const ticketData = ticketTypeSnap.data();
    
    // Get current amount map from raw data
    const amount = ticketData.amount || {};
    
    // Remove kiosk entry from map using destructuring
    const { [kioskId]: removed, ...remainingAmount } = amount;
    
    // Prepare update
    const updateData = {
      amount: remainingAmount,
      updated_date: Timestamp.now()
    };
    
    await updateDoc(ticketTypeRef, updateData);
    return await getTicketTypeById(ticketTypeId, kioskId);
  } catch (error) {
    console.error('Error removing kiosk inventory:', error);
    throw error;
  }
};

// Delete ticket type (removes entire ticket from system)
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
