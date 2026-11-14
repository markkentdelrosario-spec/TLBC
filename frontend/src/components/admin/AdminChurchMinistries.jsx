import { useCallback, useEffect, useState } from 'react';
import { apiRequest, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-emerald-900';
const ministries = [
  { slug: 'worship-ministry', name: 'Worship Ministry', accent: 'border-amber-300' },
  { slug: 'media-team-ministry', name: 'Media Team Ministry', accent: 'border-cyan-400' },
  { slug: 'audio-team-ministry', name: 'Audio Team Ministry', accent: 'border-violet-400' },
  { slug: 'youth-ministry', name: 'Youth Ministry', accent: 'border-rose-400' },
  { slug: 'small-groups', name: 'Small Groups', accent: 'border-emerald-400' },
];

export default function AdminChurchMinistries({ getIdToken, apiBaseUrl = '/api' }) {
  const { showToast } = useToast();
  const [descriptions, setDescriptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingSlug, setSavingSlug] = useState('');

  const loadMinistries = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest('/ministries/admin', { getIdToken, apiBaseUrl });
      setDescriptions(
        Object.fromEntries(
          (result.ministries || []).map((ministry) => [
            ministry.slug,
            ministry.description || '',
          ])
        )
      );
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, getIdToken, showToast]);

  useEffect(() => {
    loadMinistries();
  }, [loadMinistries]);

  async function saveDescription(slug) {
    setSavingSlug(slug);
    try {
      await apiRequest(`/ministries/${slug}`, {
        getIdToken,
        apiBaseUrl,
        method: 'PATCH',
        body: JSON.stringify({ description: descriptions[slug] || '' }),
      });
      showToast('Ministry information saved.', 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSavingSlug('');
    }
  }

  return (
    <section id="church-ministries-management" className="mt-8 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <header className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Public website</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">Church ministries</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-300">
          Add visitor-friendly descriptions for the five church ministries. These descriptions appear publicly at <code>/ministries</code>; member rosters and internal team data stay private.
        </p>
      </header>
      {loading ? (
        <p role="status" className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-slate-800">Loading ministries…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ministries.map((ministry) => (
            <article key={ministry.slug} className={`rounded-xl border border-slate-200 border-l-4 ${ministry.accent} p-4 dark:border-slate-700`}>
              <label className="block text-sm font-bold text-slate-900 dark:text-slate-100">
                {ministry.name}
                <textarea
                  maxLength={1200}
                  rows={4}
                  className={inputClass}
                  placeholder="Describe what this ministry does and how someone can get involved."
                  value={descriptions[ministry.slug] || ''}
                  onChange={(event) =>
                    setDescriptions((current) => ({
                      ...current,
                      [ministry.slug]: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">{(descriptions[ministry.slug] || '').length}/1200</span>
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                  disabled={savingSlug === ministry.slug}
                  onClick={() => saveDescription(ministry.slug)}
                >
                  {savingSlug === ministry.slug ? 'Saving…' : 'Save description'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
