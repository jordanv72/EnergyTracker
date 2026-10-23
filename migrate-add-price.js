const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');

console.log('Adding price_per_unit column to meters table...\n');

initSQL().then(SQL => {
  if (!fs.existsSync(dbPath)) {
    console.log('Database does not exist. Run npm run init-db first.');
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  try {
    // Check if price_per_unit column already exists
    const tableInfo = db.exec("PRAGMA table_info(meters)");
    const hasPrice = tableInfo.length > 0 &&
                     tableInfo[0].values.some(col => col[1] === 'price_per_unit');

    if (hasPrice) {
      console.log('✓ price_per_unit column already exists');
      db.close();
      return;
    }

    console.log('Adding price_per_unit column...');

    // Add price_per_unit column
    db.run('ALTER TABLE meters ADD COLUMN price_per_unit REAL DEFAULT NULL');

    console.log('✓ Migration completed successfully!');
    console.log('✓ You can now set price per unit for each meter');

    // Save database
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);

  } catch (error) {
    console.error('✗ Migration failed:', error.message);
  }

  db.close();
}).catch(err => {
  console.error('Error:', err);
});
