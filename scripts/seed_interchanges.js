const fs = require('fs');
const path = require('path');
const db = require('../database');

const seedPath = path.join(__dirname, 'seed_interchanges.json');

if (!fs.existsSync(seedPath)) {
  console.error('Seed file not found:', seedPath);
  process.exit(1);
}

const raw = fs.readFileSync(seedPath, 'utf8');
const entries = JSON.parse(raw);

entries.forEach(entry => {
  const existing = db.getInterchanges().find(item => item.name.toLowerCase() === entry.name.toLowerCase());
  if (existing) {
    console.log(`Skipping existing interchange: ${entry.name}`);
    return;
  }

  const result = db.createInterchange(entry);
  if (result.success) {
    console.log(`✅ Inserted ${entry.name}`);
  } else {
    console.error(`❌ Failed to insert ${entry.name}:`, result.error);
  }
});

db.close();
