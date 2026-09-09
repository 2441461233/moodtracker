import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createQuickRecordController,
  isQuickRecordURL,
  parseWidgetURL,
  QUICK_RECORD_URL,
  subscribeToQuickRecordLinks,
} from '../src/lib/quick-record';

test('only the explicit quick record route opens a composer', () => {
  for (const url of [QUICK_RECORD_URL, 'moodjournal://record/', 'MOODJOURNAL://RECORD'])
    assert.equal(isQuickRecordURL(url), true);
  for (const url of [
    null,
    '',
    'https://record',
    'moodjournal://recording',
    'moodjournal://record?note=external',
    'moodjournal://record/edit',
    'moodjournal://record#other',
    'moodjournal://delete',
  ])
    assert.equal(isQuickRecordURL(url), false);
});

test('calendar links validate actual Gregorian dates and accept only calendar parameters', () => {
  assert.deepEqual(parseWidgetURL('moodjournal://calendar'), { type: 'calendar' });
  assert.deepEqual(parseWidgetURL('moodjournal://calendar?date=2024-02-29'), {
    type: 'calendar',
    date: '2024-02-29',
  });
  for (const url of [
    'moodjournal://calendar?date=2026-02-29',
    'moodjournal://calendar?date=2026-13-01',
    'moodjournal://calendar?date=1969-01-01',
    'moodjournal://calendar?date=2026-09-07&note=outside',
    'moodjournal://calendar/edit',
  ])
    assert.equal(parseWidgetURL(url), null);
});

test('a calendar link selects its day without dismissing an existing draft', () => {
  const opened: unknown[] = [];
  const controller = createQuickRecordController((destination) => opened.push(destination));
  controller.setReady(true);
  const unregister = controller.register({
    preserve: true,
    dismiss: () => assert.fail('Must not discard existing draft'),
  });
  controller.receive('moodjournal://calendar?date=2026-09-07');
  unregister();
  assert.deepEqual(opened, [{ type: 'calendar', date: '2026-09-07' }]);
});

test('the latest requested widget wins while waiting for launch', () => {
  const opened: unknown[] = [];
  const controller = createQuickRecordController((destination) => opened.push(destination));
  controller.receive(QUICK_RECORD_URL);
  controller.receive('moodjournal://calendar?date=2026-09-07');
  controller.receive('moodjournal://unknown');
  controller.setReady(true);
  assert.deepEqual(opened, [{ type: 'calendar', date: '2026-09-07' }]);
});

test('cold launch waits for storage and activation, coalesces taps and does not reopen on resume', () => {
  let opened = 0;
  const controller = createQuickRecordController(() => opened++);
  controller.receive(QUICK_RECORD_URL);
  controller.receive(QUICK_RECORD_URL);
  assert.equal(opened, 0);
  controller.setReady(true);
  assert.equal(opened, 1);
  controller.setReady(false);
  controller.setReady(true);
  controller.refresh();
  assert.equal(opened, 1);
  controller.receive(QUICK_RECORD_URL);
  assert.equal(opened, 2);
});

test('failed storage retains the launch request until recovery succeeds', () => {
  let opened = 0;
  const controller = createQuickRecordController(() => opened++);
  controller.setReady(false);
  controller.receive(QUICK_RECORD_URL);
  controller.refresh();
  assert.equal(opened, 0);
  controller.setReady(true);
  assert.equal(opened, 1);
});

test('an existing draft or edit absorbs the shortcut without resetting or reopening after save', () => {
  let opened = 0;
  const controller = createQuickRecordController(() => opened++);
  controller.setReady(true);
  const unregister = controller.register({
    preserve: true,
    dismiss: () => assert.fail('Must not dismiss a draft'),
  });
  controller.receive(QUICK_RECORD_URL);
  controller.receive(QUICK_RECORD_URL);
  assert.equal(opened, 0);
  unregister();
  assert.equal(opened, 0);
});

test('waits for actual native dismissal, handling nested and temporarily busy sheets in order', () => {
  const events: string[] = [];
  const controller = createQuickRecordController(() => events.push('open'));
  controller.setReady(true);
  const bottom = controller.register({ preserve: false, dismiss: () => events.push('bottom') });
  let busy = true;
  const top = controller.register({
    preserve: false,
    dismiss: () => {
      if (!busy) events.push('top');
    },
  });
  controller.receive(QUICK_RECORD_URL);
  assert.deepEqual(events, []);
  busy = false;
  controller.refresh();
  assert.deepEqual(events, ['top']);
  top();
  assert.deepEqual(events, ['top', 'bottom']);
  bottom();
  assert.deepEqual(events, ['top', 'bottom', 'open']);
});

function linkSource() {
  let resolve!: (url: string | null) => void;
  let reject!: (reason: Error) => void;
  const initial = new Promise<string | null>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  let listener: ((event: { url: string }) => void) | undefined;
  return {
    linking: {
      getInitialURL: () => initial,
      addEventListener: (_: 'url', receive: (event: { url: string }) => void) => {
        listener = receive;
        return { remove: () => (listener = undefined) };
      },
    },
    resolve,
    reject,
    emit: (url: string) => listener?.({ url }),
  };
}

test('listens before reading launch URL; a newer URL event wins over the delayed initial URL', async () => {
  const source = linkSource();
  const received: (string | null)[] = [];
  const dispose = subscribeToQuickRecordLinks(source.linking, (url) => received.push(url));
  source.emit(QUICK_RECORD_URL);
  source.resolve(QUICK_RECORD_URL);
  await Promise.resolve();
  assert.deepEqual(received, [QUICK_RECORD_URL]);
  source.emit(QUICK_RECORD_URL);
  assert.equal(received.length, 2, 'subsequent warm launches must still work');
  dispose();
  source.emit(QUICK_RECORD_URL);
  assert.equal(received.length, 2);
});

test('cold URL is delivered once and not delivered after listener disposal', async () => {
  for (const disposed of [false, true]) {
    const source = linkSource();
    const received: (string | null)[] = [];
    const dispose = subscribeToQuickRecordLinks(source.linking, (url) => received.push(url));
    if (disposed) dispose();
    source.resolve(QUICK_RECORD_URL);
    await Promise.resolve();
    assert.deepEqual(received, disposed ? [] : [QUICK_RECORD_URL]);
    dispose();
  }
});

test('launch URL read failure does not stop warm URL handling', async () => {
  const source = linkSource();
  const received: (string | null)[] = [];
  const dispose = subscribeToQuickRecordLinks(source.linking, (url) => received.push(url));
  source.reject(new Error('No launch URL available'));
  await Promise.resolve();
  source.emit(QUICK_RECORD_URL);
  assert.deepEqual(received, [QUICK_RECORD_URL]);
  dispose();
});
