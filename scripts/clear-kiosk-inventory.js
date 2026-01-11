// Script to clear all inventory for a selected kiosk
// Run with: npm run clear-kiosk-inventory
// WARNING: This will delete ALL inventory for the selected kiosk!

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

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

// Helper function to get user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function clearKioskInventory() {
  console.log('🗑️  Starting to delete kiosk inventory data...\n');
  console.log('⚠️  WARNING: This will DELETE the kiosk from all ticket types!\n');

  try {
    // Get all kiosks
    const kiosksRef = collection(db, 'kiosks');
    const kiosksSnapshot = await getDocs(kiosksRef);
    
    const kiosks = kiosksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (kiosks.length === 0) {
      console.log('❌ No kiosks found in the database.');
      rl.close();
      process.exit(0);
    }

    // Display all kiosks
    console.log('📦 Available kiosks:\n');
    kiosks.forEach((kiosk, index) => {
      console.log(`  ${index + 1}. ${kiosk.name || 'Unnamed Kiosk'} (ID: ${kiosk.id})`);
      if (kiosk.location) {
        console.log(`     Location: ${kiosk.location}`);
      }
      console.log('');
    });

    // Get user selection
    const answer = await question(`Select a kiosk (1-${kiosks.length}) or 'q' to quit: `);
    
    if (answer.toLowerCase() === 'q') {
      console.log('\n✅ Operation cancelled.');
      rl.close();
      process.exit(0);
    }

    const selectedIndex = parseInt(answer) - 1;
    
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= kiosks.length) {
      console.log('\n❌ Invalid selection.');
      rl.close();
      process.exit(1);
    }

    const selectedKiosk = kiosks[selectedIndex];
    console.log(`\n📦 Selected kiosk: ${selectedKiosk.name || 'Unnamed Kiosk'} (${selectedKiosk.id})\n`);

    // Confirm deletion
    const confirm = await question('⚠️  Are you sure you want to DELETE this kiosk from all ticket types? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes') {
      console.log('\n✅ Operation cancelled.');
      rl.close();
      process.exit(0);
    }

    // Get all ticket types
    const ticketTypesRef = collection(db, 'ticketTypes');
    const ticketTypesSnapshot = await getDocs(ticketTypesRef);
    
    const ticketTypes = ticketTypesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`\n🔄 Processing ${ticketTypes.length} ticket type(s)...\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const ticketType of ticketTypes) {
      try {
        const amount = ticketType.amount || {};
        const amount_is_opened = ticketType.amount_is_opened || {};
        
        // Check if this kiosk exists in the maps
        const hasKioskData = amount.hasOwnProperty(selectedKiosk.id) || amount_is_opened.hasOwnProperty(selectedKiosk.id);
        
        if (!hasKioskData) {
          skipped++;
          continue;
        }

        // Create new maps without the selected kiosk
        const newAmount = { ...amount };
        const newAmountIsOpened = { ...amount_is_opened };
        
        // Delete the kiosk from both maps
        delete newAmount[selectedKiosk.id];
        delete newAmountIsOpened[selectedKiosk.id];

        // Update the ticket type
        const ticketTypeRef = doc(db, 'ticketTypes', ticketType.id);
        await updateDoc(ticketTypeRef, {
          amount: newAmount,
          amount_is_opened: newAmountIsOpened,
          updated_date: Timestamp.now()
        });

        updated++;
        console.log(`  ✅ Deleted kiosk data for: ${ticketType.name || ticketType.id}`);
        await delay(100); // Small delay to avoid rate limiting
      } catch (error) {
        errors++;
        console.error(`  ❌ Error deleting ${ticketType.name || ticketType.id}:`, error.message);
      }
    }

    console.log('\n✨ Operation completed!\n');
    console.log('📊 Summary:');
    console.log(`  - Kiosk: ${selectedKiosk.name || 'Unnamed Kiosk'} (${selectedKiosk.id})`);
    console.log(`  - Total ticket types: ${ticketTypes.length}`);
    console.log(`  - Updated (kiosk deleted): ${updated}`);
    console.log(`  - Skipped (kiosk not found): ${skipped}`);
    console.log(`  - Errors: ${errors}`);

    rl.close();
  } catch (error) {
    console.error('\n❌ Error clearing inventory:', error);
    rl.close();
    process.exit(1);
  }
}

// Run the function
clearKioskInventory().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  rl.close();
  process.exit(1);
});
