// Script to delete all ticket types from Firebase
// Run with: npm run delete-all-tickets
// WARNING: This will delete ALL tickets from the database!

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read Firebase config from the config file
let firebaseConfig;
try {
  const configPath = join(__dirname, '../src/firebase/config.js');
  const configContent = readFileSync(configPath, 'utf-8');
  
  // Extract the config object using regex
  const configMatch = configContent.match(/const firebaseConfig = ({[\s\S]*?});/);
  if (configMatch) {
    firebaseConfig = eval(`(${configMatch[1]})`);
  } else {
    throw new Error('Could not find firebaseConfig in config file');
  }
  
  // Check if config is still using placeholder values
  if (firebaseConfig.apiKey === "YOUR_API_KEY" || firebaseConfig.apiKey.includes("YOUR_")) {
    console.error('❌ Error: Please update src/firebase/config.js with your Firebase credentials first!');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error reading Firebase config:', error.message);
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper function to add delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function deleteAllTickets() {
  console.log('🗑️  Starting to delete all ticket types...\n');
  console.log('⚠️  WARNING: This will delete ALL tickets from the database!\n');

  try {
    const ticketTypesRef = collection(db, 'ticketTypes');
    const snapshot = await getDocs(ticketTypesRef);
    
    const totalTickets = snapshot.size;
    console.log(`📦 Found ${totalTickets} ticket(s) to delete.\n`);

    if (totalTickets === 0) {
      console.log('✅ No tickets to delete.');
      return;
    }

    let deleted = 0;
    let errors = 0;

    for (const ticketDoc of snapshot.docs) {
      try {
        await deleteDoc(doc(db, 'ticketTypes', ticketDoc.id));
        deleted++;
        console.log(`  ✅ Deleted: ${ticketDoc.data().name || ticketDoc.id}`);
        await delay(100); // Small delay to avoid rate limiting
      } catch (error) {
        errors++;
        console.error(`  ❌ Error deleting ${ticketDoc.id}:`, error.message);
      }
    }

    console.log('\n✨ Deletion completed!\n');
    console.log('📊 Summary:');
    console.log(`  - Total tickets: ${totalTickets}`);
    console.log(`  - Deleted: ${deleted}`);
    console.log(`  - Errors: ${errors}`);

  } catch (error) {
    console.error('\n❌ Error deleting tickets:', error);
    process.exit(1);
  }
}

// Run the delete function
deleteAllTickets().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

