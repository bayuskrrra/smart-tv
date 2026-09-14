import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Layout & pages
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AssetManagement from './pages/admin/AssetManagement';
import LoanApproval from './pages/admin/LoanApproval';
import HandoverPage from './pages/admin/HandoverPage';
import ReportsPage from './pages/admin/ReportsPage';
import SchedulePage from './pages/SchedulePage';

function ProtectedAdminLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Memuat...
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Admin Authenticated routes */}
            <Route element={<ProtectedAdminLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/schedule" element={<SchedulePage />} />
              <Route path="/admin/assets" element={<AssetManagement />} />
              <Route path="/admin/loans" element={<LoanApproval />} />
              <Route path="/admin/handover" element={<HandoverPage />} />
              <Route path="/admin/reports" element={<ReportsPage />} />

              {/* Alias / Redirects */}
              <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/schedule" element={<Navigate to="/admin/schedule" replace />} />
              <Route path="/loans" element={<Navigate to="/admin/loans" replace />} />
              <Route path="/loans/new" element={<Navigate to="/admin/loans" replace />} />
            </Route>

            {/* Fallbacks */}
            <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}
