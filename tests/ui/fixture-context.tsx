import { createContext, useContext } from 'react';
import type { useMood as OriginalUseMood } from '../../src/context/MoodContext';
import type { useHealthSync as OriginalUseHealthSync } from '../../src/context/HealthSyncContext';

export type FixtureScreen = 'today' | 'calendar' | 'insights';
export type FixtureState = {
  mood: ReturnType<typeof OriginalUseMood>;
  health: ReturnType<typeof OriginalUseHealthSync>;
  screen: FixtureScreen;
  params?: Record<string, unknown>;
  navigate(name: string, params?: Record<string, unknown>): void;
};

export const FixtureContext = createContext<FixtureState | null>(null);

function useFixture() {
  const value = useContext(FixtureContext);
  if (!value) throw new Error('This test mock requires the isolated FixtureContext.');
  return value;
}

// This module is substituted at bundle time, never imported by production code.
export function useMood() {
  return useFixture().mood;
}
export function useHealthSync() {
  return useFixture().health;
}
export function useNavigation<T>() {
  const fixture = useFixture();
  return { navigate: fixture.navigate } as T;
}
export function useRoute() {
  const fixture = useFixture();
  return { key: `fixture-${fixture.screen}`, name: fixture.screen, params: fixture.params };
}
