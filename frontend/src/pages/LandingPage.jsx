import { Link } from 'react-router-dom';
import SereneBackdrop from '../components/layout/SereneBackdrop';
import { getRoleHomePath, useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <main className="relative isolate flex min-h-screen items-center overflow-hidden bg-slate-950 px-5 py-16 text-white sm:px-8">
      <SereneBackdrop />
      <div className="relative mx-auto w-full max-w-6xl">
        <div className="max-w-3xl">
          <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-emerald-50 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.9)]" />
            A community growing together in faith
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-200 sm:text-base">
            Welcome to
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            The Life Builder
            <span className="mt-2 block font-serif italic text-amber-100">
              Church
            </span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-100/85 sm:text-xl">
            A place to belong, serve, and build a life rooted in hope. We’re glad
            you’re here—let’s grow together, one step and one Sunday at a time.
          </p>
          <Link
            to={user ? getRoleHomePath(user.role) : '/login'}
            className="mt-9 inline-flex min-h-14 items-center justify-center rounded-full bg-amber-200 px-8 py-4 text-base font-bold text-emerald-950 shadow-lg shadow-amber-950/20 transition duration-300 hover:-translate-y-0.5 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-emerald-950"
          >
            {user ? 'Go to your dashboard' : 'Get Started'}
            <span aria-hidden="true" className="ml-3 text-lg">→</span>
          </Link>
        </div>

        <p className="mt-16 border-t border-white/20 pt-5 text-xs tracking-wide text-emerald-50/70 sm:text-sm">
          THE LIFE BUILDER CHURCH <span className="mx-2">·</span> Faith, fellowship, and service
        </p>
      </div>
    </main>
  );
}
