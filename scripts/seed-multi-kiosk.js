// Script to seed Firebase with multi-kiosk data
// Run with: node scripts/seed-multi-kiosk.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, Timestamp } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
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
const auth = getAuth(app);

// Helper function to add delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function seedData() {
  console.log('🌱 Starting to seed Firebase with multi-kiosk data...\n');

  try {
    // 1. Create System Manager
    console.log('📝 Creating System Manager...');
    let systemManagerUid;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, 'admin@kiosk.com', 'admin123456');
      systemManagerUid = userCredential.user.uid;
      await setDoc(doc(db, 'users', systemManagerUid), {
        email: 'admin@kiosk.com',
        full_name: 'מנהל המערכת',
        role: 'system_manager',
        position: 'owner',
        kiosk_id: null,
        kiosk_ids: [],
        is_active: true,
        phone: '050-0000000',
        created_date: Timestamp.now()
      });
      console.log(`  ✅ Created System Manager: admin@kiosk.com / admin123456`);
      await delay(500);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`  ⚠️  System Manager already exists`);
        // Try to find existing user
        const usersRef = collection(db, 'users');
        const { getDocs } = await import('firebase/firestore');
        const querySnapshot = await getDocs(usersRef);
        const existingUser = querySnapshot.docs.find(d => d.data().email === 'admin@kiosk.com');
        if (existingUser) {
          systemManagerUid = existingUser.id;
          console.log(`  ✅ Found existing System Manager`);
        }
      } else {
        console.error(`  ❌ Error creating System Manager:`, error.message);
      }
    }

    // 2. Create Kiosks
    console.log('\n🏪 Creating kiosks...');
    const kiosks = [
      {
        name: 'קיוסק מרכז העיר',
        location: 'תל אביב, רחוב דיזנגוף 100',
        franchisee_id: null, // Will be set after creating franchisee
        is_active: true,
        settings: {},
        created_date: Timestamp.now(),
        updated_date: Timestamp.now()
      },
      {
        name: 'קיוסק חוף הים',
        location: 'תל אביב, טיילת',
        franchisee_id: null,
        is_active: true,
        settings: {},
        created_date: Timestamp.now(),
        updated_date: Timestamp.now()
      }
    ];

    const createdKiosks = [];
    for (const kiosk of kiosks) {
      try {
        const docRef = await addDoc(collection(db, 'kiosks'), kiosk);
        createdKiosks.push({ id: docRef.id, ...kiosk });
        console.log(`  ✅ Created kiosk: ${kiosk.name}`);
        await delay(300);
      } catch (error) {
        console.error(`  ❌ Error creating kiosk ${kiosk.name}:`, error.message);
      }
    }

    // 3. Create Franchisees
    console.log('\n👔 Creating franchisees...');
    const franchisees = [
      {
        email: 'franchisee1@kiosk.com',
        password: 'franchisee123456',
        full_name: 'זכיין 1',
        kiosk_id: createdKiosks[0]?.id,
        kiosk_ids: createdKiosks[0]?.id ? [createdKiosks[0].id] : []
      },
      {
        email: 'franchisee2@kiosk.com',
        password: 'franchisee123456',
        full_name: 'זכיין 2',
        kiosk_id: createdKiosks[1]?.id,
        kiosk_ids: createdKiosks[1]?.id ? [createdKiosks[1].id] : []
      }
    ];

    const createdFranchisees = [];
    for (const franchisee of franchisees) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, franchisee.email, franchisee.password);
        const uid = userCredential.user.uid;
        
        await setDoc(doc(db, 'users', uid), {
          email: franchisee.email,
          full_name: franchisee.full_name,
          role: 'franchisee',
          position: 'owner',
          kiosk_id: franchisee.kiosk_id,
          kiosk_ids: franchisee.kiosk_ids,
          is_active: true,
          phone: '050-1111111',
          created_date: Timestamp.now()
        });

        // Update kiosk with franchisee_id
        if (franchisee.kiosk_id) {
          const kioskIndex = createdKiosks.findIndex(k => k.id === franchisee.kiosk_id);
          if (kioskIndex !== -1) {
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'kiosks', franchisee.kiosk_id), {
              franchisee_id: uid
            });
          }
        }

        createdFranchisees.push({ uid, ...franchisee });
        console.log(`  ✅ Created franchisee: ${franchisee.full_name} (${franchisee.email})`);
        console.log(`     Password: ${franchisee.password}`);
        await delay(500);
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`  ⚠️  Franchisee ${franchisee.email} already exists`);
        } else {
          console.error(`  ❌ Error creating franchisee ${franchisee.email}:`, error.message);
        }
      }
    }

    // 4. Create Assistants
    console.log('\n👤 Creating assistants...');
    const assistants = [
      {
        email: 'assistant1@kiosk.com',
        password: 'assistant123456',
        full_name: 'עוזר 1',
        kiosk_id: createdKiosks[0]?.id
      },
      {
        email: 'assistant2@kiosk.com',
        password: 'assistant123456',
        full_name: 'עוזר 2',
        kiosk_id: createdKiosks[0]?.id
      },
      {
        email: 'assistant3@kiosk.com',
        password: 'assistant123456',
        full_name: 'עוזר 3',
        kiosk_id: createdKiosks[1]?.id
      }
    ];

    const createdAssistants = [];
    for (const assistant of assistants) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, assistant.email, assistant.password);
        const uid = userCredential.user.uid;
        
        await setDoc(doc(db, 'users', uid), {
          email: assistant.email,
          full_name: assistant.full_name,
          role: 'assistant',
          position: 'seller',
          kiosk_id: assistant.kiosk_id,
          kiosk_ids: [],
          is_active: true,
          phone: '050-2222222',
          created_date: Timestamp.now()
        });

        createdAssistants.push({ uid, ...assistant });
        console.log(`  ✅ Created assistant: ${assistant.full_name} (${assistant.email})`);
        console.log(`     Password: ${assistant.password}`);
        await delay(500);
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`  ⚠️  Assistant ${assistant.email} already exists`);
        } else {
          console.error(`  ❌ Error creating assistant ${assistant.email}:`, error.message);
        }
      }
    }

    // 5. Create Ticket Types for each kiosk
    console.log('\n🎫 Creating ticket types for kiosks...');
    const ticketTypes = [
      { name: 'כרטיס רגיל', code: 'REGULAR', price: 50, quantity: 100, min_threshold: 20, color: 'blue' },
      { name: 'כרטיס VIP', code: 'VIP', price: 100, quantity: 50, min_threshold: 10, color: 'purple' },
      { name: 'כרטיס ילדים', code: 'KIDS', price: 30, quantity: 200, min_threshold: 30, color: 'green' },
      { name: 'כרטיס משפחתי', code: 'FAMILY', price: 150, quantity: 75, min_threshold: 15, color: 'orange' },
      { name: 'כרטיס זהב', code: 'GOLD', price: 200, quantity: 25, min_threshold: 5, color: 'yellow' }
    ];

    for (const kiosk of createdKiosks) {
      console.log(`  Creating tickets for ${kiosk.name}...`);
      for (const ticketType of ticketTypes) {
        try {
          await addDoc(collection(db, 'ticketTypes'), {
            ...ticketType,
            kiosk_id: kiosk.id,
            is_active: true,
            ticket_category: 'custom',
            created_date: Timestamp.now(),
            updated_date: Timestamp.now()
          });
          console.log(`    ✅ Created: ${ticketType.name}`);
          await delay(200);
        } catch (error) {
          console.error(`    ❌ Error creating ticket ${ticketType.name}:`, error.message);
        }
      }
    }

    // 6. Create sample sales
    console.log('\n💰 Creating sample sales...');
    if (createdAssistants.length > 0 && createdKiosks.length > 0) {
      const sampleSales = [
        {
          kiosk_id: createdKiosks[0].id,
          user_id: createdAssistants[0].uid,
          items: [
            { ticket_name: 'כרטיס רגיל', quantity: 2, unit_price: 50, total: 100 }
          ],
          total_amount: 100,
          payment_method: 'cash',
          status: 'completed',
          notes: 'מכירה לדוגמה',
          created_date: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
          updated_date: Timestamp.now()
        },
        {
          kiosk_id: createdKiosks[0].id,
          user_id: createdAssistants[1].uid,
          items: [
            { ticket_name: 'כרטיס VIP', quantity: 1, unit_price: 100, total: 100 },
            { ticket_name: 'כרטיס ילדים', quantity: 3, unit_price: 30, total: 90 }
          ],
          total_amount: 190,
          payment_method: 'card',
          status: 'completed',
          notes: 'מכירה משולבת',
          created_date: Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),
          updated_date: Timestamp.now()
        },
        {
          kiosk_id: createdKiosks[1].id,
          user_id: createdAssistants[2].uid,
          items: [
            { ticket_name: 'כרטיס משפחתי', quantity: 1, unit_price: 150, total: 150 }
          ],
          total_amount: 150,
          payment_method: 'cash',
          status: 'completed',
          notes: 'מכירה בקיוסק חוף הים',
          created_date: Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),
          updated_date: Timestamp.now()
        }
      ];

      for (const sale of sampleSales) {
        try {
          await addDoc(collection(db, 'sales'), sale);
          console.log(`  ✅ Created sale: ${sale.total_amount}₪`);
          await delay(300);
        } catch (error) {
          console.error(`  ❌ Error creating sale:`, error.message);
        }
      }
    }

    console.log('\n✨ Seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Kiosks created: ${createdKiosks.length}`);
    console.log(`  - Franchisees created: ${createdFranchisees.length}`);
    console.log(`  - Assistants created: ${createdAssistants.length}`);
    console.log(`  - Ticket types created: ${ticketTypes.length * createdKiosks.length}`);
    
    console.log('\n🔑 Login credentials:');
    console.log(`  System Manager: admin@kiosk.com / admin123456`);
    createdFranchisees.forEach(f => {
      console.log(`  Franchisee: ${f.email} / ${f.password}`);
    });
    createdAssistants.forEach(a => {
      console.log(`  Assistant: ${a.email} / ${a.password}`);
    });
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error seeding data:', error);
    process.exit(1);
  }
}

// Run the seed function
seedData().then(() => {
  console.log('✅ Done!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

