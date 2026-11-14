import { useState } from 'react';
import { Link } from 'react-router-dom';

const links = [
  { label: 'Home', to: '/' },
  { label: 'Events', to: '/events' },
  { label: 'Ministries', to: '/ministries' },
  { label: 'About', to: '/#about-us' },
  { label: 'Visit Us', to: '/#connect-with-us' },
];

export default function PublicSiteNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 text-white shadow-lg shadow-slate-950/10 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="The Life Builder Church home">
          <img
            src="/images/logo/Logo.jpg"
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/30"
          />
          <span className="truncate text-sm font-bold tracking-wide sm:text-base">
            The Life Builder Church
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-full px-3 py-2 text-sm font-semibold text-emerald-50/90 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/login"
            className="ml-2 rounded-full bg-amber-200 px-4 py-2 text-sm font-bold text-emerald-950 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-white"
          >
            Sign in
          </Link>
        </nav>

        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/20 text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-200 lg:hidden"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="public-mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" className="text-xl">{menuOpen ? '×' : '☰'}</span>
        </button>
      </div>

      {menuOpen && (
        <nav
          id="public-mobile-navigation"
          aria-label="Mobile navigation"
          className="border-t border-white/10 px-4 py-3 lg:hidden sm:px-8"
        >
          <div className="mx-auto grid max-w-7xl gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-emerald-50 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-200"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-amber-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              Sign in
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
