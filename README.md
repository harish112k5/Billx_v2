# BillX V2 — Construction Intelligence Platform

A full-stack construction billing management system for tracking RA bills, BOQ progress, expenses, investments, and cash flow.

## Tech Stack

| Layer     | Technology                |
|-----------|---------------------------|
| Frontend  | React 19 + Vite + Recharts |
| Backend   | Node.js + Express 4       |
| Database  | MySQL 8.x                 |
| Auth      | JWT (bcrypt passwords)     |
| Excel     | SheetJS (xlsx library)    |

---

## Quick Start

### 1. Database Setup

```bash
# Create the DB and tables
mysql -u root -p < backend/db/schema.sql

# Insert demo users and sample project
mysql -u root -p < backend/db/seed.sql
```

### 2. Backend Setup

```bash
cd backend

# Copy environment (edit DB credentials if needed)
# Default: DB_USER=root, DB_PASSWORD=, DB_NAME=billx_v2

npm install
npm run dev    # Starts on http://localhost:5000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev    # Starts on http://localhost:5173
```

---

## Demo Login Credentials

| Role         | Email                  | Password   |
|--------------|------------------------|------------|
| Super Admin  | admin@billx.com        | `password` |
| Manager      | manager@billx.com      | `password` |
| Engineer     | engineer@billx.com     | `password` |

---

## Key Features

### 📄 RA Bill Management
- Import Excel RA bills (TKTR-NIP format, 86-sheet structure)
- Abstract sheet auto-parsing (financial figures)
- BOQ sheet parsing (82+ items with planned/executed quantities)
- Measurement book data (numbered sheets: 10, 20, 30...)
- Non-BOQ item tracking
- Stage workflow: Draft → Submitted → Certified → Paid

### 📊 Project Dashboard
- Hero banner with project KPIs
- BOQ completion donut chart
- RA Bill progression bar chart
- Billing summary (gross, net payable, received, pending)
- Deductions breakdown (retention, TDS, labour cess)
- Sandwich layer view (main + sub contractors)

### 📈 Analytics
- BOQ category breakdown (planned vs executed)
- RA bill trend analysis
- BOQ item status distribution pie

### 💰 Cash Flow
- Payment inflow / outflow timeline
- Running net position line chart

### 👥 Investor Dashboard
- Investment tracking with ROI calculation
- Return types: Fixed, Profit Share, Billing Based
- Project health snapshot for investors

### 💸 Expenses
- Per-project expense tracking
- Categories: Labour, Material, Equipment, Overhead, Transport, Other
- Payment status tracking
- Category breakdown pie chart

### 🏗️ Organizations
- Multi-org support (Main Contractor, Subcontractor, Owner, Consultant)
- Sandwich layer architecture (BOQ allocations)

### ⚙️ Admin Panel
- System stats
- User management

---

## Project Structure

```
billx-v2/
├── backend/
│   ├── db/
│   │   ├── schema.sql     ← DB tables & views
│   │   └── seed.sql       ← Demo data (run after schema)
│   ├── middleware/
│   │   └── auth.js        ← JWT verification
│   ├── routes/
│   │   ├── auth.js        ← Login, register, /me
│   │   ├── projects.js    ← CRUD + dashboard API
│   │   ├── contracts.js   ← Project contracts
│   │   ├── boq.js         ← BOQ items + measurements
│   │   ├── raBills.js     ← RA bill CRUD + certify/pay
│   │   ├── analytics.js   ← Charts data endpoints
│   │   ├── import.js      ← Excel upload + import pipeline
│   │   ├── investors.js   ← Investors + investments
│   │   ├── expenses.js    ← Project expenses
│   │   ├── organizations.js
│   │   └── admin.js       ← Admin stats + users
│   ├── services/
│   │   ├── analyticsEngine.js  ← Dashboard calculations
│   │   ├── excelParser.js      ← XLSX parsing logic
│   │   └── importPipeline.js   ← Atomic import transaction
│   ├── db.js              ← MySQL connection pool
│   ├── server.js          ← Express app entry point
│   └── .env               ← Environment variables
└── frontend/
    └── src/
        ├── api/axios.js   ← Axios with JWT interceptor
        ├── components/
        │   ├── Sidebar.jsx
        │   ├── KPICard.jsx  (+ fmt, fmtFull, fmtNum exports)
        │   ├── BOQTable.jsx
        │   ├── RABillSummary.jsx
        │   ├── ProgressDonut.jsx
        │   └── SandwichView.jsx
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── Dashboard.jsx       ← All projects summary
        │   ├── ProjectsList.jsx    ← Project card grid
        │   ├── CreateProject.jsx
        │   ├── ProjectDashboard.jsx ← Per-project KPIs
        │   ├── BOQPage.jsx         ← BOQ with measurement drill-down
        │   ├── RABillsList.jsx
        │   ├── RABillDetail.jsx    ← Abstract, Items, Measurements tabs
        │   ├── AnalyticsPage.jsx
        │   ├── CashFlowPage.jsx
        │   ├── InvestorPage.jsx
        │   ├── ExpensesPage.jsx    ← Per-project expenses
        │   ├── ImportPage.jsx      ← 3-step Excel import wizard
        │   ├── OrganizationsPage.jsx
        │   └── AdminPanel.jsx
        ├── App.jsx        ← Routes + Auth context
        └── index.css      ← Design system (dark theme)
```

---

## Excel Import Format (TKTR-NIP Structure)

Supported sheet names:
- `Abstract` — Project info + financial summary
- `BOQ` — Bill of quantities (82 items, cols A–M)
- `10`, `20`, `30`... — Measurement sheets per BOQ item
- `Non BOQ` — Extra items beyond original scope
- `*-Actual` — Actual measurement verification

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login |
| GET | `/api/projects` | All projects |
| GET | `/api/projects/:id/dashboard` | Dashboard data |
| GET | `/api/projects/:id/boq` | BOQ items |
| GET | `/api/projects/:id/ra-bills` | RA bills list |
| GET | `/api/ra-bills/:id` | RA bill detail |
| GET | `/api/ra-bills/:id/measurements` | Measurements |
| POST | `/api/import/preview` | Preview Excel |
| POST | `/api/import/ra-bill` | Confirm import |
| GET | `/api/analytics/project/:id` | Analytics data |
| GET | `/api/analytics/project/:id/cashflow` | Cash flow |
| GET | `/api/projects/:id/expenses` | Expenses |
| POST | `/api/projects/:id/expenses` | Add expense |
| GET | `/api/projects/:id/investments` | Investments |
| POST | `/api/investors` | Create investor |
