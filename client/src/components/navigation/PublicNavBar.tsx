import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Transition } from '@headlessui/react';

const LINKS = [
  { label: 'Product', targetId: 'features' },
  { label: 'Workflows', targetId: 'workflow' },
  { label: 'Testimonials', targetId: 'testimonials' },
  { label: 'Resources', targetId: 'resources' },
];

export const PublicNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSectionNavigate = (targetId: string) => {
    if (location.pathname === '/') {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/', { state: { scrollTo: targetId } });
    }
  };

  useEffect(() => {
    if (!location.state || !(location.state as { scrollTo?: string }).scrollTo) return;
    const targetId = (location.state as { scrollTo?: string }).scrollTo;
    const timeout = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
      navigate(location.pathname + location.search + location.hash, { replace: true, state: null });
    }, 60);
    return () => window.clearTimeout(timeout);
  }, [location, navigate]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-3 rounded-full border border-white/60 bg-white/90 px-4 py-2 shadow-lg backdrop-blur-xl transition dark:border-slate-800 dark:bg-slate-900/80">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full bg-white/80 px-2 py-1 text-sm font-semibold text-slate-900 transition hover:bg-white dark:bg-white/5 dark:text-white"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-100">
              SM
            </span>
            <span className="hidden sm:inline font-heading tracking-tight">StaffMonitr</span>
            <span className="hidden text-[11px] uppercase tracking-[0.4em] text-slate-500 sm:inline">
              Geofenced staffing
            </span>
          </button>

          <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={`#${link.targetId}`}
                onClick={(event) => {
                  event.preventDefault();
                  handleSectionNavigate(link.targetId);
                }}
                className="cursor-pointer rounded-full px-3 py-2 text-slate-600 transition hover:bg-white hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-indigo-100"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              Start trial
            </Link>
            <Link
              to="/signin"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300/50 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-400/50 dark:hover:text-indigo-100"
            >
              Sign in
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/90 p-2 text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-indigo-400/60 dark:hover:text-indigo-100 md:hidden"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-controls="public-mobile-nav"
          >
            <span className="sr-only">{mobileOpen ? 'Close menu' : 'Open menu'}</span>
            {mobileOpen ? <XMarkIcon className="h-5 w-5" aria-hidden="true" /> : <Bars3Icon className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <Transition
        show={mobileOpen}
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 -translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-125"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 -translate-y-1"
      >
        <div id="public-mobile-nav" className="md:hidden">
          <div className="mx-auto mt-3 max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/90">
              <div className="space-y-1">
                {LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={`#${link.targetId}`}
                    onClick={(event) => {
                      event.preventDefault();
                      setMobileOpen(false);
                      handleSectionNavigate(link.targetId);
                    }}
                    className="block rounded-2xl px-3.5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/5"
                  >
                    {link.label}
                  </a>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:shadow-lg"
                >
                  Start trial
                </Link>
                <Link
                  to="/signin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-indigo-300/50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-indigo-400/60"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </header>
  );
};
