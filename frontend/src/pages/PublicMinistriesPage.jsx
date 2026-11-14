import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicSiteNav from '../components/layout/PublicSiteNav';
import { apiBaseUrl } from '../config/api';

const ministryStyles = [
  { slug: 'worship-ministry', icon: '♫', accent: 'from-amber-300 to-orange-400', label: 'Worship', textColor: 'text-orange-700' },
  { slug: 'media-team-ministry', icon: '▣', accent: 'from-cyan-300 to-blue-500', label: 'Media', textColor: 'text-sky-700' },
  { slug: 'audio-team-ministry', icon: '◖', accent: 'from-violet-300 to-indigo-500', label: 'Audio', textColor: 'text-violet-700' },
  { slug: 'youth-ministry', icon: '✦', accent: 'from-rose-300 to-pink-500', label: 'Youth', textColor: 'text-pink-700' },
  { slug: 'small-groups', icon: '⌂', accent: 'from-emerald-300 to-teal-500', label: 'Community', textColor: 'text-teal-700' },
];

const headingText = 'Grow together, serve together';
const TYPEWRITER_INTERVAL_MS = 85;
const TYPEWRITER_PAUSE_MS = 2200;
const TYPEWRITER_DELETE_INTERVAL_MS = 45;

export default function PublicMinistriesPage() {
  const [ministries, setMinistries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [headingAnimation, setHeadingAnimation] = useState({
    characters: 0,
    phase: 'typing',
  });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (
        headingAnimation.phase !== 'complete' ||
        headingAnimation.characters !== headingText.length
      ) {
        setHeadingAnimation({ characters: headingText.length, phase: 'complete' });
      }
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setHeadingAnimation((animation) => {
        if (animation.phase === 'pause') {
          return { ...animation, phase: 'deleting' };
        }

        if (animation.phase === 'typing') {
          const characters = animation.characters + 1;
          return {
            characters,
            phase: characters === headingText.length ? 'pause' : 'typing',
          };
        }

        const characters = animation.characters - 1;
        return {
          characters,
          phase: characters === 0 ? 'typing' : 'deleting',
        };
      });
    }, headingAnimation.phase === 'pause'
      ? TYPEWRITER_PAUSE_MS
      : headingAnimation.phase === 'deleting'
        ? TYPEWRITER_DELETE_INTERVAL_MS
        : TYPEWRITER_INTERVAL_MS);

    return () => window.clearTimeout(timeoutId);
  }, [headingAnimation]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadMinistries() {
      try {
        const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/ministries`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'Unable to load church ministries.');
        }
        setMinistries(Array.isArray(payload.ministries) ? payload.ministries : []);
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError(loadError.message || 'Unable to load church ministries.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadMinistries();
    return () => controller.abort();
  }, []);

  return (
    <main className="public-site-page min-h-screen bg-[#f4f7f5] text-slate-900">
      <PublicSiteNav />
      <section className="relative isolate overflow-hidden bg-slate-950 px-4 py-16 text-white sm:px-8 sm:py-24">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,.3),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(251,191,36,.13),transparent_42%)]" />
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-200">Find your place</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
            There’s room for you to <span className="font-serif italic text-emerald-200">belong and serve.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
            Discover the ministries and communities that help The Life Builder Church grow in faith, fellowship, and service.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16">
        {loading ? (
          <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-700">Loading ministries…</p>
        ) : error ? (
          <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800">{error}</p>
        ) : (
          <>
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Our ministries</p>
                <h2
                  aria-label={headingText}
                  className="mt-2 min-h-[1.25em] text-3xl font-bold tracking-tight text-yellow-700 sm:text-4xl"
                >
                  <span aria-hidden="true">
                    {headingText.slice(0, headingAnimation.characters)}
                    {headingAnimation.phase !== 'complete' && (
                      <span className="ml-1 inline-block h-[0.85em] w-0.5 translate-y-1 animate-pulse bg-yellow-700 motion-reduce:animate-none" />
                    )}
                  </span>
                </h2>
              </div>
              <p className="max-w-lg text-sm leading-6 text-slate-700">
                Whether you’re exploring church for the first time or ready to get involved, we’d love to help you find a next step.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ministries.map((ministry, index) => {
                const style = ministryStyles.find((item) => item.slug === ministry.slug)
                  || ministryStyles[index % ministryStyles.length];
                return (
                  <Link
                    key={ministry.slug}
                    to="/login"
                    aria-label={`Sign in to learn more about ${ministry.name}`}
                    className="block rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-4"
                  >
                    <article className="group relative h-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-7">
                      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${style.accent}`} />
                      <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${style.accent} text-2xl font-bold text-white shadow-lg`}>
                        <span aria-hidden="true">{style.icon}</span>
                      </div>
                      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-800">{style.label}</p>
                      <h3 className={`mt-1 text-xl font-bold tracking-tight ${style.textColor}`}>{ministry.name}</h3>
                      <p className="mt-3 min-h-12 whitespace-pre-line text-sm leading-6 text-slate-700">
                        {ministry.description || 'More information is coming soon. Contact the church to learn how to get involved.'}
                      </p>
                      <span className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-emerald-800 underline decoration-emerald-300 underline-offset-4 transition group-hover:text-emerald-950">
                        Sign in to learn more <span aria-hidden="true">→</span>
                      </span>
                    </article>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="border-y border-emerald-900/10 bg-emerald-950 px-4 py-12 text-center text-white sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">Take a next step</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-2xl font-bold sm:text-3xl">We’d be glad to help you get connected.</h2>
        <Link to="/#join-us" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-amber-200 px-6 py-3 text-sm font-bold text-emerald-950 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-white">
          Connect with us
        </Link>
      </section>
    </main>
  );
}
