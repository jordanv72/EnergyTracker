const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');

console.log('Adding is_admin column to users table...');

initSQL().then(SQL => {
  if (!fs.existsSync(dbPath)) {
    console.log('Database does not exist. Run npm run init-db first.');
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  try {
    // Check if is_admin column exists
    const tableInfo = db.exec("PRAGMA table_info(users)");
    const columns = tableInfo[0]?.values || [];
    const hasColumn = columns.some(col => col[1] === 'is_admin');

    if (!hasColumn) {
      console.log('Adding is_admin column...');
      db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');

      // Make existing admin user an admin
      db.run('UPDATE users SET is_admin = 1 WHERE username = "admin"');

      // Save database
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);

      console.log('Migration completed successfully!');
      console.log('Admin user now has admin privileges');
    } else {
      console.log('is_admin column already exists. No migration needed.');
    }
  } catch (error) {
    console.error('Migration error:', error.message);
  }

  db.close();
}).catch(err => {
  console.error('Error running migration:', err);
});
