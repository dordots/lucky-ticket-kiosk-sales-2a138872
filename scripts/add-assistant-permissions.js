// Add permissions field to assistant users (UI-only permissions model)
// Run with: node scripts/add-assistant-permissions.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read Firebase config from src/firebase/config.js
let firebaseConfig;
try {
  const configPath = join(__dirname, '../src/firebase/config.js');
  const configContent = readFileSync(configPath, 'utf-8');
  const configMatch = configContent.match(/const firebaseConfig = ({[\s\S]*?});/);
  if (configMatch) {
    firebaseConfig = eval(`(${configMatch[1]})`);
  } else {
    throw new Error('Could not find firebaseConfig in config file');
  }
  if (firebaseConfig.apiKey === "YOUR_API_KEY" || firebaseConfig.apiKey.includes("YOUR_")) {
    console.error('❌ Error: Please update src/firebase/config.js with your Firebase credentials first!');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error reading Firebase config:', error.message);
  process.exit(1);
}

// Dependencies map to auto-include base view permissions
const PERM_DEPENDENCIES = {
  inventory_add: "inventory_view",
  inventory_edit: "inventory_view",
  inventory_delete: "inventory_view",
  sales_history_export: "sales_history_view",
  reports_export: "reports_view",
  kiosk_details_edit: "kiosk_details_view",
};

const DEFAULT_PERMS = ["sell"];

const ensureBasePerms = (perms = []) => {
  const set = new Set(perms);
  perms.forEach((p) => {
    const base = PERM_DEPENDENCIES[p];
    if (base) set.add(base);
  });
  return Array.from(set);
};

async function main() {
  console.log('🚀 Starting permissions backfill for assistants...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('role', '==', 'assistant'));
  const snapshot = await getDocs(q);

  let updated = 0;
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    let perms = data.permissions;
    if (!Array.isArray(perms) || perms.length === 0) {
      perms = DEFAULT_PERMS;
    }
    const normalized = ensureBasePerms(perms);
    // Skip if identical
    const same = Array.isArray(data.permissions) &&
      data.permissions.length === normalized.length &&
      data.permissions.every((p) => normalized.includes(p));
    if (same) continue;

    await updateDoc(doc(db, 'users', docSnap.id), { permissions: normalized });
    updated += 1;
    console.log(`✅ Updated assistant ${docSnap.id} (${data.email || ''}) ->`, normalized);
  }

  console.log(`🎉 Done. Updated ${updated} assistant(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error running script:', err);
  process.exit(1);
});

