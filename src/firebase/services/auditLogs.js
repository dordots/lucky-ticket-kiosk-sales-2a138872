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
    const auditLogsRef = collection(db, COLLECTION_NAME);
    const newAuditLog = {
      ...auditLogData,
      created_date: Timestamp.now()
    };
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

