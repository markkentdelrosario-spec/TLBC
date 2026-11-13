import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getRoleHomePath, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiBaseUrl } from '../config/api';
import { LOCAL_WELCOME_SLIDES } from '../utils/localSlideshow';

const LOGIN_TAGLINE = 'YOUR FAITH JOURNEY STARTS HERE.';
const inputClass =
  'mt-1.5 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-800 focus:ring-2 focus:ring-teal-100';
const primaryButtonClass =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-900 px-4 py-3 text-sm font-bold text-white transition duration-200 hover:bg-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const socialButtonClass =
  'flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

function getLoginError(error) {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'The email or password is incorrect.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact your church administrator.';
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

function getRegistrationError(error) {
  if (error?.status === 410) return 'Your verification code expired. Request a new code to continue.';
  if (error?.status === 429) return error.message || 'Please wait before trying again.';
  return getLoginError(error);
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
    const error = new Error(payload.message || `Request failed with status ${response.status}.`);
    error.status = response.status;
    error.code = payload.code;
    throw error;
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
  const { showToast } = useToast();
  const {
    user,
    loading,
    authError,
    loginWithEmail,
    loginWithGoogle,
    loginWithFacebook,
    resetPassword,
    finishCustomTokenSignIn,
  } = useAuth();
  const [mode, setMode] = useState('signin');
  const [registrationStep, setRegistrationStep] = useState('details');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState(
    () => window.localStorage.getItem('tlbc-remembered-email') || ''
  );
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(
    () => window.localStorage.getItem('tlbc-remember-me') === 'true'
  );
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [visualIndex, setVisualIndex] = useState(0);
  const [previousVisualIndex, setPreviousVisualIndex] = useState(null);
  const [typedTagline, setTypedTagline] = useState('');

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTypedTagline(LOGIN_TAGLINE);
      return undefined;
    }

    let direction = 1;
    let pauseTicks = 0;
    const timer = window.setInterval(() => {
      setTypedTagline((tagline) => {
        if (pauseTicks > 0) {
          pauseTicks -= 1;
          return tagline;
        }
        if (tagline.length >= LOGIN_TAGLINE.length) {
          direction = -1;
          pauseTicks = 12;
          return tagline;
        }
        if (tagline.length <= 0) {
          direction = 1;
          pauseTicks = 4;
          return tagline;
        }
        return LOGIN_TAGLINE.slice(0, tagline.length + direction);
      });
    }, 55);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setPreviousVisualIndex(visualIndex);
      setVisualIndex((visualIndex + 1) % LOCAL_WELCOME_SLIDES.length);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [visualIndex]);

  useEffect(() => {
    if (previousVisualIndex === null) return undefined;
    const timer = window.setTimeout(() => setPreviousVisualIndex(null), 700);
    return () => window.clearTimeout(timer);
  }, [previousVisualIndex]);

  useEffect(() => {
    if (user?.role) navigate(getRoleHomePath(user.role), { replace: true });
  }, [navigate, user]);

  async function submitLogin(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      if (rememberMe) {
        window.localStorage.setItem('tlbc-remembered-email', email.trim());
        window.localStorage.setItem('tlbc-remember-me', 'true');
      } else {
        window.localStorage.removeItem('tlbc-remembered-email');
        window.localStorage.removeItem('tlbc-remember-me');
      }
      const profile = await loginWithEmail(email.trim(), password);
      navigate(getRoleHomePath(profile.role), { replace: true });
    } catch (loginError) {
      setError(getLoginError(loginError));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendPasswordReset() {
    setError('');
    setNotice('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const message = 'Enter your email address first to reset your password.';
      setError(message);
      showToast(message, 'error');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email.trim());
      const message = 'If an account exists for this email, a password reset link is on its way.';
      setNotice(message);
      showToast(message, 'success');
    } catch (resetError) {
      const message = getLoginError(resetError);
      setError(message);
      showToast(message, 'error');
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
      const message = 'Use a valid Gmail address ending in @gmail.com.';
      setError(message);
      showToast(message, 'error');
      return;
    }
    if (password.length < 8) {
      const message = 'Choose a password with at least 8 characters.';
      setError(message);
      showToast(message, 'error');
      return;
    }
    setSubmitting(true);
    try {
      const result = await registrationRequest('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
      });
      setRegistrationStep('code');
      setNotice(result.message);
      showToast(result.message, 'success');
    } catch (requestError) {
      if (requestError?.code === 'REGISTRATION_PENDING') {
        setRegistrationStep('code');
        setNotice(requestError.message);
        return;
      }
      const message = getRegistrationError(requestError);
      setError(message);
      showToast(message, 'error');
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
      const result = await registrationRequest('/auth/verify-otp', {
        email: email.trim(),
        otp: code.trim(),
        password,
      });
      showToast(result.message, 'success');
      const profile = await finishCustomTokenSignIn(result.customToken);
      navigate(getRoleHomePath(profile.role), { replace: true });
    } catch (requestError) {
      const message = getRegistrationError(requestError);
      setError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function resendRegistrationOtp() {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const result = await registrationRequest('/auth/resend-otp', {
        email: email.trim(),
      });
      setNotice(result.message);
      showToast(result.message, 'success');
    } catch (requestError) {
      const message = getRegistrationError(requestError);
      setError(message);
      showToast(message, 'error');
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
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-3 sm:p-6">
      <section className="grid w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/10 md:min-h-[680px] md:grid-cols-2">
        <aside className="relative isolate flex min-h-[360px] flex-col justify-between overflow-hidden bg-slate-950 p-6 text-white sm:min-h-[440px] sm:p-10 md:min-h-full md:p-12">
          {previousVisualIndex !== null && (
            <img
              src={LOCAL_WELCOME_SLIDES[previousVisualIndex].src}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 -z-20 h-full w-full object-cover"
            />
          )}
          <img
            key={LOCAL_WELCOME_SLIDES[visualIndex].id}
            src={LOCAL_WELCOME_SLIDES[visualIndex].src}
            alt=""
            className="absolute inset-0 -z-20 h-full w-full animate-[welcome-slide-in_700ms_ease-in-out_both] object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/45 via-slate-950/30 to-slate-950/90" />
          <Link
            to="/"
            aria-label="The Life Builder Church home"
            className="relative inline-flex w-fit rounded-full bg-white/95 p-1.5 shadow-lg transition hover:scale-105"
          >
            <img src="/images/logo/Logo.jpg" alt="The Life Builder Church" className="h-14 w-14 rounded-full object-cover" />
          </Link>

          <div className="relative mt-16 max-w-xl sm:mt-20 md:mt-24">
            <h1
              aria-label={LOGIN_TAGLINE}
              className="min-h-[3.2em] text-3xl font-black uppercase leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl"
            >
              {typedTagline}
              <span aria-hidden="true" className="ml-1 inline-block h-[0.85em] w-0.5 animate-pulse bg-amber-300 align-baseline motion-reduce:animate-none" />
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/90 sm:text-base">
              Find your place in a church family rooted in faith, fellowship, and service.
            </p>
            <p className="mt-4 text-sm font-semibold text-amber-200">
              Your journey of faith starts here.
            </p>
          </div>

          <div className="relative mt-8 flex items-center gap-2" aria-label="Welcome slideshow">
            {LOCAL_WELCOME_SLIDES.map((slide, index) => (
              <span
                key={slide.id}
                aria-current={index === visualIndex ? 'true' : undefined}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === visualIndex ? 'w-7 bg-amber-300' : 'w-1.5 bg-white/60'
                }`}
              />
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 items-center bg-white px-6 py-8 sm:px-10 sm:py-10 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <Link
              to="/"
              className="mb-8 inline-flex min-h-8 items-center text-sm font-medium text-slate-500 transition hover:text-teal-900"
            >
              <span aria-hidden="true" className="mr-2">←</span> Back to home
            </Link>

            <header className="mb-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-800">
                The Life Builder Church
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                {mode === 'signin'
                  ? 'WELCOME BACK !'
                  : registrationStep === 'code'
                    ? 'VERIFY YOUR EMAIL'
                    : 'CREATE YOUR ACCOUNT'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {mode === 'signin'
                  ? 'Welcome back! Please enter your details.'
                  : registrationStep === 'code'
                    ? `Enter the verification code sent to ${email}.`
                    : 'Join our church family with an email address or a social account.'}
              </p>
            </header>

            {(error || authError) && (
              <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">
                {error || authError}
              </div>
            )}
            {notice && (
              <div role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-900">
                {notice}
              </div>
            )}

            {mode === 'signin' ? (
              <form className="space-y-4" onSubmit={submitLogin}>
                <label className="block text-xs font-semibold text-slate-700">
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass}
                    placeholder="Enter your email"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Password
                  <span className="relative mt-1.5 block">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={`${inputClass} pr-12`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((shown) => !shown)}
                      className="absolute inset-y-0 right-1 grid w-10 place-items-center rounded-md text-slate-400 transition hover:text-teal-900"
                    >
                      {showPassword ? (
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 5.2A10.7 10.7 0 0112 5c5.5 0 9 7 9 7a16 16 0 01-3.1 3.8M6.2 6.2C3.9 7.8 3 12 3 12s3.5 7 9 7c1 0 1.9-.2 2.7-.5" />
                        </svg>
                      ) : (
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" />
                          <circle cx="12" cy="12" r="2.5" />
                        </svg>
                      )}
                    </button>
                  </span>
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3 py-1 text-xs">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-teal-900 focus:ring-teal-700"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={sendPasswordReset}
                    disabled={disabled}
                    className="font-bold text-teal-900 transition hover:text-teal-700 disabled:opacity-60"
                  >
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={disabled} className={primaryButtonClass}>
                  {submitting ? <><Spinner /> Signing in…</> : 'Sign in'}
                </button>
              </form>
            ) : registrationStep === 'details' ? (
              <form className="space-y-4" onSubmit={sendRegistrationCode}>
                <label className="block text-xs font-semibold text-slate-700">
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
                <label className="block text-xs font-semibold text-slate-700">
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
                <label className="block text-xs font-semibold text-slate-700">
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
                <label className="block text-xs font-semibold text-slate-700">
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
                  {submitting ? <><Spinner /> Sending code…</> : 'Send verification code'}
                </button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={completeRegistration}>
                <label className="block text-xs font-semibold text-slate-700">
                  Verification code
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
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
                  onClick={resendRegistrationOtp}
                  className="min-h-10 w-full rounded-lg border border-teal-900 px-4 py-2 text-sm font-semibold text-teal-900 transition hover:bg-teal-50 disabled:opacity-60"
                >
                  {submitting ? 'Please wait…' : 'Resend verification code'}
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
                  className="min-h-10 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Edit registration details
                </button>
              </form>
            )}

            <div className="my-5 flex items-center gap-3 text-xs font-medium text-slate-400">
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
                <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
                  <path fill="#4285F4" d="M47.5 24.5c0-1.6-.2-3.2-.5-4.7H24v9h13.2c-.6 3-2.3 5.5-4.9 7.2l7.5 5.8c4.4-4.1 7.7-10 7.7-17.3Z" />
                  <path fill="#34A853" d="M24 48c6.6 0 12.2-2.2 16.3-6.2l-7.5-5.8c-2.1 1.4-4.8 2.2-8.8 2.2-6.4 0-11.8-4.3-13.7-10.1l-7.8 6C6.4 41.5 14.4 48 24 48Z" />
                  <path fill="#FBBC05" d="M10.3 28.1a14.5 14.5 0 010-8.2l-7.8-6a24 24 0 000 20.2l7.8-6Z" />
                  <path fill="#EA4335" d="M24 9.5c3.6 0 6.8 1.2 9.3 3.6l7-7C36.1 2.3 30.6 0 24 0 14.4 0 6.4 6.5 2.5 13.9l7.8 6C12.2 13.8 17.6 9.5 24 9.5Z" />
                </svg>
                {mode === 'signin' ? 'Sign in with Google' : 'Continue with Google'}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => submitProviderLogin(loginWithFacebook)}
                className={socialButtonClass}
              >
                <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-700 text-sm font-black text-white">f</span>
                {mode === 'signin' ? 'Sign in with Facebook' : 'Continue with Facebook'}
              </button>
            </div>
            {mode === 'signup' && (
              <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                Google and Facebook sign-in do not use the manual email confirmation code.
              </p>
            )}

            <p className="mt-6 text-center text-sm text-slate-600">
              {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
              {' '}
              <button
                type="button"
                onClick={() => chooseMode(mode === 'signup' ? 'signin' : 'signup')}
                className="font-bold text-teal-900 transition hover:text-teal-700"
              >
                {mode === 'signup' ? 'Sign in' : 'Sign up'}
              </button>
            </p>
            {mode === 'signup' && (
              <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                New accounts are assigned the member role. An administrator manages roles and group assignments.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
