import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlobalFilterProvider } from './context/GlobalFilterContext';
import './styles/global.css';

import LoginPage from './pages/LoginPage';
import RequestsPage from './pages/RequestsPage';
import RequestFormPage from './pages/RequestFormPage';
import RequestDetailPage from './pages/RequestDetailPage';
import DashboardPage from './pages/DashboardPage';
import PerformanceDashboardPage from './pages/PerformanceDashboardPage';
import ManagementDashboardPage from './pages/ManagementDashboardPage';
import AdminPage from './pages/AdminPage';
import NotificationsPage from './pages/NotificationsPage';
import PlanningBoardPage from './pages/PlanningBoardPage';
import ArchivePage from './pages/ArchivePage';
import ReportsPage from './pages/ReportsPage';
import CostDashboardPage from './pages/CostDashboardPage';
import ResourceDashboardPage from './pages/ResourceDashboardPage';
import ExecutiveDashboardPage from './pages/ExecutiveDashboardPage';
import StockPage from './pages/StockPage';
import InventoryTransactionsPage from './pages/InventoryTransactionsPage';
import OnboardingPage from './pages/OnboardingPage';
import MondayImportPage from './pages/MondayImportPage';
import MaintenancePage from './pages/MaintenancePage';
import MaintenanceHistoryPage from './pages/MaintenanceHistoryPage';
import { hasRole, PRODUCTION_TECHNICIAN } from './utils/roles';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <span className="spinner" style={{ width: 36, height: 36 }}/>
    </div>
  );
  if (!user) return <Navigate to="/login" replace/>;
  if (roles && !hasRole(user.role, roles)) {
    console.warn('[Navigation] role guard redirect', {
      role: user.role,
      allowedRoles: roles,
      to: '/requests',
    });
    return <Navigate to="/requests" replace/>;
  }
  return children;
};

function RouteLogger() {
  const location = useLocation();
  useEffect(() => {
    console.log('[Navigation] route changed', {
      path: location.pathname,
      search: location.search,
    });
  }, [location.pathname, location.search]);
  return null;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to={user.role === 'requester' ? '/requests' : '/dashboard'} replace/> : <LoginPage/>
      }/>

      {/* Dashboards */}
      <Route path="/dashboard" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <DashboardPage/>
        </ProtectedRoute>
      }/>
      <Route path="/dashboard/performance" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <PerformanceDashboardPage/>
        </ProtectedRoute>
      }/>
      <Route path="/dashboard/management" element={
        <ProtectedRoute roles={['manager','administrator']}>
          <ManagementDashboardPage/>
        </ProtectedRoute>
      }/>
      <Route path="/dashboard/costs" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <CostDashboardPage/>
        </ProtectedRoute>
      }/>
      <Route path="/dashboard/resources" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <ResourceDashboardPage/>
        </ProtectedRoute>
      }/>
      <Route path="/dashboard/executive" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <ExecutiveDashboardPage/>
        </ProtectedRoute>
      }/>

      {/* Requests */}
      <Route path="/requests"     element={<ProtectedRoute><RequestsPage/></ProtectedRoute>}/>
      <Route path="/requests/new" element={
        <ProtectedRoute roles={['requester',PRODUCTION_TECHNICIAN,'administrator']}>
          <RequestFormPage/>
        </ProtectedRoute>
      }/>
      <Route path="/requests/:id"      element={<ProtectedRoute><RequestDetailPage/></ProtectedRoute>}/>
      <Route path="/requests/:id/edit" element={<ProtectedRoute><RequestFormPage/></ProtectedRoute>}/>

      {/* Planning */}
      <Route path="/planning" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <PlanningBoardPage/>
        </ProtectedRoute>
      }/>

      {/* Archive */}
      <Route path="/archive" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <ArchivePage/>
        </ProtectedRoute>
      }/>
      <Route path="/archive/monday-import" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'administrator']}>
          <MondayImportPage/>
        </ProtectedRoute>
      }/>

      {/* Maintenance */}
      <Route path="/maintenance" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <MaintenancePage/>
        </ProtectedRoute>
      }/>
      <Route path="/maintenance/history" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <MaintenanceHistoryPage/>
        </ProtectedRoute>
      }/>

      {/* Reports */}
      <Route path="/reports" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <Navigate to="/reports/requests" replace/>
        </ProtectedRoute>
      }/>
      <Route path="/reports/requests" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <ReportsPage reportType="requests"/>
        </ProtectedRoute>
      }/>
      <Route path="/reports/workload" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <ReportsPage reportType="workload"/>
        </ProtectedRoute>
      }/>
      <Route path="/reports/materials" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <ReportsPage reportType="materials"/>
        </ProtectedRoute>
      }/>
      <Route path="/reports/inventory" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <ReportsPage reportType="inventory"/>
        </ProtectedRoute>
      }/>
      <Route path="/reports/executive" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <ReportsPage reportType="executive"/>
        </ProtectedRoute>
      }/>
      <Route path="/reports/kpis" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <ReportsPage reportType="kpis"/>
        </ProtectedRoute>
      }/>
      <Route path="/reports/cost" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <ReportsPage reportType="cost"/>
        </ProtectedRoute>
      }/>
      <Route path="/reports/archive" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <ReportsPage reportType="archive"/>
        </ProtectedRoute>
      }/>
      <Route path="/reports/costs" element={<Navigate to="/reports/cost" replace/>}/>

      {/* Notifications */}
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage/></ProtectedRoute>}/>

      {/* Admin */}
      <Route path="/stock" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <StockPage/>
        </ProtectedRoute>
      }/>
      <Route path="/inventory/transactions" element={
        <ProtectedRoute roles={[PRODUCTION_TECHNICIAN,'manager','administrator']}>
          <InventoryTransactionsPage/>
        </ProtectedRoute>
      }/>

      <Route path="/onboarding" element={
        <ProtectedRoute>
          <OnboardingPage/>
        </ProtectedRoute>
      }/>

      <Route path="/admin" element={
        <ProtectedRoute roles={['administrator']}>
          <AdminPage/>
        </ProtectedRoute>
      }/>

      {/* Root redirect */}
      <Route path="/" element={
        <ProtectedRoute>
          {user?.role === 'requester'
            ? <Navigate to="/requests" replace/>
            : <Navigate to="/dashboard" replace/>
          }
        </ProtectedRoute>
      }/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GlobalFilterProvider>
        <BrowserRouter>
          <RouteLogger/>
          <AppRoutes/>
        </BrowserRouter>
      </GlobalFilterProvider>
    </AuthProvider>
  );
}
