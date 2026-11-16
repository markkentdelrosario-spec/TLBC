import { lazy, Suspense, useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
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

function NativePushNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let active = true;
    let listener;
    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      ({ notification }) => {
        const path = notification?.data?.url;
        if (typeof path !== 'string') return;
        let target;
        try {
          target = new URL(path, window.location.origin);
        } catch (error) {
          console.error('Ignoring a push notification with an invalid destination.', error);
          return;
        }
        if (target.origin !== window.location.origin) return;
        navigate(`${target.pathname}${target.search}${target.hash}`);
      }
    )
      .then((registeredListener) => {
        if (active) listener = registeredListener;
        else registeredListener.remove().catch((error) => {
          console.error('Unable to remove the native push action listener.', error);
        });
      })
      .catch((error) => {
        if (active) console.error('Unable to listen for native push actions.', error);
      });

    return () => {
      active = false;
      listener?.remove().catch((error) => {
        console.error('Unable to remove the native push action listener.', error);
      });
    };
  }, [navigate]);

  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <NativePushNavigation />
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
