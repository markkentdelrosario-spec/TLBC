import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { getRoleHomePath, useAuth } from '../../context/AuthContext';
import { getDesignations, hasDesignation } from '../../utils/designations';

const roleNavigation = {
  pastor: [{ to: '/pastor', label: 'Pastor dashboard' }],
  member: [{ to: '/profile', label: 'Member dashboard' }],
};

export default function ProtectedRoute({
  allowedRoles,
  requiredDesignation,
  requiredDesignations,
  requireSecondaryDesignation = false,
  children,
}) {
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p role="status" className="text-sm font-medium text-slate-600">
          Checking your account…
        </p>
      </main>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }
  if (
    (requiredDesignation && !hasDesignation(user, requiredDesignation)) ||
    (requiredDesignations?.length &&
      !requiredDesignations.some((designation) => hasDesignation(user, designation)))
  ) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }
  if (
    requireSecondaryDesignation &&
    user.role === 'member' &&
    getDesignations(user).length === 0
  ) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  const links = [...(roleNavigation[user.role] || [])];
  return (
    <div className="min-h-screen">
      <header className="relative z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            {user.profilePicture ? (
              <img
                src={user.profilePicture}
                alt=""
                className="h-10 w-10 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-900 text-sm font-bold text-white">
                TL
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-900">
                The Life Builder Church
              </span>
              <span className="block truncate text-xs capitalize text-slate-500">
                {user.name || user.displayName} · {user.role.replace('_', ' ')}
              </span>
            </span>
          </Link>

          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 sm:hidden"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" className="text-xl">{menuOpen ? '×' : '☰'}</span>
          </button>

          <div className="hidden items-center gap-2 sm:flex">
            <nav className="flex items-center gap-2" aria-label="Main navigation">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    location.pathname === link.to
                      ? 'bg-emerald-50 text-emerald-900'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {location.pathname === '/scanner' && (
              <button
                type="button"
                onClick={logout}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                Log Out
              </button>
            )}
          </div>
        </div>
        <nav
          aria-label="Mobile navigation"
          aria-hidden={!menuOpen}
          inert={!menuOpen}
          className={`absolute left-0 right-0 top-full overflow-hidden border-b border-slate-200 bg-white shadow-lg transition-all duration-300 ease-in-out motion-reduce:transition-none sm:hidden ${
            menuOpen
              ? 'max-h-[80vh] translate-y-0 p-3 opacity-100'
              : 'pointer-events-none max-h-0 -translate-y-2 p-0 opacity-0'
          }`}
        >
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="min-h-12 rounded-lg px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-emerald-50"
                >
                  {link.label}
                </Link>
              ))}
              {location.pathname === '/scanner' && (
                <button
                  type="button"
                  onClick={logout}
                  className="min-h-12 rounded-lg px-4 py-3 text-left text-sm font-semibold text-orange-600 hover:bg-orange-50"
                >
                  Log Out
                </button>
              )}
            </div>
        </nav>
      </header>
      {children || <Outlet />}
    </div>
  );
}
