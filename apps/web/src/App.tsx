import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Spinner } from './components/ui';
import Layout from './components/Layout';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectPage from './pages/ProjectPage';
import Allocations from './pages/Allocations';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTypes from './pages/admin/AdminTypes';
import Audit from './pages/Audit';
import type { Role } from './lib/types';

function Protected({ children, roles }: { children: JSX.Element; roles?: Role[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Shell() {
  return (
    <Protected>
      <Layout />
    </Protected>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Shell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectPage />} />
            <Route path="/allocations" element={<Allocations />} />
            <Route path="/profile" element={<Profile />} />
            <Route
              path="/admin/users"
              element={<Protected roles={['pmo_admin']}><AdminUsers /></Protected>}
            />
            <Route
              path="/admin/types"
              element={<Protected roles={['pmo_admin']}><AdminTypes /></Protected>}
            />
            <Route
              path="/audit"
              element={<Protected roles={['pmo_admin']}><Audit /></Protected>}
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
