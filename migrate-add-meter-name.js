const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');

// Migration script to add meter_name column
initSQL().then(SQL => {
  if (!fs.existsSync(dbPath)) {
    console.log('Database does not exist. Run npm run init-db first.');
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  try {
    // Check if meter_name column already exists
    const tableInfo = db.exec("PRAGMA table_info(meter_readings)");
    const columns = tableInfo[0]?.values || [];
    const hasColumn = columns.some(col => col[1] === 'meter_name');

    if (!hasColumn) {
      console.log('Adding meter_name column...');
      db.run('ALTER TABLE meter_readings ADD COLUMN meter_name TEXT');

      // Save database
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);

      console.log('Migration completed successfully!');
    } else {
      console.log('meter_name column already exists. No migration needed.');
    }
  } catch (error) {
    console.error('Migration error:', error.message);
  }

  db.close();
}).catch(err => {
  console.error('Error running migration:', err);
});
