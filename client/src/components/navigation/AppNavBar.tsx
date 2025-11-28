import { Transition } from '@headlessui/react';
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  ClipboardDocumentListIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  SignalIcon,
  SparklesIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_ROLE_SET } from '../../constants/roles';

type Category = {
  id: string;
  to: string;
  label: string;
  accent: string;
  Icon: typeof HomeIcon;
  items: {
    id: string;
    label: string;
    to: string;
    Icon: typeof HomeIcon;
  }[];
};

const NAV_CATEGORIES: Category[] = [
  {
    id: 'dashboard',
    to: '/dashboard',
    label: 'Dashboard',
    accent: 'from-cyan-400/60 via-sky-500/60 to-indigo-500/60',
    Icon: HomeIcon,
    items: [
      { id: 'ratios', label: 'Live ratios', to: '/dashboard', Icon: SignalIcon },
      { id: 'compliance', label: 'Compliance map', to: '/dashboard', Icon: ShieldCheckIcon },
      { id: 'trends', label: 'Trends', to: '/dashboard', Icon: ChartBarSquareIcon },
    ],
  },
  {
    id: 'calendar',
    to: '/calendar/projection',
    label: 'Projection',
    accent: 'from-indigo-400/60 via-blue-500/70 to-sky-500/60',
    Icon: CalendarDaysIcon,
    items: [
      { id: 'publish', label: 'Projection', to: '/calendar/projection', Icon: SparklesIcon },
      { id: 'projection-settings', label: 'Projection Settings', to: '/calendar/projection-settings', Icon: ClipboardDocumentListIcon },
      { id: 'staff-matrix', label: 'Staff Matrix', to: '/calendar/staff-matrix', Icon: ShieldCheckIcon },
    ],
  },
  {
    id: 'roster',
    to: '/roster',
    label: 'Roster',
    accent: 'from-teal-400/60 via-emerald-400/60 to-cyan-400/60',
    Icon: UserGroupIcon,
    items: [
      { id: 'roster', label: 'Roster', to: '/roster', Icon: ClipboardDocumentListIcon },
      { id: 'staff', label: 'Staff', to: '/staff', Icon: SparklesIcon },
      { id: 'notes', label: 'Notes', to: '/roster', Icon: MagnifyingGlassIcon },
    ],
  },
  {
    id: 'open-shifts',
    to: '/open-shifts',
    label: 'Open Shifts',
    accent: 'from-amber-300/70 via-orange-400/70 to-rose-400/70',
    Icon: MegaphoneIcon,
    items: [
      { id: 'broadcast', label: 'Broadcast', to: '/open-shifts', Icon: MegaphoneIcon },
      { id: 'candidates', label: 'Candidates', to: '/open-shifts', Icon: UserGroupIcon },
      { id: 'approvals', label: 'Approvals', to: '/open-shifts', Icon: ShieldCheckIcon },
    ],
  },
];

