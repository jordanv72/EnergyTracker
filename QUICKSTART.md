# Quick Start Guide

## Your Energy Tracker App is Ready!

The application is currently running at: **http://localhost:3000**

### Default Login Credentials
- Username: `admin`
- Password: `admin123`

### Features
✅ Multi-user authentication system
✅ Track electricity and gas meter readings
✅ Automatic yearly consumption projections
✅ Real-time calculations based on your data
✅ Responsive dashboard with charts
✅ Secure SQLite database

### How to Use

1. **Login** - Visit http://localhost:3000 and login with the default credentials
2. **Add Readings** - Enter your meter readings with date and value
3. **View Projections** - The app automatically calculates:
   - Daily average consumption
   - Projected yearly total
   - Expected year-end meter value
4. **Track History** - View all readings in a filterable table

### Managing the App

**Start the server:**
```bash
npm start
```

**Development mode with auto-reload:**
```bash
npm run dev
```

**Stop the server:**
Press `Ctrl+C` in the terminal

**Create new users:**
- Click "Register here" on the login page
- Or use the admin account to add readings

### Database
- Location: `energy.db` in the project root
- Automatic backups on every data change
- All user data is isolated per user account

### Project Structure
```
MyEnergyApp/
├── server.js           # Main application server
├── init-db.js          # Database initialization
├── package.json        # Dependencies
├── views/              # EJS templates
│   ├── login.ejs
│   ├── register.ejs
│   └── dashboard.ejs
├── public/
│   └── css/
│       └── style.css   # Styles
└── energy.db           # SQLite database
```

### Security Notes
⚠️ Before deploying to production:
1. Change the session secret in `server.js` (line 21)
2. Change the default admin password
3. Add HTTPS support
4. Set up proper environment variables

### Troubleshooting

**Database issues:**
```bash
npm run init-db
```

**Port already in use:**
Edit `server.js` and change the PORT variable, or set environment variable:
```bash
PORT=3001 npm start
```

### Next Steps
- Add more users via the registration page
- Start entering your meter readings
- After 2+ readings in the current year, projections will automatically appear
- Export data (add this feature if needed)
- Add cost calculations (add this feature if needed)
