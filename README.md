# BillX V2 — Construction Intelligence Platform

A full-stack construction project management system for tracking BOQ (Bill of Quantities) and RA Bills (Running Account Bills).

**Stack:** Node.js + Express + MySQL + React 19 (Vite)

---

## Quick Start (New Machine Setup)

### Prerequisites
- Node.js v18+ 
- MySQL 8.0+
- Git

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/harish112k5/Billx_v2.git
cd Billx_v2
git checkout sudharsan
```

---

### Step 2 — Set up the Database

Import the database schema and seed data:

```bash
# Create the database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS billx_v2;"

# Import the full schema + seed data
mysql -u root -p billx_v2 < database_backup.sql
```

> **Windows users (XAMPP):**
> ```
> C:\xampp\mysql\bin\mysql.exe -u root billx_v2 < database_backup.sql
> ```

---

### Step 3 — Configure Backend Environment

```bash
cd backend
cp .env.example .env
```

Now open `backend/.env` and fill in your values:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=billx_v2
JWT_SECRET=any_long_random_string_here
```

---

### Step 4 — Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

### Step 5 — Run the Application

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# Server runs at http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# App runs at http://localhost:5173
```

---

### Step 6 — Login

Open your browser at `http://localhost:5173`

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@billx.com | password |
| Manager | manager@billx.com | password |
| Engineer | engineer@billx.com | password |

---

## Project Structure

```
billxv2/
├── backend/
│   ├── server.js              # Express entry point (port 5000)
│   ├── db.js                  # MySQL connection pool
│   ├── .env.example           # Environment variable template
│   ├── middleware/auth.js     # JWT verification middleware
│   ├── routes/                # All API route files
│   ├── services/
│   │   ├── excelParser.js     # Excel → JSON parsing
│   │   └── importPipeline.js  # Atomic DB import transaction
│   └── uploads/excel/         # Uploaded Excel files (auto-created)
│
├── frontend/
│   └── src/
│       ├── App.jsx            # Root router + Auth context
│       ├── api/axios.js       # Axios client with JWT interceptor
│       ├── pages/             # All 17 page components
│       └── components/        # 7 shared components
│
├── database_backup.sql        # Full MySQL schema + seed data
└── test_data/                 # Sample RA Bill Excel files for testing
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → JWT token |
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id/dashboard` | Full project analytics |
| GET | `/api/projects/:id/boq` | BOQ items with progress |
| POST | `/api/import/preview` | Excel preview (no DB write) |
| POST | `/api/import/ra-bill` | Confirm Excel import |
| GET | `/api/ra-bills/:id/measurements` | Measurement records |

---

## Importing an RA Bill Excel File

1. Navigate to **Import Excel** in the sidebar
2. Select your Project and Contractor
3. Upload a `.xlsx` file (see `test_data/` for examples)
4. Review the Preview
5. Click **Confirm Import**

### Excel Sheet Structure Expected:
| Sheet Name | Purpose |
|------------|---------|
| `Abstract` | Financial summary + RA number |
| `BOQ` | Bill of Quantities line items |
| `1001`, `1002`... | Measurement detail sheets (numeric names match `item_code`) |
| `Non BOQ` | Extra-scope work items |

---

## Known Fixes Applied (sudharsan branch)

| Fix | Description |
|-----|-------------|
| JWT fallback | `JWT_SECRET` falls back to a default if `.env` is missing |
| Measurement sheet detection | Regex `/^\d+$/` detects ALL numeric sheet names (not just multiples of 10) |
| Measurement BOQ lookup | Now looks up by `item_code` (not `item_number`) — critical fix |
| Excel serial date parsing | Converts Excel serial dates (e.g. `45791.77`) to `YYYY-MM-DD` |
| Sandwich Layer | Auto-promotes subcontractor if no main contractor assigned |

---

## Deployment

### Backend (Render)
- Uses `render.yaml` — auto-detected on push
- Set environment variables in Render dashboard

### Frontend (Vercel)
- Uses `frontend/vercel.json` for SPA routing
- Set `VITE_API_URL=https://your-backend.onrender.com/api` in Vercel environment
