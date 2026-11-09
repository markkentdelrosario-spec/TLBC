import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, getErrorMessage } from '../../services/api';
import ChurchDashboardShell from '../layout/ChurchDashboardShell';
import AdminSlideshowManagement from './AdminSlideshowManagement';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'pastor', label: 'Pastor' },
  { value: 'member', label: 'Member' },
];
const SECONDARY_DESIGNATIONS = [
  'KSP leader',
  'Youth Leader',
  'Music Team Leader',
  'Small Group Leader',
  'Tech Team Leader',
  'Creatives Leader',
  'Admin Team Leader',
];

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const buttonClass =
  'inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50';

function getUserId(user) {
  return user._id || user.id;
}

function getSystemRole(user) {
  return user.role === 'life_coach' || user.role === 'beneficiary'
    ? 'member'
    : user.role;
}

export default function AdminUserManagementDashboard({
  getIdToken,
  apiBaseUrl = '/api',
}) {
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const userResult = await apiRequest('/admin/users', { getIdToken, apiBaseUrl });
      const nextUsers = Array.isArray(userResult)
        ? userResult
        : userResult.users || [];
      setUsers(nextUsers);
      setDrafts(
        Object.fromEntries(
          nextUsers.map((user) => {
            return [
              getUserId(user),
              {
                role: getSystemRole(user),
                secondaryDesignation:
                  user.secondaryDesignation ||
                  (user.role === 'life_coach' ? 'Life Coach' : ''),
                birthDate: user.birthDate ? user.birthDate.slice(0, 10) : '',
              },
            ];
          })
        )
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, getIdToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.displayName, user.email, user.phoneNumber]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [search, users]);

  function updateDraft(userId, key, value) {
    setDrafts((current) => ({
      ...current,
      [userId]: { ...current[userId], [key]: value },
    }));
    setNotice('');
  }

  async function saveUser(user) {
    const userId = getUserId(user);
    const draft = drafts[userId];
    if (!draft) return;
    setSavingId(userId);
    setError('');
    setNotice('');
    try {
      const currentRole = getSystemRole(user);

      if (draft.role !== currentRole) {
        await apiRequest(`/admin/users/${userId}/role`, {
          getIdToken,
          apiBaseUrl,
          method: 'PATCH',
          body: JSON.stringify({ role: draft.role }),
        });
      }

      const currentDesignation =
        user.secondaryDesignation ||
        (user.role === 'life_coach' ? 'Life Coach' : '');
      const nextDesignation =
        draft.role === 'member' ? draft.secondaryDesignation || null : null;
      if (nextDesignation !== currentDesignation) {
        await apiRequest(`/admin/users/${userId}/secondary-designation`, {
          getIdToken,
          apiBaseUrl,
          method: 'PATCH',
          body: JSON.stringify({ secondaryDesignation: nextDesignation }),
        });
      }

      const currentBirthDate = user.birthDate ? user.birthDate.slice(0, 10) : '';
      if (draft.birthDate !== currentBirthDate) {
        await apiRequest(`/admin/users/${userId}/birth-date`, {
          getIdToken,
          apiBaseUrl,
          method: 'PATCH',
          body: JSON.stringify({ birthDate: draft.birthDate || null }),
        });
      }

      setNotice(`Updated ${user.displayName || user.email}.`);
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingId('');
    }
  }

  return (
    <ChurchDashboardShell getIdToken={getIdToken} apiBaseUrl={apiBaseUrl}>
    <div className="min-h-screen px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              The Life Builder Church
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              User management
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Assign system roles and member designations.
            </p>
          </div>
          <button className={buttonClass} onClick={loadData} disabled={loading}>
            {loading ? 'Loading accounts…' : 'Refresh accounts'}
          </button>
        </header>

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {notice}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-lg font-bold">Registered accounts</h2>
              <p className="mt-1 text-sm text-slate-500">
                {users.length} account{users.length === 1 ? '' : 's'}
              </p>
            </div>
            <label className="w-full sm:max-w-xs">
              <span className="sr-only">Search accounts</span>
              <input
                className={inputClass}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, or phone"
              />
            </label>
          </div>

          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading registered accounts…</p>
          ) : visibleUsers.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No accounts found.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleUsers.map((user) => {
                const userId = getUserId(user);
                const draft = drafts[userId] || {};
                const isMember = draft.role === 'member';
                return (
                  <article
                    className="grid min-w-0 grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-[minmax(9.5rem,1.4fr)_minmax(8rem,.9fr)_minmax(9rem,1.2fr)_minmax(7.5rem,.9fr)_auto] xl:items-end xl:gap-2.5 xl:p-3"
                    key={userId}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{user.displayName || 'Unnamed account'}</p>
                      <p className="mt-1 truncate text-sm text-slate-500">{user.email}</p>
                      {user.phoneNumber && (
                        <p className="mt-1 text-xs text-slate-500">{user.phoneNumber}</p>
                      )}
                    </div>

                    <label className="text-xs font-semibold text-slate-600">
                      System role
                      <select
                        className={inputClass}
                        value={draft.role || ''}
                        onChange={(event) => updateDraft(userId, 'role', event.target.value)}
                      >
                        {ROLES.map((role) => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-semibold text-slate-600">
                      Secondary designation
                      <select
                        className={inputClass}
                        value={draft.secondaryDesignation || ''}
                        disabled={!isMember}
                        onChange={(event) =>
                          updateDraft(userId, 'secondaryDesignation', event.target.value)
                        }
                      >
                        <option value="">None</option>
                        {draft.secondaryDesignation &&
                          !SECONDARY_DESIGNATIONS.includes(draft.secondaryDesignation) && (
                            <option value={draft.secondaryDesignation}>
                              {draft.secondaryDesignation} (legacy)
                            </option>
                          )}
                        {SECONDARY_DESIGNATIONS.map((designation) => (
                          <option key={designation} value={designation}>{designation}</option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-semibold text-slate-600">
                      Birthday
                      <input
                        type="date"
                        className={inputClass}
                        value={draft.birthDate || ''}
                        onChange={(event) =>
                          updateDraft(userId, 'birthDate', event.target.value)
                        }
                      />
                    </label>

                    <button
                      className={buttonClass}
                      disabled={savingId === userId || !draft.role}
                      onClick={() => saveUser(user)}
                    >
                      {savingId === userId ? 'Saving…' : 'Save'}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Leaders can view their assigned group roster and upload ministry media. Life Coach designation also grants attendance scanner access.
        </p>
        <AdminSlideshowManagement getIdToken={getIdToken} apiBaseUrl={apiBaseUrl} />
      </div>
    </div>
    </ChurchDashboardShell>
  );
}
