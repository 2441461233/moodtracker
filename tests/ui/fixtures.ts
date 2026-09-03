import type { StateOfMindSample } from '../../modules/mood-health/src/types';
import { MOOD_HEALTH_APP_BUNDLE_IDENTIFIER } from '../../modules/mood-health/src/types';
import type { MoodEntry } from '../../src/types';

// Entirely synthetic, constructed in the browser's local timezone for the real
// calendar/day grouping code. Never loaded from user files, HealthKit or storage.
export const FIXTURE_NOW = new Date(2026, 8, 3, 18, 30, 0);
const at = (day: number, hour = 12, minute = 0, month = 8) =>
  new Date(2026, month, day, hour, minute, 0).getTime();

const localEntries: MoodEntry[] = [
  {
    id: 'fixture-local-one',
    timestamp: at(3, 8),
    emotionId: 'good',
    activityIds: ['work'],
    note: '【合成样本】本地记录一：清晨散步。',
  },
  {
    id: 'fixture-local-two',
    timestamp: at(2, 20),
    emotionId: 'sad',
    activityIds: ['family'],
    note: '【合成样本】本地记录二：平静地回顾一天。',
  },
  {
    id: 'fixture-local-three',
    timestamp: at(31, 12, 0, 7),
    emotionId: 'joyful',
    activityIds: ['exercise'],
    note: '【合成样本】本地记录三：完成一次运动。',
  },
];

function sample(
  id: string,
  timestamp: number,
  valence: number,
  kind: StateOfMindSample['kind'] = 'momentaryEmotion',
): StateOfMindSample {
  return {
    uuid: `fixture-health-${id}`,
    timestamp,
    valence,
    kind,
    labels: [],
    associations: [],
    sourceName: kind === 'dailyMood' ? '合成 Apple 健康' : '合成 Apple Watch',
    sourceBundleId: kind === 'dailyMood' ? 'test.synthetic.health' : 'test.synthetic.watch',
    isFromThisApp: false,
  };
}

const ownCopy: StateOfMindSample = {
  ...sample('own-copy', at(3, 8), 0.5),
  sourceName: '合成 MoodTracker 副本（应被去重）',
  sourceBundleId: MOOD_HEALTH_APP_BUNDLE_IDENTIFIER,
  isFromThisApp: true,
  localEntryId: 'fixture-local-one',
};

export const FIXTURE_CASES = {
  mixed: {
    label: '混合（含去重与分页）',
    entries: localEntries,
    samples: [
      ownCopy,
      sample('moment-today', at(3, 10), -0.5),
      sample('daily-today', at(3, 18), 0.75, 'dailyMood'),
      sample('moment-yesterday', at(2, 12), 0.25),
      sample('daily-first', at(1, 19), -0.25, 'dailyMood'),
      sample('august', at(20, 12, 0, 7), -0.8),
      ...Array.from({ length: 21 }, (_, index) =>
        sample(`page-${index + 1}`, at(3, 9, index), 0.2),
      ),
    ],
    enabled: true,
    hasRead: true,
    expectation:
      '原始27条健康样本，1条本地对应副本应隐藏；9月3日=本地1+Apple23（共24）。本周Apple25条、3个记录日；当下23条均值+0.17，整体2条均值+0.25。',
  },
  'apple-only': {
    label: '仅 Apple 一天整体心情',
    entries: [] as MoodEntry[],
    samples: [
      sample('only-third', at(3, 18), 0.6, 'dailyMood'),
      sample('only-second', at(2, 18), -0.4, 'dailyMood'),
      sample('only-first', at(1, 18), 0.2, 'dailyMood'),
    ],
    enabled: true,
    hasRead: true,
    expectation:
      '本地0条。Apple3条/3天；当下情绪应显示—，一天整体心情原始均值+0.13；9月3日应有1条只读Apple记录。',
  },
  'not-read': {
    label: 'Apple 待读取',
    entries: localEntries,
    samples: [] as StateOfMindSample[],
    enabled: true,
    hasRead: false,
    expectation:
      '尚未读取不能当作0条健康记录；本地日记照常显示。Apple回顾应显示待读取，而非成功空查询。',
  },
  'permission-empty': {
    label: '空查询 / 权限未知',
    entries: localEntries,
    samples: [] as StateOfMindSample[],
    enabled: true,
    hasRead: true,
    expectation:
      '读取流程返回空数组，但不能据此判断健康里无记录或读取已授权；界面应保留权限未知说明。',
  },
  disconnected: {
    label: '未连接',
    entries: localEntries,
    samples: [] as StateOfMindSample[],
    enabled: false,
    hasRead: false,
    expectation: '纯本地3条。Today和Insights不应出现Apple统计；日历切到Apple来源应提示未连接。',
  },
} as const;

export type FixtureCase = keyof typeof FIXTURE_CASES;
