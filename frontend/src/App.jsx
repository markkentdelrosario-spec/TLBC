import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminUserManagementDashboard from './components/admin/AdminUserManagementDashboard';
import BeneficiaryDashboard from './components/beneficiary/BeneficiaryDashboard';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LifeCoachQrScanner from './components/lifecoach/LifeCoachQrScanner';
import PastorDashboard from './components/pastor/PastorDashboard';
import FullLeaderboardsPage from './components/attendance/FullLeaderboardsPage';
import { AuthProvider, getRoleHomePath, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status">Loading your account…</p>
      </main>
    );
  }
  return <Navigate to={getRoleHomePath(user?.role)} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route
                path="/scanner"
                element={
                  <DashboardWithToken>
                    {(getIdToken) => (
                      <LifeCoachQrScanner
                        getIdToken={getIdToken}
                        apiBaseUrl={apiBaseUrl}
                      />
                    )}
                  </DashboardWithToken>
                }
              />
              <Route
                path="/admin"
                element={
                  <DashboardWithToken>
                    {(getIdToken) => (
                      <AdminUserManagementDashboard
                        getIdToken={getIdToken}
                        apiBaseUrl={apiBaseUrl}
                      />
                    )}
                  </DashboardWithToken>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <DashboardWithToken>
                    {(getIdToken) => (
                      <AdminUserManagementDashboard
                        getIdToken={getIdToken}
                        apiBaseUrl={apiBaseUrl}
                      />
                    )}
                  </DashboardWithToken>
                }
              />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['admin', 'member']} />}>
              <Route
                path="/leaderboards"
                element={
                  <DashboardWithToken>
                    {(getIdToken) => (
                      <FullLeaderboardsPage
                        getIdToken={getIdToken}
                        apiBaseUrl={apiBaseUrl}
                      />
                    )}
                  </DashboardWithToken>
                }
              />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['pastor']} />}>
              <Route
                path="/pastor"
                element={
                  <DashboardWithToken>
                    {(getIdToken) => (
                      <PastorDashboard
                        getIdToken={getIdToken}
                        apiBaseUrl={apiBaseUrl}
                      />
                    )}
                  </DashboardWithToken>
                }
              />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['member']} />}>
              <Route
                path="/member"
                element={
                  <DashboardWithToken>
                    {(getIdToken) => (
                      <BeneficiaryDashboard
                        getIdToken={getIdToken}
                        apiBaseUrl={apiBaseUrl}
                      />
                    )}
                  </DashboardWithToken>
                }
              />
              <Route
                path="/beneficiary"
                element={
                  <DashboardWithToken>
                    {(getIdToken) => (
                      <BeneficiaryDashboard
                        getIdToken={getIdToken}
                        apiBaseUrl={apiBaseUrl}
                      />
                    )}
                  </DashboardWithToken>
                }
              />
              <Route
                path="/profile"
                element={
                  <DashboardWithToken>
                    {(getIdToken) => (
                      <BeneficiaryDashboard
                        getIdToken={getIdToken}
                        apiBaseUrl={apiBaseUrl}
                      />
                    )}
                  </DashboardWithToken>
                }
              />
            </Route>
            <Route path="*" element={<HomeRedirect />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

function DashboardWithToken({ children }) {
  const { getIdToken } = useAuth();
  return children(getIdToken);
}
