const bcrypt = require('bcryptjs');
const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');

// Usage: node add-user.js username password email
const username = process.argv[2];
const password = process.argv[3];
const email = process.argv[4] || '';

if (!username || !password) {
  console.log('Usage: node add-user.js <username> <password> [email]');
  console.log('Example: node add-user.js john mypassword123 john@example.com');
  process.exit(1);
}

initSQL().then(SQL => {
  if (!fs.existsSync(dbPath)) {
    console.log('Database not found. Run: npm run init-db');
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    db.run('INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
      [username, hashedPassword, email]);

    console.log(`✅ User '${username}' created successfully!`);
    console.log(`   Email: ${email || '(not set)'}`);
    console.log(`   They can now login at http://localhost:3001/login`);

    // Save database
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      console.error(`❌ Error: Username '${username}' already exists`);
    } else {
      console.error('❌ Error:', error.message);
    }
  }

  db.close();
}).catch(err => {
  console.error('Error:', err);
});
