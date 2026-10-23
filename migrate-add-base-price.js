const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');

console.log('Adding base_price_per_year column to meters table...\n');

initSQL().then(SQL => {
  if (!fs.existsSync(dbPath)) {
    console.log('Database does not exist. Run npm run init-db first.');
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  try {
    // Check if base_price_per_year column already exists
    const tableInfo = db.exec("PRAGMA table_info(meters)");
    const hasBasePrice = tableInfo.length > 0 &&
                         tableInfo[0].values.some(col => col[1] === 'base_price_per_year');

    if (hasBasePrice) {
      console.log('✓ base_price_per_year column already exists');
      db.close();
      return;
    }

    console.log('Adding base_price_per_year column...');

    // Add base_price_per_year column
    db.run('ALTER TABLE meters ADD COLUMN base_price_per_year REAL DEFAULT NULL');

    console.log('✓ Migration completed successfully!');
    console.log('✓ You can now set base price per year for each meter (e.g., Grundgebühr)');

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
