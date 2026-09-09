import { parseLocalDate } from './dates';

export const QUICK_RECORD_URL = 'moodjournal://record';

export type WidgetDestination = { type: 'record' } | { type: 'calendar'; date?: string };

export function parseWidgetURL(url: string | null): WidgetDestination | null {
  if (isQuickRecordURL(url)) return { type: 'record' };
  if (typeof url !== 'string') return null;
  const match = /^moodjournal:\/\/calendar\/?(?:\?date=(\d{4}-\d{2}-\d{2}))?$/i.exec(url);
  if (!match) return null;
  const date = match[1];
  if (date && (!parseLocalDate(date) || Number(date.slice(0, 4)) < 1970)) return null;
  return date ? { type: 'calendar', date } : { type: 'calendar' };
}

export function isQuickRecordURL(url: string | null): boolean {
  // A single, explicit route. External links cannot supply journal content or edit IDs.
  return typeof url === 'string' && /^moodjournal:\/\/record\/?$/i.test(url);
}

export interface QuickRecordSheet {
  preserve: boolean;
  dismiss: () => void;
}

/** Wait for storage, foreground activation and native sheet dismissal before presenting. */
export function createQuickRecordController(open: (destination: WidgetDestination) => void) {
  let ready = false;
  let pending: WidgetDestination | null = null;
  const sheets = new Set<QuickRecordSheet>();
  const refresh = () => {
    if (!ready || !pending) return;
    const current = [...sheets];
    if (current.some((sheet) => sheet.preserve)) {
      const destination = pending;
      pending = null;
      // A calendar link may change the tab behind a draft, but never discard it.
      if (destination.type === 'calendar') open(destination);
      return;
    }
    const top = current.at(-1);
    if (top) {
      // Busy sheets retain the request and call refresh when they can close.
      top.dismiss();
      return;
    }
    const destination = pending;
    pending = null;
    open(destination);
  };
  return {
    refresh,
    receive(url: string | null) {
      const destination = parseWidgetURL(url);
      if (!destination) return;
      pending = destination;
      refresh();
    },
    setReady(value: boolean) {
      ready = value;
      refresh();
    },
    register(sheet: QuickRecordSheet) {
      sheets.add(sheet);
      return () => {
        sheets.delete(sheet);
        refresh();
      };
    },
  };
}

export type QuickRecordController = ReturnType<typeof createQuickRecordController>;

export interface QuickRecordLinking {
  getInitialURL(): Promise<string | null>;
  addEventListener(type: 'url', listener: (event: { url: string }) => void): { remove(): void };
}

export function subscribeToQuickRecordLinks(
  linking: QuickRecordLinking,
  receive: (url: string | null) => void,
) {
  let live = true;
  let receivedEvent = false;
  const subscription = linking.addEventListener('url', ({ url }) => {
    receivedEvent = true;
    receive(url);
  });
  void linking.getInitialURL().then(
    (url) => {
      // Do not replay a delayed launch URL after a newer foreground event.
      if (live && !receivedEvent) receive(url);
    },
    () => undefined,
  );
  return () => {
    live = false;
    subscription.remove();
  };
}
