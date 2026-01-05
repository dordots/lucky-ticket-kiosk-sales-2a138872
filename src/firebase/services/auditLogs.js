import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  orderBy,
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config';

const COLLECTION_NAME = 'auditLogs';

// Get all audit logs
export const getAllAuditLogs = async (orderByField = 'created_date', limitCount = 100) => {
  try {
    const auditLogsRef = collection(db, COLLECTION_NAME);
    const orderDirection = orderByField.startsWith('-') ? 'desc' : 'asc';
    const fieldName = orderByField.startsWith('-') ? orderByField.substring(1) : orderByField;
    
    let q = query(auditLogsRef, orderBy(fieldName, orderDirection));
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
    console.error('Error getting audit logs:', error);
    throw error;
  }
};

// Get audit logs by filter
export const getAuditLogsByFilter = async (filters = {}) => {
  try {
    const auditLogsRef = collection(db, COLLECTION_NAME);
    let q = query(auditLogsRef);
    
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
    console.error('Error filtering audit logs:', error);
    throw error;
  }
};

// Create new audit log
export const createAuditLog = async (auditLogData) => {
  try {
    // Get current user to determine kiosk_id if not provided
    let kioskId = auditLogData.kiosk_id;
    let actorId = auditLogData.actor_id;
    let actorName = auditLogData.actor_name;
    
    if (!kioskId || !actorId || !actorName) {
      const { getCurrentUser } = await import('./auth');
      const currentUser = await getCurrentUser();
      if (currentUser) {
        if (!kioskId) {
          kioskId = currentUser.kiosk_id;
        }
        if (!actorId) {
          actorId = auditLogData.user_id || currentUser.id || currentUser.uid;
        }
        if (!actorName) {
          actorName = auditLogData.user_name || currentUser.full_name || currentUser.email;
        }
      }
    }
    
    // Support legacy user_id/user_name fields - convert to actor_id/actor_name
    if (!actorId && auditLogData.user_id) {
      actorId = auditLogData.user_id;
    }
    if (!actorName && auditLogData.user_name) {
      actorName = auditLogData.user_name;
    }
    
    const auditLogsRef = collection(db, COLLECTION_NAME);
    const newAuditLog = {
      ...auditLogData,
      // Always use actor_id and actor_name (convert from user_id/user_name if needed)
      actor_id: actorId,
      actor_name: actorName,
      kiosk_id: kioskId, // Always include kiosk_id
      created_date: Timestamp.now()
    };
    
    // Remove legacy fields if they exist
    delete newAuditLog.user_id;
    delete newAuditLog.user_name;
    
    const docRef = await addDoc(auditLogsRef, newAuditLog);
    return {
      id: docRef.id,
      ...newAuditLog,
      created_date: newAuditLog.created_date.toDate().toISOString()
    };
  } catch (error) {
    console.error('Error creating audit log:', error);
    throw error;
  }
};

