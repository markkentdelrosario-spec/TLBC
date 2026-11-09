import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SereneBackdrop from '../components/layout/SereneBackdrop';
import { getRoleHomePath, useAuth } from '../context/AuthContext';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
const inputClass =
  'mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-base outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';
const primaryButtonClass =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-base font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const socialButtonClass =
  'flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

function getLoginError(error) {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'The email or password is incorrect.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Choose a password with at least 8 characters.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Please sign in.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Please wait and try again.';
    case 'auth/popup-closed-by-user':
      return 'The sign-in window was closed before finishing.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email. Sign in using its original method.';
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'This sign-in provider is not configured in Firebase. Enable Google or Facebook in Firebase Authentication settings.';
    case 'auth/unauthorized-domain':
      return 'This website domain is not authorized for Firebase sign-in.';
    case 'auth/invalid-api-key':
      return 'The Firebase API key is invalid. Check this Firebase project configuration.';
    case 'auth/network-request-failed':
      return 'A network error interrupted sign-in. Check your connection and retry.';
    default:
      return error instanceof Error ? error.message : 'Sign-in failed. Please try again.';
  }
}

async function registrationRequest(path, body) {
  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, '')}${path}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || `Request failed with status ${response.status}.`);
  }
  return payload;
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

export default function Login() {
  const navigate = useNavigate();
  const {
    user,
    loading,
    authError,
    loginWithEmail,
    loginWithGoogle,
    loginWithFacebook,
    finishCustomTokenSignIn,
  } = useAuth();
  const [mode, setMode] = useState('signin');
  const [registrationStep, setRegistrationStep] = useState('details');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (user?.role) navigate(getRoleHomePath(user.role), { replace: true });
  }, [navigate, user]);

  async function submitLogin(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const profile = await loginWithEmail(email.trim(), password);
      navigate(getRoleHomePath(profile.role), { replace: true });
    } catch (loginError) {
      setError(getLoginError(loginError));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitProviderLogin(login) {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const profile = await login();
      navigate(getRoleHomePath(profile.role), { replace: true });
    } catch (loginError) {
      setError(getLoginError(loginError));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendRegistrationCode(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!/^[^\s@]+@gmail\.com$/i.test(email.trim())) {
      setError('Use a valid Gmail address ending in @gmail.com.');
      return;
    }
    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await registrationRequest('/auth/registration-code', {
        name: name.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
      });
      setRegistrationStep('code');
      setNotice(result.message);
    } catch (requestError) {
      setError(getLoginError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function completeRegistration(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const result = await registrationRequest('/auth/complete-registration', {
        email: email.trim(),
        code: code.trim(),
        password,
      });
      const profile = await finishCustomTokenSignIn(result.customToken);
      navigate(getRoleHomePath(profile.role), { replace: true });
    } catch (requestError) {
      setError(getLoginError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  function chooseMode(nextMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
    if (nextMode === 'signup') setRegistrationStep('details');
  }

  const disabled = submitting || loading;

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-x-hidden bg-slate-950 px-3 py-6 sm:px-6 sm:py-10">
      <SereneBackdrop />
      <section className="relative my-auto w-full max-w-md rounded-3xl border border-white/25 bg-white/90 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl transition duration-300 sm:p-9">
        <Link
          to="/"
          className="mb-6 inline-flex min-h-10 items-center text-sm font-medium text-emerald-900 transition hover:text-emerald-700"
        >
          <span aria-hidden="true" className="mr-2">←</span> Back to home
        </Link>
        <header className="mb-7 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-900 text-lg font-black text-amber-100 shadow-lg">
            TL
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">
            The Life Builder Church
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {mode === 'signup'
              ? registrationStep === 'code'
                ? `Enter the code sent to ${email}.`
                : 'Sign up with your Gmail address to join the church community.'
              : 'Sign in to The Life Builder Church.'}
          </p>
        </header>

        {(error || authError) && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800"
          >
            {error || authError}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-900"
          >
            {notice}
          </div>
        )}

        {mode === 'signin' ? (
          <form className="space-y-4" onSubmit={submitLogin}>
            <label className="block text-sm font-semibold text-slate-700">
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                placeholder="you@gmail.com"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
                placeholder="Enter your password"
              />
            </label>

            <button type="submit" disabled={disabled} className={primaryButtonClass}>
              {submitting ? <><Spinner /> Signing in…</> : 'Sign in'}
            </button>
          </form>
        ) : registrationStep === 'details' ? (
          <form className="space-y-4" onSubmit={sendRegistrationCode}>
            <label className="block text-sm font-semibold text-slate-700">
              Full name
              <input
                type="text"
                autoComplete="name"
                maxLength={120}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
                placeholder="Your full name"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Gmail address
              <input
                type="email"
                autoComplete="email"
                required
                pattern="^[^@\s]+@gmail\.com$"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                placeholder="you@gmail.com"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Phone number <span className="font-normal text-slate-400">(optional)</span>
              <input
                type="tel"
                autoComplete="tel"
                maxLength={32}
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                className={inputClass}
                placeholder="Your phone number"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
                placeholder="At least 8 characters"
              />
            </label>

            <button type="submit" disabled={disabled} className={primaryButtonClass}>
              {submitting ? <><Spinner /> Sending code…</> : 'Send confirmation code'}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={completeRegistration}>
            <label className="block text-sm font-semibold text-slate-700">
              Confirmation code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                className={`${inputClass} text-center text-xl font-bold tracking-[0.4em]`}
                placeholder="000000"
              />
            </label>
            <p className="text-xs leading-5 text-slate-500">
              The code expires in 10 minutes. Check your inbox and spam folder.
            </p>
            <button type="submit" disabled={disabled} className={primaryButtonClass}>
              {submitting ? <><Spinner /> Confirming…</> : 'Confirm email & create account'}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setRegistrationStep('details');
                setCode('');
                setError('');
                setNotice('');
              }}
              className="min-h-10 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Edit registration details
            </button>
          </form>
        )}

        <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          <span>or continue with</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => submitProviderLogin(loginWithGoogle)}
            className={socialButtonClass}
          >
            <span aria-hidden="true" className="text-base font-black text-blue-600">G</span>
            Continue with Google
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => submitProviderLogin(loginWithFacebook)}
            className={socialButtonClass}
          >
            <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-700 text-sm font-black text-white">f</span>
            Continue with Facebook
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          {mode === 'signup' ? 'Already have an account?' : 'New to the church?'}
          {' '}
          <button
            type="button"
            onClick={() => chooseMode(mode === 'signup' ? 'signin' : 'signup')}
            className="font-bold text-emerald-900 underline decoration-emerald-300 underline-offset-4 transition hover:text-emerald-700"
          >
            {mode === 'signup' ? 'Sign in' : 'Create an account'}
          </button>
        </p>
        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
          New accounts are assigned the member role. An administrator manages roles and group assignments.
        </p>
      </section>
    </main>
  );
}
