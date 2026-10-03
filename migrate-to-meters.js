const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');
const backupPath = path.join(__dirname, 'energy.db.backup');

console.log('Starting database migration to new structure...');

// Backup existing database
if (fs.existsSync(dbPath)) {
  fs.copyFileSync(dbPath, backupPath);
  console.log('Backup created at:', backupPath);
}

initSQL().then(SQL => {
  if (!fs.existsSync(dbPath)) {
    console.log('No existing database found. Please run: npm run init-db');
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  try {
    // Check if meters table exists
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables[0]?.values.flat() || [];
    const hasMetersTable = tableNames.includes('meters');

    if (hasMetersTable) {
      console.log('Meters table already exists. Migration not needed.');
      db.close();
      return;
    }

    console.log('Creating new meters table...');

    // Create meters table
    db.run(`
      CREATE TABLE meters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        meter_type TEXT NOT NULL,
        meter_name TEXT NOT NULL,
        meter_number TEXT,
        unit TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create new meter_readings table
    db.run(`
      CREATE TABLE meter_readings_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meter_id INTEGER NOT NULL,
        reading_value REAL NOT NULL,
        reading_date DATE NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (meter_id) REFERENCES meters(id) ON DELETE CASCADE
      )
    `);

    // Migrate data from old structure
    console.log('Migrating existing readings...');

    // Get all old readings
    const oldReadings = db.exec('SELECT * FROM meter_readings');

    if (oldReadings.length > 0) {
      const columns = oldReadings[0].columns;
      const values = oldReadings[0].values;

      // Group readings by user_id, meter_type, and meter_name
      const metersMap = new Map();

      values.forEach(row => {
        const rowObj = {};
        columns.forEach((col, idx) => {
          rowObj[col] = row[idx];
        });

        const meterKey = `${rowObj.user_id}_${rowObj.meter_type}_${rowObj.meter_name || 'default'}`;

        if (!metersMap.has(meterKey)) {
          metersMap.set(meterKey, {
            user_id: rowObj.user_id,
            meter_type: rowObj.meter_type,
            meter_name: rowObj.meter_name || `${rowObj.meter_type} meter`,
            unit: rowObj.unit || (rowObj.meter_type === 'electricity' ? 'kWh' : 'm³'),
            readings: []
          });
        }

        metersMap.get(meterKey).readings.push({
          reading_value: rowObj.reading_value,
          reading_date: rowObj.reading_date,
          notes: rowObj.notes || '',
          created_at: rowObj.created_at
        });
      });

      // Insert meters and readings
      metersMap.forEach((meterData) => {
        // Insert meter
        db.run(
          'INSERT INTO meters (user_id, meter_type, meter_name, unit) VALUES (?, ?, ?, ?)',
          [meterData.user_id, meterData.meter_type, meterData.meter_name, meterData.unit]
        );

        // Get the meter ID
        const meterResult = db.exec('SELECT last_insert_rowid() as id');
        const meterId = meterResult[0].values[0][0];

        // Insert readings for this meter
        meterData.readings.forEach(reading => {
          db.run(
            'INSERT INTO meter_readings_new (meter_id, reading_value, reading_date, notes, created_at) VALUES (?, ?, ?, ?, ?)',
            [meterId, reading.reading_value, reading.reading_date, reading.notes, reading.created_at]
          );
        });
      });

      console.log(`Migrated ${metersMap.size} meters with ${values.length} readings`);
    }

    // Drop old table and rename new one
    db.run('DROP TABLE meter_readings');
    db.run('ALTER TABLE meter_readings_new RENAME TO meter_readings');

    // Create indexes
    db.run('CREATE INDEX idx_meters_user ON meters(user_id)');
    db.run('CREATE INDEX idx_readings_meter ON meter_readings(meter_id)');
    db.run('CREATE INDEX idx_readings_date ON meter_readings(reading_date)');

    // Save database
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);

    console.log('Migration completed successfully!');
    console.log('Your old database has been backed up to:', backupPath);
  } catch (error) {
    console.error('Migration error:', error.message);
    console.log('Restoring from backup...');
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, dbPath);
      console.log('Database restored from backup');
    }
  }

  db.close();
}).catch(err => {
  console.error('Error running migration:', err);
});
