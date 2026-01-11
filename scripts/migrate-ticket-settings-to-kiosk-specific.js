// Script to migrate min_threshold to kiosk-specific map
// Run with: npm run migrate-ticket-settings
// This script:
// 1. Deletes the old global min_threshold field
// 2. Creates new map field (min_threshold_map)
// 3. For each kiosk, migrates values for tickets that have inventory for that kiosk
// 4. Sets default value: 10 threshold
// Note: default_quantity_per_package remains global (not kiosk-specific)

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, Timestamp, deleteField } from 'firebase/firestore';
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

const DEFAULT_THRESHOLD = 10;

async function migrateTicketSettings() {
  try {
    console.log('🚀 Starting migration of ticket settings to kiosk-specific maps...\n');

    // Get all kiosks
    console.log('📋 Fetching all kiosks...');
    const kiosksRef = collection(db, 'kiosks');
    const kiosksSnapshot = await getDocs(kiosksRef);
    const kiosks = kiosksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`✅ Found ${kiosks.length} kiosks\n`);

    // Get all ticket types
    console.log('📋 Fetching all ticket types...');
    const ticketsRef = collection(db, 'ticketTypes');
    const ticketsSnapshot = await getDocs(ticketsRef);
    const tickets = ticketsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`✅ Found ${tickets.length} ticket types\n`);

    let totalUpdated = 0;
    let totalSkipped = 0;

    // Process each ticket type
    for (const ticket of tickets) {
      const ticketRef = doc(db, 'ticketTypes', ticket.id);
      const amount = ticket.amount || {};
      
      // Check if ticket has any kiosk inventory
      const hasAnyInventory = Object.keys(amount).length > 0;
      
      if (!hasAnyInventory) {
        // Ticket has no inventory, skip it
        totalSkipped++;
        continue;
      }

      // Initialize map
      const minThresholdMap = {};

      // Get old value (if it exists)
      const oldMinThreshold = ticket.min_threshold;

      // For each kiosk that has inventory for this ticket
      for (const kioskId of Object.keys(amount)) {
        // Use old value if exists, otherwise use default
        minThresholdMap[kioskId] = oldMinThreshold !== undefined && oldMinThreshold !== null 
          ? oldMinThreshold 
          : DEFAULT_THRESHOLD;
      }

      // Prepare update data - add new map and delete old field
      const updateData = {
        min_threshold_map: minThresholdMap,
        min_threshold: deleteField(), // Delete old field
        updated_date: Timestamp.now()
      };

      // Update the ticket
      await updateDoc(ticketRef, updateData);
      totalUpdated++;

      if (totalUpdated % 10 === 0) {
        console.log(`⏳ Processed ${totalUpdated} tickets...`);
        await delay(100); // Small delay to avoid rate limiting
      }
    }

    console.log(`\n✅ Migration completed!`);
    console.log(`   - Updated: ${totalUpdated} tickets`);
    console.log(`   - Skipped: ${totalSkipped} tickets (no inventory)`);
    console.log(`\n✨ Old field (min_threshold) has been deleted.`);
    console.log(`✨ New field (min_threshold_map) has been created.`);
    console.log(`✨ default_quantity_per_package remains global (unchanged).`);
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateTicketSettings()
  .then(() => {
    console.log('\n✨ Migration script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
