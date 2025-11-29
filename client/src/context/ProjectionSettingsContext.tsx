import {
  createContext,
  ReactNode,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import type { CoverageMode, ShiftTemplate, StaffMember } from '../types';

export const DEFAULT_COVERAGE_MODE: CoverageMode = 'partial_coverage';
export const DEFAULT_RATIO_STAFF = 1;
export const DEFAULT_RATIO_KIDS = 4;

type ShiftAction =
  | { type: 'add'; shift: ShiftTemplate }
  | { type: 'update'; id: string; updates: Partial<ShiftTemplate> }
  | { type: 'remove'; id: string }
  | { type: 'swap'; fromIndex: number; toIndex: number }
  | { type: 'replace'; shifts: ShiftTemplate[] };

type StaffAction =
  | { type: 'update'; id: string; updates: Partial<Pick<StaffMember, 'role' | 'status'>> }
  | { type: 'replace'; staff: StaffMember[] };

const WEEK_DAY_ORDER = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const normalizeShift = (shift: ShiftTemplate): ShiftTemplate => ({
  ...shift,
  category: shift.category ?? 'coverage',
  days: shift.days && shift.days.length ? shift.days : WEEK_DAY_ORDER,
  ratio_staff: shift.ratio_staff ?? DEFAULT_RATIO_STAFF,
  ratio_kids: shift.ratio_kids ?? DEFAULT_RATIO_KIDS,
});

const shiftReducer = (state: ShiftTemplate[], action: ShiftAction) => {
  switch (action.type) {
    case 'add': {
      const normalized = normalizeShift(action.shift);
      if (normalized.category === 'coverage') {
        const insertionIndex = state.findIndex((shift) => shift.category === 'role');
        if (insertionIndex === -1) {
          return [...state, normalized].map((shift, index) => ({ ...shift, order: index }));
        }
        const newState = [...state.slice(0, insertionIndex), normalized, ...state.slice(insertionIndex)];
        return newState.map((shift, index) => ({ ...shift, order: index }));
      }
      return [...state, normalized].map((shift, index) => ({ ...shift, order: index }));
    }
    case 'update':
      return state.map((shift) => (shift.id === action.id ? { ...shift, ...action.updates } : shift));
    case 'remove':
      return state.filter((shift) => shift.id !== action.id).map((shift, index) => ({ ...shift, order: index }));
    case 'swap': {
      const cloned = [...state];
      if (
        action.fromIndex < 0 ||
        action.toIndex < 0 ||
        action.fromIndex >= cloned.length ||
        action.toIndex >= cloned.length
      ) {
        return state;
      }
      const [moved] = cloned.splice(action.fromIndex, 1);
      cloned.splice(action.toIndex, 0, moved);
      return cloned.map((shift, index) => ({ ...shift, order: index }));
    }
    case 'replace':
      return action.shifts.map((shift, index) => ({ ...normalizeShift(shift), order: index }));
    default:
      return state;
  }
};

const staffReducer = (state: StaffMember[], action: StaffAction) => {
  if (action.type === 'replace') {
    return action.staff;
  }
  if (action.type === 'update') {
    return state.map((member) => (member.id === action.id ? { ...member, ...action.updates } : member));
  }
  return state;
};

interface ProjectionSettingsContextValue {
  shifts: ShiftTemplate[];
  staff: StaffMember[];
  coverageMode: CoverageMode;
  isDirty: boolean;
  runShiftAction: (action: ShiftAction) => void;
  runStaffAction: (action: StaffAction) => void;
  updateCoverageMode: (mode: CoverageMode) => void;
  replaceShiftsFromServer: (payload: { coverageMode: CoverageMode; shifts: ShiftTemplate[] }) => void;
  rollbackShifts: () => void;
}

const ProjectionSettingsContext = createContext<ProjectionSettingsContextValue | null>(null);

interface ProjectionSettingsProviderProps {
  children: ReactNode;
  initialShifts?: ShiftTemplate[];
  initialCoverageMode?: CoverageMode;
  initialStaff?: StaffMember[];
}

export const ProjectionSettingsProvider = ({
  children,
  initialShifts: initialShiftsProp,
  initialCoverageMode = DEFAULT_COVERAGE_MODE,
  initialStaff: initialStaffProp,
}: ProjectionSettingsProviderProps) => {
  const stableInitialShifts = useMemo(() => initialShiftsProp ?? [], [initialShiftsProp]);
  const stableInitialStaff = useMemo(() => initialStaffProp ?? [], [initialStaffProp]);
  const normalizedInitialShifts = useMemo(() => stableInitialShifts.map(normalizeShift), [stableInitialShifts]);
  const [shifts, dispatchShifts] = useReducer(shiftReducer, normalizedInitialShifts);
  const [staff, dispatchStaff] = useReducer(staffReducer, []);
  const [coverageMode, setCoverageModeState] = useState(initialCoverageMode);
  const [isDirty, setIsDirty] = useState(false);
  const lastSyncedRef = useRef<{
    coverageMode: CoverageMode;
    shifts: ShiftTemplate[];
  }>({
    coverageMode: initialCoverageMode,
    shifts: normalizedInitialShifts,
  });

  const runShiftAction = useCallback((action: ShiftAction) => {
    startTransition(() => {
      dispatchShifts(action);
    });
    setIsDirty(true);
  }, []);

  const runStaffAction = useCallback((action: StaffAction) => {
    startTransition(() => {
      dispatchStaff(action);
    });
  }, []);

  const updateCoverageMode = useCallback((mode: CoverageMode) => {
    startTransition(() => {
      setCoverageModeState(mode);
    });
    setIsDirty(true);
  }, []);

  const replaceShiftsFromServer = useCallback(
    ({ coverageMode: incomingCoverage, shifts: incomingShifts }: { coverageMode: CoverageMode; shifts: ShiftTemplate[] }) => {
      const normalizedIncoming = incomingShifts.map(normalizeShift);
      startTransition(() => {
        dispatchShifts({ type: 'replace', shifts: normalizedIncoming });
      });
      setCoverageModeState(incomingCoverage);
      setIsDirty(false);
      lastSyncedRef.current = { coverageMode: incomingCoverage, shifts: normalizedIncoming };
    },
    [],
  );

  const rollbackShifts = useCallback(() => {
    const { coverageMode: lastCoverage, shifts: lastShifts } = lastSyncedRef.current;
    startTransition(() => {
      dispatchShifts({ type: 'replace', shifts: lastShifts });
    });
    setCoverageModeState(lastCoverage);
    setIsDirty(false);
  }, []);

  useEffect(() => {
    if (isDirty) {
      return;
    }
    const coverageMatches = lastSyncedRef.current.coverageMode === initialCoverageMode;
    const shiftsMatch =
      lastSyncedRef.current.shifts.length === normalizedInitialShifts.length &&
      lastSyncedRef.current.shifts.every((shift, index) => shift.id === normalizedInitialShifts[index]?.id);
    if (coverageMatches && shiftsMatch) {
      return;
    }
    startTransition(() => {
      dispatchShifts({ type: 'replace', shifts: normalizedInitialShifts });
    });
    setCoverageModeState(initialCoverageMode);
    lastSyncedRef.current = {
      coverageMode: initialCoverageMode,
      shifts: normalizedInitialShifts,
    };
  }, [initialCoverageMode, normalizedInitialShifts, isDirty]);

  useEffect(() => {
    startTransition(() => {
      dispatchStaff({ type: 'replace', staff: stableInitialStaff });
    });
  }, [stableInitialStaff]);

  const value = useMemo(
    () => ({
      shifts,
      staff,
      coverageMode,
      isDirty,
      runShiftAction,
      runStaffAction,
      updateCoverageMode,
      replaceShiftsFromServer,
      rollbackShifts,
    }),
    [shifts, staff, coverageMode, isDirty, runShiftAction, runStaffAction, updateCoverageMode, replaceShiftsFromServer, rollbackShifts],
  );

  return <ProjectionSettingsContext.Provider value={value}>{children}</ProjectionSettingsContext.Provider>;
};

export const useProjectionSettingsContext = () => {
  const ctx = useContext(ProjectionSettingsContext);
  if (!ctx) {
    throw new Error('ProjectionSettingsProvider is missing');
  }
  return ctx;
};
