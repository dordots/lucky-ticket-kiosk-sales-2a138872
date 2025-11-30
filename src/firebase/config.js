// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDVDLsbvtG1UFswD1wuIPibb9SG5F4giIk",
  authDomain: "lucky-ticket-kiosk.firebaseapp.com",
  projectId: "lucky-ticket-kiosk",
  storageBucket: "lucky-ticket-kiosk.firebasestorage.app",
  messagingSenderId: "72948357796",
  appId: "1:72948357796:web:5089807a5f7e3e9c19a431",
  measurementId: "G-V5BCDRQ8JM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;

