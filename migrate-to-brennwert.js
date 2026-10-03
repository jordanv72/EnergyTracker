const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');

console.log('Migrating from conversion_factor to brennwert and zustandszahl...');

initSQL().then(SQL => {
  if (!fs.existsSync(dbPath)) {
    console.log('Database does not exist. Run npm run init-db first.');
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  try {
    // Check if columns exist
    const tableInfo = db.exec("PRAGMA table_info(meters)");
    const columns = tableInfo[0]?.values || [];
    const columnNames = columns.map(col => col[1]);

    const hasBrennwert = columnNames.includes('brennwert');
    const hasZustandszahl = columnNames.includes('zustandszahl');
    const hasConversionFactor = columnNames.includes('conversion_factor');

    if (!hasBrennwert) {
      console.log('Adding brennwert column...');
      db.run('ALTER TABLE meters ADD COLUMN brennwert REAL DEFAULT NULL');
    }

    if (!hasZustandszahl) {
      console.log('Adding zustandszahl column...');
      db.run('ALTER TABLE meters ADD COLUMN zustandszahl REAL DEFAULT NULL');
    }

    // Migrate existing conversion_factor to brennwert/zustandszahl
    // Assuming conversion_factor was used: kWh = m³ × conversion_factor
    // And conversion_factor ≈ brennwert × zustandszahl
    // We'll set default typical values: brennwert=11.4, zustandszahl=0.9032 (gives ~10.3)
    if (hasConversionFactor) {
      console.log('Migrating conversion_factor values to brennwert and zustandszahl...');

      // Get meters with conversion_factor
      const meters = db.exec('SELECT id, conversion_factor FROM meters WHERE meter_type = "gas" AND conversion_factor IS NOT NULL');

      if (meters.length > 0 && meters[0].values.length > 0) {
        meters[0].values.forEach(row => {
          const [id, conversionFactor] = row;
          // Assuming typical zustandszahl of 0.9032
          const zustandszahl = 0.9032;
          const brennwert = conversionFactor / zustandszahl;

          db.run('UPDATE meters SET brennwert = ?, zustandszahl = ? WHERE id = ?',
            [brennwert, zustandszahl, id]);
        });
        console.log(`Migrated ${meters[0].values.length} gas meters`);
      }
    }

    // Save database
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);

    console.log('Migration completed successfully!');
    console.log('Gas meters now use Brennwert (calorific value) and Zustandszahl (state number)');
    console.log('Formula: kWh = m³ × Brennwert × Zustandszahl');
  } catch (error) {
    console.error('Migration error:', error.message);
  }

  db.close();
}).catch(err => {
  console.error('Error running migration:', err);
});
