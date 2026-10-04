const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'energy.db');

initSQL().then(SQL => {
  if (!fs.existsSync(dbPath)) {
    console.log('Database not found. Run: npm run init-db');
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);

  const users = db.exec('SELECT id, username, email, created_at FROM users');

  if (users.length === 0 || users[0].values.length === 0) {
    console.log('No users found.');
    return;
  }

  console.log('\n📋 Current Users:\n');
  console.log('ID  | Username       | Email                  | Created At');
  console.log('----+----------------+------------------------+-------------------');

  users[0].values.forEach(row => {
    const [id, username, email, created_at] = row;
    const emailDisplay = email || '(not set)';
    const dateDisplay = created_at ? new Date(created_at).toLocaleDateString() : '-';
    console.log(`${String(id).padEnd(3)} | ${String(username).padEnd(14)} | ${String(emailDisplay).padEnd(22)} | ${dateDisplay}`);
  });

  console.log(`\nTotal users: ${users[0].values.length}\n`);

  db.close();
}).catch(err => {
  console.error('Error:', err);
});
