const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');

console.log('Adding previous_year_value column to meters table...\n');

initSQL().then(SQL => {
  if (!fs.existsSync(dbPath)) {
    console.log('Database does not exist. Run npm run init-db first.');
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  try {
    // Check if previous_year_value column already exists
    const tableInfo = db.exec("PRAGMA table_info(meters)");
    const hasPreviousYearValue = tableInfo.length > 0 &&
                                  tableInfo[0].values.some(col => col[1] === 'previous_year_value');

    if (hasPreviousYearValue) {
      console.log('✓ previous_year_value column already exists');
      db.close();
      return;
    }

    console.log('Adding previous_year_value column...');

    // Add previous_year_value column
    db.run('ALTER TABLE meters ADD COLUMN previous_year_value REAL DEFAULT NULL');

    console.log('✓ Migration completed successfully!');
    console.log('✓ You can now set the meter value from the end of the previous year');

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
