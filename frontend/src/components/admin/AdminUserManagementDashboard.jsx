import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import ChurchDashboardShell from '../layout/ChurchDashboardShell';
import AdminSlideshowManagement from './AdminSlideshowManagement';
import FullLeaderboardsPage from '../attendance/FullLeaderboardsPage';
import { getDesignations } from '../../utils/designations';
import { useAuth } from '../../context/AuthContext';
import ConfirmationModal from '../shared/ConfirmationModal';
import AdminPublicEvents from './AdminPublicEvents';
import AdminChurchMinistries from './AdminChurchMinistries';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'pastor', label: 'Pastor' },
  { value: 'member', label: 'Member' },
];
const SECONDARY_DESIGNATIONS = [
  'KSP Leader',
  'Youth Leader',
  'Worship Leader',
  'Small Group Leader',
  'Audio Team Leader',
  'Media Team Leader',
  'Admin Team Leader',
  'Worship Team Member',
  'Media Team Member',
];

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-emerald-900';
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
  const { showToast } = useToast();
  const { user: currentUser, updateUserProfile, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [designationMenuUserId, setDesignationMenuUserId] = useState('');
  const [expandedUserId, setExpandedUserId] = useState('');
  const [userTab, setUserTab] = useState('active');
  const [showLeaderboardReset, setShowLeaderboardReset] = useState(false);
  const [resettingLeaderboard, setResettingLeaderboard] = useState(false);
  const [leaderboardResetKey, setLeaderboardResetKey] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
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
                secondaryDesignations: getDesignations(user),
                birthDate: user.birthDate ? user.birthDate.slice(0, 10) : '',
              },
            ];
          })
        )
      );
    } catch (loadError) {
      showToast(getErrorMessage(loadError), 'error');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, getIdToken, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    window.addEventListener('tlbc:profile-updated', loadData);
    return () => window.removeEventListener('tlbc:profile-updated', loadData);
  }, [loadData]);

  const visibleUsers = useMemo(() => {
    const usersForTab = users.filter((user) => {
      if (userTab === 'pending') return !user.isVerified;
      if (userTab === 'deactivated') return user.isVerified && !user.isActive;
      return user.isVerified && user.isActive;
    });
    const term = search.trim().toLowerCase();
    if (!term) return usersForTab;
    return usersForTab.filter((user) =>
      [user.displayName, user.email, user.phoneNumber]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [search, userTab, users]);

  function updateDraft(userId, key, value) {
    setDrafts((current) => ({
      ...current,
      [userId]: { ...current[userId], [key]: value },
    }));
  }

  async function saveUser(user) {
    const userId = getUserId(user);
    const draft = drafts[userId];
    if (!draft) return;
    setSavingId(userId);
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

      const nextDesignations = ['member', 'admin'].includes(draft.role)
        ? getDesignations(draft.secondaryDesignations)
        : [];
      const designationResult = await apiRequest(
        `/admin/users/${userId}/secondary-designation`,
        {
          getIdToken,
          apiBaseUrl,
          method: 'PATCH',
          body: JSON.stringify({ secondaryDesignations: nextDesignations }),
        }
      );
      const updatedUser = designationResult.user;
      setUsers((current) =>
        current.map((item) =>
          String(getUserId(item)) === String(userId)
            ? {
                ...item,
                ...updatedUser,
                role: updatedUser.role,
                secondaryDesignations: updatedUser.secondaryDesignations,
              }
            : item
        )
      );
      if (String(getUserId(currentUser || {})) === String(userId)) {
        updateUserProfile({
          ...currentUser,
          ...updatedUser,
          name: updatedUser.displayName,
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

      showToast(`Updated ${user.displayName || user.email}.`, 'success');
      await loadData();
    } catch (saveError) {
      showToast(getErrorMessage(saveError), 'error');
    } finally {
      setSavingId('');
    }
  }

  async function toggleUserStatus(user) {
    const userId = getUserId(user);
    const isActive = !user.isActive;
    const isCurrentUser =
      String(getUserId(currentUser || {})) === String(userId);
    setSavingId(userId);
    try {
      await apiRequest(`/admin/users/${userId}/status`, {
        getIdToken,
        apiBaseUrl,
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      showToast(
        `${user.displayName || user.email} account ${isActive ? 'activated' : 'deactivated'}.`,
        'success'
      );
      if (!isActive && isCurrentUser) {
        setSavingId('');
        await logout();
        return;
      }
      await loadData();
    } catch (statusError) {
      showToast(getErrorMessage(statusError), 'error');
    } finally {
      if (isActive || !isCurrentUser) setSavingId('');
    }
  }

  async function resetLeaderboard() {
    setShowLeaderboardReset(false);
    setResettingLeaderboard(true);
    try {
      await apiRequest('/admin/leaderboard/reset', {
        getIdToken,
        apiBaseUrl,
        method: 'POST',
      });
      setLeaderboardResetKey((current) => current + 1);
      showToast('Leaderboard reset. New attendance will count toward rankings.', 'success');
    } catch (resetError) {
      showToast(getErrorMessage(resetError), 'error');
    } finally {
      setResettingLeaderboard(false);
    }
  }

  return (
    <ChurchDashboardShell getIdToken={getIdToken} apiBaseUrl={apiBaseUrl}>
    <div className="min-h-screen px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
              The Life Builder Church
            </p>
            <h1 id="user-management" className="mt-2 scroll-mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
              User management
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Assign system roles and member designations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="#public-events-management" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-slate-800">
              Manage events
            </a>
            <a href="#church-ministries-management" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-slate-800">
              Manage ministries
            </a>
            <button className={buttonClass} onClick={loadData} disabled={loading}>
              {loading ? 'Loading accounts…' : 'Refresh accounts'}
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-lg font-bold">Registered accounts</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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

          <div
            className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-6"
            role="group"
            aria-label="Filter users by account status"
          >
            {[
              { id: 'active', label: 'Active Users', count: users.filter((user) => user.isVerified && user.isActive).length },
              { id: 'deactivated', label: 'Deactivated Users', count: users.filter((user) => user.isVerified && !user.isActive).length },
              { id: 'pending', label: 'Pending Verification', count: users.filter((user) => !user.isVerified).length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={userTab === tab.id}
                onClick={() => setUserTab(tab.id)}
                className={`min-h-10 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  userTab === tab.id
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label} <span className="ml-1 opacity-80">({tab.count})</span>
              </button>
            ))}
          </div>

          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading registered accounts…</p>
          ) : visibleUsers.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No accounts found.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleUsers.map((user) => {
                const userId = getUserId(user);
                const draft = drafts[userId] || {};
                const canAssignDesignations = ['member', 'admin'].includes(draft.role);
                return (
                  <details
                    open={expandedUserId === userId}
                    onToggle={(event) =>
                      setExpandedUserId(event.currentTarget.open ? userId : '')
                    }
                    className={`relative min-w-0 ${designationMenuUserId === userId ? 'z-30' : ''}`}
                    key={userId}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 dark:hover:bg-slate-800 sm:px-6">
                      <span className="flex min-w-0 items-center gap-3">
                        {user.profilePicture || user.profilePhoto?.url ? (
                          <img
                            src={user.profilePicture || user.profilePhoto.url}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                            {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{user.displayName || 'Unnamed account'}</span>
                          <span className="mt-1 block truncate text-sm text-slate-500">{user.email}</span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                        <span className="hidden sm:inline">{ROLES.find((role) => role.value === getSystemRole(user))?.label || 'Member'} · {getDesignations(user).length} designation{getDesignations(user).length === 1 ? '' : 's'}</span>
                        <span className={`rounded-full px-2 py-1 font-semibold ${
                          !user.isVerified
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                            : user.isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        }`}>
                          {!user.isVerified ? 'Pending' : user.isActive ? 'Active' : 'Deactivated'}
                        </span>
                        <span aria-hidden="true">{expandedUserId === userId ? '−' : '+'}</span>
                      </span>
                    </summary>

                    <div className="grid min-w-0 grid-cols-1 gap-4 border-t border-slate-100 p-4 dark:border-slate-800 sm:p-6 md:grid-cols-2 xl:grid-cols-[minmax(8rem,.9fr)_minmax(9rem,1.2fr)_minmax(7.5rem,.9fr)_auto_auto] xl:items-end xl:gap-2.5 xl:p-3">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
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

                    <fieldset
                      disabled={!canAssignDesignations}
                      className="min-w-0 text-xs font-semibold text-slate-600 disabled:opacity-60 dark:text-slate-300"
                    >
                      <legend>Secondary designations</legend>
                      <details
                        className="designation-dropdown group relative mt-1"
                        onToggle={(event) =>
                          setDesignationMenuUserId(
                            event.currentTarget.open ? userId : ''
                          )
                        }
                      >
                        <summary className={`${inputClass} flex min-h-10 cursor-pointer list-none items-center justify-between`}>
                          <span className="truncate">
                            {draft.secondaryDesignations?.length
                              ? `${draft.secondaryDesignations.length} selected`
                              : 'None assigned'}
                          </span>
                          <span aria-hidden="true">⌄</span>
                        </summary>
                        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                          {[
                            ...SECONDARY_DESIGNATIONS,
                            ...(draft.secondaryDesignations || []).filter(
                              (designation) =>
                                !SECONDARY_DESIGNATIONS.includes(designation)
                            ),
                          ].map((designation) => (
                            <label
                              key={designation}
                              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs hover:bg-emerald-50 dark:hover:bg-slate-800"
                            >
                              <input
                                type="checkbox"
                                checked={(draft.secondaryDesignations || []).includes(designation)}
                                onChange={(event) => {
                                  const current = draft.secondaryDesignations || [];
                                  updateDraft(
                                    userId,
                                    'secondaryDesignations',
                                    event.target.checked
                                      ? [...current, designation]
                                      : current.filter((value) => value !== designation)
                                  );
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                              />
                              <span>{designation}{!SECONDARY_DESIGNATIONS.includes(designation) ? ' (legacy)' : ''}</span>
                            </label>
                          ))}
                          {(draft.secondaryDesignations || []).length > 0 && (
                            <button
                              type="button"
                              onClick={() => updateDraft(userId, 'secondaryDesignations', [])}
                              className="mt-1 min-h-9 w-full rounded-lg px-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950"
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                      </details>
                    </fieldset>

                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
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
                    {user.isVerified && (
                      <button
                        type="button"
                        className={`inline-flex min-h-10 items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          user.isActive
                            ? 'border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950'
                            : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950'
                        }`}
                        disabled={savingId === userId}
                        onClick={() => toggleUserStatus(user)}
                      >
                        {savingId === userId
                          ? 'Updating…'
                          : user.isActive
                            ? 'Deactivate account'
                            : 'Activate account'}
                      </button>
                    )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
        <div className="mb-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Attendance leaderboard</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Reset rankings for a new cycle without removing historical attendance records.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setShowLeaderboardReset(true)}
            disabled={resettingLeaderboard}
          >
            {resettingLeaderboard ? 'Resetting…' : 'Reset leaderboard'}
          </button>
        </div>
        <FullLeaderboardsPage
          getIdToken={getIdToken}
          apiBaseUrl={apiBaseUrl}
          embedded
          resetKey={leaderboardResetKey}
        />
        <AdminPublicEvents getIdToken={getIdToken} apiBaseUrl={apiBaseUrl} />
        <AdminChurchMinistries getIdToken={getIdToken} apiBaseUrl={apiBaseUrl} />
        <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Leaders can view their assigned group roster and upload ministry media. Attendance QR scanning is reserved for Admins.
        </p>
        <AdminSlideshowManagement getIdToken={getIdToken} apiBaseUrl={apiBaseUrl} />
      </div>
      <ConfirmationModal
        open={showLeaderboardReset}
        title="Reset the attendance leaderboard?"
        message="This clears the current rankings by starting a new scoring period. Historical attendance records and reports will remain unchanged."
        confirmText="Reset leaderboard"
        onConfirm={resetLeaderboard}
        onCancel={() => setShowLeaderboardReset(false)}
      />
    </div>
    </ChurchDashboardShell>
  );
}
