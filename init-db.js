const initSQL = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');

initSQL().then(SQL => {
  let db;

  // Check if database exists
  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS meters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      meter_type TEXT NOT NULL,
      meter_name TEXT NOT NULL,
      meter_number TEXT,
      unit TEXT NOT NULL,
      brennwert REAL DEFAULT NULL,
      zustandszahl REAL DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS meter_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meter_id INTEGER NOT NULL,
      reading_value REAL NOT NULL,
      reading_date DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meter_id) REFERENCES meters(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_meters_user ON meters(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_readings_meter ON meter_readings(meter_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_readings_date ON meter_readings(reading_date)`);

  // Create a default admin user (password: admin123)
  const hashedPassword = bcrypt.hashSync('admin123', 10);

  try {
    db.run('INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)',
      ['admin', hashedPassword, 'admin@example.com']);

    console.log('Database initialized successfully!');
    console.log('Default user created: username=admin, password=admin123');
  } catch (error) {
    console.error('Error creating default user:', error.message);
  }

  // Save database to file
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  db.close();
}).catch(err => {
  console.error('Error initializing database:', err);
});
