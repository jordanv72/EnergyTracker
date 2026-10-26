const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');

console.log('Renaming previous_year_value to previous_year_consumption...\n');

initSQL().then(SQL => {
  if (!fs.existsSync(dbPath)) {
    console.log('Database does not exist. Run npm run init-db first.');
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  try {
    // Check current structure
    const tableInfo = db.exec("PRAGMA table_info(meters)");
    const hasOldColumn = tableInfo.length > 0 &&
                         tableInfo[0].values.some(col => col[1] === 'previous_year_value');
    const hasNewColumn = tableInfo.length > 0 &&
                         tableInfo[0].values.some(col => col[1] === 'previous_year_consumption');

    if (hasNewColumn) {
      console.log('✓ Column already renamed to previous_year_consumption');
      db.close();
      return;
    }

    if (!hasOldColumn) {
      console.log('Adding previous_year_consumption column...');
      db.run('ALTER TABLE meters ADD COLUMN previous_year_consumption REAL DEFAULT NULL');
    } else {
      console.log('Renaming previous_year_value to previous_year_consumption...');

      // SQLite doesn't support RENAME COLUMN directly in older versions, so recreate table
      // Get all data first
      const metersData = db.exec('SELECT * FROM meters');

      // Create new table with correct column name
      db.run(`
        CREATE TABLE meters_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          meter_type TEXT NOT NULL,
          meter_name TEXT NOT NULL,
          meter_number TEXT,
          unit TEXT NOT NULL,
          brennwert REAL DEFAULT NULL,
          zustandszahl REAL DEFAULT NULL,
          price_per_unit REAL DEFAULT NULL,
          base_price_per_year REAL DEFAULT NULL,
          previous_year_consumption REAL DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Copy data
      db.run(`
        INSERT INTO meters_new
        SELECT id, meter_type, meter_name, meter_number, unit, brennwert, zustandszahl,
               price_per_unit, base_price_per_year, previous_year_value, created_at
        FROM meters
      `);

      // Drop old table
      db.run('DROP TABLE meters');

      // Rename new table
      db.run('ALTER TABLE meters_new RENAME TO meters');
    }

    console.log('✓ Migration completed successfully!');
    console.log('✓ Now stores total consumption from previous year');

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
