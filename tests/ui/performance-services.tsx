import React, { type PropsWithChildren } from 'react';
import { createMoodStorage } from '../../src/storage/core';

// Synthetic adapter only. No localStorage, AsyncStorage, native bridge or network.
const data = new Map<string, string>();
export const moodStorage = createMoodStorage({
  getItem: async (key) => data.get(key) ?? null,
  setItem: async (key, value) => {
    data.set(key, value);
  },
});
export function HealthSyncProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}
export const selectionAsync = async () => undefined;
export const notificationAsync = async () => undefined;
export const NotificationFeedbackType = { Success: 'success' };
