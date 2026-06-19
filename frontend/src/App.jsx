import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import './index.css';

// Pages
import LoginPage         from './pages/LoginPage';
import Dashboard         from './pages/Dashboard';
import ProjectDashboard  from './pages/ProjectDashboard';
import BOQPage           from './pages/BOQPage';
import RABillsList       from './pages/RABillsList';
import RABillDetail      from './pages/RABillDetail';
import AnalyticsPage     from './pages/AnalyticsPage';
import CashFlowPage      from './pages/CashFlowPage';
import InvestorPage      from './pages/InvestorPage';
import ImportPage        from './pages/ImportPage';
import OrganizationsPage from './pages/OrganizationsPage';
import AdminPanel        from './pages/AdminPanel';
import ProjectsList      from './pages/ProjectsList';
import CreateProject     from './pages/CreateProject';
import ExpensesPage      from './pages/ExpensesPage';

// Layout
import Sidebar from './components/Sidebar';

// ── Auth Context ──────────────────────────────────────────────
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">
        {children}
      </main>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('billx_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (userData, token) => {
    localStorage.setItem('billx_token', token);
    localStorage.setItem('billx_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('billx_token');
    localStorage.removeItem('billx_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><ProjectsList /></ProtectedRoute>} />
          <Route path="/projects/new" element={<ProtectedRoute><CreateProject /></ProtectedRoute>} />
          <Route path="/projects/:id" element={<ProtectedRoute><ProjectDashboard /></ProtectedRoute>} />
          <Route path="/projects/:id/boq" element={<ProtectedRoute><BOQPage /></ProtectedRoute>} />
          <Route path="/projects/:id/ra-bills" element={<ProtectedRoute><RABillsList /></ProtectedRoute>} />
          <Route path="/projects/:id/ra-bills/:raId" element={<ProtectedRoute><RABillDetail /></ProtectedRoute>} />
          <Route path="/projects/:id/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/projects/:id/cashflow" element={<ProtectedRoute><CashFlowPage /></ProtectedRoute>} />
          <Route path="/projects/:id/investors" element={<ProtectedRoute><InvestorPage /></ProtectedRoute>} />
          <Route path="/projects/:id/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
          <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
          <Route path="/organizations" element={<ProtectedRoute><OrganizationsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
