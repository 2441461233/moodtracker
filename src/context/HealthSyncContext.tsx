import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { healthExporter, MoodHealth } from '../health';
import { createHealthAutoSync, initialAutoSyncSnapshot } from '../health/auto-sync';
import type { AutoSyncSnapshot } from '../health/auto-sync';
import type { MoodEntry } from '../types';

type HealthSyncValue = AutoSyncSnapshot & {
  enable(): Promise<void>;
  disable(): Promise<void>;
  retry(): void;
};
const HealthSyncContext = createContext<HealthSyncValue | null>(null);
export function useHealthSync() {
  const value = useContext(HealthSyncContext);
  if (!value) throw new Error('HealthSyncProvider is required');
  return value;
}

export function HealthSyncProvider({
  entries,
  ready,
  children,
}: PropsWithChildren<{ entries: MoodEntry[]; ready: boolean }>) {
  const [state, setState] = useState(() => initialAutoSyncSnapshot(MoodHealth.getAvailability()));
  const coordinator = useRef<ReturnType<typeof createHealthAutoSync> | null>(null);
  const journal = useRef({ entries, ready });
  journal.current = { entries, ready };
  useEffect(() => {
    // A fresh instance per effect lifetime also survives StrictMode's development
    // setup/cleanup/setup cycle. A disposed instance is never reused.
    const sync = createHealthAutoSync({
      native: MoodHealth,
      exportEntries: (batch, options) => healthExporter.exportEntries(batch, options),
      onChange: setState,
      active: AppState.currentState === 'active',
    });
    coordinator.current = sync;
    setState(sync.getSnapshot());
    sync.updateEntries(journal.current.entries, journal.current.ready);
    const events = MoodHealth.getAvailability().available
      ? MoodHealth.addStateOfMindChangeListener(() => sync.healthChanged())
      : { remove() {} };
    const foreground = AppState.addEventListener('change', (value) =>
      sync.setActive(value === 'active'),
    );
    void sync.initialize();
    return () => {
      events.remove();
      foreground.remove();
      sync.dispose();
      if (coordinator.current === sync) coordinator.current = null;
    };
  }, []);
  useEffect(() => coordinator.current?.updateEntries(entries, ready), [entries, ready]);
  return (
    <HealthSyncContext.Provider
      value={{
        ...state,
        enable: () => coordinator.current?.enable() ?? Promise.resolve(),
        disable: () => coordinator.current?.disable() ?? Promise.resolve(),
        retry: () => coordinator.current?.retry(),
      }}
    >
      {children}
    </HealthSyncContext.Provider>
  );
}
