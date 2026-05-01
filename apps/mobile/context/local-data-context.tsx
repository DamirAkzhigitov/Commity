import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getLocalDatabase } from '../lib/local-db';

export type LocalDataContextValue = {
  ready: boolean;
  error: Error | null;
  refreshKey: number;
  refresh: () => void;
};

const LocalDataContext = createContext<LocalDataContextValue | null>(null);

export function LocalDataProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getLocalDatabase()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const value = useMemo<LocalDataContextValue>(
    () => ({ ready, error, refreshKey, refresh }),
    [ready, error, refreshKey, refresh],
  );

  return <LocalDataContext.Provider value={value}>{children}</LocalDataContext.Provider>;
}

export function useLocalData(): LocalDataContextValue {
  const ctx = useContext(LocalDataContext);
  if (!ctx) {
    throw new Error('useLocalData must be used within LocalDataProvider');
  }
  return ctx;
}
