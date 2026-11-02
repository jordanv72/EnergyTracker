const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');

console.log('Adding replaces_meter_id column to meters table...\n');

initSQL().then(SQL => {
  if (!fs.existsSync(dbPath)) {
    console.log('Database does not exist. Run npm run init-db first.');
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  try {
    // Check if replaces_meter_id column already exists
    const tableInfo = db.exec("PRAGMA table_info(meters)");
    const hasReplacesMeterId = tableInfo.length > 0 &&
                                tableInfo[0].values.some(col => col[1] === 'replaces_meter_id');

    if (hasReplacesMeterId) {
      console.log('✓ replaces_meter_id column already exists');
      db.close();
      return;
    }

    console.log('Adding replaces_meter_id column...');

    // Add replaces_meter_id column with foreign key
    db.run('ALTER TABLE meters ADD COLUMN replaces_meter_id INTEGER DEFAULT NULL');

    console.log('✓ Migration completed successfully!');
    console.log('✓ You can now link a new meter to the old meter it replaced');
    console.log('✓ Consumption will be calculated across both meters for accurate yearly totals');

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
