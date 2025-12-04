// Script to seed Firebase with Pais (מפעל הפיס) ticket types
// Run with: npm run seed-pais

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
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
    console.error('   Go to Firebase Console > Project Settings > General > Your apps');
    console.error('   Copy the config values and update the file.\n');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error reading Firebase config:', error.message);
  console.error('   Make sure src/firebase/config.js exists and has valid Firebase credentials.\n');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper function to add delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to generate unique code
const generateCode = () => {
  return 'PAIS-' + Math.random().toString(36).substring(2, 10).toUpperCase();
};

// Pais ticket types extracted from the website
const paisTickets = [
  // 5-15 ₪ category
  { name: 'אבא גנוב', cardId: '97', price: 10, category: '5-15', image: '/download/hishgadTickets/97_0_1.jpg' },
  { name: 'ישראל שלי', cardId: '95', price: 10, category: '5-15', image: '/download/hishgadTickets/95_43_6.jpg' },
  { name: 'חגיגה בסנוקר', cardId: '94', price: 10, category: '5-15', image: '/download/hishgadTickets/94_53_4.jpg' },
  { name: 'יהיה טוב', cardId: '93', price: 10, category: '5-15', image: '/download/hishgadTickets/93_29_24.png' },
  { name: 'הדגל שלנו', cardId: '90', price: 10, category: '5-15', image: '/download/hishgadTickets/90_20_6.jpg' },
  { name: 'מעומק הלב', cardId: '88', price: 10, category: '5-15', image: '/download/hishgadTickets/88_58_4.png' },
  { name: 'כפרה', cardId: '86', price: 10, category: '5-15', image: '/download/hishgadTickets/86_42_18.jpg' },
  { name: 'HONEY', cardId: '83', price: 10, category: '5-15', image: '/download/hishgadTickets/83_21_54.jpg' },
  { name: 'מילה טובה', cardId: '81', price: 10, category: '5-15', image: '/download/hishgadTickets/81_27_50.jpg' },
  { name: 'פורים רייב', cardId: '71', price: 10, category: '5-15', image: '/download/hishgadTickets/71_38_45.jpg' },
  { name: 'סחתיין', cardId: '70', price: 10, category: '5-15', image: '/download/hishgadTickets/70_23_31.jpg' },
  { name: 'הכל דבש', cardId: '67', price: 10, category: '5-15', image: '/download/hishgadTickets/67_39_15.jpg' },
  { name: 'מזל גדול', cardId: '3', price: 10, category: '5-15', image: '/download/hishgadTickets/3_47_34.jpg' },
  { name: 'דיבידנד', cardId: '7', price: 10, category: '5-15', image: '/download/hishgadTickets/7_34_56.png' },
  { name: 'בורסה', cardId: '8', price: 10, category: '5-15', image: '/download/hishgadTickets/8_2_57.jpg' },
  { name: 'מזלות', cardId: '9', price: 10, category: '5-15', image: '/download/hishgadTickets/9_47_38.jpg' },
  { name: 'כדורסל', cardId: '10', price: 10, category: '5-15', image: '/download/hishgadTickets/10_6_54.jpg' },
  { name: 'נס חנוכה', cardId: '12', price: 10, category: '5-15', image: '/download/hishgadTickets/12_32_17.jpg' },
  { name: 'קזינו', cardId: '20', price: 10, category: '5-15', image: '/download/hishgadTickets/20_5_27.jpg' },
  { name: 'סוס מנצח', cardId: '21', price: 10, category: '5-15', image: '/download/hishgadTickets/21_9_28.jpg' },
  
  // 20-30 ₪ category
  { name: 'קריפטו', cardId: '91', price: 25, category: '20-30', image: '/download/hishgadTickets/91_0_24.jpg' },
  { name: 'Money Time', cardId: '31', price: 25, category: '20-30', image: '/download/hishgadTickets/31_32_20.jpg' },
  { name: 'ביוטי', cardId: '89', price: 25, category: '20-30', image: '/download/hishgadTickets/89_1_8.jpg' },
  { name: 'קולולו', cardId: '87', price: 25, category: '20-30', image: '/download/hishgadTickets/87_14_51.jpg' },
  { name: 'עיניים שלי', cardId: '78', price: 25, category: '20-30', image: '/download/hishgadTickets/78_5_16.jpg' },
  { name: 'STORY', cardId: '77', price: 25, category: '20-30', image: '/download/hishgadTickets/77_33_56.jpg' },
  { name: 'מזל טוב', cardId: '22', price: 25, category: '20-30', image: '/download/hishgadTickets/22_0_22.jpg' },
  { name: '21 BlackJack', cardId: '23', price: 25, category: '20-30', image: '/download/hishgadTickets/23_31_2.jpg' },
  { name: 'אואזיס', cardId: '24', price: 25, category: '20-30', image: '/download/hishgadTickets/24_12_23.jpg' },
  { name: 'cash', cardId: '25', price: 25, category: '20-30', image: '/download/hishgadTickets/25_25_10.jpg' },
  { name: 'שיקגו', cardId: '26', price: 25, category: '20-30', image: '/download/hishgadTickets/26_23_44.jpg' },
  { name: 'חג שמח', cardId: '27', price: 25, category: '20-30', image: '/download/hishgadTickets/27_31_22.jpg' },
  { name: 'אס זוכה קינג בוכה', cardId: '28', price: 25, category: '20-30', image: '/download/hishgadTickets/28_37_43.jpg' },
  { name: 'הקלף', cardId: '29', price: 25, category: '20-30', image: '/download/hishgadTickets/29_53_35.jpg' },
  { name: 'מונטה קרלו', cardId: '39', price: 25, category: '20-30', image: '/download/hishgadTickets/39_3_47.jpg' },
  { name: 'כספת', cardId: '38', price: 25, category: '20-30', image: '/download/hishgadTickets/38_22_55.jpg' },
  
  // 40+ ₪ category
  { name: 'הקלף הסודי', cardId: '96', price: 50, category: '40+', image: '/download/hishgadTickets/96_23_9.jpg' },
  { name: 'No.1', cardId: '92', price: 50, category: '40+', image: '/download/hishgadTickets/92_22_38.jpg' },
  { name: 'הכל זהב', cardId: '79', price: 50, category: '40+', image: '/download/hishgadTickets/79_28_35.jpg' },
  { name: 'מכונת המזל', cardId: '41', price: 50, category: '40+', image: '/download/hishgadTickets/41_41_27.jpg' },
  { name: 'מלכת הלבבות', cardId: '42', price: 50, category: '40+', image: '/download/hishgadTickets/42_26_49.jpg' },
  { name: 'רולטה', cardId: '43', price: 50, category: '40+', image: '/download/hishgadTickets/43_46_52.jpg' },
  { name: 'אס=פרס', cardId: '44', price: 50, category: '40+', image: '/download/hishgadTickets/44_55_45.jpg' },
  { name: 'שווה זהב', cardId: '45', price: 50, category: '40+', image: '/download/hishgadTickets/45_6_47.jpg' },
  { name: 'BIG', cardId: '48', price: 50, category: '40+', image: '/download/hishgadTickets/48_49_2.jpg' },
  { name: 'מגה כסף', cardId: '51', price: 50, category: '40+', image: '/download/hishgadTickets/51_33_44.jpg' },
];

