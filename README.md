# Energy Meter Tracker

A Node.js application for tracking energy and gas meter readings with yearly consumption projections.

## Features

- **Multi-user support** with secure authentication
- **Meter Management** - Add and manage multiple electricity and gas meters
- **Reading Tracking** - Record meter readings for each meter
- **Automatic yearly consumption projections** based on current year's data
- **User-friendly dashboard** with separate sections for meters and readings
- **Responsive design** for mobile and desktop
- **SQLite database** for reliable data storage

## Installation

1. Install dependencies:
```bash
npm install
```

2. Initialize the database:
```bash
npm run init-db
```

This creates the SQLite database and a default admin user:
- Username: `admin`
- Password: `admin123`

## Running the App

Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The app will be available at `http://localhost:3001`

## Usage Workflow

### 1. Add Your Meters
- Click the "+ Add Meter" button
- Choose meter type (Electricity or Gas)
- Give it a name (e.g., "Main Meter", "Kitchen", "Basement")
- Optionally add a meter number
- Units are automatically assigned (kWh for electricity, m³ for gas)

### 2. Record Readings
- Select a meter from the dropdown
- Enter the current reading value
- Choose the date
- Add optional notes
- Click "Add Reading"

### 3. View Projections
- Click "View Projection" on any meter card
- See daily average consumption
- View projected yearly total based on current year's data
- Get estimated year-end meter value

## How Projections Work

The app needs at least 2 readings in the current year per meter to calculate projections:

1. Takes the first and last readings of the current year
2. Calculates consumption over that period
3. Determines daily average consumption
4. Projects total yearly consumption based on the daily average
5. Estimates the meter value at year end

## Database Schema

- **users**: User accounts with authentication
- **meters**: User's meters (type, name, number, unit)
- **meter_readings**: Individual readings linked to meters

Each user can have multiple meters, and each meter can have multiple readings.

## Migration from Old Structure

If you're upgrading from the previous version:
```bash
npm run migrate
```

This will automatically:
- Backup your existing database
- Create the new meters table structure
- Migrate all your existing readings
- Group readings by meter type and name

## Security Notes

- Passwords are hashed using bcrypt
- Sessions are managed securely
- Each user can only access their own meters and readings
- ⚠️ Change the session secret in production (server.js line 21)

## Tech Stack

- Node.js + Express
- SQLite (sql.js)
- EJS templates
- Session-based authentication
- bcryptjs for password hashing

## Project Structure

```
MyEnergyApp/
├── server.js           # Main application server
├── init-db.js          # Database initialization
├── migrate-to-meters.js # Migration script
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

## Troubleshooting

**Database issues:**
```bash
npm run init-db
```

**Port already in use:**
Edit `server.js` and change the PORT variable, or set environment variable:
```bash
PORT=3001 npm start
```

**Need to migrate existing data:**
```bash
npm run migrate
```

## Future Enhancements

Ideas for expansion:
- Cost calculations based on utility rates
- Export data to CSV/Excel
- Charts and graphs for consumption trends
- Email notifications for unusual consumption
- Mobile app
- Smart meter integration
