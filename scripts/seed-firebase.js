// Script to seed Firebase with initial data
// Run with: npm run seed

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, getDocs, Timestamp } from 'firebase/firestore';
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
const auth = getAuth(app);

// Helper function to add delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function seedData() {
  console.log('🌱 Starting to seed Firebase...\n');

  try {
    // 1. Create users in Firebase Authentication and Firestore
    console.log('📝 Creating users in Firebase Authentication and Firestore...');
    const users = [
      {
        email: 'owner@example.com',
        password: 'owner123456',
        userData: {
          full_name: 'בעל העסק',
          position: 'owner',
          is_active: true,
          phone: '050-1234567',
          created_date: Timestamp.now()
        }
      },
      {
        email: 'seller@example.com',
        password: 'seller123456',
        userData: {
          full_name: 'מוכר',
          position: 'seller',
          is_active: true,
          phone: '050-3456789',
          created_date: Timestamp.now()
        }
      }
    ];

    const createdUsers = [];
    for (const user of users) {
      try {
        // Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
        const uid = userCredential.user.uid;
        
        // Create user document in Firestore with the UID from Authentication
        await setDoc(doc(db, 'users', uid), {
          ...user.userData,
          email: user.email
        });
        
        createdUsers.push({ uid, email: user.email, ...user.userData });
        console.log(`  ✅ Created user: ${user.userData.full_name} (${user.email})`);
        console.log(`     Password: ${user.password}`);
        await delay(500);
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`  ⚠️  User ${user.email} already exists in Authentication, skipping...`);
          // Try to get existing user and update Firestore
          try {
            const usersRef = collection(db, 'users');
            const querySnapshot = await getDocs(usersRef);
            const existingUser = querySnapshot.docs.find(d => d.data().email === user.email);
            if (existingUser) {
              console.log(`  ✅ User document already exists in Firestore`);
            } else {
              // User exists in Auth but not in Firestore - need to find UID
              console.log(`  ⚠️  User exists in Auth but not in Firestore. Please create manually.`);
            }
          } catch (e) {
            console.log(`  ⚠️  Could not check Firestore for user ${user.email}`);
          }
        } else {
          console.error(`  ❌ Error creating user ${user.email}:`, error.message);
        }
      }
    }

    // 2. Create ticket types
    console.log('\n🎫 Creating ticket types...');
    const ticketTypes = [
      {
        name: 'כרטיס רגיל',
        code: 'REGULAR',
        price: 50,
        quantity: 100,
        min_threshold: 20,
        color: 'blue',
        is_active: true,
        created_date: Timestamp.now(),
        updated_date: Timestamp.now()
      },
      {
        name: 'כרטיס VIP',
        code: 'VIP',
        price: 100,
        quantity: 50,
        min_threshold: 10,
        color: 'purple',
        is_active: true,
        created_date: Timestamp.now(),
        updated_date: Timestamp.now()
      },
      {
        name: 'כרטיס ילדים',
        code: 'KIDS',
        price: 30,
        quantity: 200,
        min_threshold: 30,
        color: 'green',
        is_active: true,
        created_date: Timestamp.now(),
        updated_date: Timestamp.now()
      },
      {
        name: 'כרטיס משפחתי',
        code: 'FAMILY',
        price: 150,
        quantity: 75,
        min_threshold: 15,
        color: 'orange',
        is_active: true,
        created_date: Timestamp.now(),
        updated_date: Timestamp.now()
      },
      {
        name: 'כרטיס זהב',
        code: 'GOLD',
        price: 200,
        quantity: 25,
        min_threshold: 5,
        color: 'yellow',
        is_active: true,
        created_date: Timestamp.now(),
        updated_date: Timestamp.now()
      }
    ];

    const createdTicketTypes = [];
    for (const ticketType of ticketTypes) {
      try {
        const docRef = await addDoc(collection(db, 'ticketTypes'), ticketType);
        createdTicketTypes.push({ id: docRef.id, ...ticketType });
        console.log(`  ✅ Created ticket type: ${ticketType.name}`);
        await delay(300);
      } catch (error) {
        console.error(`  ❌ Error creating ticket type ${ticketType.name}:`, error.message);
      }
    }

    // 3. Create sample sales (optional)
    console.log('\n💰 Creating sample sales...');
    if (createdUsers.length > 0 && createdTicketTypes.length > 0) {
      const owner = createdUsers.find(u => u.position === 'owner');
      const sampleSales = [
        {
          seller_id: owner?.uid || createdUsers[0].uid,
          seller_name: owner?.full_name || 'בעל העסק',
          items: [
            {
              ticket_type_id: createdTicketTypes[0].id,
              ticket_name: createdTicketTypes[0].name,
              quantity: 2,
              unit_price: createdTicketTypes[0].price,
              total: createdTicketTypes[0].price * 2
            }
          ],
          total_amount: createdTicketTypes[0].price * 2,
          payment_method: 'cash',
          status: 'completed',
          notes: 'מכירה לדוגמה',
          created_date: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)), // 2 days ago
          updated_date: Timestamp.now()
        },
        {
          seller_id: owner?.uid || createdUsers[0].uid,
          seller_name: owner?.full_name || 'בעל העסק',
          items: [
            {
              ticket_type_id: createdTicketTypes[1].id,
              ticket_name: createdTicketTypes[1].name,
              quantity: 1,
              unit_price: createdTicketTypes[1].price,
              total: createdTicketTypes[1].price
            },
            {
              ticket_type_id: createdTicketTypes[2].id,
              ticket_name: createdTicketTypes[2].name,
              quantity: 3,
              unit_price: createdTicketTypes[2].price,
              total: createdTicketTypes[2].price * 3
            }
          ],
          total_amount: createdTicketTypes[1].price + (createdTicketTypes[2].price * 3),
          payment_method: 'card',
          status: 'completed',
          notes: 'מכירה משולבת',
          created_date: Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)), // 1 day ago
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

    // 4. Create audit logs
    console.log('\n📋 Creating audit logs...');
    if (createdUsers.length > 0) {
      const owner = createdUsers.find(u => u.position === 'owner');
      const auditLogs = [
        {
          action: 'create_ticket_type',
          actor_id: owner?.uid || createdUsers[0].uid,
          actor_name: owner?.full_name || 'בעל העסק',
          target_type: 'TicketType',
          details: { message: 'נוצרו סוגי כרטיסים ראשוניים' },
          created_date: Timestamp.now()
        }
      ];

      for (const log of auditLogs) {
        try {
          await addDoc(collection(db, 'auditLogs'), log);
          console.log(`  ✅ Created audit log: ${log.action}`);
          await delay(300);
        } catch (error) {
          console.error(`  ❌ Error creating audit log:`, error.message);
        }
      }
    }

    console.log('\n✨ Seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Users created: ${createdUsers.length}`);
    console.log(`  - Ticket types created: ${createdTicketTypes.length}`);
    console.log('\n📝 Note: Users were created in both Firebase Authentication and Firestore.');
    console.log('   You can now log in with the credentials below.');
    console.log('\n🔑 Login credentials:');
    users.forEach((user, index) => {
      if (createdUsers.find(u => u.email === user.email)) {
        console.log(`  ${user.userData.position === 'owner' ? 'Owner' : 'Seller'}: ${user.email} / ${user.password}`);
      }
    });

  } catch (error) {
    console.error('\n❌ Error seeding data:', error);
    process.exit(1);
  }
}

// Run the seed function
seedData().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

