import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getAuth,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, Timestamp } from 'firebase/firestore';
import { auth, db } from '../config';

// Get current user from Firebase Authentication
export const getCurrentUser = async () => {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        return {
          id: userDoc.id,
          uid: currentUser.uid,
          email: currentUser.email,
          ...userDoc.data()
        };
      }
      // If user exists in Auth but not in Firestore, return basic info
      return {
        id: currentUser.uid,
        uid: currentUser.uid,
        email: currentUser.email
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Get all users for user switching
export const getAllUsers = async () => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
};

// Set current user (store in localStorage)
export const setCurrentUser = (userId) => {
  localStorage.setItem('currentUserId', userId);
};

// Sign in with email and password
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Store user ID in localStorage for compatibility
    localStorage.setItem('currentUserId', userCredential.user.uid);
    return await getCurrentUser();
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

// Create new user (for admin)
// Uses Firebase REST API to create user without automatically signing in
export const createUser = async (email, password, userData) => {
  // Store current user info before creating new user
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('לא מחובר - נא להתחבר לפני יצירת משתמש');
  }
  
  // Get the current user's ID token for authentication
  const idToken = await currentUser.getIdToken();
  
  // Get Firebase config from the app
  const { getApp } = await import('firebase/app');
  const app = getApp();
  const apiKey = app.options.apiKey;
  
  try {
    // Use Firebase REST API to create user without signing in
    // This requires the Identity Toolkit API
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password,
          returnSecureToken: false, // Don't return token, so we don't sign in
        }),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'שגיאה ביצירת משתמש');
    }
    
    const result = await response.json();
    const uid = result.localId; // Firebase returns localId instead of uid in REST API
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', uid), {
      email,
      full_name: userData.full_name || '',
      position: userData.position || 'seller',
      phone: userData.phone || '',
      is_active: userData.is_active !== false,
      created_date: Timestamp.now()
    });
    
    // Note: We didn't sign in as the new user, so the admin stays logged in!
    
    return {
      id: uid,
      uid,
      email,
      ...userData
    };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Change password
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('לא מחובר');
    }
    
    // Re-authenticate user
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    
    // Update password
    await updatePassword(user, newPassword);
    
    return true;
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    // Clear localStorage
    localStorage.removeItem('currentUserId');
    
    // Sign out from Firebase
    await signOut(auth);
    
    return true;
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Reset password (for admin)
// Uses Firebase REST API to reset password
export const resetUserPassword = async (email) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('לא מחובר - נא להתחבר לפני איפוס סיסמה');
  }
  
  // Get the current user's ID token for authentication
  const idToken = await currentUser.getIdToken();
  
  // Get Firebase config from the app
  const { getApp } = await import('firebase/app');
  const app = getApp();
  const apiKey = app.options.apiKey;
  
  try {
    // Use Firebase REST API to send password reset email
    // This requires the Identity Toolkit API
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email: email,
        }),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'שגיאה באיפוס סיסמה');
    }
    
    return true;
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
};

// Get auth instance
export const getAuthInstance = () => {
  return getAuth();
};

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;
    
    // Store user ID in localStorage for compatibility
    localStorage.setItem('currentUserId', user.uid);
    
    // Check if user exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      // Create user document in Firestore if it doesn't exist (first time login)
      const displayName = user.displayName || '';
      const nameParts = displayName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        full_name: displayName || user.email?.split('@')[0] || 'משתמש',
        position: 'seller', // Default to seller, can be changed by owner
        phone: user.phoneNumber || '',
        is_active: true,
        created_date: Timestamp.now(),
        auth_provider: 'google' // Track that user signed in with Google
      });
    }
    
    return await getCurrentUser();
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

