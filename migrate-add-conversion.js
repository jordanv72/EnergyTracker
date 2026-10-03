const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');

console.log('Adding conversion_factor column to meters table...');

initSQL().then(SQL => {
  if (!fs.existsSync(dbPath)) {
    console.log('Database does not exist. Run npm run init-db first.');
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  try {
    // Check if conversion_factor column already exists
    const tableInfo = db.exec("PRAGMA table_info(meters)");
    const columns = tableInfo[0]?.values || [];
    const hasColumn = columns.some(col => col[1] === 'conversion_factor');

    if (!hasColumn) {
      console.log('Adding conversion_factor column...');
      db.run('ALTER TABLE meters ADD COLUMN conversion_factor REAL DEFAULT 1.0');

      // Update existing gas meters with default conversion factor (10.3 is common in many regions)
      db.run('UPDATE meters SET conversion_factor = 10.3 WHERE meter_type = "gas"');

      // Save database
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);

      console.log('Migration completed successfully!');
      console.log('Gas meters now have a default conversion factor of 10.3 kWh per m³');
    } else {
      console.log('conversion_factor column already exists. No migration needed.');
    }
  } catch (error) {
    console.error('Migration error:', error.message);
  }

  db.close();
}).catch(err => {
  console.error('Error running migration:', err);
});
