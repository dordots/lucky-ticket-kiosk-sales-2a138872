// Migration script to clean existing data for multi-kiosk system
// Run with: node scripts/migrate-to-multi-kiosk.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, query, Timestamp } from 'firebase/firestore';
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
    // Evaluate the config object (safe because it's from our own file)
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

async function deleteCollection(collectionName) {
  try {
    console.log(`\n🗑️  Deleting collection: ${collectionName}...`);
    const collectionRef = collection(db, collectionName);
    const querySnapshot = await getDocs(collectionRef);
    
    let deletedCount = 0;
    let skippedCount = 0;
    
    for (const docSnapshot of querySnapshot.docs) {
      // Skip system_manager users
      if (collectionName === 'users') {
        const userData = docSnapshot.data();
        if (userData.role === 'system_manager') {
          console.log(`  ⏭️  Skipping system_manager: ${userData.email || docSnapshot.id}`);
          skippedCount++;
          continue;
        }
      }
      
      await deleteDoc(doc(db, collectionName, docSnapshot.id));
      deletedCount++;
      if (deletedCount % 10 === 0) {
        console.log(`  Deleted ${deletedCount} documents...`);
        await delay(100);
      }
    }
    
    if (skippedCount > 0) {
      console.log(`  ✅ Deleted ${deletedCount} documents, skipped ${skippedCount} system_manager(s) from ${collectionName}`);
    } else {
      console.log(`  ✅ Deleted ${deletedCount} documents from ${collectionName}`);
    }
    return deletedCount;
  } catch (error) {
    console.error(`  ❌ Error deleting ${collectionName}:`, error.message);
    return 0;
  }
}

async function migrate() {
  console.log('🔄 Starting migration to multi-kiosk system...\n');
  console.log('⚠️  WARNING: This will delete ALL existing data!');
  console.log('   Collections to be deleted:');
  console.log('   - sales');
  console.log('   - ticketTypes');
  console.log('   - users (system_manager users will be preserved)');
  console.log('   - auditLogs');
  console.log('   - notifications');
  console.log('   - kiosks (if exists)\n');

  // Wait 3 seconds for user to cancel
  console.log('⏳ Starting in 3 seconds... (Press Ctrl+C to cancel)');
  await delay(3000);

  try {
    // Delete all collections
    const collections = ['sales', 'ticketTypes', 'users', 'auditLogs', 'notifications', 'kiosks'];
    
    let totalDeleted = 0;
    for (const collectionName of collections) {
      const count = await deleteCollection(collectionName);
      totalDeleted += count;
      await delay(500);
    }

    console.log(`\n✅ Migration completed!`);
    console.log(`   Total documents deleted: ${totalDeleted}`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Run: npm run seed`);
    console.log(`   2. This will create new data with multi-kiosk structure`);
    console.log(`\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate().then(() => {
  console.log('✨ Done!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

