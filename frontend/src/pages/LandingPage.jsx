import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SereneBackdrop from '../components/layout/SereneBackdrop';
import OfferOnlineModal from '../components/shared/OfferOnlineModal';
import { getRoleHomePath, useAuth } from '../context/AuthContext';

const navigationItems = [
  { label: 'About Us', href: '#about-us' },
  { label: 'Mission and Vision', href: '#mission-and-vision' },
  { label: 'Connect with Us', href: '#connect-with-us' },
  { label: 'Join Us', href: '#join-us' },
];

const visitorFormUrl =
  'https://docs.google.com/forms/d/e/1FAIpQLSdrRZWVqw-DfdQb94BG07sW5rTzrm-5g206O5E0jjp8Kr5vcg/viewform?embedded=true';

const titleFirstLine = 'The Life Builder';
const titleLastLine = 'Church';
const fullTitle = `${titleFirstLine} ${titleLastLine}`;
const sectionClass = 'scroll-mt-24 px-4 py-16 sm:px-8 sm:py-20 lg:py-24';
const contentClass = 'mx-auto w-full max-w-6xl';

export default function LandingPage() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [offerOnlineOpen, setOfferOnlineOpen] = useState(false);
  const [typedCharacters, setTypedCharacters] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTypedCharacters(fullTitle.length);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setTypedCharacters((characters) => {
        if (characters >= fullTitle.length) {
          window.clearInterval(intervalId);
          return characters;
        }
        return characters + 1;
      });
    }, 75);

    return () => window.clearInterval(intervalId);
  }, []);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <main className="relative isolate min-h-screen bg-slate-950 text-white">
      <SereneBackdrop />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <a href="#home" className="flex min-w-0 items-center gap-3" aria-label="The Life Builder Church home">
            <img
              src="/images/logo/Logo.jpg"
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/30"
            />
            <span className="truncate text-sm font-bold tracking-wide text-white sm:text-base">
              The Life Builder Church
            </span>
          </a>

          <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
            {navigationItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-2 text-sm font-semibold text-emerald-50/90 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-200"
              >
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => setOfferOnlineOpen(true)}
              className="rounded-full px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              Offer Online
            </button>
          </nav>

          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/20 text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-200 lg:hidden"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-mobile-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span className="sr-only">{mobileMenuOpen ? 'Close menu' : 'Open menu'}</span>
            <span aria-hidden="true" className="flex w-5 flex-col gap-1.5">
              <span className={`h-0.5 w-full rounded bg-current transition ${mobileMenuOpen ? 'translate-y-2 rotate-45' : ''}`} />
              <span className={`h-0.5 w-full rounded bg-current transition ${mobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`h-0.5 w-full rounded bg-current transition ${mobileMenuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
            </span>
          </button>
        </div>

        {mobileMenuOpen && (
          <nav
            id="landing-mobile-navigation"
            aria-label="Mobile navigation"
            className="border-t border-white/10 px-4 py-3 lg:hidden sm:px-8"
          >
            <div className="mx-auto grid max-w-7xl gap-1">
              {navigationItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-emerald-50 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-200"
                >
                  {item.label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  setOfferOnlineOpen(true);
                }}
                className="flex min-h-11 items-center rounded-lg px-3 text-left text-sm font-semibold text-amber-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-200"
              >
                Offer Online
              </button>
            </div>
          </nav>
        )}
      </header>

      <section id="home" className="scroll-mt-20 px-4 py-16 sm:px-8 sm:py-24 lg:py-32">
        <div className={`${contentClass} grid items-center gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(17rem,.7fr)] lg:gap-16`}>
          <div className="max-w-3xl">
            <div className="mb-8 inline-flex rounded-2xl bg-white p-2 shadow-xl shadow-black/20">
              <img
                src="/images/logo/Logo.jpg"
                alt="The Life Builder Church logo"
                className="h-16 w-16 rounded-xl object-cover sm:h-20 sm:w-20"
              />
            </div>
            <div className="mb-7 inline-flex max-w-full items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-emerald-50 backdrop-blur-md">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.9)]" />
              A community growing together in faith
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-200 sm:text-base">
              Welcome to
            </p>
            <h1
              aria-label={fullTitle}
              className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            >
              <span aria-hidden="true" className="block">
                {fullTitle.slice(0, Math.min(typedCharacters, titleFirstLine.length))}
                {typedCharacters < fullTitle.length && typedCharacters <= titleFirstLine.length && (
                  <span className="ml-1 inline-block h-[0.85em] w-0.5 translate-y-1 animate-pulse bg-amber-100 motion-reduce:animate-none" />
                )}
              </span>
              <span aria-hidden="true" className="mt-2 block font-serif italic text-amber-100">
                {typedCharacters > titleFirstLine.length &&
                  titleLastLine.slice(0, typedCharacters - titleFirstLine.length - 1)}
                {typedCharacters < fullTitle.length && typedCharacters > titleFirstLine.length && (
                  <span className="ml-1 inline-block h-[0.85em] w-0.5 translate-y-1 animate-pulse bg-amber-100 motion-reduce:animate-none" />
                )}
              </span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-slate-100/85 sm:text-xl sm:leading-8">
              A place to belong, serve, and build a life rooted in hope. We’re glad
              you’re here—let’s grow together, one step and one Sunday at a time.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#join-us"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-amber-200 px-7 py-3 text-sm font-bold text-emerald-950 shadow-lg shadow-amber-950/20 transition duration-300 hover:-translate-y-0.5 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-emerald-950 sm:text-base"
              >
                Join Us
                <span aria-hidden="true" className="ml-3 text-lg">→</span>
              </a>
              <a
                href="#about-us"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 bg-white/5 px-7 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-200 sm:text-base"
              >
                Learn about us
              </a>
              <Link
                to={user ? getRoleHomePath(user.role) : '/login'}
                className="inline-flex min-h-12 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-emerald-50 underline decoration-white/40 underline-offset-4 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-200 sm:text-base"
              >
                {user ? 'Go to your dashboard' : 'Sign in'}
              </Link>
            </div>
          </div>

          <aside className="rounded-3xl border border-white/15 bg-slate-950/35 p-6 shadow-2xl shadow-black/15 backdrop-blur-md sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">You are welcome here</p>
            <p className="mt-4 text-2xl font-semibold leading-snug text-white sm:text-3xl">
              Faith, fellowship, and service—growing together.
            </p>
            <div className="mt-6 border-t border-white/15 pt-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                Sunday Worship
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Every Sunday <span className="text-amber-200">·</span> 8:30 AM
              </p>
            </div>
            <a
              href="#connect-with-us"
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-100 underline decoration-emerald-100/50 underline-offset-4 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              Plan a visit
              <span aria-hidden="true">→</span>
            </a>
          </aside>
        </div>
      </section>

      <section id="about-us" className={`${sectionClass} border-y border-white/10 bg-slate-950/45`}>
        <div className={`${contentClass} grid gap-8 md:grid-cols-[minmax(12rem,.7fr)_minmax(0,1.3fr)] md:gap-16`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">About Us</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">A place to belong and grow</h2>
          </div>
          <div className="max-w-3xl text-base leading-7 text-slate-100/80 sm:text-lg sm:leading-8">
            <p>
              The Life Builder Church is a community growing together in faith.
              We welcome people to find belonging, build a life rooted in hope,
              and serve one another.
            </p>
            <p className="mt-4">
              Whether you are exploring faith or looking for a church community,
              we would be glad to meet you.
            </p>
          </div>
        </div>
      </section>

      <section id="mission-and-vision" className={sectionClass}>
        <div className={contentClass}>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Mission and Vision</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Growing in faith, building lives</h2>
          </div>
          <div className="mt-8 grid gap-4 md:mt-12 md:grid-cols-2 md:gap-6">
            <article className="rounded-2xl border border-white/15 bg-white/[0.06] p-6 sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-200">Our Mission</p>
              <p className="mt-4 text-lg leading-8 text-slate-100/85">
                To help people build a life rooted in hope through faith,
                fellowship, and service.
              </p>
            </article>
            <article className="rounded-2xl border border-white/15 bg-white/[0.06] p-6 sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-200">Our Vision</p>
              <p className="mt-4 text-lg leading-8 text-slate-100/85">
                To be a welcoming community where people belong, grow together
                in faith, and build one another up.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="connect-with-us" className={`${sectionClass} border-y border-white/10 bg-slate-950/45`}>
        <div className={contentClass}>
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Connect with Us</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">We’d love to hear from you</h2>
            <p className="mt-4 text-base leading-7 text-slate-100/75">
              Visit us, follow along, or send us a message. We look forward to connecting.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-10 lg:grid-cols-3">
            <a
              href="https://maps.app.goo.gl/UCKt8jXNTMFoS9pm6"
              target="_blank"
              rel="noopener noreferrer"
              className="group min-h-44 rounded-2xl border border-white/15 bg-white/[0.06] p-5 transition hover:-translate-y-1 hover:border-emerald-200/50 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-200 sm:p-6"
            >
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">Live Location</span>
              <span className="mt-3 block text-base font-semibold leading-7 text-white">
                63 J M. L. Quezon St. New Lower Bicutan, Taguig, Philippines, 1632
              </span>
              <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-100 group-hover:text-white">
                Open in Google Maps <span aria-hidden="true">↗</span>
              </span>
            </a>

            <a
              href="https://www.facebook.com/TheLifeBuilderChurch"
              target="_blank"
              rel="noopener noreferrer"
              className="group min-h-44 rounded-2xl border border-white/15 bg-white/[0.06] p-5 transition hover:-translate-y-1 hover:border-emerald-200/50 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-200 sm:p-6"
            >
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">Facebook Page</span>
              <span className="mt-3 block text-lg font-semibold text-white">The Life Builder Church</span>
              <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-100 group-hover:text-white">
                Visit our Facebook page <span aria-hidden="true">↗</span>
              </span>
            </a>

            <a
              href="mailto:thelifebuilderchurch@gmail.com"
              className="group min-h-44 rounded-2xl border border-white/15 bg-white/[0.06] p-5 transition hover:-translate-y-1 hover:border-emerald-200/50 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-200 sm:col-span-2 sm:p-6 lg:col-span-1"
            >
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">Email Address</span>
              <span className="mt-3 block break-all text-base font-semibold text-white">
                thelifebuilderchurch@gmail.com
              </span>
              <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-100 group-hover:text-white">
                Send us an email <span aria-hidden="true">→</span>
              </span>
            </a>
          </div>
        </div>
      </section>

      <section id="join-us" className={sectionClass}>
        <div className={contentClass}>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Join Us</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Let’s get connected</h2>
            <p className="mt-4 text-base leading-7 text-slate-100/75">
              Share a little about yourself using our visitor connection form.
            </p>
          </div>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl shadow-black/20 sm:mt-10">
            <iframe
              src={visitorFormUrl}
              title="The Life Builder Church visitor connection form"
              className="block h-[850px] w-full border-0 sm:h-[950px] lg:h-[1000px]"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <p className="mt-4 text-center text-sm text-slate-200/75">
            Having trouble with the form?{' '}
            <a
              href="https://forms.gle/SeKoEQuKx8gLyEfc9"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-amber-100 underline decoration-amber-100/50 underline-offset-4 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              Open it in Google Forms
            </a>
            .
          </p>
        </div>
      </section>

      <section id="offer-online" className={`${sectionClass} border-t border-white/10 bg-slate-950/45`}>
        <div className={`${contentClass} grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(16rem,.7fr)]`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Offer Online</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Give with a quick scan</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-100/75">
              Use the giving QR code to make your offering online.
            </p>
            <button
              type="button"
              onClick={() => setOfferOnlineOpen(true)}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-amber-200 px-6 py-3 text-sm font-bold text-emerald-950 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-white"
            >
              View giving QR code
            </button>
          </div>
          <div className="mx-auto w-full max-w-sm rounded-3xl border border-white/20 bg-white p-4 shadow-xl">
            <img
              src="/images/QR/QR1.jpg"
              alt="Offer Online giving QR code"
              className="aspect-square w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/15 px-4 py-7 text-center text-xs tracking-wide text-emerald-50/70 sm:px-8 sm:text-sm">
        <p>THE LIFE BUILDER CHURCH <span className="mx-2">·</span> Faith, fellowship, and service</p>
        <a href="#home" className="mt-3 inline-block min-h-10 py-3 font-semibold text-emerald-100 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-200">
          Back to top ↑
        </a>
      </footer>
      <OfferOnlineModal open={offerOnlineOpen} onClose={() => setOfferOnlineOpen(false)} />
    </main>
  );
}
