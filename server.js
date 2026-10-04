const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const initSQL = require('sql.js');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const dbPath = path.join(__dirname, 'energy.db');
let SQL;
let db;

// Initialize database
async function initDatabase() {
  SQL = await initSQL();
  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(filebuffer);
  } else {
    throw new Error('Database not initialized. Run: npm run init-db');
  }
}

// Save database to file
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Helper to run queries
function dbGet(query, params = []) {
  const stmt = db.prepare(query);
  stmt.bind(params);
  if (stmt.step()) {
    return stmt.getAsObject();
  }
  stmt.free();
  return null;
}

function dbAll(query, params = []) {
  const stmt = db.prepare(query);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function dbRun(query, params = []) {
  db.run(query, params);
  saveDatabase();
}

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'energy-tracker-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Admin middleware
function requireAdmin(req, res, next) {
  if (req.session.userId && req.session.isAdmin) {
    next();
  } else {
    res.status(403).send('Access denied. Admin privileges required.');
  }
}

// Routes
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = dbGet('SELECT * FROM users WHERE username = ?', [username]);

  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = user.is_admin === 1;
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: 'Invalid username or password' });
  }
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', (req, res) => {
  const { username, password, email } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    dbRun('INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
      [username, hashedPassword, email]);
    res.redirect('/login');
  } catch (error) {
    res.render('register', { error: 'Username already exists' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/dashboard', requireAuth, (req, res) => {
  // Get user's meters with latest reading
  const meters = dbAll(`
    SELECT m.*,
           (SELECT reading_value FROM meter_readings WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1) as last_reading,
           (SELECT reading_date FROM meter_readings WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1) as last_reading_date,
           (SELECT COUNT(*) FROM meter_readings WHERE meter_id = m.id) as reading_count
    FROM meters m
    WHERE m.user_id = ?
    ORDER BY m.created_at DESC
  `, [req.session.userId]);

  // Get recent readings with meter info
  const readings = dbAll(`
    SELECT r.*, m.meter_name, m.meter_type, m.unit
    FROM meter_readings r
    JOIN meters m ON r.meter_id = m.id
    WHERE m.user_id = ?
    ORDER BY r.reading_date DESC
    LIMIT 50
  `, [req.session.userId]);

  res.render('dashboard', {
    username: req.session.username,
    isAdmin: req.session.isAdmin || false,
    meters,
    readings
  });
});

// Meter management routes
app.get('/api/meters', requireAuth, (req, res) => {
  const meters = dbAll('SELECT * FROM meters WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId]);
  res.json(meters);
});

app.post('/api/meters', requireAuth, (req, res) => {
  const { meter_type, meter_name, meter_number, brennwert, zustandszahl } = req.body;
  const unit = meter_type === 'electricity' ? 'kWh' : 'm³';

  try {
    dbRun(`
      INSERT INTO meters (user_id, meter_type, meter_name, meter_number, unit, brennwert, zustandszahl)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      req.session.userId,
      meter_type,
      meter_name,
      meter_number || '',
      unit,
      brennwert || null,
      zustandszahl || null
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.put('/api/meters/:id', requireAuth, (req, res) => {
  const { meter_name, meter_number, brennwert, zustandszahl } = req.body;

  try {
    // Verify meter belongs to user
    const meter = dbGet('SELECT * FROM meters WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.userId]);

    if (!meter) {
      return res.status(404).json({ success: false, error: 'Meter not found' });
    }

    dbRun(`
      UPDATE meters
      SET meter_name = ?, meter_number = ?, brennwert = ?, zustandszahl = ?
      WHERE id = ? AND user_id = ?
    `, [
      meter_name,
      meter_number || '',
      brennwert || null,
      zustandszahl || null,
      req.params.id,
      req.session.userId
    ]);

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/meters/:id', requireAuth, (req, res) => {
  try {
    // Check if meter belongs to user
    const meter = dbGet('SELECT * FROM meters WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.userId]);

    if (!meter) {
      return res.status(404).json({ success: false, error: 'Meter not found' });
    }

    // Delete meter (readings will be cascade deleted)
    dbRun('DELETE FROM meters WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.userId]);

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Reading routes
app.post('/api/readings', requireAuth, (req, res) => {
  const { meter_id, reading_value, reading_date, notes } = req.body;

  try {
    // Verify meter belongs to user
    const meter = dbGet('SELECT * FROM meters WHERE id = ? AND user_id = ?',
      [meter_id, req.session.userId]);

    if (!meter) {
      return res.status(400).json({ success: false, error: 'Invalid meter' });
    }

    dbRun(`
      INSERT INTO meter_readings (meter_id, reading_value, reading_date, notes)
      VALUES (?, ?, ?, ?)
    `, [meter_id, reading_value, reading_date, notes || '']);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/readings', requireAuth, (req, res) => {
  const { meter_id } = req.query;
  let query = `
    SELECT r.*, m.meter_name, m.meter_type, m.unit
    FROM meter_readings r
    JOIN meters m ON r.meter_id = m.id
    WHERE m.user_id = ?
  `;
  const params = [req.session.userId];

  if (meter_id) {
    query += ' AND r.meter_id = ?';
    params.push(meter_id);
  }

  query += ' ORDER BY r.reading_date DESC';
  const readings = dbAll(query, params);
  res.json(readings);
});

app.delete('/api/readings/:id', requireAuth, (req, res) => {
  try {
    // Check if reading belongs to user's meter
    const reading = dbGet(`
      SELECT r.* FROM meter_readings r
      JOIN meters m ON r.meter_id = m.id
      WHERE r.id = ? AND m.user_id = ?
    `, [req.params.id, req.session.userId]);

    if (!reading) {
      return res.status(404).json({ success: false, error: 'Reading not found' });
    }

    dbRun('DELETE FROM meter_readings WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/projection/:meter_id', requireAuth, (req, res) => {
  const { meter_id } = req.params;
  const currentYear = new Date().getFullYear();

  // Verify meter belongs to user
  const meter = dbGet('SELECT * FROM meters WHERE id = ? AND user_id = ?',
    [meter_id, req.session.userId]);

  if (!meter) {
    return res.status(404).json({ success: false, error: 'Meter not found' });
  }

  // Get readings for current year
  const readings = dbAll(`
    SELECT reading_value, reading_date
    FROM meter_readings
    WHERE meter_id = ? AND strftime('%Y', reading_date) = ?
    ORDER BY reading_date ASC
  `, [meter_id, currentYear.toString()]);

  if (readings.length < 2) {
    return res.json({
      success: false,
      message: 'Need at least 2 readings in current year for projection'
    });
  }

  // Calculate consumption and projection
  const firstReading = readings[0];
  const lastReading = readings[readings.length - 1];

  const firstDate = new Date(firstReading.reading_date);
  const lastDate = new Date(lastReading.reading_date);
  const daysPassed = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

  if (daysPassed === 0) {
    return res.json({
      success: false,
      message: 'Readings must be on different dates'
    });
  }

  const consumption = lastReading.reading_value - firstReading.reading_value;
  const dailyAverage = consumption / daysPassed;

  // Project to end of year
  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear, 11, 31);
  const daysInYear = (endOfYear - startOfYear) / (1000 * 60 * 60 * 24) + 1;

  const projectedYearlyConsumption = dailyAverage * daysInYear;
  const daysRemainingInYear = (endOfYear - lastDate) / (1000 * 60 * 60 * 24);
  const projectedEndValue = lastReading.reading_value + (dailyAverage * daysRemainingInYear);

  // Calculate kWh values if gas meter with brennwert and zustandszahl
  let consumptionKwh = null;
  let dailyAverageKwh = null;
  let projectedYearlyKwh = null;
  let conversionFactor = null;

  if (meter.meter_type === 'gas' && meter.brennwert && meter.zustandszahl) {
    // Formula: kWh = m³ × Brennwert × Zustandszahl
    conversionFactor = meter.brennwert * meter.zustandszahl;
    consumptionKwh = consumption * conversionFactor;
    dailyAverageKwh = dailyAverage * conversionFactor;
    projectedYearlyKwh = projectedYearlyConsumption * conversionFactor;
  }

  res.json({
    success: true,
    meter_name: meter.meter_name,
    meter_type: meter.meter_type,
    unit: meter.unit,
    brennwert: meter.brennwert,
    zustandszahl: meter.zustandszahl,
    conversion_factor: conversionFactor ? conversionFactor.toFixed(4) : null,
    currentYear,
    firstReading: {
      value: firstReading.reading_value,
      date: firstReading.reading_date
    },
    lastReading: {
      value: lastReading.reading_value,
      date: lastReading.reading_date
    },
    daysPassed,
    consumption,
    consumptionKwh: consumptionKwh ? consumptionKwh.toFixed(2) : null,
    dailyAverage: dailyAverage.toFixed(4),
    dailyAverageKwh: dailyAverageKwh ? dailyAverageKwh.toFixed(4) : null,
    projectedYearlyConsumption: projectedYearlyConsumption.toFixed(2),
    projectedYearlyKwh: projectedYearlyKwh ? projectedYearlyKwh.toFixed(2) : null,
    projectedEndValue: projectedEndValue.toFixed(2),
    readingCount: readings.length
  });
});

// Admin routes
app.get('/admin', requireAdmin, (req, res) => {
  const users = dbAll('SELECT id, username, email, is_admin, created_at FROM users ORDER BY created_at DESC');
  res.render('admin', {
    username: req.session.username,
    isAdmin: req.session.isAdmin,
    users
  });
});

app.post('/admin/users', requireAdmin, (req, res) => {
  const { username, password, email, is_admin } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    dbRun('INSERT INTO users (username, password, email, is_admin) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, email || '', is_admin ? 1 : 0]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/admin/users/:id', requireAdmin, (req, res) => {
  try {
    // Prevent deleting yourself
    if (parseInt(req.params.id) === req.session.userId) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    dbRun('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.put('/admin/users/:id/toggle-admin', requireAdmin, (req, res) => {
  try {
    const user = dbGet('SELECT is_admin FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const newAdminStatus = user.is_admin === 1 ? 0 : 1;
    dbRun('UPDATE users SET is_admin = ? WHERE id = ?', [newAdminStatus, req.params.id]);
    res.json({ success: true, is_admin: newAdminStatus });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Energy Tracker app running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
