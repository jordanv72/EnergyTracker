const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');

console.log('Migrating meters table to remove user_id column...\n');

initSQL().then(SQL => {
  if (!fs.existsSync(dbPath)) {
    console.log('Database does not exist. Run npm run init-db first.');
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  try {
    // Check if user_id column exists
    const tableInfo = db.exec("PRAGMA table_info(meters)");
    const hasUserId = tableInfo.length > 0 &&
                      tableInfo[0].values.some(col => col[1] === 'user_id');

    if (!hasUserId) {
      console.log('✓ meters table already does not have user_id column');
      db.close();
      return;
    }

    console.log('Found user_id column in meters table. Removing it...');

    // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
    // 1. Create new table without user_id
    db.run(`
      CREATE TABLE meters_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meter_type TEXT NOT NULL,
        meter_name TEXT NOT NULL,
        meter_number TEXT,
        unit TEXT NOT NULL,
        brennwert REAL DEFAULT NULL,
        zustandszahl REAL DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Copy data from old table to new (excluding user_id)
    db.run(`
      INSERT INTO meters_new (id, meter_type, meter_name, meter_number, unit, brennwert, zustandszahl, created_at)
      SELECT id, meter_type, meter_name, meter_number, unit, brennwert, zustandszahl, created_at
      FROM meters
    `);

    // 3. Drop old table
    db.run('DROP TABLE meters');

    // 4. Rename new table
    db.run('ALTER TABLE meters_new RENAME TO meters');

    // 5. Recreate index
    db.run('CREATE INDEX IF NOT EXISTS idx_readings_meter ON meter_readings(meter_id)');

    console.log('✓ Migration completed successfully!');
    console.log('✓ Meters are now shared across all users');

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