export const AppNavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentStaff, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);
  const springEase = 'cubic-bezier(0.18, 1, 0.22, 1.25)';

  useEffect(() => {
    setMobileMenuOpen(false);
    setMenuOpen(false);
    setActiveCategory(null);
  }, [location.pathname, location.search]);

  const isActive = (path: string) => {
    const normalized = path.replace(/\/+$/, '');
    const current = location.pathname.replace(/\/+$/, '');
    return current === normalized || current.startsWith(`${normalized}/`);
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, []);

  const handleCategoryToggle = (category: Category) => {
    if (activeCategory?.id === category.id && menuOpen) {
      setMenuOpen(false);
      return;
    }

    setActiveCategory(category);
    setMenuOpen(true);
  };

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  const isAdmin = ADMIN_ROLE_SET.has(currentStaff?.role ?? '');
  const roleLabel = currentStaff?.role ?? 'Visitor';
  const cta = useMemo(
    () =>
      isAdmin
        ? { to: '/admin', label: 'Admin console' }
        : { to: '/open-shifts', label: 'Find open shifts' },
    [isAdmin],
  );
  const renderCategoryButton = (category: Category) => {
    const { id, label, Icon, accent, to } = category;
    const selected = activeCategory?.id === id;
    const routeActive = isActive(to);
    const transform = !activeCategory
      ? 'translateX(0) scale(1)'
      : selected
        ? 'translateX(-120%) scale(1.02)'
        : 'translateX(48%) scale(0.98)';

    return (
      <button
        key={id}
        type="button"
        aria-pressed={selected}
        aria-expanded={selected}
        onClick={() => handleCategoryToggle(category)}
        className={clsx(
          'group relative inline-flex items-center justify-center overflow-hidden rounded-2xl border px-3 py-2 text-sm font-semibold transition-all duration-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
          'ease-[cubic-bezier(0.18,1,0.22,1.25)]',
          selected
            ? `bg-gradient-to-r ${accent} text-slate-900 ring-1 ring-white/40 shadow-[0_15px_45px_rgba(79,70,229,0.25)] dark:text-white`
            : 'bg-white/70 text-slate-900/90 hover:-translate-y-0.5 hover:bg-white/80 dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/15',
          routeActive && !selected ? 'ring-1 ring-indigo-300/70 dark:ring-indigo-400/50' : 'border-white/30 dark:border-white/10',
          selected ? 'pl-3 pr-6' : 'pl-3 pr-3',
        )}
        style={{
          transform,
          transition: `transform 700ms ${springEase}`,
        }}
      >
        <span
          className={clsx(
            'absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-60',
            selected ? 'bg-white/10' : 'bg-white/15 dark:bg-white/5',
          )}
          aria-hidden
        />
        <Icon className={clsx('relative h-5 w-5 transition duration-500', selected ? 'drop-shadow-[0_4px_18px_rgba(14,165,233,0.45)]' : '')} aria-hidden="true" />
        <span
          className={clsx(
            'ml-2 truncate text-sm transition-all duration-800',
            'ease-[cubic-bezier(0.18,1,0.22,1.25)]',
            selected ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0',
          )}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <header className="fixed top-6 left-4 right-4 z-50">
      <div className="mx-auto max-w-6xl px-2 sm:px-4">
        <div
          ref={navRef}
          className="relative isolate overflow-hidden rounded-[2rem] border border-white/40 bg-white/70 px-4 py-3 shadow-lg shadow-black/5 backdrop-blur-2xl transition-all duration-300 ease-out hover:shadow-xl hover:shadow-black/10 dark:border-white/10 dark:bg-slate-900/60 dark:shadow-xl dark:shadow-black/20"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white/70 via-white/10 to-white/30 opacity-90 dark:from-slate-800/60 dark:via-slate-900/70 dark:to-slate-900/50" />
          <div className="pointer-events-none absolute inset-x-12 top-0 -z-10 h-28 bg-gradient-to-br from-sky-400/50 via-indigo-500/40 to-purple-500/30 opacity-70 blur-3xl dark:from-sky-500/25 dark:via-indigo-400/25 dark:to-blue-500/25" />
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className={clsx(
                'flex items-center gap-3 rounded-2xl px-2 py-1 text-slate-900 transition hover:text-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500 dark:text-white',
                'transition-opacity duration-500',
                activeCategory ? 'opacity-0' : 'opacity-100',
              )}
            >
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/35 via-sky-500/40 to-blue-500/35 text-base font-semibold text-indigo-800 shadow-inner shadow-white/40 dark:text-indigo-100">
                SM
              </span>
              <span className="hidden sm:inline font-heading text-lg font-semibold tracking-tight">StaffMonitr</span>
            </Link>

            <div className="flex-1 min-w-0">
              <nav
                aria-label="Primary"
                className={clsx(
                  'relative mx-auto flex max-w-3xl items-center gap-2 pr-4 sm:pr-8 transition-all duration-800',
                  'ease-[cubic-bezier(0.18,1,0.22,1.25)]',
                  activeCategory ? 'justify-start' : 'justify-center',
                )}
                style={{
                  paddingLeft: activeCategory ? '5.5rem' : '0',
                  transition: `padding-left 700ms ${springEase}`,
                }}
              >
                {activeCategory ? (
                  <>
                    {renderCategoryButton(activeCategory)}
                    <div
                      className={clsx(
                        'ml-auto flex items-center gap-2 transition-all duration-800',
                        'ease-[cubic-bezier(0.18,1,0.22,1.25)]',
                      )}
                    >
                      {NAV_CATEGORIES.filter((cat) => cat.id !== activeCategory.id).map(renderCategoryButton)}
                    </div>
                  </>
                ) : (
                  NAV_CATEGORIES.map(renderCategoryButton)
                )}
              </nav>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <div className="hidden items-center xl:flex">
                <span
                  className={clsx(
                    'inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] shadow-inner shadow-white/30 backdrop-blur',
                    isAdmin
                      ? 'text-amber-800 ring-1 ring-amber-200/70 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100'
                      : 'text-slate-800 dark:border-white/15 dark:bg-white/10 dark:text-white',
                  )}
                >
                  <ShieldCheckIcon className="h-4 w-4" aria-hidden="true" />
                  {roleLabel}
                </span>
              </div>

              {cta && (
                <Link
                  to={cta.to}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/40 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  <MegaphoneIcon className="h-4 w-4" aria-hidden="true" />
                  <span>{cta.label}</span>
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-indigo-200 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:border-indigo-400/60 dark:hover:text-indigo-100"
              >
                <ArrowRightStartOnRectangleIcon className="h-4 w-4" aria-hidden="true" />
                <span>Logout</span>
              </button>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/70 p-2 text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-white/15 dark:bg-white/10 dark:text-white md:hidden"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-menu"
            >
              <span className="sr-only">{mobileMenuOpen ? 'Close menu' : 'Open menu'}</span>
              {mobileMenuOpen ? <XMarkIcon className="h-5 w-5" aria-hidden="true" /> : <Bars3Icon className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>

          <Transition
            show={menuOpen}
            enter="transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            enterFrom="opacity-0 -translate-y-2"
            enterTo="opacity-100 translate-y-0"
            leave="transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 -translate-y-10"
            afterLeave={() => setActiveCategory(null)}
          >
            <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-white/25 bg-white/20 p-3 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {activeCategory?.items.map((item, index) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className="group relative flex flex-col items-start justify-center gap-2 rounded-xl border border-white/30 bg-white/70 px-3 py-3 text-left text-slate-900 shadow-sm transition duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:border-indigo-200/70 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
                    style={{
                      transitionDelay: `${index * 70}ms`,
                      opacity: activeCategory ? 1 : 0,
                      transform: activeCategory ? 'translateY(0)' : 'translateY(8px)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          'inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br text-slate-900 shadow-inner shadow-white/60 dark:text-white',
                          activeCategory?.accent ?? 'from-indigo-500/40 via-sky-400/40 to-cyan-400/40',
                        )}
                      >
                        <item.Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="inline-flex items-center justify-center rounded-2xl border border-white/30 bg-white/70 p-3 text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
                aria-label="Close expanded menu"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </Transition>
        </div>
      </div>

      <Transition
        show={mobileMenuOpen}
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 -translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-125"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 -translate-y-1"
      >
        <div id="mobile-nav-menu" className="md:hidden">
          <div className="mx-auto mt-3 max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-white/30 bg-white/85 p-4 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/85">
              <div className="space-y-1">
                {NAV_CATEGORIES.map(({ to, label, Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition duration-150',
                      isActive(to)
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-100'
                        : 'text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/5',
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/30 bg-white/85 p-4 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/85">
                <div
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em]',
                    isAdmin
                      ? 'bg-amber-50/90 text-amber-800 ring-1 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-100'
                      : 'bg-white/80 text-slate-800 ring-1 ring-white/60 dark:bg-white/10 dark:text-white',
                  )}
                >
                  <ShieldCheckIcon className="h-4 w-4" aria-hidden="true" />
                  {roleLabel}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {cta && (
                  <Link
                    to={cta.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:shadow-lg"
                  >
                    <MegaphoneIcon className="h-4 w-4" aria-hidden="true" />
                    <span>{cta.label}</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                >
                  <ArrowRightStartOnRectangleIcon className="h-4 w-4" aria-hidden="true" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </header>
  );
};
