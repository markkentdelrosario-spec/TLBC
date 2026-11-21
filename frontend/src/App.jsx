import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider, getRoleHomePath, useAuth } from './context/AuthContext';
import { apiBaseUrl } from './config/api';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

const AdminUserManagementDashboard = lazy(() =>
  import('./components/admin/AdminUserManagementDashboard')
);
const BeneficiaryDashboard = lazy(() =>
  import('./components/beneficiary/BeneficiaryDashboard')
);
const LifeCoachQrScanner = lazy(() =>
  import('./components/lifecoach/LifeCoachQrScanner')
);
const KspCustomEvents = lazy(() =>
  import('./components/lifecoach/KspCustomEvents')
);
const PastorDashboard = lazy(() => import('./components/pastor/PastorDashboard'));
const FullLeaderboardsPage = lazy(() =>
  import('./components/attendance/FullLeaderboardsPage')
);
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const PublicEventsPage = lazy(() => import('./pages/PublicEventsPage'));
const PublicMinistriesPage = lazy(() => import('./pages/PublicMinistriesPage'));

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
            <Suspense
              fallback={
                <main className="flex min-h-screen items-center justify-center">
                  <p role="status">Loading page…</p>
                </main>
              }
            >
            <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/events" element={<PublicEventsPage />} />
            <Route path="/ministries" element={<PublicMinistriesPage />} />
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute allowedRoles={['member']} requiredDesignation="LIFE COACH" />}>
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
                path="/scanner/custom-events"
                element={
                  <DashboardWithToken>
                    {(getIdToken) => (
                      <KspCustomEvents
                        getIdToken={getIdToken}
                        apiBaseUrl={apiBaseUrl}
                      />
                    )}
                  </DashboardWithToken>
                }
              />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
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
            </Suspense>
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
