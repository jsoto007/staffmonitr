import { AxiosError } from 'axios';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import api, { setAuthToken } from '../utils/api';
import type { AccountGroup, StaffMember } from '../types';

const TOKEN_STORAGE_KEY = 'staffmonitr_access_token';

export interface SignupPayload {
  full_name: string;
  email: string;
  password: string;
  company?: string;
  account_name?: string;
  timezone?: string;
  branding?: {
    primaryColor?: string;
    logoUrl?: string;
  };
  geofence?: {
    lat?: number;
    lon?: number;
    radiusMeters?: number;
  };
}

interface AuthContextValue {
  currentStaff: StaffMember | null;
  accounts: AccountGroup[];
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (payload: SignupPayload) => Promise<boolean>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  currentStaff: null,
  accounts: [],
  loading: true,
  error: null,
  isAuthenticated: false,
  login: async () => false,
  signup: async () => false,
  logout: () => {},
  refresh: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(null);
  const [accounts, setAccounts] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const persistToken = (token: string | null) => {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    setAuthToken(token);
  };

  const parseAuthError = (err: unknown, fallback: string) => {
    const axiosErr = err as AxiosError<{ error?: string }>;
    if (axiosErr?.response?.data?.error) {
      return axiosErr.response.data.error;
    }
    if (axiosErr?.request && !axiosErr.response) {
      return 'Cannot reach the server. Check your connection and API URL.';
    }
    return fallback;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        persistToken(null);
        setCurrentStaff(null);
        setAccounts([]);
        return;
      }
      persistToken(storedToken);
      const response = await api.get('/auth/me');
      setCurrentStaff(response.data.staff);
      setAccounts(response.data.accounts);
      setError(null);
    } catch (err) {
      persistToken(null);
      setCurrentStaff(null);
      setAccounts([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { access_token, staff, accounts: staffAccounts } = response.data;
      persistToken(access_token);
      setCurrentStaff(staff);
      setAccounts(staffAccounts);
      return true;
    } catch (err) {
      setError(parseAuthError(err, 'Unable to sign in.'));
      return false;
    }
  };

  const signup = async (payload: SignupPayload) => {
    setError(null);
    try {
      const response = await api.post('/auth/signup', payload);
      const { access_token, staff, accounts: staffAccounts } = response.data;
      persistToken(access_token);
      setCurrentStaff(staff);
      setAccounts(staffAccounts);
      return true;
    } catch (err) {
      setError(parseAuthError(err, 'Unable to create workspace.'));
      return false;
    }
  };

  const logout = () => {
    persistToken(null);
    setCurrentStaff(null);
    setAccounts([]);
    setError(null);
  };

  const value = useMemo(
    () => ({
      currentStaff,
      accounts,
      loading,
      error,
      isAuthenticated: Boolean(currentStaff),
      login,
      signup,
      logout,
      refresh,
    }),
    [accounts, currentStaff, error, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
