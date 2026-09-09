import React, { PropsWithChildren, useEffect, useMemo, useRef } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { useMoodData, useMoodClock, useMoodActions } from './MoodContext';
import { navigationRef } from '../lib/navigation';
import { dayKey } from '../lib/dates';
import { makeWidgetCalendarSnapshot } from '../lib/widget-calendar';
import { setWidgetCalendarSnapshot } from '../../modules/mood-widgets';
import { WidgetSheetContext } from './WidgetSheetContext';
import { createQuickRecordController, subscribeToQuickRecordLinks } from '../lib/quick-record';

export function QuickRecordProvider({ children }: PropsWithChildren) {
  const mood = { ...useMoodData(), ...useMoodActions(), now: useMoodClock() };
  const latest = useRef(mood);
  latest.current = mood;
  const [controller] = React.useState(() =>
    createQuickRecordController((destination) => {
      if (destination.type === 'record') {
        latest.current.openComposer({ date: new Date() }, { preserveDraft: true });
      } else {
        navigationRef.navigate('calendar', {
          date: destination.date ?? dayKey(new Date()),
          source: 'local',
          widgetRequest: Date.now(),
        });
      }
    }),
  );
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const updateReady = () =>
      controller.setReady(
        latest.current.ready &&
          !latest.current.storageError &&
          navigationRef.isReady() &&
          AppState.currentState === 'active',
      );
    updateReady();
    const state = AppState.addEventListener('change', updateReady);
    const unsubscribeNavigation = navigationRef.addListener('ready', updateReady);
    const unsubscribe = subscribeToQuickRecordLinks(Linking, controller.receive);
    return () => {
      controller.setReady(false);
      state.remove();
      unsubscribeNavigation();
      unsubscribe();
    };
  }, [controller]);
  useEffect(() => {
    if (Platform.OS === 'ios')
      controller.setReady(
        mood.ready &&
          !mood.storageError &&
          navigationRef.isReady() &&
          AppState.currentState === 'active',
      );
  }, [controller, mood.ready, mood.storageError]);
  const today = dayKey(mood.now);
  const snapshot = useMemo(
    () => JSON.stringify(makeWidgetCalendarSnapshot(mood.entries, new Date())),
    [mood.entries, today],
  );
  useEffect(() => {
    if (Platform.OS !== 'ios' || !mood.ready) return;
    // Native writes are serialized. Empty/imported/edited/deleted journals all replace
    // the snapshot; storage errors remove it rather than publishing misleading data.
    const publish = () => {
      void setWidgetCalendarSnapshot(mood.storageError ? null : snapshot).catch(() => {
        latest.current.notify('日记仍保存在 App 内，小组件日历暂未更新。重新打开 App 后会再试。');
      });
    };
    publish();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') publish();
    });
    return () => subscription.remove();
  }, [snapshot, mood.ready, mood.storageError]);
  return (
    <WidgetSheetContext.Provider value={Platform.OS === 'ios' ? controller : null}>
      {children}
    </WidgetSheetContext.Provider>
  );
}