async function seedPaisTickets() {
  console.log('🌱 Starting to seed Pais (מפעל הפיס) tickets...\n');

  try {
    // Check if tickets already exist
    const existingTicketsRef = collection(db, 'ticketTypes');
    const existingQuery = query(existingTicketsRef, where('ticket_category', '==', 'pais'));
    const existingSnapshot = await getDocs(existingQuery);
    
    if (existingSnapshot.size > 0) {
      console.log(`⚠️  Found ${existingSnapshot.size} existing Pais tickets.`);
      console.log('   Will skip duplicates by name.\n');
    }

    const createdTickets = [];
    const skippedTickets = [];
    const errors = [];

    for (const ticket of paisTickets) {
      try {
        // Check if ticket with same name already exists
        const nameQuery = query(existingTicketsRef, where('name', '==', ticket.name));
        const nameSnapshot = await getDocs(nameQuery);
        
        if (nameSnapshot.size > 0) {
          skippedTickets.push(ticket.name);
          console.log(`  ⏭️  Skipped (already exists): ${ticket.name}`);
          continue;
        }

        // Build image URL (assuming it's relative to pais.co.il)
        const imageUrl = ticket.image.startsWith('http') 
          ? ticket.image 
          : `https://www.pais.co.il${ticket.image}`;

        // Create ticket type
        const ticketData = {
          name: ticket.name,
          code: generateCode(),
          price: ticket.price,
          quantity: 0, // Not in stock initially
          min_threshold: 10,
          color: 'blue', // Default color
          image_url: imageUrl,
          ticket_category: 'pais', // Mark as Pais ticket
          pais_card_id: ticket.cardId, // Store original card ID for reference
          is_active: true, // Active but not in stock
          created_date: Timestamp.now(),
          updated_date: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, 'ticketTypes'), ticketData);
        createdTickets.push({ id: docRef.id, name: ticket.name });
        console.log(`  ✅ Created: ${ticket.name} (${ticket.price}₪)`);
        
        await delay(200); // Small delay to avoid rate limiting
      } catch (error) {
        errors.push({ name: ticket.name, error: error.message });
        console.error(`  ❌ Error creating ${ticket.name}:`, error.message);
      }
    }

    console.log('\n✨ Seeding completed!\n');
    console.log('📊 Summary:');
    console.log(`  - Tickets created: ${createdTickets.length}`);
    console.log(`  - Tickets skipped: ${skippedTickets.length}`);
    console.log(`  - Errors: ${errors.length}`);
    
    if (skippedTickets.length > 0) {
      console.log('\n⏭️  Skipped tickets (already exist):');
      skippedTickets.forEach(name => console.log(`    - ${name}`));
    }
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(({ name, error }) => console.log(`    - ${name}: ${error}`));
    }

    console.log('\n📝 Note: All tickets were created with:');
    console.log('   - ticket_category: "pais"');
    console.log('   - quantity: 0 (not in stock)');
    console.log('   - is_active: true (available for selection)');
    console.log('   - Prices are estimated based on category ranges');

  } catch (error) {
    console.error('\n❌ Error seeding Pais tickets:', error);
    process.exit(1);
  }
}

// Run the seed function
seedPaisTickets().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
